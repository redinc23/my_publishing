## 7. Risk Assessment & Troubleshooting

This chapter catalogs identified risks, milestone-specific failure modes, cross-cutting issues, and the SDLC quality gates that prevent them. Every risk is scored by probability and impact, assigned an owner, and paired with concrete mitigation. Troubleshooting entries follow a Symptom → Root Cause → Exact Fix structure. The seven SDLC quality gates form the primary defense layer.

### 7.1 Risk Register

The risk register contains eight risks spanning security, infrastructure, deployment, and tooling. Risks R1–R6 were discovered during Phase 2 implementation; R7 and R8 were added after production incident review.

#### 7.1.1 Risk Matrix

| ID | Description | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Secret leakage via `VITE_` prefix inlining token into browser bundle | Medium | Critical | `audit:secrets` script, Zod validation, grep checks across `src/` | Security Lead |
| R2 | Cloud Run deployment failure due to 256Mi memory floor on gen2 | High | High | ADR-003 correction to `--memory=512Mi`; validate in cloudbuild.yaml | Platform Engineer |
| R3 | Developer Connect OAuth interruption blocking GitHub-triggered builds | Medium | High | Verify GitHub owner rights before starting; allow retry with delete/recreate | Platform Engineer |
| R4 | Immutable tag conflict on `:latest` push blocking Artifact Registry write | Medium | Medium | Remove `--immutable-tags` from repository or push SHA-only images | Platform Engineer |
| R5 | Vulnerability scan (HIGH/CRITICAL CVE) blocking deployment pipeline | Medium | Medium | Update base image to latest patch; acceptable-risk override with documented exception | Security Lead |
| R6 | Playwright timeout during prerender in Cloud Build environment | Medium | Medium | Increase step timeout to 600s; upgrade Playwright image to `v1.59.1-noble` | Build Engineer |
| R7 | Webhook content update not reflected on site after Sanity publish | Medium | Medium | Clear npm cache; verify token dataset access; check webhook payload | Build Engineer |
| R8 | `.env.local` committed to git exposing SANITY_API_READ_TOKEN | Low | Critical | `git filter-repo` history rewrite; rotate token; force push; update `.gitignore` | Security Lead |

#### 7.1.2 R1 — Secret Leakage via VITE_ Prefix

A developer reintroduces `VITE_SANITY_API_READ_TOKEN` or fails to complete the rename to `SANITY_API_READ_TOKEN`, causing Vite to inline the secret into the client-side JavaScript bundle. Vite exposes all `VITE_`-prefixed variables to browser code via `import.meta.env` — any visitor could extract the token from `dist/assets/*.js` and gain read access to all Sanity content.

**Mitigation layers:** (1) `npm run audit:secrets` (Cloud Build step 9) greps `dist/assets/` for the token string and fails the build if found; (2) `scripts/_lib/node-env.ts` validates `SANITY_API_READ_TOKEN` via `z.string().min(1)` — the absence of the `VITE_` prefix ensures Vite ignores it; (3) build scripts live in `scripts/`, not `src/` — importing `node-env.ts` from `src/` would bundle the token; (4) Gate 3 (REVIEW) requires `git diff --cached | grep -i token` before every commit.

**Residual risk:** A developer could intentionally add `VITE_SANITY_API_READ_TOKEN` to `.env.local` and reference it from `src/`. The `audit:secrets` script is the final backstop.

#### 7.1.3 R2 — Cloud Run Deployment Failure (256Mi Memory)

The `cloudbuild.yaml` deploy step specifies `--memory=256Mi`, which Cloud Run gen2 rejects because 512 MiB is the architectural minimum. The v11 specification incorrectly specified 256Mi; ADR-003 records the correction. Verify before pushing: `grep -- "--memory=512Mi" cloudbuild.yaml` must match. If 256Mi is present: `sed -i 's/--memory=256Mi/--memory=512Mi/g' cloudbuild.yaml`. Cost impact is negligible — Cloud Run bills for actual usage, and nginx static serving consumes less than 50 MiB.

