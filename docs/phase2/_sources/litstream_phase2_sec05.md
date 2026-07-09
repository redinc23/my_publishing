## 5. Acceptance Criteria & Test Protocol

This section defines the complete P0 acceptance test suite for the Mangu Publishers Phase 2 architecture. Every test includes exact verification commands executable in a shell with authenticated `gcloud` CLI access. The suite comprises seven primary P0 tests (P0-1 through P0-7) plus two additional quality gates (CVE-GATE and WEBHOOK). Tests are ordered by milestone dependency; earlier tests validate foundational assumptions that later tests rely upon.

### 5.1 P0 Test Suite Overview

#### 5.1.1 P0 Test Inventory

| Test ID  | Requirement Validated                                                     | Test Method                                                       | Expected Result                                                                | Milestone |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------- |
| P0-1     | No secret values leak into browser bundles, Docker layers, or runtime env | `grep` scan of `dist/assets/`, Docker layers, Cloud Run env       | No `SANITY_API_READ_TOKEN` in any target                                       | M5        |
| P0-2     | Build pipeline produces `dist/` before Docker; Dockerfile has no fallback | Step-order verification in `cloudbuild.yaml`; negative build test | Build steps precede `docker-build`; Dockerfile fails without `dist/`           | M3, M5    |
| P0-3     | Runtime container serves static files via nginx; no Node or Sanity calls  | HTTP probe of `/healthz`; image inspection; CSP header analysis   | HTTP 200 from `/healthz`; image contains `nginx`; CSP excludes `api.sanity.io` | M3, M5    |
| P0-4     | GitHub remains source of truth; Developer Connect triggers builds         | `gcloud builds triggers describe`; push-to-main latency test      | Trigger on `^main$` exists; push starts build within 60s                       | M4, M5    |
| P0-5     | Firebase Hosting rewrites all traffic to Cloud Run with custom domain/TLS | HTTPS probes of root and deep links; `firebase.json` validation   | HTTPS 200 on root and deep links; `public-placeholder` configured              | M6        |
| P0-6     | Cloud Run deployment applies specified resource and scaling config        | `gcloud run services describe` with JSON/YAML filters             | `maxScale=10`, `minScale=0`, `gen2`, `512Mi`, `port=8080`                      | M5        |
| P0-7     | nginx serves hashed assets with immutable cache; SPA fallback works       | HTTP header inspection; `.map` URL probe                          | `immutable` cache on assets; five security headers; `.map` returns 404         | M3, M6    |
| CVE-GATE | HIGH/CRITICAL CVE findings block deployment                               | `cloudbuild.yaml` step inspection; vulnerable-image negative test | `enforce-vulnerability-policy` step exits 1 on HIGH/CRITICAL                   | M5        |
| WEBHOOK  | Sanity publish triggers rebuild; webhook is secure                        | End-to-end publish latency; unsigned rejection; replay protection | Build starts within ~60s; unsigned returns 401; replay rejected                | M7        |

#### 5.1.2 Seven P0 Tests Plus Two Additional Gates

The seven P0 tests correspond directly to the Phase 2 milestones. P0-1 through P0-3 validate foundational security and architecture decisions — no secret leakage, deterministic build ordering, and static-only runtime. P0-4 and P0-5 verify integration between GitHub, Cloud Build, Firebase Hosting, and Cloud Run. P0-6 and P0-7 verify the runtime behavior of the deployed container.

The two additional gates — CVE-GATE and WEBHOOK — are required for production readiness but sit outside the strict P0 numbering. CVE-GATE confirms that vulnerability scanning blocks deployments carrying HIGH or CRITICAL findings. WEBHOOK validates the end-to-end content update flow from Sanity Studio through the webhook validator to a completed Cloud Build. Both gates must pass before the Phase 2 Definition of Done is satisfied.

### 5.2 P0-1: No Browser-Bundled Secrets

**Requirement:** No secret variable starts with the `VITE_` prefix. The Sanity API read token must not appear in `dist/assets/`, Docker layers, Cloud Run env, or Cloud Build logs. This is the direct consequence of the Milestone 1 token rename from `VITE_SANITY_API_READ_TOKEN` to `SANITY_API_READ_TOKEN`.

#### 5.2.1 Test A: grep dist/assets/ for SANITY_API_READ_TOKEN

```bash
grep -rn "SANITY_API_READ_TOKEN" dist/assets/
```

