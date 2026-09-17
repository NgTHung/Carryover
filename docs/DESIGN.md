# DESIGN.md — Carryover

The design constitution. This document is about what the app *feels* like to use.
It deliberately ignores implementation cost — where a decision here is expensive,
that is a conversation for the build plan, not a reason to weaken the design.

Companion document: the build spec covers data model, engine, and sequencing.
Nothing in this file should be read as a technical constraint.

The design system artifact and the prompts in `design/BRIEF.md` that produced it
are a frozen reference, kept for the visual language they settled. This document
supersedes them wherever the two disagree.

Build sequencing was revised on 2026-09-13. Complete and verify v1 functionality before the UI overhaul in milestone 0.9.0. Use existing shared controls during feature work. UI-026 will revisit this visual direction against the completed flows. SPLIT-002 resolves split input boundary promises before implementation; money validation takes precedence over claims that every input can be saved.

---

## 1. Principles

Eight rules. Every design decision below is downstream of one of them, and any
future decision that violates one is wrong by default.

**P1 · One question, one second.**
The home screen answers *"can I spend this?"* before the eyes have focused. One
number, larger than anything else in the app. Everything else on that screen is
secondary by an order of magnitude, not by a little.

**P2 · The app reports. It never scolds.**
No red alarm screens, no "you overspent!", no disappointed empty states. The app
is a mirror, not a parent. This is not softness — a budgeting app that makes you
feel bad gets deleted, and a deleted app has no effect on anyone's spending.

**P3 · Uncertainty is rendered, not hidden.**
When unlogged drafts exist, the headline number is *visibly approximate*. An app
that quietly shows a confident wrong number is worse than one that admits it
doesn't know yet.

**P4 · Logging is physical, not clerical.**
Capture is a camera action with a shutter and a haptic. It should feel like
taking a photo, because it is. It must never feel like filling in a form.

**P5 · Money is one continuous substance.**
The balance carries over; it never resets. The visual language follows — a level
that rises and falls, never a bucket that empties and refills on the 1st.

**P6 · Judgment belongs to the user.**
need / want / regret is *self*-assessment. The app never assigns it, never
predicts it, never comments on it. It counts what you said and shows you the
total. That restraint is the whole reason the axis is trustworthy.

**P7 · One primary action per screen.**
Never two buttons of equal weight. If a screen seems to need two, it's two screens.

**P8 · Nothing blocks logging.**
Any required field at capture time is a bug. Any modal between you and a saved
transaction is a bug. Data you can fix later beats data you never captured.

---

## 2. The one number

The home screen is one number and its supporting cast.

```
                    ┌─────────────────────────┐
   period, tiny  →  │  September · day 2      │
                    │                         │
   THE NUMBER    →  │     ~₫166,000           │   ← 56–72pt, tabular
   state label   →  │     to spend today      │   ← 15pt, muted
                    │                         │
   the level     →  │  ████████░░░░▓▓▓▓▓▓▓▓   │   ← spent · free · reserved
                    │                         │
   secondary     →  │  ₫4.2m balance          │
                    │  38 days runway         │
                    │  ₫200k owed to you      │
                    │                         │
   unlogged      →  │  ⟳ 2 unlogged           │   ← only when > 0
                    │                         │
                    │              ( ● )      │   ← capture, thumb-reach
                    └─────────────────────────┘
```

**The tilde is load-bearing.** `~₫166,000` appears whenever unlogged drafts exist.
It is the typographic rendering of P3 — one character that changes the number from
a claim into an estimate. When the inbox is clear, the tilde disappears and the
number is stated flat. Users will learn this in a day and it will make them trust
the number more, not less.

**The level band** is the only chart on the home screen. Three segments, left to
right: spent (neutral, recessive), free (jade), reserved (amber). Reserved sits on
the right because it's the money that leaves last and isn't yours to touch. A 2px
surface-colored gap separates segments — never a hairline stroke, never a gradient.

**Secondary stats are one line each, no cards, no boxes.** They are reference
values, not dashboard tiles. The moment they get borders they start competing with
the hero number and P1 dies.

---

## 3. Visual language

### Palette

Dark-first. This is an app checked at 11pm, in bed, in cafés — the dark surface is
the primary design target and light mode is designed, not inverted.

| Role | Dark | Light | Used for |
|---|---|---|---|
| Ground | `#0D1614` | `#F6F8F7` | app background |
| Surface | `#14211E` | `#FFFFFF` | sheets, cards |
| Ink | `#E4EAE7` | `#12211F` | primary text, the hero number |
| Muted | `#97AAA5` | `#5A6B67` | labels, secondary stats |
| Faint | `#6E827D` | `#8A9A96` | dividers, disabled |

