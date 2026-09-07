# State and validation

Use Zod for runtime input validation and Zustand for UI state shared across screens. These are implementation decisions for the tasks below; they are not yet installed in the app.

SQLite remains the source of truth for the ledger. Keeping ownership explicit prevents a saved transaction, an in-memory copy, and a widget figure from drifting apart.

## Ownership

| Data | Owner |
| --- | --- |
| Transactions, captured drafts, accounts, categories, contacts, splits, settlements, commitments, month config, transfers | SQLite, accessed through the data layer |
| Route history and route parameters, including the transaction id being opened | Expo Router |
| Selected period, transaction filters, capture UI state shared across screens that is not already in the route | Zustand |
| Text being edited and UI state used by one screen | Local React state |
| Budget figures | The snapshot produced by computeBudget |
| Published snapshot in the app | A Zustand store holding the exact published artifact |
| Published snapshot in the widget | Shared storage, read by the widget's separate runtime |

Use small Zustand stores with selector subscriptions. Keep ledger collections in database reads. Persist a captured draft to SQLite before reporting capture as successful, so terminating the app cannot lose it. The selected period and filters can survive screen navigation in memory; they do not need a second persistence system.

Do not mirror route history or route parameters into Zustand. See [App stack and testing](app-stack-and-testing.md) for Expo Router, styling, animation, and the local testing workflow.

TanStack Query is deferred. Start with data-layer reads and explicit refresh after committed mutations. Drizzle live queries can serve simple lists when SQLite change listeners are enabled. Verify refresh for every table a query depends on, including joined tables. A reactive query still needs the public read API's soft-delete policy.

## Validation

Define reusable Zod schemas at the data boundary and infer their TypeScript types. Screens may reuse those schemas for field feedback, but every create, edit, completion, and restore must pass validation before writing. Validate the resulting entity when applying a partial edit.

Use a discriminated union on status for draft and complete transactions. Every complete transaction has an amount. A complete expense also has a leaf category; income has no category. A draft with no amount retains null through storage, reads, and backup.

Share money schemas across feature inputs and ORM adapters. Positive amounts use the positive safe-integer range. Opening balances and stored totals permit zero where the schema allows it. Keep currency constants and bounds in the pure money module, using CURRENCY_EXPONENT. Keep widget formatting independent of Zod and the database.

Validate amount text before numeric conversion. Blank capture input means an unknown; it must never become zero through coercion. Reject fractional notation and values outside the safe-integer range without rounding or truncating them. Convert accepted whole-dong text only after checking its range. A versioned JSON import must also reject invalid amount tokens before numeric parsing can round them into apparently valid integers. Zod validates the decoded payload, but cannot recover precision already lost by a parser.

SQLite CHECK constraints enforce integer storage, sign, and the same safe-integer ceiling for every amount column. They protect writes that bypass Zod or ORM mapping. The data layer also checks facts that need stored rows, such as whether a category is an active leaf. Pure functions own split arithmetic and budget arithmetic. Runtime shape validation does not replace those checks or their tests.

Public reads hide soft-deleted rows by default. Backup and historical category references opt in explicitly to deleted rows. Keep this policy in the read API so each screen does not have to remember a predicate.

## Publishing a snapshot

After a successful database commit, one application service reads the required ledger data and stored month config, calls computeBudget, and writes the resulting snapshot to shared storage. It then publishes that exact artifact to the app's Zustand snapshot store. Store actions and selectors do no budget arithmetic.

Represent loading, ready, and error as a discriminated union. Startup computes and writes a fresh snapshot from committed data before presenting ready, since the date or ledger may have changed since the last publication. A failed database mutation publishes no replacement snapshot. If shared-storage publication fails after a commit, expose the error and retry from committed data. Never present an older artifact as current after that failure.

The widget reads shared storage in its own runtime. It has no access to the app's Zustand stores, Zod input schemas, database connection, or React state.

## Task ownership

| Task | Responsibility |
| --- | --- |
| DATA-001 | Introduce shared Zod money schemas, align SQL bounds, and enforce default soft-delete reads |
| DATA-002 through DATA-007 | Validate feature inputs at the data boundary; DATA-004 owns the transaction union |
| UI-001 | Introduce Zustand for the shared selected period and filters |
| BUDGET-002 | Publish one snapshot to shared storage and the app's Zustand store |
| UI-003 and UI-004 | Subscribe to published snapshot or selected-period state without computing budget figures in stores |
| CAPTURE-001 | Reuse transaction validation and keep captured drafts durable across restarts |
| SPLIT-001 | Validate inputs and stored relationships while keeping share arithmetic in pure functions |
| DATA-008 | Validate versioned backups before an atomic restore, then refresh reads and the snapshot |

Test money validation through both ORM writes and direct SQL, including fractional and unsafe values. Test default reads through the public API without manually adding a filter. Test snapshot publication failures and equality between the written artifact and the ready store value.

References: [Zod schemas](https://zod.dev/api), [Zustand](https://zustand.docs.pmnd.rs/), and [Drizzle Expo SQLite live queries](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite).
