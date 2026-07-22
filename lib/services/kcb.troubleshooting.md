# KCB OAuth Authentication - Troubleshooting Guide

## Overview

This guide provides detailed troubleshooting steps for KCB OAuth authentication issues, particularly the "KCB auth failed (500)" error.

## Required Environment Variables

Create these in your project's `.env.local` file:

```env
# KCB OAuth Configuration
KCB_BASE_URL=https://kcb-auth.example.com
KCB_AUTH_ENDPOINT=/oauth/authorize
KCB_TOKEN_ENDPOINT=/oauth/token
KCB_USER_INFO_ENDPOINT=/oauth/userinfo
KCB_CLIENT_ID=your_client_id_here
KCB_CLIENT_SECRET=your_client_secret_here
KCB_REDIRECT_URI=http://localhost:3000/api/auth/kcb/callback
KCB_SCOPE=openid profile email
KCB_SUCCESS_REDIRECT_URL=/dashboard

# Database Configuration (Neon)
DATABASE_URL=postgresql://user:password@host/database
```

## Error Codes and Solutions

### 1. Configuration Error (500)

**Error Message:** `"KCB configuration incomplete: missing clientId, clientSecret, redirectUri"`

**Solution:**
- Check that all required environment variables are set in `.env.local`
- Verify the variables are correctly loaded:
  ```bash
  echo $KCB_CLIENT_ID
  echo $KCB_CLIENT_SECRET
  echo $KCB_REDIRECT_URI
  ```
- Restart the development server after adding env vars

### 2. CSRF State Validation Failed (401)

**Error Message:** `"OAuth state validation failed - potential CSRF attack"`

**Causes:**
- State parameter doesn't match stored value in database
- State has expired (15-minute timeout)
- CSRF protection database not accessible

**Solutions:**
- Check database connection: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM kcbOAuthState;"`
- Verify redirect URI matches exactly in login and callback routes
- Check browser cookies are enabled
- Look for timing issues if running multiple instances

**Debug Steps:**
```sql
-- Check stored states
SELECT id, state, expiresAt, createdAt FROM kcbOAuthState ORDER BY createdAt DESC LIMIT 5;

-- Check if states are expiring
SELECT * FROM kcbOAuthState WHERE expiresAt < NOW();
```

### 3. Authorization Code Invalid (401)

**Error Message:** `"KCB auth failed (500)"` from token exchange

**Causes:**
- Authorization code has expired (usually 10-minute window)
- Authorization code already used
- Redirect URI mismatch between authorize and token endpoints
- Client credentials are incorrect

**Solutions:**
- Verify the authorization flow completes within 10 minutes
- Check redirect URI is identical in all three places:
  - KCB provider configuration
  - `KCB_REDIRECT_URI` environment variable
  - Callback route handler
- Verify `KCB_CLIENT_ID` and `KCB_CLIENT_SECRET` are correct
- Check KCB provider logs for code exchange requests

**Debug Steps:**
```bash
# Test token endpoint directly (with actual code from URL)
curl -X POST https://kcb-auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "redirect_uri=http://localhost:3000/api/auth/kcb/callback" \
  -d "client_id=$KCB_CLIENT_ID" \
  -d "client_secret=$KCB_CLIENT_SECRET"
```

### 4. Network/Timeout Error (500)

**Error Message:** `"Connect timeout"` or `"ECONNREFUSED"`

**Causes:**
- KCB endpoint unreachable
- Firewall/network issues
- Incorrect endpoint URL
- KCB service down

**Solutions:**
- Verify KCB_BASE_URL is accessible:
  ```bash
  curl -I https://kcb-auth.example.com
  ```
- Check firewall rules allow outbound HTTPS (port 443)
- Verify DNS resolution:
  ```bash
  dig kcb-auth.example.com
  nslookup kcb-auth.example.com
  ```
- Check KCB provider status page

### 5. Invalid Token Response (500)

**Error Message:** `"Failed to parse token response"` or `"Missing access_token"`

**Causes:**
- KCB response format doesn't match expected structure
- Content-Type header mismatch
- KCB provider returning error response

**Solutions:**
- Check the actual KCB token response format:
  ```bash
  # Enable verbose logging in kcb.service.ts
  console.log('Full token response:', response.data);
  ```
- Ensure `Content-Type: application/x-www-form-urlencoded` is sent
- Accept header should be `application/json`
- Check KCB documentation for response format

### 6. User Profile Fetch Failed (500)

**Error Message:** `"Failed to fetch user profile"` or `"Unauthorized"`

**Causes:**
- Access token is invalid or expired
- User info endpoint is incorrect
- Insufficient scopes granted

**Solutions:**
- Verify access token is valid and not expired
- Check `KCB_USER_INFO_ENDPOINT` is correct
- Ensure `KCB_SCOPE` includes `profile` and `email`
- Verify Authorization header format: `Bearer <token>`

