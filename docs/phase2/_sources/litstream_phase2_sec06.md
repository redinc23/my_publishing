## 6. Operational Runbook

This chapter documents the post-deployment operational procedures required to verify builds, monitor service health, execute rollbacks, and perform maintenance tasks on the Mangu Publishers production environment. All commands assume the operator has authenticated with `gcloud auth login` and set the active project with `gcloud config set project $PROJECT_ID`.

### 6.1 Verifying a Cloud Build Run

#### 6.1.1 Check Build Status and Stream Logs

After a push to `main` or a manual trigger, the first operational task is to confirm the Cloud Build pipeline has completed successfully. The `gcloud builds list` command returns the most recent builds in the `us-central1` region.

```bash
gcloud builds list --region=us-central1 --limit=5
```

Capture the most recent build identifier and inspect its status:

```bash
BUILD_ID=$(gcloud builds list --region=us-central1 --limit=1 --format='value(id)')
gcloud builds describe $BUILD_ID --region=us-central1 --format='value(status)'
```

The expected result is `SUCCESS`. Any other state — `FAILURE`, `CANCELLED`, `TIMEOUT`, or `WORKING` — requires further investigation. To stream the build logs in real time, use the log command:

```bash
gcloud builds log $BUILD_ID --region=us-central1
```

This streams the full output of all 16 build steps to the terminal. If the build is still in progress, the command attaches to the running stream; if the build has completed, it replays the archived log from Cloud Logging.

#### 6.1.2 Step-by-Step Log Verification Checklist

The pipeline consists of 16 discrete steps defined in `cloudbuild.yaml` (Section 4.2). Each step produces characteristic log output that operators must verify during post-deployment review. Table 6-1 enumerates every step, its step identifier, the expected log output pattern, and the failure indicator.

**Table 6-1: Cloud Build Step Verification Checklist**

| Step | ID                             | Expected Output Pattern                                                          | Failure Indicator                                       |
| ---- | ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | `restore-npm-cache`            | `✓ npm cache restored` or `⚠ No npm cache found — cold install`                  | `gsutil` permission denied or GCS path not found        |
| 2    | `install`                      | `added N packages` without `npm ERR!`                                            | `npm ERR!` exit code 1                                  |
| 3    | `production-audit`             | Audit results displayed, `✓ npm audit complete`                                  | Blocking error (step is non-blocking by design)         |
| 4    | `content-snapshot`             | `✓ Content snapshot generated` with book/author counts                           | Sanity API error, auth failure, or empty dataset        |
| 5    | `generate-routes`              | `✓ Routes JSON generated`                                                        | Missing `.cache/routes.json` output                     |
| 6    | `vite-build`                   | Vite build completes, asset manifest output                                      | Build error, out of memory, or missing assets           |
| 7    | `prerender`                    | `✓ Prerender complete` with page count                                           | Playwright timeout or prerender crash                   |
| 8    | `sitemap`                      | `sitemap.xml` generated with expected entry count                                | Missing sitemap file or route mismatch                  |
| 9    | `audit-secrets`                | Exit code 0, no leaked secret patterns found                                     | `audit-secrets` non-zero exit (secret leakage detected) |
| 10   | `smoke-test`                   | `Smoke check: N passed, 0 failed`                                                | Any failed smoke test (non-zero failure count)          |
| 11   | `docker-build`                 | Docker build output, final image digest                                          | `COPY failed` (missing `dist/`) or build error          |
| 12   | `docker-push`                  | `digest: sha256:…` for both `SHORT_SHA` and `latest` tags                        | Push permission denied or network timeout               |
| 13   | `enforce-vulnerability-policy` | `✓ No HIGH/CRITICAL vulnerabilities — deploy approved`                           | `DEPLOY BLOCKED: HIGH/CRITICAL vulnerability detected`  |
| 14   | `deploy-run`                   | `Service [mangu-publishers] revision [mangu-publishers-XXXXX] has been deployed` | Cloud Run deployment error or quota exceeded            |
| 15   | `prune-tags`                   | `✓ Pruned N old tags` or `✓ No tags to prune`                                    | Cloud Run API error or permission denied                |
| 16   | `save-npm-cache`               | Cache saved to `gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`            | GCS write failure or bucket not found                   |