#### 7.1.4 R3 — Developer Connect OAuth Interruption

The browser-based OAuth flow for Developer Connect fails, or the GitHub app is not installed on the repository, blocking automatic builds. Triggers: operator lacks Owner/Admin rights; browser popup blocked; OAuth session expired; app installation skipped.

**Mitigation:** Confirm GitHub ownership before initiating. Use a browser with no popup blockers. If OAuth fails, delete and retry:

```bash
gcloud developer-connect connections delete my-github-connection --location="$REGION"
gcloud developer-connect connections create my-github-connection --location="$REGION" --github-config-app=developer-connect
```

Verify status shows `ACTIVE`.

#### 7.1.5 R4 — Immutable Tag Conflict on :latest Push

Artifact Registry created with `--immutable-tags` prevents overwriting `:latest`. **Option A (recommended):** `gcloud artifacts repositories update "$AR_REPO" --location="$REGION" --no-immutable-tags` — SHA-tagged images provide true immutability; `:latest` is a convenience pointer that must be mutable. **Option B:** Push SHA-only by removing `:latest` from the `docker-build` step. **Option C:** Delete existing tag before push — race-prone in CI, not recommended.

#### 7.1.6 R5 — Vulnerability Scan Blocking Deployment

Cloud Build step 13 blocks deployment on HIGH or CRITICAL CVEs. Some CVEs in the base image may not be exploitable in the Mangu Publishers context (static file serving, no runtime secrets). **Mitigation hierarchy:** (1) update base image to latest patch (e.g., `nginx:1.27.1-alpine`); (2) switch to hardened image (`gcr.io/distroless/nginx`); (3) temporary override — change `grep -qE "CRITICAL|HIGH"` to `grep -qE "CRITICAL"` with documented exception. Identify specific vulnerabilities: `gcloud artifacts docker images list-vulnerabilities <image> --location="$REGION" --format="table(vulnerability, package, version, effectiveSeverity)"`.

#### 7.1.7 R6 — Playwright Timeout in Cloud Build

The prerender step uses Playwright Chromium; in Cloud Build, browser launch or navigation exceeds the default 30-second timeout. Root causes: slower worker I/O, pinned image compatibility, or static server startup failure. Apply in order: (1) increase timeout to 60000 in `scripts/prerender.ts`; (2) add `timeout: 600s` to the Cloud Build step; (3) upgrade Playwright image from `v1.43.0-jammy` to `v1.59.1-noble`.

#### 7.1.8 R7 — Webhook Content Not Updating Site

A Sanity publish triggers Cloud Build but the site shows stale content. Causes: stale npm cache with old `contentSnapshot.json`; token lacking dataset access; webhook payload missing the document type. Check Cloud Build logs — book count should match Sanity. If not, clear cache: `gsutil rm gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`. Verify webhook triggers on Create, Update, Delete events.

#### 7.1.9 R8 — .env.local Committed to Git

A developer commits `.env.local` containing `SANITY_API_READ_TOKEN`. Recovery: (1) `git filter-repo --path .env.local --invert-paths`; (2) `echo ".env.local" >> .gitignore && echo ".env*.local" >> .gitignore`; (3) rotate token in Sanity Studio; (4) update Secret Manager: `echo -n "sk-new-token" | gcloud secrets versions add sanity-api-read-token --data-file=-`; (5) `git push --force-with-lease origin main`. If the token was pushed to a remote, treat it as compromised — anyone who fetched during the exposure window has a copy.

### 7.2 Milestone-Specific Troubleshooting

#### 7.2.1 M1 — Local Security Hardening

**M1-1: Zod Validation Error — "SANITY_API_READ_TOKEN is required"**

**Symptom:** Build outputs `BUILD ENVIRONMENT VALIDATION FAILED` with `SANITY_API_READ_TOKEN is required`.
**Root Cause:** `SANITY_API_READ_TOKEN` is not set; `node-env.ts` uses `z.string().min(1)` requiring a non-empty string.
**Exact Fix:** `echo "SANITY_API_READ_TOKEN=sk-your-actual-token" >> .env.local`, verify with `cat .env.local`. Always run `npm run build` locally before pushing.