**Debug Steps:**
```bash
# Test user info endpoint with access token
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://kcb-auth.example.com/oauth/userinfo
```

### 7. Database Operations Failed (500)

**Error Message:** `"Failed to create user"` or `"Database connection error"`

**Causes:**
- Database schema not migrated
- Database connection string invalid
- Insufficient permissions

**Solutions:**
- Verify Neon database is connected:
  ```bash
  psql $DATABASE_URL -c "\dt"
  ```
- Check required tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public';
  ```
- Verify tables have correct schema:
  ```sql
  \d "user"
  \d "kcbSession"
  \d "account"
  ```

## Detailed Logging

To enable comprehensive logging, check the following:

### 1. Console Logs

All KCB service functions include detailed console.error/log statements:

```
[KCB] Exchanging authorization code for token...
[KCB] Token exchange successful: { tokenType: 'Bearer', expiresIn: 3600, ... }
[KCB] Fetching user profile with access token
[KCB] User profile fetched successfully: { userId: '123', email: 'user@example.com' }
```

### 2. Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "status": 401,
  "error": "INVALID_STATE",
  "message": "OAuth state validation failed",
  "code": "CSRF_MISMATCH",
  "details": {
    "statusText": "Unauthorized",
    "errorResponse": { "error": "invalid_state" }
  },
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Request ID Tracking

Each error includes a `requestId` UUID for tracking the issue across logs:

```bash
# Search logs for specific request
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/app.log
```

## Testing the OAuth Flow

### Step 1: Initiate Login

```bash
curl -L "http://localhost:3000/api/auth/kcb/login"
# This should redirect to KCB authorization endpoint
```

### Step 2: Authorize

Navigate to the KCB login page and authorize the application.

### Step 3: Check Callback

The callback should:
1. Validate state parameter ✓
2. Exchange code for token ✓
3. Fetch user profile ✓
4. Create/update user in database ✓
5. Redirect to success URL ✓

### Step 4: Verify Database

```sql
-- Check user was created
SELECT * FROM "user" WHERE email = 'your@email.com';

-- Check KCB session
SELECT * FROM "kcbSession" WHERE "userId" = 'your-user-id';

-- Check account link
SELECT * FROM "account" WHERE "providerId" = 'kcb';
```

## Common Patterns

### Pattern: Environment Variable Not Loaded

**Before:**
```env
KCB_CLIENT_ID=your_id
# Variable not quoted - may be truncated
```

**After:**
```env
KCB_CLIENT_ID="your_id"
# Or use quotes if value contains special characters
```

### Pattern: Redirect URI Mismatch

**Incorrect:**
```
KCB_REDIRECT_URI=http://localhost:3000/api/auth/kcb/callback
# Later accessed as:
KCB_REDIRECT_URI=http://localhost:3000/api/auth/kcb/callback/
```

**Correct:**
- Ensure exact match in all three locations:
  1. KCB provider dashboard
  2. `.env.local` file
  3. Used in authorization URL

### Pattern: Token Expiration

**Before:**
```ts
// Doesn't check expiration
const tokenResponse = await exchangeCodeForToken(code, redirectUri)
```

**After:**
```ts
// Checks expiration
const session = await getKCBSession(userId)
if (session && new Date() > session.expiresAt) {
  // Token expired, need refresh
}
```

## Advanced Debugging

### Enable Verbose Logging

In `lib/services/kcb.service.ts`, uncomment or add:

```typescript
if (process.env.KCB_DEBUG === 'true') {
  console.log('[KCB] Full Axios config:', axiosErr.config)
  console.log('[KCB] Full response headers:', axiosErr.response?.headers)
  console.log('[KCB] Full response data:', axiosErr.response?.data)
}
```

### Use Network Inspection

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Preserve log"
4. Start OAuth flow
5. Look for the redirect to KCB provider
6. Check callback request for code/state parameters

### Database Query Logging

Enable Drizzle debug mode:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export const db = drizzle(pool, {
  schema,
  logger: process.env.DEBUG === 'true', // Enable query logging
})
```

## Support Contacts

- **KCB Documentation:** https://kcb-auth.example.com/docs
- **KCB Support:** support@kcb-auth.example.com
- **Database Issues:** Check Neon dashboard at https://console.neon.tech

## Performance Considerations

- OAuth state expires after 15 minutes - increase if needed
- Access tokens typically valid for 1 hour
- Database cleanup runs on state generation
- Consider implementing refresh token rotation for security

## Security Best Practices

1. ✅ Always use HTTPS in production
2. ✅ Store client_secret securely (never in client-side code)
3. ✅ Validate state parameter (CSRF protection)
4. ✅ Use short-lived authorization codes
5. ✅ Implement token refresh logic
6. ✅ Log all authentication events
7. ✅ Monitor for failed attempts
8. ✅ Use secure cookies (httpOnly, secure, sameSite)
