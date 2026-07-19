"""Load the kit's scripts (which are CLIs, not packages) as importable modules
for testing. Their `if __name__ == '__main__'` guards mean importing is safe."""
import importlib.util
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent


def _load(rel: str, name: str):
    spec = importlib.util.spec_from_file_location(name, KIT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def boundary_guard():
    return _load("bigbrainBoundaryGuard/check_boundaries.py", "bg_check")


def generator():
    return _load("bigbrainGenerator/new_domain.py", "bg_gen")


def verify():
    return _load("bigbrain_verify.py", "bg_verify")
