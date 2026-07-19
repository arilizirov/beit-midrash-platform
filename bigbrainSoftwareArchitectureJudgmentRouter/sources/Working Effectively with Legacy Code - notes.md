# Working Effectively with Legacy Code — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Michael Feathers: legacy code is simply code without tests; the problem is fear of changing it.

- A 'seam' is a place you can alter behavior without editing in place — find seams to get tests in.
- Write characterization tests that pin down what the code CURRENTLY does, before you touch it.
- Break dependencies (often by introducing interfaces/parameters) so the unit becomes testable.
- Then change under the safety net. Get tests in first; don't refactor blind.
