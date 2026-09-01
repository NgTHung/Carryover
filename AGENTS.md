# TypeScript/Carryover
---
Carryover is a personal budgeting app for irregular income. It stores transactions, captures purchases as photo drafts you finish later, tracks split payments as a personal debt ledger, and reports one honest daily spending figure. This is a WIP solo project. Proposed sweeping changes that improve long-term maintainability are encouraged.

The app targets iOS only, built with Expo and React Native, distributed as an unsigned IPA that is signed on device. There is no Mac in this toolchain. CI on a GitHub Actions macOS runner is the only build environment.

Read `CONTEXT.md` before naming anything. The domain vocabulary is fixed and the code must use it.

## Core Priority
---
1. Correctness of money.
2. Speed of capture.
3. Everything else.

If a tradeoff must be made, choose correctness over convenience. A wrong balance is worse than a missing feature, because you stop trusting the app and then you stop using it.

## Money rules
---
These are not style preferences. Breaking one corrupts data silently.

Amounts are `INTEGER` VND with exponent 0. No floating point value ever holds an amount, at any layer, including intermediate arithmetic and JSON. Use the `CURRENCY_EXPONENT` constant instead of writing 1 or 100 inline.

Amounts are always positive. Direction carries the sign. Never store a negative amount to mean an expense.

Division that splits money must assign the remainder deterministically. The remainder goes to the payer. Two runs over the same input must produce the same split.

## Invariants
---
Every one of these has a test. Adding a feature that violates one is a bug even when the tests still pass.

1. Money is integer VND. No floats.
2. Where splits exist, the sum of share amounts equals the transaction amount exactly.
3. Split remainder dong go to the payer.
4. The budget charges your own split share, never the full transaction amount.
5. Settlements never touch the budget and are never income.
6. Transfers and adjustments never count as spending or income in any report.
7. `month_config` is read from its stored snapshot, never recomputed from current settings.
8. The widget reads a snapshot. It never queries the database.
9. A draft with no amount is an unknown. It is never treated as zero.

Invariant 7 is the one that breaks quietly. History is freely editable, so a change to income or reserves today would rewrite what remaining meant in a past month if the config were read live.

## Maintainability
---
Long term maintainability is a core priority. Before adding functionality, check whether shared logic can move to its own module. Duplicated logic across files is a code smell.

Budget arithmetic lives in exactly one pure function. No component, hook, screen, or widget computes a budget number on its own. The widget runs in a separate JavaScript runtime with no access to the database or app state, so a second implementation would drift and the two surfaces would disagree.

Avoid large modules:
- Prefer adding new modules instead of growing existing ones.
- Target modules under 400 lines.
- If a file exceeds roughly 600 lines, add new functionality in a new module unless there is a documented reason not to.

### Change size guidance
---
Unless the change is mechanical, the total number of changed lines should not exceed 800. For complex logic changes keep it under 500. If the change is larger, split it into reviewable stages and land the smallest coherent stage first.

### TypeScript rules
Enable `strict`. Do not add `any`. Do not use non-null assertions in application code.

Do not silence errors. Handle them or let them propagate with context.

Model states that cannot coexist as a discriminated union rather than a bag of optional fields. A draft and a complete transaction share one table and one type, separated by `status`.

Prefer pure functions for anything that computes. Side effects belong at the edges.

Do not add a dependency unless it earns its place. Every native dependency raises the risk of a broken iOS build, and a broken iOS build costs an eight minute CI round trip to diagnose.

Write tests in `tests/` rather than inline.

### Testing
The budget engine is pure and must be tested thoroughly before it is wired to a screen. This is the part of the app that has a correct answer, so test it like it does.

Everything that touches money needs a test. UI polish does not.

### Documentation rules
Core principle: explain WHY, not WHAT. Keep comments short. One sentence explaining rationale beats a paragraph restating code.

**Module docs**
- Explain what the module does in plain language.
- Include design rationale in prose.
- Show usage when the shape is not obvious.

**Inline comments**
- Delete comments that restate obvious code.
- Explain WHY for decisions.
- Use one sentence when possible.

**Never use**
- Placeholder comments ("for now", "TODO: extract this later")
- ASCII diagrams (put those in `docs/`)
- Section divider comments
- Comments explaining removed code during refactors

## Writing Style

This applies to all documentation, code comments, and design documents.

Use clear, simple language. Write short, impactful sentences. Use active voice. Focus on practical, actionable information.

Address the reader directly with "you" and "your". Support claims with data and examples when possible.

Avoid these constructions:

- Em dashes (use commas or periods)
- "Not only this, but also this"
- Metaphors and cliches
- Generalizations
- Setup language like "in conclusion"
- Unnecessary adjectives and adverbs
- Emojis, hashtags, markdown formatting in prose

Avoid these words:
comprehensive, delve, utilize, harness, realm, tapestry, unlock, revolutionary, groundbreaking, remarkable, pivotal

## iOS build constraints
---
There is no Mac and no simulator in this project. Consequences you must design around:

You cannot see an iOS-specific bug locally. Camera permissions, safe area insets, keyboard avoidance, and photo library access only fail on a device, after a CI build.

Keep the iOS build green on every commit. A red build that stays red for several commits turns a one line fix into a bisect.

Keep application code free of iOS-only APIs outside the widget layer, so the fast development loop on other platforms stays usable.

The widget is not shared with any other platform. It is a separate implementation by design.

## Task Tracking

Carryover tracks features, epics, milestones, and development work in `.tasks/`, version-controlled with the code. The `taskroot` CLI validates and queries them.

Run `taskroot` before and after task changes:

```bash
taskroot validate
taskroot list
```

Domains are `app` for product work, `build` for pipeline and distribution work, and `milestones` for release gates. Project milestones live in `.tasks/milestones/`. Normal tasks reference one with `milestone: "0.1.0"`.

`docs/task-tracking.md` is the authoritative reference for the task lifecycle, frontmatter, and commands.
