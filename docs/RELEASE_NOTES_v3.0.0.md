# ASANYA v3.0.0 Release Notes

- Product Version: v3.0.0
- Schema Version: 3.0
- Release date: 2026-09-06
- Known Issues: none

## PBL-030 — Continuous Due-Move Follow

- Added continuous vertical follow after Due-driven FLIP movement.
- Preserved selection, Task Detail state, Project horizontal scroll, and user interruption behavior.

## PBL-027 — End and Reopen Animation

- Added clear state-change feedback before completed tasks leave the active view and when they re-enter.
- Preserved ToDo column geometry and Project/Gantt alignment throughout the animation.

## PBL-021 — Simplified Child-Task Creation

- Simplified the child-task add UI and aligned same-level and child drafts with their hierarchy context.
- Preserved keyboard creation flows and compact title controls across ToDo and Project views.

## PBL-022 — Recurrence Schedule Separation

- Separated the current Due date from the recurrence schedule date.
- Added deterministic migration from Schema 2.5 to Schema 3.0 without changing established recurrence patterns.
- Preserved hierarchy rollover, Undo/Redo, Calendar, Due shortcut, and Gantt due-marker behavior.

## PBL-018 — Contextual Help

- Added contextual Help in the top header with current shortcuts and interaction guidance.
- Finalized the Help trigger position at the far right without interfering with existing controls.

## Validation

- Human QA: ALL OK
- Integrated Full regression on the validated cumulative candidate: 725 PASS / 0 FAIL / 0 SKIP
- Full-regression test files: 73
- Formal artifact representative verification: 78 PASS / 0 FAIL / 0 SKIP
- Intentional exclusions: 0

## Compatibility

- Schema change: 2.5 to 3.0
- Schema Version: 3.0
- Migration: deterministic initialization of recurrence schedule data for older supported databases
- Production/shared JSON: untouched
- Known Issues: none

## Artifact

- File: `asanya_task_manager_v300.html`
- SHA-256: `1AB306007CE0F0F896E86316FDFAA1D324D25B8FAAEE1CF3C4AC268C102FA18D`
