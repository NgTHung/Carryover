# Carryover design brief

Prompts for Claude Design at claude.ai/design.

## How to use this

Claude Design runs in the browser and cannot read this repository. Every prompt
below is self-contained. Paste the reference block first, then work through the
prompts in order, one per message, in a single session so context carries.

Do not paste all ten screens in one message. That is what produced the first
attempt, and breadth came at the cost of every individual screen. One surface per
prompt, with a round of revision on each, is the way to get depth.

Claude Design builds React for the browser. Carryover is an iOS app in React
Native, so treat the output as a visual target rather than shippable code. Ask for
a 390x844 portrait frame to keep the proportions honest.

## Progress

Sent to Claude Design on 2026-09-04: the reference block, then prompt 1,
foundations and home. Resume at prompt 2.

Prompt 1 is unaffected by the later revisions in this file. The reference block
never enumerated the screens, so nothing already sent needs correcting. What
changed after it went out is the prompt order, a new prompt 3 for manual entry,
and the entry point facts in prompts 2, 5, and 12.

As each prompt lands, record the decision it settled here, not just the screen.
The four that matter for code are the money format, the spacing and type scale,
the navigation model, and whether capture is the root screen.

## What the first attempt got wrong

Keep these out of the next one.

The home screen was the ASCII sketch in the design document converted to divs, in
the same order, with the same three secondary lines. Transcription is not design.

Navigation was never addressed. Nine screens existed with no model for moving
between them, and that is the largest open question in the project.

Layout ran on spacer divs rather than a spacing scale, and one-off hex values
appeared that are in no palette. Nothing was transferable to code.

The captured photo was drawn with CSS gradients and rotated rectangles. The photo
is the one object in this app that is meant to feel physical. A beige rectangle
undercuts the whole reason capture works.

Money appeared as ₫166,000 and ₫4.2m and ₫200k on one screen. The format was never
settled, so the inconsistency shipped.

Light mode was never drawn. The design document says light is designed, not
inverted.

---

## Reference block

Paste this once at the start of the session.

---

I am designing Carryover, a personal budgeting app for one person whose income
arrives on no schedule. Most budgeting apps assume a salary lands on a fixed date
and hand you a monthly allowance, which produces a false number on the third of
the month before anything has arrived. Carryover carries the balance across months
instead of resetting it, subtracts fixed commitments off the top, and divides what
remains by the days it has to last. You log a purchase by photographing it in
about two seconds and finishing the record later.

iPhone only, portrait, one user, Vietnamese dong. Design at 390x844.

**Principles.** The home screen answers "can I spend this?" before the eyes focus,
so one number is larger than anything else by an order of magnitude. The app
reports and never scolds, because an app that makes you feel bad gets deleted.
Uncertainty is rendered, not hidden. Logging is physical, a camera action, never a
form. Money is one continuous substance that carries over, so the visual language
is a level that rises and falls, never a bucket that empties on the 1st. Judgment
belongs to the user. One primary action per screen. Nothing blocks logging.

**Palette.** Dark is the primary target. Light is designed, not inverted.

| Role | Dark | Light |
| --- | --- | --- |
| Ground | #0D1614 | #F6F8F7 |
| Surface | #14211E | #FFFFFF |
| Ink | #E4EAE7 | #12211F |
| Muted | #97AAA5 | #5A6B67 |
| Faint | #6E827D | #8A9A96 |
| Rule | #253430 | #DCE4E1 |

Neutrals carry a slight green bias so they sit with the accent rather than beside
it. Use no hex outside this table and the quality axis below. If you need another
value, add it to the table and say why.

**Quality axis**, the only categorical palette in the app:

| Quality | Dark | Light |
| --- | --- | --- |
| need | #2FA98B jade | #12866D |
| want | #B0811F amber | #966D18 |
| regret | #B0559C plum | #984686 |

These three sit at the floor of colorblind separation, so color alone is never the
encoding. Every quality chip carries its label. Every stacked bar carries a 2px
gap and a direct label on segments over 15 percent.

Regret is plum, not red, on purpose. Red is reserved for genuine errors and
destructive confirmations. Red regret would be the app passing judgment.

**Type.** The hero number is the product, so it does not get the system UI font.
Use a display face with true tabular figures, weight around 600, tight tracking.
Everything else uses the platform face. All money is tabular everywhere. Never
abbreviate the hero number.

**Materiality.** Flat and matte. No glassmorphism, no gradient fills, no shadow
deeper than a 1px separation. The single exception is the captured photo, which
should read as a physical object you picked up and dropped into the inbox. Use a
real photograph in mockups, never a drawn placeholder.

