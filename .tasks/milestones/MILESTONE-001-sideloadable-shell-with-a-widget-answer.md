---
id: "MILESTONE-001"
title: "Sideloadable shell with a widget answer"
status: In Progress
priority: "High"
type: "Milestone"
milestone: "0.1.0"
last_updated: 2026-09-01
---

## Summary

Stage 0. Prove that a Mac-free pipeline puts a running app on the phone, and settle whether a sideloaded IPA can carry a working home screen widget. No product code is in scope. The widget question gates the roadmap: the spec assumes a widget is reachable, and if a free Apple account cannot provision the App Group the paid membership moves earlier than stage 6.

## Exit Criteria

- [ ] A GitHub Actions macOS runner produces an unsigned IPA on every push without any signing secret in the repository.
- [ ] Both the widget and no-widget variants build, so a failure can be attributed to the widget extension rather than the pipeline.
- [ ] The IPA installs by sideload and the app launches on the phone.
- [ ] docs/build/widget-sideload-result.md records whether the widget installs and whether it receives pushed data, with the signing tool and account type.
- [ ] The result names what changes in the roadmap, in particular whether the paid membership moves earlier.
