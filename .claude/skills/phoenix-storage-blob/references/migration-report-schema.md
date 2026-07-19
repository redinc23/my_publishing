# storage-migration-report.json

```json
{
  "migrated": 0,
  "failed": 0,
  "skipped": 0,
  "failures": [{ "key": "...", "error": "..." }],
  "started_at": "ISO-8601",
  "finished_at": "ISO-8601"
}
```

Success gate: `failed === 0` and HEAD sample of 10 rewritten URLs returns 200.
