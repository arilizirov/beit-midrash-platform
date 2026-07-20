#!/usr/bin/env python3
"""bigbrain bootstrap — one command per repo, not zero-touch.

Why not zero-touch: enforcement lives OUTSIDE the files (branch protection is a
git-host setting; boundaries.yaml domains differ per project; the agent's token
scope is a deliberate human decision). A zip can't configure a server it doesn't
control. So this script does everything a script CAN, and prints the small
residue that is genuinely yours to do.

WHAT IT DOES
  - checks/installs the Python dep (pyyaml) and tells you which validators to add
  - copies sample configs into place where missing (boundaries.yaml, etc.)
  - if `gh` is authenticated with admin on the repo, sets branch protection on
    main (requires the `boundaries` check, blocks direct pushes) via the API
  - prints the irreducible manual steps it could not do for you

USAGE
    python bootstrap.py                 # safe: never overwrites your files
    python bootstrap.py --branch main --protect    # also try to set protection
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def step(msg: str) -> None:
    print(f"\n>>> {msg}")


def copy_if_missing(src: Path, dst: Path) -> None:
    if dst.exists():
        print(f"  keep (exists): {dst.name}")
    elif src.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)
        print(f"  created: {dst.name}  (edit it for your project)")
    else:
        print(f"  MISSING sample: {src}")


CLAUDE_POINTER = (
    "# CLAUDE.md\n\n"
    "This repository's agent instructions live in **`AGENTS.md`** (single source "
    "of truth). Read `AGENTS.md` now and follow it. First time here? Read "
    "`START_HERE.md` first.\n"
)


def ensure_agent_instruction_files() -> None:
    """Different tools read different root filenames (Claude Code -> CLAUDE.md,
    Codex -> AGENTS.md). Make sure both exist so whichever agent you point at the
    repo finds one. AGENTS.md stays the single source of truth; CLAUDE.md points
    to it (a pointer, not a copy, so they can't drift)."""
    agents = ROOT / "AGENTS.md"
    claude = ROOT / "CLAUDE.md"
    if not agents.exists():
        print("  WARNING: AGENTS.md missing at repo root — did you unzip the kit here?")
    if claude.exists():
        print("  keep (exists): CLAUDE.md")
    else:
        claude.write_text(CLAUDE_POINTER)
        print("  created: CLAUDE.md  (pointer to AGENTS.md, for Claude Code)")


def ensure_debt_hawk() -> None:
    """Write the Claude Code debt-hawk subagent if missing, so the agent can
    self-install it. Loads on the NEXT Claude Code launch (a session can't
    reliably restart itself — that's the one non-automatable bit)."""
    dest = ROOT / ".claude" / "agents" / "debt-hawk.md"
    if dest.exists():
        print("  keep (exists): .claude/agents/debt-hawk.md")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        "---\n"
        "name: debt-hawk\n"
        "description: Independent read-only code reviewer for tech debt the gates can't see. Invoke explicitly to review a diff or named changes; never to write code.\n"
        "tools: Read, Grep, Glob\n"
        "---\n\n"
        "You are an INDEPENDENT reviewer in your own context window. You did NOT write this code.\n"
        "1. Read `bigbrainReviewer/REVIEWER.md` — that is your persona, rubric, and output format.\n"
        "2. Review only the changes given; assume every automated gate already passed. Find the debt they can't see.\n"
        "3. READ-ONLY by design: propose fixes as text, never edit/commit/build.\n"
        "4. Be specific (file:line); you are a fallible second opinion for a human, not the final word.\n"
    )
    print("  created: .claude/agents/debt-hawk.md  (loads on next Claude Code launch)")


def ensure_auditor() -> None:
    """Write the auditor subagent if missing. Loads on next Claude Code launch."""
    dest = ROOT / ".claude" / "agents" / "auditor.md"
    if dest.exists():
        print("  keep (exists): .claude/agents/auditor.md")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        "---\n"
        "name: auditor\n"
        "description: Independent read-only technical auditor and teacher. Use to review a diff (review mode) or audit an existing area for fixes (retro-audit mode), and to explain in plain language what's built and why. Never writes code. Invoke explicitly.\n"
        "tools: Read, Grep, Glob\n"
        "---\n\n"
        "You are an INDEPENDENT auditor in your own context window. You did NOT write this code.\n"
        "1. Read `bigbrainReviewer/AUDITOR.md` — that is your full persona, rubric, modes, and output format. Follow it exactly.\n"
        "2. Work TOP-DOWN: read the map (`docs/ARCHITECTURE.md`, `boundaries.yaml`, dependency graph) first; judge fit and wiring; open specific files only when something looks wrong.\n"
        "3. READ-ONLY: propose and teach as text; never edit, commit, build, or gate.\n"
        "4. Teach in plain language for a non-developer, and state your confidence + what you couldn't verify. You are 'fresh eyes, same brain' — a fallible advisor, not a backstop; a human decides.\n"
    )
    print("  created: .claude/agents/auditor.md  (loads on next Claude Code launch)")


