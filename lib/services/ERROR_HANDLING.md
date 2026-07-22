# KCB OAuth Error Handling - Complete Reference

## Overview

This document details the improved error handling architecture for KCB OAuth authentication, replacing generic "KCB auth failed (500)" messages with detailed, actionable error responses.

## Error Response Structure

All API endpoints return this standardized error response:

```typescript
interface KCBErrorResponse {
  success: false
  status: number | null           // HTTP status from provider, null if connection failed
  error: string | null            // OAuth error code (e.g., "invalid_state")
  message: string                 // User-friendly error message
  code?: string                   // Specific error code (e.g., "CSRF_MISMATCH")
  details?: Record<string, any>   // Additional debugging information
  timestamp: string               // ISO 8601 timestamp
  requestId?: string              // UUID for tracking this specific error
}
```

## Error Categories

### 1. Configuration Errors (500)

**Cause:** Missing or invalid environment variables

**Example Response:**
```json
{
  "success": false,
  "status": 500,
  "error": "CONFIG_ERROR",
  "message": "KCB configuration incomplete: missing clientId, clientSecret, redirectUri",
  "code": "MISSING_CONFIG",
  "timestamp": "2024-07-19T10:30:00.000Z"
}
```

**Root Causes:**
- `KCB_CLIENT_ID` not set
- `KCB_CLIENT_SECRET` not set
- `KCB_REDIRECT_URI` not set
- `DATABASE_URL` not set

**Solution:**
```bash
# Check environment variables
echo $KCB_CLIENT_ID
echo $KCB_REDIRECT_URI

# Add to .env.local
KCB_CLIENT_ID=your_id
KCB_CLIENT_SECRET=your_secret
KCB_REDIRECT_URI=http://localhost:3000/api/auth/kcb/callback
DATABASE_URL=postgresql://...
```

---

### 2. CSRF Protection Errors (401)

**Cause:** OAuth state parameter doesn't match or has expired

**Example Response:**
```json
{
  "success": false,
  "status": 401,
  "error": "INVALID_STATE",
  "message": "OAuth state validation failed - potential CSRF attack",
  "code": "CSRF_MISMATCH",
  "timestamp": "2024-07-19T10:30:00.000Z"
}
```

**What Happened:**
- State generated in login step doesn't match callback
- State expired (15-minute timeout)
- Database with stored states is inaccessible

**Why It's Critical:**
- Protects against CSRF attacks where attacker tricks user
- Without this validation, attacker could swap OAuth codes
- All OAuth implementations require this protection

**Solution:**

1. **Check redirect URI consistency:**
   ```ts
   // ❌ Wrong - mismatch in redirect URIs
   // Login: http://localhost:3000/api/auth/kcb/callback
   // Callback: http://localhost:3000/api/auth/kcb/callback/
   
   // ✅ Correct - exact match
   // Both must be identical
   ```

2. **Verify database is accessible:**
   ```sql
   -- Check if kcbOAuthState table exists
   SELECT * FROM kcbOAuthState LIMIT 1;
   ```

3. **Check browser is accepting cookies:**
   - DevTools → Application → Cookies
   - Ensure localhost has cookies enabled

---

### 3. Token Exchange Errors (401, 400)

**Cause:** Authorization code is invalid, expired, or already used

**Example Response:**
```json
{
  "success": false,
  "status": 401,
  "error": "invalid_grant",
  "message": "Authorization code has expired or is invalid",
  "code": "INVALID_AUTH_CODE",
  "details": {
    "statusText": "Unauthorized",
    "errorResponse": {
      "error": "invalid_grant",
      "error_description": "Authorization code has expired"
    }
  },
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Root Causes:**

| Cause | Window | Fix |
|-------|--------|-----|
| Code expired | 10 minutes | Complete OAuth flow quickly |
| Code already used | Once | Initiate new login flow |
| Redirect URI mismatch | N/A | Ensure exact match in 3 places |
| Wrong client credentials | N/A | Verify CLIENT_ID and CLIENT_SECRET |
| Network timeout | 10 seconds | Check connection, retry |

**Solution:**

```bash
# 1. Verify client credentials
echo $KCB_CLIENT_ID
echo $KCB_CLIENT_SECRET
# Compare with KCB provider dashboard

# 2. Check redirect URI matches in 3 places:
# a) KCB provider dashboard
# b) .env.local: KCB_REDIRECT_URI=...
# c) Used in code at app/api/auth/kcb/callback/route.ts

# 3. Test token endpoint directly (DEBUGGING)
curl -X POST https://kcb-auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=ACTUAL_CODE_FROM_CALLBACK" \
  -d "redirect_uri=http://localhost:3000/api/auth/kcb/callback" \
  -d "client_id=$KCB_CLIENT_ID" \
  -d "client_secret=$KCB_CLIENT_SECRET"
