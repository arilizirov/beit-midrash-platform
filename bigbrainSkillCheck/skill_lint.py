#!/usr/bin/env python3
"""bigbrain skill-lint — checks the skills are well-formed and self-consistent.

This is the HARD, mechanical half of "do the skills do what they say": it can't
tell you the agent followed a skill (that's the eval harness, which is soft), but
it CAN guarantee the skill is internally consistent — no dangling references, no
stale manifest, no copyrighted text creeping back in. Several of this kit's own
audit findings were exactly this class and were caught only by a human reading
files; this makes them a CI gate.

Checks, per brain (any dir with a manifest.json) and globally:
  - manifest `rules` array matches the files in rules/
  - manifest `sources_found` / `sources` files all exist
  - the router and entrypoint (SKILL.md) referenced exist
  - every `rules/NN-*.md` referenced in the router actually exists
  - GLOBAL: no "Full Extraction" copyrighted text anywhere (regression guard)
  - GLOBAL: root instruction files present; boundaries sample parses

USAGE
    python bigbrainSkillCheck/skill_lint.py            # lint the whole kit
    python bigbrainSkillCheck/skill_lint.py --root .

Exit 0 = consistent; non-zero = problems (printed). Wire into CI.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PROBLEMS: list[str] = []


def fail(msg: str) -> None:
    PROBLEMS.append(msg)


def lint_brain(brain: Path) -> None:
    name = brain.name
    mf = brain / "manifest.json"
    try:
        m = json.loads(mf.read_text())
    except Exception as e:
        fail(f"{name}: manifest.json invalid JSON ({e})")
        return

    # rules array vs actual files
    rules_dir = brain / "rules"
    actual = sorted(p.name for p in rules_dir.glob("*.md")) if rules_dir.exists() else []
    declared = sorted(m.get("rules", []))
    if declared != actual:
        missing = set(declared) - set(actual)
        extra = set(actual) - set(declared)
        if missing:
            fail(f"{name}: manifest lists rules that don't exist: {sorted(missing)}")
        if extra:
            fail(f"{name}: rules/ has files not in manifest: {sorted(extra)}")

    # sources_found files exist
    for title, rel in (m.get("sources_found") or {}).items():
        if not (brain / rel).exists():
            fail(f"{name}: sources_found['{title}'] -> missing file {rel}")
    # sources array (if present) exist
    for rel in m.get("sources", []):
        # entries may be bare filenames or paths under sources/
        cand = brain / rel if "/" in rel else brain / "sources" / rel
        if not cand.exists():
            fail(f"{name}: sources[] -> missing file {rel}")

    # router + entrypoint exist
    router_rel = m.get("router", "router/00-judgment-router.md")
    router = brain / router_rel
    if not router.exists():
        fail(f"{name}: router not found: {router_rel}")
    entry_rel = m.get("entrypoint", "SKILL.md")
    if not (brain / entry_rel).exists():
        fail(f"{name}: entrypoint not found: {entry_rel}")

    # every rules/NN-*.md referenced in the router must exist
    if router.exists():
        for ref in re.findall(r"rules/[\w.\-]+\.md", router.read_text()):
            if not (brain / ref).exists():
                fail(f"{name}: router references missing {ref}")


def lint_global(root: Path) -> None:
    # Copyright regression guard. Scope it precisely so docs that *mention* the
    # phrase (this guard's own README, BACKLOG) aren't flagged: catch any file
    # NAMED like an extraction anywhere, and any CONTENT match only inside a
    # sources/ directory (where book text would actually live).
    hits = set()
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if "Full Extraction" in p.name:
            hits.add(str(p.relative_to(root)))
        elif p.parent.name == "sources" and p.suffix in {".md", ".txt"}:
            if "Full Extraction" in p.read_text(errors="ignore"):
                hits.add(str(p.relative_to(root)))
    for h in sorted(hits):
        fail(f"copyright guard: extraction-like file {h} (ship original notes, not book text)")

    # root instruction files
    for f in ("AGENTS.md", "CLAUDE.md", "START_HERE.md", "README.md"):
        if not (root / f).exists():
            fail(f"missing root file: {f}")

    # boundaries sample parses
    sample = root / "bigbrainBoundaryGuard" / "boundaries.sample.yaml"
    if sample.exists():
        try:
            import yaml

            yaml.safe_load(sample.read_text())
        except Exception as e:
            fail(f"boundaries.sample.yaml does not parse: {e}")

    # STACK.md must not OVERRIDE a principle that AGENTS.md mandates.
    # (Parameters belong in STACK.md; principles belong in AGENTS.md/brains.)
    stack = root / "docs" / "STACK.md"
    agents = root / "AGENTS.md"
    if stack.exists() and agents.exists():
        st = stack.read_text().lower()
        ag = agents.read_text().lower()
        mandates_generator = "generator" in ag and (
            "never by hand" in ag or "never hand" in ag or "scaffold structure with the generator" in ag
        )
        anti_generator = re.search(
            # "hand-roll" alone false-positives on unrelated prose (e.g. "a
            # hand-rolled switch statement") — require folder/scaffold context.
            r"hand-?roll(?:ed|ing|s)?\s+(?:the\s+)?(?:folders?|domains?|modules?|structure|scaffold\w*|skeletons?)|"
            r"don't use the generator|do not use the generator|"
            r"instead of the generator|bypass(?:ing)? the generator|without the generator",
            st,
        )
        if mandates_generator and anti_generator:
            fail(
                "docs/STACK.md contradicts AGENTS.md: it tells the agent to "
                "hand-roll/bypass the generator, but AGENTS.md mandates it. STACK.md "
                "holds parameters (e.g. set `layout` in boundaries.yaml), not principle overrides."
            )

    # Subagents must exist, point at their persona, and not drift from the copy
    # bootstrap.py writes (kept byte-consistent on purpose).
    boot = root / "bootstrap.py"
    bt = boot.read_text() if boot.exists() else ""
    for sub, persona in (("debt-hawk.md", "REVIEWER.md"), ("auditor.md", "AUDITOR.md")):
        f = root / ".claude" / "agents" / sub
        if not f.exists():
            continue
        body = f.read_text()
        if persona not in body:
            fail(f".claude/agents/{sub} no longer references bigbrainReviewer/{persona}")
        if bt:
            for line in body.splitlines():
                s = line.strip()
                if len(s) > 25 and s not in bt:
                    fail(f"{sub} drifted from bootstrap.py's embedded copy (keep them identical).")
                    break


def main() -> int:
    ap = argparse.ArgumentParser(description="Lint the bigbrain skills for consistency")
    ap.add_argument("--root", default=None, type=Path, help="kit root (default: parent of this script)")
    args = ap.parse_args()
    root = (args.root or Path(__file__).resolve().parent.parent).resolve()

    brains = sorted(p.parent for p in root.glob("*/manifest.json"))
    if not brains:
        fail("no brains found (no */manifest.json under root)")
    for b in brains:
        lint_brain(b)
    lint_global(root)

    print(f"skill-lint: {len(brains)} brain(s) checked in {root}")
    if PROBLEMS:
        print(f"\nSKILL-LINT FAILED — {len(PROBLEMS)} problem(s):")
        for p in PROBLEMS:
            print("  - " + p)
        return 1
    print("SKILL-LINT OK — skills are well-formed and self-consistent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
