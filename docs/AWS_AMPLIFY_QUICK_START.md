# 🚀 AWS Amplify - Quick Start

This guide gets you up and running on AWS Amplify in under 10 minutes.

## What You Need

1. **AWS Account** - Sign up at https://aws.amazon.com
2. **GitHub Repository** - This repository pushed to GitHub
3. **Supabase Project** - Free at https://supabase.com
4. **Stripe Account** - Get test keys at https://stripe.com

## 5-Minute Deploy

### Step 1: Supabase Setup (2 minutes)

1. Create a Supabase project at https://supabase.com
2. Go to **SQL Editor** → Run this migration:
   ```sql
   -- Copy and paste from: supabase/migrations/20260116000000_initial_schema.sql
   ```
3. Get your keys from **Settings** → **API**:
   - Project URL
   - Anon key
   - Service role key

### Step 2: Stripe Setup (1 minute)

1. Sign up at https://stripe.com
2. Get your **test keys** from **Developers** → **API keys**:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)

### Step 3: Deploy to Amplify (2 minutes)

1. Go to **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
2. Click **"New app"** → **"Host web app"**
3. Connect to **GitHub** and select this repository
4. Amplify detects `amplify.yml` automatically ✅
5. Click **"Next"**

### Step 4: Add Environment Variables (1 minute)

Add these in the Amplify Console:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://main.xxxxx.amplifyapp.com
NODE_ENV=production
```

**Note:** For `STRIPE_WEBHOOK_SECRET`, you can set a temporary value and update it after deployment.

### Step 5: Deploy! 

Click **"Save and deploy"** - Your app will be live in 5-10 minutes! 🎉

## Post-Deployment (Optional)

### 1. Configure Stripe Webhook

Once deployed, set up the webhook:

1. In Stripe Dashboard → **Webhooks**
2. Add endpoint: `https://main.xxxxx.amplifyapp.com/api/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. Copy the **signing secret**
5. Update `STRIPE_WEBHOOK_SECRET` in Amplify
6. Redeploy (or wait for auto-deploy)

### 2. Verify Everything Works

Visit your app:
- Homepage should load ✅
- `/api/health` should return `{"status":"healthy"}` ✅
- Test user signup/login ✅
- Browse books ✅

## What's Included in Phase 1

✅ **Ready to use immediately:**
- User authentication and profiles
- Book browsing and search
- Reading interface
- Payment processing (Stripe)
- Author manuscript submission
- Admin dashboard
- Mobile-responsive design

## What's Coming in Phase 2

🔜 **Future enhancements:**
- AI recommendations (requires OpenAI API)
- Email notifications (requires Resend)
- Audiobook support
- Advanced analytics

## Troubleshooting

### Build Fails
- Check all environment variables are set
- Review build logs in Amplify Console

### Can't Connect to Database
- Verify Supabase URL and keys
- Check if migrations are applied
- Visit `/api/health` to see detailed error

### Payments Don't Work
- Ensure Stripe keys are correct
- Use test keys for testing
- Configure webhook after deployment

## Need Help?

See the complete guide: [AWS_AMPLIFY_DEPLOYMENT.md](./AWS_AMPLIFY_DEPLOYMENT.md)

---

**You're all set!** Your publishing platform is now live on AWS Amplify. 🚀
