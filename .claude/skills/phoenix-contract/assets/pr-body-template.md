# Phoenix PR — [WS# / Title]

## Task IDs

- [ ] **X.Y** — short description
- [ ] **X.Z** — short description

## Verification (from Phoenix doc)

| Task | Verification (doc) | Evidence                         |
| ---- | ------------------ | -------------------------------- |
| X.Y  | …                  | command output / screenshot note |

## §9.4 Master Checklist

Tick only boxes this PR completes:

- [ ] …

## Doc amendments

- None / list `docs:` commits and deltas (D#)

## Guardrails checklist

- [ ] No password-hash migration
- [ ] No secrets committed
- [ ] Edge middleware remains cookie-only (if touched)
- [ ] CI green (Jest; Playwright if applicable)
- [ ] Human gates logged in `HUMAN_TASKS.md` if blocked