**M1-2: VITE_SANITY_API_READ_TOKEN Still Found in grep**

**Symptom:** `grep -rn "VITE_SANITY_API_READ_TOKEN" .` returns matches in source files.
**Root Cause:** Rename from `VITE_SANITY_API_READ_TOKEN` to `SANITY_API_READ_TOKEN` was incomplete.
**Exact Fix:** Run find/sed rename across `.ts`, `.tsx`, `.js`, `.yaml`, `.env*` files (macOS: `sed -i ''`; Linux: `sed -i`). Verify grep returns empty. Critical: verify no `import.meta.env.VITE_SANITY_API_READ_TOKEN` exists in `src/`.

**M1-3: audit:secrets Fails After Build**

**Symptom:** `npm run audit:secrets` outputs a `dist/assets/` file path containing the literal token string; exits code 1.
**Root Cause:** Token inlined into Vite bundle. Occurs when: (a) `VITE_` prefix remains in `src/`, (b) `node-env.ts` imported from a Vite-bundled file, or (c) token hardcoded in source.
**Exact Fix:** (1) `grep -rn "SANITY_API_READ_TOKEN" src/` — should return nothing; (2) `grep -rn "node-env" src/` — should return nothing; (3) if `node-env.ts` is in `src/lib/`, move to `scripts/_lib/` and update imports; (4) `rm -rf dist/ && npm run build && npm run audit:secrets`.

#### 7.2.2 M2 — Build Pipeline Scripts

**M2-1: build:content Fails with "Unauthorized - Invalid token"**

**Symptom:** `Content snapshot failed: Error: Unauthorized - Invalid token`.
**Root Cause:** `SANITY_API_READ_TOKEN` is invalid, expired, or lacks read permissions.
**Exact Fix:** In Sanity Studio (sanity.io/manage → API → Tokens), verify token has "Viewer" or "Editor" role. Create new token with "Viewer" role if needed, update `.env.local`, then test: `npx tsx scripts/build-content-snapshot.ts`.

**M2-2: build:prerender Fails with Playwright Browser Error**

**Symptom:** `Error: browserType.launch: Executable doesn't exist at /ms-playwright/chromium-...`.
**Root Cause:** Playwright browsers not installed locally.
**Exact Fix:** `npx playwright install chromium`. Verify version matches `cloudbuild.yaml` pin (v1.43.0). If mismatch: `npm install --save-dev playwright@1.43.0 && npx playwright install chromium`.

**M2-3: build:prerender Hangs Indefinitely**

**Symptom:** `Prerendering HTML shells... Rendering /...` hangs for more than 60 seconds.
**Root Cause:** Static file server failed to start, or port 4173 is in use.
**Exact Fix:** Check port: `lsof -i :4173`. Kill process: `kill -9 $(lsof -t -i:4173) 2>/dev/null`. Verify `serve` installed: `npm ls serve || npm install --save-dev serve`. Diagnose: `DEBUG=* npx tsx scripts/prerender.ts`.

**M2-4: smoke:check-routes Fails with Missing Files**

**Symptom:** `MISSING: /books/my-book → dist/books/my-book/index.html`.
**Root Cause:** Route in `.cache/routes.json` has no corresponding `index.html` in `dist/` — prerender failed for that route.
**Exact Fix:** Check: `cat .cache/routes.json | grep "/books/my-book"` and `ls -la dist/books/my-book/`. Re-run: `npm run build && npm run smoke:check-routes`.

#### 7.2.3 M3 — Docker Container

**M3-1: Docker Build Fails with "COPY dist/" Error**

**Symptom:** `COPY failed: file not found in build context or excluded by .dockerignore: dist`.
**Root Cause:** `dist/` does not exist. Dockerfile has no fallback (ADR-007).
**Exact Fix:** `npm run build && ls -la dist/index.html && docker build -t mangu-publishers-local .`. Do NOT add `RUN npm run build` to the Dockerfile.

