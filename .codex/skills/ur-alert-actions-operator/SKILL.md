---
name: ur-alert-actions-operator
description: Maintain the GitHub Actions and repository-state workflow for the UR alert bot. Use when editing workflow YAML, UTC schedule mappings for Japan time, state-file commit/push behavior, retention cleanup, or CI runtime setup for Playwright and Node.js in this repository.
---

# UR Alert Actions Operator

Read `/Users/minsukim/ur-alert-bot/README.md` before changing workflow or state-management behavior.

Treat GitHub Actions as the only scheduler. Do not introduce an in-app cron unless the product requirements change.

Preserve these operational rules:

- Run the workflow three times per day for `09:00`, `13:00`, and `17:00` in `Asia/Tokyo`.
- Use a single serial job for collect, alert, save, prune, and push.
- Never run retention cleanup in parallel with alert generation.
- Keep state in repository JSON files under `state/`.
- Retain only the latest `7` days of JSON state.

Structure the workflow in this order:

1. `actions/checkout`
2. Node.js setup
3. dependency install
4. Playwright browser install
5. alert runner execution
6. snapshot and daily file updates
7. retention cleanup
8. commit and push changed state files

Apply these workflow constraints:

- Add `concurrency` so overlapping scheduled runs do not race on `state/`.
- Keep the UTC cron mapping explicit for Japan time.
- Use repository auth that works non-interactively inside GitHub Actions.
- Limit commits to files that the workflow intentionally owns.
- Do not delete files needed for the current run before comparison is complete.

When reviewing changes, verify that the workflow still supports the fixed alert semantics from `/Users/minsukim/ur-alert-bot/README.md`.