Neutrals carry a slight green bias so they sit with the accent rather than beside it.

**The quality axis** — the only categorical palette in the app, validated for
colorblind separation in both modes:

| Quality | Dark | Light |
|---|---|---|
| need | `#2FA98B` jade | `#12866D` |
| want | `#B0811F` amber | `#966D18` |
| regret | `#B0559C` plum | `#984686` |

**The spend ramp** is the only sequential scale in the app. One hue, four steps,
used by the day calendar in §8. It is a magnitude ramp, not an identity palette,
so it never needs a legend of its own.

| Step | Dark | Light |
|---|---|---|
| 1 | `#215849` | `#9FBDB3` |
| 2 | `#26725E` | `#79AB9B` |
| 3 | `#2B8D74` | `#509884` |
| 4 | `#2FA98B` | `#12866D` |

Both ramps were validated rather than eyeballed: monotone lightness, every adjacent
gap above the visible-step floor, single hue, and a step 1 that clears 2:1 against
its surface so the faintest tint still reads as a mark. Zero is not step 1. A day
with no spending is untinted surface, because spending nothing is a real outcome
and should look like one.

> **Mandatory secondary encoding.** Tritan separation for these three sits in the
> 6–8 floor band, which is only legal alongside a non-color cue. Every quality
> chip carries its **label**, and every stacked quality bar carries a **2px gap**
> plus a **direct label** on segments over 15%. This is not optional polish — drop
> it and the chart becomes unreadable for tritanopic users.

**Regret is plum, not red — deliberately.** Red stays reserved for genuine errors
and destructive confirmations. If regret were red, the app would be passing
judgment (violating P6) and would have no color left for actual alarm.

### Type

- **Hero numeral face:** a display face with true tabular figures and some
  character. The number is the product; it should not be rendered in the system
  UI font. Weight ~600, optical size large, tight tracking.
- **Interface:** the platform face. Legibility over personality everywhere the
  hero isn't.
- **Never abbreviate in the hero.** `₫166,000`, not `₫166k`. Abbreviation is for
  the widget and dense lists only, where space genuinely forces it.
- All money is `tabular-nums`, everywhere, always. Digits must not shift width
  as the number animates.

### Materiality

Surfaces are flat and matte. No glassmorphism, no gradient fills, no drop shadows
deeper than a 1px separation. The one exception is the **captured photo**, which is
the only richly-textured object in the app — it should feel like a physical thing
you picked up and dropped into the inbox.

---

## 4. Motion

Use shared Reanimated helpers for app motion and NativeWind tokens with Tailwind Variants for repeated controls. Respect the native reduced-motion preference. Animation progress may be fractional, but money remains integer VND and the snapshot stays unchanged. See [App stack and testing](app-stack-and-testing.md) for implementation boundaries.

Motion exists here for exactly one reason: **to close the loop between an action
and its consequence.**

**The signature moment.** You complete a draft. The card lifts off the stack and
leaves the screen — and *behind it*, the hero number visibly counts down to its new
value. You see your allowance change as a direct result of the thing you just did.
That single 500ms sequence is the emotional core of the product. It's what turns
logging from an obligation into a feedback loop.

| Moment | Motion | Duration |
|---|---|---|
| App open | Hero counts up from ~85% to true value | 320ms, ease-out |
| Shutter | Freeze-frame + haptic thud | instant |
| Capture saved | Photo shrinks, arcs to inbox, badge bumps | 400ms |
| Draft completed | Card exits, hero recounts to new value | 500ms, staggered |
| Reconcile | Balance settles into place, overshoots ~2% | 600ms |
| Quality chip tap | Chip fills, light haptic tick | 120ms |

Everything else is a cross-fade or nothing. No parallax, no scroll-driven
choreography, no spring physics on list items.

Under `prefers-reduced-motion`, every entry above becomes an instant state change
except the hero recount, which becomes a 150ms cross-fade — the loop must still
visibly close.

---

## 5. Capture

The single most important interaction. Target: **shutter to dismissed in under two
seconds.** Every frame below is budgeted.

| t | State |
|---|---|
| 0ms | Tap capture — from home, widget, lock screen, or Action Button |
| ≤120ms | Live viewfinder. Camera is pre-warmed; there is never a black frame |
| — | Frame: shutter button, an amount field docked above a **pre-raised numpad**, a dismiss affordance. Nothing else |
| ~600ms | Shutter tap → freeze-frame, haptic thud, photo stays on screen |
| ~600ms+ | Numpad is already up and focused. Type an amount, or don't |
| ≤2000ms | Swipe down or tap done. Photo arcs to the inbox badge |

**Rules for this screen:**

