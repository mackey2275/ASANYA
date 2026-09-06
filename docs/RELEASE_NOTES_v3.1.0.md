# ASANYA v3.1.0 Release Notes

- Product Version: v3.1.0
- Schema Version: 3.1
- Release date: 2026-09-07
- Known Issues: none
- Deferred Follow-ups: none

## PBL-033 — ToDo Hierarchy Collapse / Expand

- Added recursive hierarchy collapse and expand in ToDo views while preserving nested manual collapse state.
- Added the associated Task Detail toggle correction so repeated and cross-task Detail actions use the established shared path.
- Preserved filtering, search reveal, selection, child creation, reparenting, and lifecycle behavior.

## PBL-034 — Project Memo Status and Schema 3.1

- Added the Project status `メモ` with hierarchy-safe, dependency-safe, recurrence-safe, and completion-safe behavior.
- Advanced the schema from 3.0 to 3.1 with validated migration and future-schema rejection.
- Preserved user data, workspace information, persistence safeguards, and established Project/ToDo behavior.

## PBL-035 — Project New-Task Flow

- Simplified Project task creation to `Title → Due → finish` for root tasks, child tasks, and Memo tasks.
- Preserved blank-Due semantics, existing Due editing, IME input, and single-transaction Undo/Redo behavior.

## PBL-036 — Project Hierarchy Collapse / Expand

- Added recursive collapse and expand across Project Detail and Project Simple while keeping ToDo collapse state independent.
- Preserved filtering, search reveal, selection, Task Detail, child creation, reparenting, recurrence, and scroll behavior.
- Resolved the Undo/Redo collapsed-ancestor visibility Follow-ups before release; the final behavior was validated by Human QA and formal regression.

## PBL-037 — Impact Level 3 Visual Contract

- Displays Impact Level 3 stars in semantic red across ToDo, Project Detail, Project Simple, Memo, and Task Detail.
- Preserves Level 2 presentation, persistence shape, and history behavior.

## PBL-038 — Task Detail Pane Horizontal Drag

- Added horizontal-only Task Detail Pane drag for desktop/wide layouts.
- Position is runtime-only and is not persisted.
- Narrow layouts disable dragging; vertical movement is not supported.

## Corrected Native Japanese IME Due Handling

- Preserved the established native Japanese IME Due shortcut flow across no-sort and sort-moving cases.
- Validated composition lifecycle, single commit, viewport stability, invalidation, and Undo/Redo behavior.

## Validation

- Human QA: ALL OK for PBL-033, PBL-034, corrected IME Due hotfix, PBL-035, PBL-036 main and all Follow-ups, PBL-037, and PBL-038.
- Validated RC formal inventory: 80 files / 803 tests.
- Integrated Full regression on the validated RC: 803 PASS / 0 FAIL / 0 SKIP.
- Full execution: one fresh `run-all-tests.ps1` process, one worker, explicit frozen candidate target.
- Formal fingerprint across the final Full: `DAE6AC82C2D34D8EFBEE19A50B2A50027C0485DB5D2796CD7E760707D50DD1E8`.
- Intentional exclusions: 0.
- Formal artifact representative verification: 123 PASS / 0 FAIL / 0 SKIP across 11 files.
- Representative target: `/asanya_task_manager_v310.html`.
- Representative duration: `00:03:15.268`.
- The formal artifact is an exact byte-for-byte copy of the validated RC. The Full regression and Human QA were therefore not repeated after formalization.

### Release-boundary formal normalization history

- The first Full exposed obsolete v3.1 identity/schema expectations; formal expectations were normalized, followed by 10/10 Focused and 46/46 Relevant PASS.
- The second Full completed 786 PASS / 17 FAIL / 0 SKIP. All failures were classified as obsolete formal expectations or fixture/environment issues; only formal tests and fixtures were normalized, and the product candidate remained unchanged.
- Normalization groups passed 63/63, 56/56, 26/26, 42/42, and 67/67; Relevant passed 242/242.
- The final fresh Full completed 803 PASS / 0 FAIL / 0 SKIP against the unchanged validated candidate.

## Compatibility

- Schema change: 3.0 to 3.1.
- Schema Version: 3.1.
- Migration: validated Schema 3.0 compatibility and deterministic normalization to Schema 3.1.
- Future-schema rejection: preserved and validated.
- Autosave, backup flow, persistence format, JSON structure, and production/shared data safeguards: unchanged by release formalization.
- Known Issues: none.
- Deferred Follow-ups: none.

## Artifact

- Formal file: `asanya_task_manager_v310.html`
- Formal SHA-256: `6BFABAF2193263A0366B90B51885C122AB2731548D407D2C54ED220F942C316D`
- Validated RC source: `asanya_task_manager_v310_pbl033_pbl034_pbl036_pbl035_pbl037_pbl036fu3_pbl038_dev.html`
- Validated RC SHA-256: `6BFABAF2193263A0366B90B51885C122AB2731548D407D2C54ED220F942C316D`
