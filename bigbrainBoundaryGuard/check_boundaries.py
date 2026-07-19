#!/usr/bin/env python3
"""bigbrain BoundaryGuard — mechanical boundary enforcement.

WHAT THIS IS
    A thin dispatcher over the mature, standard dependency-graph validators:

        dependency-cruiser   TypeScript / JavaScript     (default)
        import-linter        Python                      (default)
        tach                 Python                      (opt-in alternative)

    It does NOT analyze the import graph itself. Reimplementing module
    resolution, re-exports, path aliases and per-language import semantics is
    exactly the boring, edge-case-ridden work those tools already got right.
    BoundaryGuard owns the *policy* (boundaries.yaml) and the *interface*; the
    proven tools own the *analysis*.

WHY IT EXISTS
    The judgment brains tell an agent how to REASON about a boundary. Nothing
    in prose can ENFORCE one — an LLM agent is just another untrusted committer
    and its self-attestation is not a gate. This makes the boundary a real
    check that fails a real build. Wire it into CI behind branch protection
    (see ../BRANCH_PROTECTION.md) and the agent is free to write a violation
    but unable to merge one.

SINGLE SOURCE OF TRUTH
    boundaries.yaml is authoritative. For dependency-cruiser and import-linter
    the tool config is generated FRESH each run into a temp file, so it can
    never drift from the manifest. (tach is config-file-native: it reads a
    committed tach.toml; `generate --adapter tach` writes the starting file.)

USAGE
    python check_boundaries.py check                 # detect + enforce (CI uses this)
    python check_boundaries.py explain               # human-readable rule summary
    python check_boundaries.py generate --adapter dependency-cruiser
    python check_boundaries.py generate --adapter import-linter --write
    python check_boundaries.py generate --adapter tach --write

    --manifest PATH   default: boundaries.yaml (falls back to the sample)
    --root PATH       repo root to run validators in (default: cwd)

Only dependency on top of the stdlib is PyYAML (pip install pyyaml).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("BoundaryGuard needs PyYAML. Install it:  pip install pyyaml")

JS_EXT = "(ts|tsx|js|jsx|mjs|cjs)"


# --------------------------------------------------------------------------- #
# Manifest model
# --------------------------------------------------------------------------- #
class Manifest:
    """Parsed, normalized view of boundaries.yaml."""

    def __init__(self, raw: dict):
        self.adapter: str = raw.get("adapter", "auto")
        self.root: str = raw.get("source_root", "src").strip("/")
        self.enforce_public: bool = bool(raw.get("enforce_public_surface", True))

        mods = raw.get("modules") or {}
        if not mods:
            sys.exit("boundaries.yaml: at least one module is required under `modules:`")
        # name -> {"path": str, "public": [str]}
        self.modules: dict[str, dict] = {}
        for name, info in mods.items():
            info = info or {}
            self.modules[name] = {
                "path": str(info.get("path", name)).strip("/"),
                "public": list(info.get("public", ["index"])),
            }

        sk = raw.get("shared_kernel")
        if sk:
            self.shared_name = "shared_kernel"
            self.shared = {
                "path": str(sk.get("path", "shared-kernel")).strip("/"),
                "public": list(sk.get("public", ["index"])),
            }
        else:
            self.shared_name = None
            self.shared = None

        allow = raw.get("allow") or {}
        self.allow: dict[str, set[str]] = {
            name: set(allow.get(name) or []) for name in self.modules
        }

        py = raw.get("python") or {}
        self.py_root: str | None = py.get("root_package")
        self.py_internal: bool = bool(py.get("enforce_internal_convention", False))

    # -- helpers ----------------------------------------------------------- #
    def names(self) -> list[str]:
        return list(self.modules)

    def all_regions(self) -> list[tuple[str, dict]]:
        """Modules plus the shared kernel (for public-surface rules)."""
        out = list(self.modules.items())
        if self.shared:
            out.append((self.shared_name, self.shared))
        return out

    def path_re(self, info: dict) -> str:
        """Regex matching files INSIDE a region."""
        return "^" + re.escape(f"{self.root}/{info['path']}") + "/"

    def public_re(self, info: dict) -> str:
        """Regex matching a region's PUBLIC entry files.

        Accepts both file entries (foo/index.ts) and dir entries that resolve
        through an index (foo/db -> foo/db/index.ts).
        """
        alts = "|".join(re.escape(p) for p in info["public"])
        base = re.escape(f"{self.root}/{info['path']}")
        return f"^{base}/({alts})(/index)?\\.{JS_EXT}$"

    def dotted(self, info: dict) -> str:
        """Python dotted module path for a region."""
        mod = info["path"].replace("/", ".")
        return f"{self.py_root}.{mod}" if self.py_root else mod


def load_manifest(path: Path) -> Manifest:
    if not path.exists():
        sample = path.with_name("boundaries.sample.yaml")
        if sample.exists():
            print(f"note: {path.name} not found; using {sample.name}", file=sys.stderr)
            path = sample
        else:
            sys.exit(f"manifest not found: {path}")
    with path.open() as fh:
        raw = yaml.safe_load(fh) or {}
    return Manifest(raw)


# --------------------------------------------------------------------------- #
# Adapter: dependency-cruiser  (TS / JS)   -> .dependency-cruiser.json
# --------------------------------------------------------------------------- #
def gen_depcruise(m: Manifest) -> dict:
    forbidden: list[dict] = [
        {
            "name": "no-circular",
            "severity": "error",
            "comment": "Circular dependencies are a boundary smell.",
            "from": {},
            "to": {"circular": True},
        }
    ]

    # Deep-import ban: from OUTSIDE a region into its non-public files.
    if m.enforce_public:
        for name, info in m.all_regions():
            forbidden.append(
                {
                    "name": f"{name}-public-surface",
                    "severity": "error",
                    "comment": f"Import '{name}' only via its public surface "
                    f"({', '.join(info['public'])}); deep imports are forbidden.",
                    "from": {"pathNot": m.path_re(info)},
                    "to": {"path": m.path_re(info), "pathNot": m.public_re(info)},
                }
            )

    # Default-deny allowlist between modules (shared kernel is always allowed).
    for src in m.names():
        allowed = m.allow.get(src, set())
        for dst in m.names():
            if dst == src or dst in allowed:
                continue
            forbidden.append(
                {
                    "name": f"{src}-cannot-import-{dst}",
                    "severity": "error",
                    "comment": f"'{src}' is not allowed to depend on '{dst}' "
                    f"(not listed under allow.{src} in boundaries.yaml).",
                    "from": {"path": m.path_re(m.modules[src])},
                    "to": {"path": m.path_re(m.modules[dst])},
                }
            )

    # Shared kernel must import nothing from domains/platform.
    if m.shared:
        for dst in m.names():
            forbidden.append(
                {
                    "name": f"shared-kernel-cannot-import-{dst}",
                    "severity": "error",
                    "comment": "The shared kernel must stay leaf-level and import no module.",
                    "from": {"path": m.path_re(m.shared)},
                    "to": {"path": m.path_re(m.modules[dst])},
                }
            )

    return {
        "forbidden": forbidden,
        "options": {
            "doNotFollow": {"path": "(^|/)(node_modules|dist|build|\\.next|coverage)(/|$)"},
            "exclude": {"path": "(^|/)generated(/|$)"},
            "tsPreCompilationDeps": True,
            "baseDir": ".",
        },
    }


def run_depcruise(m: Manifest, root: Path) -> int:
    cfg = gen_depcruise(m)
    # Resolve @/-style path aliases by handing depcruise the tsconfig, when present.
    if (root / "tsconfig.json").exists():
        cfg["options"]["tsConfig"] = {"fileName": "tsconfig.json"}
    runner = _resolve_depcruise(root)
    if runner is None:
        print(
            "  dependency-cruiser not found. Install it:\n"
            "      npm i -D dependency-cruiser     (then re-run)",
            file=sys.stderr,
        )
        return 2
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
        json.dump(cfg, tf, indent=2)
        cfg_path = tf.name
    try:
        cmd = runner + ["--config", cfg_path, "--output-type", "err", m.root]
        return subprocess.call(cmd, cwd=str(root))
    finally:
        os.unlink(cfg_path)


def _resolve_depcruise(root: Path):
    # Prefer the JS entrypoint via node — identical on Windows/macOS/Linux.
    # (The .bin shim isn't directly executable on Windows -> WinError 193.)
    mjs = root / "node_modules" / "dependency-cruiser" / "bin" / "dependency-cruise.mjs"
    if mjs.exists() and shutil.which("node"):
        return ["node", str(mjs)]
    if os.name == "nt":
        cmd = root / "node_modules" / ".bin" / "depcruise.cmd"
        if cmd.exists():
            return [str(cmd)]
    local = root / "node_modules" / ".bin" / "depcruise"
    if local.exists():
        return [str(local)]
    if shutil.which("depcruise"):
        return ["depcruise"]
    # No npx fallback on purpose: it triggers surprise installs and noisy
    # registry errors. Install the tool explicitly (CI does `npm ci`).
    return None


# --------------------------------------------------------------------------- #
# Adapter: import-linter  (Python)   -> .importlinter (INI)
# --------------------------------------------------------------------------- #
def _check_python_names(m: Manifest) -> None:
    """Python packages can't contain hyphens etc. Fail clearly if a path can't
    map to a valid module name, instead of letting the tool fail cryptically."""
    bad = []
    for _, info in m.all_regions():
        for seg in info["path"].split("/"):
            if not seg.isidentifier():
                bad.append(f"'{info['path']}' (segment '{seg}')")
    if bad:
        sys.exit(
            "Python adapters need module paths that are valid Python package "
            "names (no hyphens, no leading digits). Offending: "
            + "; ".join(bad)
            + ". Rename the directories (use underscores) or use the TS adapter."
        )


def gen_importlinter(m: Manifest) -> str:
    if not m.py_root:
        sys.exit(
            "import-linter adapter needs python.root_package in boundaries.yaml "
            "(the importable top-level package, e.g. `myapp`)."
        )
    _check_python_names(m)

    lines = [
        "[importlinter]",
        f"root_package = {m.py_root}",
        "include_external_packages = False",
        "",
    ]
    n = 0

    def contract(name: str, sources: list[str], forbidden: list[str]) -> None:
        nonlocal n
        n += 1
        lines.append(f"[importlinter:contract:{n}]")
        lines.append(f"name = {name}")
        lines.append("type = forbidden")
        lines.append("source_modules =")
        for s in sources:
            lines.append(f"    {s}")
        lines.append("forbidden_modules =")
        for f in forbidden:
            lines.append(f"    {f}")
        lines.append("")

    # Default-deny allowlist between modules.
    for src in m.names():
        allowed = m.allow.get(src, set())
        denied = [
            m.dotted(m.modules[dst]) for dst in m.names() if dst != src and dst not in allowed
        ]
        if denied:
            contract(f"{src} may not import disallowed modules", [m.dotted(m.modules[src])], denied)

    # Shared kernel imports nothing.
    if m.shared:
        denied = [m.dotted(m.modules[dst]) for dst in m.names()]
        if denied:
            contract("shared kernel imports no module", [m.dotted(m.shared)], denied)

    # Public surface via the _internal convention (opt-in).
    if m.enforce_public and m.py_internal:
        for name, info in m.all_regions():
            others = [
                m.dotted(i) for n2, i in m.all_regions() if n2 != name
            ]
            if others:
                contract(
                    f"{name} internals are private",
                    others,
                    [f"{m.dotted(info)}._internal"],
                )

    return "\n".join(lines).rstrip() + "\n"


def run_importlinter(m: Manifest, root: Path) -> int:
    ini = gen_importlinter(m)
    if shutil.which("lint-imports"):
        base = ["lint-imports"]
    else:
        base = [sys.executable, "-m", "importlinter"]
    with tempfile.NamedTemporaryFile("w", suffix=".ini", delete=False) as tf:
        tf.write(ini)
        ini_path = tf.name
    env = dict(os.environ)
    # Make the root package importable from the source root.
    src_abs = str((root / m.root).resolve())
    env["PYTHONPATH"] = src_abs + os.pathsep + env.get("PYTHONPATH", "")
    try:
        cmd = base + ["--config", ini_path]
        try:
            return subprocess.call(cmd, cwd=str(root), env=env)
        except FileNotFoundError:
            print(
                "  import-linter not found. Install it:\n"
                "      pip install import-linter     (then re-run)",
                file=sys.stderr,
            )
            return 2
    finally:
        os.unlink(ini_path)


# --------------------------------------------------------------------------- #
# Adapter: tach  (Python, opt-in)   -> tach.toml  (committed, native model)
# --------------------------------------------------------------------------- #
def gen_tach(m: Manifest) -> str:
    _check_python_names(m)
    strict = "true" if m.enforce_public else "false"
    out = [
        "# Generated by BoundaryGuard from boundaries.yaml as a STARTING POINT.",
        "# tach is config-file-native: commit this file and keep it in sync",
        "# (`tach sync`). Adjust `source_roots`/paths to your project layout.",
        "",
    ]
    if m.py_root:
        out.append(f'source_roots = ["{m.root}"]')
        out.append("")

    shared_dotted = m.dotted(m.shared) if m.shared else None

    for name in m.names():
        info = m.modules[name]
        deps = [m.dotted(m.modules[d]) for d in sorted(m.allow.get(name, set()))]
        if shared_dotted:
            deps.append(shared_dotted)
        dep_str = ", ".join(f'"{d}"' for d in deps)
        out.append("[[modules]]")
        out.append(f'path = "{m.dotted(info)}"')
        out.append(f"depends_on = [{dep_str}]")
        out.append(f"strict = {strict}")
        out.append("")

    if m.shared:
        out.append("[[modules]]")
        out.append(f'path = "{shared_dotted}"')
        out.append("depends_on = []")
        out.append(f"strict = {strict}")
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def run_tach(root: Path) -> int:
    if not shutil.which("tach"):
        print(
            "  tach not found. Install it:\n"
            "      pip install tach     (then `tach sync` once, commit tach.toml, re-run)",
            file=sys.stderr,
        )
        return 2
    if not (root / "tach.toml").exists():
        print(
            "  tach.toml not found. Generate and commit it first:\n"
            "      python check_boundaries.py generate --adapter tach --write",
            file=sys.stderr,
        )
        return 2
    return subprocess.call(["tach", "check"], cwd=str(root))


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
ADAPTERS = {
    "dependency-cruiser": (gen_depcruise, run_depcruise, ".dependency-cruiser.json"),
    "import-linter": (gen_importlinter, run_importlinter, ".importlinter"),
    "tach": (gen_tach, run_tach, "tach.toml"),
}


def detect_adapters(m: Manifest, root: Path) -> list[str]:
    if m.adapter != "auto":
        return [m.adapter]
    found = []
    if (root / "package.json").exists():
        found.append("dependency-cruiser")
    if (root / "pyproject.toml").exists() or (root / "setup.cfg").exists():
        found.append("import-linter")
    return found


def cmd_doctor(m: Manifest, root: Path) -> int:
    """A boundary check over paths that match no files passes vacuously — green,
    but meaningless. Fail if any declared module maps to zero source files, so an
    unconfigured/stale manifest can't give false confidence."""
    exts = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"}
    problems = []
    for name, info in m.all_regions():
        d = root / m.root / info["path"]
        if not d.exists():
            problems.append(f"{name}: path '{m.root}/{info['path']}' does not exist")
            continue
        if not any(p.suffix in exts for p in d.rglob("*") if p.is_file()):
            problems.append(f"{name}: '{m.root}/{info['path']}' has no source files")
    n = len(m.all_regions())
    if problems:
        print("BOUNDARY DOCTOR — the manifest does not match the codebase:")
        for p in problems:
            print("  - " + p)
        print(
            "\nA boundary check over paths that match no files passes VACUOUSLY "
            "(green but meaningless).\nEdit boundaries.yaml so its modules point at "
            "real directories before trusting the check."
        )
        return 1
    print(f"BOUNDARY DOCTOR — OK: all {n} declared regions map to real source files.")
    return 0


