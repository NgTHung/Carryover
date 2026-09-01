# Carryover

Carryover is a personal budgeting app built around a balance that never resets. This glossary defines the language shared by the app, the widget, the task files, and every design document. Use these terms in code, in commits, and in conversation.

## Money and time

**Carryover balance**:
The money you actually have, accumulated across months. It does not reset on a period boundary.
_Avoid_: Pot, monthly budget, allowance

**Reserve**:
Money already spoken for by a known fixed commitment such as rent or a bill, subtracted from the balance before anything is called spendable.
_Avoid_: Bill, fixed cost, envelope

**Discretionary**:
The carryover balance minus unpaid reserves. The only money the app treats as free to spend.
_Avoid_: Remaining, available, budget

**Horizon**:
The date the current discretionary money must last until. Defaults to the end of the period and can be moved when you know money is arriving.
_Avoid_: Deadline, month end, target date

**Per day**:
Discretionary divided by days to horizon. The headline figure on the home screen and the widget.
_Avoid_: Daily budget, allowance, safe to spend

**Runway**:
How many days the discretionary money lasts at the recent burn rate. The secondary figure, and the honest one when income has no schedule.
_Avoid_: Forecast, projection

**Period**:
One calendar month starting on the first, used for reporting and for snapshotting config. It is not a budgeting reset.
_Avoid_: Month, cycle, budget period

**Month config**:
The stored snapshot of income, reserves, opening balance, and horizon for one period. Read from storage, never recomputed from current settings.
_Avoid_: Settings, budget config

## Transactions

**Transaction**:
One recorded movement of money, in any direction, belonging to one account.
_Avoid_: Entry, record, expense

**Direction**:
Whether a transaction is an expense, income, adjustment, or transfer. It carries the sign; the amount is always positive.
_Avoid_: Type, sign, kind

**Draft**:
A transaction captured by photo that does not yet have the fields needed to complete it. It is the same table and the same type as a complete transaction, separated by status.
_Avoid_: Pending, incomplete, inbox item

**Unknown**:
A draft with no amount. It is displayed as an explicit unknown count and is never counted as zero.
_Avoid_: Missing, empty, unfilled

**Capture**:
The two second act of photographing a purchase and optionally typing the amount. It is not the same as logging.
_Avoid_: Quick add, snap, check in

**Complete**:
Promoting a draft by supplying an amount and a leaf category. Every other field stays optional.
_Avoid_: Finish, submit, save

**Quality**:
The orthogonal judgment axis on a transaction: need, want, or regret. Nullable and skippable in one tap.
_Avoid_: Tag, label, priority

## Categories

**Group**:
A top-level category. Budgets and reports aggregate here.
_Avoid_: Parent, section, bucket

**Leaf**:
A second-level category. Transactions are logged here and nowhere else.
_Avoid_: Subcategory, child, tag

The taxonomy is exactly two levels. There is no third level and no arbitrary nesting.

## Accounts

**Account**:
A place money sits. There are two, bank and cash, and bank is the default.
_Avoid_: Wallet, source, method

**Reconcile**:
Correcting an account by stating what you actually have. It writes a visible adjustment transaction for the difference.
_Avoid_: Sync, fix, balance

**Adjustment**:
The transaction a reconcile writes. Visible in the transaction list, excluded from every report.
_Avoid_: Correction, plug, delta

**Transfer**:
Moving money between your own accounts. Never spending, never income, excluded from every report.
_Avoid_: Withdrawal, movement

## Splits and debts

**Contact**:
A person you split with. A local record with a nullable user id, so a real account can claim the history later.
_Avoid_: Friend, user, member

**Split**:
The division of one transaction into share rows, one per participant including you. Shares sum to the transaction amount exactly.
_Avoid_: Group payment, shared expense

**Share**:
One participant's portion of a split. The budget charges your share and nothing else.
_Avoid_: Portion, part, owed

**Receivable**:
Money a contact owes you, derived from unsettled shares. Shown beside the discretionary figure, never counted as spending.
_Avoid_: Debt, loan, credit

**Settlement**:
A record of a contact paying you back or you paying them. Applied to unsettled shares oldest first. Never income.
_Avoid_: Payment, repayment, transaction

## Surfaces

**Snapshot**:
The small precomputed object holding every budget figure, produced by one pure function and written to shared storage on every mutation.
_Avoid_: State, summary, view model

**Widget**:
The iOS home screen surface. It renders a snapshot in a separate JavaScript runtime and has no access to the database or app state.
_Avoid_: Extension, complication
