#!/usr/bin/env python3
"""bigbrain eval — does the skill actually change the agent's behavior?

SOFT AND STATISTICAL, by nature. For each probe it runs the model WITHOUT the
skill and WITH the skill loaded, then an LLM judge scores which answer better
matches the probe's expected disposition. This MEASURES whether the skill shifts
behavior on average across your probes. It does NOT prove the skill is followed
on any given real task — that's impossible, and the judge is itself fallible.
Run it periodically; it is not a per-commit gate.

ENV
    ANTHROPIC_API_KEY   required (add a repo secret if you run it in CI)
    EVAL_MODEL          model under test (default below)
    JUDGE_MODEL         judge model (default below)

USAGE
    python bigbrainEval/run_eval.py
    python bigbrainEval/run_eval.py --skill ../AGENTS.md ../bigbrainSoftwareArchitectureJudgmentRouter/router/00-judgment-router.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("eval needs PyYAML: pip install pyyaml")

HERE = Path(__file__).resolve().parent
KIT = HERE.parent
EVAL_MODEL = os.environ.get("EVAL_MODEL", "claude-sonnet-4-6")
JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "claude-sonnet-4-6")
BASE_SYSTEM = "You are a helpful, experienced senior software engineer. Answer concisely and concretely."

DEFAULT_SKILL_FILES = [
    KIT / "AGENTS.md",
    KIT / "bigbrainSoftwareArchitectureJudgmentRouter" / "router" / "00-judgment-router.md",
    KIT / "bigbrainDataArchitectureJudgmentRouter" / "router" / "00-judgment-router.md",
]


def call(model: str, system: str, user: str, max_tokens: int = 900) -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("ANTHROPIC_API_KEY not set.")
    body = json.dumps(
        {"model": model, "max_tokens": max_tokens, "system": system,
         "messages": [{"role": "user", "content": user}]}
    ).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"content-type": "application/json", "x-api-key": key,
                 "anthropic-version": "2023-06-01"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def judge(expect: str, without: str, with_: str) -> dict:
    sys_prompt = (
        "You are a strict evaluator. Given an EXPECTED disposition and two answers, "
        "score how well each matches the expected disposition from 0-5 (5 = fully matches). "
        "Reply ONLY with JSON: {\"without\": <int>, \"with\": <int>, \"reason\": \"<one line>\"}."
    )
    user = f"EXPECTED:\n{expect}\n\nANSWER_A (without skill):\n{without}\n\nANSWER_B (with skill):\n{with_}"
    raw = call(JUDGE_MODEL, sys_prompt, user, max_tokens=300).strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except Exception:
        return {"without": -1, "with": -1, "reason": f"unparseable judge output: {raw[:120]}"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Eval whether the skill changes behavior")
    ap.add_argument("--probes", default=str(HERE / "probes.yaml"))
    ap.add_argument("--skill", nargs="*", default=None, help="files to load as the skill context")
    args = ap.parse_args()

    probes = yaml.safe_load(Path(args.probes).read_text()) or []
    skill_files = [Path(p) for p in args.skill] if args.skill else DEFAULT_SKILL_FILES
    skill_text = "\n\n".join(p.read_text() for p in skill_files if p.exists())
    skill_system = BASE_SYSTEM + "\n\nApply these engineering principles and routing:\n\n" + skill_text

    print(f"eval: {len(probes)} probe(s) | model={EVAL_MODEL} | judge={JUDGE_MODEL}")
    print("SOFT measurement — shows whether the skill helps on average, not that it's always followed.\n")
    helped = total = 0
    for p in probes:
        pid, prompt, expect = p["id"], p["prompt"], p["expect"]
        without = call(EVAL_MODEL, BASE_SYSTEM, prompt)
        with_ = call(EVAL_MODEL, skill_system, prompt)
        s = judge(expect, without, with_)
        total += 1
        better = isinstance(s.get("with"), int) and isinstance(s.get("without"), int) and s["with"] > s["without"]
        helped += 1 if better else 0
        flag = "↑ helped" if better else ("= same" if s.get("with") == s.get("without") else "↓ worse")
        print(f"  [{pid}] without={s.get('without')} with={s.get('with')}  {flag}")
        print(f"        {s.get('reason','')}")
    print(f"\nskill improved {helped}/{total} probes (soft signal; small N — interpret with care).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
