# Carryover design context

## The product in one paragraph

Carryover is a personal budgeting app for one person whose income arrives on no schedule. Most budgeting apps assume a salary lands on a fixed date and hand you a monthly allowance. That produces a false number on the third of the month, before anything has arrived. Carryover carries the balance across months instead of resetting it, subtracts fixed commitments off the top, and divides what remains by the days it has to last. It also lets you log a purchase by taking a photo in about two seconds and finishing the record later.

It is a solo project for its author. There is one user, one currency, and no accounts or onboarding. Currency is Vietnamese dong.

## Who uses it and when

One person, on an iPhone, in three situations.

At the counter, seconds after paying. They open the camera, shoot the receipt or the card machine, optionally type the amount, and put the phone away. Anything slower than two seconds and they stop doing it.

On the sofa in the evening. They work through the drafts they captured, adding an amount and a category to each.

Glancing at the home screen. They see one number, today's allowance, on a widget. This is the most frequent interaction and it has no interface at all.

## Core priority order

1. Correctness of money.
2. Speed of capture.
3. Everything else.

If a design tradeoff comes up, correctness wins over convenience. A wrong balance is worse than a missing feature, because the user stops trusting the app and then stops using it.

## Vocabulary

These words are fixed. The alternatives listed are rejected on purpose, so avoid them in copy.

| Use | Means | Do not use |
| --- | --- | --- |
| Carryover balance | Money you actually have, accumulated across months | Pot, monthly budget, allowance |
| Reserve | Money already spoken for by rent or a bill | Bill, fixed cost, envelope |
| Discretionary | Carryover balance minus unpaid reserves | Remaining, available, budget |
| Horizon | The date the discretionary money must last until | Deadline, month end, target date |
| Per day | Discretionary divided by days to horizon | Daily budget, safe to spend |
| Runway | Days the money lasts at recent burn rate | Forecast, projection |
| Period | One calendar month, for reporting only | Cycle, budget period |
| Transaction | One recorded movement of money | Entry, record, expense |
| Draft | A photo capture missing the fields to complete it | Pending, inbox item |
| Unknown | A draft with no amount | Missing, empty, unfilled |
| Capture | Photographing a purchase | Quick add, snap |
| Complete | Promoting a draft with amount and category | Finish, submit |
| Quality | The need, want, or regret axis | Tag, label, priority |
| Group | A top-level category | Parent, section, bucket |
| Leaf | A second-level category | Subcategory, child |
| Reconcile | Correcting an account by stating what you hold | Sync, fix |
| Contact | A person you split with | Friend, user |
| Receivable | Money a contact owes you | Debt, loan |
| Settlement | A record of a payback | Payment, repayment |
| Snapshot | The precomputed object every surface renders | State, summary |

Two more worth internalising. The first of the month is a reporting boundary, not a budgeting reset. And a repayment is never income.

## The numbers on screen

Every figure the app shows comes from one object called the snapshot, produced by one pure function. No screen calculates anything of its own. This matters to design in a concrete way: if a mockup shows a number that is not in this list, it needs a new engine field, not a formula in the view.

| Field | Meaning |
| --- | --- |
| `balanceTotal` | Bank plus cash |
| `reservedUnpaid` | Commitments due this period, not yet logged |
| `discretionary` | Balance minus unpaid reserves |
| `horizonDate` | The date the money has to last until |
| `daysToHorizon` | Days remaining to that date |
| `perDay` | Discretionary divided by days to horizon |
| `runwayDays` | Discretionary divided by the 30 day average burn |
| `spentThisMonth` | Your own split shares only |
| `regrettedThisMonth` | Spend marked regret |
| `owedToYou` | Total receivable across contacts |
| `unloggedDrafts` | Count of drafts with no amount |
| `updatedAt` | When the snapshot was written |

The same object drives the phone screen and the home screen widget. The widget runs in a separate runtime with no access to the database, so it renders this object or it renders nothing. Two surfaces can never disagree because there is only one implementation.

## Money formatting

Amounts are whole dong. There are no cents, so there is never a decimal in a real amount.