Steps 9 and 13 are **gate steps** — failures halt the pipeline. A failure at step 9 indicates the `SANITY_API_READ_TOKEN` or another secret value was detected in the compiled `dist/` output, which constitutes a P0 security incident per Section 5.3.1. A failure at step 13 means the container image contains HIGH or CRITICAL CVEs that must be remediated before deployment proceeds. All other step failures should be treated as blocking errors that prevent continuation of the pipeline.

#### 6.1.3 Verify Build Artifacts and Log Security

After confirming all 16 steps passed, verify that the build artifacts exist in Artifact Registry with the expected tags:

```bash
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers \
  --include-tags --format="table(tags, updateTime)"
```

The output must show two tags for the new image: the commit `SHORT_SHA` and `latest`. If either tag is missing, the push step or tagging logic failed and must be investigated.

To verify that no secrets leaked into the build logs, query Cloud Logging for the token pattern or the environment variable name:

```bash
gcloud logging read \
  "resource.labels.build_id=$BUILD_ID AND \
   (textPayload:\"sk\" OR textPayload:\"SANITY_API_READ_TOKEN\")" \
  --limit=10 --format="table(timestamp, textPayload)"
```

The `options.logging: CLOUD_LOGGING_ONLY` setting in `cloudbuild.yaml` (Section 4.2) prevents secret values from being written to the legacy Cloud Storage log bucket. The query above must return zero results. Any match indicates a logging configuration regression that must be escalated.

### 6.2 Checking Cloud Run Service Health

#### 6.2.1 Describe Service Configuration

Once the build succeeds, verify that Cloud Run deployed the service with the correct configuration parameters. The `gcloud run services describe` command returns the full service specification.

```bash
gcloud run services describe mangu-publishers --region=us-central1 --format="yaml"
```

Table 6-2 specifies every configuration parameter that must be present in the deployed service. Operators must verify each value against the output of the describe command.

**Table 6-2: Cloud Run Expected Configuration Parameters**

| Parameter             | Expected Value                                                                  | Verification Path                                                                | Purpose                                      |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Container image       | `us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:$SHORT_SHA` | `spec.template.spec.containers[0].image`                                         | Immutable SHA-tagged image reference         |
| Container port        | `8080`                                                                          | `spec.template.spec.containers[0].ports[0].containerPort`                        | nginx listens on 8080                        |
| Memory limit          | `512Mi`                                                                         | `spec.template.spec.containers[0].resources.limits.memory`                       | gen2 execution environment requirement       |
| CPU limit             | `1`                                                                             | `spec.template.spec.containers[0].resources.limits.cpu`                          | Single vCPU per instance                     |
| Concurrency           | `80`                                                                            | `spec.template.spec.containerConcurrency`                                        | Max 80 concurrent requests per instance      |
| Min instances         | `0`                                                                             | `spec.template.metadata.annotations["autoscaling.knative.dev/minScale"]`         | Scale to zero when idle                      |
| Max instances         | `10`                                                                            | `spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]`         | Upper bound for cost control                 |
| Execution environment | `gen2`                                                                          | `spec.template.metadata.annotations["run.googleapis.com/execution-environment"]` | Second-gen Cloud Run runtime                 |
| CPU throttling        | `true`                                                                          | `spec.template.metadata.annotations["run.googleapis.com/cpu-throttling"]`        | Throttle CPU outside request handling        |
| Default URL           | disabled                                                                        | `--no-default-url` flag                                                          | Traffic routes through Firebase Hosting only |
| Labels                | `env=prod,app=mangu-publishers`                                                 | `spec.template.metadata.labels`                                                  | Resource identification and filtering        |

Any deviation from the values in Table 6-2 indicates a deployment configuration drift. The most common causes are manual service edits through the GCP Console, prior deployments with different flags, or substitution variable overrides in the Cloud Build trigger.

#### 6.2.2 Health Check via Service URL

After verifying the configuration, validate that the service responds correctly to HTTP requests. Retrieve the direct Cloud Run URL (not the Firebase Hosting domain) and execute health checks:

