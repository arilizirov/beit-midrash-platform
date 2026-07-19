# bigbrain BoundaryGuard

Mechanical enforcement of module boundaries — the missing half of the kit.

The two judgment **brains** teach an agent how to *reason* about a boundary.
Nothing written in prose can *enforce* one. An LLM coding agent is just another
untrusted committer, and its self-attestation ("I respected the boundary") is
**not** a gate. BoundaryGuard turns the boundary into a real check that fails a
real build, so the agent — like any developer — is free to write a violation
but unable to merge one.

## The one idea

> Don't build a dependency-graph analyzer. Standardize over the proven ones.

Re-implementing module resolution, re-exports, path aliases, and per-language
import semantics is a trap. The mature tools already did it:

| Language      | Validator              | Status in this kit            |
| ------------- | ---------------------- | ----------------------------- |
| TypeScript/JS | **dependency-cruiser** | default                       |
| Python        | **import-linter**      | default                       |
| Python        | **tach**               | opt-in alternative (one-line) |

BoundaryGuard owns the **policy** (`boundaries.yaml`) and a thin **dispatcher**;
the validators own the **graph analysis**. This is the kit's own "wrap the
vendor behind a small adapter" rule, applied to lint tooling.

## Files

```
boundaries.sample.yaml   copy to boundaries.yaml and edit — the single source of truth
check_boundaries.py      the dispatcher (stdlib + PyYAML; shells out to the validators)
hooks/pre-commit.sample  optional local fast feedback (BYPASSABLE — not a guarantee)
```

## Quick start

```bash
# 1. policy
cp bigbrainBoundaryGuard/boundaries.sample.yaml boundaries.yaml   # then edit
pip install pyyaml

# 2. install the validator(s) your repo needs
npm i -D dependency-cruiser      # TS/JS
pip install import-linter        # Python

# 3. see what the policy resolves to, then enforce
python bigbrainBoundaryGuard/check_boundaries.py explain
python bigbrainBoundaryGuard/check_boundaries.py check
```

`check` auto-detects the language from `package.json` / `pyproject.toml` and
runs every applicable validator (good for monorepos). Force one with
`adapter:` in the manifest.

## The manifest

`boundaries.yaml` is **deny-by-default**: you declare modules, their public
entrypoints, and the *allowed* dependencies — everything else is forbidden. It
enforces two things that together keep a boundary real:

1. **Allowlist** — `billing` may import only what `allow.billing` lists.
2. **Public surface (deep-import ban)** — outside code may enter a module only
   through its `public` entries, never reach into its internals.

For dependency-cruiser and import-linter the tool config is **generated fresh
on every run** into a temp file, so it can never drift from the manifest. See
`boundaries.sample.yaml` for the full annotated format.

## Honest limitations (read these)

- **Python public surface.** import-linter has no native "public interface"
  concept. BoundaryGuard enforces it only if you adopt the convention that
  internal code lives under `<module>/_internal/` and set
  `python.enforce_internal_convention: true`. For full public-interface
  enforcement *without* that convention, use the **tach** adapter — that is
  precisely what tach does natively.
- **Hyphens.** A path segment becomes a Python package name for the Python
  adapters, so it must be a valid identifier (`shared_kernel`, not
  `shared-kernel`). BoundaryGuard fails with a clear message if it isn't.
- **Monorepos with different roots per app.** v1 takes one `source_root`. For a
  polyglot monorepo, put a `boundaries.yaml` inside each app and run the
  dispatcher once per app.
- **The dispatcher is not the wall.** Running it locally proves nothing an agent
  can't skip. The wall is this check running in **CI under branch protection** —
  see `../BRANCH_PROTECTION.md`. That document is not optional; it is where the
  enforcement actually lives.
- **Data work: code yes, artifacts no.** BoundaryGuard enforces boundaries on
  *code modules* (including Python data pipelines structured as packages). It
  does **not** enforce boundaries on data *artifacts* — table ownership, schema
  contracts, which job may write which dataset. Those stay a documented
  (surfaced) discipline via the data brain; there's no mechanical wall for them.

## Switching Python to tach (one line)

```yaml
# boundaries.yaml
adapter: tach
```

```bash
python bigbrainBoundaryGuard/check_boundaries.py generate --adapter tach --write
tach sync          # tach is config-file-native; commit the tach.toml it manages
git add tach.toml
python bigbrainBoundaryGuard/check_boundaries.py check   # now runs `tach check`
```

The generated `tach.toml` is a faithful starting point from your manifest;
tach then owns it (unlike the other two adapters, whose config is ephemeral).

## Commands

```
check                                  detect language(s) and enforce (CI uses this)
explain                                print the resolved policy in plain text
generate --adapter <a> [--write]       emit a tool config (stdout, or into the repo)
--manifest PATH                        default boundaries.yaml (falls back to the sample)
--root PATH                            repo root to run validators in (default: cwd)
```

Exit codes: `0` clean · `1` boundary violation · `2` tooling/config problem
(still non-zero, so CI fails either way).
