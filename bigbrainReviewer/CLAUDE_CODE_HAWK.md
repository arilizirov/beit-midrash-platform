# Running the hawk in Claude Code (no API cost)

You don't need the metered API to run the debt hawk — Claude Code can run it on
your subscription. The hawk's value is the persona (`REVIEWER.md`), not the
plumbing. This wires it up the **right** way: as an independent, read-only pass.

## What ships
`.claude/agents/debt-hawk.md` — a Claude Code **subagent**. Two properties make
it correct rather than theatre:
- It runs in its **own isolated context window** — separate from the session
  that wrote the code. That's the "fresh eyes" independence: the reviewer isn't
  the author continuing its own train of thought.
- It's **read-only** (`tools: Read, Grep, Glob`) — it has no edit/commit/build
  tools, so it can only *propose*. Judge and actor stay separate hands, enforced
  at the tool level.

It reads `bigbrainReviewer/REVIEWER.md` for its rubric, so there's one persona,
no duplicate to drift.

## Use it
1. The subagent loads at startup. After unzipping the kit (or editing the file),
   **restart Claude Code** or run `/agents` to pick it up.
2. Invoke it **explicitly** as a separate step — auto-delegation is unreliable,
   and you *want* this deliberate anyway:
   > use the debt-hawk subagent to review the staged changes
   or: "...to review the diff against main", or "...to review src/features/billing".
3. It returns findings in `REVIEWER.md`'s format. You (or the builder, in a
   separate action) decide what to apply. The hawk never changes anything.

## Do it right (the independence is the whole point)
- **Best:** run the review in a fresh Claude Code session that didn't build the
  code, or have the builder session delegate to this subagent (its isolated
  context gives meaningful separation either way).
- **Avoid:** asking the same session that just wrote the code to "review it"
  inline without the subagent — that's the author grading its own homework. The
  subagent exists precisely to prevent that.

## Honest limits
- **Fresh eyes, same brain.** A Claude subagent reviewing Claude-written code
  shares blind spots with the author; it catches less than a different model or
  a human would. It's a strong, cheap first filter — not a backstop.
- **Advisory, fallible.** It can be wrong and can miss things. A human makes the
  final call, especially on must-fix items.
- **Suggest, never act** — by design, and don't loosen its tools to "let it just
  fix things." The moment it can act, it stops being an independent check.

## Subscription vs API
Pick one; same persona either way:
- **Subscription:** this subagent (no per-call cost; run locally/on demand).
- **API / CI:** `bigbrainReviewer/review.py` + `.github/workflows/review.yml`
  (posts on every PR; needs `ANTHROPIC_API_KEY`).
