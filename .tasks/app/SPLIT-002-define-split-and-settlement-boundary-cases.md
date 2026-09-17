---
id: "SPLIT-002"
title: "Define split and settlement boundary cases"
status: Done
priority: "High"
type: "Design"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:CAPTURE-001"]
last_updated: 2026-09-17
---

## Summary

Resolve the existing split form promise against positive integer money before implementing arithmetic. Record examples in the split contract in docs/DESIGN.md.

## Acceptance Criteria

- [x] The contract covers empty, zero, fractional, excessive, and unsafe raw input, too many participants for positive shares, unknown amounts, participant and amount changes, payer changes, and payer edits, including accepted, pending, cancelled, and failed-save transitions.
- [x] The contract defines positive integer equal and weighted allocation, exact conservation, deterministic payer remainder, safe BigInt bounds, and rejection that preserves the last accepted allocation.
- [x] The contract defines both payer directions, per-contact opposite debts, chronological oldest-first settlement allocation and ties, partial settlement, overpayment, wrong-direction and before-obligation rejection, and atomic history edits or deletions.
- [x] The contract defines account, report, and snapshot effects, including full account deduction when you pay, own-share spending, contact-paid debt, debt-ledger-only settlements that do not move budget or income, frozen month config, and post-commit publication.

## Execution Plan

Planning date: 2026-09-17.

Produce a split and settlement contract that gives you an exact result for each accepted operation and explains each rejection. SPLIT-002 delivers the settled design decisions and worked examples. SPLIT-003 through SPLIT-008 implement those decisions.

### Readiness and scope

SPLIT-002 is Done with all acceptance criteria evidenced below. Its prerequisite, CAPTURE-001, is Done. Capture work and device verification remain outside this task.

The task was started after taskroot confirmed that CAPTURE-001 was complete. Closing capture work remains outside this task.

The final contract belongs in docs/DESIGN.md section 6.1. Update the split paragraphs in docs/spec/carryover-v1.md and related task criteria where they promise incompatible behavior. Keep the detailed rationale and implementation handoff here.

Do not implement contacts, allocation functions, migrations, settlement persistence, or screens in SPLIT-002. Do not add dependencies or change budget arithmetic. Existing tests establish the baseline; downstream tasks own executable coverage of the new rules.

### Existing behavior to preserve or resolve

| Source | Established behavior and implication |
| --- | --- |
| CONTEXT.md and AGENTS.md | Positive integer VND, payer remainder, own-share spending, settlements excluded from budget figures and income, frozen month config, and snapshot-only widget reads constrain every decision. |
| docs/DESIGN.md section 6.1 | Defines editable shares, exact totals, weighted redistribution, accepted payer edits, pending invalid input, chronological settlement replay, and the v1 account limitation. |
| src/data/money-validation.ts and src/money/currency.ts | Whole-dong text parses through BigInt before safe numeric conversion. Reuse positiveVndInputSchema, CURRENCY_EXPONENT, CURRENCY_SCALE, and MAX_VND_AMOUNT. |
| src/data/schema.ts | Contacts, payer identity, positive share rows, and directional settlements already exist. Settlements have no account reference or stored allocation links. |
| src/data/payer.ts | Payer is a discriminated union. A null stored contact ID means you, not an unknown payer. |
| src/data/shares.ts and src/money/own-expense.ts | Shared reads and validation already reject duplicate, orphan, missing-own, and non-exact shares. Known-amount expense drafts can already have shares. |
| src/data/account-balances.ts and account-projection.ts | A self-paid expense deducts its full amount from its account. A contact-paid expense does not move your accounts. Settlements are absent from the projection. |
| src/budget/compute-budget.ts | Carryover balance comes from account balances. Discretionary subtracts unpaid reserves. Own shares determine spending and burn. Changing an account balance changes budget figures. |
| src/budget/snapshot-source.ts | owedToYou is currently supplied as zero. SPLIT-007 must connect derived receivables through the existing publication path. |
| tests/budget.logic.test.ts | Already covers own shares, contact-paid spending, and known-amount split drafts. Do not narrow these cases accidentally. |

