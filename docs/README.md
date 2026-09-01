# Carryover documentation

Carryover documentation separates the settled product contract from the mechanics of building and shipping it. Read the spec before writing product code. Read the build guides before touching the pipeline.

- [Carryover v1 spec](spec/carryover-v1.md) is the settled product contract: decisions, data model, budget engine, and invariants.
- [Unsigned IPA pipeline](build/ios-unsigned-ipa.md) explains how a Mac-free build reaches your phone.
- [Widget sideload result](build/widget-sideload-result.md) records what the stage 0 spike found.
- [Task tracking](task-tracking.md) describes the `.tasks` format and `taskroot` commands.
- [Task project contract](task-project-contract.md) defines the identity and configuration rules `taskroot` enforces.
- [Writing guide](WRITING_GUIDE.md) is the house style for every document and comment.
