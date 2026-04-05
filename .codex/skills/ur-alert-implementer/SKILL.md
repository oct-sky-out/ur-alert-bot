---
name: ur-alert-implementer
description: Implement or refactor the UR alert bot in this repository. Use when working on TypeScript modules for config loading, Playwright crawling, UR detail-page parsing, priceMode matching, JSON snapshot state, and ntfy message generation while preserving the fixed schedule and alert semantics documented in README.md.
---

# UR Alert Implementer

Read `/Users/minsukim/ur-alert-bot/README.md` before changing code.

Preserve these product rules:

- Monitor at most `50` enabled targets from `config.json`.
- Treat `priceMode` as the only selector for price comparison.
- Send current-match alerts on every scheduled run.
- Send gone alerts only for items that disappeared since the immediately previous run.
- Send each gone alert at most once per calendar day in `Asia/Tokyo`.
- Retain JSON state for the latest `7` days only.
- Support alert language selection with only `ko` and `ja`.

Implement with these module boundaries unless existing code clearly uses a better split:

- `config`: load and validate `config.json` with `Zod`
- `crawler`: open UR detail pages with `Playwright`
- `parser`: normalize title, rent, fee, availability, and checked time
- `matcher`: compute `isMatched` from `priceMode` and `maxPriceYen`
- `state-store`: read and write `latest`, `daily`, and `snapshot` JSON files
- `notifier`: localize, format, and publish `ntfy` messages
- `retention`: prune JSON files older than 7 days after a successful run

Prefer these implementation rules:

- Normalize all money fields to integer yen before comparison.
- Keep parser failure visible in logs and result objects.
- Use stable target `id` values for diffing, never page titles.
- Write code so a GitHub Actions run can execute end-to-end without interactive input.
- Reject unsupported language values during config validation.
- Update `/Users/minsukim/ur-alert-bot/README.md` when behavior or config semantics change.

Test with scenario-style assertions that cover:

- `09:00 A,B` -> both notified
- `13:00 A only` -> `A current + B gone`
- `17:00 A only` -> `A current` only
- next day reset of `goneReportedIds`
- `rent_only` versus `rent_plus_fee`
- `ko` versus `ja` notifier output