The app currently formats a full figure with dots as thousands separators, `₫4.250.000`, and a compact figure as `₫43k` or `₫4.3tr`, where `tr` is the Vietnamese short form for million. Note the inconsistency: the dot means thousands in one form and a decimal point in the other. Worth settling as part of the design work.

Numbers get compared and scanned, so use tabular figures wherever more than one amount sits in a column.

## Screens

Nine surfaces. The fill-in screen is the most used one in the app and the brief says to design it before it is coded.

### Home

Per day is the largest thing on the screen. Carryover balance and runway sit beneath it. An unknown badge appears when unfilled drafts exist and hides at zero. The receivable total appears beside discretionary when it is non-zero. The capture button must be reachable with one thumb.

States to cover: no transactions yet, negative discretionary, zero days to horizon, zero burn rate so runway is undefined, and a large unknown count that makes the headline figure unreliable.

### Capture

Camera, shutter, and an optional amount on a pre-focused numeric keypad with one tap to skip. It closes immediately and works offline. The whole interaction has a two second budget. Treat every extra tap as a cost against the feature surviving.

### Draft inbox

Unfinished captures listed with photo thumbnails. This is the screen that keeps capture alive, so the design has to make working through a backlog feel finishable rather than accusing.

### Fill-in

Completing a draft needs an amount and a leaf category. Nothing else is required. Optional fields are quality, account, note, and a split. Category selection is a search with inline creation, because a category that requires a trip to Settings never gets created and the transaction lands in Misc instead.

If this screen reads as a form, drafts pile up and the app becomes a photo album.

### Transactions

A filterable list showing amount, leaf category, account, quality, and date. Filters by period, category, account, and quality combine rather than replace each other. Tapping a row opens it for editing.

Two visual requirements. Adjustments and transfers appear here even though no report counts them, and they must be visually distinct from spending. Drafts appear with the amount shown as unknown, never as zero.

### Month summary

Spend by group for a period, the need, want, and regret breakdown, and the regretted total called out on its own. Reporting happens at the group, which is what two levels are for. Transactions with no quality set still count in group totals and show as unrated.

Two more charts sit below those. A cumulative spend line for the month drawn against the median of previous periods at the same day of month, with one flat caption stating the gap in dong. It stops at today and is never extended forward, because runway already answers what happens next. With no previous period there is no reference line and the chart says so.

Then a calendar grid, one cell per day. The cell tint carries what you spent, binned against the per day figure rather than the month's own maximum, so a calm month looks calm and two months compare. Income is a corner mark rather than a second tint, because one cell carries one scale. Days with no spending are untinted and future days are outlines. Tapping a day expands its transactions. No streaks, no best day, no reward for a blank cell.

### People

A balance per contact and a settle action that accepts partial amounts. Splitting is a debt ledger, not a budgeting feature.

### Settings

Accounts and reconcile, commitments, the category editor, and backup and restore.

Reconcile deserves attention. The user states what they actually hold and the app writes a visible adjustment for the difference. They will do this weekly at first. The copy has to read as routine maintenance, not as an admission of failure.

### Widget, small size only

Today's per day figure and the unknown badge. It swaps to runway when runway drops below the horizon. This is the surface the user sees most often and it is a single small square with no interaction.

## Structure the design has to respect

Categories are exactly two levels. A group has no parent, a leaf has a group parent, and transactions attach to a leaf and nothing else. There is no third level and no arbitrary nesting. A group is marked either spend or reserve, and reserve groups leave the discretionary pot automatically.

There are exactly two accounts, bank and cash. Bank is the default.

Quality is a fixed three value enum, need, want, or regret, and it is nullable. It must be skippable in one tap.

Transactions have one of four directions: expense, income, adjustment, or transfer. Amounts are always positive and the direction carries the sign. Never show a negative amount to mean an expense.

## Starter categories

Seeded on first run, marked as suggestions so the whole set deletes in one action. Coffee is a top-level group rather than a child of Food, which is the direct fix for lumping everything together.

