# AWS Amplify Deployment Guide

Complete guide for deploying the MANGU platform to AWS Amplify.

## 🚀 Quick Start

The MANGU platform is now configured for AWS Amplify deployment with a streamlined setup process.

## Prerequisites

Before deploying to AWS Amplify, ensure you have:

1. **AWS Account** with Amplify access
2. **Supabase Project** set up with migrations applied
3. **Stripe Account** (for payments)
4. **GitHub Repository** connected to AWS Amplify

### Optional Services (for full functionality)
- OpenAI API key (for AI recommendations)
- Resend account (for emails)

## 1. AWS Amplify Setup

### Option A: Deploy via AWS Amplify Console (Recommended)

1. **Sign in to AWS Console**
   - Navigate to AWS Amplify
   - Click "New app" → "Host web app"

2. **Connect Repository**
   - Select "GitHub" as the source
   - Authorize AWS Amplify to access your repository
   - Select the `my_publishing` repository
   - Select the branch you want to deploy (e.g., `main`)

3. **Configure Build Settings**
   - AWS Amplify will automatically detect the `amplify.yml` configuration
   - Review the build settings (no changes needed)
   - The configuration includes:
     - Next.js build process
     - Caching for faster builds
     - Security headers

4. **Add Environment Variables**
   
   Add the following environment variables in the Amplify Console:
   
   **Required Variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_SITE_URL=https://your-amplify-domain.amplifyapp.com
   NODE_ENV=production
   ```
   
   **Optional Variables (for Phase 2):**
   ```
   OPENAI_API_KEY=sk-proj-...
   RESEND_API_KEY=re_...
   ```

5. **Deploy**
   - Click "Save and deploy"
   - AWS Amplify will build and deploy your app
   - Initial build takes 5-10 minutes

### Option B: Deploy via Amplify CLI

1. **Install Amplify CLI**
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Configure AWS credentials**
   ```bash
   amplify configure
   ```

3. **Initialize Amplify**
   ```bash
   amplify init
   ```

4. **Add hosting**
   ```bash
   amplify add hosting
   # Select: Amazon CloudFront and S3
   ```

5. **Deploy**
   ```bash
   amplify publish
   ```

## 2. Database Setup

### Supabase Configuration

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create a new project
   - Note your project URL and keys

2. **Run Migrations**
   
   Apply migrations in the Supabase SQL Editor in this order:
   
  1. `supabase/migrations/20260116000000_initial_schema.sql`
  2. `supabase/migrations/20260117000000_analytics_events.sql`
  3. `supabase/migrations/20260117000000_storage_policies.sql`
  4. `supabase/migrations/20260117000001_analytics_sessions.sql`
  5. `supabase/migrations/20260117000002_book_stats_materialized.sql`
  6. `supabase/migrations/20260117000003_revenue_tracking.sql`
  7. `supabase/migrations/20260117000004_author_payouts.sql`
  8. `supabase/migrations/20260117000005_book_pricing.sql`
  9. `supabase/migrations/20260118000000_critical_fixes.sql`
  10. `supabase/migrations/20260120000006_performance_optimizations.sql`
  11. `supabase/migrations/20260121000000_profile_trigger.sql`
  12. `supabase/migrations/20260122000000_social_features.sql`
  13. `supabase/migrations/20260123000000_author_policy_fixes.sql`

   **Note:** See `docs/MIGRATIONS.md` for detailed migration instructions.

3. **Enable pgvector Extension** (for AI recommendations - Phase 2)
   - Go to Database → Extensions
   - Enable `vector` extension

4. **Verify Setup**
   - After deployment, visit `https://your-app.amplifyapp.com/api/health`
   - Should return `"status": "healthy"`

## 3. Stripe Configuration

### Set Up Payment Processing

1. **Create Stripe Account**
   - Go to https://stripe.com
   - Create account and get API keys
   - Use **live keys** for production

