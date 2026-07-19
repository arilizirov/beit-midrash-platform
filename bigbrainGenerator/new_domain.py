#!/usr/bin/env python3
"""bigbrain domain generator — enforcement by construction.

Stamps a new domain in the exact shape the brains and BoundaryGuard expect,
AND registers it in boundaries.yaml, so new code is BORN correct and walled off
instead of being hand-rolled into a structure that drifts.

It stamps the SKELETON (folders, public surface, a failing stub test). You then
write the SPECIFIC logic per spec. It templates the predictable *shape*, never
the divergent *logic*.

USAGE
    python bigbrainGenerator/new_domain.py billing
    python bigbrainGenerator/new_domain.py billing --lang py --allow platform users
    python bigbrainGenerator/new_domain.py billing --root . --source-root src

The stub test is written to FAIL on purpose (red first), so the first thing you
do in the new domain is make a real test pass — the TDD loop, pre-seeded.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

TS_FILES = {
    "index.ts": "// Public surface of the {name} domain. Export ONLY what other\n"
    "// domains may use. Everything else stays internal to this folder.\nexport {{}};\n",
    "contracts.ts": "// Types/interfaces this domain exposes or consumes at its boundary.\nexport {{}};\n",
    "model.ts": "// Domain entities and pure business rules for {name}.\nexport {{}};\n",
    "service.ts": "// Use-cases for {name}. Orchestrates model + repo. No framework leakage.\nexport {{}};\n",
    "repo.ts": "// Persistence for {name}, behind a small interface. Wraps vendor weirdness.\nexport {{}};\n",
}

# RED FIRST: the stub test fails until you implement the first real behavior.
TS_TEST_BODY = (
    "\n// RED FIRST: this fails until you implement the first real behavior.\n"
    "describe('{name}', () => {{\n"
    "  it('does its first real thing', () => {{\n"
    "    expect(false).toBe(true); // replace with a real behavior assertion\n"
    "  }});\n}});\n"
)
TS_TEST_IMPORTS = {
    "vitest": "import {{ describe, it, expect }} from 'vitest';\n",
    "jest": "import {{ describe, it, expect }} from '@jest/globals';\n",
}

PY_FILES = {
    "__init__.py": '"""Public surface of the {name} domain.\n\n'
    "Export ONLY what other domains may use (define __all__). Keep internals\n"
    'under _internal/ so the boundary check can keep them private."""\n\n__all__ = []\n',
    "contracts.py": '"""Types this domain exposes or consumes at its boundary."""\n',
    "model.py": '"""Domain entities and pure business rules for {name}."""\n',
    "service.py": '"""Use-cases for {name}. Orchestrates model + repo."""\n',
    "repo.py": '"""Persistence for {name}, behind a small interface."""\n',
    "_internal/__init__.py": '"""Private to {name}. Other domains must not import from here."""\n',
}

PY_TEST = (
    'import pytest\n\n'
    '# RED FIRST: this fails until you implement the first real behavior.\n'
    'def test_{name}_does_its_first_real_thing():\n'
    '    assert False, "replace with a real behavior assertion"\n'
)


def detect_lang(root: Path) -> str:
    if (root / "package.json").exists():
        return "ts"
    if (root / "pyproject.toml").exists() or (root / "setup.cfg").exists():
        return "py"
    return "ts"


def detect_test_framework(root: Path) -> str:
    pkg = root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            deps = {**(data.get("devDependencies") or {}), **(data.get("dependencies") or {})}
            if "jest" in deps:
                return "jest"
            if "vitest" in deps:
                return "vitest"
        except Exception:
            pass
    return "vitest"


def resolve_layout(root: Path, explicit: str | None) -> str:
    """Folder convention for domains: explicit flag > boundaries.yaml `layout:` >
    'domains'. boundaries.yaml is the single source of truth so docs/STACK.md
    never has to (and must not) override it."""
    if explicit:
        return explicit.strip("/")
    by = root / "boundaries.yaml"
    if by.exists():
        try:
            import yaml

            m = yaml.safe_load(by.read_text()) or {}
            lay = m.get("layout")
            if lay:
                return str(lay).strip("/")
        except Exception:
            pass
    return "domains"


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"  skip (exists): {path}")
        return
    path.write_text(text)
    print(f"  created: {path}")


