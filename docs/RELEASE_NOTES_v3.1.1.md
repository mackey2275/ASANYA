# ASANYA v3.1.1 Release Notes

- Product Version: v3.1.1
- Schema Version: 3.1
- Release date: 2026-09-10
- Known Issues: none
- Deferred Follow-ups: none

## PBL-039 — ToDo Drag Surface Selection

- Corrected ToDo drag-and-drop surface selection so the visible ToDo surface remains authoritative when Project and ToDo views have both rendered the same task IDs.
- Preserved sibling ordering, Due grouping constraints, hidden completed siblings, DB switching, and single-transaction Undo/Redo behavior.

## PBL-040 — Project Summary Editor Horizontal Drag

- Added horizontal movement for the Project summary editor on desktop/wide layouts.
- Preserved modal lifecycle, focus, selection, editing, and runtime-only positioning; narrow layouts remain centered with dragging disabled.
- Kept movement out of persisted product state and Undo/Redo history.

## PBL-041 — Native IME and Delete in Title Editing

- Corrected title-editing ownership of Delete and native Japanese IME composition in ToDo and Project views.
- Prevented character loss and duplicate input while preserving normal title editing, completion controls, F2, Search, and Undo/Redo behavior.

## PBL-038 Follow-up — Task Detail Drag Editing Continuity

- Preserved focus, caret, selection, and uncommitted editor values while moving Task Detail horizontally.
- Cleaned up native IME handling so mouse interaction may normally finalize native composition without ASANYA forcing composition continuity.
- Header interaction alone does not create a model commit, dirty state, or Undo history.

## Native Japanese IME Contract

- Mouse interaction with Task Detail or the Project summary editor may finalize native IME conversion/composition.
- ASANYA does not force native IME composition to continue.
- Focus is not lost unnecessarily; characters are neither lost nor entered twice; normal dragging and editing remain available.

## Validation

- Human QA: ALL OK for PBL-039, PBL-040, PBL-041, and the PBL-038 Follow-up.
- Validated RC formal inventory: 83 files / 844 tests.
- Final Full regression on the validated RC: 844 PASS / 0 FAIL / 0 SKIP.
- Intentional exclusions: 0.
- Formal artifact representative verification: 128 PASS / 0 FAIL / 0 SKIP across 10 files.
- Representative target: `/asanya_task_manager_v311.html`.
- Representative duration: `2.8 minutes`.
- The formal artifact is an exact byte-for-byte copy of the validated RC. The Full regression and Human QA were therefore not repeated after formalization.

## Compatibility

- Product Version: 3.1.1.
- Schema Version: 3.1 (unchanged from v3.1.0).
- Migration, future-schema rejection, autosave, backup flow, persistence format, JSON structure, and Undo/Redo semantics are unchanged by release formalization.
- Known Issues: none.
- Deferred Follow-ups: none.

## Artifact

- Formal file: `asanya_task_manager_v311.html`
- Formal SHA-256: `5EA5CEF4DD3D61E4F6D63DBDFE9EED8089781EA8B5D3152F492857561A188655`
- Validated RC source: `asanya_task_manager_v311_rc.html`
- Validated RC SHA-256: `5EA5CEF4DD3D61E4F6D63DBDFE9EED8089781EA8B5D3152F492857561A188655`
- Release commit: the commit containing this release record, with message `Release ASANYA v3.1.1`.
- Release tag: `v3.1.1`, attached to the release commit.