**Every number on screen comes from one object.** If a screen needs a figure that
is not in this list, say so rather than inventing it.

| Field | Meaning |
| --- | --- |
| balanceTotal | Bank plus cash |
| reservedUnpaid | Commitments due this period, not yet logged |
| discretionary | Balance minus unpaid reserves |
| horizonDate | The date the money has to last until |
| daysToHorizon | Days remaining to that date |
| perDay | Discretionary divided by days to horizon |
| runwayDays | Discretionary divided by the 30 day average burn |
| spentThisMonth | Your own split shares only |
| regrettedThisMonth | Spend marked regret |
| owedToYou | Total receivable across contacts |
| unloggedDrafts | Count of drafts with no amount |
| updatedAt | When the snapshot was written |

**Vocabulary is fixed.** Use carryover balance, reserve, discretionary, horizon,
per day, runway, period, transaction, draft, unknown, capture, complete, quality,
group, leaf, reconcile, contact, receivable, settlement, snapshot. Never use pot,
monthly budget, allowance, envelope, remaining, available, safe to spend,
deadline, forecast, pending, quick add, tag, subcategory, sync, or friend.

**Structure.** Categories are exactly two levels, a group and its leaves, and a
transaction attaches to a leaf. There are exactly two accounts, bank and cash.
Quality is need, want, or regret, and it is nullable and skippable in one tap.
Transactions are expense, income, adjustment, or transfer. Amounts are whole dong
with no decimals, always positive, and direction carries the sign, so an expense
is never shown as a negative number.

Starter categories: Food with Groceries, Eating out, Delivery, Snacks. Coffee with
Cafe, Beans and home. Rent, a reserve. Bills, a reserve, with Electricity, Water,
Internet, Phone, AI subscriptions, Other subscriptions. Transport with
Ride-hailing, Fuel, Public transport. Personal with Health, Clothes, Haircut. Fun
with Games, Going out, Media. Misc with Gifts, Fees, Unsorted.

Coffee is a top-level group rather than a child of Food. That is deliberate. It is
the fix for a category list that lumps everything together.

**Copy.** The app writes like a calm friend who is good with money and has no
opinions about yours. Not "You overspent!" but "₫40,000 past today's pace." Not
"Great job!" but nothing at all, because silence is the reward. Not "You haven't
logged in 3 days" but "4 unlogged". No exclamation marks on anything involving
money. No emoji. No apologising. Errors say what happened and what to do: "Couldn't
save the photo. Tap to retry."

**Never.** No red alarm screen for overspending. No streaks, badges, confetti, or
gamification. No modal between the user and a saved transaction. No required field
at capture time. No auto-assigned category or quality. No pie chart. No blocking
sync spinner. No onboarding carousel. No rounding or abbreviating the hero number.

Acknowledge this block and wait. I will send one screen per message.

---

## Prompt 1, foundations and home

Before drawing anything, settle three things and tell me what you chose and why.

First, the money format. It is currently inconsistent: ₫166,000 with commas
alongside ₫4.2m, while the app itself writes ₫4.250.000 with dots and ₫4.3tr,
where tr is the Vietnamese short form for million. A dot cannot mean thousands in
one form and a decimal point in another. Choose one system for full figures and
one for compact, and apply them everywhere from here on.

Second, a spacing and type scale. Name the steps. Every screen after this uses
them, and no layout is built from arbitrary gaps.

Third, whether the app follows the system light and dark setting or commits to
dark. Argue it either way, but decide.

Then design the home screen. Per day is the hero, larger than everything else by
an order of magnitude. Carryover balance and runway sit beneath it. The receivable
total appears only when it is not zero, and it must not read as money available to
spend today. A count of unlogged drafts appears only when it is not zero. The
capture button is reachable with one right thumb.

Two details carry weight. The hero number is prefixed with a tilde whenever
unlogged drafts exist, which turns a claim into an estimate, and the tilde
disappears when the inbox is clear. A level band shows spent, free, and reserved,
left to right, with 2px gaps and no gradient, with reserved on the right because
it leaves last and is not yours to touch.

Give me the screen in dark and in light.

## Prompt 2, navigation

This is the largest open question in the project and it was skipped last time.

There are ten surfaces: home, add or edit a transaction, transactions, capture,
fill-in, draft inbox, month summary, people, settings, and a widget.

Design for what exists today rather than the finished app. The phone is an iPhone
12 Pro Max, so there is no Action Button. The widget is the last thing to be built
and does not work yet, so it is not an entry point. Today the app icon is the only
way in.

