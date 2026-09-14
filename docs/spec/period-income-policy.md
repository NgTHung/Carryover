# Income and period policy

Decision recorded on 2026-09-13. DATA-015 implements this policy before UI-020. This document supersedes DATA-005's original rule that freezes all three money totals when a period opens. The decision is accepted; the implementation remains To Do.

## Money that has arrived

You record income when you receive it. Carryover asks for no expected amount, recurring income schedule, or payday. An income transaction has a positive integer VND amount, an account, an occurred date, and an optional source label. It has no category.

Your carryover balance comes from account opening balances and recorded money movements. Discretionary subtracts unpaid reserves. Per day and runway come from the existing budget engine. Stored income totals must never be added to account balances again.

Receiving income leaves your horizon unchanged. You can move the horizon explicitly through UI-022; the end of the period is a default date, not a prediction of your next income.

## Stored month config

Opening balance is captured once when a period opens. Reserved total retains its existing opening snapshot policy. Current unpaid reserves continue to use the existing live commitment and payment rules.

The current period's income total tracks actual active income transactions in that local calendar period. Create, edit, completion, soft deletion, and changes of direction or occurred date must keep it consistent with the ledger. Known draft income follows the same amount semantics as account reads. An unknown remains null and contributes no amount; it is never converted to zero.

The income total is persisted with the transaction mutation in one atomic database operation. Notification follows the commit. Screens and report readers do not maintain this total. Repeated refreshes must not increment it again. Money aggregation uses exact integer arithmetic with checked bounds.

Once a period is past, its stored money totals stay frozen. A correction to a past transaction changes actual ledger reports and the current carryover balance, but does not rewrite the past period's month config. Moving an income transaction between a past period and the current one updates only the current period's stored income total.

Historical freezing does not remove the existing explicit per-period horizon editing operation. A horizon edit changes that field only. Income mutations never change any horizon, opening balance, or reserved total.

Reports read actual transactions and stored config for the same period. Actual totals can change after historical corrections. The historical configuration baseline stays fixed. The current period's calendar baseline can change when its stored actual income total changes; it is not a replay of the per-day figures you saw on each earlier day.

## Opening and rollover

DATA-015 owns first launch, first opening midway through a period, local period rollover, and returning after several periods away. Startup and foreground refresh must prepare the current period before requesting a ready snapshot. Mutation paths must also handle crossing a period boundary while the app remains open.

Opening is idempotent and uses one consistent ledger view. It must distinguish money already present at the period start from income received during the period, so income is never counted twice. Existing stored opening balances and reserves are not replaced on repeated startup.

The prerequisite must document and test the derivation of opening balances and reserves, including first launch with an existing ledger and balances outside the current schema's nonnegative opening-balance range. It must not round, clamp, or substitute zero for an unrepresentable value. Any required schema change belongs in that task's staged implementation.

Stored past configurations survive rollover and upgrades unchanged. Never reconstruct their reserves or other frozen inputs from current settings. DATA-015 must specify how it handles periods with no stored config after a long absence, without inventing historical inputs; a missing historical report remains explicitly unavailable unless supported historical facts exist.

The publisher remains a reader of prepared, committed inputs. If period preparation fails, show an explicit error and support retry. A fresh installation must not require manually seeded month config to reach its first ready snapshot.

## Transaction dates and failures

Manual expense and income dates must be today or earlier in the local calendar. Enforce the rule at the application write boundary and reuse it for create, edit, and draft completion feedback. Validate against the clock at submission. Scheduled transactions are outside this work. Future horizon dates remain valid under their existing rules.

A rejected database write retains the form input and changes neither the ledger nor its current income total. A committed transaction remains saved if snapshot publication or navigation fails. Publication retry rereads committed data and never repeats the insert.

Restore uses its own versioned validation boundary. It preserves historical config exactly and applies this period policy before publishing current figures. Manual-entry date validation must not silently rewrite imported or existing history.

## Delivery

DATA-015 establishes the data policy, lifecycle integration, and database evidence. UI-020 adds manual entry and shared editor controls. UI-021 reuses that expense flow for reserve payments. UI-022 edits the horizon without assuming an income date. DATA-012 applies the policy after restore. BUILD-005 verifies these flows on the iPhone.

The [UI-020 execution plan](../plans/UI-020.md) defines the implementation stages, regression cases, and verification boundaries.
