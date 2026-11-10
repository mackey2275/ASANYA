# ASANYA v3.2.4 Release Notes

- Product Version: v3.2.4
- Schema Version: 3.2
- Release Date: 2026-11-11
- Released scope: cumulative improvements to Help, Semantic Diff AI analysis, and Project new-row creation
- Known Issues: None identified in the reviewed release scope
- Deferred Follow-ups: None identified for the shipped scope

## Help and guidance

- Added a portal-style Help landing page with category navigation and return-to-top behavior.
- Revised guidance for task creation and editing, ToDo and Project modes, database save/load, external updates, and keyboard shortcuts.
- Expanded Snapshot and Semantic Diff AI-analysis guidance, including the generated Copilot prompt workflow.
- Adjusted Help trigger stacking while the Copilot sidebar is open.

## Semantic Diff AI analysis

- The analysis instruction distinguishes substantive postponement from execution schedule changes, parent Task Focus updates, normal recurring rolls, and unresolved Due meaning.
- Due changes and overdue state are evaluated independently, using the After Snapshot date as the overdue reference.
- Human questions are reserved for unresolved meaning that could materially change the analysis or next action.
- The established seven-section analysis structure remains in place. The separate clipboard prompt route is unchanged.

## Project new-row creation

- A new Project row is preserved when Summary is entered before the Title is committed.
- Both the top input row and existing-row insertion flow retain Title and Summary through commit, including Enter from the Path B Summary field.
- Undo/Redo and Due-based sorting semantics are preserved.
- After commit and sorting, the Project view follows the created Task by its stable ID so it remains visible.

## Compatibility

- Schema change: None.
- Persistence change: None.
- Migration: None.
- Schema Version remains 3.2.
- Formal test normalization of `PHASE4-ROLL-06` uses a fixed date to verify monthly catch-up to 2026-12-01. This is validation maintenance, not a user-facing feature.

## Validation

- Validated RC: `asanya_task_manager_v323_semantic_diff_dev.html`.
- Validated RC SHA-256: `A9EA5A57C125E3FE81461FA8F1419EE48DA0DF729ABC02BCC79439EFAB1AD6A`.
- Candidate Product Version / Schema Version: 3.2.3 / 3.2.
- Human QA: Completed for the validated cumulative candidate.
- Affected Focused: 8 PASS / 0 FAIL / 0 SKIP.
- Relevant: 85 PASS / 0 FAIL / 0 SKIP.
- Full regression on the validated RC: 91 files / 942 tests; 942 PASS / 0 FAIL / 0 SKIP.
- Intentional exclusions: 0.
- Formal artifact representative verification: 8 files / 104 tests; 104 PASS / 0 FAIL / 0 SKIP.
- Representative target: `/asanya_task_manager_v324.html`.
- Representative duration: 124.6 seconds (2.1 minutes).
- The PBL-048 identity assertion hard-coded to the validated candidate version 3.2.3 was excluded from the formal run; formal version and Schema identity were verified directly as 3.2.4 / 3.2.

## RC-to-formal identity

The formal artifact is generated from the exact validated RC. Only the HTML title, `APP_TITLE`, and newly created Snapshot `product_version` identity values change from 3.2.3 to 3.2.4. Schema remains 3.2. Replacing those three 3.2.4 strings with 3.2.3 in the formal artifact produces an exact text and SHA-256 match to the validated RC. There are no functional differences in the Help, Semantic Diff analysis, Project new-row flow, persistence, migration, or other product behavior.

## Formal release record

- Formal artifact: `asanya_task_manager_v324.html`.
- Formal artifact SHA-256: `6FD2275346A511D5E908657928B06892D57498B5800A9079103BF79F33A8A66C`.
- Release commit: the commit containing this release record and the formal release files, with message `Release v3.2.4`.
- Release tag: `v3.2.4`, attached to the formal release commit.
- Pages / fixed-entry commit: recorded after the fixed-entry update, if required.
- Post-release PBL follow-ups: PBL-047 Semantic Diff analysis instruction; PBL-048 Help redesign/content/navigation/Copilot stacking; PBL-035 Project new-row preservation/commit/auto-follow. Original Released states and release histories remain intact.
