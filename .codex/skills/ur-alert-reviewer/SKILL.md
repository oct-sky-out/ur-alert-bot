---
name: ur-alert-reviewer
description: Review or test the UR alert bot against its fixed behavior. Use when validating alert semantics, gone-once-per-day logic, 7-day snapshot retention, config interpretation, or GitHub Actions scheduling changes in this repository.
---

# UR Alert Reviewer

Read `/Users/minsukim/ur-alert-bot/README.md` before reviewing code or tests.

Prioritize behavior regressions over style.

Review against these fixed expectations:

- enabled target count is capped at `50`
- `priceMode` controls whether comparison uses `rentYen` or `rentYen + feeYen`
- supported alert languages are only `ko` and `ja`
- every scheduled run reports all current matches
- gone alerts are based on the immediately previous run only
- a gone alert is emitted at most once per day per target
- JSON state older than `7` days is pruned after successful persistence
- workflow execution is serial, not parallel

Use this scenario as a mandatory regression check:

- `09:00`: `A, B` matched -> expect `A/B` current alerts
- `13:00`: `A` matched -> expect `A` current alert and `B` gone alert
- `17:00`: `A` matched -> expect `A` current alert only

Look for missing tests around:

- next-day reset of gone tracking
- disabled targets
- parser failure handling
- duplicate target ids
- localized notifier templates for `ko` and `ja`
- UTC-to-JST schedule mapping in GitHub Actions

When findings exist, cite the exact file and explain the user-visible regression.
