# Contributing

This repository uses `main` as the release branch and `dev` as the day-to-day integration branch.

## Workflow

1. Branch from `dev` for feature work unless a maintainer asks for a different base.
2. Keep each branch focused on one change set.
3. Run the relevant tests before opening a PR or merging.
4. Merge reviewed work into `dev`, then promote `dev` to `main` for releases.

## Repository Hygiene

- Do not commit model weights, datasets, logs, cache directories, or runtime outputs.
- Keep secrets in local `.env` files, never in tracked files.
- Use the existing directory structure instead of adding one-off folders at the repo root.

## Pull Requests

- Use a clear title that summarizes the user-visible or developer-visible change.
- Include the verification steps you ran.
- Call out any third-party dependency, data, or model requirement added by the change.

## Additional Notes

- The previous Chinese collaboration notes were moved to `docs/process/github-collaboration-guide.zh-CN.md`.
- Archived draft process/spec documents live under `docs/archive/`.
