# Known Issues

## ASANYA v2.1.0

- Schema: 2.0
- Status: known / deferred
- Classification: Phase 7 Deferred Follow-up / Known Issue

### Due editor `d → digit` sort animation / scroll issue

Reproduction condition: put an existing task's Due field into edit mode, press `d`, then press a digit such as `1`, where the resulting Due changes the task or hierarchy's vertical sort position.

In real-browser Human QA, the expected FLIP animation does not run and unexpected vertical scrolling occurs. Automated regression currently passes but does not reproduce this real-browser behavior. The root cause is not confirmed.

Workaround: when this behavior matters, change the Due using another Due-entry method that has been confirmed in Human QA.
