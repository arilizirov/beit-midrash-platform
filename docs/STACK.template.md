# STACK.md — current decisions (the freshness layer)

The brains carry *timeless judgment* (when distribution earns its cost, how to
migrate a contract safely). That judgment doesn't expire. **Current practice**
does — which library, which version, today's idiom. This file holds the
current, project-specific decisions so the agent meets durable principles with
present-day facts.

Keep it short and current. When a choice here goes stale, fix it here. For
anything genuinely time-sensitive (a library's exact current API, whether
something is deprecated), the agent should **fetch live docs at task time**
rather than trust any frozen text — this file or a book.

> SUPERVISION: doc-fetching is a tool an agent can misuse — wrong source,
> outdated cache, hallucinated API. The agent must NAME what it fetched (URL +
> what it concluded) in its reply so a human can sanity-check it. Treat fetched
> facts as proposals to verify, not ground truth.

## Languages & runtimes
- <!-- e.g. TypeScript 5.x on Node 20; Python 3.12 -->

## Frameworks & key libraries (with versions)
- <!-- e.g. React 19, Vite, Vitest; FastAPI, SQLAlchemy 2.x -->

## Data
- <!-- e.g. Postgres 16; migrations via <tool>; one schema per domain -->

## Auth / security
- <!-- e.g. auth via <provider/library>; secrets via <manager> -->

## Conventions specific to this repo
- <!-- naming, error handling, logging format, anything not obvious -->

## Folder layout
- This project's domain folder convention (`domains` vs `features`) is declared
  in `boundaries.yaml` (`layout:`), and the generator honors it. Create domains
  with the generator — do NOT instruct the agent here to hand-roll folders or
  bypass the generator; that contradicts `AGENTS.md` and skill-lint will flag it.
- Rule of thumb: STACK.md holds **parameters** (which layout, which versions,
  which libraries); `AGENTS.md` and the brains hold the **principles** (use the
  generator, TDD, vertical slices). Keep that line clean and the files won't fight.

## Known danger zones
- <!-- the parts that bite: flaky integration, a fragile vendor, a legacy module -->
