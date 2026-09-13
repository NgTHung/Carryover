---
id: "BUILD-006"
title: "Cache and measure iOS native compilation"
status: In Progress
priority: "High"
type: "TechDebt"
milestone: "0.1.0"
depends_on: ["build:BUILD-001"]
risk: "Medium"
tags: ["build", "ci"]
last_updated: 2026-09-13
---

## Summary

Each fresh macOS runner recompiles hundreds of native dependency files. Persist compiler results, install pods once, report build timings, and audit native dependencies by app variant so you can reduce build time without changing ledger or widget behavior.

## Acceptance Criteria

- [ ] CI enables Ccache before pod installation, restores and saves its cache outside generated ios output, and separates incompatible toolchains and build variants.
- [ ] Each build installs pods once and preserves native patch and entitlement handling.
- [ ] Build logs and the job summary retain Xcode timing and per-build Ccache statistics, including when compilation fails.
- [ ] The native dependency audit documents required widget storage dependencies and excludes development-only pods from release when safe, with variant checks.
- [ ] Local workflow, configuration, typecheck, and test checks pass.
- [ ] GitHub Actions produces release and development IPAs and a second release build records cache hits and measured timing against the cold build.
