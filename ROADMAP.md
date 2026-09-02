# Roadmap

Stages come from `docs/spec/carryover-v1.md` and each depends on the one before it. Weeks assume roughly 10 to 15 hours each. One milestone covers one stage, and `.tasks/` holds the work. Stages 1 and 2 are broken into Feature tasks. Stages 3 to 6 are held at one epic each until the earlier work lands, because daily use from the end of stage 2 will change them.

| Stage | Milestone | Work | Estimate |
| --- | --- | --- | --- |
| 0 | 0.1.0 | Pipeline and widget spike | half a day |
| 1 | 0.2.0 | Ledger: schema, accounts, categories, transaction CRUD | weeks 1 to 4 |
| 2 | 0.3.0 | Budget engine, home screen, commitments, reconcile | weeks 4 to 6 |
| 3 | 0.4.0 | Capture, drafts, fill-in, notification nudge | weeks 6 to 8 |
| 4 | 0.5.0 | Splits, contacts, settlements | weeks 8 to 11 |
| 5 | 0.6.0 | JSON backup and restore | weeks 11 to 12 |
| 6 | 0.7.0 | Paid membership and the widget | weeks 12 to 13 |
| - | - | Buffer | weeks 13 to 16 |

Start using the app daily at the end of stage 2. Real data will change the category list before anything is built on top of it.

Sync across devices is deliberately out of scope for v1. Backup covers the risk that matters now, which is losing the phone. Revisit sync when a second device or another person becomes real.