**M3-2: Docker Build Fails with "index.html missing"**

**Symptom:** `FATAL: dist/index.html missing`.
**Root Cause:** `dist/` exists but is empty or missing `index.html`. Vite build failed silently or prerender produced no output.
**Exact Fix:** `rm -rf dist/ && npm run build && ls -la dist/index.html && docker build -t mangu-publishers-local .`.

**M3-3: Container Runs but Health Check Returns 404**

**Symptom:** `curl http://localhost:8080/healthz` returns `404 Not Found`.
**Root Cause:** `nginx.conf.template` missing the `/healthz` location block, or template not processed during startup.
**Exact Fix:** Check container: `docker exec <id> cat /etc/nginx/conf.d/default.conf | grep -A5 "healthz"`. Verify template: `cat nginx.conf.template | grep -A5 "healthz"`. Fix template and rebuild.

**M3-4: Container Runs as Root Instead of UID 1001**

**Symptom:** `docker exec mangu-publishers-local id` returns `uid=0(root)`.
**Root Cause:** Dockerfile missing `USER 1001` directive.
**Exact Fix:** Check: `cat Dockerfile | grep -E "USER|uid|gid"`. Expected: `RUN addgroup -g 1001 -S nginxuser && adduser -u 1001 -S nginxuser -G nginxuser` and `USER 1001`. Add if missing.

#### 7.2.4 M4 — GCP Foundation

**M4-1: gcloud artifacts repositories create Permission Denied**

**Symptom:** `PERMISSION_DENIED: Permission 'artifactregistry.repositories.create' denied`.
**Root Cause:** Authenticated gcloud user lacks `roles/artifactregistry.admin`.
**Exact Fix:** `gcloud auth list`, then `gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:your-email@example.com" --role="roles/artifactregistry.admin"`.

**M4-2: Secret Manager Permission Denied for Cloud Build SA**

**Symptom:** `PERMISSION_DENIED: Permission 'secretmanager.secrets.setIamPolicy' denied`.
**Root Cause:** Cloud Build SA lacks `roles/secretmanager.secretAccessor` on the secret.
**Exact Fix:** Verify SA: `gcloud iam service-accounts list | grep cloudbuild-mangu-publishers`. Grant: `gcloud secrets add-iam-policy-binding sanity-api-read-token --member="serviceAccount:$BUILD_SA" --role="roles/secretmanager.secretAccessor"`. Verify: `gcloud secrets get-iam-policy sanity-api-read-token`.

**M4-3: Developer Connect OAuth Not Completing**

**Symptom:** `Failed to create connection: OAuth flow did not complete`.
**Root Cause:** Browser OAuth interrupted, or GitHub app not installed on repository.
**Exact Fix:** (1) Verify Owner/Admin rights on GitHub repo; (2) re-run connection creation; (3) complete OAuth and install app; (4) verify status: `gcloud developer-connect connections list --location="$REGION"` shows `ACTIVE`. If stuck, delete and recreate the connection.

**M4-4: Cloud Build Trigger Fails with "service account not found"**

**Symptom:** `INVALID_ARGUMENT: service account "..." does not exist`.
**Root Cause:** Service account not created before trigger, or email format wrong.
**Exact Fix:** Verify SA: `gcloud iam service-accounts list | grep cloudbuild-mangu-publishers`. If missing: `gcloud iam service-accounts create "$BUILD_SA_NAME" --display-name="Cloud Build Mangu Publishers deployer"`. Wait 30 seconds for IAM propagation, retry trigger creation.

#### 7.2.5 M5 — Cloud Build End-to-End

**M5-1: Cloud Run Deploy Rejected Due to 256Mi Memory**