```bash
RUN_URL=$(gcloud run services describe mangu-publishers --region=us-central1 --format='value(status.url)')
curl -s -o /dev/null -w "%{http_code}" "$RUN_URL/healthz"
```

The expected HTTP status code is `200`. Next, verify the home page:

```bash
curl -s -o /dev/null -w "%{http_code}" "$RUN_URL/"
```

This must also return `200`. Finally, inspect the security headers returned by the nginx container:

```bash
curl -sI "$RUN_URL/" | grep -E "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|cache-control"
```

The response must include `X-Frame-Options: DENY` (or `SAMEORIGIN`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a `Content-Security-Policy` header that does not include `api.sanity.io` in the connect-src directive (per P0-1 enforcement, Section 5.3.1).

Check the traffic distribution to confirm 100% of traffic is routed to the newly deployed revision:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | jq '.status.traffic'
```

The expected output is a single traffic entry with `"percent": 100` pointing to the latest revision name (e.g., `mangu-publishers-abcde12`). Multiple traffic entries with split percentages indicate a partial rollout or an incomplete rollback that requires correction.

#### 6.2.3 Monitor Metrics via Cloud Monitoring

Request count and memory utilization metrics provide operational insight into the health of the deployed service. Query Cloud Monitoring for request counts in the last hour, grouped by response code:

```bash
gcloud monitoring metrics list \
  --filter='metric.type="run.googleapis.com/request_count"' \
  --format="table(metric.labels.response_code, points.value.int64_value)"
```

Check memory utilization to ensure the 512Mi allocation is sufficient:

```bash
gcloud monitoring metrics list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations"' \
  --format="table(points.value.double_value)"
```

Memory utilization consistently above 80% indicates the 512Mi limit may be insufficient for the current workload or that a memory leak exists in the container. Sustained 4xx or 5xx error rates above 1% of total requests warrant investigation of the application logs via Cloud Logging.

### 6.3 Rollback Procedure

#### 6.3.1 List Revisions and Identify Last Good Revision

If a deployment introduces errors, the rollback procedure moves traffic from the current revision to the previously known-good revision. First, list all revisions for the service:

```bash
gcloud run revisions list --service=mangu-publishers --region=us-central1 \
  --format="table(name, creationTimestamp, trafficPercent)"
```

The output lists revisions in reverse chronological order. The revision at the top (100% traffic) is the current deployment. The target for rollback is the revision immediately below it — the most recent revision with `TRAFFIC_PERCENT: 0` that predates the bad deployment. If the revision history contains more than one candidate, select the revision with the latest `CREATION_TIMESTAMP` that was known to be stable.

#### 6.3.2 Roll Back Traffic

Execute the traffic shift using the `gcloud run services update-traffic` command with the `--to-revisions` flag. The command below captures the second revision in the list (the previous one) and routes 100% of traffic to it:

```bash
PREV_REVISION=$(gcloud run revisions list --service=mangu-publishers \
  --region=us-central1 --format="value(name)" | sed -n '2p')
gcloud run services update-traffic mangu-publishers --region=us-central1 \
  --to-revisions "$PREV_REVISION=100" --yes
```

The `--yes` flag suppresses the interactive confirmation prompt, which is appropriate in automated or time-sensitive rollback scenarios. After the command completes, verify the traffic distribution:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | jq '.status.traffic'
```

The output must show a single entry with `"percent": 100` assigned to `$PREV_REVISION`.

#### 6.3.3 Verify Rollback and Clean Up

Confirm the rollback by requesting the public endpoint through Firebase Hosting:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://www.yourdomain.com/"
```

An HTTP 200 response confirms the rollback is serving correctly. If the custom domain returns errors, check the Cloud Run URL directly to isolate Firebase Hosting issues from application issues.

After confirming the rollback is stable for at least 30 minutes, delete the faulty revision to free resources:

```bash
BAD_REVISION=$(gcloud run revisions list --service=mangu-publishers \
  --region=us-central1 --format="value(name)" | head -1)
gcloud run revisions delete "$BAD_REVISION" --region=us-central1 --quiet
```

Deletion of the bad revision is irreversible. Do not delete the revision until the rollback has been validated and the root cause of the failure has been documented.

### 6.4 Manual Rebuild Triggers

#### 6.4.1 Method Comparison

Four distinct methods exist for triggering a rebuild when no code changes are required, such as when Sanity content has been updated but the application source is unchanged. Table 6-3 compares each method across six operational dimensions.

**Table 6-3: Manual Rebuild Method Comparison**

| Method                       | Prerequisites                           | Speed     | Automation Readiness   | Audit Trail                               | Best For                            | Risk Level |
| ---------------------------- | --------------------------------------- | --------- | ---------------------- | ----------------------------------------- | ----------------------------------- | ---------- |
| `gcloud builds submit`       | Local gcloud auth, `cloudbuild.yaml`    | ~8–12 min | Manual only            | Cloud Build history                       | Ad-hoc rebuilds, local testing      | Low        |
| `gcloud builds triggers run` | Trigger `mangu-publishers-main` exists  | ~8–12 min | Scriptable via API     | Cloud Build history + trigger attribution | Operator-initiated content rebuilds | Low        |
| Empty commit + push          | Write access to `main`, Git CLI         | ~8–12 min | Fully automated via CI | Git commit + Cloud Build history          | Routine content-update rebuilds     | Low        |
| Sanity webhook (M7)          | Webhook validator deployed, HMAC secret | ~3–5 min  | Fully automated        | Cloud Build history + webhook log         | Production content publishing       | Low        |

The Sanity webhook method (Section 6.4.5) is the target state after Milestone 7 implementation. Until then, the empty commit method (Section 6.4.4) is the recommended approach for routine rebuilds because it preserves a complete audit trail in both Git and Cloud Build.

#### 6.4.2 Method 1: gcloud builds submit

Submit a build manually with explicit substitutions matching the production trigger configuration:

```bash
gcloud builds submit --config=cloudbuild.yaml --region=us-central1 \
  --substitutions=_REGION=us-central1,_AR_REPO=web-images,\
  _SERVICE=mangu-publishers,_CACHE_BUCKET=mangu-publishers-cloudbuild-cache \
  --async
```

The `--async` flag returns immediately without waiting for the build to complete. The `SANITY_API_READ_TOKEN` is automatically resolved from Secret Manager via the `availableSecrets` binding in `cloudbuild.yaml` (Section 4.2). Monitor the build with `gcloud builds log` as described in Section 6.1.1.

#### 6.4.3 Method 2: gcloud builds triggers run

Trigger the existing GitHub-connected build trigger directly:

```bash
gcloud builds triggers run mangu-publishers-main --region=us-central1 --branch=main
```

This method executes the same `cloudbuild.yaml` configuration used by the Developer Connect webhook but does not require a Git push. It is the preferred method when an operator needs to rebuild from the exact same commit currently at `main` head without introducing a new commit. The trigger attribution in Cloud Build history distinguishes these runs from webhook-triggered builds.

#### 6.4.4 Method 3: Empty Git Commit

Create an empty commit and push to `main` to trigger the Developer Connect webhook:

```bash
git commit --allow-empty -m "ops: rebuild after content update $(date +%s)"
git push origin main
```

The `$(date +%s)` suffix ensures each commit message is unique, preventing Git from rejecting the push as a duplicate. The Developer Connect webhook fires within seconds of the push, queuing a new Cloud Build run. This method is fully auditable — the Git history contains a permanent record of every rebuild trigger.

#### 6.4.5 Method 4: Sanity Webhook (Automated After M7)

After Milestone 7, a Sanity webhook validator endpoint receives signed `POST` requests from Sanity Studio on every content publish event. The validator verifies the HMAC signature and replay protection, then triggers Cloud Build via the REST API. The flow is:

1. Content editor publishes a change in Sanity Studio.
2. Sanity sends a signed `POST` to the validator endpoint.
3. Validator verifies the HMAC signature and timestamp freshness.
4. Validator calls Cloud Build API to trigger `mangu-publishers-main`.
5. Build completes in approximately 3–5 minutes (the reduction from 8–12 minutes is due to cache warming from frequent builds).

Verify webhook-triggered builds by filtering Cloud Build history for builds initiated by the API:

```bash
gcloud builds list --region=us-central1 --limit=10 \
  --format="table(id, status, source)"
```

Look for builds where the source provenance indicates API trigger rather than Developer Connect webhook.

### 6.5 Token Rotation Procedure

#### 6.5.1 Generate New Token and Add to Secret Manager

The `SANITY_API_READ_TOKEN` must be rotated every 90 days or immediately upon suspected compromise. Generate a new token in the Sanity Studio management console:

1. Navigate to `sanity.io/manage` → Project → API → Tokens.
2. Click "Add API token."
3. Set the name to `Mangu Publishers Build (Rotated YYYY-MM-DD)`.
4. Assign the **Viewer** role (read-only — no write permissions).
5. Copy the token value (starts with `sk`).

Add the new token as a new version in Secret Manager:

```bash
echo -n "sk-your-new-token-here" | \
  gcloud secrets versions add sanity-api-read-token --data-file=-
```

Verify the new version was created with state `ENABLED`:

```bash
gcloud secrets versions list sanity-api-read-token \
  --format="table(version, state, createTime)"
```

Cloud Build's `availableSecrets` configuration references `versions/latest`, which automatically resolves to the most recently enabled version. Confirm the latest pointer resolves to the new token:

```bash
gcloud secrets versions access latest --secret=sanity-api-read-token
```

#### 6.5.2 Verify Build Uses New Token

Trigger a test build to confirm the new token functions correctly:

```bash
gcloud builds triggers run mangu-publishers-main --region=us-central1 --branch=main
```

Monitor the build logs for the content-snapshot step:

```bash
gcloud builds log $(gcloud builds list --region=us-central1 --limit=1 --format='value(id)') \
  --region=us-central1
```

The log must show `📥 Fetching content from Sanity...` followed by book and author counts matching the current dataset. A failure at this step indicates the token lacks the Viewer role or the Secret Manager binding is misconfigured.

#### 6.5.3 Disable Old Token

Table 6-4 defines the phased timeline for completing token rotation safely.

**Table 6-4: Token Rotation Timeline**

| Phase | Time After Rotation | Action                                                   | Command / Location                                                                                                                                                                                                                     |
| ----- | ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T+0   | Immediate           | Generate new token, add to Secret Manager as new version | `gcloud secrets versions add sanity-api-read-token`                                                                                                                                                                                    |
| T+0   | Immediate           | Verify `versions/latest` resolves to new token           | `gcloud secrets versions access latest --secret=sanity-api-read-token`                                                                                                                                                                 |
| T+0   | Immediate           | Trigger test build and verify content snapshot succeeds  | `gcloud builds triggers run mangu-publishers-main --branch=main`                                                                                                                                                                       |
| T+24h | 24 hours            | Disable old Secret Manager version (do NOT delete)       | `OLD_VERSION=$(gcloud secrets versions list sanity-api-read-token --format="table(version, state)" \| grep ENABLED \| tail -1 \| awk '{print $1}')` then `gcloud secrets versions disable $OLD_VERSION --secret=sanity-api-read-token` |
| T+7d  | 7 days              | Delete old Sanity token from Sanity Studio console       | `sanity.io/manage` → API → Tokens → Delete old token                                                                                                                                                                                   |

The 24-hour window between enabling the new version and disabling the old version ensures that any in-flight builds or cached references have time to drain. The 7-day window before deleting the Sanity token provides a recovery path if the new token is found to be defective after extended use. After 7 days, only one `ENABLED` Secret Manager version should remain.

### 6.6 Billing and Cost Monitoring

#### 6.6.1 Check Billing Budgets and Alert Thresholds

Monitor billing through both gcloud commands and the GCP Console. List active billing budgets:

```bash
gcloud billing budgets list --billing-account=YOUR_BILLING_ACCOUNT_ID
```

Inspect the alert thresholds for each budget:

```bash
gcloud billing budgets describe BUDGET_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
```

In the GCP Console, navigate to Billing → Budgets & Alerts and verify that alert thresholds are configured at 50%, 75%, and 90% of the monthly budget. Confirm that notification channels (email addresses) are active and that at least one channel includes the on-call operator.

View the current month's spend with:

```bash
gcloud billing accounts get-usage-report YOUR_BILLING_ACCOUNT_ID \
  --start-time=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d) \
  --end-time=$(date +%Y-%m-%d)