Two facts shape the ordering. Manual entry ships first and is the only way to
record money for the first six weeks, so it cannot sit behind a menu. Capture
arrives later and then becomes the most frequent action.

Settle one question explicitly. Should capture be the root screen, so opening the
app puts you straight in the camera, or should the number stay the root with
capture one gesture away? Argue both. The case for capture as root is that it
removes a tap when the app icon is the only entry point. The case against is that
the home screen exists to answer one question before the eyes focus, and every
non-capture visit would begin by dismissing a live camera. Consider a swipe rather
than a tap as the middle path, since capture is already dismissed with a downward
swipe and the inverse gesture needs no aim.

Propose two navigation models, show home under each, and recommend one.

## Prompt 3, add and edit a transaction

The first screen that ships and the only way to record money for six weeks, until
capture exists. It is also the screen fill-in and the edit view are derived from,
so design it before either.

Required: an amount and a leaf category. Direction is expense, income, adjustment,
or transfer, and it changes the form. Income has no category and takes a free text
source label instead, because categorising income doubles the taxonomy for almost
no insight. Optional everywhere: quality, account as bank or cash, date, note, and
a split.

Amounts are whole dong, always positive. Direction carries the sign, so an expense
is never entered or displayed as a negative number.

Adjustments and transfers are entered here too, and no report counts them. Make
that legible at entry so the user understands the number they just typed will not
appear in spending.

Show three states: a new expense, the same screen switched to income, and an
existing transaction opened for editing with a delete affordance. Deletes are soft,
so say what the copy promises.

This screen has more required thinking than fill-in, not less. If it reads as a
tax form, the ledger never gets filled and nothing downstream has data.

## Prompt 4, transactions

A filterable list showing amount, leaf category, account, quality, and date.
Filters for period, category, account, and quality combine rather than replace
each other. Tapping a row opens the edit screen from the previous prompt.

Two requirements that are easy to miss. Adjustments and transfers appear in this
list even though no report counts them, and they must be visually distinct from
spending. Drafts appear with the amount shown as an explicit unknown, never as
zero.

Show the list and the filter state.

## Prompt 5, capture

Camera, shutter, an amount field over a numeric keypad that is already raised and
focused, and a dismiss affordance. Nothing else on screen.

The budget is two seconds from tap to dismissed. Every extra tap is a cost against
the feature surviving. No confirmation dialog. No toast. No category picker, no
account picker, no date picker. Leaving the amount empty is a completely normal
outcome, not a warning. Dismiss is a downward swipe because the thumb is already
at the bottom of the phone.

Entry points, in the order they become real. Today, from inside the app only. Later
a lock screen widget that is a pure launcher, showing no data and carrying no
figure, so it deep links into this screen without needing the shared storage the
data widget depends on. A Back Tap shortcut, double tapping the back of the phone,
is also available and needs no widget at all. There is no Action Button on this
phone. All of these still pass through Face ID, so design the arrival for a user
who has just unlocked and is already raising the camera.

Show the live viewfinder state and the frozen post-shutter state.

## Prompt 6, fill-in

The screen that decides whether captured drafts ever become transactions. Derive it
from the add screen in prompt 3 by taking things away, and show what you removed
and why.

The photo at the top, tappable. The amount, pre-filled if it was captured. A grid
of category leaves ranked by how often they are picked at this time of day, so
Coffee floats to first position at 8am and Eating out rises at noon. New sits in
the grid as a peer of the categories, never behind a menu. A search below it.
Quality chips, one tap, genuinely skippable, no nag. Account as bank or cash.
Split, collapsed, because it is rare.

Nothing is pre-selected. Ranking suggests and never auto-applies, because a wrong
guess you have to notice and undo is worse than no guess. Only the amount and the
category gate the Done button.

Swiping left and right moves between drafts, so clearing the inbox is a stack you
flick through rather than a queue of forms.

Show it with the split section expanded, with a live remainder that must reach
exactly zero.

## Prompt 7, draft inbox

The inbox is a debt you owe yourself and the most likely way this app dies.

Present it as a stack of photos, not a list of rows. The photo is the memory hook,
because you recognise the purchase before you read anything. Make working through
a backlog feel finishable rather than accusing.

Then design the empty state. Clearing the last draft is the reward moment: the
stack empties, the tilde drops off the hero number, and it recounts to a now exact
value. The copy is "Nothing to fill in." with the exact balance shown. No confetti,
no badge, no streak. The honest number is the reward.

## Prompt 8, month summary