- No confirmation dialog, ever. No "Saved!" toast that occupies the screen.
- No category picker, no account picker, no date picker. Those are fill-in concerns.
- Works fully offline with no visible difference. Never a spinner.
- If the amount is left empty, that is a completely normal outcome, not a warning.
- The dismiss gesture is a downward swipe, because your thumb is already at the
  bottom of the phone holding it.

---

## 6. Fill-in — the most-used screen in the app

This is where the app either fits your life or doesn't, and it's where the
"categories always lump everything together" complaint gets solved.

```
  ┌───────────────────────────────┐
  │  [ the photo, tappable ]      │
  │                               │
  │  ₫  45,000                    │  ← amount, pre-filled if captured
  │                               │
  │  ┌──────┐┌────────┐┌────────┐ │
  │  │Coffee││Eating  ││Groceries│ │  ← frequency + time-of-day ranked
  │  │ Cafe ││  out   ││         │ │
  │  └──────┘└────────┘└────────┘ │
  │  ┌────────┐┌──────┐┌───────┐  │
  │  │Delivery││Snacks││ + New │  │  ← "+ New" is always visible
  │  └────────┘└──────┘└───────┘  │
  │  🔍 search all categories      │
  │                               │
  │  ( need )  ( want )  ( regret )│  ← one tap, skippable
  │                               │
  │  [ bank | cash ]   ⌄ Split     │  ← split collapsed by default
  │                               │
  │            ( Done )            │
  └───────────────────────────────┘
```

**The category grid is ranked, not alphabetical.** It is ordered by how often you
pick each leaf *at this time of day*. Coffee floats to first position at 8am and
sinks by evening; Eating out rises at noon. This is the direct fix for the
lumping complaint — it means the taxonomy can be genuinely fine-grained without the
picker becoming a chore, because the six leaves you actually need are always the
six on screen.

**Rules:**

- `+ New` lives *in the grid*, as a peer of the categories — never behind a menu,
  never in Settings. Creating a category takes one tap and a keyboard.
- Ranking **suggests, it never auto-applies.** Nothing is pre-selected. A wrong
  guess you have to notice and undo is worse than no guess (P6).
- Quality chips are one tap and genuinely skippable — no asterisk, no nag, no
  "you skipped this" reminder.
- Split is collapsed because it's rare. Expanding it is specified in §6.1.
- **Swipe left/right moves between drafts.** Clearing the inbox is a card stack you
  flick through, not a queue of forms you open and close.
- Only amount + category gate the Done button. Everything else is optional forever.

---

### 6.1 Split entry

Split is the rarest thing this screen does and the easiest to make annoying. The
editor keeps every share editable, but it never hides invalid money or silently
changes an accepted value. The rules below separate raw text, pure allocation, and
storage validation so the form can stay quick without weakening the ledger.

A split is allowed only on an expense with a known positive amount. A known-amount
draft may have a split, but an unknown draft keeps `amount = null` and writes no
shares or receivable. Income, transfer, and adjustment transactions cannot have a
split. Completing a draft and saving its split is one atomic operation.

Participants are identified by ID. You appears exactly once, each contact appears at
most once, and the payer must be one of the selected participants. Duplicate contact
names are valid because IDs, not names, define identity. Opening the editor selects
only you and creates no stored rows. A saved split has one positive share per
participant, including you. Removing the last contact returns the transaction to an
unsplit expense paid by you. Removing yourself is not allowed. Removing the payer
contact requires selecting another payer first.

```
  ⌄ Split
  ┌─────────────────────────────────────┐
  │  Paid by   ( You )( Linh )( Minh )  │
  │                                     │
  │  With      ( Linh )( Minh )( Vy )(+)│
  │                                     │
  │  ( Equally )   ( Shares )           │
  │                                     │
  │    You     ₫150,001                 │  ← the balance
  │    Linh    ₫150,000                 │
  │    Minh    ₫150,000                 │
  │                                     │
  │  You're owed ₫300,000               │
  └─────────────────────────────────────┘
```

**Rules:**

- **Money input is whole-dong text.** Trim surrounding whitespace and allow leading
  zeros. Empty text is unfinished input, never zero. Reject zero, signs, decimal or
  exponent notation, grouping separators, other non-digits, and values above
  `MAX_VND_AMOUNT`. Total and share fields use the existing positive VND parser.
  Weight fields use positive safe integers and reject zero, fractional, unsafe, and
  overflowing values.
- **Raw text is separate from the accepted allocation.** The editor has accepted,
  editing-invalid, and saving states. Invalid text stays visible as pending input,
  while the last accepted allocation and stored rows remain unchanged. Save requires
  visible values to match an accepted allocation. Cancel restores the accepted
  value, and a failed save retains the input for correction. The app never clamps,
  rounds, or saves an older value underneath invalid visible text.