**Expected:** No output. `grep` exits code 1 (no matches), which constitutes a pass. Any output line indicates the token string was bundled into a JavaScript or CSS asset and the test fails.

#### 5.2.2 Test B: grep dist/assets/ for Base64 Token Patterns

```bash
grep -rn "sk[A-Za-z0-9]" dist/assets/ | head -20
```

**Expected:** No Sanity token matches. The command may produce false positives from benign `sk`-prefixed strings (for example, `skipAnimation`). The operator must manually inspect output to distinguish token-like strings. A valid Sanity production token starts with `sk` followed by at least 20 alphanumeric characters.

#### 5.2.3 Test C: Check Cloud Run Runtime Environment for Token

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Expected:** The YAML output does not contain `SANITY_API_READ_TOKEN`. The `env` field is either empty or contains only non-secret variables such as `PORT=8080`.

#### 5.2.4 Test D: Inspect Docker Image Layers with docker save | strings | grep

```bash
docker save us-central1-docker.pkg.dev/$PROJECT_ID/web-images/mangu-publishers:latest \
  | tar -xO | strings | grep -i "sanity.*token"
```

**Expected:** No output. The `docker save | tar | strings | grep` pipeline produces no matching lines. The Dockerfile copies only pre-built static files from `dist/` and contains no `npm install` or build-time secret injection.

#### 5.2.5 Test E: Verify CLOUD_LOGGING_ONLY in cloudbuild.yaml

```bash
grep "logging:" cloudbuild.yaml
```

**Expected:** Output contains `CLOUD_LOGGING_ONLY` under the `options` block:

```yaml
options:
  logging: CLOUD_LOGGING_ONLY
```

**P0-1 Pass Criteria:** All five tests return no secret values. Any single failure blocks deployment.

### 5.3 P0-2: Build Before Docker

**Requirement:** Cloud Build executes the full static build pipeline — content snapshot, route generation, Vite compilation, prerendering, and sitemap — before Docker image assembly. The Dockerfile contains no fallback build logic and fails deterministically if `dist/` is absent.

#### 5.3.1 Test A: Verify Step Ordering in cloudbuild.yaml

```bash
grep -n "id:" cloudbuild.yaml | grep -E \
  "content-snapshot|generate-routes|vite-build|prerender|sitemap|docker-build" \
  | awk '{print $1}' | sed 's/://'
```

**Expected:** Line numbers show `content-snapshot`, `generate-routes`, `vite-build`, `prerender`, and `sitemap` at lower line numbers than `docker-build`. The exact ordering is: content-snapshot, generate-routes, vite-build, prerender, sitemap, docker-build.

#### 5.3.2 Test B: Remove dist/ and Attempt Docker Build

```bash
mv dist dist-backup 2>/dev/null || true
docker build -t mangu-publishers-fail-test . 2>&1 | grep -q "missing\|COPY failed\|FATAL" \
  && echo "PASS: Docker fails without dist/" || echo "FAIL: Docker should fail without dist/"
mv dist-backup dist 2>/dev/null || true
```

**Expected:** The Docker build fails with an error referencing missing `dist/` or the `test -f` validation. The Dockerfile contains: `RUN test -f /usr/share/nginx/html/index.html || exit 1`. If the build succeeds without `dist/`, the test fails — a fallback `npm run build` was incorrectly retained.

#### 5.3.3 Test C: Verify No npm Commands in Dockerfile

```bash
grep -E "npm (install|run build|ci)" Dockerfile
```

**Expected:** No output. The Dockerfile must not contain `npm install`, `npm ci`, `npm run build`, or any Node.js invocation. The only application code `COPY` is `COPY dist/ /usr/share/nginx/html/`.

**P0-2 Pass Criteria:** Build-step ordering is correct, Docker build fails without `dist/`, and the Dockerfile contains no npm commands.

### 5.4 P0-3: Static Runtime

**Requirement:** The Cloud Run container serves only pre-built static files through nginx. No Node.js process runs. No outbound Sanity API connections occur at runtime. The CSP reflects this by excluding `api.sanity.io` from `connect-src`.

#### 5.4.1 Test A: /healthz Returns 200; Test B: Container Image Contains nginx

**Test A — Health Endpoint:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.yourdomain.com/healthz
```

**Expected:** `200`. Response body contains `ok`. Response includes `Cache-Control: no-store`.

**Test B — Container Image:**

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="value(spec.template.spec.containers[0].image)"
```

**Expected:** Output contains `nginx` (specifically `nginx:1.27-alpine`). Must not contain `node`.

