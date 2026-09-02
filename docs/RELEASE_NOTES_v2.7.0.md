# ASANYA v2.7.0 Release Notes

- Product Version: v2.7.0
- Schema Version: 2.5
- Release date: 2026-09-02
- Known Issues: none

## PBL-028 — Due Editing Shortcut

- Added `D → E` to open the existing Due editor for the selected task.
- Reused the established Due editing and persistence path instead of introducing a separate editor.
- Preserved `D → 0–9`, F2 title editing, Enter task creation, full-width variants, and IME lifecycle protections.

## PBL-019 — Four Display Modes

- Added the four explicit display modes: ToDo Tree, ToDo Date, Project Detail, and Project Simple.
- Unified navigation shortcuts: `T` and `P` select the ToDo and Project families, while `1` and `2` select the mode within the active family.
- Project Detail and Project Simple differ only by Summary visibility; Priority remains visible in both.

## PBL-020 — Common Owner and Priority Filters

- Added a shared Owner multi-select filter across all four display modes, including the unassigned option.
- Added Priority thresholds for all tasks, one star or higher, two stars or higher, and exactly three stars.
- Owner selections use OR internally; Owner, Priority, and management end-state filters combine with AND.
- ToDo Tree preserves only necessary ancestors for hierarchy context. A matching parent does not pull non-matching descendants.
- Filter state is shared across the four modes without changing task data or task Undo history.
- Finalized the compact desktop layout as Priority followed by Owner, with the full `優先度: すべて` label visible.

## PBL-029 — Search Shortcut and Guide Synchronization

- Made `S` the primary Search shortcut while retaining `Alt+S` as a backward-compatible alias.
- Synchronized the shortcut guide with current behavior and removed obsolete `Alt+M` and `Alt+I` entries.
- Finalized the Due guide wording as `D→E＝期限編集　D→0〜9＝今日〜9日後`.
- Removed the visible `（全角可）` annotation while preserving actual full-width-key support.

## Validation

- Human QA: ALL OK
- Integrated Full regression: 655 PASS / 0 FAIL / 0 SKIP
- Formal artifact representative verification: 89 PASS / 0 FAIL / 0 SKIP
- Intentional exclusions: 0

## Compatibility

- Schema change: none
- Schema Version: 2.5
- Persistence shape change: none
- Migration: none
- Production/shared JSON: untouched
- Known Issues: none

## Artifact

- File: `asanya_task_manager_v270.html`
- SHA-256: `05E26FCC610E45DAF59080B1197C4C6E98463912ABD3A4B6A60309C17410EC4A`
