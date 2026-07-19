# bigbrain Eval — does the skill actually change behavior?

This is the **soft** layer of skill-checking. The full picture has three layers,
weakest-claim to strongest, mirroring the kit's surfaced-vs-hard honesty:

| Layer | Question | Where | Strength |
|-------|----------|-------|----------|
| **skill-lint** | Is the skill well-formed & consistent? | `bigbrainSkillCheck/skill_lint.py` | mechanical — a guarantee (CI gate) |
| **tool tests** | Do the tools do what they claim? | `tests/` | mechanical — a guarantee (CI) |
| **eval (this)** | Does the skill change the agent's behavior? | `bigbrainEval/run_eval.py` | statistical — a measurement, not a guarantee |

You can mechanically **guarantee** a skill is well-formed and that the tools
behave. You can only **measure** — never guarantee — that a judgment-skill is
followed, because "did the agent exercise good judgment on this task" has no unit
test. Anyone promising a test that *proves* the AI obeyed a skill is selling the
impossible.

## What the eval does
For each probe in `probes.yaml` it runs the model **without** the skill and
**with** the skill loaded, then an LLM judge scores which answer better matches
the probe's expected disposition. It reports how many probes the skill improved.

```bash
pip install pyyaml
export ANTHROPIC_API_KEY=...        # required
python bigbrainEval/run_eval.py
```

## Read the results honestly
- It's a **small-N, statistical** signal: "the skill helped on 4/5 probes," not
  "the skill is always followed."
- The **judge is fallible** (it's another model). Spot-check its calls.
- It costs API calls (3 per probe). Run it periodically — when you change a brain
  or add a rule — not on every commit.
- Use it to catch **regressions** in a skill's influence, and to justify keeping
  (or cutting) a rule, not as a merge gate.

Add probes for the claims you most rely on (earn-distribution, vertical-slice,
no-premature-abstraction, correct routing). Keep `expect` about disposition, not
exact words.