2. **Configure Webhook**
   - In Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-app.amplifyapp.com/api/webhook`
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `customer.subscription.updated`
   - Copy the webhook signing secret
   - Add to Amplify environment variables

3. **Test Payments**
   - Use Stripe test mode first
   - Verify checkout flow works
   - Check webhook events are received

## 4. Custom Domain (Optional)

1. **Add Domain in Amplify Console**
   - Go to App settings → Domain management
   - Click "Add domain"
   - Enter your domain name

2. **Update DNS Records**
   - Add the CNAME records provided by Amplify
   - Wait for DNS propagation (can take up to 48 hours)

3. **Update Environment Variables**
   - Update `NEXT_PUBLIC_SITE_URL` to your custom domain
   - Redeploy the application

4. **Update Stripe Webhook**
   - Update webhook URL to use custom domain

## 5. Post-Deployment Verification

### Essential Checks

- [ ] **Homepage loads** - Visit your Amplify URL
- [ ] **Authentication works** - Test signup/login
- [ ] **Health check passes** - Visit `/api/health`
- [ ] **Books display** - Browse catalog
- [ ] **Payments work** - Test checkout (use Stripe test mode)

### Health Check Endpoint

Visit `https://your-app.amplifyapp.com/api/health` to verify:
- Database connection
- Authentication service
- Environment variables
- Overall system health

## 6. Monitoring and Maintenance

### AWS Amplify Monitoring

- **Build Logs**: View in Amplify Console → App → Build history
- **Function Logs**: CloudWatch logs for serverless functions
- **Metrics**: View in Amplify Console → Monitoring

### Supabase Monitoring

- **Database Performance**: Supabase Dashboard → Database
- **API Usage**: Supabase Dashboard → API
- **Storage**: Supabase Dashboard → Storage

### Stripe Monitoring

- **Payments**: Stripe Dashboard → Payments
- **Webhooks**: Stripe Dashboard → Webhooks (check delivery status)

## 7. Continuous Deployment

AWS Amplify automatically deploys when you push to your connected branch:

1. **Make Changes**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Automatic Build**
   - Amplify detects the push
   - Triggers automatic build and deploy
   - Updates live site on success

3. **Build Notifications**
   - Set up email notifications in Amplify Console
   - Get notified of build success/failure

## 8. Rollback Procedures

### Rollback via Amplify Console

1. Go to Amplify Console → Deployments
2. Find the previous successful deployment
3. Click "Redeploy this version"

### Rollback via Git

1. Revert to previous commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. Amplify will automatically deploy the reverted version

## 9. Environment-Specific Deployments

### Preview Environments

Create preview environments for branches:

1. In Amplify Console, enable previews for pull requests
2. Each PR gets its own preview URL
3. Test changes before merging

### Multiple Environments

Deploy different branches to different environments:

- `main` branch → Production
- `staging` branch → Staging environment
- `develop` branch → Development environment

## Troubleshooting

### Build Fails

**Check build logs:**
- Amplify Console → Build history → View logs
- Look for error messages

**Common issues:**
- Missing environment variables
- TypeScript errors
- Dependency installation failures

**Solutions:**
```bash
# Test build locally
npm run build

# Check for TypeScript errors
npm run type-check

# Verify environment variables are set
```

### Database Connection Issues

**Symptoms:**
- `/api/health` returns errors
- Authentication doesn't work

**Solutions:**
- Verify Supabase URL and keys in environment variables
- Check Supabase project is active
- Verify network access (Amplify can connect to Supabase)

### Stripe Webhook Issues

**Symptoms:**
- Payments complete but orders not created
- Webhook events not received

**Solutions:**
- Verify webhook URL is correct
- Check webhook signing secret matches
- Review Stripe webhook logs for delivery failures
- Ensure Amplify domain is accessible

### Performance Issues

**Solutions:**
- Enable Amplify CDN caching
- Review CloudWatch metrics
- Optimize database queries
- Consider enabling Supabase connection pooling

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Next.js on Amplify](https://docs.amplify.aws/guides/hosting/nextjs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

## Phase 1: Immediate Launch Features

The following features are included in the immediate launch:

✅ **Core Features (Ready):**
- User authentication and profiles
- Book browsing and search
- Book detail pages
- Reading interface with progress tracking
- Payment processing with Stripe
- Author portal for manuscript submission
- Basic analytics and tracking
- Responsive design and mobile support

## Phase 2: Future Enhancements

The following features can be added in future phases:

🔜 **Future Features:**
- AI-powered recommendations (requires OpenAI API)
- Email notifications (requires Resend)
- Audiobook support
- Advanced analytics dashboard
- Partner portal for ARC requests
- Social sharing features
- Enhanced search with filters
- User reviews and ratings

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review AWS Amplify build logs
3. Verify all environment variables are set correctly
4. Check the health endpoint for service status

---

**Ready to Deploy!** Follow the steps above to launch the MANGU platform on AWS Amplify. 🚀