- Food: Groceries, Eating out, Delivery, Snacks
- Coffee: Cafe, Beans and home
- Rent, marked reserve: Rent
- Bills, marked reserve: Electricity, Water, Internet, Phone, AI subscriptions, Other subscriptions
- Transport: Ride-hailing, Fuel, Public transport
- Personal: Health, Clothes, Haircut
- Fun: Games, Going out, Media
- Misc: Gifts, Fees, Unsorted

Rent, Bills, Food, and Coffee are about 90 percent of outflow.

## States that are easy to miss

Unknown drafts. A draft with no amount is displayed as an explicit unknown and never counted as zero. The home screen and the widget both carry the count. This is the mechanism that stops the headline number being optimistic exactly when the user has been too busy to log.

Negative discretionary. It happens. Design a treatment for it.

A zero divisor. Days to horizon can be zero on the last day, and the 30 day burn rate can be zero in a quiet month. Per day and runway both need a defined presentation when the division has no answer.

Receivables. Money owed to the user sits beside the discretionary figure and is never counted as spending. It must not read as money available today.

Empty ledger on first run.

## Failure modes the design exists to prevent

Draft rot is the most likely way this app dies. Forty unfilled captures and a remaining figure the user no longer believes. The unknown badge and the daily notification nudge exist entirely to prevent it. Treat them as core, not polish.

Cash drift makes the balance, and therefore every number built on it, progressively less true. Reconcile is the answer and the design has to make it feel unremarkable.

Category sprawl follows inline creation. Pruning has to be as easy as creating, or the list reaches forty entries with six in use.

## Visual material that already exists

There is no design system yet. What exists is a palette used by the spike screen and the widget, and by the spec document. Treat it as a starting point, not a constraint.

Dark ground `#0D1614`, raised surface `#14211E`, ink `#E4EAE7`, muted `#97AAA5`, faint `#6E827D`, rule `#253430`, accent `#46C4A4`, alert and overspend `#E08A58`.

The light equivalents from the spec document are ground `#F6F8F7`, surface `#FFFFFF`, ink `#12211F`, muted `#5A6B67`, rule `#DCE4E1`, accent `#0F6E5C`, copper `#A94D1B`.

The widget commits to one dark look and does not follow the system theme. WidgetKit needs an explicit container background, and one ground lets every foreground colour be stated once.

## Open for design

None of these are decided. They are the work.

Navigation structure across the nine screens. Typography for the app, as opposed to the spec document. Iconography. Whether the app follows the system light and dark setting or commits to dark like the widget. The compact and full money formats. The empty, error, and zero-divisor treatments listed above. Motion, if any.

## Platform constraints worth knowing

iOS only, on a phone, portrait only. No tablet. Distribution is a sideloaded build rather than the App Store, so there is no App Store listing, no review process, and no onboarding for a stranger.

The widget is small size only for now.

There is no Mac in the toolchain, so anything iOS specific is verified only after a CI build lands on a real phone. Camera permissions, safe area insets, and keyboard behaviour cannot be checked quickly. Designs that depend on subtle native behaviour cost a slow round trip to validate.

## Status

Stage 0 of seven. The build pipeline works and the widget install question is mostly settled. There is no product code yet, so nothing in this document has been implemented and nothing is locked by an existing interface.

The build order is ledger, then budget engine and home screen, then capture, then splits, then backup, then the widget. Daily real use starts at the end of the budget engine stage, and the plan expects real data to change the category list before anything is built on top of it.

## Writing style for interface copy

Clear and simple. Short sentences. Active voice. Address the user as you. No em dashes, no metaphors, no emoji. Avoid inflated words such as comprehensive, seamless, or powerful.

The tone the app is aiming for is honest rather than encouraging. It reports what is true, including when the number is bad or unreliable, and it does not congratulate.

## Source documents

- `docs/spec/carryover-v1.md` is the settled product contract.
- `CONTEXT.md` is the vocabulary.
- `ROADMAP.md` and `.tasks/` hold the build sequence and per-feature acceptance criteria.
- `docs/build/widget-sideload-result.md` explains what the widget can and cannot do today.
