# Task Tracking

The `.tasks/` directory stores Carryover development work as markdown files with YAML frontmatter. `taskroot` validates metadata, links, criteria sections, prefixes, and rule references so task state stays useful as the roadmap changes.

This guide describes how to drive `taskroot`. The [task project contract](task-project-contract.md) defines the identity, configuration, and validation rules the tool enforces. Carryover ships an explicit `.tasks/config.json`, so the compatibility profile described in the contract does not apply here.

Use these commands before and after task changes:

```bash
taskroot validate
taskroot validate --format json
taskroot list
taskroot summary
taskroot list --format json
```

## Project Discovery

`taskroot` starts at your current working directory and selects the nearest
ancestor that directly contains a `.tasks` directory. You can run commands from
the project root or any nested path. A nested project takes precedence over an
outer project.

Use `--root <path>` on any command to start discovery somewhere else. Relative
paths resolve from your current working directory, and the path may point to a
project root, a nested directory, or an existing file inside the project.

```bash
taskroot list --root ../another-project/src --format json
taskroot validate --root C:\work\another-project
```

The `.tasks` directory alone marks a project. It does not need
`task.schema.json`. Discovery does not inspect task contents, so malformed task
files produce validation errors for the nearest project instead of causing a
search for an outer project.

If no `.tasks` directory exists at or above the starting path, the command exits
unsuccessfully and reports both the searched path and the required `.tasks`
directory.

Create a new project with `init`. The command fails if the target already has a
`.tasks` directory. It writes `.tasks/config.json` and leaves domain directories
absent until the first task is added.

```bash
taskroot init --root C:\work\new-project --domain work --prefix WORK
taskroot init --root ../new-project --domain work --prefix WORK,BUG
```

## Project Configuration

`taskroot` loads `.tasks/config.json` once after project discovery and before
it reads or writes task files. The file must use version 1. Every object is
strict. Unknown fields, nulls, duplicate keys or list values, empty required
collections, invalid portable names, conflicting milestone roles, and invalid
tag policy combinations stop the command. JSON syntax errors report the file,
line, and column.

A minimal single-domain policy looks like this:

```json
{
  "version": 1,
  "domains": {
    "work": {
      "prefixes": ["WORK"]
    }
  },
  "task_types": {
    "Feature": {
      "criteria": "acceptance"
    }
  },
  "tags": {
    "policy": "open"
  }
}
```

This example defines separate domain prefixes, custom checklist behavior, one
milestone role, and a strict tag catalog:

```json
{
  "version": 1,
  "domains": {
    "backend": {
      "prefixes": ["API", "WORK"]
    },
    "release": {
      "prefixes": ["REL", "WORK"]
    }
  },
  "task_types": {
    "Feature": {
      "criteria": "acceptance"
    },
    "Container": {
      "criteria": "exit"
    },
    "ReleaseGate": {
      "criteria": "exit",
      "role": "milestone"
    }
  },
  "tags": {
    "policy": "strict",
    "allowed": ["backend", "needs-triage", "ready-for-agent", "release"],
    "exclusive_groups": {
      "triage-state": ["needs-triage", "ready-for-agent"]
    }
  }
}
```

`exclusive_groups` is optional and requires a strict tag policy. Every group
member must appear in `allowed`. A task may carry zero or one tag from each
group. Validation rejects conflicting group members on stored tasks, direct
creation, imports, and edits.

