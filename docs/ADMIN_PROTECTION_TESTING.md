# Admin Protection Testing Guide

This guide covers how to test admin route protection and role-based access control.

## Overview

Admin routes are protected at multiple levels:
1. **Middleware** - Checks authentication and role
2. **Layout Component** - Double-checks admin role
3. **Server Actions** - Validates permissions

## Test Scenarios

### 1. Unauthenticated Access

**Test Steps:**
1. Logout (or use incognito mode)
2. Navigate to `/admin`
3. Navigate to `/admin/dashboard`
4. Navigate to `/admin/users`

**Expected Results:**
- ✅ All admin routes redirect to `/login`
- ✅ No admin content is visible
- ✅ User cannot access admin functionality

**Verify:**
- Check redirect URL is `/login`
- Verify no admin UI is rendered
- Check browser console for errors

### 2. Authenticated Non-Admin Access

**Test Steps:**
1. Login as regular user (role: `reader`)
2. Try to access `/admin`
3. Try to access `/admin/dashboard`
4. Try to access `/admin/users`

**Expected Results:**
- ✅ All admin routes redirect to `/` (home)
- ✅ No admin content is visible
- ✅ User sees regular user interface
- ✅ Error logged but not exposed to user

**Verify:**
- Check redirect URL is `/`
- Verify admin UI is not rendered
- Check server logs for access attempts
- Verify user's role in database

### 3. Authenticated Admin Access

**Test Steps:**
1. Login as admin user (role: `admin`)
2. Navigate to `/admin`
3. Navigate to `/admin/dashboard`
4. Navigate to `/admin/users`
5. Navigate to `/admin/books`

**Expected Results:**
- ✅ All admin routes are accessible
- ✅ Admin UI is rendered correctly
- ✅ Admin functionality works
- ✅ No redirects occur

**Verify:**
- Check all admin pages load
- Verify admin sidebar is visible
- Test admin functionality
- Check user role in database

### 4. Role Escalation Attempt

**Test Steps:**
1. Login as regular user
2. Try to manually change role in database
3. Try to access admin routes
4. Try to call admin API endpoints directly

**Expected Results:**
- ✅ Database role change doesn't grant access (requires re-login)
- ✅ Direct API calls fail authorization
- ✅ Admin routes still redirect
- ✅ Security is maintained

**Verify:**
- Check middleware validates role on each request
- Verify API endpoints check role
- Test that session refresh is required

### 5. Author Route Protection

**Test Steps:**
1. Login as regular user (role: `reader`)
2. Try to access `/author/dashboard`
3. Login as author (role: `author`)
4. Try to access `/author/dashboard`

**Expected Results:**
- ✅ Regular users redirected from author routes
- ✅ Authors can access author routes
- ✅ Admins can access author routes (if configured)

**Verify:**
- Check redirect behavior
- Verify role checks in middleware
- Test author functionality

### 6. Partner Route Protection

**Test Steps:**
1. Login as regular user
2. Try to access `/partner/dashboard`
3. Login as partner (role: `partner`)
4. Try to access `/partner/dashboard`

**Expected Results:**
- ✅ Regular users redirected from partner routes
- ✅ Partners can access partner routes
- ✅ Admins can access partner routes (if configured)

**Verify:**
- Check redirect behavior
- Verify role checks
- Test partner functionality

## Manual Testing Checklist

- [ ] Unauthenticated users cannot access `/admin`
- [ ] Regular users cannot access `/admin`
- [ ] Admin users can access `/admin`
- [ ] Author routes protected correctly
- [ ] Partner routes protected correctly
- [ ] Role changes require re-login
- [ ] Direct API calls are protected
- [ ] Error messages don't leak information
- [ ] Redirects work correctly
- [ ] Session expiration handled

## Code Locations

### Middleware Protection
- File: `middleware.ts`
- Lines: 81-103 (admin check), 105-126 (author check), 128-149 (partner check)

### Layout Protection
- File: `app/admin/layout.tsx`
- Uses: `requireAdmin()` from `lib/middleware/auth.ts`

### Auth Utilities
- File: `lib/middleware/auth.ts`
- Functions: `requireAdmin()`, `hasRole()`, `isAdmin()`

## Security Best Practices

1. **Defense in Depth**: Multiple layers of protection
2. **Fail Secure**: Default to denying access
3. **No Information Leakage**: Don't reveal why access was denied
4. **Role Validation**: Always check role on each request
5. **Session Validation**: Verify session is still valid

## Common Issues

### Admin Can't Access Routes

**Symptom:** Admin user redirected from admin routes

**Solution:**
- Check user's role in `profiles` table
- Verify role is exactly `admin` (case-sensitive)
- Check middleware is running
- Verify session is valid
- Check for typos in role check

### Regular Users Can Access Admin Routes

**Symptom:** Non-admin users can see admin pages

**Solution:**
- Check middleware configuration
- Verify `requireAdmin()` is called
- Check role check logic
- Review RLS policies
- Test with different users

### Redirect Loop

**Symptom:** Infinite redirects between login and admin

**Solution:**
- Check middleware logic
- Verify redirect conditions
- Check for conflicting redirects
- Review session handling
- Check for middleware matcher configuration

## Automated Testing

Consider adding E2E tests:

```typescript
test('admin routes require admin role', async ({ page }) => {
  // Login as regular user
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Try to access admin
  await page.goto('/admin');
  
  // Should redirect to home
  await expect(page).toHaveURL('/');
});
```

## Production Considerations

- Use persistent session storage
- Implement audit logging for admin access
- Set up alerts for failed admin access attempts
- Regular security audits
- Monitor for privilege escalation attempts