def ensure_pyyaml() -> None:
    try:
        import yaml  # noqa: F401

        print("  pyyaml: present")
    except ImportError:
        print("  installing pyyaml ...")
        subprocess.call([sys.executable, "-m", "pip", "install", "pyyaml"])


def try_branch_protection(branch: str) -> bool:
    if not shutil.which("gh"):
        return False
    # Confirm gh is authenticated and we can see the repo.
    who = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    if who.returncode != 0:
        print("  gh present but not authenticated (`gh auth login`) — skipping protection")
        return False
    print(f"  attempting branch protection on '{branch}' via gh api ...")
    payload = {
        "required_status_checks": {"strict": True, "contexts": ["boundaries", "verify", "pr-size"]},
        "enforce_admins": True,
        # 0, not 1: a solo owner cannot approve their own PR — a count of 1
        # deadlocks merging forever. Raise it once a second human reviewer exists.
        "required_pull_request_reviews": {"required_approving_review_count": 0},
        "restrictions": None,
        "allow_force_pushes": False,
        "allow_deletions": False,
    }
    proc = subprocess.run(
        ["gh", "api", "-X", "PUT", f"repos/{{owner}}/{{repo}}/branches/{branch}/protection",
         "--input", "-"],
        input=json.dumps(payload), capture_output=True, text=True,
    )
    if proc.returncode == 0:
        print("  branch protection set: `boundaries` is now a required check; direct pushes blocked.")
        return True
    print("  could not set protection automatically (need admin + a non-empty repo):")
    print("   ", proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else "(no detail)")
    return False


def main() -> int:
    p = argparse.ArgumentParser(description="Bootstrap the bigbrain kit in this repo")
    p.add_argument("--branch", default="main")
    p.add_argument("--protect", action="store_true", help="also try to set branch protection via gh")
    args = p.parse_args()

    print("bigbrain bootstrap — setting up what a script can, safely (no overwrites).")

    step("1. Python dependency")
    ensure_pyyaml()

    step("2. config files (copied only if missing)")
    copy_if_missing(ROOT / "bigbrainBoundaryGuard" / "boundaries.sample.yaml", ROOT / "boundaries.yaml")
    copy_if_missing(ROOT / "docs" / "STACK.template.md", ROOT / "docs" / "STACK.md")
    copy_if_missing(ROOT / "docs" / "ARCHITECTURE.template.md", ROOT / "docs" / "ARCHITECTURE.md")
    ensure_agent_instruction_files()
    ensure_debt_hawk()
    ensure_auditor()

    step("3. validators to install (pick your stack)")
    print("  TS/JS  : npm i -D dependency-cruiser   (and ensure typecheck/lint/test npm scripts exist)")
    print("  Python : pip install import-linter      (or: pip install tach, if you set adapter: tach)")
    print("  set python.root_package in boundaries.yaml for the import-linter adapter")

    protected = False
    if args.protect:
        step("4. branch protection (the wall — needs gh + repo admin)")
        protected = try_branch_protection(args.branch)

    step("IRREDUCIBLE RESIDUE — what a script cannot do for you")
    print("  These live outside the files, on purpose (that's why enforcement works):")
    print("  [ ] edit boundaries.yaml so the domains match YOUR app")
    if not protected:
        print(f"  [ ] make `boundaries` a REQUIRED status check on '{args.branch}' and block direct pushes")
        print("      (re-run with --protect once gh has admin, or set it in repo settings)")
    print("  [ ] scope the AGENT's token: Contents+PR write only, NO Administration")
    print("      so the agent (an untrusted committer) cannot disable the rule")
    print("  [ ] (optional) add ANTHROPIC_API_KEY secret to enable the LLM reviewer")
    print("  full details: BRANCH_PROTECTION.md")
    print("\nbootstrap done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
