# ASANYA v3.2.2 Release Notes

- Product Version: v3.2.2
- Schema Version: 3.2
- Release Date: 2026-10-25
- Released PBI: PBL-047 — External-AI Analysis File Export for Semantic Diff
- Known Issues: None
- Deferred Follow-ups: None

## Highlights

ASANYA v3.2.2 adds a one-click workflow for exporting an existing Semantic Diff as a Markdown file for analysis by an external AI service such as Microsoft 365 Copilot.

## PBL-047 — External-AI Analysis File Export

- The existing Snapshot comparison output provides an **AI分析用ファイルを保存** action.
- One action downloads a UTF-8 Markdown file containing the complete canonical analysis instruction followed by the complete generated Semantic Diff.
- The export uses the authoritative generated Semantic Diff object. User edits in the AI or JSON text areas do not alter the exported data.
- The generated filename is deterministic and filesystem-safe, including comparisons across different years.
- Repeated downloads preserve identical content while using and releasing a fresh temporary object URL each time.
- Existing Semantic Diff editing, copy, Snapshot, persistence, dirty-state, and Undo/Redo behavior remains unchanged.

The generated package contains the ASANYA Semantic Diff Analysis heading, the canonical analysis instruction, a separator, the Semantic Diff heading, and the complete Semantic Diff in a JSON code block.

The canonical instruction is preserved exactly from the approved PBL-047 specification.

## External AI Workflow

~~~text
ASANYA
→ compare two Snapshots
→ save the AI-analysis Markdown file
→ attach or drag the downloaded file into Microsoft 365 Copilot
→ run the analysis
~~~

Chrome and Edge both passed file generation and download Human QA. Microsoft 365 Copilot accepted the generated file and completed analysis successfully.

This release does not implement PBL-009 or introduce a general-purpose Data Export architecture.

## Compatibility

- Schema Version remains 3.2.
- No schema migration was added.
- The persistence format is unchanged.
- Snapshot and Semantic Diff formats and semantics are unchanged.
- Existing migration, future-schema rejection, autosave, Save Copy, database switching, and multi-file safety behavior remain unchanged.
- Previous formal artifacts and historical release tags were not modified.

## Validation

- Human QA: Chrome ALL OK; Edge ALL OK; Microsoft 365 Copilot attachment/analysis OK; existing comparison UI OK.
- Development initial Focused: 5 files / 62 tests; 62 PASS / 0 FAIL / 0 SKIP.
- Development initial Relevant: 14 files / 141 tests; 141 PASS / 0 FAIL / 0 SKIP.
- First Development Full: 90 files / 917 tests; 913 PASS / 4 FAIL / 0 SKIP.
- The four failures were classified as three obsolete fixed-date recurrence fixtures (Category 4) and one responsive resize convergence timing issue (Category 3). Only formal tests were normalized, meaningful assertions were preserved, and the product candidate did not change.
- Post-normalization Affected Focused: 3 files / 49 tests; 49 PASS / 0 FAIL / 0 SKIP.
- Final Development union Relevant: 19 files / 220 tests; 220 PASS / 0 FAIL / 0 SKIP.
- Final Development Full on the frozen RC: 90 files / 917 tests; 917 PASS / 0 FAIL / 0 SKIP in one fresh process from test 1.
- Intentional exclusions: 0.
- Formal Focused: 5 files / 62 tests; 62 PASS / 0 FAIL / 0 SKIP.
- Formal Relevant: 19 files / 220 tests; 220 PASS / 0 FAIL / 0 SKIP.
- Formal artifact representative verification: 4 files / 33 tests; 33 PASS / 0 FAIL / 0 SKIP.
- Representative target: /asanya_task_manager_v322.html.

The 917-test Full was not rerun during Release because RC-to-formal differences are limited to approved non-functional release identity and no product logic, formal test, fixture, helper, dependency, or runner state changed after the frozen Development Full.

## RC-to-Formal Comparison

The formal artifact differs from the validated RC only in these approved release-identity strings:

1. HTML title: ASANYA v3.2.2
2. APP_TITLE: ASANYA v3.2.2
3. Newly created Snapshot metadata uses product_version 3.2.2

There are no differences in executable JavaScript behavior, functional CSS, event behavior, Schema, migration, persistence, autosave, Snapshot/Semantic Diff semantics, PBL-047 file generation, or the canonical analysis instruction.

## Formal Release Record

- Formal artifact: asanya_task_manager_v322.html
- Formal SHA-256: 60CFA1B3DB7E32C3604A9ECC4B114FF6F5D71DCA1BEE59959FF11956847514DD
- Validated RC source: asanya_task_manager_v321_pbl047_dev.html
- Validated RC SHA-256: 08AB89C64379E3AC5ECC6EDA5CAD83C84647A622D60B29C496A54386E23AEC1A
- Release commit: `21cdfc27fb6d35de378546a4461b4f977d7f6278`
- Release tag: annotated tag `v3.2.2`, attached to the formal release commit.
- Pages entry commit: `af199ec3416e1f900483c2119db418c9a6caf36e`
- Backlog closure commit: `f63ee8539d29b200395b2ca6ddf1ee3ca4eaff14`
- Release status: Released

The `v3.2.2` tag remains attached to the formal release commit and was not moved to the Pages, backlog, or documentation follow-up commits.
