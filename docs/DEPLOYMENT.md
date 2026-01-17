# Deployment Guide

Complete guide for deploying the MANGU platform to production.

## Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Vercel account (or alternative hosting)
- Stripe account
- OpenAI API key
- Resend account (for emails)

## 1. Environment Setup

### Required Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Email (Resend)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NODE_ENV=production
```

## 2. Database Setup

### Run Migrations

1. Connect to your Supabase project
2. Navigate to SQL Editor
3. Run the migration file: `supabase/migrations/20260116000000_initial_schema.sql`
4. Verify all tables, indexes, and RLS policies are created

### Verify RLS Policies

Test that Row Level Security is working:
- Users can only see their own data
- Published books are publicly visible
- Authors can only manage their own manuscripts

### Seed Database (Optional)

Run the seeding script to populate with test data:

```bash
npm run db:seed
```

## 3. Vercel Deployment

### Initial Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link project: `vercel link`
4. Add environment variables in Vercel dashboard

### Deploy

```bash
vercel --prod
```

### Configure Environment Variables

Add all required environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add each variable for Production, Preview, and Development

## 4. Stripe Webhook Configuration

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `customer.subscription.updated`
4. Copy webhook secret to environment variables

## 5. DNS & SSL

Vercel automatically handles SSL certificates. Configure your domain:

1. Add domain in Vercel dashboard
2. Update DNS records as instructed
3. Wait for SSL certificate provisioning

## 6. Post-Deployment Verification

### Checklist

- [ ] Homepage loads correctly
- [ ] Authentication works (signup/login)
- [ ] Books can be browsed and searched
- [ ] Book detail pages load
- [ ] Checkout redirects to Stripe
- [ ] Webhooks are receiving events
- [ ] Email sending works
- [ ] Admin dashboard accessible
- [ ] RLS policies enforced

### Test Commands

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Test
npm test
```

## 7. Monitoring

### Recommended Tools

- **Vercel Analytics**: Built-in performance monitoring
- **Sentry**: Error tracking (optional)
- **Supabase Dashboard**: Database monitoring
- **Stripe Dashboard**: Payment monitoring

## 8. Rollback Procedures

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

### Database Rollback

1. Create backup before migrations
2. Use Supabase point-in-time recovery if needed
3. Restore from backup if necessary

## Troubleshooting

### Common Issues

**Build Fails**
- Check environment variables are set
- Verify all dependencies are in package.json
- Check for TypeScript errors

**Database Connection Issues**
- Verify Supabase URL and keys
- Check RLS policies aren't blocking queries
- Verify network connectivity

**Stripe Webhook Not Working**
- Verify webhook URL is correct
- Check webhook secret matches
- Review Stripe webhook logs

**Email Not Sending**
- Verify Resend API key
- Check email templates render correctly
- Review Resend dashboard for errors

## Support

For issues, check:
- [Documentation](./DEVELOPMENT.md)
- [API Reference](./API.md)
- GitHub Issues