**Symptom:** `Invalid value specified for memory. For 1.0 CPU, memory must be between 512Mi and 4Gi inclusive`.
**Root Cause:** `cloudbuild.yaml` uses `--memory=256Mi`; Cloud Run gen2 requires 512Mi minimum.
**Exact Fix:** `sed -i 's/--memory=256Mi/--memory=512Mi/g' cloudbuild.yaml`. Verify: `grep "memory=" cloudbuild.yaml` shows `--memory=512Mi`. Commit and push.

**M5-2: --no-default-url Flag Rejection**

**Symptom:** `unrecognized arguments: --no-default-url`.
**Root Cause:** gcloud CLI version outdated.
**Exact Fix:** `gcloud components update`. Verify: `gcloud version | grep "Google Cloud SDK"` — should be 500.0.0+. If updating not possible, deploy without flag and apply as post-deploy update.

**M5-3: Cloud Build secretEnv Not Injecting the Token**

**Symptom:** Content-snapshot fails with `Unauthorized - Invalid token` despite secret existing.
**Root Cause:** `secretEnv` binding misconfigured, secret name mismatch, or SA lacks `secretAccessor`.
**Exact Fix:** (1) `gcloud secrets versions access latest --secret=sanity-api-read-token` returns token; (2) `grep -A10 "content-snapshot" cloudbuild.yaml | grep -A5 "secretEnv"` shows `secretEnv: ["SANITY_API_READ_TOKEN"]`; (3) `availableSecrets` section points to correct secret version; (4) `gcloud secrets get-iam-policy sanity-api-read-token | grep "$BUILD_SA"` shows accessor role.

**M5-4: Artifact Registry Immutable Tag Conflict** — See R4 (Section 7.1.5). **M5-5: Vulnerability Scan Blocks Deployment** — See R5 (Section 7.1.6). **M5-6: Playwright Timeout During Prerender** — See R6 (Section 7.1.7).

#### 7.2.6 M6 — Firebase Hosting

**M6-1: Firebase Deploy Fails with "public directory not found"**

**Symptom:** `Error: public directory "public-placeholder" does not exist`.
**Root Cause:** `public-placeholder/` directory not created.
**Exact Fix:** `mkdir -p public-placeholder && touch public-placeholder/.gitkeep`. Verify `firebase.json` has `"public": "public-placeholder"`, then deploy.

**M6-2: Firebase Hosting Serves 404 for All Routes**

**Symptom:** `curl https://www.yourdomain.com/` returns `404` despite Cloud Run being healthy.
**Root Cause:** Firebase rewrite not configured, Cloud Run not running, or missing `run.invoker` IAM binding.
**Exact Fix:** (1) Verify `firebase.json` rewrites; (2) verify Cloud Run: `gcloud run services describe mangu-publishers --region=us-central1`; (3) test direct: `curl -s -o /dev/null -w "%{http_code}" $(gcloud run services describe mangu-publishers --region=us-central1 --format='value(status.url)')`; (4) if Cloud Run works but Firebase doesn't: `gcloud run services add-iam-policy-binding mangu-publishers --region=us-central1 --member="allUsers" --role="roles/run.invoker"`.

#### 7.2.7 M7 — Production Guardrails

**M7-1: Sanity Webhook Triggers Build but Content Does Not Update**

**Symptom:** Cloud Build starts after Sanity publish, but site shows stale content.
**Root Cause:** Cached `contentSnapshot.json`, stale npm cache, or incorrect webhook payload.
**Exact Fix:** Check Cloud Build logs for content counts. If mismatch, clear cache: `gsutil rm gs://mangu-publishers-cloudbuild-cache/npm-cache.tgz`. Verify webhook triggers on Create/Update/Delete.

**M7-2: Sentry Source Maps Not Uploading**

**Symptom:** `Source map upload failed: Authentication error: invalid token`.
**Root Cause:** `SENTRY_AUTH_TOKEN` missing or invalid.
**Exact Fix:** Verify: `cat .env.local | grep SENTRY_AUTH_TOKEN`. Check `vite.config.ts` — `authToken` must read from `process.env.SENTRY_AUTH_TOKEN`. For CI, add to `cloudbuild.yaml` via `secretEnv`.

