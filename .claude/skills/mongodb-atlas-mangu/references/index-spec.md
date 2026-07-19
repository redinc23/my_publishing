# Index Spec (minimum)

| Collection   | Index                                           | Notes                       |
| ------------ | ----------------------------------------------- | --------------------------- |
| `books`      | `{ slug: 1 }` unique                            |                             |
| `books`      | text index on title/description                 | for `searchBooks`           |
| `orders`     | `{ stripe_payment_intent_id: 1 }` unique sparse | webhook idempotency         |
| `profiles`   | `{ auth_user_id: 1 }` unique                    |                             |
| `reviews`    | `{ book_id: 1, user_id: 1 }`                    | adjust to final field names |
| `audit_logs` | `{ created_at: -1 }`                            | optional TTL later          |

Exact definitions live in `scripts/mongo-ensure-indexes.ts` (scaffold) once merged.