```

For the Mangu Publishers project, the primary cost drivers are Cloud Run container instances (compute time), Artifact Registry storage (container images), and Cloud Build execution (build minutes). Cloud Run costs scale with traffic volume due to the `min-instances=0` setting; Artifact Registry costs scale with the number of retained image versions.

#### 6.6.2 Check Artifact Registry Image Count and Cleanup Policy

Count the total number of image versions stored in the repository:

```bash
IMAGE_COUNT=$(gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers \
  --format="value(digest)" | wc -l)
echo "Total images: $IMAGE_COUNT"
```

Verify the cleanup policy is active:

```bash
gcloud artifacts repositories describe web-images --location=us-central1 \
  --format="yaml(cleanupPolicies)"
```

The cleanup policy has two rules: (1) **keep-recent-tagged-release-images** retains the 15 most recent tagged images, and (2) **delete-old-untagged-images** deletes untagged images older than 3 days (259,200 seconds). If `IMAGE_COUNT` exceeds 50, the cleanup policy may not be executing correctly and requires investigation.

#### 6.6.3 Manual Image Cleanup

If the cleanup policy fails or if immediate space reclamation is required, delete specific images manually:

```bash
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:old-tag \
  --delete-tags --quiet
```

Use `--delete-tags` to remove the tag reference before deleting the underlying image layer. This command is irreversible; verify the tag is not referenced by an active Cloud Run revision before execution.

### 6.7 Tag Pruning Operations

#### 6.7.1 Automatic and Manual Execution

Firebase Hosting's `pinTag: true` configuration creates a new Cloud Run traffic tag on every deployment. Without pruning, these tags accumulate indefinitely, eventually exceeding Cloud Run service limits and degrading the GCP Console performance for the service.

**Automatic execution** occurs as Cloud Build step 15 (`prune-tags`) immediately after every successful deployment. The step executes the `prune-cloud-run-tags.sh` script with default parameters:

```yaml
- id: prune-tags
  name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
  entrypoint: bash
  args:
    - '-c'
    - |
      set -euo pipefail
      bash scripts/ops/prune-cloud-run-tags.sh || true
