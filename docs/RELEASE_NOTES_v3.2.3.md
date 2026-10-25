# ASANYA v3.2.3 Release Notes

- Product Version: v3.2.3
- Schema Version: 3.2
- Release Date: 2026-10-25
- Released PBI: PBL-048 — 現行機能に合わせたHelp / Shortcut Guide更新
- Known Issues: None
- Deferred Follow-ups: None

## Highlights

ASANYA v3.2.3 brings the in-app Help and Shortcut Guide up to date with the current product while keeping the existing product behavior, Schema, and persistence format unchanged.

## PBL-048 — Current Help and Shortcut Guide

- Help is now unified across all four display modes. Every mode presents the same sections in the same order: 共通, ToDo, Project, and ショートカット.
- Snapshot, Snapshot comparison, Semantic Diff, and external-AI handoff are explained as one coherent workflow.
- Help distinguishes editable on-screen copy buffers from the canonical Semantic Diff used by the AI-analysis Markdown export.
- External-update guidance explains stale display state, the absence of automatic merge or reload, autosave protection during a conflict, and the confirmation required before local work is discarded.
- Project `メモ` is documented as a Project-only reference item that is excluded from active-work calculations and guarded from incompatible dependency, recurrence, and conversion operations.
- Recurring checklist Help explains same-record roll-forward, descendant reset and date shifting, preserved definitions, and dependency restrictions.
- Project hierarchy collapse and expand guidance is aligned with the existing ToDo hierarchy guidance.
- The Shortcut Guide now reflects the current Undo, Redo, task navigation, search, edit, and view-switching behavior without restoring obsolete `Alt+M` or `Alt+I` recommendations.

The final view guidance is:

~~~text
T
ToDo ツリー順

(ToDo時) 1 / 2
ツリー順 / 日付順 切替

P
Project 詳細

(Project時) 1 / 2
詳細表示 / 簡易表示 切替
~~~

The undefined term `family` is not used to explain the `1 / 2` shortcuts.

PBL-018 remains Released and unchanged. PBL-048 updates the Help coverage for functionality delivered after PBL-018; it does not reopen or replace PBL-018.

## Compatibility

- Schema change: None.
- Persistence change: None.
- Migration: None.
- Schema Version remains 3.2.
- Snapshot, Semantic Diff, AI-analysis-file generation, external-update protection, Memo behavior, recurrence behavior, hierarchy behavior, autosave, and Undo/Redo semantics are unchanged.
- Previous formal artifacts and historical release tags were not modified.

## Validation

- Human QA: ALL OK.
- Development Affected Focused: 3 files / 44 tests; 44 PASS / 0 FAIL / 0 SKIP.
- Development Final Relevant: 18 files / 215 tests; 215 PASS / 0 FAIL / 0 SKIP.
- Development Final Full: 91 files / 927 tests; 927 PASS / 0 FAIL / 0 SKIP in one fresh process against the frozen RC.
- Intentional exclusions: 0.
- Formal artifact representative verification: 8 files / 78 tests; 78 PASS / 0 FAIL / 0 SKIP.
- Representative target: `/asanya_task_manager_v323.html`.
- Representative duration: 98.9 seconds (1.6 minutes).

The 927-test Full was not rerun during Release because the RC-to-formal differences are limited to approved non-functional release identity. The only formal-test change made during Release was the matching v3.2.3 identity normalization in the PBL-048 identity assertion; product behavior, test meaning, fixtures, helpers, dependencies, and runner behavior were unchanged. Representative verification ran directly against the formal v3.2.3 artifact.

The initial sandboxed representative attempt did not reach product assertions because Edge could not write its temporary browser profile. The approved normal browser execution completed all 78 tests successfully. This was an environment-only event, not a product or test failure.

## Development Validation History

- Full attempt 1: 912 PASS / 15 FAIL / 0 SKIP. All failures came from a stale fixed candidate reference in the PBL-022 suite (Category 4). Target and Schema expectations were normalized while retaining the meaningful assertions.
- Full attempt 2: 926 PASS / 1 FAIL / 0 SKIP. The remaining failure was P7F-15 pointer geometry/timing instability (Category 3/4). The test used a deterministic pointer-event path while independent real-mouse drag coverage remained intact.
- Final Full: 927 PASS / 0 FAIL / 0 SKIP.

These resolved validation-infrastructure items are not product regressions, Known Issues, or Deferred Follow-ups. The validated product candidate remained unchanged through the final Full.

## RC-to-Formal Comparison

The formal artifact differs from the validated RC only in these approved release-identity strings:

1. HTML title: ASANYA v3.2.2 → ASANYA v3.2.3
2. `APP_TITLE`: ASANYA v3.2.2 → ASANYA v3.2.3
3. Newly created Snapshot metadata `product_version`: 3.2.2 → 3.2.3

Normalizing these three strings back to 3.2.2 produces an exact text and SHA-256 match with the validated RC. There are no differences in executable JavaScript behavior, functional CSS, Help content or ordering, event behavior, Schema, migration, persistence, autosave, Snapshot/Semantic Diff semantics, AI-analysis-file generation, external-update behavior, Memo behavior, recurrence behavior, hierarchy behavior, or Shortcut behavior.

## Formal Release Record

- Formal artifact: `asanya_task_manager_v323.html`
- Formal SHA-256: `FB4391897768D57225DDE081C03F5FE2F6E1301FC6F70A44835973E5A81A7E13`
- Validated RC source: `asanya_task_manager_v322_pbl048_dev.html`
- Validated RC SHA-256: `AC54BE43974D3999048804778C10D1C7B39E16AA6C70A29320D45DCA14C7739E`
- Release commit: `f3fa3709bb2add5158e1ed7abff77f5177e4332c` (`Release v3.2.3`).
- Release tag: annotated tag `v3.2.3`; tag object `714a56efba6b4a4e05ae644d819ba3276c4cc130`; peeled target `f3fa3709bb2add5158e1ed7abff77f5177e4332c`.
- Pages entry commit: `5d925ba3d03619c6a6f8904d97be1546893d1933`.
- Backlog closure commit: `82483c97356f4a060e5729c7fb74a3d36fb4928a`.
- Release status: Released.

The `v3.2.3` tag must remain attached to the formal release commit and must not move to the Pages, backlog, or documentation follow-up commits.
