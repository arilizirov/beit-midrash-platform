#!/usr/bin/env python3
"""bigbrain debt report — make tech debt VISIBLE so a human can triage it.

Tech debt has no checkable definition, so this NEVER gates (always exits 0). It
surfaces *proxies* and *trends* — never thresholds to pass. Gating on these would
just teach the agent to game them (Goodhart). The output is a map of where to
LOOK; a human (or the debt-hawk critic) does the judging.

Signals (zero-dependency core):
  - churn      : files changed most often recently (debt magnets) — a real trend
  - big files  : largest files (where design tends to rot)
  - hot AND big: the intersection — prime suspects
  - markers    : TODO / FIXME / HACK / XXX / YAGNI counts and locations
Optional (if installed): radon for Python cyclomatic complexity.

Trend mode: pass --json to write a snapshot, and --baseline <old.json> to print
deltas vs a previous run (rising numbers = where to look).

USAGE
    python bigbrainQA/debt_report.py
    python bigbrainQA/debt_report.py --since 300 --top 15
    python bigbrainQA/debt_report.py --json .debt.json --baseline .debt-prev.json

Always exits 0. This is the soft/visibility tier — not a guarantee, not a gate.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

SRC_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rb", ".java", ".rs"}
SKIP = re.compile(r"(^|/)(node_modules|dist|build|\.next|coverage|vendor|\.git|__pycache__|bigbrain[A-Za-z0-9_]*|\.github)(/|$)")
MARKERS = re.compile(r"\b(TODO|FIXME|HACK|XXX|YAGNI)\b")  # YAGNI = a deliberate KISS simplification flagged to revisit (see AGENTS.md)
BIG_LINES = 400  # "large" hint only — NOT a limit


def source_files(root: Path) -> list[Path]:
    out = []
    for p in root.rglob("*"):
        rel = str(p.relative_to(root)).replace("\\", "/")
        if p.is_file() and p.suffix in SRC_EXT and not SKIP.search(rel):
            out.append(p)
    return out


def churn(root: Path, n: int) -> Counter:
    try:
        res = subprocess.run(
            ["git", "log", "-n", str(n), "--pretty=format:", "--name-only"],
            cwd=str(root), capture_output=True, text=True, timeout=30,
        )
        if res.returncode != 0:
            return Counter()
    except Exception:
        return Counter()
    c = Counter()
    for line in res.stdout.splitlines():
        line = line.strip()
        if line and not SKIP.search(line) and Path(line).suffix in SRC_EXT:
            c[line] += 1
    return c


def lines_of(p: Path) -> int:
    try:
        return sum(1 for _ in p.open("r", errors="ignore"))
    except Exception:
        return 0


def collect(root: Path, since: int) -> dict:
    files = source_files(root)
    sizes = {str(p.relative_to(root)): lines_of(p) for p in files}
    ch = churn(root, since)
    marker_hits = {}
    total_markers = 0
    for p in files:
        try:
            n = len(MARKERS.findall(p.read_text(errors="ignore")))
        except Exception:
            n = 0
        if n:
            marker_hits[str(p.relative_to(root))] = n
            total_markers += n
    return {
        "files": len(files),
        "total_lines": sum(sizes.values()),
        "sizes": sizes,
        "churn": dict(ch),
        "markers": marker_hits,
        "total_markers": total_markers,
        "large_files": sum(1 for v in sizes.values() if v > BIG_LINES),
    }


def section(title: str) -> None:
    print(f"\n## {title}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Surface tech-debt proxies (never gates)")
    ap.add_argument("--root", default=".", type=Path)
    ap.add_argument("--since", type=int, default=200, help="commits of history for churn")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--json", default=None, help="write a snapshot here")
    ap.add_argument("--baseline", default=None, help="prior snapshot to diff against")
    args = ap.parse_args()
    root = args.root.resolve()

    d = collect(root, args.since)
    print(f"# Tech-debt report — {root.name}")
    print(f"{d['files']} source files, {d['total_lines']} lines, "
          f"{d['large_files']} files > {BIG_LINES} lines, {d['total_markers']} debt markers.")
    print("(Proxies for where to LOOK — not pass/fail. A human judges.)")

    top = args.top
    section(f"Churn hot-spots (most-changed in last {args.since} commits) — debt magnets")
    hot = sorted(d["churn"].items(), key=lambda x: -x[1])[:top]
    for f, n in hot:
        print(f"  {n:>4}×  {f}")
    if not hot:
        print("  (no git history available)")

    section(f"Largest files (design tends to rot in big files)")
    big = sorted(d["sizes"].items(), key=lambda x: -x[1])[:top]
    for f, n in big:
        flag = "  <-- big" if n > BIG_LINES else ""
        print(f"  {n:>5} ln  {f}{flag}")

    section("Hot AND big (prime suspects — change often, hard to reason about)")
    hot_set = {f for f, _ in hot}
    suspects = [(f, d["sizes"].get(f, 0), d["churn"][f]) for f in hot_set if d["sizes"].get(f, 0) > BIG_LINES]
    suspects.sort(key=lambda x: -(x[1] + x[2] * 50))
    for f, ln, c in suspects[:top]:
        print(f"  {ln:>5} ln, {c}× changed   {f}")
    if not suspects:
        print("  (none — nothing both large and frequently changed)")

    section("Debt markers (TODO / FIXME / HACK / XXX / YAGNI)")
    for f, n in sorted(d["markers"].items(), key=lambda x: -x[1])[:top]:
        print(f"  {n:>3}  {f}")
    if not d["markers"]:
        print("  (none)")

    if shutil.which("radon"):
        section("Python complexity (radon) — worst offenders")
        try:
            r = subprocess.run(["radon", "cc", "-s", "-n", "C", str(root)],
                               capture_output=True, text=True, timeout=60)
            out = r.stdout.strip()
            print("  " + "\n  ".join(out.splitlines()[:30]) if out else "  (nothing above moderate complexity)")
        except Exception:
            print("  (radon failed)")
    else:
        print("\n(install `radon` for Python complexity; `jscpd` for JS/TS duplication — both optional)")

    # trend
    if args.baseline:
        try:
            prev = json.loads(Path(args.baseline).read_text())
            section("Trend vs baseline (rising = look here)")
            for k in ("files", "total_lines", "large_files", "total_markers"):
                delta = d[k] - prev.get(k, 0)
                arrow = "↑" if delta > 0 else ("↓" if delta < 0 else "=")
                print(f"  {k:<14} {prev.get(k,0)} -> {d[k]}  ({arrow}{abs(delta)})")
        except Exception as e:
            print(f"\n(could not read baseline: {e})")

    if args.json:
        snap = {k: d[k] for k in ("files", "total_lines", "large_files", "total_markers")}
        Path(args.json).write_text(json.dumps(snap, indent=2))
        print(f"\nsnapshot written to {args.json}")

    print("\nThis report never fails the build. Use it to aim review, not to gate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