#### 5.4.2 Test C: CSP connect-src Does Not Contain api.sanity.io; Test D: No Secret Env Vars at Runtime

**Test C — Content Security Policy:**

```bash
curl -sI https://www.yourdomain.com/ | grep -i "content-security-policy"
```

**Expected:** The `Content-Security-Policy` header is present. `connect-src` does NOT contain `api.sanity.io`. Expected `connect-src` includes `'self'`, `https://*.sentry.io`, and `https://*.ingest.sentry.io` only. The `img-src` directive may include `https://cdn.sanity.io` for Portable Text images — this is expected as the Sanity CDN is read-only and requires no authentication.

**Test D — Runtime Environment:**

```bash
gcloud run services describe mangu-publishers --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

**Expected:** The `env` list is empty or contains only non-secret variables such as `PORT=8080`. No variable containing `TOKEN`, `SECRET`, or `KEY` appears.

**P0-3 Pass Criteria:** `/healthz` returns 200, container image is nginx-based, CSP `connect-src` excludes `api.sanity.io`, and no secret env vars are configured.

### 5.5 P0-4: GitHub + Developer Connect

**Requirement:** GitHub remains the single source of truth. Cloud Build triggers use Developer Connect (not mirror-based repositories), and push to `main` automatically initiates a build within 60 seconds.

#### 5.5.1 Test A: Trigger Exists and Describes Correctly; Test B/C: Push to main Triggers Build Within 60 Seconds

**Test A — Trigger Existence:**

```bash
gcloud builds triggers describe mangu-publishers-main --region=us-central1
```

**Expected:** Exit code 0. Output shows `developerConnect` trigger type with `branchPattern: ^main$`. The `buildConfig` references `cloudbuild.yaml`. The `serviceAccount` references `cloudbuild-mangu-publishers@`.

**Test B — Push Event and Test C — Build Latency:**

```bash
git commit --allow-empty -m "ops: trigger test $(date +%s)" && git push origin main
```

Wait 60 seconds, then:

```bash
gcloud builds list --region=us-central1 --limit=1 --format='table(id, status, createTime)'
```

**Expected:** The most recent build shows status `WORKING`, `QUEUED`, or `SUCCESS` with `createTime` within 60 seconds of the push. A `FAILURE` status still passes P0-4 (the trigger fired) but indicates a different P0 test or build step requires investigation.

**P0-4 Pass Criteria:** The Developer Connect trigger exists on `^main$`, and push to `main` initiates Cloud Build within 60 seconds.

### 5.6 P0-5: Firebase Hosting Rewrite

**Requirement:** All HTTP traffic is served through Firebase Hosting, which provides custom domain, TLS termination, CDN caching, and SPA routing. Firebase rewrites every request to Cloud Run `mangu-publishers` in `us-central1`. No static files are served directly from Firebase Hosting — the `public` directory is `public-placeholder`, an empty directory.

#### 5.6.1 Test A: Custom Domain Resolves HTTPS 200; Test B: Deep Links Return 200 (SPA Fallback)

**Test A — Root Domain:**

```bash
curl -sI https://www.yourdomain.com/ | head -1
```

**Expected:** HTTP/2 200. Response includes TLS headers and `strict-transport-security`.

**Test B — Deep Link:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://www.yourdomain.com/books/a-nonexistent-slug
```

**Expected:** `200` (not 404). Server returns `index.html` shell; client-side routing handles navigation.

#### 5.6.2 Test C: Firebase/Google Headers Present; Test D: firebase.json Uses public-placeholder

**Test C — Infrastructure Headers:**

```bash
curl -sI https://www.yourdomain.com/ | grep -i "x-served-by\|server\|firebase"
```

**Expected:** Headers contain indicators of Firebase/Google infrastructure (for example, `Server: Google Frontend`). Absence of `nginx` in the `Server` header is expected — Firebase Hosting sits in front of Cloud Run.

**Test D — firebase.json:**

```bash
grep '"public"' firebase.json
```

**Expected:** Output shows `"public": "public-placeholder"`. The value must not be `"dist"`. The `public-placeholder` directory contains only `.gitkeep`.

**P0-5 Pass Criteria:** Custom domain returns HTTPS 200 on root and deep links, Firebase/Google headers present, and `firebase.json` points to `public-placeholder`.

### 5.7 P0-6: Cloud Run Deploy Flags