### Stage 1: Establish the contract decisions

1. Run taskroot validate, taskroot list, and taskroot context app:SPLIT-002 --format json. Review the parent, SPLIT-003 through SPLIT-008, DATA-010, and MILESTONE-005. Once ready, run taskroot start app:SPLIT-002.
2. Refine this task's first two criteria to explicitly require raw input behavior, payer-edit divisibility, weighted zero-share rejection, and participant/amount/payer transitions. Refine the third to require chronological netting and history replay. Preserve the fourth criterion's settlement and budget invariant.
3. Record the two conflicts below with numerical examples. Resolve their wording before presenting section 6.1 as an implementable contract.
4. Update affected task criteria in the same stage so later features cannot implement contradictory promises. Run taskroot validate immediately after task edits, followed by taskroot list.

Commit: docs(split): resolve boundary contract promises

Exit: the accepted rules and the account limitation are explicit. Do not begin allocation or persistence code while a required decision remains open.

Resolved Decision A, payer edits and remainders:

For a transaction of 100 VND with three equal weights, typing a payer share of 33 leaves 67 for two contacts. Whole-dong division produces 33 each and a remainder of 1. Giving that remainder to the payer makes their share 34, which changes the typed value. Giving it to a contact breaks the payer-remainder rule.

Resolution: accept a payer edit only when the remaining amount divides exactly under the other participants' weights and every resulting share is positive. Retain rejected text for correction while preserving the last accepted allocation. A payer edit of 34 succeeds as 34, 33, 33. With one other participant, every positive edit below the total succeeds.

SPLIT-001 now records: Every share remains editable; an accepted payer edit preserves the typed amount and redistributes the remainder exactly by the other participants' current weights; an incompatible edit preserves the last accepted allocation and explains why it cannot be applied.

The contract replaces the promise of no validation errors or blocked completion with: Accepted allocations always total exactly; invalid pending input requires correction or explicit cancellation before completion. There is no manual remainder repair step. Do not silently clamp, round, or save older values beneath invalid visible text.

Resolved Decision B, account balances and settlements:

Start with 1,000 VND in bank and no reserves. You pay 100, with your share 40 and Linh's share 60. The current code reports bank and carryover balance 900, spending 40, and, once implemented, a receivable of 60. If Linh pays you 60 into bank, an accurate cash projection becomes 960. The current budget engine therefore changes carryover balance, discretionary, and per day.

The literal settlement invariant permits a debt-ledger-only settlement: clear the receivable while bank and budget figures stay at 900. That leaves the recorded account short of actual cash by 60. This is a material product limitation, not an arithmetic detail. Automatically writing an adjustment or income transaction does not resolve the invariant conflict.

Resolution: accept debt-ledger-only settlements for v1 and document the account limitation in docs/DESIGN.md section 6.1 and the acceptance criteria. Do not adopt cash-moving settlements, add an account selector, or introduce a second budget projection. A separate account operation such as Reconcile is required when recorded account cash must catch up with physical cash.

Also clarify the existing phrase that the budget charges your share: own-share spending and burn already coexist with full cash deduction when you paid. A contact-paid share contributes spending without reducing your account balance. Do not claim the current discretionary calculation deducts only your share.

### Stage 2: Specify share input and allocation

Write a compact contract in section 6.1, with stable example IDs from the matrix below. Keep input parsing, pure allocation, and persistence validation as separate responsibilities.

