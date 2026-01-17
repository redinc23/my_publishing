# API Documentation

Complete API reference for the MANGU platform.

## Authentication

Most endpoints require authentication via Supabase Auth. Include the session token in requests.

## Endpoints

### Resonance Engine

#### GET /api/resonance/recommend

Get personalized book recommendations.

**Query Parameters:**
- `user_id` (optional): User ID for personalized recommendations
- `limit` (optional, default: 10): Number of recommendations
- `genre` (optional): Filter by genre

**Response:**
```json
{
  "data": [
    {
      "book_id": "uuid",
      "score": 0.95,
      "algorithm": "vector_similarity",
      "metadata": {}
    }
  ],
  "meta": {
    "algorithm": "vector_similarity",
    "user_id": "uuid",
    "total_results": 10
  }
}
```

#### POST /api/resonance/track

Track engagement events.

**Body:**
```json
{
  "user_id": "uuid",
  "book_id": "uuid",
  "event_type": "view|purchase|read|rating|share|wishlist",
  "event_value": {}
}
```

#### POST /api/resonance/embed

Generate embedding for a book (admin only).

**Body:**
```json
{
  "book_id": "uuid"
}
```

#### GET /api/resonance/similar

Get similar books.

**Query Parameters:**
- `book_id`: Book ID to find similar books for
- `limit` (optional, default: 6): Number of results

### Checkout

#### POST /api/checkout

Create Stripe checkout session.

**Body:**
```json
{
  "book_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Webhooks

#### POST /api/webhook

Stripe webhook endpoint. Handles:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.updated`

### Session

#### GET /api/session

Get current user session.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "reader"
  }
}
```

### Upload

#### POST /api/upload

Upload file (manuscripts, covers, etc.).

**Form Data:**
- `file`: File to upload

**Response:**
```json
{
  "url": "https://..."
}
```

### Health

#### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-16T00:00:00Z"
}
```

## Rate Limits

- API endpoints: 100 requests per minute per IP
- Authentication endpoints: 10 requests per minute per IP
- Upload endpoints: 5 requests per minute per user

## Error Codes

- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Authentication

Include Supabase session token in Authorization header:

```
Authorization: Bearer <session_token>
```

## Examples

### Get Recommendations

```bash
curl -X POST https://api.mangu.app/api/resonance/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"user_id": "uuid", "limit": 10}'
```

### Create Checkout Session

```bash
curl -X POST https://api.mangu.app/api/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"book_id": "uuid", "user_id": "uuid"}'
```
