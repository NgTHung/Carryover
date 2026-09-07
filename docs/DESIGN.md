# DESIGN.md — Carryover

The design constitution. This document is about what the app *feels* like to use.
It deliberately ignores implementation cost — where a decision here is expensive,
that is a conversation for the build plan, not a reason to weaken the design.

Companion document: the build spec covers data model, engine, and sequencing.
Nothing in this file should be read as a technical constraint.

The design system artifact and the prompts in `design/BRIEF.md` that produced it
are a frozen reference, kept for the visual language they settled. This document
supersedes them wherever the two disagree.

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
earlier design asked for a live remainder that had to reach exactly zero. That is
rejected. It puts arithmetic in front of you at the worst possible moment, and it
lets the form sit in a state you have to repair before Done. Invariant 2 says
shares sum to the amount exactly, so the interface makes that true by construction
instead of checking it afterwards and complaining.

There are no modes. Every share is an editable amount field from the moment the
section opens.

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

- **The payer's share is the balance.** It is the transaction amount minus every
  other share, recomputed on each keystroke. The shares therefore sum exactly no
  matter what is typed, and every remainder dong lands on the payer without a
  special case, which is invariant 3 holding by construction rather than by rule.
- **Typing in the payer's own field is allowed** and means "this is my share". The
  app writes the difference into the other fields, divided by their current
  weights. The last thing you typed always survives. With one other person this is
  the whole interaction: state your share, done.
- **`Equally` and `Shares` are actions, not states.** They compute amounts, write
  them into the fields, and step aside. Nothing locks afterwards. `Shares` reveals
  a small weight stepper per row for "I had two beers", and each step rewrites the
  amounts immediately, so the steppers are a calculator for the fields rather than
  a second way to enter money.
- **No remainder readout, no validation error, no blocked Done.** The split cannot
  be in a wrong state, so there is nothing to warn about.
- **Contacts rank by recency and frequency**, the same rule as the category grid,
  and nothing is preselected except you. `+` opens an inline name field, so
  creating a contact costs one tap exactly like `+ New` does for a category.
- The footer states the consequence in the app's own vocabulary: `You're owed
  ₫300,000` when you paid, `You owe Linh ₫150,000` when someone else did. It is a
  receivable, never a number that moves the hero (§9).

The `Paid by` row depends on `transactions.payer_contact_id`, nullable, where null
means you. The spec carries it.

Alternatives considered and rejected: a drag-to-divide stacked bar, which is the
fastest uneven split but degrades past three people, is fiddly at exact VND, and
needs a typed fallback that amounts to this design anyway; and a your-share-only
field, which is faster still but cannot express unequal debts between two
contacts, trading correctness for speed against the core priority.

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