1. Allow splits only on expenses with a known positive amount, whether draft or complete. Keep an unknown draft's amount null and write no shares. Completing a draft and its split must eventually be one atomic operation.
2. Require you exactly once and each contact at most once, identified by ID. Require the payer to be a selected participant. Duplicate contact names are allowed because identity comes from the ID.
3. Opening the split editor selects only you and creates no stored split rows. A saved multi-person split contains one positive share per participant, including the payer and you. Removing the last contact normalizes to an unsplit expense paid by you.
4. Parse editable text using the existing whole-dong parser. Trim surrounding whitespace and allow leading zeros. Reject signs, decimal notation, exponent notation, grouping separators, non-digits, zero, and amounts above MAX_VND_AMOUNT. Empty share text is unfinished input, never zero. Typed total and share values follow the same money rules.
5. Keep raw text separate from the last accepted allocation. Model accepted, editing-invalid, and saving states explicitly. Rejected input changes neither the accepted allocation nor storage. Save requires visible values to match an accepted allocation. Cancel edit explicitly restores the accepted value. A failed save retains input.
6. Use positive safe integer calculator weights, initially one per participant. Equally sets all weights to one and allocates. Shares changes a weight and allocates. A failed weight change preserves the prior weights and allocation. No hidden allocation mode or field lock remains after either action.
7. Weights are editor calculator state, not stored money or inferred from rounded shares. Manual edits leave weights unchanged. Reopening a saved split restores its saved amounts and initializes calculator weights to one; it does not recalculate until you invoke an allocation action.

Allocation rules:

| Operation | Deterministic rule |
| --- | --- |
| Equal or weighted allocation | Let T be the total and W the sum of weights. Give each non-payer integer quotient T times their weight divided by W. Give the payer T minus the sum of those shares. Reject if any share is not positive. |
| Edit a non-payer share | Preserve the typed valid amount and all other non-payer amounts. Set the payer share to the total minus their sum. Reject if the payer would receive zero or less. |
| Edit the payer share | Let R be total minus typed payer amount. Require R times each non-payer weight to divide exactly by the non-payer weight sum. Accept only positive results; otherwise apply Decision A. |
| Change the total | Preserve non-payer amounts and recompute the payer balance. Reject a total that cannot leave the payer positive. Equally remains an explicit way to redistribute all fields. |
| Add a contact | Give the contact calculator weight one and recalculate all shares using the current weights. Reject the whole selection change if any share becomes zero. Make the recalculation visible before save. |
| Remove a non-payer contact | Remove their weight and recalculate the selected participants. Removing the final contact normalizes to unsplit. You cannot remove yourself. |
| Remove the payer contact | Require choosing another selected payer first. Do not silently transfer payer identity. |
| Change payer | Recalculate with the same weights and new payer as remainder recipient. This can replace manual values, so show the resulting amounts before save. Reject unknown or unselected payers. |
| Remove the split | Reset payer to you and remove all share rows atomically, subject to the history policy. Explain that this makes the full expense yours and can change accounts, spending, and receivables. |

All multiplication, sums, division, and remainder operations use BigInt internally. Convert to number only after checking the final safe range. Persist and serialize safe integer amounts; do not serialize BigInt or intermediate monetary fractions. Read the currency scale from the shared constants. A total large enough for the participant count can still fail weighted allocation because a low-weight participant would receive zero. Reject instead of inventing minimum shares that change the stated weighting.

