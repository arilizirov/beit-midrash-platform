# bigbrain Generator

Enforcement by construction. A new domain is *born* in the shape the brains and
BoundaryGuard expect, and is registered in `boundaries.yaml` automatically — so
the agent never hand-rolls a structure that drifts.

```bash
python bigbrainGenerator/new_domain.py billing
python bigbrainGenerator/new_domain.py billing --lang py --allow platform users
```

It creates `src/domains/<name>/{contracts,model,service,repo}`, a public
`index` (the only surface other domains may import), and a **failing stub test**
(red first — the TDD loop, pre-seeded). It then inserts the domain under
`modules:` and `allow:` in `boundaries.yaml`, preserving your comments.

It stamps the **skeleton**; you write the **logic**. It templates the
predictable *shape*, never the divergent *logic* — so it gives you discipline
without manufacturing coupling. (Rigidly chaining files into a fixed pipeline
would do the opposite: it makes boundaries expensive to move, which is exactly
what the kit fights.)

Flags: `--root` (repo root), `--source-root` (default `src`), `--layout`
(`domains` or `features`; default comes from `boundaries.yaml`'s `layout:` key,
else `domains`), `--lang` (auto-detected from package.json / pyproject.toml),
`--allow` (modules the new domain may import; defaults to `platform`).

The folder convention is driven by `boundaries.yaml` (`layout:`) so it stays the
single source of truth — `docs/STACK.md` must not override it (skill-lint flags
contradictions).
