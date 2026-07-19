#!/usr/bin/env python3
"""bigbrain reviewer — an LLM critic that pushes back on a PR.

ADVISORY, NOT A GATE. This is a second intelligence to strengthen the human
reviewer (see the surfaced-vs-enforced split in the kit README). It is another
model: it can be wrong or gamed, so it FLAGS and COMMENTS — it does not block
merges. Making an LLM a required blocking check is unsafe (false negatives block
good work; false positives wave bad work through).

It reads REVIEWER.md as the critic persona and sends it the PR diff. In CI the
GitHub Action posts the output as a PR comment.

ENV
    ANTHROPIC_API_KEY   required (add as a repo secret)
    REVIEW_MODEL        optional model id (default below)

USAGE (local)
    git diff origin/main...HEAD | python bigbrainReviewer/review.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

MODEL = os.environ.get("REVIEW_MODEL", "claude-sonnet-4-6")
HERE = Path(__file__).resolve().parent
MAX_DIFF_CHARS = 60_000  # keep the request bounded; huge PRs should be split anyway


def read_persona() -> str:
    f = HERE / "REVIEWER.md"
    return f.read_text() if f.exists() else "You are a senior code reviewer. Push back on overengineering, boundary and test gaps."


def call_claude(system: str, user: str) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("ANTHROPIC_API_KEY not set (add it as a repo secret).")
    body = json.dumps(
        {
            "model": MODEL,
            "max_tokens": 1500,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def main() -> int:
    diff = sys.stdin.read()
    if not diff.strip():
        print("no diff on stdin; nothing to review")
        return 0
    if len(diff) > MAX_DIFF_CHARS:
        diff = diff[:MAX_DIFF_CHARS] + "\n\n[diff truncated — this PR is large; consider stacked PRs]"

    persona = read_persona()
    user = (
        "Review this pull request diff. Apply the principles in your instructions. "
        "Be specific and fair; if it's clean, say so briefly.\n\n"
        "```diff\n" + diff + "\n```"
    )
    review = call_claude(persona, user)
    print(review)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
