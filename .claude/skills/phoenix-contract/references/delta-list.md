# Recon Deltas (doc vs repo)

From `docs/PHOENIX_RECON.md` §9. Apply when amending the Phoenix doc or choosing filenames.

| #   | Doc says                             | Repo has                                             | Resolution                                           |
| --- | ------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| D1  | App Router                           | App Router + vestigial `pages/_document.tsx`         | Delete in WS4                                        |
| D2  | `lib/mongo.ts`                       | Scaffold: `lib/mongodb.ts` + `lib/db/provider.ts`    | Reuse scaffold; export `getDb()`; amend doc filename |
| D3  | `npm run db:mongo:up\|ping\|indexes` | On scaffold branch only                              | Adopt in WS2 PR                                      |
| D4  | `NEXT_PUBLIC_APP_URL`                | `NEXT_PUBLIC_SITE_URL` wired                         | Keep SITE_URL; amend doc §9.1                        |
| D5  | §9.1 lists 14 vars                   | Also OPENAI + Stripe publishable + Sentry build trio | Amend doc to include survivors                       |
| D6  | Real `.env.example`                  | Stub                                                 | Rebuild in WS4                                       |
| D7  | Local e2e baseline                   | Needs secrets                                        | CI is e2e baseline of record                         |
| D8  | Blob `access: 'public'`              | Manuscript URLs shareable if leaked                  | Needs explicit doc decision before WS3               |

Do not invent new deltas silently — record them in recon or a `docs:` commit.
