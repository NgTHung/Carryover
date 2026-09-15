---
id: "UI-034"
title: "Fix transfer route recovery"
status: In Progress
priority: "Medium"
type: "Bug"
milestone: "0.3.0"
depends_on: ["app:UI-023"]
risk: "Medium"
impact: "Stale account and route state can submit an unavailable transfer or show details for the wrong link, while successful saves can duplicate Accounts in navigation history."
tags: ["ui", "accounts"]
last_updated: 2026-09-15
---

## Summary

Correct transfer creation and detail navigation after the UI-023 review.

## Acceptance Criteria

- [ ] Successful creation returns to the existing Accounts route without leaving duplicate Accounts screens in history.
- [ ] Account refreshes replace stale account choices and block transfer submission when a selected account becomes unavailable.
- [ ] Transfer detail ignores obsolete reads after its route parameter changes, including changes to an invalid link.
- [ ] Component tests cover all three recovery cases.
