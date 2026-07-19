# Refactoring — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Martin Fowler's discipline of improving structure WITHOUT changing behavior.

- Refactor only under green tests; tests are what make it safe, not careful reading.
- Work in tiny steps, re-running tests after each; never mix refactor with behavior change.
- 'Smells' (long method, large class, feature envy, shotgun surgery) flag where to refactor.
- Core moves: extract/inline function, move field/method, rename, replace conditional with polymorphism.
- Refactor to make a change easy, then make the easy change.
