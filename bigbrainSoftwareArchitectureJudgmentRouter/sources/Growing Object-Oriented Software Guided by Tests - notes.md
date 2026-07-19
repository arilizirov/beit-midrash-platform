# Growing Object-Oriented Software Guided by Tests — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Freeman & Pryce's outside-in TDD; the source of the 'walking skeleton' and 'listen to the tests'.

- Start with a walking skeleton: one thin end-to-end slice that exercises the whole toolchain.
- Work outside-in; mock the ROLES a collaborator plays, not concrete objects.
- Tell, don't ask; isolate the domain behind ports and adapters.
- Test pain is a design signal: if something is hard to test, the design is usually wrong.
