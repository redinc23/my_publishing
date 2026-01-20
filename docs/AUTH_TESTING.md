# Authentication Testing Guide

This guide covers how to test all authentication flows in the MANGU platform.

## Prerequisites

1. Supabase project configured
2. Environment variables set in `.env.local`
3. Database migrations applied
4. Email service configured (for email verification)

## Test Scenarios

### 1. User Registration

**Test Steps:**
1. Navigate to `/register`
2. Fill in the registration form:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Full Name: `Test User`
3. Submit the form

**Expected Results:**
- ✅ User account is created in Supabase Auth
- ✅ Profile is automatically created (via database trigger)
- ✅ Verification email is sent (if email confirmation enabled)
- ✅ User is redirected to home page or verification page
- ✅ Rate limiting prevents more than 5 registration attempts per 15 minutes

**Verify:**
- Check Supabase Dashboard → Authentication → Users
- Check database `profiles` table
- Check email inbox for verification email

### 2. Email Verification

**Test Steps:**
1. Register a new user (see above)
2. Navigate to `/verify-email` (or check email)
3. Click verification link in email OR
4. Click "Resend Verification Email" button

**Expected Results:**
- ✅ Verification link works and confirms email
- ✅ Resend button sends new verification email
- ✅ Rate limiting prevents more than 3 resend attempts per hour
- ✅ Verified users are redirected away from verification page

**Verify:**
- Check user's `email_confirmed_at` field in Supabase
- Verify redirect behavior

### 3. User Login

**Test Steps:**
1. Navigate to `/login`
2. Enter credentials:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. Submit the form

**Expected Results:**
- ✅ User is authenticated
- ✅ Session is created
- ✅ User is redirected to home page
- ✅ Rate limiting prevents more than 5 login attempts per 15 minutes
- ✅ Error messages are user-friendly

**Test Error Cases:**
- Wrong password → "Invalid email or password"
- Unverified email → "Please verify your email address"
- Non-existent user → "Invalid email or password"
- Rate limit exceeded → "Too many login attempts"

**Verify:**
- Check session cookie is set
- Verify redirect to home page
- Check user can access protected routes

### 4. Password Reset

**Test Steps:**
1. Navigate to `/reset-password`
2. Enter email address
3. Submit form
4. Check email for reset link
5. Click reset link
6. Enter new password
7. Submit

**Expected Results:**
- ✅ Reset email is sent
- ✅ Reset link works
- ✅ Password can be changed
- ✅ User can login with new password
- ✅ Rate limiting prevents more than 3 reset requests per hour

**Verify:**
- Check email inbox for reset email
- Verify password change works
- Test login with new password

### 5. OAuth Callback

**Test Steps:**
1. Configure OAuth provider in Supabase (GitHub/Google)
2. Navigate to OAuth login URL
3. Complete OAuth flow
4. Verify callback handling

**Expected Results:**
- ✅ OAuth callback route handles success
- ✅ OAuth callback route handles errors
- ✅ Profile is created automatically
- ✅ User is redirected appropriately

**Verify:**
- Check callback route logs
- Verify profile creation
- Test error scenarios

### 6. Session Management

**Test Steps:**
1. Login successfully
2. Refresh page
3. Close browser and reopen
4. Check session persistence

**Expected Results:**
- ✅ Session persists across page refreshes
- ✅ Session persists across browser restarts (if configured)
- ✅ Session expires appropriately
- ✅ Logout clears session

**Verify:**
- Check session cookie expiration
- Test logout functionality
- Verify middleware handles expired sessions

### 7. Rate Limiting

**Test Steps:**
1. Attempt 6 login attempts rapidly (within 15 minutes)
2. Attempt 4 password reset requests rapidly (within 1 hour)
3. Attempt 4 email verification resends rapidly (within 1 hour)

**Expected Results:**
- ✅ 6th login attempt is blocked
- ✅ 4th password reset is blocked
- ✅ 4th email verification resend is blocked
- ✅ Appropriate error messages shown

**Verify:**
- Check rate limit responses (429 status)
- Verify error messages
- Test rate limit reset timing

### 8. Protected Routes

**Test Steps:**
1. Try to access `/admin` without login
2. Try to access `/author` without login
3. Try to access `/library` without login
4. Login and retry

**Expected Results:**
- ✅ Unauthenticated users redirected to `/login`
- ✅ Authenticated users can access routes
- ✅ Role-based access control works
- ✅ Admin routes require admin role

**Verify:**
- Check redirect behavior
- Verify role checks
- Test unauthorized access attempts

## Manual Testing Checklist

- [ ] User registration works
- [ ] Profile auto-creation works
- [ ] Email verification works
- [ ] Email verification resend works
- [ ] Login works with correct credentials
- [ ] Login fails with wrong credentials
- [ ] Password reset flow works
- [ ] OAuth callback works (if configured)
- [ ] Session persistence works
- [ ] Logout works
- [ ] Rate limiting works
- [ ] Protected routes redirect correctly
- [ ] Admin routes require admin role
- [ ] Author routes require author role

## Common Issues

### Profile Not Created

**Symptom:** User registered but no profile in database

**Solution:**
- Check database trigger exists: `handle_new_user`
- Verify trigger is enabled
- Check Supabase logs for trigger errors
- Manually create profile if needed

### Email Not Sent

**Symptom:** Verification/reset emails not received

**Solution:**
- Check Supabase email settings
- Verify email service is configured
- Check spam folder
- Review Supabase email logs

### Rate Limiting Too Aggressive

**Symptom:** Legitimate users blocked

**Solution:**
- Adjust rate limits in `lib/utils/auth-rate-limit.ts`
- Consider using IP-based limiting instead of email-based
- Implement CAPTCHA for repeated failures

### OAuth Not Working

**Symptom:** OAuth callback fails

**Solution:**
- Verify OAuth provider configuration in Supabase
- Check callback URL matches Supabase settings
- Review callback route error logs
- Verify redirect URLs are correct

## Automated Testing

For automated testing, see:
- `tests/e2e/purchase-flow.spec.ts` - E2E test examples
- Consider adding auth-specific E2E tests

## Security Notes

- Rate limiting is in-memory (resets on server restart)
- For production, use persistent rate limiting (Redis/Upstash)
- Email verification should be required for sensitive operations
- Password reset links should expire (handled by Supabase)
- OAuth tokens should be validated (handled by Supabase)
