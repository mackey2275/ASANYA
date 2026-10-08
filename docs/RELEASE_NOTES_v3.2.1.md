# ASANYA v3.2.1 Release Notes

- Product Version: v3.2.1
- Schema Version: 3.2
- Release Date: 2026-10-08
- Released PBIs: PBL-046 — Weekday Labels for Due Dates; PBL-032 — External Update Notice and Safe Reload
- Known Issues: None
- Deferred Follow-ups: None

## Highlights

ASANYA v3.2.1 improves due-date readability and makes externally modified database files easier and safer to reload. This release does not change the schema or persistence format.

## PBL-046 — Weekday Labels for Due Dates

- Due dates seven or more days in the future now include a one-character Japanese weekday label.
- Dates in another year retain the existing year-qualified format and add the weekday label.
- Existing labels for yesterday, today, tomorrow, dates two to six days ahead, and past dates remain unchanged.
- ToDo and Project views use the same shared due-date formatting rule.
- Persisted Due values remain unchanged.
- Only the former default Due-column width of 88 px is migrated to 104 px. User-defined custom widths are preserved.

Examples:

```text
10/7 水
2027/1/1 金
```

## PBL-032 — External Update Notice and Safe Reload

- When ASANYA detects that the open database file was modified externally, it displays a persistent, viewport-fixed notice.
- The notice remains accessible even when the page header is outside the viewport.
- In a safe, clean state, the user can reload the latest database directly from the notice.
- If unsaved changes or an active editor exist, ASANYA requests confirmation before discarding them and reloading.
- Cancelling the confirmation preserves both the current content and the external-update state.
- External-update detection never triggers an automatic reload.
- Existing pre-save freshness checks, autosave protection, database switching, persistence, and Undo/Redo behavior remain intact.
- This release does not add presence, collaborative locking, an offline command queue, backend synchronization, or item-level conflict resolution.

## Compatibility

- Schema Version remains 3.2.
- No schema migration was added.
- The persistence format is unchanged.
- Existing migration, future-schema rejection, autosave, Save Copy, database switching, and multi-file safety behavior remain unchanged.
- Previous formal artifacts and historical release tags were not modified.

## Validation

- Human QA: PBL-046 ALL OK; PBL-032 QA1–QA5 ALL OK.
- Development initial Focused: 18 PASS / 0 FAIL / 0 SKIP.
- Development initial Relevant: 171 PASS / 0 FAIL / 0 SKIP.
- Post-normalization Focused: 53 PASS / 0 FAIL / 0 SKIP.
- Post-normalization Relevant: 213 PASS / 0 FAIL / 0 SKIP.
- First cumulative Development Full: 89 files / 911 tests; 903 PASS / 8 FAIL / 0 SKIP in 20.1 minutes.
- The eight failures were classified as Category 3/4 wall-clock and Gantt-fixture dependencies. Only test and fixture normalization was performed, meaningful assertions were preserved, and the product candidate did not change. The failed run was not combined with the final result.
- Final Development Full on the frozen RC: 89 files / 911 tests; 911 PASS / 0 FAIL / 0 SKIP in 19.3 minutes.
- Release identity Focused: 5 files / 56 tests; 56 PASS / 0 FAIL / 0 SKIP.
- Release fixture-fix Focused: 2 files / 37 tests; 37 PASS / 0 FAIL / 0 SKIP.
- Release union Relevant: 20 files / 226 tests; 226 PASS / 0 FAIL / 0 SKIP.
- Formal Full regression: 89 files / 911 tests; 911 PASS / 0 FAIL / 0 SKIP in one fresh process from test 1 with one worker.
- Formal Full duration: 18.6 minutes.
- Intentional exclusions: 0.
- Formal artifact representative verification: 6 files / 67 tests; 67 PASS / 0 FAIL / 0 SKIP.
- Representative target: `/asanya_task_manager_v321.html`.
- Representative duration: 1.5 minutes.

## RC-to-Formal Comparison

The formal artifact differs from the validated RC only in these approved release-identity strings:

1. `<title>ASANYA v3.2.1</title>`
2. `APP_TITLE='ASANYA v3.2.1'`
3. Newly created Snapshot metadata uses `product_version:'3.2.1'`

There are no differences in executable JavaScript behavior, functional CSS, Schema, migration, persistence, autosave, Undo/Redo, event behavior, or product semantics. Human QA was therefore not repeated. A complete formal Full regression and representative verification were run against the formal artifact.

## Formal Release Record

- Formal artifact: `asanya_task_manager_v321.html`
- Formal SHA-256: `923C1EDFC1A35EEECB22503F9432FEC4D3E365E1E147829276D83096F2D29FBC`
- Validated RC source: `asanya_task_manager_v320_pbl046_pbl032_dev.html`
- Validated RC SHA-256: `E94F5223754D4120F4992ECA8F59A9A438CB86B6A4A9FC8C4D9ADDD1E1E08082`
- Release commit: `421a99218da959368d570fd03faeb7475b86e9ad`
- Release tag: `v3.2.1`
- Pages entry commit: `b399b9c0b344b818b974122074930c5dfd506fa8`
- Backlog closure commit: `ba71d97326709d0316041cd8e4113d8a474c74e6`
- Release status: Released

The `v3.2.1` tag remains attached to the formal release commit and was not moved to either follow-up commit.