```

**Debug Checklist:**
- [ ] Authorization code < 10 minutes old
- [ ] Code not used before
- [ ] Redirect URI matches exactly
- [ ] Client ID and secret are correct
- [ ] Network connectivity is stable

---

### 4. Network Errors (503, Connection Refused)

**Cause:** Cannot reach KCB endpoint

**Example Response:**
```json
{
  "success": false,
  "status": null,
  "error": "ECONNREFUSED",
  "message": "KCB provider unreachable: connect ECONNREFUSED 127.0.0.1:443",
  "code": "NETWORK_ERROR",
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Root Causes:**
- KCB service is down
- Firewall blocking outbound HTTPS
- Incorrect endpoint URL
- Network connectivity issue
- DNS resolution failure

**Solution:**

```bash
# 1. Check if KCB endpoint is reachable
curl -I https://kcb-auth.example.com
# Should return HTTP 200 or 404, not timeout

# 2. Verify DNS resolution
nslookup kcb-auth.example.com
dig kcb-auth.example.com

# 3. Test connectivity on port 443
nc -zv kcb-auth.example.com 443

# 4. Check firewall rules
# Ensure outbound HTTPS (port 443) is allowed

# 5. Verify KCB_BASE_URL is correct
echo $KCB_BASE_URL
# Should start with https://
```

**Debug Steps:**
1. Check KCB provider status page
2. Try from different network (mobile hotspot)
3. Check firewall/VPN settings
4. Verify endpoint URL in `.env.local`

---

### 5. Invalid User Profile (500)

**Cause:** Token invalid or user info endpoint returns unexpected format

**Example Response:**
```json
{
  "success": false,
  "status": 401,
  "error": "Unauthorized",
  "message": "Failed to fetch user profile",
  "code": "INVALID_USER_PROFILE",
  "details": {
    "statusText": "Unauthorized",
    "errorResponse": {
      "error": "invalid_token",
      "error_description": "The access token expired"
    }
  },
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Root Causes:**
- Access token invalid or expired
- Insufficient scopes granted
- User info endpoint incorrect
- Token format incorrect

**Solution:**

```bash
# 1. Verify access token format
# Should be a valid JWT or opaque token

# 2. Test user info endpoint directly
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://kcb-auth.example.com/oauth/userinfo

# 3. Check scopes include 'profile' and 'email'
echo $KCB_SCOPE
# Should include: openid profile email

# 4. Verify user info endpoint URL
echo $KCB_USER_INFO_ENDPOINT
```

---

### 6. Database Errors (500)

**Cause:** Cannot read/write user data to Neon

**Example Response:**
```json
{
  "success": false,
  "status": null,
  "error": "ECONNREFUSED",
  "message": "Failed to connect to database: connect ECONNREFUSED",
  "code": "DB_CONNECTION_ERROR",
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Root Causes:**
- Database URL invalid
- Neon database offline
- Network connectivity issue
- Schema not initialized

**Solution:**

```bash
# 1. Test database connection
psql $DATABASE_URL -c "SELECT NOW();"
# Should return current timestamp

# 2. Check schema exists
psql $DATABASE_URL -c "\dt"
# Should list tables: user, session, account, kcbSession, etc.

# 3. Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host/database

# 4. Check Neon dashboard
# Ensure project is active and not suspended
```

**Verify Tables:**
```sql
-- Check all required tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should include:
-- account
-- kcbOAuthState
-- kcbSession
-- session
-- user
-- verification
```

---

## Error Handling Implementation

### How Errors Are Caught and Formatted

**In `kcb.service.ts`:**

```typescript
// BEFORE (Generic Error)
catch (err) {
  throw new Error("KCB auth failed")
}

// AFTER (Detailed Error Handling)
catch (err: any) {
  // 1. Identify error type
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<any>
    
    // 2. Extract all available information
    console.error(`[KCB] Axios Error in ${context}:`, {
      status: axiosErr.response?.status,
      statusText: axiosErr.response?.statusText,
      data: axiosErr.response?.data,
      message: axiosErr.message,
      code: axiosErr.code,
    })
    
    // 3. Format structured response
    return {
      success: false,
      status: axiosErr.response?.status || 500,
      error: axiosErr.response?.data?.error || axiosErr.message,
      message: axiosErr.response?.data?.error_description || "OAuth operation failed",
      code: axiosErr.code,
      details: {
        statusText: axiosErr.response?.statusText,
        errorResponse: axiosErr.response?.data,
      },
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    }
  }
}
```

### Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Status Code** | Always 500 | Actual status from provider |
| **Error Details** | "KCB auth failed" | Specific error code and message |
| **Debugging Info** | None | Full response data included |
| **Tracking** | Not trackable | requestId UUID for log tracking |
| **Console Logs** | Basic | Detailed context and state |

---

## Logging Patterns

### Console Output Format

All services follow this logging pattern:

```
[KCB] <OPERATION>: <MESSAGE>
[KCB] Token exchange successful: { tokenType: 'Bearer', expiresIn: 3600, ... }
[KCB] Axios Error in exchangeCodeForToken: { status: 401, statusText: 'Unauthorized', ... }
[KCB] Error in validateOAuthState: { message: 'State not found', stack: ... }
```

### Searching Logs

```bash
# All KCB operations
grep "\[KCB\]" app.log

# All errors
grep "\[KCB\].*Error" app.log

# Specific operation
grep "\[KCB\].*token.*exchange" app.log

# By request ID
grep "550e8400-e29b-41d4-a716-446655440000" app.log

# Performance
grep "duration:" app.log
```

---

## Testing Error Scenarios

### Simulate Configuration Error

```bash
# Unset a required variable
unset KCB_CLIENT_ID

# Make request
curl http://localhost:3000/api/auth/kcb/login
# Returns: CONFIG_ERROR (500)
```

### Simulate CSRF Attack

```bash
# Generate a state, then try with different redirect URI
# State in DB: state=abc123, redirectUri=http://localhost:3000/api/auth/kcb/callback
# Callback param: redirectUri=http://attacker.com/callback

# Result: INVALID_STATE error (401)
```

### Simulate Network Error

```bash
# Set invalid endpoint
KCB_BASE_URL=https://nonexistent.example.com

# Make request
curl http://localhost:3000/api/auth/kcb/login
# Returns: NETWORK_ERROR (500 or null status)
```

---

## Best Practices

### ✅ Do This

```typescript
// 1. Log context around errors
console.log('[KCB] Starting token exchange:', {
  code: code.substring(0, 8) + '...',
  redirectUri,
})

// 2. Include request-scoped identifiers
const requestId = crypto.randomUUID()
// ... use in error response

// 3. Extract and expose provider errors
const providerError = err.response?.data?.error
const providerMessage = err.response?.data?.error_description

// 4. Include timing information
const duration = Date.now() - startTime
console.log(`[KCB] Operation completed in ${duration}ms`)
```

### ❌ Don't Do This

```typescript
// 1. Generic catch-all
catch (err) {
  throw new Error("Operation failed")
}

// 2. Exposing secrets in logs
console.log('Client secret:', KCB_CONFIG.clientSecret)

// 3. Swallowing errors
try {
  // ...
} catch (err) {
  // Silently ignore
}

// 4. Returning HTTP 200 for errors
return NextResponse.json(errorResponse, { status: 200 }) // ❌
```

---

## Monitoring Recommendations

### Alert on These Errors

1. **CONFIG_ERROR**: Environment setup issue
2. **DB_CONNECTION_ERROR**: Database unreachable (critical)
3. **NETWORK_ERROR**: KCB provider unreachable (external)
4. **Multiple INVALID_STATE errors**: Potential attack

### Metrics to Track

- `kcb.auth.start` - OAuth flow initiated
- `kcb.auth.success` - Successful login
- `kcb.auth.failed` - Login failed (by error code)
- `kcb.auth.duration` - Time from login to callback
- `kcb.errors.total` - Total errors by type

### Dashboards to Create

1. **Error Rate Over Time** - Track spikes
2. **Error Distribution** - Which errors most common
3. **Response Times** - Track performance
4. **CSRF Attempts** - Security monitoring

---

## Recovery Procedures

### User-Facing Actions

When user encounters an error:

1. **Display Error Message:**
   ```
   "Login failed: OAuth state validation failed.
    Please try again. If this persists, clear cookies and try again."
   ```

2. **Provide Recovery:**
   - "Try Again" button - Initiates new login
   - "Clear Cookies" - Removes stale session data
   - "Contact Support" - Links to help with request ID

### System Recovery

```typescript
// Automatic cleanup of expired states
await cleanupExpiredStates()

// Automatic token refresh
const session = await getKCBSession(userId)
if (session?.expiresAt < new Date()) {
  await refreshAccessToken(session.refreshToken)
}

// Error alerting
if (errorCount > THRESHOLD) {
  notifyOncall(error, requestId)
}
```

---

## Support Information

When opening a support ticket, include:

1. **Request ID** - From error response
2. **Timestamp** - When error occurred
3. **Error Code** - From error response
4. **Steps to Reproduce** - How to trigger
5. **Console Logs** - Full error details
6. **Environment** - localhost vs. production

Example:

```
Error: INVALID_STATE
Request ID: 550e8400-e29b-41d4-a716-446655440000
Timestamp: 2024-07-19T10:30:00.000Z
Status: 401
Message: OAuth state validation failed

Console output:
[KCB] OAuth state not found in database: abc123...
[KCB] Failed to validate OAuth state
```

---

## Summary

The improved error handling provides:

✅ **Specific Error Codes** - Know exactly what failed
✅ **HTTP Status Codes** - Correct client interpretation
✅ **Detailed Information** - Understand root cause
✅ **Request IDs** - Track errors across logs
✅ **Timestamps** - Correlate with other events
✅ **Console Logging** - Debug locally
✅ **Actionable Messages** - Users know what to do

This replaces generic "KCB auth failed (500)" messages with comprehensive, debuggable error responses.
