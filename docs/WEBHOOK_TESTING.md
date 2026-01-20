# Stripe Webhook Testing Guide

This guide explains how to test Stripe webhooks locally during development.

## Prerequisites

1. Stripe account (test mode)
2. Stripe CLI installed
3. Local development server running

## Setup

### 1. Install Stripe CLI

**macOS (Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download from https://github.com/stripe/stripe-cli/releases
# Or use package manager
```

**Windows:**
Download from https://github.com/stripe/stripe-cli/releases

### 2. Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate with Stripe.

### 3. Forward Webhooks to Local Server

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

This command will:
- Start listening for webhook events from your Stripe account
- Forward them to your local server
- Display the webhook signing secret (starts with `whsec_`)

**Important:** Copy the webhook signing secret and add it to your `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4. Trigger Test Events

In a new terminal, trigger test events:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test payment failure
stripe trigger payment_intent.payment_failed

# Test refund
stripe trigger charge.refunded

# Test checkout expiration
stripe trigger checkout.session.expired
```

## Testing Specific Scenarios

### Test Successful Checkout

1. Start webhook listener:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```

2. Create a test checkout session in your app (or use Stripe CLI):
   ```bash
   stripe checkout sessions create \
     --success-url "http://localhost:3000/books/test-book?success=true" \
     --cancel-url "http://localhost:3000/books/test-book?canceled=true" \
     --mode payment \
     --line-items '[{"price_data":{"currency":"usd","product_data":{"name":"Test Book"},"unit_amount":999},"quantity":1}]' \
     --metadata book_id=test-book-id \
     --metadata user_id=test-user-id
   ```

3. Complete the checkout in the browser (use test card: `4242 4242 4242 4242`)

4. Verify webhook was received:
   - Check terminal output for webhook event
   - Check your application logs
   - Verify order was created in database

### Test Payment Failure

```bash
stripe trigger payment_intent.payment_failed
```

Verify that:
- Webhook is received
- Error is logged appropriately
- User is notified (if implemented)

### Test Refund

```bash
stripe trigger charge.refunded
```

Verify that:
- Order status is updated to 'refunded'
- Refund reason is recorded
- Analytics event is created

## Webhook Event Types

The application handles these webhook events:

- `checkout.session.completed` - Order creation
- `checkout.session.expired` - Abandoned checkout tracking
- `charge.refunded` - Refund processing
- `payment_intent.payment_failed` - Payment failure logging

## Debugging

### View Webhook Events

```bash
# List recent events
stripe events list

# View specific event
stripe events retrieve evt_...

# View event payload
stripe events retrieve evt_... --expand data.object
```

### Check Webhook Logs

1. **Stripe Dashboard**: Go to Developers → Webhooks → Your endpoint → View logs

2. **Local Logs**: Check your application console for webhook processing logs

3. **Webhook Response**: The endpoint returns JSON with processing results

### Common Issues

**Webhook signature verification fails:**
- Ensure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
- Secret changes each time you restart `stripe listen`
- Update `.env.local` with new secret

**Webhook not received:**
- Verify local server is running on correct port
- Check firewall/network settings
- Ensure webhook endpoint is accessible: `http://localhost:3000/api/webhook`

**Order not created:**
- Check webhook logs for errors
- Verify metadata includes `book_id` and `user_id`
- Check database connection and migrations

**Duplicate orders:**
- Webhook has idempotency protection
- Check `webhook_events` table for duplicate event IDs
- Verify idempotency logic is working

## Production Setup

For production webhooks:

1. **Create Webhook Endpoint** in Stripe Dashboard:
   - URL: `https://your-domain.com/api/webhook`
   - Events: Select the events listed above

2. **Get Webhook Secret**:
   - Copy the signing secret from Stripe Dashboard
   - Add to production environment variables

3. **Test Production Webhook**:
   ```bash
   stripe trigger checkout.session.completed --api-key sk_live_...
   ```

## Security Notes

- **Never commit webhook secrets** to version control
- **Always verify webhook signatures** (already implemented)
- **Use HTTPS** in production
- **Rate limit** webhook endpoints (already implemented)
- **Log all webhook events** for debugging and audit

## Additional Resources

- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks Locally](https://stripe.com/docs/stripe-cli/webhooks)
