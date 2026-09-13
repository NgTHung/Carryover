---
id: "SPLIT-003"
title: "Persist and manage local contacts"
status: "To Do"
priority: "Medium"
type: "Feature"
parent: "app:SPLIT-001"
milestone: "0.5.0"
depends_on: ["app:SPLIT-002"]
last_updated: "2026-09-13"
---

## Summary

Use the existing contact table so you can select people without accounts or network access.

## Acceptance Criteria

- [ ] Validated APIs create, rename, list, and soft-delete local contacts with UUIDs and nullable user_id.
- [ ] Referenced contacts remain readable in historical splits and settlements; deletion cannot erase an outstanding balance.
- [ ] Selection supports search, recency and frequency ranking, and inline creation, with only you initially selected.
- [ ] Database tests cover references, deleted contacts, duplicate names as distinct ids, and deterministic ranking.