When `config.json` is absent, Filer uses a fixed compatibility policy. It
defines the `core`, `app`, `ecosystem`, and `milestones` domains with the
prefixes listed in [Prefixes](#prefixes). `Milestone` and `Epic` use exit
criteria, `Milestone` carries the milestone role, and every other built-in type
uses acceptance criteria. Tags are open. A present configuration replaces this
whole policy. It does not inherit compatibility values or define an implicit
domain.

Library callers open an explicit root. Discovery stays a separate host or CLI
step:

```rust
use taskroot::project::{CriteriaPolicy, TaskProject};

let project = TaskProject::open(root)?;
let policy = project.policy();
let feature = policy.task_type("Feature");
assert_eq!(feature.map(|value| value.criteria()), Some(CriteriaPolicy::Acceptance));
# Ok::<(), taskroot::error::TaskError>(())
```

`TaskProject` owns the canonical root and its immutable `ProjectPolicy`.
Opening two roots produces independent policies. Configuration errors expose a
stable code and structured context through `TaskError::code` and
`TaskError::context`.

## Task Files

Each domain in project configuration maps to one direct child directory under
`.tasks`. The `default` name is an ordinary domain. Commands do not select it
when you omit a domain. When configuration is absent, the compatibility policy
keeps `.tasks/core`, `.tasks/app`, `.tasks/ecosystem`, and `.tasks/milestones`
readable.

File names must start with the task ID:

```text
.tasks/core/CORE-001-location-routing.md
.tasks/default/WORK-001-first-task.md
.tasks/milestones/MILESTONE-003-core-contract-stabilization.md
```

Every task uses frontmatter followed by markdown body sections:

```yaml
---
id: CORE-001
title: Location routing
status: To Do
priority: High
type: Feature
parent: CORE-000
milestone: "0.3.0"
depends_on: [CORE-000]
rules: [CORE-LIBRARY, PROVIDER-ACCESS]
risk: High
impact: Touches public command and event routing.
tags: [core, location]
last_updated: 2026-06-05
---
```

Milestone tasks are project references, not domain-local IDs. In Filer's policy, a milestone file uses the `MILESTONE` prefix and stores the shared milestone value in `milestone`:

```yaml
---
id: MILESTONE-003
title: Core contract stabilization
status: In Progress
priority: High
type: Milestone
milestone: "0.3.0"
last_updated: 2026-06-05
---
```

```markdown
## Summary

Explain why this work exists and what outcome it should produce.

## Acceptance Criteria

- [ ] Location routing accepts reconstructable references.
- [ ] Unsupported provider routes return structured errors.
- [ ] Tests cover direct local and unsupported routes.
```

## Frontmatter

Required fields:

| Field | Values |
| --- | --- |
| `id` | `PREFIX-NUMBER`, for example `CORE-001` |
| `title` | At least 5 characters |
| `status` | `To Do`, `In Progress`, `Blocked`, `Done`, `Deferred`, `Obsolete` |
| `priority` | `High`, `Medium`, `Low` |
| `type` | A name declared in `task_types`; compatibility names are `Milestone`, `Epic`, `Feature`, `Bug`, `Refactor`, `TechDebt`, `TestDebt`, `Design`, `Docs` |

Status and type are separate. Status records lifecycle state. Type classifies the work and selects its criteria heading. A configured project accepts the names in `task_types`; a compatibility project accepts the nine built-in names shown in the table. `Deferred` and `Obsolete` are statuses, not task types. They require `## Rationale` and may omit criteria. `Blocked` is also a status; it requires `## Blocked Reason` in addition to the criteria selected by the task type.

Task type values are stored and emitted as strings. You can add a type in configuration without recompiling `taskroot`. The type's `criteria` value selects `## Acceptance Criteria` or `## Exit Criteria`. The optional `milestone` role, not the type name or directory, enables milestone validation, readiness blocking, context relations, and milestone commands.

Optional fields:

| Field | Purpose |
| --- | --- |
| `parent` | Same-domain local ID or cross-domain qualified parent identity |
| `milestone` | Project milestone value, for example `0.3.0` |
| `depends_on` | Same-domain local IDs or qualified task identities that must not form cycles |
| `rules` | Architecture rule IDs from `docs/architecture/invariants.md` |
| `risk` | `High`, `Medium`, or `Low` |
| `impact` | Short description of what the work can affect |
| `tags` | Query labels |
| `whitepaper` | Design reference |
| `last_updated` | `YYYY-MM-DD` |

## Criteria Sections

Criteria stay in the markdown body because they are human work instructions, not query metadata.

Types configured with `"criteria": "exit"` must include:

```markdown
## Exit Criteria
```

Types configured with `"criteria": "acceptance"` must include the following section unless their status is `Deferred` or `Obsolete`:

```markdown
## Acceptance Criteria
```

Tasks whose status is `Deferred` or `Obsolete` may omit criteria, but they must include:

```markdown
## Rationale
```

`Blocked` tasks must include:

```markdown
## Blocked Reason
```

`Done` tasks must not have unchecked checklist items in `## Acceptance Criteria` or `## Exit Criteria`.

## Prefixes

Every domain declares its allowed ID prefixes. A prefix may appear in more than one domain, but each task is checked against its own domain. Compatibility projects use the following fixed prefixes:

Core prefixes:

`CORE`, `ACTORS`, `API`, `MODULES`, `PIPELINE`, `SERVICES`, `UTILS`, `VFS`, `REL`, `NAV`, `SEARCH`, `OPS`, `PREVIEW`, `PROVIDER`, `PROTOCOL`

App prefixes:

`UI`, `EXPL`, `SETS`, `SRCH`, `MEDIA`, `NAV`, `PERF`, `A11Y`

Ecosystem prefixes:

`PLUG`, `EXT`, `THEME`, `PROFILE`, `PROVIDER`

Milestone prefixes:

`MILESTONE`, only under `.tasks/milestones`

## Validation

`taskroot validate` checks:

- YAML frontmatter parses into the strict task model.
- Task IDs use `PREFIX-NUMBER`; relationship references use local IDs or `domain:LOCAL-ID`.
- File names start with the task ID.
- The task ID prefix is allowed by its configured domain.
- The task type exists and its configured criteria section is present.
- Tags use portable lowercase syntax and satisfy the open or strict tag policy.
- Parent tasks exist.
- Every milestone-role task has a non-empty milestone value and milestone values are unique project-wide.
- Every task milestone matches exactly one milestone-role task across all domains.
- Dependencies exist, do not duplicate IDs, do not reference self, and do not form cycles.
- Rule IDs exist in `docs/architecture/invariants.md`.
- `last_updated` is a real `YYYY-MM-DD` date.
- `impact` has useful content when present.
- Required criteria, blocked reason, or rationale sections exist.
- `Done` tasks have no unchecked criteria items.

Local `parent` and `depends_on` values resolve in the task's own domain. Use
`domain:LOCAL-ID` for a cross-domain relationship. Compatibility projects also
accept a legacy local reference when it has one project-wide match outside the
source domain. Validation reports this fallback as a
`legacy_global_reference` warning. Multiple project-wide matches are
ambiguous and fail validation.

Taxonomy failures remain machine-readable. Direct add, import, ready, and list preflight return `unknown_type`, `tag_rejected`, or `prefix_not_allowed`. Stored-task validation returns `validation_failed`; each entry in `context.issues` keeps the original reason code, rejected value, field, domain, task identity, allowed values, and project root.

Use this order when changing taxonomy:

1. Inventory every domain, prefix, type, milestone binding, and tag in the existing task files.
2. Add a configuration that accepts the current repository without changing task files.
3. Run `taskroot validate` and resolve every taxonomy issue.
4. Update task files and configuration together for the intended rename or restriction.
5. Validate again before removing old prefixes, types, or tags from configuration.

This sequence keeps reads and writes available during migration. A present configuration replaces the compatibility profile, so adding a partial configuration before the inventory step can make existing tasks invalid.

## Workflow

Create tasks when work introduces a feature, capability, significant refactor, architectural bug fix, or whitepaper implementation. Do not create tasks for routine formatting, trivial fixes, existing-doc edits, or dependency bumps.

When starting work, move the task to `In Progress`. When complete, verify the implementation, tests, and criteria before marking it `Done`. Use `Blocked` only when progress depends on a missing decision, external state, or unresolved dependency. Use `Deferred` or `Obsolete` with a clear rationale so future readers know why the work is not active.

Commands that select one task require its exact `domain:LOCAL-ID` identity.
This applies to `show`, `context`, `deps`, every lifecycle command, and the
`list --parent` filter. An unqualified selector fails and lists matching
qualified candidates.

List focused task sets with filters:

```bash
taskroot list --status "In Progress"
taskroot list --priority High
taskroot list --domain core
taskroot list --parent core:CORE-000
taskroot list --tag location
taskroot list --milestone 0.3.0
taskroot list --blocked
```

Use JSON output when another tool needs structured data:

```bash
taskroot list --format json
```

### Triage tags

Filer defines `triage-category` and `triage-state` as exclusive tag groups.
Triage tags classify work without replacing its lifecycle `status`.

Set or clear one group through the CLI. The command removes the previous value
from that group, preserves unrelated tags, validates the result, and writes the
task atomically:

```bash
taskroot tag set core:CORE-042 triage-category enhancement
taskroot tag set core:CORE-042 triage-state ready-for-agent
taskroot tag clear core:CORE-042 triage-state
```

Use `list` to inspect a triage queue. Use `ready` when you need triaged tasks
that also satisfy Filer's lifecycle, dependency, hierarchy, and milestone
rules:

```bash
taskroot list --tag needs-triage
taskroot ready --tag ready-for-agent --format json
```

## Agent Workflow

Use `ready` to select executable work. A ready task is `To Do`, is not a milestone, has no child tasks, has only `Done` dependencies, and has only `To Do` or `In Progress` ancestors. Results sort by priority and then qualified identity.

```bash
taskroot ready
taskroot ready --domain core --milestone 0.3.0 --limit 5
taskroot ready --tag provider --format json
```

Use `show` when you need one task's full metadata and body sections:

```bash
taskroot show core:PROVIDER-001
taskroot show core:PROVIDER-001 --format json
```

Use `context` before implementation. It returns the target task, readiness blockers, direct task relationships, the root-first `ancestors` chain, milestone, referenced architecture rule text, and whitepaper path. It does not infer source files.

```bash
taskroot context core:PROVIDER-001
taskroot context core:PROVIDER-001 --format json
```

The `show`, `ready`, and `context` JSON envelopes use `schema_version: 2` and
include validation warnings. Every task object retains its local `id` and
`domain`, and adds `qualified_id` as its canonical key. Parent, dependency,
relation, and readiness blocker identities in these envelopes are qualified.

Unversioned task-array JSON from `list`, `deps`, and milestone views also adds
`qualified_id`. This is a semantic break for consumers that used local `id` as
a project-wide key. Key tasks by `qualified_id`, or by the `domain` and `id`
pair.

An agent should use this sequence:

```bash
taskroot ready --limit 5 --format json
taskroot context core:PROVIDER-001 --format json
taskroot start core:PROVIDER-001
# Implement and test the task.
taskroot validate
taskroot done core:PROVIDER-001
```

Inspect dependencies that still need work:

```bash
taskroot deps --incomplete core:CORE-042
taskroot deps --incomplete core:CORE-042 --format json
```

Inspect milestone exit criteria and progress:

```bash
taskroot milestone 0.3.0 --exit-checklist
taskroot milestone 0.3.0 --exit-checklist --format json
```

Generate progress summaries:

```bash
taskroot summary
taskroot summary --milestone 0.3.0
taskroot summary --format json
```

Use lifecycle commands to keep status and rationale sections consistent:

```bash
taskroot add --id core:CORE-042 --title "Provider timeout propagation" --priority High --type Feature --milestone 0.3.0
taskroot add --domain core --id CORE-043 --title "Cache policy" --priority High --type Feature
taskroot add --domain milestones --id MILESTONE-003 --title "Core contract stabilization" --priority High --type Milestone --milestone 0.3.0
taskroot start core:CORE-042
taskroot done core:CORE-042
taskroot criterion-toggle core:CORE-042 0
taskroot block core:CORE-042 "Waiting for provider timeout policy decision."
taskroot defer core:CORE-042 "No longer needed for the current milestone."
taskroot obsolete core:CORE-042 "Replaced by core:CORE-044."
```

`add` accepts either `--id domain:LOCAL-ID` or an unqualified `--id` with an
explicit `--domain`. A matching domain in both inputs is valid. Conflicting
domains fail, and an unqualified ID without `--domain` never falls back to
`default`.

Successful human output uses the same headings, labels, and path format across commands. Paths are relative to the repository and use `/` separators:

```text
Task Started
Task: core:CORE-042
Path: .tasks/core/CORE-042-provider-timeout-propagation.md
```

Validation and imports use labeled summaries:

```text
Validation
Status: Passed
Tasks: 23
Warnings: 0
```

```text
Import
Mode: Dry Run
Tasks: 2

Paths
.tasks/milestones/MILESTONE-003-core-contract-stabilization.md
.tasks/core/CORE-042-provider-timeout-propagation.md
```

`add` can scaffold richer task files when a migration already knows the metadata:

```bash
taskroot add --domain core --id CORE-042 --title "Provider timeout propagation" --priority High --type Feature --parent milestones:MILESTONE-003 --milestone 0.3.0 --rule PROVIDER-ACCESS --risk High --impact "Touches provider calls and cancellation behavior." --tag provider --summary "Propagate provider deadlines through core calls." --criterion "Provider calls receive timeout context."
```

Use `--criterion` for open checklist items and `--checked-criterion` when creating a `Done` task with completed criteria. `Blocked` tasks need `--blocked-reason`. `Deferred` and `Obsolete` tasks need `--rationale`.

Use `criterion-toggle` to flip one zero-based checklist item in the criteria
section selected by the task type:

```bash
taskroot criterion-toggle core:CORE-042 0
```

## Batch Import

Use `import` when migrating curated roadmap items into `.tasks/` without writing each markdown file by hand. The input is JSON and uses the same field names as task frontmatter, plus `summary`, `criteria`, `rationale`, and `blocked_reason` for body sections:

```json
[
  {
    "domain": "milestones",
    "id": "MILESTONE-003",
    "title": "Core contract stabilization",
    "priority": "High",
    "type": "Milestone",
    "milestone": "0.3.0",
    "criteria": [{ "text": "Public contracts are named consistently." }]
  },
  {
    "domain": "core",
    "id": "CORE-042",
    "title": "Provider timeout propagation",
    "priority": "High",
    "type": "Feature",
    "parent": "milestones:MILESTONE-003",
    "milestone": "0.3.0",
    "rules": ["PROVIDER-ACCESS"],
    "risk": "High",
    "impact": "Touches provider calls and cancellation behavior.",
    "tags": ["provider"],
    "summary": "Propagate provider deadlines through core calls.",
    "criteria": [{ "text": "Provider calls receive timeout context." }]
  }
]
```

Validate the batch before writing:

```bash
taskroot import docs/roadmap-migration.tasks.json --dry-run
```

Write the batch once dry run passes:

```bash
taskroot import docs/roadmap-migration.tasks.json
```

Use `--skip-existing` for reruns after a partial manual migration. Import validates the whole batch before writing files, including parent, dependency, milestone, and rule references.

Creation never uses compatibility fallback. An unqualified parent or dependency
must exist in the new task's explicit domain. Qualified inputs may reference
any configured domain and are stored in canonical `domain:LOCAL-ID` form.
