# TS-PUB-002 — Editorial Workflow

**Status:** Adopted with PR 1 (`feat/manuscript-schema-security`)
**Scope:** Manuscript editorial states, actors, permissions, storage convention, and audit rules.
**Migrations:** `20260724000000` … `20260724000006`

## 1. Status model

The only permitted manuscript statuses:

```
draft → submitted → under_review → revisions_requested | accepted | rejected
revisions_requested → submitted
submitted → withdrawn
accepted → converted_to_book
```

| Status | Meaning | Set by |
| --- | --- | --- |
| `draft` | Author is editing; not visible to editorial queue | Author |
| `submitted` | Awaiting triage/assignment | Author |
| `under_review` | Assigned reviewer actively reviewing | Staff |
| `revisions_requested` | Returned to author with feedback | Staff |
| `accepted` | Editorial acceptance; eligible for conversion | Staff |
| `rejected` | Terminal editorial decision | Staff |
| `withdrawn` | Author withdrew a submitted manuscript (terminal) | Author |
| `converted_to_book` | Accepted manuscript became a draft book (terminal) | Staff |

`published` is **not** a manuscript status — it belongs to `books.status`.
Legacy rows were remapped to `converted_to_book` by `20260724000000`.

### Author-legal transitions (everything else requires staff)

- `draft → submitted`
- `revisions_requested → submitted`
- `submitted → withdrawn`

Enforced server-side by the `protect_manuscript_workflow_fields()` trigger, which
also blocks non-admin changes to: `status` (outside the legal set),
`assigned_reviewer_id`, `assigned_at`, `review_started_at`, `decision_at`,
`editorial_notes`, `internal_notes`, `book_id`, `converted_at`,
`converted_by_profile_id`.

## 2. Actors and permissions

Admin authority is **always** `profiles.role = 'admin'` via
`public.current_user_is_admin()`. JWT metadata is never consulted.

| Actor | Manuscripts | Reviews | History |
| --- | --- | --- | --- |
| Anonymous | none | none | none |
| Reader (non-author) | none | none | none |
| Author | own: select; insert draft/submitted; update while `draft`/`revisions_requested`/`submitted` (non-workflow fields); delete drafts | via `author_manuscript_feedback` view only | via `author_manuscript_status_history` view only |
| Assigned reviewer | (through app layer) | select own; update own for assigned manuscripts | none |
| Admin | all | all | select all |
| service_role | full (bypasses RLS) | full | full (corrections = new rows) |

Authors never read `manuscript_reviews` or `manuscript_status_history` raw —
the safe views exclude `internal_notes`, `internal_reason`, `metadata`,
reviewer identity, and actor identity.

## 3. Status history (audit)

- Every INSERT and status-changing UPDATE on `manuscripts` writes exactly one
  `manuscript_status_history` row (trigger `record_manuscript_status_change`).
- History rows are immutable (`prevent_manuscript_history_mutation` raises on
  UPDATE/DELETE). Corrections are inserted as new rows.
- Actor attribution: the application sets
  `SELECT set_config('app.changed_by_profile_id', '<profile-uuid>', true);`
  inside the transaction; the trigger reads it, defaulting to NULL.

## 4. Reviews

- One row per `(manuscript_id, review_round)`; rounds start at 1.
- `decision ∈ pending | changes_requested | accepted | rejected`.
- `author_feedback` (≤10 000 chars) is author-visible **after** `submitted_at`
  is set; `internal_notes` (≤20 000 chars) never is.
- Reviewer FK is `ON DELETE RESTRICT`: reassign reviews before deleting a profile.

## 5. Storage convention

Bucket `manuscripts`: private, 100 MiB, PDF/DOC/DOCX/TXT only.

Object path for all new uploads:

```
<auth-user-id>/<manuscript-id>/<version-number>/<sanitized-file-name>
```

- First segment must equal `auth.uid()` (enforced by policy) — this is what
  isolates authors from each other.
- No UPDATE policy: a new version is a new upload.
- DELETE allowed only while the owning manuscript is `draft`; submitted files
  are preserved as editorial records.
- Uploads are tagged `metadata.scan_status = 'pending'`. **No malware scanning
  is implemented yet**; the tag exists so a future pipeline can find unscanned
  objects. Do not claim scanning exists anywhere in the UI.

## 6. Conversion linkage (schema only in PR 1)

- `manuscripts.book_id` (unique where not null) + `converted_at` +
  `converted_by_profile_id` are all-or-nothing and only valid with
  `status = 'converted_to_book'`.
- `ON DELETE SET NULL`: deleting a book never deletes the source manuscript.
- The conversion action itself ships in a later PR (PR 5).

## 7. Migration order and rollback

Apply `20260724000000` → `20260724000006` strictly in order (see
`docs/MIGRATIONS.md` §32–38). All are guarded (`IF NOT EXISTS` /
`DROP ... IF EXISTS`) and safe against both an empty database and
production-shaped data.

Rollback notes:

- Migrations are forward-fix only (repo convention). To disable enforcement in
  an emergency, drop the `protect_manuscript_workflow` trigger and re-create
  the legacy policies — but note this reopens the author privilege-escalation
  hole PR 1 exists to close.
- `submission_date` is deprecated but retained; nothing breaks if application
  code still reads it.

## 8. Known limitations

- RLS/storage matrices are verified statically in
  `tests/unit/manuscript-migrations.test.ts`,
  `tests/integration/manuscript-rls.test.ts`, and
  `tests/integration/manuscript-storage-policies.test.ts`. Live verification
  against hosted Supabase (real JWTs, real uploads) is an operator step
  (Phase 12/13, `docs/OPERATOR_QA_LOG.md`).
- Reviewer is modeled as an admin-assigned profile; there is no separate
  `reviewer` role in `profiles.role`.
- No malware scanning; `scan_status` stays `pending` until a scanning PR lands.
