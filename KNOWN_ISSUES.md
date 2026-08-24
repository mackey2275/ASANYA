# Known Issues

## ASANYA v2.1.0

- Schema: 2.0
- Status: known / deferred
- Classification: Phase 7 Deferred Follow-up / Known Issue

### Due editor `d → digit` sort animation / scroll issue

Reproduction condition: put an existing task's Due field into edit mode, press `d`, then press a digit such as `1`, where the resulting Due changes the task or hierarchy's vertical sort position.

In real-browser Human QA, the expected FLIP animation does not run and unexpected vertical scrolling occurs. Automated regression currently passes but does not reproduce this real-browser behavior. The root cause is not confirmed.

Workaround: when this behavior matters, change the Due using another Due-entry method that has been confirmed in Human QA.

### Resolution

- Status: **Resolved in ASANYA v2.1.1**

Automated tests initially passed while real-browser Human QA still reproduced the issue. The final Chrome/Edge comparison showed that the determining factor was the IME composition lifecycle, not the browser brand.

With full-width IME input, removing the active Due editor during the same `compositionend` event stack could trigger delayed native viewport movement. ASANYA v2.1.1 keeps the composing editor connected through `compositionend`, then revalidates and commits the shortcut exactly once in the next macrotask. Half-width input continues through the established immediate keydown path.

The final v2.1.1 candidate completed `438 PASS / 0 FAIL / 0 SKIP`, and real-browser Human QA was **ALL OK**. Full-width `D/d → 0–9` remains a two-keystroke, Enter-free operation.

Release note: v2.1.1 also reorders the shortcut legend so navigation shortcuts (`Alt+T`, `Alt+S`) precede view-switching shortcuts (`Alt+M`, `Alt+I`). Schema remains 2.0.
