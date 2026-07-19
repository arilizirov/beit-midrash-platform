# 11 Vertical Slices (delivery order for new work)

Use when building a NEW feature or a NEW system — i.e. deciding the *order* in
which you build, not how the code is arranged.

Primary source: _Growing Object-Oriented Software, Guided by Tests_ (walking
skeleton); reinforced by _An Elegant Puzzle_ (smallest high-leverage step).

## Core judgment

Build the thinnest complete path through every layer first — one real UI path,
one real service path, one real DB path, one real test path, one real deploy
path — before adding breadth. Prove the *shape* end-to-end with one slice; it
becomes the template the rest copy. The risk that kills projects is integration
discovered late, so front-load it: hit the scary seam on day one, not in month
three.

This is the build-ORDER counterpart to organizing by domain (which is
arrangement) and to the generator (which stamps the shape). The generator gives
you the horizontal skeleton; this rule says fill it vertically.

## Triggers

- new feature, new module, new app, new service
- a generator just stamped a domain skeleton (now fill one thin path through it)
- "scaffold the whole thing" / "set up all the layers" requests
- greenfield project start
- new, unproven stack / infrastructure / external API

## Rules

- Thin but WHOLE: the narrowest behavior that still reaches every layer. Breadth (touching all layers) is the goal; depth in any one layer is not, yet.
- Pick the slice that retires the most risk: the most central workflow, or the most architecturally uncertain part. (Auth is a common first slice because nearly everything depends on it.)
- Real at every layer — no stubs. A stub means you haven't proven that layer connects, which was the whole reason to build a slice.
- Ship it for real: deploy path, config, secrets, observability wired up. The pipeline is part of the slice.
- Do NOT gold-plate: no edge cases, no exhaustive validation, no polish. The slice answers "does the shape work end to end," not "is this feature finished."
- Treat the first slice as the template — name things and set boundaries with a little extra care, because the rest copies it.
- A horizontal-scoped goal (e.g. "migrate the whole UI") is still DELIVERED as vertical slices: one shippable screen end-to-end first, extract shared pieces only once duplication is real, then roll the rest.

## A slice is not a spike

- **Slice** = the foundation you grow on; keep it, build the next slice on it.
- **Spike** = a throwaway experiment to answer a question, deleted before the real test-first build. Same thinness, opposite fate. If it's a spike, say so (and the TDD exception applies).

## Verification

- one behavior runs end to end through real layers (integration/e2e proof)
- the slice deploys to a real environment, not just a laptop
- boundaries respected from the first slice (run the boundary check)
- the slice is small enough to be one PR (stacked-PR friendly)

## Anti-patterns

Do not build all layers horizontally then integrate at the end; do not scaffold ten features before one works end to end; do not stub a layer to "prove" a slice; do not polish the first slice into a finished feature; do not confuse a keep-it foundation slice with a throwaway spike.
