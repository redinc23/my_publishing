# MANGU Launch Folder

This folder is the production launch home base.

Use these documents instead of the older Vercel or AWS Amplify deployment notes unless the team explicitly decides to change hosting targets.

## Files

| File | Purpose |
| --- | --- |
| [ONE_PRODUCTION_BUILD.md](./ONE_PRODUCTION_BUILD.md) | The single canonical build and release runbook: Cloud Build -> Cloud Run. |
| [PRODUCTION_ACCOUNT_LINKS.md](./PRODUCTION_ACCOUNT_LINKS.md) | Safe workbook for account/dashboard hyperlinks, IDs, owners, and launch evidence. Do not paste secrets. |

## Canonical production path

```text
main branch
  -> cloudbuild.yaml
  -> npm ci
  -> lint + type-check + unit tests
  -> next build
  -> secret audit
  -> Docker image
  -> Artifact Registry
  -> Cloud Run service: mangu-publishers
```

## Legacy paths

The repository still contains Vercel and AWS Amplify files for reference and compatibility. They are not the production launch path.

