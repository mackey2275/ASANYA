# ASANYA Formal Release Process

This document defines the standard, reproducible procedure for publishing an ASANYA formal release. It is a process guide, not a release note. Replace placeholders such as `<version>`, `<rc-file>`, and `<formal-file>` with values from the validated release checkpoint.

## Working Agreement

- Treat validated behavior and recorded evidence as authoritative. Do not silently substitute assumptions for missing release facts.
- Keep changes narrow, explicit, and reviewable. Release work must not become an opportunity for unrelated product, architecture, schema, persistence, or backlog work.
- Preserve user data and compatibility. A schema or persistence change must be intentional, documented, migrated deterministically, and validated before release entry.
- Record Known Issues and Deferred Follow-ups honestly. Do not hide them, silently fix them during release packaging, or describe deferred work as completed.
- Protect previous stable artifacts, commits, and tags. Never rewrite release history to simplify a new release.
- Stop when a safety invariant fails. Diagnose and report rather than forcing the release through.

## 1. Release Entry Conditions

Begin a formal release only from a written, resumable checkpoint that identifies:

- the approved product version and schema version;
- the validated release-candidate filename;
- the RC SHA-256 digest, calculated from the exact file that passed validation;
- Human QA status, including any required browser or platform coverage;
- integrated Full regression totals: pass, fail, skip, test-file count, and intentional exclusions;
- all Known Issues and Deferred Follow-ups, or an explicit `none` for each;
- the intended formal artifact filename;
- the repository root, branch, and expected starting commit;
- the files expected to enter the formal release commit.

Entry requires an approved RC, successful required Human QA, and a Full regression with no unexplained failures or skips. Any accepted exception must be explicit, reviewed, and carried into the release notes. Confirm the working branch is `main` unless the release plan explicitly names another protected release branch.

Before changing Git state, run:

```powershell
git rev-parse --show-toplevel
git rev-parse --git-dir
git status --short
git branch --show-current
git rev-parse HEAD
```

Confirm the version tag does not already exist locally. If remote access is available, fetch safely and confirm it does not exist remotely. Never create, replace, or move an existing version tag.

## 2. Create the Formal Artifact

Create `<formal-file>` from the exact validated `<rc-file>` using the approved release packaging operation. For the current single-file ASANYA distribution, this is normally a byte-for-byte copy with the formal versioned filename; do not manually reconstruct or opportunistically edit the application.