- **The payer receives the integer remainder.** For total `T`, participant weights
  `wᵢ`, and weight sum `W`, allocate each non-payer `floor(T × wᵢ / W)`. Set the payer
  share to `T` minus the sum of those non-payer shares. Reject the whole allocation
  if any resulting share is not positive or any final value is outside the safe
  integer range. All multiplication, sums, division, and remainder operations use
  `BigInt`; convert only checked final values to numbers.
- **`Equally` and `Shares` are actions, not modes.** `Equally` sets every calculator
  weight to one and allocates. `Shares` changes a positive integer weight and
  allocates. A failed weight change preserves the prior weights and allocation.
  Manual amount edits do not change weights. Weights are editor calculator state,
  not stored money and not inferred from rounded shares. Reopening a saved split
  restores saved amounts, initializes weights to one, and does not recalculate until
  an allocation action runs. Row order never changes results by participant ID.
- **Editing a non-payer share preserves the edit.** Keep the typed positive amount
  and all other non-payer amounts, then set the payer to the total minus their sum.
  Reject when the payer would be zero or negative, or when another visible value is
  invalid. Adding a contact gives it weight one and recalculates all shares. Reject
  the selection change if any share would be zero. Removing a non-payer removes its
  weight and recalculates the remaining participants.
- **Editing the payer share has a divisibility rule.** Let `R = T - payer input`.
  The input is accepted only when `R × wᵢ` divides exactly by the sum of non-payer
  weights for every non-payer and every resulting share is positive. This preserves
  the typed payer value without giving a remainder dong to a contact. With one
  other participant, every positive payer input below `T` succeeds. An incompatible
  input stays pending and explains that the remainder cannot be allocated exactly.
- **Changing payer is an allocation action.** It uses the current weights and makes
  the new payer the remainder recipient, so it can replace manual values. Show the
  resulting amounts before save. Reject an unknown or unselected payer. Changing the
  total preserves accepted non-payer amounts and recomputes the payer; reject a
  non-positive payer result. `Remove split` resets payer to you and removes share
  rows atomically, subject to the history rules below. Explain that this can change
  account projection, spending, and receivables.
- **The footer describes the ledger direction.** When you paid, show the residual
  receivable from each contact. When a contact paid, show what you owe that payer.
  A third participant's share never becomes your receivable or your liability.
  Contact selection still uses recency and frequency ranking, with only you selected
  initially. `+` creates a contact inline.

Examples for the pure allocation and editor state:

| ID | Input or action | Accepted result |
| --- | --- | --- |
| S01 | Total 450001; you, Linh, Minh; equal; you pay | You 150001, Linh 150000, Minh 150000. |
| S02 | Same total and weights; Linh pays | You 150000, Linh 150001, Minh 150000. |
| S03 | Total 100; weights 1, 2, 3; you pay | You 17, Linh 33, Minh 50. |
| S04 | Total 3; three equal participants; add a fourth | Initial shares are 1, 1, 1. Adding the fourth is rejected and selection and shares stay unchanged. |
| S05 | Total 3; weights 1, 1, 100; first participant pays | Reject because a non-payer receives zero, even though total equals participant count. |
| S06 | Clear a share, or type 0, -1, 1.5, 1e3, 1,000, or Infinity | Keep raw text pending and accepted shares unchanged. Do not save or reinterpret it. |
| S07 | Type 9007199254740992 | Reject above `MAX_VND_AMOUNT` before number conversion. |
| S08 | Type surrounding spaces and leading zeros around 0010 | Accept as integer 10 when the allocation remains valid. Formatting never changes money. |
| S09 | Total 100; shares 34, 33, 33; edit Linh to 40, then 67 | First result is You 27, Linh 40, Minh 33. Reject 67 because the payer would be zero. |
| S10 | Total 100; equal weights; edit payer to 33, then 34 | Reject 33 because 67 cannot divide across two equal contacts. Accept 34, 33, 33. |
| S11 | Total 100; two participants; edit payer to 37, then 100 | Accept 37 and 63. Reject 100 because the other share would be zero. |
| S12 | Total 100; manual shares 27, 40, 33; change payer to Linh | Reallocate to You 33, Linh 34, Minh 33 and show that payer action replaced manual values. |
| S13 | Shares 34, 33, 33; increase total to 101, then edit payer to 66 | Total change gives 35, 33, 33. Reject 66 because the remaining 35 does not divide across equal contacts; retain total 101 and the accepted allocation. |
| S14 | Unknown amount with contacts selected in an unfinished editor | Keep amount null and unknown. Persist no shares or receivable. |
| S15 | Total `MAX_VND_AMOUNT`; two equal participants; you pay | You 4503599627370496, contact 4503599627370495. The integer sum equals the total. |
| S16 | Missing own participant, duplicate ID, or payer absent from participants | Reject at the data boundary even when supplied shares sum correctly. |
| S17 | Total 101; you pay; other weights 2 and 3; edit payer to 36, then 35 | Accept 36, 26, 39. Reject 35 because 66 cannot divide exactly in ratio 2:3. |