**Requirement:** The Cloud Run service deploys with specific resource limits, scaling parameters, and network configuration defined in the `cloudbuild.yaml` deploy step.

#### 5.7.1 Cloud Run Configuration Verification Table

| Parameter               | Specified Value | GCP Spec Path                                                                    | Verification Command                                                                                                                                               |
| ----------------------- | --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `max-instances`         | 10              | `spec.template.metadata.annotations["autoscaling.knative.dev/maxScale"]`         | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.autoscaling.knative.dev/maxScale)"`         |
| `min-instances`         | 0               | `spec.template.metadata.annotations["autoscaling.knative.dev/minScale"]`         | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.autoscaling.knative.dev/minScale)"`         |
| `execution-environment` | gen2            | `spec.template.metadata.annotations["run.googleapis.com/execution-environment"]` | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.metadata.annotations.run.googleapis.com/execution-environment)"` |
| `memory`                | 512Mi           | `spec.template.spec.containers[0].resources.limits.memory`                       | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.spec.containers[0].resources.limits.memory)"`                    |
| `port`                  | 8080            | `spec.template.spec.containers[0].ports[0].containerPort`                        | `gcloud run services describe mangu-publishers --region=us-central1 --format="value(spec.template.spec.containers[0].ports[0].containerPort)"`                     |
| `allow-unauthenticated` | true            | IAM binding: `allUsers` with `roles/run.invoker`                                 | `gcloud run services get-iam-policy mangu-publishers --region=us-central1 --format="yaml(bindings)" \| grep -A 1 "role: roles/run.invoker"`                        |

**Consolidated verification:**

```bash
CONFIG=$(gcloud run services describe mangu-publishers --region=us-central1 --format="json")
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."autoscaling.knative.dev/maxScale" == "10"' && echo "PASS: max=10" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."autoscaling.knative.dev/minScale" == "0"' && echo "PASS: min=0" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.metadata.annotations."run.googleapis.com/execution-environment" == "gen2"' && echo "PASS: gen2" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.spec.containers[0].ports[0].containerPort == 8080' && echo "PASS: port=8080" || echo "FAIL"
echo "$CONFIG" | jq -e '.spec.template.spec.containers[0].resources.limits.memory == "512Mi"' && echo "PASS: 512Mi" || echo "FAIL"
```

**Note:** `512Mi` is the minimum memory allocation for Cloud Run gen2. The original `256Mi` value was corrected in the v12 gap analysis.

**P0-6 Pass Criteria:** All six parameters match specified values. Any deviation indicates deployment configuration drift.

### 5.8 P0-7: nginx SPA Behavior

**Requirement:** The nginx container serves hashed static assets with immutable cache headers, returns SPA `index.html` for deep links, blocks source map URLs, and includes five security headers on every response.

#### 5.8.1 Test A: Hashed Assets Return Immutable Cache Header; Test B: All Five Security Headers Present

**Test A — Immutable Cache:**

```bash
ASSET=$(ls dist/assets/*.js 2>/dev/null | head -1 | xargs basename)
curl -sI "https://www.yourdomain.com/assets/$ASSET" | grep -i "cache-control"
```

**Expected:** `Cache-Control` contains `public, max-age=31536000, immutable`. The `immutable` directive eliminates conditional revalidation requests.

**Test B — Security Headers:**

```bash
curl -sI https://www.yourdomain.com/ | grep -iE \
  "x-frame-options|x-content-type-options|referrer-policy|permissions-policy|content-security-policy"
```

**Expected:** All five headers present:

| Header                    | Expected Value                                                 |
| ------------------------- | -------------------------------------------------------------- |
| `X-Frame-Options`         | `DENY` or `SAMEORIGIN`                                         |
| `X-Content-Type-Options`  | `nosniff`                                                      |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                              |
| `Permissions-Policy`      | Restricted defaults (camera=(), microphone=(), geolocation=()) |
| `Content-Security-Policy` | All directives with no `api.sanity.io` in `connect-src`        |

#### 5.8.2 Test C: .map URLs Return 404; Test D: Deep Links Return SPA HTML

