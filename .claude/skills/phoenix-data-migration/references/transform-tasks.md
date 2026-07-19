# Transform Tasks 2.1–2.8 (summary)

Implement exactly as Phoenix §5.5 P11.2. This file is a checklist, not a license to diverge.

- [ ] 2.1 Users → Better Auth `user` docs
- [ ] 2.2 Accounts with `!locked:<uuid>` passwords only
- [ ] 2.3 Profiles mapped to `auth_user_id`
- [ ] 2.4 Authors remapped via `_id_map.json`
- [ ] 2.5 Books remapped; unique slugs; rating fields init
- [ ] 2.6 Orders flattened with embedded items; keep Stripe PI id
- [ ] 2.7 Reviews remapped; dates native
- [ ] 2.8 Report orphans/collisions/counts

If a source column is missing in export reality: amend Phoenix doc, then code.
