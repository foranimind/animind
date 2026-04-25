# Motionverse Studio Display Name Rename

## Context

The web frontend currently exposes the brand name `Animind Studio` in user-visible UI copy and the HTML document title. The requested change is to rename only the user-facing display name to `Motionverse Studio`.

## Goal

Update all user-visible occurrences of `Animind Studio` in `apps/web` to `Motionverse Studio` without changing internal routing, storage, or other non-display identifiers.

## In Scope

- Replace visible UI copy that renders `Animind Studio` to end users.
- Replace the HTML `<title>` value shown in the browser tab.
- Update frontend tests that assert the visible display name.

## Out of Scope

- Route paths such as `/studio`.
- Internal storage and event keys such as `foranimind.*`.
- Non-user-facing identifiers, comments, and code structure.
- README or repository documentation changes outside the implementation needed for the frontend display name.

## Implementation Approach

1. Search `apps/web` for all occurrences of `Animind Studio`.
2. Keep only user-visible occurrences in the change set.
3. Update the affected tests first so they assert `Motionverse Studio`.
4. Apply the minimal production code changes needed to satisfy those tests.

## Validation

- Run targeted frontend tests covering the renamed UI text.
- Run a focused frontend build or test command as needed to confirm no regressions from the rename.
