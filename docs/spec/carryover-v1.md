# Carryover v1 spec

Carryover is a personal budgeting app built for income that arrives on no schedule. Most budgeting apps assume a salary lands on a fixed date and hand you a monthly allowance, which produces a false number on the third of the month before anything has arrived. Carryover carries the balance across periods instead, reserves fixed commitments off the top, and divides what remains by days to a horizon you can move.

This document is the settled product contract. Every decision here was chosen over a named alternative. Code is downstream of this file.

## The two ideas

The balance never resets. Money accumulates, the first of the month bounds reporting, and nothing is zeroed. Rent and bills are reserved as soon as they are known, so the figure the app calls spendable is money you can actually spend. Beside it sits a runway figure, which answers how long the money lasts at your recent rate. That is the honest question when income has no schedule.

Logging must survive a busy day. You photograph a purchase in about two seconds and finish it later. A draft with no amount is displayed as an explicit unknown and never counted as zero, so the remaining figure stops being optimistic exactly when you have been too busy to log.

## Settled decisions

### Money and budget

Amounts are integer VND with exponent 0, named by a `CURRENCY_EXPONENT` constant. There is no multi-currency support and no floating point.

The budget model is a carryover balance. Safe to spend is discretionary money divided by days to horizon, where discretionary is the balance minus unpaid reserves and the horizon defaults to the end of the period. Runway is a secondary readout: discretionary divided by the thirty day average burn.

Fixed commitments are reserved up front and logged manually when paid. Auto-created transactions are deferred.

Income is tracked as events because support arrives irregularly. There is no declared monthly income figure.

The period boundary is the first of the month, stored as configuration rather than hardcoded. History is freely editable, which is safe only because each period stores its own config snapshot.

### Accounts

There are two accounts, bank and cash, and bank is the default. Cash exists because some spending has to be cash.

Reconcile corrects drift. You state what you actually have and the app writes a visible adjustment transaction for the difference. Expect to use it weekly at first. Without it the balance slowly becomes fiction and the runway figure dies with it.

### Categories

The taxonomy is exactly two levels. You log at a leaf and budget and report at a group. There is no third level.

Categories are created inline from the fill-in screen. A category that requires a trip to Settings does not get created, and the transaction lands in Misc instead.

A second axis records quality as need, want, or regret. It is a fixed enum so it can be charted, and nullable so it never blocks saving.

### Splits and debts

Participants are local contacts with a nullable user id. Nobody else needs an account for v1, and the nullable field is the hook that lets a real account claim the history later.

The budget charges your own share only. The rest is a receivable shown beside the discretionary figure and never counted as spending.

Balances per contact are derived from unsettled shares. A settlement is its own record, applied oldest first, so partial payments and netting work by construction. A repayment is never income. Treating it as income double counts and corrupts every comparison between periods.

### Capture

Capture is a photo plus an optional amount on a pre-focused numeric keypad, with one tap to skip. It must stay under two seconds.

Completing a draft requires an amount and a leaf category. Everything else is optional. If completion feels like a form, drafts pile up and the app becomes a photo album.

Photos are downscaled at capture, kept on device indefinitely, and excluded from the routine backup. At roughly 200KB each and twenty captures a month, a year costs about 48MB, which is cheap enough to keep but not something to carry in an export.

### Data and platform

Storage is `expo-sqlite` with Drizzle. Queries are aggregate shaped, and every serious React Native sync engine sits on SQLite, so this keeps the sync option open.

v1 ships backup only, as JSON export and restore. Real multi-device sync is the eventual target and is deliberately deferred. JSON rather than a raw database copy because it survives migrations, you can read it when something looks wrong, and it forces a serializable shape for every entity, which is the homework sync will demand anyway.

UUID keys, `updated_at`, and soft deletes exist from the first migration. Retrofitting them later is the expensive path.

The target is iOS only, with application code kept free of iOS-only APIs outside the widget layer. The widget uses the first-party `expo-widgets` package. Distribution is an unsigned IPA from a GitHub Actions macOS runner, signed on device.

## Data model

Nine tables. Every one carries a UUID `id`, `created_at`, `updated_at`, and `deleted_at`.

```
accounts       name, kind(bank|cash), is_default, opening_balance
categories     parent_id(null = group), name, sort, kind(spend|reserve)
transactions   account_id, direction(expense|income|adjustment|transfer),
               amount(int VND, always positive),
               category_id(leaf; null for income/adjustment),
               quality(need|want|regret|null),
               occurred_at, status(draft|complete), photo_key, note
contacts       name, user_id(nullable)
splits         transaction_id, contact_id, share_amount
settlements    contact_id, amount, occurred_at,
               direction(they_paid_me|i_paid_them), note
commitments    name, amount, due_day(1-31), category_id, active
month_config   period(YYYY-MM), opening_balance, income_total,
               reserved_total, horizon_date
transfers      from_account_id, to_account_id, amount, occurred_at
```

