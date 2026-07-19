#!/usr/bin/env python3
"""Build release artifacts: a full edition and a lean core edition.

    python package.py        # writes dist/<name>-full.zip and dist/<name>-core.zip

full  = the whole kit.
core  = the same kit, but each per-book source *note* is replaced with a one-line
        placeholder (the source index stays). Those notes are reference-only depth
        that is NEVER loaded into the agent's context at task time, so the core
        runs identically — it is just a smaller download. skill-lint stays green
        because every source file declared in a manifest still exists (as a stub).

Both editions exclude build junk (__pycache__, caches, dist/, .git).
"""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NAME = ROOT.name          # zip basename, e.g. "bigbrain-agent-kit"
DIST = ROOT / "dist"


def is_excluded(rel: str) -> bool:
    """Build junk that never belongs in any edition."""
    parts = rel.replace("\\", "/").split("/")
    return (
        "__pycache__" in parts
        or ".pytest_cache" in parts
        or ".git" in parts
        or parts[0] == "dist"
        or rel.endswith(".pyc")
    )


def is_stubbable_source(rel: str) -> bool:
    """A per-book source NOTE — stubbed in the core edition.

    Only the book notes are stubbed; the source index (00-source-index.md) and
    everything outside a sources/ dir are shipped as-is.
    """
    r = rel.replace("\\", "/")
    return (
        "sources" in r.split("/")
        and r.endswith(".md")
        and not r.endswith("00-source-index.md")
    )


def stub_text(rel: str) -> str:
    title = rel.replace("\\", "/").rsplit("/", 1)[-1].replace(" - notes.md", "").replace(".md", "")
    return (
        f"# {title} — notes (lean core edition)\n\n"
        "The book-derived principle notes ship in the **full edition** of this "
        "kit. This lean core build keeps the operating kit (router, rules, gates, "
        "tools) and stubs the reference notes to stay small. The notes are never "
        "read at task time, so behavior is identical — get the full edition for "
        "the source notes.\n"
    )


def build(kind: str) -> Path:
    assert kind in {"full", "core"}, kind
    DIST.mkdir(exist_ok=True)
    out = DIST / f"{NAME}-{kind}.zip"
    out.unlink(missing_ok=True)
    n_files = n_stubbed = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(ROOT.rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(ROOT))
            if is_excluded(rel):
                continue
            arc = f"{NAME}/{rel}"
            if kind == "core" and is_stubbable_source(rel):
                z.writestr(arc, stub_text(rel))
                n_stubbed += 1
            else:
                z.write(p, arc)
            n_files += 1
    extra = f", {n_stubbed} source notes stubbed" if n_stubbed else ""
    print(f"  {out.name}: {n_files} files{extra}  ({out.stat().st_size // 1024} KB)")
    return out


def main() -> int:
    print(f"Packaging {NAME} -> {DIST}/")
    build("full")
    build("core")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
