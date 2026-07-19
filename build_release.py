#!/usr/bin/env python3
"""Build release artifacts: the full kit and a lean core.

    python build_release.py        # writes dist/bigbrain-agent-kit-{full,core}.zip

The only difference between them is the brains' `sources/` notes (the book-derived
principle summaries). Those are provenance/depth — the router goes to `rules/`,
never to `sources/`, so they are never loaded into the agent's context. The core
build is therefore behaviourally identical, just smaller to download.

To stay self-consistent, the core build also strips the `sources_*` keys from each
`manifest.json`, so the core still passes `bigbrainSkillCheck/skill_lint.py`
(which fails if a manifest names a source file that isn't present).

Pure stdlib + cross-platform (no `zip` binary needed). `dist/` is gitignored.
"""
from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
NAME = "bigbrain-agent-kit"

# never ship these
PRUNE = {
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".git", "node_modules", "dist", ".venv", "venv",
}
# manifest keys that point at sources/ — removed in the core build
SOURCE_KEYS = ("sources_found", "sources", "sources_note")


def _kept_files(base: Path):
    for p in base.rglob("*"):
        if p.is_file() and not any(part in PRUNE for part in p.relative_to(base).parts):
            yield p


def _stage_full(staging: Path) -> None:
    for p in _kept_files(ROOT):
        dest = staging / p.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)


def _strip_sources(staging: Path) -> int:
    removed = 0
    for d in list(staging.rglob("sources")):
        if d.is_dir():
            removed += sum(1 for _ in d.rglob("*") if _.is_file())
            shutil.rmtree(d)
    for man in staging.rglob("manifest.json"):
        m = json.loads(man.read_text(encoding="utf-8"))
        if any(k in m for k in SOURCE_KEYS):
            for k in SOURCE_KEYS:
                m.pop(k, None)
            man.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return removed


def _zip(folder: Path, out: Path) -> int:
    n = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(folder.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(folder.parent))
                n += 1
    return n


def main() -> None:
    DIST.mkdir(exist_ok=True)
    staging = DIST / "_staging" / NAME
    if (DIST / "_staging").exists():
        shutil.rmtree(DIST / "_staging")
    staging.mkdir(parents=True)

    _stage_full(staging)
    n_full = _zip(staging, DIST / f"{NAME}-full.zip")

    dropped = _strip_sources(staging)          # mutate staging in place -> core
    n_core = _zip(staging, DIST / f"{NAME}-core.zip")

    shutil.rmtree(DIST / "_staging")
    print(f"full : dist/{NAME}-full.zip   ({n_full} files)")
    print(f"core : dist/{NAME}-core.zip   ({n_core} files, {dropped} source notes stripped)")
    print("verify the core with: python bigbrainSkillCheck/skill_lint.py --root <unzipped-core>")


if __name__ == "__main__":
    main()