**M7-3: Cloud Run Tag Pruning Script Fails**

**Symptom:** `jq: error (at <stdin>:0): Cannot iterate over null (null)`.
**Root Cause:** Cloud Run service has no traffic tags, or `jq` not installed.
**Exact Fix:** Verify jq: `jq --version || apt-get install jq`. Check tags: `gcloud run services describe mangu-publishers --region=us-central1 --format='json(status.traffic)' | jq '.status.traffic[]?.tag'`. Script handles empty sets via `|| true`. If syntax fails, add `select(.tag != null)` to the jq pipeline.

### 7.3 Cross-Cutting Issues

#### 7.3.1 Cloud Build Logs Showing Secret Values

**Symptom:** Cloud Build logs contain `export SANITY_API_READ_TOKEN="skProductionToken123..."`.
**Root Cause:** `options.logging` not set to `CLOUD_LOGGING_ONLY`, or a build step echoes a secret value.
**Impact:** Secret values persist in Cloud Logging for 30+ days. With legacy GCS logging enabled, values are also stored in a GCS bucket with broader IAM access.
**Exact Fix:** `grep "logging:" cloudbuild.yaml` — expected: `logging: CLOUD_LOGGING_ONLY`. `grep -n "echo.*SANITY" cloudbuild.yaml` — remove any matches. `grep "logsBucket" cloudbuild.yaml` should return empty.

#### 7.3.2 .env.local Accidentally Committed to Git

**Symptom:** GitHub shows `.env.local` with visible token values.
**Root Cause / Exact Fix:** See R8 (Section 7.1.9) — `git filter-repo`, rotate token, update Secret Manager, force push. If token was exposed, treat as compromised regardless of history rewrite.

### 7.4 SDLC Quality Gates

The seven gates form a structured checklist: PLAN → BUILD → REVIEW → TEST → STAGE → SHIP → VERIFY. Each catches a specific error category at the cheapest possible stage.

#### 7.4.1 Quality Gates Summary

| Gate | Name | Question | Description | Skip Condition |
|---|---|---|---|---|
| 1 | PLAN | Do you understand the task? | Name milestone, identify source doc, define done criteria, list dependencies, estimate effort | One-line command from a doc already read |
| 2 | BUILD | Can you undo the work? | Work on a branch, commit BEFORE state, follow docs literally, scope changes, save GCP output | Comment-only or doc-only change |
| 3 | REVIEW | Have you read what you wrote? | Read `git diff`, check for accidental files, debug code, secrets, commented-out code | gcloud command not changing repo files |
| 4 | TEST | Does it work? | Run locally, verify exit criteria, run smoke check and secrets audit; infra: `gcloud describe` | Never skip |
| 5 | STAGE | Is the change committed cleanly? | Commit message follows format, single logical change, branch up to date | Infra-only work not touching repo |
| 6 | SHIP | Ready to push to `main`? | Previous milestone done, branch rebased, present at computer, build queue checked | Infra-only task not pushing code |
| 7 | VERIFY | Working in production? | Cloud Build green, service healthy, behavior observable, checklist updated | Task did not deploy anything |

#### 7.4.2 Gate 1 — PLAN

The PLAN gate prevents wasted effort. Confirm: the task belongs to a specific milestone (M1–M7); the source document section is open; the exit criterion is verifiable; the operator knows what the next task requires; effort is estimated. Cross-milestone work is a warning — M3 needs `dist/` from M2, and attempting them in parallel guarantees failure. **Skip:** single command from a document already read.

#### 7.4.3 Gate 2 — BUILD

Ensures every change is reversible. Requirements: work on a feature branch, never `main`; commit the BEFORE state if modifying files; follow source document commands exactly for the first pass; keep changes scoped; save terminal output for GCP commands (resource names and IDs are needed for verification). **Skip:** comment-only or doc-only change.

#### 7.4.4 Gate 3 — REVIEW