| Example | Input or action | Expected result |
| --- | --- | --- |
| S01 | Total 450001; you, Linh, Minh; equal; you pay | Shares 150001, 150000, 150000. All sum exactly. |
| S02 | Same total and weights; Linh pays | Shares in the same participant order: 150000, 150001, 150000. |
| S03 | Total 100; weights 1, 2, 3; you pay | Shares 17, 33, 50. Integer quotient remainder goes to you. |
| S04 | Total 3; three equal participants | Each receives 1. Adding a fourth participant is rejected without changing selection or shares. |
| S05 | Total 3; weights 1, 1, 100; first participant pays | A non-payer would receive zero. Reject even though total equals participant count. |
| S06 | Clear a share, or type 0, -1, 1.5, 1e3, 1,000, or Infinity | Keep text pending and accepted shares unchanged; do not save or reinterpret the input. |
| S07 | Type 9007199254740992 | Reject above MAX_VND_AMOUNT before conversion can lose precision. |
| S08 | Type surrounding spaces and leading zeros around 0010 | Accept as integer 10 if the allocation remains valid; formatting never changes money. |
| S09 | Total 100; shares 34, 33, 33; edit Linh to 40 | Shares become 27, 40, 33. Editing Linh to 67 instead would leave payer zero and is rejected. |
| S10 | Total 100; equal weights; edit payer to 33, then 34 | Reject 33 under Decision A; accept 34 with other shares 33 each. |
| S11 | Total 100; two participants; edit payer to 37 | Accept shares 37 and 63. Payer 100 is rejected. |
| S12 | Total 100; three equal weights; shares manually changed to 27, 40, 33; change payer to Linh | Reallocate to 33, 34, 33; explicitly show that the payer action replaced manual values. |
| S13 | Shares 34, 33, 33; increase total to 101, then attempt 66 | First becomes 35, 33, 33. Reject 66 and retain the accepted total 101 and allocation. |
| S14 | Amount unknown, with contact selections in an unfinished editor | Preserve unknown status and null amount; no shares or receivable are persisted. |
| S15 | Total MAX_VND_AMOUNT; two equal participants; you pay | You receive 4503599627370496, contact 4503599627370495. Verify the sum with integer arithmetic. |
| S16 | Missing own participant, duplicate ID, or payer absent from participants | Reject at the data boundary even if supplied shares total correctly. |
| S17 | Total 101; you pay; other weights 2 and 3; edit payer to 36, then 35 | Accept 36, 26, 39. Reject 35 because 66 cannot divide exactly in the ratio 2:3. |

Repeat accepted examples with permuted input row order and fresh allocations. Results by participant ID must remain identical. Include known-amount draft, income, transfer, adjustment, zero-weight, fractional-weight, unsafe-weight, and overflow rejection cases in the downstream test inventory.

Commit: docs(split): specify editable integer share cases

Exit: each form action has a complete accepted/rejected transition, and every accepted numeric example conserves the total with positive shares.

### Stage 3: Settle the personal debt ledger and history

Define obligations only between you and each contact. If you paid, each contact owes their share. If a contact paid, you owe that payer your own share. Other contacts' shares remain part of the transaction allocation but do not create debts involving you. Do not turn a third participant's share into your receivable or your liability.

Netting and allocation procedure:

1. Derive contact positions from active source transactions, active shares, and active settlements. Keep positive amounts and explicit direction. A cleared position is a separate state, not a stored zero settlement. Do not persist a running contact balance.
2. Replay events chronologically per contact. Order by occurred_at ascending, then transaction before settlement for an equal time, then created_at ascending, then stable ID in ascending binary order. For multiple obligations from a transaction, use participant ID as the final stable key. Never use contact names, UI ranking, database return order, or updated_at as a tie-breaker.
3. When an obligation arrives, offset it against that contact's oldest outstanding opposite obligations. Keep any residual obligation in its original direction and chronology. Never net across contacts and never create a synthetic cash settlement for netting.
4. At each settlement event, allocate its positive amount against the oldest outstanding obligations in its stated direction. they_paid_me consumes a receivable; i_paid_them consumes what you owe. Validate at that point in history, not against a future or current-only total.
5. Reject overpayment, payment in the wrong direction, and payments before sufficient obligations exist. Do not cap the amount, create credit, or consume a future expense. All historical prefixes must remain valid after an edit.
6. Derive allocations during replay using stable source identities. The current schema has no allocation table, so do not assume stored foreign keys from settlements to shares. Reserve a schema change for a demonstrated need in the implementing task.
7. Sum only residual receivables across contacts for owedToYou. A debt you owe a different contact cannot reduce that sum. Check aggregate safe bounds as well as individual amounts.

History policy:

