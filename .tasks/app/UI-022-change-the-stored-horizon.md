---
id: "UI-022"
title: "Change the stored horizon"
status: "To Do"
priority: "Medium"
type: "Feature"
milestone: "0.3.0"
depends_on: ["app:DATA-005", "app:UI-003"]
last_updated: "2026-09-13"
---

## Summary

You need to move the horizon when you know money is arriving. Expose the existing month config operation without computing figures in the form.

## Acceptance Criteria

- [ ] Home shows the stored horizon and opens a date editor that saves through the month config API.
- [ ] The editor enforces existing date and period rules, preserves input on failure, and leaves storage unchanged on cancellation.
- [ ] Saving refreshes the published snapshot; unrelated historical snapshots remain unchanged.
- [ ] Database and component tests cover valid changes, rejected dates, period boundaries, and per day read from the resulting snapshot.
