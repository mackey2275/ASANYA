# ASANYA v2.5.0 Release Notes

## Release status

- Product Version: `v2.5.0`
- Schema Version: `2.5`
- Formal artifact: `asanya_task_manager_v250.html`
- SHA-256: `DB158B77EAEB8A80102EB87879049B84D37D3744A98C9A0E58C117055E204136`

## Impact redesign

- The former categorical Impact model is replaced by numeric `impact_level` values from 0 through 3.
- Levels are displayed as `☆☆☆`, `★☆☆`, `★★☆`, and `★★★`.
- Clicking star N sets level N; clicking the currently selected level resets it to 0.
- The same accessible star interaction is available in ToDo, Project/Gantt, drafts, and Task Detail.
- Task Detail Impact edits participate in Task Detail Session Undo and preserve the pane scroll position.
- Impact is placed immediately after Child and before Status where Status is present.

## Schema 2.5 and migration safety

- Runtime and persistence now use `impact_level`; current Schema 2.5 output does not persist legacy task `impact`.
- Supported legacy values migrate as follows: blank/missing → 0, C → 1, B-期限/B-定期 → 2, A → 3.
- Supported Schema-less, 1.x, 2.0, 2.1, and 2.2 databases can be normalized safely.
- Opening an old database alone does not silently overwrite it.
- Before an upgrade overwrites the primary file, an exact backup with the source-Schema suffix must succeed.
- The original filename remains the primary Schema 2.5 database after migration.
- Unknown legacy Impact values are reported before a destructive migration save and normalize to runtime level 0 with temporary diagnostics.
- Migration cancellation preserves the original file and dirty state; autosave does not repeatedly prompt after cancellation, while an explicit save can prompt again.
- DB switching preserves the current dirty database when migration is cancelled.
- Save Copy writes Schema 2.5.
- JSON-to-JSON movement preflights all required upgrades and backups before the first destructive write.
- Unsupported Schema 2.3/2.4 and future Schema versions are rejected by the supported-version policy.

## Compatibility

- Recurrence remains independent of Impact and copies the numeric Impact Level when rolling forward.
- ASANA CSV import continues to map legacy Impact labels through the shared migration mapper.
- Copilot output uses the new star-based Impact representation.
- Future Schema rejection remains protected.
- The formal v2.4.0 artifact remains unchanged and retains its historical behavior.

## Validation

- Impact Level Phase 1 Human QA: **ALL OK**
- Impact Level Phase 2 Human QA: **approved / OK**
- Phase 1 focused: **19 PASS / 0 FAIL / 0 SKIP**
- Phase 2 focused: **8 PASS / 0 FAIL / 0 SKIP**
- Phase 1 focused recheck after Phase 2: **19 PASS / 0 FAIL / 0 SKIP**
- Relevant regression after Phase 2: **132 PASS / 0 FAIL / 0 SKIP**
- Closure normalization focused checks: all changed-test groups passed with no remaining failure or skip.
- Complete unfiltered Full regression on the approved candidate: **577 PASS / 0 FAIL / 0 SKIP**, exit code 0, with no intentional exclusions.
- Representative formal-artifact verification: **166 PASS / 0 FAIL / 0 SKIP**, exit code 0.
- The formal artifact is an exact byte-for-byte copy of the fully tested candidate. Full regression was therefore not repeated after formalization.

## Known Issues

None.