Allow edits to amount, payer, participants, occurred_at, and shares, split removal, and transaction soft deletion only if replay of every affected contact remains valid. Evaluate the full proposed change atomically. Preserve all original rows if it would leave any settlement unallocated or allocated in the wrong direction. Moving a transaction between contacts must validate both the old and new contact histories.

Explain which settlement prevents the change. You can correct or soft-delete the mistaken settlement first, then retry the transaction correction. Do not cascade-delete valid settlements or silently turn them into income. This constrains the broad promise that history is freely editable: it remains editable while preserving valid settlement history. Record that qualification in the final contract.

A settlement correction replaces its effective amount, direction, contact, date, or note under the same validation. Soft deletion removes its effect and replays the remaining history. A later settlement that becomes invalid rejects the whole operation. Reference-preserving note or quality edits remain possible when financial history is unchanged.

Soft-deleting a contact hides them from new split selection but retains their identity, history, and outstanding position. Existing debts can still be settled and corrected. Reject new obligations to deleted contacts. Duplicate names remain separate identities throughout netting and settlement.

| Example | Events in order | Expected result |
| --- | --- | --- |
| L01 | You pay 100; own share 40, Linh 60 | Linh owes you 60. Own spending is 40. |
| L02 | Linh pays 100; own share 40, Linh 35, Minh 25 | You owe Linh 40. You have no receivable from Minh and owe nobody else's share. |
| L03 | Linh owes you 60, then you owe Linh 25 | Offset 25 against the oldest receivable; Linh owes you 35. |
| L04 | Linh owes you 60; you owe Minh 25 | owedToYou is 60. Keep the 25 owed to Minh separate. |
| L05 | Linh owes 60 from T1 and 40 from T2; receives settlement 70 | Allocate 60 to T1 and 10 to T2; residual receivable is 30. |
| L06 | T1 and T2 have equal occurred_at and created_at; T1 ID sorts first; settlement 50 | Consume T1 first. Reversing database row order gives the same allocation. |
| L07 | You owe Linh 40; i_paid_them settlement 15 | Residual amount you owe is 25; own spending stays 40. |
| L08 | Net receivable 35; try they_paid_me 36 or i_paid_them 10 | Reject both and preserve history. A settlement of 35 clears the position. |
| L09 | Linh owes 60; they_paid_me 50; edit original share to 40 or delete its transaction | Reject because 10 or 50 of the settlement would lack backing. |
| L10 | Same initial history; edit original share to 70 with a valid full split | Accept; residual receivable becomes 20. Recompute spending from the revised own share. |
| L11 | Linh owes 60; settlements 40 then 20; edit the first settlement to 50 | Reject because the later settlement can no longer allocate its full 20. |
| L12 | Linh owes 60; they_paid_me 50; delete the settlement | Restore the receivable to 60 without writing income or an expense. |
| L13 | Linh owes 100; receives 60; later you owe Linh 80 | Net the remaining 40, leaving you owing 40. Netting all expenses before replaying the earlier settlement would be wrong. |
| L14 | Settlement occurs before the expense that would support it | Reject, even when today's aggregate would cover the amount. |
| L15 | Move an expense to after its supporting settlement, or change its payer/contact | Replay affected histories and reject unsupported settlements atomically. |
| L16 | Soft-delete Linh while she owes you 60 | Historical name and receivable remain readable, settlement remains available, and new split selection excludes Linh. |

Add exact-time transaction/settlement ties, settlement direction reversal, equal timestamps after a correction, no-op corrections, duplicate submissions with the same operation identity, and reopening storage to the downstream verification inventory. Separate a retried operation from two intentionally different settlements with identical contents.

Commit: docs(split): specify settlement netting and history rules

Exit: both payer kinds, both settlement directions, netting, chronological ties, overpayment, and every history mutation have a deterministic result or an explicit rejection.

### Stage 4: Define account, report, and snapshot effects

