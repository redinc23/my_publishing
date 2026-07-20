# Index Spec (minimum)

| Collection         | Index                                           | Notes                       |
| ------------------ | ----------------------------------------------- | --------------------------- |
| `books`            | `{ slug: 1 }` unique                            |                             |
| `books`            | text index on title/description                 | for `searchBooks`           |
| `orders`           | `{ stripe_payment_intent_id: 1 }` unique sparse | webhook idempotency         |
| `orders`           | `{ stripe_session_id: 1 }` unique sparse        | checkout correlation        |
| `profiles`         | `{ auth_user_id: 1 }` unique                    |                             |
| `reviews`          | `{ book_id: 1, user_id: 1 }` unique             |                             |
| `reading_progress` | `{ user_id: 1, book_id: 1 }` unique             |                             |
| `audit_logs`       | `{ actor_id: 1, created_at: -1 }`               |                             |

Exact definitions live in `scripts/mongo-ensure-indexes.ts`. Orders use embedded
`order_items[]` (no separate `order_items` collection indexes).