```

The `|| true` suffix ensures that a tag pruning failure does not fail the entire build.

**Manual execution** is required if step 15 was skipped, failed, or if an operator needs to prune tags outside the build pipeline. Set the required environment variables and execute:

```bash
export SERVICE=mangu-publishers
export REGION=us-central1
export KEEP=50
chmod +x scripts/ops/prune-cloud-run-tags.sh
./scripts/ops/prune-cloud-run-tags.sh
```

The script queries all traffic tags on the service, sorts them by creation time, and removes tags beyond the `KEEP` threshold (default 50). The expected output is either `✓ No tags to prune (total tags ≤ 50)` or `✓ Pruned N old tags` with a per-tag log of deletions.

#### 6.7.2 Verify Tag Count and Optional Scheduling

After pruning, verify the remaining tag count:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | \
  jq '[.status.traffic[] | select(.tag != null)] | length'
```

The count must be less than or equal to 50 (or the `KEEP` value if overridden). List the remaining tags for visual confirmation:

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="json(status.traffic)" | \
  jq '.status.traffic[] | select(.tag != null) | .tag'
```

For additional operational safety, a Cloud Scheduler job can run the pruning script weekly as a fallback. The Cloud Build step 15 approach is preferred because it runs immediately after each deploy, keeping tags in sync with actual deployments. A scheduled job only catches cases where the build step was bypassed. To create the job:

```bash
gcloud scheduler jobs create http prune-cloud-run-tags-weekly \
  --schedule="0 2 * * 0" \
  --uri="https://cloudbuild.googleapis.com/v1/projects/$PROJECT_ID/builds" \
  --http-method=POST \
  --time-zone="UTC"
```

This schedule runs at 02:00 UTC every Sunday. The job should target a minimal Cloud Build configuration that executes only the tag pruning script, not the full 16-step pipeline. Before enabling a scheduled job, verify through the Cloud Build history that step 15 has been failing silently — if step 15 is working correctly, the scheduled job will be redundant but harmless.