Decision B is settled as a debt-ledger-only policy. Use the following table as the literal-invariant contract and record its account limitation beside it. Do not imply it accurately records settlement cash movements.

| Operation | Account effect under the v1 model | Spending and reports | Receivable and snapshot |
| --- | --- | --- | --- |
| You pay a split expense | Deduct the full transaction from the selected account | Charge only your share to spending, category, quality, and burn | Add contact shares as receivables, subject to netting |
| Contact pays a split expense | No account movement | Charge your share exactly once | Add only your obligation to that payer; no receivable for third-party shares |
| Either settlement direction | No account movement under the debt-ledger-only policy | No expense, income, spending, or burn effect | Recompute the contact position and owedToYou; publish after commit |
| Settlement correction or deletion | Same ledger-only account limitation as creation | No report or budget contribution | Recompute from effective history; no incremental cached balance edits |
| Split amount/payer/participant edit or removal | Reproject the revised transaction's account effect | Recompute affected own-share reports | Replay affected contact histories and publish only after commit |
| Failed mutation | No change | No change | No mutation notification or new snapshot from the rejected operation |

For settlement-only comparisons, hold the clock, other ledger rows, reserves, and horizon fixed. Assert equality of balanceTotal, reservedUnpaid, discretionary, horizonDate, daysToHorizon, perDay, runwayDays, spentThisMonth, regrettedThisMonth, and unloggedDrafts. owedToYou and updatedAt may change. A date rollover or unrelated mutation is not a settlement effect.

Read stored month config. Settlement records must not contribute to current-period actual income or alter past opening balances, income totals, reserves, or horizons. Historical transaction edits may change live reports through their own-share reads while stored configuration totals remain frozen.

Require one atomic mutation boundary for transaction, payer, share, and affected-history checks. Retain existing post-commit notification and snapshot publication. A storage publication failure is a saved-ledger refresh failure, not a reason to submit the settlement again. The widget reads the published snapshot and performs no debt or budget calculation.

docs/spec/carryover-v1.md now states that the rest is a receivable only when you paid, and that a contact-paid transaction creates what you owe its payer. The design and spec contain no wording that creates your claim against other contacts. Keep the budget implementation as the sole source of budget arithmetic.

Commit: docs(split): define account and snapshot effects

Exit: the account limitation or revised authorized requirement is explicit, every affected snapshot field has an expected result, and no task still promises incompatible settlement behavior.

### Stage 5: Verify the contract and hand it to implementation

1. Check each S and L example with integer-only arithmetic independent of any future implementation. Verify exact totals, positive stored amounts, deterministic ordering, per-contact conservation, and rejection without mutation. Record the inputs and outputs in section 6.1 so they can become tests.
2. Review every acceptance criterion against the coverage table below. Link to the final contract sections and decisions from this task; do not check criteria merely because this plan exists.
3. Review the final design, spec, parent epic, milestone, and SPLIT-003 through SPLIT-008 together. Update summaries and criteria where required, with last_updated set to the edit date. Run taskroot validate immediately after each task refinement, then taskroot list.
4. Run the focused baseline command below. Its result protects existing assumptions but does not prove the future split arithmetic or settlement engine. No new implementation or test suite is required just to restate design text.
5. Run git diff --check and review changed-line counts. Keep each coherent stage under the repository's 800-line limit; target a total design change below that limit. Keep section 6.1 concise and avoid unrelated visual redesign or documentation cleanup.
6. Record verification and resolved decisions in this task. The prerequisite is satisfied, all four criteria have evidence, and taskroot has completed app:SPLIT-002 after the final validation and show inspection. Leave dependent features unstarted.

Commit: docs(split): verify boundary contract and implementation handoff

No native build or iPhone check is required to verify this design-only change. SPLIT-008 owns split/People device behavior. Keep commits local; pushing requires user consent.

