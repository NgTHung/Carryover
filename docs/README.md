# Carryover documentation

Carryover documentation separates the settled product contract from the mechanics of building and shipping it. Read the spec before writing product code. Read the build guides before touching the pipeline.

- [Carryover v1 spec](spec/carryover-v1.md) is the settled product contract: decisions, data model, budget engine, and invariants.
- [Income and period policy](spec/period-income-policy.md) defines actual income, current-period updates, historical freezing, and the DATA-015 prerequisite.
- [UI-020 execution plan](plans/UI-020.md) records the reviewed implementation stages and verification for manual expense and income creation.
- [UI-022 execution plan](plans/UI-022.md) defines the horizon editor, period boundaries, snapshot publication checks, and implementation stages.
- [UI-024 execution plan](plans/UI-024.md) defines account details editing, reconcile behavior, frozen period totals, and staged verification.
- [State and validation](state-and-validation.md) assigns ownership to SQLite, Zustand, and Zod, and defines validation and snapshot publication boundaries.
- [App stack and testing](app-stack-and-testing.md) records navigation, styling, animation, Hermes, and the split between local tests and native CI checks.
- [Design constitution](DESIGN.md) records the current design language. UI-026 revisits it after functional completion; it supersedes the design artifact and `design/BRIEF.md` wherever they disagree.
- [Roadmap](../ROADMAP.md) sequences remaining functionality, device verification, and the later UI overhaul.
- [Design context](design-context.md) briefs a designer on the product, the vocabulary, the screens, and what is still open.
- [Unsigned IPA pipeline](build/ios-unsigned-ipa.md) explains how a Mac-free build reaches your phone and how local UI preview works.
- [Widget sideload result](build/widget-sideload-result.md) records what the stage 0 spike found.
- [Task tracking](task-tracking.md) describes the `.tasks` format and `taskroot` commands.
- [Task project contract](task-project-contract.md) defines the identity and configuration rules `taskroot` enforces.
- [Writing guide](WRITING_GUIDE.md) is the house style for every document and comment.