The primary defense against secret leakage, debug code, and accidental file inclusion. Read every line of `git diff` before staging and verify: `git status` shows only intended files; no `console.log("debug")`; no credential strings (`git diff --cached | grep -i token` returns empty); no commented-out code; TODOs include issue numbers; filenames match the source exactly — the `scripts/_lib/` vs `src/lib/` distinction is critical, as getting it wrong breaks the security model. **Skip:** a `gcloud` command that does not change repository files.

#### 7.4.5 Gate 4 — TEST

The most frequently skipped and most important gate. **For code changes:** run locally; verify exit criteria using the exact command from the source document; run `npm run smoke:check-routes` for build work; run `npm run audit:secrets` after any build. **For infrastructure:** `gcloud ... describe` the resource; verify IAM with `gcloud projects get-iam-policy`. **For configuration:** `yamllint cloudbuild.yaml`, `jsonlint firebase.json`. Do not skip — Cloud Build failures are slow, noisy, and public.

#### 7.4.6 Gate 5 — STAGE

Ensures commit history is useful for debugging. Commit format: `feat: milestone N - <summary>` with bulleted change lines. Single logical change per commit — three independent things produce three commits. If work has been ongoing, rebase: `git fetch && git rebase origin/main`. **Skip:** infrastructure-only work not touching repo files.

#### 7.4.7 Gate 6 — SHIP

Requirements: previous milestone fully done; feature branch rebased onto `origin/main`; for M5 onward, operator is at their computer (first Cloud Build runs surface issues); check recent builds: `gcloud builds list --region=us-central1 --limit=3`; push branch and merge to `main`. **Skip:** infrastructure-only task not pushing code.

#### 7.4.8 Gate 7 — VERIFY

Requirements: Cloud Build status is `SUCCESS`; `curl -s https://www.yourdomain.com/healthz` returns `200 ok`; the specific change is observable (CSP → `curl -sI ... | grep -i csp`; route → `curl -s -o /dev/null -w "%{http_code}" ...`; content → `curl -s ... | grep -c "<new>"`); no new Sentry errors or alerts; checklist updated with `<!-- done YYYY-MM-DD -->`. **Skip:** task did not deploy anything.

#### 7.4.9 Anti-Patterns Reference

| Anti-Pattern | Gate That Catches It | Corrective Action |
|---|---|---|
| "I'll just push and see if it builds" | TEST | Run the local build first. Cloud Build is slow and noisy. |
| "I'll fix the lint errors later" | REVIEW | Fix them now. Lint errors compound and obscure real issues. |
| "Let me just edit `main` directly" | BUILD | Create a feature branch. Direct `main` commits are not reversible. |
| "I think this is what the doc said" | PLAN | Open the source document. Read the exact section. Copy the command verbatim. |
| "I'll skip the smoke test, it's only a small change" | TEST | The smoke test takes approximately 3 seconds. Run it. |
| "I'll do M3 in parallel with M2 — they look unrelated" | PLAN | M3 requires `dist/` from M2. These milestones are sequential. |
| Committing a Sanity token, even briefly | REVIEW | Rotate the token immediately. `git push --force` does not remove it from history if anyone fetched. |
| "It's just a tiny config change, I'll skip the commit format" | STAGE | The format enables future debugging at 11pm. Use it for every commit. |
| Running `npm run build` without `audit:secrets` after | TEST | The audit is the final backstop against secret leakage. Always run it. |
| Not checking `gcloud builds list` before pushing M5+ | SHIP | A failing build in the queue may be unrelated. Verify first. |

These anti-patterns represent the majority of preventable failures observed during Phase 2. Each gate corresponds to a specific failure mode with measurable recovery cost. Catching a secret leak at REVIEW costs minutes; catching it in production costs hours of rotation, history rewriting, and incident communication. Catching a build failure at TEST costs seconds; catching it in Cloud Build costs 5–10 minutes of pipeline execution plus log analysis. The gates exist to make the cheapest detection stage the most likely one.
