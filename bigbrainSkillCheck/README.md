# bigbrain skill-lint

The **hard** half of "do the skills do what they say." It can't tell you the
agent *followed* a skill (that's `bigbrainEval/`, which is soft) — but it
guarantees each skill is **well-formed and self-consistent**, mechanically, in CI.

```bash
python bigbrainSkillCheck/skill_lint.py
```

Checks, per brain and globally:
- the manifest's `rules` list matches the files in `rules/` (no stale, no missing)
- every `sources_found` / `sources` file referenced exists
- the router and `SKILL.md` entrypoint exist
- every `rules/NN-*.md` the router references actually exists
- **copyright guard:** no book text in `sources/` and no extraction-named files (regression guard)
- root instruction files present; `boundaries.sample.yaml` parses

Why it exists: several of this kit's own audit findings — a stale manifest, a
dangling sources array, the risk of copyrighted text creeping back — are exactly
this class of problem, and were caught only by a human reading files. skill-lint
makes them a red build. It runs in `gates.yml` (the `verify` job).

Exit 0 = consistent; non-zero = problems printed.
