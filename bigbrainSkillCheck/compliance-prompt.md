# Claude Code compliance prompt

Paste the block below to Claude Code (or any agent) working in a repo that uses
this kit, to make it verify it's actually doing what the kit requires — and that
the kit's guarantees are really in place, not just present as files.

---

You are working in a repository that uses the **bigbrain-agent-kit**. Audit whether
**you** are operating the way the kit requires, and whether the kit's hard
guarantees are actually in force. Be honest and specific. **Do not mark anything
PASS without showing the evidence.** If a tool is missing, say so and what to
install — never skip silently.

**1. Read what you're supposed to follow.**
Read `AGENTS.md` (the cycle), `START_HERE.md`, and `docs/STACK.md`. In two or
three sentences, restate the cycle you must follow and the surfaced-vs-hard
distinction in your own words.

**2. Run the mechanical checks and paste the REAL output of each:**
```
python bigbrainSkillCheck/skill_lint.py                     # skills well-formed & consistent?
python bigbrainBoundaryGuard/check_boundaries.py doctor     # manifest matches real code?
python bigbrainBoundaryGuard/check_boundaries.py check      # do boundaries hold?
python bigbrain_verify.py                                   # full cycle: types/lint/test/e2e/boundaries
python tests/run_tests.py                                   # do the kit's own tools pass?
```

**3. Confirm the hard tier actually EXISTS (not just the files).** Report honestly:
- Are `boundaries.yaml` domains real (does `doctor` pass), or is it still the sample?
- Is there a PR-based workflow, and are `boundaries`, `verify`, `pr-size` **required** checks on `main`?
- Is your own token scoped **without** admin? You cannot verify this yourself — flag it for the human.
- If any of these are missing, state plainly: **"the hard tier is NOT standing — my discipline is currently only surfaced."**

**4. Self-audit your recent work against the cycle, with evidence:**
- New feature? Did you build one **vertical slice** end-to-end first, or scaffold breadth?
- Did you write a **failing test before** the code (show the red→green)?
- Did you run `bigbrain_verify.py` before claiming done?
- Did you cross any module boundary? Did the import hit a **public surface**, and does it appear in `boundaries.yaml`'s allow list?
- Is the change small enough to be **one PR** (one stage)?
- Did you add any abstraction/layer/dependency **without a present-day force**? Justify it or flag it.

**5. Report** a short table: each cycle step and each hard check → `PASS` / `FAIL`
/ `NOT-ENFORCED`, one line of evidence each. End with the single most important
thing the human must fix for enforcement to be real.
