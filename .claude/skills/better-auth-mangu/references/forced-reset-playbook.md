# Forced Reset Playbook

## Per-user (dev / support)

```bash
npx tsx scripts/request-password-reset.ts --email user@example.com
```

(Adjust flags to match script CLI when implemented.)

## Batch (Phase 11 / cutover)

```bash
npx tsx scripts/send-forced-resets.ts --dry-run
# Human approval, then:
npx tsx scripts/send-forced-resets.ts --execute
```

Requirements for the batch script:

- Rate limited
- Progress log
- Failure report artifact
- Idempotent enough to retry failures without double-spamming unchecked

## Expected user experience

1. Legacy password rejected / locked
2. Banner points to inbox
3. Reset link sets new Better Auth credential
4. Telemetry: completion rate tracked for North Star #7
