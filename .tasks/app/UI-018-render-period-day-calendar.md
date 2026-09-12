---
id: "UI-018"
title: "Render period day calendar"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "UI-005"
milestone: "0.3.0"
depends_on: ["UI-016", "UI-007"]
risk: "Medium"
impact: "Shows untinted, tinted, future, and income-marked days with accessible transaction expansion without turning a spending calendar into a streak game."
tags: ["reports", "charts"]
last_updated: "2026-09-12"
---

## Summary

Render the seven-column day calendar, income marks, spend ramp, future outlines, and in-place transaction details.

## Acceptance Criteria

- [ ] Every day shows its number, uses the four spend-ramp tokens against per day, distinguishes zero spend from future days, and marks today.
- [ ] Income uses a corner mark and never competes with spend tint; transfers, adjustments, and settlements remain absent.
- [ ] Tapping a day expands that day's own-share and income details, including explicit unknown drafts, and VoiceOver receives a sentence.
- [ ] Component tests prove calendar alignment, tint boundaries, expansion, accessibility, and absence of streak or reward copy.