Two charts, both chosen against the obvious wrong answer.

Spend by group as ranked horizontal bars, sorted descending, one jade hue because
this is magnitude and not identity, so no legend. Value labelled at the end of each
bar, 4px rounded ends, shared baseline. Not a pie chart. Rent and Bills will
dominate while Food and Coffee will be neck and neck, and that close comparison is
the entire job of the chart.

Tapping a group expands it into its leaves in place, so Food ₫2.1m becomes
Groceries, Eating out, Delivery, and Snacks without leaving the screen.

Quality as one horizontal stacked bar across the month's discretionary spend, with
2px gaps, direct labels on segments over 15 percent, and a legend. Transactions
with no quality set still count in the group totals and show as unrated.

Beneath it, one line stated flatly: "₫340,000 regretted this month." No commentary,
no emoji, no comparison to last month. That number is the most valuable output of
the app and needs no help from the copy.

No trend charts. Two data points is not a trend.

## Prompt 9, people and settling

One row per contact: name, net balance, direction, nothing else. Balances are
derived from transactions and never manually maintained, and a row is tappable to
show which transactions compose it.

Settling is a single sheet with an amount pre-filled to the full balance and
freely editable for partials, plus a date. Two taps for the common case. A settled
balance reads "Settled up" in muted ink rather than zero with a checkmark.

Splitting is a debt ledger, not a budgeting feature. Nothing here animates into the
hero number, because settlements never touch the budget, and the visual separation
should reinforce that.

## Prompt 10, settings and reconcile

An index covering accounts, commitments, the category editor, and backup and
restore.

Then reconcile in full. The user states what they actually hold and the app writes
a visible adjustment for the difference. They will do this weekly at first. The
copy is "What's actually in your wallet?" and never "Fix your balance". It has to
read as routine maintenance, never as correcting a mistake.

Then the category editor, showing that pruning is as cheap as creating. Inline
creation causes sprawl, and a list reaches forty entries with six in use unless
deleting is easy.

## Prompt 11, first run and edge states

First run is three questions on three screens, no carousel and no feature tour:
current bank balance, then current cash, then rent and bills. Then straight to the
add screen, because capture does not exist yet at this stage. Categories seed
silently in the background, and the user meets them when they first record
something, which is the only moment they mean anything.

Then four states that all need a defined presentation.

Over budget is the calmest screen in the app, not the loudest. The number goes
negative, the label reads "over by ₫40,000", the level band fills. No red, no
modal, no notification. The user already knows.

Zero days to horizon, so per day has no divisor.

Zero burn rate in a quiet month, so runway has no answer. A dash is not a design.

An empty ledger on first run, before any transaction exists.

## Prompt 12, widget

Design this last and treat it as unbuilt. It is the final stage of the project and
the data path it depends on is unproven, so nothing before this prompt should
assume it exists.

Small size only. One job: answer "can I spend this?" without unlocking the phone.

The hero number, and the unlogged count only when it is not zero. The background
tint carries the level, subtly jade when there is room and subtly amber as the
horizon approaches, so it reads as ambient state. It swaps from per day to runway
when runway drops below days to horizon, because at that point how long will this
last has become the more urgent question. Tapping it opens capture, not home,
because the widget already told you the number.

The widget commits to one dark look and does not follow the system theme. If the
snapshot is older than an hour, show its timestamp in faint ink rather than
pretending to be live.

Show four states side by side: room to spend with drafts unlogged, horizon close
with the inbox clear, runway mode, and stale data.

Then design the lock screen launcher separately. It carries no figure, so it needs
none of the shared storage above. An icon and a deep link into capture is the whole
surface.

## Prompt 13, motion

Motion exists for one reason, to close the loop between an action and its
consequence.

The signature moment is completing a draft. The card lifts off the stack and
leaves the screen, and behind it the hero number visibly counts down to its new
value. That 500ms sequence is what turns logging from an obligation into a
feedback loop.

Also specify: the hero counting up on app open, the shutter freeze-frame, the
photo arcing to the inbox badge on capture, the balance settling after reconcile,
and the quality chip fill. Everything else is a cross-fade or nothing. No parallax,
no scroll-driven choreography, no spring physics on list items.

Under reduced motion every one of those becomes an instant state change except the
hero recount, which becomes a 150ms cross-fade, because the loop must still
visibly close.

## After the session

Export what you settle on and drop it back in `design/`. The decisions worth
carrying into code are the money format, the spacing and type scale, the
navigation model, the capture as root ruling, and the light and dark ruling. Those
belong in `docs/DESIGN.md` once they are made.