def cmd_check(m: Manifest, root: Path) -> int:
    adapters = detect_adapters(m, root)
    if not adapters:
        print(
            "No language detected (no package.json / pyproject.toml in "
            f"{root}). Set `adapter:` in boundaries.yaml to force one.",
            file=sys.stderr,
        )
        return 2
    worst = 0
    for a in adapters:
        print(f"\n=== boundary check: {a} ===")
        _, runner, _ = ADAPTERS[a]
        rc = runner(m, root) if a != "tach" else run_tach(root)
        if rc == 0:
            print(f"  PASS ({a})")
        elif rc >= 2:
            print(f"  COULD NOT RUN ({a}) — tooling/config, see above")
        else:
            print(f"  FAIL ({a}) — boundary violation")
        worst = max(worst, rc)
    print()
    if worst == 0:
        print("BOUNDARIES OK")
    elif worst == 1:
        print("BOUNDARY VIOLATION — fix the design, not the rule")
    else:
        print("BOUNDARY CHECK COULD NOT RUN — fix tooling/config (still failing the build)")
    return worst


def cmd_generate(m: Manifest, adapter: str, write: bool, root: Path) -> int:
    gen, _, filename = ADAPTERS[adapter]
    out = gen(m)
    text = json.dumps(out, indent=2) if isinstance(out, dict) else out
    if write:
        dest = root / filename
        dest.write_text(text if text.endswith("\n") else text + "\n")
        print(f"wrote {dest}")
    else:
        print(text)
    return 0


