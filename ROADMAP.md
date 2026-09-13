# Roadmap

Finish v1 functionality before overhauling presentation. The scope comes from docs/spec/carryover-v1.md; .tasks/ holds executable work and dependencies. Daily use informs changes but does not impose a waiting period before capture or later features.

Functional work includes usable controls, reachable routes, errors, cancellation, accessibility basics, and persistence. Reuse the current shared UI while adding those capabilities. The visual direction, layout refinement, typography, and motion overhaul follow functional verification.

BUILD-003 is deferred. No stage depends on automated iOS end-to-end tests. Fast automated checks, an unsigned device build, and manual checks on the iPhone are the release path.

| Stage | Milestone | Remaining work | Tasks |
| --- | --- | --- | --- |
| 0 | 0.1.0 | Reconcile pipeline and widget spike evidence with the release checklist | MILESTONE-001 |
| 1 | 0.2.0 | Finish development-app device checks and verify ledger controls | BUILD-004, MILESTONE-002 |
| 2 | 0.3.0 | Manual expense and income creation, commitments and payments, horizon editing, transfers, account details | UI-020 to UI-024 |
| 3 | 0.4.0 | Durable photos, capture, draft completion, inbox, daily nudge | CAPTURE-002 to CAPTURE-006 under CAPTURE-001 |
| 4 | 0.5.0 | Boundary contract, contacts, share arithmetic, atomic writes, derived balances, settlements, People | SPLIT-002 to SPLIT-008 under SPLIT-001 |
| 5 | 0.6.0 | Versioned JSON export, validated atomic restore, phone controls, separate photo export | DATA-011 to DATA-014 under DATA-008 |
| 6 | 0.7.0 | Signing and stale-render resolution, snapshot rendering, device refresh checks | WIDGET-003 to WIDGET-005 under WIDGET-002 |
| 7 | 0.8.0 | Verify every v1 flow and all nine invariants on the candidate | BUILD-005, MILESTONE-008 |
| 8 | 0.9.0 | UI overhaul across the completed app and widget | UI-026 to UI-032 and WIDGET-006 under UI-025 |

## Next work

Start with app:UI-020 so you can create expense and income transactions without a photo. The existing transaction screen edits saved transactions but has no creation flow. UI-021 then connects reserve payments to that flow. UI-022, UI-023, and UI-024 can proceed once their existing data dependencies are satisfied.

BUILD-004 still needs signed iPhone installation, Fast Refresh, and ledger isolation checks. Its recorded CI build is already complete. These checks can accompany functional development.

Each epic now has child tasks. Use taskroot ready to select a ready task, and close each epic only after its children and device criteria have evidence. Parent membership alone does not replace a child's explicit dependencies.

## Functional completion

Milestone 0.8.0 requires the ledger controls, capture, splits, backup, and widget to be complete. BUILD-005 records the tested revision and exercises the whole app, including offline use, restart recovery, permissions, editable history, period rollover, and snapshot refresh. It also reconciles earlier milestone checklists with evidence.

Keep money tests with every functional change. Keep required native builds green. Split implementation into reviewable commits within AGENTS.md size guidance, refining a task before expanding its scope. A passing task validator does not prove functionality.

## UI overhaul

UI-025 and its first design task depend on completed functional verification and milestone 0.8.0. UI-026 reviews the working flows and revises docs/DESIGN.md with screen previews and a state inventory. UI-027 updates shared tokens and controls before screen work begins.

UI-028 covers navigation and Home. UI-029 covers capture and drafts. UI-030 covers transactions and reports. UI-031 covers People and Settings. WIDGET-006 applies the final visual design in the separate widget runtime. UI-032 checks the result on the iPhone with larger text, VoiceOver, reduced motion, keyboard access, and a repeat of the functional scenarios.

Existing functional contracts remain in force during the overhaul. Presentation changes must not alter money arithmetic, stored history, capture persistence, or snapshot ownership.

Sync across devices is deliberately out of scope for v1. Backup covers the risk that matters now, which is losing the phone. Revisit sync when a second device or another person becomes real.
