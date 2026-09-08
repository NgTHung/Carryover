# Carryover documentation

Carryover documentation separates the settled product contract from the mechanics of building and shipping it. Read the spec before writing product code. Read the build guides before touching the pipeline.

- [Carryover v1 spec](spec/carryover-v1.md) is the settled product contract: decisions, data model, budget engine, and invariants.
- [State and validation](state-and-validation.md) assigns ownership to SQLite, Zustand, and Zod, and defines validation and snapshot publication boundaries.
- [App stack and testing](app-stack-and-testing.md) records navigation, styling, animation, Hermes, and the split between local tests and native CI checks.
- [Design constitution](DESIGN.md) is the settled design language: principles, palette, motion, and every screen. It supersedes the design artifact and `design/BRIEF.md` wherever they disagree.
- [Design context](design-context.md) briefs a designer on the product, the vocabulary, the screens, and what is still open.
- [Unsigned IPA pipeline](build/ios-unsigned-ipa.md) explains how a Mac-free build reaches your phone and how local UI preview works.
- [Widget sideload result](build/widget-sideload-result.md) records what the stage 0 spike found.
- [Task tracking](task-tracking.md) describes the `.tasks` format and `taskroot` commands.
- [Task project contract](task-project-contract.md) defines the identity and configuration rules `taskroot` enforces.
- [Writing guide](WRITING_GUIDE.md) is the house style for every document and comment.
