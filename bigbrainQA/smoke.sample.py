#!/usr/bin/env python3
"""bigbrain smoke test — tiny post-deploy check against the REAL environment.

Catches "built fine, came up broken." Run it AFTER deploy, against the deployed
URL — not as a unit test. Keep it tiny: health + one or two critical signals.
Zero dependencies (stdlib urllib), so it runs anywhere in a deploy pipeline.

USAGE
    python bigbrainQA/smoke.sample.py https://staging.example.com
    BASE_URL=https://staging.example.com python bigbrainQA/smoke.sample.py

Exit 0 = all checks passed; non-zero = deployment is not healthy (fail the deploy).
Edit CHECKS for your app. Each check is (path, expected_status, must_contain|None).
"""
import os
import sys
import urllib.request

# (path, expected HTTP status, substring that must appear in body or None)
CHECKS = [
    ("/health", 200, None),
    ("/", 200, None),
    # ("/login", 200, "Sign in"),   # add one real critical signal per app
]

TIMEOUT = 15


def check(base: str, path: str, expect: int, contains: str | None) -> str | None:
    url = base.rstrip("/") + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bigbrain-smoke"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            status = r.status
            body = r.read(50000).decode("utf-8", "replace") if contains else ""
    except Exception as e:
        return f"{path}: request failed ({e})"
    if status != expect:
        return f"{path}: status {status}, expected {expect}"
    if contains and contains not in body:
        return f"{path}: body missing expected text {contains!r}"
    return None


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BASE_URL", "")
    if not base:
        sys.exit("usage: smoke.sample.py <BASE_URL>  (or set BASE_URL)")
    print(f"smoke test against {base}")
    failures = [msg for (p, s, c) in CHECKS if (msg := check(base, p, s, c))]
    for f in failures:
        print(f"  FAIL {f}")
    if failures:
        print(f"\nSMOKE FAILED ({len(failures)} check(s)) — deployment is not healthy")
        return 1
    print(f"SMOKE OK ({len(CHECKS)} checks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
