---
id: "WIDGET-005"
title: "Verify widget refresh on the iPhone"
status: "To Do"
priority: "Medium"
type: "TestDebt"
parent: "build:WIDGET-002"
milestone: "0.7.0"
depends_on: ["build:WIDGET-004"]
last_updated: "2026-09-13"
---

## Summary

Check real widget lifecycle behavior because local fixtures cannot prove refresh delivery or shared-container access.

## Acceptance Criteria

- [ ] Record the candidate revision and device evidence for app mutations, draft completion, settlements, restore, and foreground refresh updating the shared snapshot.
- [ ] Period or day rollover, an unopened app, and widget removal or re-addition have documented behavior with no falsely current figures.
- [ ] Resolve any refresh gap through the existing snapshot pipeline, with tests for changed logic and no second budget implementation.
- [ ] Both widget-enabled and ordinary unsigned IPA builds pass, and installed Home and widget values agree for the recorded cases.
