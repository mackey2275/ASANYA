# ASANYA v3.2.0 Release Notes

- Product Version: v3.2.0
- Schema Version: 3.2
- Release date: 2026-09-12
- Released PBL: PBL-042 — 2時点スナップショット比較＋Semantic Diff
- Known Issues: none
- Deferred Follow-ups: none

## PBL-042 — 2時点スナップショット比較＋Semantic Diff

- Manually creates and retains up to five canonical Task Snapshots inside the ASANYA DB.
- Safely compares any two Snapshots and automatically assigns the older capture as Before and the newer capture as After.
- Produces a deterministic Semantic Diff containing added, deleted, changed, and unchanged Task facts with hierarchy context.
- Provides editable AI-ready and raw diff JSON views and copies the exact edited output without mutating canonical diff or persisted data.
- Uses a general-purpose two-point comparison prompt; the feature does not require Scrum.

Snapshot creation requires a clean committed editor state and writable direct-save backing file, reuses external-update protection, and writes atomically. Retention never deletes silently: creating a sixth Snapshot requires deleting the oldest, choosing one existing Snapshot, or cancelling. Snapshot metadata does not create Undo history, dirty state, or autosave side effects.

## Compatibility

- Schema changed from 3.1 to 3.2 to add the root `snapshots` collection.
- Schema 3.1 → 3.2 migration uses the established confirmation and exact-backup safety path before the first destructive write.
- Snapshot format version: 1.0.
- Snapshot payloads contain canonical persisted Task data without recursive Snapshot content, Semantic Diff persistence, or runtime-only UI state.
- Existing migration, future-schema rejection, autosave, Save Copy, DB switching, multi-file safety, persistence, and Undo/Redo contracts remain covered by formal validation.

## Validation

- Human QA: ALL OK.
- Validated RC formal inventory: 87 files / 900 tests.
- Final Full regression on the frozen validated RC: 900 PASS / 0 FAIL / 0 SKIP in one fresh process from test 1.
- Full duration: 19.0 minutes.
- Intentional exclusions: 0.
- Formal artifact representative verification: 72 PASS / 0 FAIL / 0 SKIP across 6 files.
- Representative target: `/asanya_task_manager_v320.html`.
- Representative duration: 2.0 minutes.
- The formal artifact is an exact byte-for-byte copy of the validated RC. The accepted Full regression and Human QA therefore apply to the identical formal product bytes and were not repeated after formalization.

### Release-boundary formal normalization

- Legacy formal tests and fixtures were normalized before the final clean Full for Schema 3.2 fixture adoption, asynchronous `applyJsonObject` completion, current product identity, and date-dependent recurrence expectations.
- The prior failed Full was not combined with the final run, and the frozen product did not change after Human QA.

## Artifact

- Formal file: `asanya_task_manager_v320.html`
- Formal SHA-256: `228CBA644443DA341EA1B2B680590AE4C19E1C94AEE1AEA3B4B6E9E5C12417B5`
- Validated RC source: `asanya_task_manager_v320_rc.html`
- Validated RC SHA-256: `228CBA644443DA341EA1B2B680590AE4C19E1C94AEE1AEA3B4B6E9E5C12417B5`
- Release commit: the commit containing this release record, with message `Release ASANYA v3.2.0`.
- Release tag: `v3.2.0`, attached to the release commit.