Immediately calculate and record both SHA-256 digests:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<rc-file>'
Get-FileHash -Algorithm SHA256 -LiteralPath '<formal-file>'
```

Record the formal artifact digest in the release notes and checkpoint. Once formal verification begins, the formal artifact is immutable. Any later byte change invalidates its digest and verification evidence and requires a new candidate decision.

## 3. Verify RC-to-Formal Differences

Compare the RC and formal artifact before relying on earlier validation:

```powershell
git diff --no-index -- '<rc-file>' '<formal-file>'
```

Interpret the result deliberately:

- If packaging is intended to be byte-identical, the diff must be empty and the SHA-256 values must match.
- If an approved packaging-only transformation is expected, document the exact allowed difference and verify that no executable product logic, schema, persistence behavior, text encoding, or line endings changed unintentionally.
- If any unexpected executable or data-format difference appears, stop. The formal artifact is not the validated RC.

Do not delete or overwrite the validated RC until the release is complete and its evidence is retained according to project policy.

## 4. Decide Whether Full Regression Must Be Rerun

The Full regression does **not** need to be rerun merely because the validated RC was copied or renamed byte-for-byte, Git commits/tags were created, files were pushed, or a redirect-only fixed entry point was updated.

Rerun the Full regression when any executable product code, schema behavior, persistence behavior, runtime dependency, test target, or packaging transformation changes after the validated run. Also rerun it when the RC-to-formal comparison is unexpected or when the previous evidence cannot be tied unambiguously to the artifact digest.

Never rerun expensive validation only because permissions, quota, or network access interrupted Git administration. Resume from the recorded checkpoint after rechecking its invariants.

## 5. Representative Formal-Artifact Verification

Even when the artifact is byte-identical, run the approved representative verification directly against `<formal-file>`. Its purpose is to prove that the formal filename and serving path load the correct artifact and that representative critical flows work in that packaged context.

Record pass, fail, skip, test-file, and intentional-exclusion totals. A failure, unexplained skip, wrong target, or artifact digest change is a stop condition. Representative verification supplements the validated RC Full regression; it does not replace it.

## 6. Write Release Notes

Create `docs/RELEASE_NOTES_<version>.md`. At minimum include:

- product version, schema version, release date, and Known Issues;
- user-visible changes grouped by PBL or release theme;
- compatibility impact, including schema change, migration, persistence-shape change, and production/shared-data handling;
- Human QA result;
- integrated Full regression totals and test-file count;
- formal-artifact representative verification totals;
- intentional exclusions;
- Deferred Follow-ups, when any exist;
- formal artifact filename and uppercase SHA-256 digest.

Release notes must describe the shipped artifact and actual validation evidence. Do not claim unrun checks, omit accepted issues, or mix future work into the shipped scope.

## 7. Verify and Stage the Formal Release

Inspect the worktree and identify the intended release set before staging:

```powershell
git status --short
git diff --stat
git diff --check
```

When unrelated development files, diagnostics, logs, package caches, or test-result directories exist, never use:

```text
git add .
git add -A
```

Stage only reviewed paths, explicitly:

```powershell
git add -- '<formal-file>' 'docs/RELEASE_NOTES_<version>.md' '<explicit-test-or-runner-path>'
```

Tests and harness files belong in the release commit only when they are part of the validated release set. Do not stage RCs, exploratory artifacts, logs, screenshots, generated test results, caches, or unrelated manuals unless the release plan explicitly includes them.

Verify the index before committing:

```powershell
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
```

Compare the staged path list and counts with the release checkpoint. If either changed unexpectedly, stop and investigate. Unrelated untracked files may remain; they are not a release failure.

## 8. Check Remote Divergence

Before committing or pushing, update remote-tracking information when access is available:

```powershell
git fetch origin --prune
git status -sb
git rev-list --left-right --count HEAD...origin/main
```

Confirm `main` has not unexpectedly diverged from `origin/main`, and check the version tag again. If remote history changed, stop and report. Do not automatically rebase, reset, merge, rewrite history, or force-push during the release procedure.

## 9. Create the Formal Release Commit

Create one formal release commit from the verified index:

```powershell
git commit -m "Release <version>"
```

Record the full commit SHA and verify:

```powershell
git rev-parse HEAD
git show --stat --oneline HEAD
git status --short
```

The committed files and statistics must match the staged checkpoint. Only unrelated untracked files may remain.

## 10. Create and Verify the Version Tag

Follow the repository convention of an annotated tag:

```powershell
git tag -a <version> <release-commit-sha> -m "ASANYA <version>"
```

Verify both the tag object and its peeled commit target:

```powershell
git show-ref --tags <version>
git rev-parse <version>
git rev-parse '<version>^{}'
git rev-parse HEAD
```

For an annotated tag, `git rev-parse <version>` returns the tag-object SHA; `git rev-parse '<version>^{}'` returns the release commit. The peeled target must exactly equal the recorded formal release commit.

## 11. Push the Formal Release

Perform a fresh live remote check immediately before pushing. Then use normal, non-force pushes:

```powershell
git push origin main
git push origin <version>
```

If either push is rejected because the remote changed, stop. Do not force, reset, or rebase automatically. After success, verify that remote `main` contains the release commit and the remote tag peels to the same commit.

## 12. Update GitHub Pages / Fixed Entry Point

Only after the release commit and tag are safely pushed, inspect the fixed entry-point mechanism, normally `index.html`.

- If it already resolves to `<formal-file>` without a tracked change, verify the behavior and do not create an empty commit.
- If it still targets the previous release, update only the necessary redirect/link values. Do not copy product logic into the entry point.

Before staging a Pages change, verify:

```powershell
git diff --stat
git diff --check
```

Review the exact diff for unintended encoding, BOM, final-newline, or line-ending changes. Stage only the entry-point file and create a separate commit:

```powershell
git add -- index.html
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
git commit -m "Update Pages entry for <version>"
git push origin main
```

The version tag must remain on the earlier formal release commit. Never move it to the Pages commit.

## 13. Final Verification

At minimum run:

```powershell
git log --oneline --decorate -n 10
git show-ref --tags <version>
git rev-parse '<version>^{}'
git status --short
git status --porcelain --untracked-files=no
```

Verify remotely, when access is available:

- `origin/main` equals the expected final local `main` commit;
- the release commit is an ancestor of `origin/main`;
- the remote version tag exists and peels exactly to the release commit;
- the fixed entry point targets the new formal artifact;
- no unexpected tracked modifications remain.

Recalculate the current and previous stable artifact hashes. Confirm previous stable artifacts and tags still match their recorded release notes. Report untracked temporary artifacts separately without deleting or staging them.

The final release record must include the release commit, tag object and peeled target, `origin/main` before and after, Pages decision and commit, artifact filename and SHA-256, schema version, validation totals, Known Issues, intentional exclusions, tracked-clean state, and remote synchronization state.

## 14. Stop Conditions

Stop the release and report the exact evidence if any of the following occurs:

- the approved RC or formal artifact digest differs from the checkpoint;
- RC-to-formal differences exceed the approved packaging transformation;
- validation evidence is incomplete, failed, ambiguous, or tied to another artifact;
- the staged release set changes unexpectedly or contains unrelated files;
- the version tag already exists locally or remotely;
- local and remote history unexpectedly diverge;
- a commit, tag, or normal push cannot be completed safely;
- a push would require force;
- a previous stable artifact or tag changed;
- the Pages update would require product logic changes;
- any executable change occurs after completed validation without the required rerun.

Do not bypass a stop condition by changing history, weakening verification, or silently broadening scope.

## 15. Resumable Checkpoints

Permissions, quota, connectivity, or tool availability may interrupt release administration. Before stopping, record enough state for another task or operator to continue without relying on chat history:

- repository root, Git directory, branch, `HEAD`, and `origin/main` SHA;
- local/remote divergence result and tag-existence result;
- RC and formal filenames and SHA-256 values;
- product and schema versions;
- Human QA, Full regression, representative verification, Known Issues, Deferred Follow-ups, and intentional exclusions;
- exact intended or staged paths;
- `git diff --cached --name-status`, `--stat`, and `--check` result;
- completed commit/tag/push steps and their full SHAs;
- Pages target and whether a separate Pages commit remains;
- the precise blocker and the next safe command.

On resume, verify these invariants rather than rebuilding, restaging, regenerating, or rerunning completed validation by default.

## 16. Codex Windows `.git` Sandbox Behavior

In the normal Codex Windows workspace sandbox, direct temporary writes inside `.git` may be denied even when the repository is valid and ordinary user-level Git access is available. This expected sandbox boundary is not, by itself, a release blocker.

- Do not modify Windows ACLs, ownership, repository permissions, or Git metadata permissions merely to bypass the sandbox.
- Use read-only Git commands normally.
- For operations that must write under `.git`—including staging, committing, tagging, and fetching—request explicit user approval/elevated execution when required.
- Request approval for network pushes when required and use only the intended non-force operation.
- After each approved write, verify the resulting index, commit, tag, or remote state before proceeding.

Sandbox approval changes execution authority only; it does not relax release scope, review requirements, or stop conditions.