Run accepted cases again with permuted row order and fresh allocations. Results by
participant ID must match. Downstream tests also cover known-amount drafts, income,
transfer, adjustment, zero-weight, fractional-weight, unsafe-weight, and overflow
rejection cases.

The `Paid by` row depends on `transactions.payer_contact_id`, nullable, where null
means you. The spec carries it. The form may show a pending error, but it never
blocks a valid allocation with a manual remainder repair step.

Alternatives considered and rejected: a drag-to-divide stacked bar, which is the
fastest uneven split but degrades past three people, is fiddly at exact VND, and
needs a typed fallback that amounts to this design anyway; and a your-share-only
field, which is faster still but cannot express unequal debts between two
contacts, trading correctness for speed against the core priority.

#### Debt ledger and settlement history

The split creates obligations only between you and each contact. If you paid, each
contact owes you their share. If a contact paid, you owe that payer your own share.
Other contacts' shares remain part of the allocation but create no debt involving
you. A debt you owe one contact never reduces a receivable from another contact.

The ledger derives positions from active source transactions, active shares, and
active settlements. It stores positive amounts and explicit directions, not running
contact balances. A cleared position is a separate state from a stored zero
settlement. Replay each contact independently in this order:

1. Sort by `occurred_at` ascending, then put a transaction before a settlement at
   the same time, then sort by `created_at` ascending, then by stable ID in ascending
   binary order. For multiple obligations from one transaction, participant ID is
   the final stable key. Never use contact names, UI order, database row order, or
   `updated_at` as a tie-breaker.
2. When an obligation arrives, offset it against that contact's oldest outstanding
   opposite obligations. Preserve any residual in its original direction and
   chronology. Never net across contacts and never create a synthetic cash
   settlement.
3. At a settlement event, allocate its positive amount against the oldest
   outstanding obligations in its stated direction. `they_paid_me` consumes a
   receivable. `i_paid_them` consumes what you owe. Validate the prefix at that
   point in history, not against a future or current-only total.
4. Reject overpayment, wrong-direction payment, and payment before a sufficient
   obligation exists. Do not cap an amount, create credit, or consume a future
   expense. Sum only residual receivables across contacts for `owedToYou`, and
   check aggregate safe bounds as well as individual amounts.

History remains editable only while valid settlement history remains valid. Amount,
payer, participant, occurred-at, and share edits, split removal, and transaction
soft deletion replay every affected contact atomically. Moving a transaction between
contacts checks both histories. If a settlement would become unallocated or point in
the wrong direction, reject the whole change, preserve the original rows, and name
the blocking settlement. Correct or soft-delete that settlement first, then retry.
Never cascade-delete a valid settlement or turn it into income.

A settlement correction replaces its effective amount, direction, contact, date, or
note under the same replay validation. Soft deletion removes its effect and replays
the remaining history. A later settlement becoming invalid rejects the entire
operation. Note or quality edits that do not affect financial history remain
available. Settlement allocation is derived from stable source identities; the
current schema does not assume a stored settlement-to-share allocation table.

Soft-deleting a contact hides them from new split selection but retains their ID,
history, and outstanding position. Existing debts can still be settled and
corrected. New obligations to deleted contacts are rejected. Duplicate names stay
separate identities throughout replay.

