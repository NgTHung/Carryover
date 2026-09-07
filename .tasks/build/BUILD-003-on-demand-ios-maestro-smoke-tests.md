---
id: "BUILD-003"
title: "On-demand iOS Maestro smoke tests"
status: "To Do"
priority: "Medium"
type: "TestDebt"
milestone: "0.3.0"
depends_on: ["BUILD-002", "app:UI-001", "app:UI-003"]
risk: "Medium"
impact: "Checks real iOS navigation and persistence without adding a simulator build to every push."
tags: ["testing", "ci", "ios"]
last_updated: "2026-09-07"
---

## Summary

Add a small Maestro smoke suite on a GitHub Actions macOS runner. Build a separate iOS Simulator app with the widget disabled. Run it on demand and against the candidate revision before releases, while fast tests stay local and in Linux CI. Follow docs/app-stack-and-testing.md. Do not add an Android build solely for testing.

## Acceptance Criteria

- [ ] A manually dispatched workflow builds a Simulator .app for the selected revision, boots a compatible iOS Simulator, and runs Maestro against that artifact.
- [ ] The Simulator build excludes the widget, keeps Hermes, and requires no device signing credentials; the unsigned device IPA is not reused as a Simulator artifact.
- [ ] The initial deterministic flows cover startup, navigation, editing a transaction, preserving an unknown draft through restart, and the resulting home snapshot.
- [ ] Fixtures and reset behavior isolate each run; stable accessibility labels or test ids identify controls.
- [ ] Failures upload Maestro logs and screenshots, and the workflow records the tested revision.
- [ ] Maestro runs only when requested and before releases, not on every push; Linux fast checks and normal native build checks remain unchanged.
- [ ] The release checklist requires a passing run for the candidate revision and manual device checks for camera, keyboard, photo access, and later widget behavior.