def cmd_explain(m: Manifest) -> int:
    print("BoundaryGuard — resolved policy from the manifest\n")
    print(f"source root        : {m.root}/")
    print(f"public surface ban : {'ON' if m.enforce_public else 'off'}")
    print(f"adapter            : {m.adapter}")
    print("\nmodules and allowed dependencies (deny by default):")
    for name in m.names():
        allowed = sorted(m.allow.get(name, set()))
        if m.shared:
            allowed = allowed + [m.shared_name]
        rhs = ", ".join(allowed) if allowed else "(nothing)"
        print(f"  {name:<14} -> {rhs}")
        print(f"                 public: {', '.join(m.modules[name]['public'])}")
    if m.shared:
        print(f"  {m.shared_name:<14} -> (nothing; importable by all)")
    print("\nPython public-surface:")
    if not m.enforce_public:
        print("  off")
    elif m.py_internal:
        print("  via _internal convention (import-linter); native with tach")
    else:
        print("  not enforced by import-linter (set python.enforce_internal_convention,")
        print("  or use the tach adapter for native public-interface enforcement)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="BoundaryGuard — mechanical boundary enforcement")
    p.add_argument("--manifest", default="boundaries.yaml", type=Path)
    p.add_argument("--root", default=".", type=Path)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="detect language(s) and enforce boundaries (CI uses this)")
    sub.add_parser("doctor", help="fail if any declared module maps to zero files (anti-vacuous-pass)")
    sub.add_parser("explain", help="print the resolved policy in plain text")
    g = sub.add_parser("generate", help="emit a tool config from the manifest")
    g.add_argument("--adapter", required=True, choices=list(ADAPTERS))
    g.add_argument("--write", action="store_true", help="write into the repo instead of stdout")

    args = p.parse_args()
    root = args.root.resolve()

    # Resolve the manifest: absolute as-is; otherwise prefer one under --root,
    # else fall back to cwd-relative (load_manifest handles the sample fallback).
    manifest_path = args.manifest
    if not manifest_path.is_absolute() and (root / manifest_path).exists():
        manifest_path = root / manifest_path
    m = load_manifest(manifest_path)

    if args.cmd == "check":
        return cmd_check(m, root)
    if args.cmd == "doctor":
        return cmd_doctor(m, root)
    if args.cmd == "explain":
        return cmd_explain(m)
    if args.cmd == "generate":
        return cmd_generate(m, args.adapter, args.write, root)
    return 2


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        # Output was piped into something that closed early (e.g. `| head`).
        try:
            sys.stdout.close()
        finally:
            os._exit(0)
