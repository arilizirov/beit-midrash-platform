#!/usr/bin/env python3
"""Run the kit's own tool tests without requiring pytest.

    python tests/run_tests.py

(If you have pytest, `pytest tests/` works too — same test files.)
Provides a `tmp_path` argument to any test that asks for one, mirroring pytest.
"""
import importlib.util
import inspect
import sys
import tempfile
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def load(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    passed = failed = 0
    failures = []
    for f in sorted(HERE.glob("test_*.py")):
        mod = load(f)
        for name, fn in sorted(vars(mod).items()):
            if not (name.startswith("test_") and callable(fn)):
                continue
            kwargs = {}
            if "tmp_path" in inspect.signature(fn).parameters:
                kwargs["tmp_path"] = Path(tempfile.mkdtemp())
            try:
                fn(**kwargs)
                passed += 1
                print(f"  PASS  {f.name}::{name}")
            except Exception as e:
                failed += 1
                failures.append((f.name, name, traceback.format_exc()))
                print(f"  FAIL  {f.name}::{name}: {e}")
    print(f"\n{passed} passed, {failed} failed")
    for fn, n, tb in failures:
        print(f"\n--- {fn}::{n} ---\n{tb}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