def stamp_ts(domain_dir: Path, name: str, framework: str = "vitest") -> None:
    for fname, tmpl in TS_FILES.items():
        write(domain_dir / fname.format(name=name), tmpl.format(name=name))
    test_text = TS_TEST_IMPORTS.get(framework, TS_TEST_IMPORTS["vitest"]).format(name=name) + \
        TS_TEST_BODY.format(name=name)
    write(domain_dir / f"{name}.test.ts", test_text)


def stamp_py(domain_dir: Path, name: str) -> None:
    for fname, tmpl in PY_FILES.items():
        write(domain_dir / fname.format(name=name), tmpl.format(name=name))
    write(domain_dir / "tests" / f"test_{name}.py", PY_TEST.format(name=name))


def register_in_manifest(manifest: Path, name: str, rel_path: str, allow: list[str]) -> None:
    """Insert the new domain under `modules:` and `allow:` by text insertion,
    so the human-edited comments in boundaries.yaml are preserved."""
    if not manifest.exists():
        print(f"  note: {manifest.name} not found — add this module yourself:")
        print(f"    modules.{name}.path = {rel_path}; allow.{name} = {allow}")
        return

    text = manifest.read_text()
    if f"\n  {name}:" in text or f"\n  {name} " in text:
        print(f"  manifest already mentions '{name}' — leaving boundaries.yaml untouched")
        return

    lines = text.splitlines(keepends=True)
    out: list[str] = []
    inserted_mod = inserted_allow = False
    allow_str = "[" + ", ".join(allow) + "]" if allow else "[]"

    def is_anchor(line: str, key: str) -> bool:
        # tolerate trailing spaces / inline comments: `modules:`  or  `modules:  # foo`
        return re.match(rf"^{key}:\s*(#.*)?$", line.rstrip("\n")) is not None

    for line in lines:
        out.append(line)
        if not inserted_mod and is_anchor(line, "modules"):
            out.append(f"  {name}:\n")
            out.append(f"    path: {rel_path}\n")
            out.append("    public: [index]\n")
            inserted_mod = True
        if not inserted_allow and is_anchor(line, "allow"):
            out.append(f"  {name}: {allow_str}\n")
            inserted_allow = True

    if not inserted_mod:
        print("  WARNING: no `modules:` line found in boundaries.yaml — register manually.")
    if not inserted_allow:
        print("  WARNING: no `allow:` line found in boundaries.yaml — register manually.")
    manifest.write_text("".join(out))
    if inserted_mod and inserted_allow:
        print(f"  registered '{name}' in {manifest.name} (allow: {allow_str})")


def main() -> int:
    p = argparse.ArgumentParser(description="Generate a new domain skeleton")
    p.add_argument("name", help="domain name (valid identifier, e.g. billing)")
    p.add_argument("--root", default=".", type=Path)
    p.add_argument("--source-root", default="src")
    p.add_argument("--layout", default=None, help="domain folder convention: domains|features (default from boundaries.yaml `layout:`, else 'domains')")
    p.add_argument("--lang", choices=["ts", "py"], default=None)
    p.add_argument("--allow", nargs="*", default=["platform"], help="modules this domain may import")
    args = p.parse_args()

    if not args.name.isidentifier():
        sys.exit(f"'{args.name}' is not a valid identifier (no hyphens/spaces/leading digits).")

    root = args.root.resolve()
    lang = args.lang or detect_lang(root)
    rel_path = f"{resolve_layout(root, args.layout)}/{args.name}"
    domain_dir = root / args.source_root / rel_path

    print(f"generating {lang} domain '{args.name}' at {domain_dir}")
    if lang == "ts":
        framework = detect_test_framework(root)
        stamp_ts(domain_dir, args.name, framework)
    else:
        stamp_py(domain_dir, args.name)

    register_in_manifest(root / "boundaries.yaml", args.name, rel_path, args.allow)

    print(
        "\ndone. Next:\n"
        f"  1. run the cycle — the stub test should FAIL (red):  python bigbrain_verify.py --only test\n"
        "  2. write a real failing test, then the minimum code to pass (green)\n"
        "  3. check boundaries:  python bigbrainBoundaryGuard/check_boundaries.py check"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
