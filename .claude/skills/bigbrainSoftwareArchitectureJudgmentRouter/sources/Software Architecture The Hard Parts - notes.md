# Software Architecture The Hard Parts — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Ford, Richards, Sadalage, Dehghani: there are no best practices in architecture, only tradeoffs.

- Every decomposition decision trades coupling, cohesion, and deployability against each other.
- Data ownership and distributed transactions are the genuinely hard parts of splitting services.
- Prefer the modular monolith until a force (scaling, runtime, team) justifies distribution.
- Make decisions explicit (ADRs) and name what you're trading away; 'no tradeoff' is a red flag.
