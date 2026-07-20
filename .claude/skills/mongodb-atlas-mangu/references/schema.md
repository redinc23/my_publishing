# Mongo Schema Sketch (Phoenix)

Collections (logical):

| Collection                 | Notes                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| `user` / Better Auth user  | string `id` (legacy UUID on import)                                      |
| `account`                  | credential provider; locked password on import                           |
| `session` / `verification` | Better Auth managed                                                      |
| `profiles`                 | `auth_user_id`, display_name, role, timestamps                           |
| `authors`                  | remapped ObjectIds via `_id_map.json` on import                          |
| `books`                    | slug unique; cover_url; manuscript_url; avg_rating; review_count; status |
| `orders`                   | embedded `order_items[]`; `stripe_payment_intent_id`                     |
| `reviews`                  | drive rating aggregates                                                  |
| `reading_progress`         | per user/book                                                            |
| `audit_logs`               | actor, action, target, metadata, timestamp                               |

Import transform rules: Phoenix §5.5 / `phoenix-data-migration` skill.

**Landed (WS2a):** canonical types live in `types/mongo.ts` and are re-exported
from `types/index.ts` as `MongoProfile`, `MongoBook`, `MongoOrder`, etc.
Connection: `lib/mongodb.ts` (canonical) + `lib/mongo.ts` (doc-path alias, D2).
Queries: `lib/mongo-queries.ts`.
