# Phase 2 — fields to gather

> **Intake shell file:** `environment.local.sh` (gitignored) is seeded with `PROJECT_ID=delta-wonder-488420-i3` and `SERVICE_NAME=mangu-publishers`. Fill remaining `REPLACE_ME_*` values below and in that file.

Copy this file, fill it in, then either:

- Save as **`worksheet-export.md`** in this folder (you can gitignore it via `.gitignore` if it contains names/contacts your policy treats as sensitive), **or**
- Paste the filled sections to whoever updates [`environment.example.sh`](environment.example.sh) → **`environment.local.sh`** (gitignored) and [`12-ownership-raci.md`](../12-ownership-raci.md).

**Never put secrets here:** Sanity read tokens, `SENTRY_AUTH_TOKEN`, webhook signing secrets, API keys, passwords.

---

## 1. GCP & routing (for `environment.local.sh` + command templates)

| Field                | Your value                       | Where to find it                                                   |
| -------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `PROJECT_ID`         |                                  | GCP Console → project picker; or `gcloud config get-value project` |
| `REGION`             | default `us-central1` if unused  | Where Cloud Run / Artifact Registry / builds run                   |
| `SERVICE_NAME`       | default `mangu-publishers`       | Cloud Run service name                                             |
| `CUSTOM_DOMAIN`      | hostname only, **no** `https://` | What customers use in the browser                                  |
| `AR_REPO`            | default `web-images`             | Artifact Registry Docker repo id                                   |
| `BILLING_ACCOUNT_ID` |                                  | GCP Billing → account ID (for budget commands)                     |

---

## 2. Rollback & CI examples

| Field                 | Your value | Where to find it                                      |
| --------------------- | ---------- | ----------------------------------------------------- |
| `KNOWN_GOOD_REVISION` |            | Cloud Run → revision id you trust for rollback drills |
| `BUILD_ID`            | optional   | Cloud Build → build id (for log tail examples)        |

---

## 3. Smoke-test content slugs (must match real Sanity / routes)

| Field                  | Your value | Example shape     |
| ---------------------- | ---------- | ----------------- |
| `SAMPLE_BOOK_SLUG`     |            | slug segment only |
| `SAMPLE_AUTHOR_SLUG`   |            | slug segment only |
| `SAMPLE_CATEGORY_SLUG` |            | slug segment only |

---

## 4. Optional P0 probes (set when you run those checks)

| Field                       | Your value | Notes                                                            |
| --------------------------- | ---------- | ---------------------------------------------------------------- |
| `SAMPLE_HASHED_JS_BASENAME` |            | e.g. `index-abc12345.js` from `dist/assets/` after build         |
| `P0_8_SAMPLE_ROUTE`         |            | Path after host, e.g. `books/your-book-slug` (published content) |

---

## 5. Observability (non-secret only)

| Field                 | Your value | Notes                                           |
| --------------------- | ---------- | ----------------------------------------------- |
| `SENTRY_PROJECT_SLUG` | optional   | Project slug in Sentry UI                       |
| `SENTRY_EVIDENCE_URL` | optional   | Link to a sample issue/event (no tokens in URL) |

---

## 6. People & contacts — [`12-ownership-raci.md`](../12-ownership-raci.md)

Replace italic stubs with **real names** (not role titles alone) and working contact paths.

| Role                   | Primary (full name) | Backup | Contact path (Slack @ / email / PD policy link) |
| ---------------------- | ------------------- | ------ | ----------------------------------------------- |
| Engineering Lead       |                     |        |                                                 |
| Platform Engineer      |                     |        |                                                 |
| Security Lead          |                     |        |                                                 |
| On-Call Operator       |                     |        |                                                 |
| Product/Business Owner |                     |        |                                                 |

---

## 7. Handoff evidence — [`11-handoff-master-checklist.md`](../11-handoff-master-checklist.md) & [`14-evidence-and-signoff-log.md`](../14-evidence-and-signoff-log.md)

You don’t pre-fill every URL here; during execution you replace **PENDING** with owners + links. Before GO-live, gather:

- [ ] Links to **green Cloud Build(s)** for M5/M7a scope
- [ ] Link or screenshot for **Cloud Monitoring** uptime + alert policies
- [ ] Link or screenshot for **billing budgets** (thresholds visible)
- [ ] **Rollback prerecord** fields documented per [`07-operational-runbook.md`](../07-operational-runbook.md)

---

## 8. Optional identifiers (only if non-secret and you want them in docs)

| Item                           | Your value | Usually lives in      |
| ------------------------------ | ---------- | --------------------- |
| Sanity **project id** (public) |            | Studio / env `VITE_*` |
| Sanity **dataset**             |            | Studio / env          |
| Cloud Build **trigger name**   |            | Cloud Build triggers  |
| Firebase **project / site id** |            | Firebase console      |

If any of these are policy-sensitive for your org, keep them out of git and only in local env / Secret Manager.

---

## After this file is filled

1. Copy [`environment.example.sh`](environment.example.sh) → **`environment.local.sh`** (same folder; gitignored).
2. Transfer section **1–5** values into `environment.local.sh` exports.
3. Transfer section **6** into **`12-ownership-raci.md`** Role Directory.
4. As milestones complete, clear **PENDING** rows in **`11`** / **`14`** with evidence links.

Someone else (or an agent with this file in-repo) can perform steps 2–4 for you if you save this as `worksheet-export.md` in **`docs/phase2/_intake/`**.
