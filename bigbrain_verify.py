#!/usr/bin/env python3
"""bigbrain verify — the discipline cycle in ONE command.

This is the spine. AGENTS.md tells the agent to run it; the pre-commit hook
runs it; CI runs it. It chains the checks in order and reports a single
pass/fail, so "run the checks before done" is one runnable thing instead of a
list someone has to remember.

It does not reimplement anything — it shells out to your real tools:
    typecheck   ->  npm run typecheck        (TS)
    lint        ->  npm run lint  / ruff check .
    test        ->  npm run test  / pytest   (+ optional coverage floor)
    boundaries  ->  bigbrainBoundaryGuard/check_boundaries.py check

Cross-platform (Windows/macOS/Linux): pure Python, no make/bash required.

USAGE
    python bigbrain_verify.py                 # full cycle (auto-detect stack)
    python bigbrain_verify.py --no-boundaries # CI splits this into its own job
    python bigbrain_verify.py --min-coverage 80   # pytest coverage floor (TDD proxy)
    python bigbrain_verify.py --only test     # run a single step

Exit 0 = all green. Non-zero = something failed (which step is named).
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

# npm must be invoked via cmd on Windows (it's npm.cmd) — else WinError 193.
NPM = ["cmd", "/c", "npm"] if os.name == "nt" else ["npm"]
# npx needs the same shim: it is a .CMD shim on Windows, so bare "npx" raises
# FileNotFoundError and the e2e step could NEVER run there (KIT_FIXES #11).
NPX = ["cmd", "/c", "npx"] if os.name == "nt" else ["npx"]

STEPS_ORDER = ["typecheck", "lint", "test", "e2e", "boundaries"]


def has(root: Path, name: str) -> bool:
    return (root / name).exists()


def run(label: str, cmd: list[str], root: Path, env=None) -> int:
    print(f"\n--- {label}: {' '.join(cmd)} ---")
    try:
        return subprocess.call(cmd, cwd=str(root), env=env)
    except FileNotFoundError:
        print(f"  tool not found for '{label}': {cmd[0]} (install it / skip with --only)", file=sys.stderr)
        return 2


def npm_script_exists(root: Path, script: str) -> bool:
    pkg = root / "package.json"
    if not pkg.exists():
        return False
    import json

    try:
        return script in (json.loads(pkg.read_text()).get("scripts") or {})
    except Exception:
        return False


def discover_cov_source(root: Path, explicit: list[str] | None) -> list[str]:
    """Coverage must be pointed at a real source package, or `pytest --cov` can
    measure nothing and 'pass' at a fake 100%. Resolve a target: explicit flag >
    boundaries.yaml python.root_package > src/ > cwd."""
    if explicit:
        return explicit
    by = root / "boundaries.yaml"
    if by.exists():
        try:
            import yaml  # optional; only if available

            m = yaml.safe_load(by.read_text()) or {}
            rp = (m.get("python") or {}).get("root_package")
            if rp:
                return [rp]
        except Exception:
            pass
    if (root / "src").exists():
        return ["src"]
    return ["."]


def build_plan(root: Path, args) -> list[tuple[str, list[str]]]:
    is_ts = has(root, "package.json")
    is_py = has(root, "pyproject.toml") or has(root, "setup.cfg")
    plan: list[tuple[str, list[str]]] = []

    want = set(STEPS_ORDER) if not args.only else {args.only}
    if args.no_boundaries:
        want.discard("boundaries")
    if getattr(args, "no_e2e", False):
        want.discard("e2e")

    if "typecheck" in want and is_ts and npm_script_exists(root, "typecheck"):
        plan.append(("typecheck", NPM + ["run", "typecheck"]))

    if "lint" in want:
        if is_ts and npm_script_exists(root, "lint"):
            plan.append(("lint", NPM + ["run", "lint"]))
        if is_py and shutil.which("ruff"):
            plan.append(("lint", ["ruff", "check", "."]))

    if "test" in want:
        if is_ts and npm_script_exists(root, "test"):
            plan.append(("test", NPM + ["run", "test"]))
        if is_py and shutil.which("pytest"):
            cmd = ["pytest", "-q"]
            if args.min_coverage is not None:
                # TDD proxy: new code must be covered; total may not drop below floor.
                # Point --cov at a real package so it can't pass vacuously.
                targets = discover_cov_source(root, args.cov_source)
                print(f"  (coverage measured against: {', '.join(targets)})")
                cmd = ["pytest", "-q", f"--cov-fail-under={args.min_coverage}", "--cov-report=term-missing"]
                for t in targets:
                    cmd += [f"--cov={t}"]
            plan.append(("test", cmd))

    if "e2e" in want:
        # Thin end-to-end layer: run Playwright if the project has a config.
        # No-op until you adopt e2e — so it never blocks a repo that hasn't yet.
        if any((root / f"playwright.config.{ext}").exists() for ext in ("ts", "js", "mjs", "cjs")):
            plan.append(("e2e", NPX + ["playwright", "test"]))

    if "boundaries" in want and (root / "boundaries.yaml").exists():
        guard = root / "bigbrainBoundaryGuard" / "check_boundaries.py"
        if guard.exists():
            plan.append(("boundaries", [sys.executable, str(guard), "--root", str(root), "check"]))

    return plan


def main() -> int:
    p = argparse.ArgumentParser(description="Run the bigbrain discipline cycle")
    p.add_argument("--root", default=".", type=Path)
    p.add_argument("--no-boundaries", action="store_true", help="skip boundaries (CI runs it separately)")
    p.add_argument("--no-e2e", action="store_true", help="skip e2e (CI runs it separately in qa.yml)")
    p.add_argument("--only", choices=STEPS_ORDER, help="run a single step")
    p.add_argument("--min-coverage", type=int, default=None, help="pytest coverage floor (TDD proxy)")
    p.add_argument("--cov-source", action="append", default=None,
                   help="package/dir to measure coverage on (repeatable); auto-discovered if omitted")
    args = p.parse_args()
    root = args.root.resolve()

    plan = build_plan(root, args)
    if not plan:
        print(
            "Nothing to run. Expected a package.json (TS) or pyproject.toml (Python) "
            "with the standard scripts, and/or a boundaries.yaml.",
            file=sys.stderr,
        )
        return 2

    print(f"bigbrain verify — {len(plan)} step(s) in {root}")
    worst = 0
    results = []
    for label, cmd in plan:
        rc = run(label, cmd, root)
        results.append((label, rc))
        worst = max(worst, rc)

    print("\n================ summary ================")
    for label, rc in results:
        print(f"  {'PASS' if rc == 0 else 'FAIL'}  {label}")
    print("=========================================")
    print("VERIFY OK" if worst == 0 else "VERIFY FAILED — fix the failing step(s), don't skip them")
    return worst


if __name__ == "__main__":
    raise SystemExit(main())
