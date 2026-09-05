# ASANYA Codex Working Agreement

This repository instruction defines how Codex should develop, validate, and release ASANYA. It is not a product specification and must not encode a current version, schema, candidate, PBL status, or artifact hash.

## Scope and decisions

- Work in small Phase or PBL increments and keep changes within the explicitly approved scope.
- Do not start later work unless instructed. Multiple validated PBLs may accumulate into one release candidate.
- Treat Human QA follow-ups as part of their originating work unless explicitly accepted as Deferred.
- Never report an issue as resolved or Human QA as ALL OK while an unaccepted problem remains.
- Investigate implementation, tests, data paths, and formal records before guessing or asking a question that those sources can answer.
- When requirements genuinely allow materially different interpretations, clarify before implementation.
- Clearly distinguish confirmed facts, investigation findings, hypotheses, and agreed specifications. Never promote a hypothesis to fact without evidence.

## Sources of product truth

This file governs working practices, not changing product behavior. Determine current behavior from the implementation, formal tests, approved specifications and PBL records, release notes, artifacts and hashes, and Git history as appropriate. If chat history is unavailable, reconstruct state from those records rather than inventing it.

## Implementation principles

- Preserve healthy existing behavior and real user data.
- Prefer the established common path over parallel implementations.
- Avoid broad refactors for local problems. If structure is the cause, establish that first and propose the necessary structural change.
- Do not apply speculative fixes without establishing the cause.
- Treat schema, persistence, migration, autosave, multi-file operations, and production data paths as high-risk.
- For Human-QA-only issues, automated PASS is not disproof. Observe the real browser when focus, events, DOM lifecycle, geometry, scrolling, animation, or IME composition matters.
- Keep diagnostics, instrumentation, temporary HTML, logs, screenshots, results, and temporary tests separate from formal artifacts.
- When quota, permissions, context, network, or environment may interrupt work, leave a precise resumable checkpoint instead of beginning a costly step that cannot finish.

## Validation

Use the normal sequence:

```text
Focused -> Relevant -> Human QA when needed -> Full regression
```

For a real-browser issue, a critical Human QA check may precede Relevant and Full regression. If Human QA fails, do not continue an expensive Full regression merely to obtain a green count.

Classify every failure before changing anything:

1. product regression;
2. approved specification change or obsolete expectation;
3. brittle or timing-dependent test;
4. fixture or environment problem.

Do not distort product behavior, weaken meaningful assertions, or remove useful coverage to obtain PASS. Normalize obsolete formal expectations only to the approved current specification while preserving their validation purpose. An isolated rerun PASS does not dismiss a suite failure; investigate timing, rendering convergence, scroll, and fixture effects. Explain changes in Relevant composition or counts and prove that intended coverage remains.

Before treating cumulative work as releasable, run the complete current formal Full regression unless the user explicitly accepts an exception. The default gate is:

```text
0 FAIL
0 SKIP
0 intentional exclusions
```

Confirm the all-tests runner still discovers the complete inventory. If product code or formal tests change during a run, rerun the entire Full regression from a fresh process; do not combine partial runs. Give particular weight to Full regression for shared logic, persistence, Undo/Redo, rendering, schema, and migration changes. Test-only changes do not automatically invalidate accepted Human QA when the product artifact is unchanged.

## Human QA and unresolved issues

Human QA is first-class evidence for visual behavior, animation, scroll, focus, interaction feel, IME, file operations, and browser-dependent behavior. Repeat affected Human QA after changes to executable logic, functional CSS, geometry, animation, focus, or related behavior.

An unresolved issue may proceed only when usability, impact or workaround, and the reason to defer are understood and the user explicitly accepts it. Record such a release as `Released with Known Issue`, including reproduction, symptom, normal path or workaround, automated-test relationship, and future handling. Preserve the historical record after resolution and append the resolution version and verification.

## Version, schema, and migration safety

- Product versions use `Major.Minor.Patch`; schema versions use `Major.Minor`.
- When schema changes, align it with the product release's Major.Minor. Otherwise retain the existing schema.
- Do not change schema merely because a feature was added.
- Validate compatibility, old-schema load, runtime normalization, new-schema save, migration, future-schema rejection, autosave, Save Copy, DB switching, multi-file paths, and destructive persistence paths as applicable.
- Opening an old schema must not itself overwrite the authoritative file destructively.
- Complete required confirmation and backup before destructive migration. Cancellation or prerequisite failure must leave the authoritative file untouched.
- Track original schema and migration state separately from normalized runtime state when needed. Autosave must not bypass confirmation or repeatedly prompt incorrectly.
- Complete preflight confirmation and backup before the first destructive write in multi-file operations.
- Never silently discard an unknown value that cannot be converted safely.

## Development and release roles

Development produces a validated release candidate. Release accepts that candidate and normally performs only formalization, RC-to-formal comparison, representative verification, release records, Git commit/tag/push, distribution or Pages entry updates, and final verification.

If release work requires a product change:

```text
STOP Release -> return to Development -> fix and revalidate -> resume with a newly validated RC
```

For the detailed operational procedure, Release Codex must read and follow [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md). This file defines principles; that document defines execution steps.

When formalizing a validated RC, compare it with the formal artifact. If differences are limited to approved non-functional release identification and there is no executable logic, functional CSS, schema, or persistence difference, representative formal-artifact verification may replace another Full regression. Otherwise the exception does not apply.

## Git and release safety

- A formal release requires a formal artifact, reproducible formal test state, release commit, version tag, authoritative remote push, required distribution entry update, and final repository verification.
- Stage intended paths explicitly. Never use `git add .` or `git add -A` in a dirty workspace.
- Normally exclude caches, test results, screenshots, temporary logs, diagnostic HTML, and temporary investigation files or runners.
- Inspect `git status --short`, staged names and statistics, and `git diff --cached --check`. Avoid accidental whitespace-only, BOM, encoding, and line-ending changes.
- If the Codex sandbox blocks `.git` writes, do not alter ACLs, ownership, or Git metadata to bypass it. Request approval for the specific Git operation and hand off only if approval still cannot make it executable. Do not recreate artifacts or rerun validation solely because Git administration was interrupted.
- Release tags point to the formal release commit. Never move, delete, or repoint historical release tags.
- Do not force-push to resolve ordinary divergence. Stop and report unexpected remote history.
- A Pages or fixed-entry update may be a separate later commit; never move the release tag to it.
- Never modify previous stable artifacts or experiment with migration against authoritative production data. Use copies and verified backups.

## Completion and next state

Do not mechanically implement a contradictory or needlessly complex request. Prefer simple solutions for observed real use over speculative architecture. After each increment, explicitly identify the next state: additional fix, Human QA, Deferred Follow-up or Known Issue, Phase complete, cumulative RC, or Release. Do not begin that next state without instruction.
