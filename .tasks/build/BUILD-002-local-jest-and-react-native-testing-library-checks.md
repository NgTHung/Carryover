---
id: "BUILD-002"
title: "Local Jest and React Native Testing Library checks"
status: Done
priority: "High"
type: "TestDebt"
milestone: "0.2.0"
depends_on: ["BUILD-001"]
risk: "Medium"
impact: "Lets you verify money, storage, and component behavior on Linux before paying for an iOS build."
tags: ["testing", "ci"]
last_updated: 2026-09-07
---

## Summary

Adopt Jest for logic and database tests and jest-expo with React Native Testing Library for component tests. Preserve the existing real SQLite migration coverage while replacing the node:test runner. Keep every test under tests/. Follow docs/app-stack-and-testing.md. This task sets up local and Linux CI checks; BUILD-003 owns iOS end-to-end execution.

## Acceptance Criteria

- [x] Jest has separate configurations for pure logic and real SQLite tests in Node, and React Native component tests with jest-expo and @testing-library/react-native.
- [x] The existing six schema tests migrate without losing their assertions or replacing real SQLite with mocks; DATA-001 still owns its open review fixes.
- [x] npm test runs all fast suites locally on Linux without Xcode, a simulator, a device, a native build, or the widget runtime.
- [x] A representative component interaction and loading/error behavior are tested; native APIs are mocked only at component-test boundaries.
- [x] All tests remain under tests/, outside Expo Router route directories; watch and focused-test commands are documented.
- [x] Linux CI runs typechecking and the same fast suites before the macOS build; existing native build triggers and widget exclusion are preserved.