| ID | Events in order | Result |
| --- | --- | --- |
| L01 | You pay 100; own share 40, Linh 60 | Linh owes you 60. Own spending is 40. |
| L02 | Linh pays 100; own share 40, Linh 35, Minh 25 | You owe Linh 40. You have no receivable from Minh and owe nobody else's share. |
| L03 | Linh owes you 60, then you owe Linh 25 | Offset 25 against the oldest receivable. Linh owes you 35. |
| L04 | Linh owes you 60; you owe Minh 25 | `owedToYou` is 60. Keep the 25 owed to Minh separate. |
| L05 | Linh owes 60 from T1 and 40 from T2; settlement 70 | Allocate 60 to T1 and 10 to T2. Residual receivable is 30. |
| L06 | T1 and T2 have equal occurred and created times; T1 ID sorts first; settlement 50 | Consume T1 first. Reversing database row order gives the same allocation. |
| L07 | You owe Linh 40; `i_paid_them` settlement 15 | You owe Linh 25. Own spending stays 40. |
| L08 | Net receivable 35; try `they_paid_me` 36 or `i_paid_them` 10 | Reject both and preserve history. A settlement of 35 clears the position. |
| L09 | Linh owes 60; `they_paid_me` 50; edit share to 40 or delete its transaction | Reject because 10 or 50 of the settlement would lack backing. |
| L10 | Same history; edit original share to 70 with a valid full split | Accept. Residual receivable becomes 20 and spending uses the revised own share. |
| L11 | Linh owes 60; settlements 40 then 20; edit first settlement to 50 | Reject because the later settlement can no longer allocate its full 20. |
| L12 | Linh owes 60; `they_paid_me` 50; delete the settlement | Restore receivable to 60 without writing income or an expense. |
| L13 | Linh owes 100; settlement 60; later you owe Linh 80 | Net the remaining 40. You owe Linh 40. Replay the earlier settlement before netting. |
| L14 | Settlement occurs before the expense that would support it | Reject, even when today's aggregate would cover the amount. |
| L15 | Move an expense after its supporting settlement, or change payer/contact | Replay affected histories and reject unsupported settlements atomically. |
| L16 | Soft-delete Linh while she owes you 60 | Keep historical identity and receivable readable, keep settlement available, and exclude Linh from new selection. |

Exact-time transaction and settlement ties, direction reversal, equal timestamps
after correction, no-op corrections, duplicate operation identities, and storage
reopening belong in the downstream verification inventory. A retried operation must
remain distinct from two intentionally different settlements with identical fields.

#### Account, report, and snapshot effects

The v1 settlement is a debt-ledger event only. It does not move bank or cash, write
income, or alter any budget number. This preserves the existing invariant even
though it means the account projection does not automatically record cash received
from a settlement. For example, from 1,000 VND in bank, you paying a 100 VND split
with own share 40 and Linh share 60 leaves the account and carryover at 900, reports
spending of 40, and a receivable of 60. Recording Linh's 60 VND settlement clears the
receivable but leaves the account and budget at 900. It does not turn the settlement
into income or write an automatic adjustment. Use a separate account operation such
as Reconcile when the recorded account must catch up with physical cash.

| Operation | Account effect | Spending and reports | Receivable and snapshot |
| --- | --- | --- | --- |
| You pay a split expense | Deduct the full transaction amount from the selected account. | Charge only your share to spending, category, quality, and burn. | Add contact shares as receivables, subject to replay netting. |
| A contact pays a split expense | No account movement. | Charge your share exactly once. | Add only what you owe that payer. Third-party shares create no claim. |
| Either settlement direction | No account movement. | No expense, income, spending, or burn effect. | Recompute the contact position and `owedToYou`, then publish after commit. |
| Settlement correction or deletion | Same ledger-only account limitation. | No report or budget contribution. | Recompute from effective history. Do not edit a cached balance incrementally. |
| Split amount, payer, participant, or share edit, or split removal | Reproject the revised transaction according to its payer. | Recompute affected own-share reports. | Replay affected contact histories and publish only after commit. |
| Failed mutation | No change. | No change. | No mutation notification or new snapshot. |

For a settlement-only comparison, hold the clock, other ledger rows, reserves, and
horizon fixed. `balanceTotal`, `reservedUnpaid`, `discretionary`, `horizonDate`,
`daysToHorizon`, `perDay`, `runwayDays`, `spentThisMonth`,
`regrettedThisMonth`, and `unloggedDrafts` must remain equal. Only `owedToYou` and
`updatedAt` may change. A date rollover or unrelated mutation is not a settlement
effect.

Read `month_config` from its stored snapshot. Settlements do not contribute to
current-period actual income or alter past opening balances, income totals,
reserves, or horizons. Historical transaction edits can change live reports through
their own-share reads, while stored configuration totals remain frozen.

Transaction, payer, share, and affected-history checks use one atomic mutation
boundary. Publish the snapshot only after commit. A publication failure means the
saved ledger needs refresh; it is not a reason to submit the settlement again. The
widget reads the published snapshot and performs no debt or budget calculation.

---

## 7. Draft inbox

The inbox is a **debt you owe yourself**, and it's the most likely way this app
dies. Design accordingly.

- Presented as a **stack of photos**, not a list of rows. The photo is the memory
  hook — you recognise the purchase before you read anything.
- The count appears on home and on the widget, but *only when non-zero*. A
  permanent "0 unlogged" badge is visual noise that trains you to ignore the spot
  where the real number will appear.
- **Clearing the last draft is a designed moment.** The stack empties, the tilde
  drops off the hero number, and it recounts to its now-exact value. That's the
  reward: your number just became true. No confetti, no badge, no streak — the
  honest number *is* the reward (P2).
