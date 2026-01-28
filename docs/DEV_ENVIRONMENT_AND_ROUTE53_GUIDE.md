# 🚀 Dev Environment & Route 53 Setup Guide

A comprehensive guide for setting up development environments (like Render) and custom domains with AWS Amplify and Route 53.

---

## 📋 Table of Contents

1. [Dev Environment Setup (Render-like Experience)](#dev-environment-setup-render-like-experience)
2. [Route 53 Custom Domain Setup](#route-53-custom-domain-setup)
3. [Potential Blockers & Solutions](#potential-blockers--solutions)
4. [Quick Comparison: Render vs AWS Amplify](#quick-comparison-render-vs-aws-amplify)

---

## 🎯 Dev Environment Setup (Render-like Experience)

AWS Amplify provides a similar experience to Render with automatic GitHub integration and preview environments.

### How Amplify Works Like Render

| Feature | Render | AWS Amplify |
|---------|--------|-------------|
| GitHub Auto-Deploy | ✅ Push to deploy | ✅ Push to deploy |
| Preview Environments | ✅ Per-branch | ✅ Per-branch/PR |
| Custom Domains | ✅ Built-in | ✅ Via Route 53 |
| Environment Variables | ✅ Dashboard | ✅ Dashboard |
| SSL Certificates | ✅ Auto | ✅ Auto (with ACM) |
| Rollbacks | ✅ One-click | ✅ One-click |

### Step 1: Connect Your Repository

1. **Go to AWS Amplify Console**: https://console.aws.amazon.com/amplify/
2. Click **"New app"** → **"Host web app"**
3. Select **"GitHub"** as the source
4. Authorize AWS Amplify to access your repositories
5. Select the `my_publishing` repository
6. Choose the branch to deploy (e.g., `main` for production)

### Step 2: Configure Build Settings

Amplify automatically detects the `amplify.yml` file. Verify the settings:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### Step 3: Set Up Preview Environments (Branch Deployments)

This gives you a **"dev environment"** for each branch, just like Render!

1. **In Amplify Console** → Go to your app
2. Click **"Hosting"** → **"Branch deployments"**
3. Click **"Connect branch"**
4. Select your branch (e.g., `develop`, `staging`, `feature-xyz`)
5. Each branch gets its own URL: `https://{branch}.{appid}.amplifyapp.com`

#### Recommended Branch Strategy

| Branch | Purpose | URL Example |
|--------|---------|-------------|
| `main` | Production | `https://main.d1234abcd.amplifyapp.com` |
| `staging` | Pre-production testing | `https://staging.d1234abcd.amplifyapp.com` |
| `develop` | Development/integration | `https://develop.d1234abcd.amplifyapp.com` |

### Step 4: Enable Pull Request Previews

Get automatic preview environments for every PR:

1. Go to **Amplify Console** → Your app → **Previews**
2. Click **"Enable previews"**
3. Select the source branch (e.g., `main`)
4. Each PR automatically gets: `https://pr-{number}.d1234abcd.amplifyapp.com`

### Step 5: Add Environment Variables

1. Go to **Amplify Console** → Your app → **Hosting** → **Environment variables**
2. Add the required variables:

```bash
# Required for Phase 1
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=https://main.xxxxx.amplifyapp.com
NODE_ENV=production
```

#### Branch-Specific Environment Variables

You can set different env vars per branch:

1. In **Environment variables**, click **"Manage variables"**
2. For each variable, you can set **branch overrides**
3. Example: Use test Stripe keys for `develop`, live keys for `main`

---

## 🌐 Route 53 Custom Domain Setup

### Prerequisites

- An AWS account
- A registered domain (can register through Route 53 or transfer from another registrar)
- Amplify app already deployed

### Option A: Register a New Domain in Route 53

1. **Go to Route 53 Console**: https://console.aws.amazon.com/route53/
2. Click **"Domain registration"** → **"Register domain"**
3. Search for your desired domain name
4. Complete the purchase (domains start at ~$12/year for `.com`)
5. Route 53 automatically creates a hosted zone for your domain

### Option B: Transfer an Existing Domain to Route 53

1. Unlock your domain at your current registrar
2. Get the authorization/EPP code from your current registrar
3. In Route 53: **"Domain registration"** → **"Transfer domain"**
4. Enter your domain and authorization code
5. Wait for transfer to complete (can take 5-7 days)

### Option C: Use Route 53 with a Domain from Another Registrar

1. **Create a Hosted Zone in Route 53**:
   - Go to Route 53 → **"Hosted zones"** → **"Create hosted zone"**
   - Enter your domain name (e.g., `mydomain.com`)
   - Note the 4 **Name Servers (NS)** created

2. **Update Name Servers at Your Registrar**:
   - Log into your domain registrar (GoDaddy, Namecheap, etc.)
   - Update the nameservers to the Route 53 NS values:
     ```
     ns-1234.awsdns-12.org
     ns-567.awsdns-34.co.uk
     ns-890.awsdns-56.net
     ns-012.awsdns-78.com
     ```
   - Wait for DNS propagation (can take up to 48 hours)

### Step-by-Step: Connect Route 53 Domain to Amplify

#### Step 1: Add Domain in Amplify Console

1. Go to **Amplify Console** → Your app → **Hosting** → **Custom domains**
2. Click **"Add domain"**
3. If using Route 53: Your domains will appear in a dropdown
4. Select your domain or enter it manually
5. Click **"Configure domain"**

#### Step 2: Configure Subdomains

Amplify lets you map branches to subdomains:

| Subdomain | Branch | Purpose |
|-----------|--------|---------|
| `www.yourdomain.com` | `main` | Production |
| `yourdomain.com` | `main` | Apex domain → Production |
| `staging.yourdomain.com` | `staging` | Staging environment |
| `dev.yourdomain.com` | `develop` | Development environment |

Configuration example:
```
www      → main branch
(blank)  → redirect to www
staging  → staging branch
dev      → develop branch
```

#### Step 3: SSL Certificate (Automatic)

AWS Amplify automatically:
1. Requests an SSL certificate from AWS Certificate Manager (ACM)
2. Validates domain ownership via DNS
3. Provisions the certificate (takes 10-30 minutes)

**If using Route 53**: DNS validation is automatic!
**If using external DNS**: Add the CNAME records Amplify provides

#### Step 4: Update DNS Records

If using Route 53 (integrated with Amplify):
- DNS records are created **automatically**!

If using external DNS:
1. Add the provided CNAME records at your registrar
2. Example records:
   ```
   www    CNAME  d1234abcd.cloudfront.net
   ```

#### Step 5: Update Environment Variables

After domain setup:

1. Go to **Amplify Console** → **Environment variables**
2. Update `NEXT_PUBLIC_SITE_URL` to your custom domain:
   ```
   NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com
   ```
3. Trigger a redeploy

#### Step 6: Update Stripe Webhook

1. Go to **Stripe Dashboard** → **Webhooks**
2. Update the webhook URL to your custom domain:
   ```
   https://www.yourdomain.com/api/webhook
   ```
3. Copy the new signing secret if regenerated
4. Update `STRIPE_WEBHOOK_SECRET` in Amplify

---

## 🚧 Potential Blockers & Solutions

### Blocker 1: Missing Supabase Configuration

**Symptom**: Build succeeds but app shows database errors

**Solution**:
1. Create a Supabase project at https://supabase.com
2. Run all migrations in order (see `docs/MIGRATIONS.md`)
3. Add all 3 Supabase environment variables to Amplify

**Status**: ✅ Migrations ready in `supabase/migrations/`

### Blocker 2: Database Migrations Not Applied

**Symptom**: `/api/health` returns errors about missing tables

**Solution**: Apply migrations in the correct order:
```
1. 20260116000000_initial_schema.sql
2. 20260117000000_analytics_events.sql
3. 20260117000000_storage_policies.sql
4. 20260117000001_analytics_sessions.sql
5. 20260117000002_book_stats_materialized.sql
6. 20260117000003_revenue_tracking.sql
7. 20260117000004_author_payouts.sql
8. 20260117000005_book_pricing.sql
9. 20260118000000_critical_fixes.sql
10. 20260120000006_performance_optimizations.sql
11. 20260121000000_profile_trigger.sql
12. 20260122000000_social_features.sql
```

### Blocker 3: Stripe Webhook Not Working

**Symptom**: Payments complete in Stripe but orders don't appear in the app

**Solution**:
1. After deployment, get your Amplify URL
2. Create webhook in Stripe: `https://your-app.amplifyapp.com/api/webhook`
3. Copy the webhook signing secret
4. Add `STRIPE_WEBHOOK_SECRET` to Amplify environment variables
5. Redeploy

**Workaround for initial deploy**: Set `STRIPE_WEBHOOK_SECRET=temporary_value` then update after getting the real secret.

### Blocker 4: SSL Certificate Not Provisioning

**Symptom**: Custom domain shows "pending verification" for a long time

**Solution**:
- **Route 53 users**: This should be automatic. Wait 30 minutes.
- **External DNS users**: Add the CNAME validation records Amplify shows
- Check: DNS records may take up to 48 hours to propagate

### Blocker 5: Build Fails on Amplify

**Symptom**: Build fails with various errors

**Common Causes & Solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| `Module not found` | Missing dependency | Run `npm install` locally and push |
| `Environment variable not found` | Missing env var | Add all required env vars in Amplify |
| `TypeScript errors` | Type errors | Run `npm run type-check` locally to fix |
| `Out of memory` | Large build | Increase Amplify compute tier |

### Blocker 6: Environment Variables Not Available

**Symptom**: App builds but shows undefined for config values

**Solution**:
- Ensure public variables start with `NEXT_PUBLIC_`
- After adding env vars, trigger a **new deployment** (they don't hot-reload)
- Check the build logs to verify env vars are present

### Blocker 7: Route 53 DNS Not Resolving

**Symptom**: Domain doesn't point to Amplify app

**Solution**:
1. Verify nameservers are updated at your registrar
2. Check hosted zone in Route 53 for correct records
3. Use `dig` or `nslookup` to verify DNS:
   ```bash
   dig www.yourdomain.com
   nslookup www.yourdomain.com
   ```
4. Wait up to 48 hours for propagation

---

## 📊 Quick Comparison: Render vs AWS Amplify

### Pricing

| Feature | Render | AWS Amplify |
|---------|--------|-------------|
| Free tier | 750 hours/month | 1000 build minutes + 15GB/month |
| Pro pricing | $7-25/month per service | Pay-as-you-go (~$5-20/month typical) |
| Custom domains | Free with SSL | Free with SSL |
| Preview deployments | Included | Included |

### Setup Complexity

| Task | Render | AWS Amplify |
|------|--------|-------------|
| Initial setup | 5 minutes | 10 minutes |
| GitHub integration | Automatic | Automatic |
| Environment variables | Dashboard | Dashboard |
| Custom domain (no Route 53) | 10 minutes | 15 minutes |
| Custom domain (with Route 53) | N/A | 5 minutes (automated) |

### Features Comparison

| Feature | Render | AWS Amplify |
|---------|--------|-------------|
| Auto-deploys | ✅ | ✅ |
| PR previews | ✅ | ✅ |
| Rollbacks | ✅ | ✅ |
| Branch deploys | ✅ | ✅ |
| CDN | ✅ | ✅ (CloudFront) |
| Server-side rendering | ✅ | ✅ |
| Edge functions | ❌ | ✅ (Lambda@Edge) |
| AWS service integration | ❌ | ✅ Full AWS ecosystem |

### When to Choose

**Choose Render if**:
- You want the simplest possible setup
- You don't need AWS service integration
- You prefer a more opinionated platform

**Choose AWS Amplify if**:
- You want tight AWS integration (Route 53, CloudFront, Lambda)
- You need enterprise-grade security and compliance
- You want to use other AWS services in the future
- You want more control over infrastructure

---

## 🎉 Summary: Your Action Items

### Quick Launch Checklist

1. **Prerequisites (15 minutes)**
   - [ ] Create Supabase project → https://supabase.com
   - [ ] Run database migrations (see order above)
   - [ ] Create Stripe account → https://stripe.com
   - [ ] Get API keys from both services

2. **Amplify Setup (10 minutes)**
   - [ ] Connect GitHub repo to Amplify
   - [ ] Add environment variables
   - [ ] Deploy main branch

3. **Dev Environment (5 minutes)**
   - [ ] Connect additional branches (staging, develop)
   - [ ] Enable PR previews

4. **Custom Domain with Route 53 (15 minutes)**
   - [ ] Create/transfer domain in Route 53
   - [ ] Add domain in Amplify Console
   - [ ] Configure subdomain mappings
   - [ ] Wait for SSL certificate
   - [ ] Update Stripe webhook URL

5. **Verify (5 minutes)**
   - [ ] Test homepage loads
   - [ ] Test authentication
   - [ ] Test `/api/health` endpoint
   - [ ] Test payment flow (test mode)

**Total time: ~50 minutes to full production deployment with custom domain!**

---

## 📚 Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Route 53 Documentation](https://docs.aws.amazon.com/route53/)
- [AWS Amplify Deployment Guide](./AWS_AMPLIFY_DEPLOYMENT.md)
- [Launch Checklist](./LAUNCH_CHECKLIST.md)
- [Migrations Guide](./MIGRATIONS.md)

---

## 🆘 Need Help?

If you encounter issues not covered here:

1. Check the [Troubleshooting section](#potential-blockers--solutions) above
2. Review Amplify build logs in the Console
3. Check `/api/health` endpoint for service status
4. Review Stripe webhook logs for payment issues

**You're ready to deploy!** 🚀