| Acceptance criterion | Required contract evidence |
| --- | --- |
| Input, participant count, payer changes, payer edits | S01-S17, parsing rules, state transitions, calculator weight lifetime, and Decision A |
| Exact sum and payer remainder | Equal and weighted formula, positivity rejection, integer bounds, exact payer redistribution, repeated and permuted inputs |
| Contact-paid, opposite debts, settlements, history | L01-L16, both directions, event ordering, per-contact netting, replay validation, and contact deletion policy |
| Account and snapshot effects without settlement budget changes | Explicit Decision B outcome, operation table, field equality checks, period preservation, post-commit publication, and matching task/spec wording |

Implementation ownership:

| Task | Contract obligations and later verification |
| --- | --- |
| SPLIT-003 | Contact identity, duplicate names, deletion visibility, retained history, and selection rules. Database tests cover active and deleted references. |
| SPLIT-004 | Implement the share transition table in pure functions. Logic tests turn S cases into expected outputs and rejection assertions, including permutation and safe bounds. |
| SPLIT-005 | Persist transaction/payer/shares atomically and enforce history constraints. Reuse DATA-010 reads; real SQLite tests cover rollback, draft completion, split removal, payer changes, and period preservation. History replay validation requires the shared pure rules planned for SPLIT-006. |
| SPLIT-006 | Implement contact obligations, chronological netting, and allocation. Logic tests turn L cases into deterministic replay cases. Keep policy in shared pure modules so SPLIT-005/007 do not duplicate it. |
| SPLIT-007 | Persist and correct settlements with atomic replay, duplicate-submission protection, and snapshot refresh. Database integration tests prove the settled account/snapshot policy and saved-but-refresh-failed recovery. |
| SPLIT-008 | Connect the accepted form state, visible errors, explicit cancellations, payer consequences, archived-contact settlement, and People actions. Component and iPhone checks cover keyboard, retry, navigation, and restart. |

Sequencing decision: SPLIT-006 depends on SPLIT-005, while SPLIT-005 must validate edits against settlement history. SPLIT-005's initial stage keeps settlement writes unavailable and fails closed for existing or seeded settlement rows. SPLIT-006 introduces one shared replay policy and integrates it into existing split mutations before SPLIT-007 exposes settlement writes. SPLIT-005/006 criteria record that ownership; no circular dependency or duplicate replay implementation is allowed.

Suggested later test files, not files to create in SPLIT-002: tests/split-allocation.logic.test.ts, tests/split-edits.logic.test.ts, tests/split-persistence.database.test.ts, tests/contact-balances.logic.test.ts, tests/settlement-allocation.logic.test.ts, tests/settlements.database.test.ts, and tests/settlement-snapshot.integration.database.test.ts. Reuse current account, share, report, money, and snapshot suites where they already own a behavior.

Verification commands for this design task:

```bash
npm run test:logic -- --runInBand --runTestsByPath tests/budget.logic.test.ts tests/account-balances.logic.test.ts tests/money-validation.logic.test.ts tests/snapshot-source.logic.test.ts
taskroot validate
taskroot list
git diff --check
git diff --stat
```

## Verification

On 2026-09-17, the four focused baseline logic suites passed all 21 tests:

```text
npm run test:logic -- --runInBand --runTestsByPath tests/budget.logic.test.ts tests/account-balances.logic.test.ts tests/money-validation.logic.test.ts tests/snapshot-source.logic.test.ts
```

An independent BigInt check passed representative equal and weighted allocations,
the safe maximum split, payer-edit divisibility, oldest-first settlement allocation,
and opposite-debt netting. The contract records all S01-S17 and L01-L16 scenarios,
with exact totals and rejection behavior. `taskroot validate` passed with 87 tasks
and no warnings. `git diff --check` passed, and the design change stayed below the
repository's 800-line limit. No application code, native dependency, migration, or
executable split test was added. Decision A accepts payer edits only when the
weighted remainder is exact. Decision B accepts debt-ledger-only settlements and
records their account limitation. Downstream implementation tasks remain
unstarted.