- Empty state reads `Nothing to fill in.` and shows the exact balance. It is a
  destination, not an apology.

---

## 8. Month summary

Four charts, each chosen against the obvious wrong answer.

**Spend by category group — ranked horizontal bars.** Not a pie chart. Pies are
bad at the one job this chart has: comparing quantities that are close together.
Rent and Bills will dominate; Food and Coffee will be neck and neck, and that
comparison is the whole point. Bars, sorted descending, single jade hue (this is
magnitude, not identity — one series needs no categorical palette and no legend),
value labelled at the end of each bar, 4px rounded data-ends anchored to a shared
baseline.

Tapping a group expands it into its leaves in place, so "Food ₫2.1m" becomes
Groceries / Eating out / Delivery / Snacks without leaving the screen. This is
where fine-grained categories pay off.

**Quality — one horizontal stacked bar.** need / want / regret across the month's
discretionary spend. 2px gaps between segments, direct labels on any segment over
15%, legend always present. Beneath it, one line, stated flatly:

> `₫340,000 regretted this month.`

No commentary. No emoji. No comparison to last month until there *is* a last month.
That number is the single most valuable output of the entire app and it needs no
help from the copy.

**Cumulative spend against your usual pace.** A running total of discretionary
spend from day 1 to today, drawn against what you normally have spent by that day
of the month.

```
  ┌───────────────────────────────────────┐
  │                            ┈┈┈┈┈ usual│
  │                     ┈┈┈┈┈┈┘           │
  │              ┈┈┈┈┈┈┘   ●  you         │
  │       ┈┈┈┈┈┈┘  ▁▁▁▁▁▁▘                │
  │  ┈┈▁▁▁▁▁▁▁▁▁▁▘                        │
  └───────────────────────────────────────┘
     1          10          20          30

  ₫180,000 above your usual pace by day 14.
```

Cumulative, not daily bars. Daily spending is noisy and the question you are asking
is an accumulation, not a sample. Bars would make you integrate them by eye.

The reference is the median of your previous periods at that same day of the month,
not a straight line from zero to last month's total. A straight line would claim
day 15 should sit at half the month, which is false. Rent lands on one day and
income clusters, so the real curve is a staircase and the comparison has to respect
its shape.

- Your line is jade, 2px, and **stops at today** with an 8px endpoint dot. It is
  never extended forward. Extending it would be a forecast, and runway already owns
  that job with a better method.
- The pace line is a reference rather than a second series, so it takes muted ink
  and a dashed stroke instead of a second hue. One series means no legend box; both
  lines are labelled directly at their right ends.
- Beneath it, one flat line in the same manner as the regret total: `₫180,000 above
  your usual pace by day 14.` Below your pace reads `below`. No arrow, no color, no
  commentary, and no congratulation for being under (P2, P6).
- **Uncertainty is rendered (P3).** With no complete previous period there is no
  pace line and the caption reads `No previous month to compare yet.` With exactly
  one, the reference is labelled with that month's name rather than `usual`, because
  one month is not a habit. `usual` appears at three.
- Drag to scrub a crosshair that reads both values for a day. The gesture enhances
  and never gates: the end labels and the caption carry the values without it.

**The day calendar.** A month grid, one cell per day, tinted by what you spent.

```
  ┌─────────────────────────────────────┐
  │  M    T    W    T    F    S    S    │
  │                                     │
  │  ·    ·    1    2    3    4    5    │
  │            ░    ▒    ░    ▓    ·    │
  │                                     │
  │  6    7    8    9   10   11   12    │
  │  ▒    ░•   ▓    ░    ▒    █    ▒    │
  │                                     │
  │ 13   14   15   16   17   18   19    │
  │  ▒    ▢    ▫    ▫    ▫    ▫    ▫    │
  └─────────────────────────────────────┘

  ·  spent nothing     ░▒▓█  the spend ramp (§3)
  •  income landed     ▢ today          ▫ not yet
```

**The tint is binned against per day, not against the month's own maximum.** Scaling
to the month maximum would make a calm month look as alarming as a bad one and would
make two months incomparable. Binning against per day means the tint answers the
same question the hero number answers, which is whether this day sat above the pace
the app gave you. The four steps are up to 0.5x, up to 1x, up to 2x, and above 2x.

- **Spend only sets the tint.** Income is not a second ramp competing on the same
  cell. It is a rare, irregular event, which is the premise of the whole app, so it
  gets a mark: a small filled dot in the corner. One measure per scale.