**Test C — Source Map Blocking:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.yourdomain.com/assets/index.js.map
```

**Expected:** `404`. The `nginx.conf.template` contains an explicit location block returning 404 for `*.map` requests. Source maps are uploaded to Sentry during build and deleted from `dist/` before Docker packaging.

**Test D — Deep Link SPA Fallback:**

```bash
curl -s https://www.yourdomain.com/books/nonexistent-slug | grep -c "<div id="
```

**Expected:** Count of 1 or greater, confirming the response contains the SPA HTML shell. The nginx `try_files` directive implements the fallback: `try_files $uri $uri/ /index.html;`.

**P0-7 Pass Criteria:** Hashed assets return `immutable` cache, all five security headers present, `.map` returns 404, and deep links return SPA HTML.

### 5.9 CVE-GATE: Vulnerability Scan

**Requirement:** The `cloudbuild.yaml` pipeline includes a vulnerability scanning step after Docker push and before deploy. HIGH or CRITICAL CVE findings block deployment.

#### 5.9.1 Verify enforce-vulnerability-policy Step; Verify HIGH/CRITICAL Blocks Deploy

**Step Existence:**

```bash
grep -A 15 "enforce-vulnerability-policy" cloudbuild.yaml
```

**Expected:** Output shows a step with `id: enforce-vulnerability-policy` using the On-Demand Scanning API. The step greps scan results for `CRITICAL` or `HIGH` and exits 1 if found. It is positioned after `docker-push` (step 12) and before `deploy-run` (step 14).

**Negative Test — Vulnerable Image Blocking:**

Create a test branch with a known-vulnerable base image and confirm Cloud Build stops at the vulnerability step:

```bash
sed -i 's/nginx:1.27-alpine/nginx:1.21-alpine/' Dockerfile
git commit -am "TEST: vulnerable base image"
git push origin test/cve-gate-check
# Monitor Cloud Build — expect failure at step 13, no deploy
```

**CVE-GATE Pass Criteria:** The `enforce-vulnerability-policy` step exists at the correct position, and HIGH/CRITICAL CVEs cause build failure before deploy.

### 5.10 WEBHOOK: Sanity Rebuild Triggers

**Requirement:** Publishing in Sanity Studio triggers Cloud Build within ~60 seconds. The webhook endpoint rejects unsigned requests with HTTP 401 and implements replay protection with a 10-minute deduplication window.

#### 5.10.1 Test A: Sanity Publish Triggers Cloud Build Within ~60s; Test B: Unsigned Request Returns 401

**Test A — Publish Latency:**

1. Publish a minor content change in Sanity Studio. Record the timestamp.
2. Monitor Cloud Build:

```bash
gcloud builds list --region=us-central1 --limit=5 --format="table(id, status, createTime)"
```

**Expected:** A new build appears with `createTime` within 60 seconds of the publish. Build source provenance indicates a webhook trigger.

**Test B — Unsigned Rejection:**

```bash
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -d '{"_type":"book","_id":"test-unsigned"}'
```

**Expected:** HTTP 401 or 403. No Cloud Build is triggered within 60 seconds.

#### 5.10.2 Test C: Replay of Same Signed Payload Within 10 Minutes Rejected as Duplicate

1. Capture a valid signed webhook payload from Sanity (including the signature header).
2. Send once and confirm acceptance (HTTP 200) and build trigger.
3. Within 10 minutes, resend the identical payload:

```bash
# First delivery — accepted, build triggered
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: sanity-webhook-signature=<sig>" \
  -d '{"_type":"book","_id":"test-replay","_rev":"<rev>"}'

# Second delivery — rejected as duplicate
curl -X POST https://your-validator-url/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: sanity-webhook-signature=<sig>" \
  -d '{"_type":"book","_id":"test-replay","_rev":"<rev>"}'
```

**Expected:** The second delivery returns HTTP 409 (Conflict) or HTTP 200 with `duplicate-payload` in the body. No second Cloud Build is triggered. The validator's replay protection stores a hash of processed payloads with a 10-minute TTL.

**WEBHOOK Pass Criteria:** Sanity publish triggers Cloud Build within ~60 seconds, unsigned requests return 401/403, and replayed signed payloads within the 10-minute window are rejected without duplicate builds.

### 5.11 Full P0 Test Suite Execution

The complete P0 suite should execute after every deployment. P0-1 and P0-2 run locally with the repository checked out. P0-3 through P0-7 require a live Cloud Run service and Firebase domain. CVE-GATE requires Cloud Build history or a test branch with a vulnerable image. WEBHOOK requires Sanity Studio and the webhook validator deployment.

All nine acceptance criteria must pass for the Phase 2 Definition of Done to be satisfied. A failure in any P0 test or gate is a deployment blocker. The operator should consult the Operational Runbook (Chapter 6) for remediation procedures.