## The budget engine

One pure function produces one snapshot. Nothing else in the app computes a budget number.

```ts
function computeBudget(input: BudgetInput): BudgetSnapshot
```

The snapshot shape lives in `src/budget/snapshot.ts` and is the contract between the engine, the home screen, and the widget. The widget runs in a separate JavaScript runtime with no access to the database or React state, so it renders a snapshot or it renders nothing. A second implementation would drift and the two surfaces would disagree.

Write the snapshot to shared storage on every mutation.

## Invariants

Every one has a test. A feature that violates one is a bug even when the tests pass.

1. Money is integer VND. No floating point holds an amount at any layer.
2. Where splits exist, the sum of share amounts equals the transaction amount exactly.
3. Split remainder dong go to the payer, deterministically.
4. The budget charges your own split share, never the full transaction amount.
5. Settlements never touch the budget and are never income.
6. Transfers and adjustments never count as spending or income in any report.
7. `month_config` is read from its snapshot, never recomputed from current settings.
8. The widget reads a snapshot. It never queries the database.
9. A draft with no amount is an unknown. It is never treated as zero.

Invariant 7 is the one that breaks quietly. Editing history is only safe because each period froze its own config.

## Screens

Home shows today's allowance large, with balance and runway beneath, an unlogged badge when non-zero, and the capture button.

Capture is camera, shutter, and an optional pre-focused amount. It closes immediately and works offline.

Draft inbox lists unfinished captures with thumbnails. It is the screen that keeps capture alive.

Fill-in takes amount, a searchable leaf category with inline creation, quality, account, and an optional split. It is the most used screen in the app, so design it before coding it.

Transactions is a filterable list. Month summary shows spend by group, the quality split, and the regretted total. People shows a balance per contact and a settle action. Settings holds accounts and reconcile, commitments, the category editor, and backup.

The small widget shows today's allowance and the unlogged badge, and swaps to runway when runway drops below the horizon.

## Build order

Each stage depends on the one above it. Weeks assume roughly 10 to 15 hours each.

Stage 0, half a day. Repo, Expo app, and CI producing an unsigned IPA on the first commit, plus the widget install spike.

Stage 1, weeks 1 to 4. Schema and migrations, accounts, the two-level category editor with the starter seed, transaction CRUD, and the list screen.

Stage 2, weeks 4 to 6. The budget engine as a tested pure function, home screen, commitments, reconcile, and month summary. Start using the app daily here. Real data will change the categories before anything is built on top of them.

Stage 3, weeks 6 to 8. Camera, draft creation, photo downscaling, draft inbox, fill-in screen, and the daily local notification.

Stage 4, weeks 8 to 11. Contacts, split entry, derived balances, settlements, and the People screen.

Stage 5, weeks 11 to 12. JSON export and restore. Test a restore on a wiped install before trusting it.

Stage 6, weeks 12 to 13. The paid membership, then the widget.

Weeks 13 to 16 are buffer for iOS bugs, migrations, and what daily use tells you to change.

## Starter categories

Coffee is a top-level group rather than a child of Food. Rent and Bills are reserves and leave the discretionary pot automatically.

- Food: Groceries, Eating out, Delivery, Snacks
- Coffee: Cafe, Beans and home
- Rent (reserve): Rent
- Bills (reserve): Electricity, Water, Internet, Phone, AI subscriptions, Other subscriptions
- Transport: Ride-hailing, Fuel, Public transport
- Personal: Health, Clothes, Haircut
- Fun: Games, Going out, Media
- Misc: Gifts, Fees, Unsorted

Rent, Bills, Food, and Coffee account for about 90 percent of outflow. The long tail is where a missing category shows up, which is why inline creation matters more than getting this seed right.

## Known risks

Draft rot is the most likely way this app dies. Forty unfilled captures and a remaining figure you no longer believe. The unlogged badge and the daily notification exist to prevent it, so treat them as core rather than polish.

Cash drift makes the balance, the runway, and the headline number progressively less true. Reconcile is routine maintenance, not an admission of failure.

The iOS feedback loop is slow. Without a Mac, iOS-specific bugs surface after an eight minute CI round trip.

Category sprawl follows inline creation. Prune at the end of the first month, once real data shows which leaves never get picked.

## Open decisions

Four decisions were made without a round of discussion and can still be flipped cheaply.

Transfers are modelled but optional. Cash use is rare, so reconcile can absorb a withdrawal instead.

Runway uses the total balance across both accounts rather than bank alone, because cash is still spendable.

Income carries no category, only an optional free-text source label.

Adjustments are visible in the transaction list and excluded from every report, so reconciling does not look like a phantom purchase.