- **Nothing is encoded by color alone (§13).** Every cell carries its day number at
  all times, tapping a cell expands that day's transactions in place, and VoiceOver
  reads a cell as a sentence: *"14 September. Spent 240 thousand dong. Income
  4 million dong."*
- Zero-spend days are untinted, and future days are outlines. "Hasn't happened yet"
  and "spent nothing" are different facts and must not share a treatment.
- Today carries a 2px ink ring. Seven columns fit 44pt cells in portrait, so every
  cell already meets the touch target minimum.
- **No streaks, ever.** A grid of tinted squares looks like a contribution graph,
  and that resemblance is the trap. No streak count, no longest-clean-run, no best
  day, no reward for a blank cell. §14 is not suspended because the shape is cute.

**Still no month-over-month trend lines.** Both charts above compare within one
month against your own history, which is a reference, not a trend. A line of one
point per month is different: two data points is not a trend, and a chart that
looks broken for eight weeks teaches you to stop opening that tab.

---

## 9. People & settling

- One row per person: name, net balance, direction. Nothing else.
- Balances are **derived** — never a manually maintained number. The row is
  tappable to show which transactions compose it.
- Settling is a single sheet: an amount (pre-filled with the full balance, freely
  editable for partials) and a date. Two taps for the common case.
- A settled balance goes to `Settled up` in muted ink, not to zero-with-a-checkmark.
- **Nothing here ever animates into the hero number**, because settlements don't
  touch the budget. The visual separation reinforces the accounting rule.

---

## 10. Widget

The widget has one job: answer P1 without unlocking the phone.

- **Small size only** in v1. Hero number, and the unlogged count *only when
  non-zero*.
- The background tint carries the level — subtly jade when there's room, subtly
  amber as the horizon approaches. Ambient state you read without reading.
- **Swaps to runway** when runway drops below days-to-horizon, because at that
  point "how long will this last" has become the more urgent question.
- **Tapping the widget opens capture, not home.** The widget already told you the
  number; the only reason to touch it is to log something.

---

## 11. Tone of voice

The app writes like a calm friend who is good with money and has no opinions about
yours.

| Never | Instead |
|---|---|
| "You overspent!" | "₫40,000 past today's pace." |
| "Great job! 🎉" | *(nothing — silence is the reward)* |
| "You haven't logged in 3 days" | "4 unlogged" |
| "Budget exceeded" | "Over by ₫40,000" |
| "Are you sure you want to delete?" | "Delete this transaction?" |
| "Oops! Something went wrong" | "Couldn't save the photo. Tap to retry." |

Rules: no exclamation marks on anything money-related. No emoji in system copy. No
second person plural, no faux-cheer, no apologising. Errors say what happened and
what to do about it. Every control names its exact outcome, and the confirmation
that follows uses the same verb.

---

## 12. States

**First run.** Three questions on three screens, no carousel, no feature tour:
current bank balance → current cash → rent and bills. Then straight to the capture
screen with the camera already live. Categories are seeded silently in the
background; the user meets them when they first fill in a draft, which is the only
moment they mean anything.

**Over budget.** The calmest screen in the app, not the loudest. The number goes
negative, the label reads `over by ₫40,000`, the level band fills. No red, no
modal, no notification. You already know; being shouted at adds nothing (P2).

**Zero balance.** Runway reads `0 days`. Still no alarm. The design assumption is
that the user's financial situation is not an emergency the app gets to declare.

**Stale data.** If the snapshot is older than an hour, the widget shows its
timestamp in faint ink rather than pretending to be live.

**Cash drift.** Reconcile is presented as routine maintenance, never as a
correction of a mistake. Copy: `What's actually in your wallet?` — not `Fix your
balance`.

---

## 13. Accessibility

- The hero number scales with Dynamic Type all the way up, reflowing the level band
  below it rather than truncating.
- Quality is never encoded by color alone — chips carry labels, chart segments carry
  gaps and direct labels (see §3).
- Every interactive target is at least 44×44pt. The capture button is considerably
  larger and lives in the bottom-right third for right-thumb reach, mirrorable in
  settings.
- VoiceOver reads the hero as a sentence, uncertainty included:
  *"Approximately 166 thousand dong to spend today. 2 transactions unlogged."*
- `prefers-reduced-motion` is honoured everywhere (§4).
- Full functionality with no network, indistinguishable from online.

---

## 14. We will never

- Show a red alarm screen for overspending.
- Use streaks, badges, confetti, or any gamification of logging.
- Put a modal between the user and a saved transaction.
- Require any field at capture time.
- Auto-assign a category or a quality judgment.
- Use a pie chart as a primary report.
- Show a sync spinner that blocks interaction.
- Ship an onboarding carousel.
- Send a notification that isn't the single daily draft nudge.
- Round or abbreviate the hero number.
