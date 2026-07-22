# KCB OAuth Authentication - Complete Implementation Guide

## Quick Start

This guide walks you through setting up OAuth 2.0 Authorization Code Flow authentication with KCB in your Next.js application using Neon PostgreSQL.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User clicks "Login with KCB"                             │
│     ↓                                                         │
│  2. /api/auth/kcb/login generates state, redirects to KCB   │
│     ↓                                                         │
│  3. User authorizes on KCB provider                          │
│     ↓                                                         │
│  4. KCB redirects to /api/auth/kcb/callback with code       │
│     ↓                                                         │
│  5. Callback validates state, exchanges code for token      │
│     ↓                                                         │
│  6. Fetch user profile with token                           │
│     ↓                                                         │
│  7. Create/link user in Neon database                       │
│     ↓                                                         │
│  8. Redirect to dashboard with session                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
lib/
├── db/
│   ├── index.ts              # Drizzle client setup
│   └── schema.ts             # Database schema (Better Auth + KCB tables)
└── services/
    ├── kcb.service.ts        # Core KCB OAuth logic with error handling
    └── kcb.troubleshooting.md # Detailed troubleshooting guide

app/api/auth/kcb/
├── login/route.ts            # OAuth flow initiation
├── callback/route.ts         # OAuth callback handler
└── refresh/route.ts          # Token refresh endpoint

.env.example                  # Environment variable template
.env.local                    # Local environment variables (create this)
KCB_AUTH_GUIDE.md            # This file
```

## Step 1: Configure Environment Variables

### Create `.env.local`

Copy from `.env.example` and fill in your KCB credentials:

```bash
cp .env.example .env.local
```

### Edit `.env.local`

```env
# From KCB Provider Dashboard
KCB_BASE_URL=https://kcb-auth.example.com
KCB_CLIENT_ID=your_client_id
KCB_CLIENT_SECRET=your_client_secret
KCB_REDIRECT_URI=http://localhost:3000/api/auth/kcb/callback

# Neon Database (from Neon dashboard)
DATABASE_URL=postgresql://user:password@host/database
```

## Step 2: Initialize Database Schema

The database schema includes:
- Better Auth tables: `user`, `session`, `account`, `verification`
- KCB-specific tables: `kcbSession`, `kcbOAuthState`

### Option A: Using Neon Console

Go to your Neon project dashboard and run these CREATE TABLE statements:

```sql
-- Better Auth: Users
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

-- Better Auth: Sessions
CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- Better Auth: OAuth Accounts
CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

-- Better Auth: Verification Tokens
CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);

-- KCB: Session Tracking
CREATE TABLE IF NOT EXISTS "kcbSession" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kcbUserId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "tokenType" TEXT DEFAULT 'Bearer',
  "expiresAt" TIMESTAMP NOT NULL,
  scope TEXT,
  "requestedAt" TIMESTAMP NOT NULL,
  "expiresIn" INTEGER,
  metadata JSONB,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

-- KCB: OAuth State for CSRF Protection
CREATE TABLE IF NOT EXISTS "kcbOAuthState" (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  "codeChallenge" TEXT,
  "redirectUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_userid ON "session"("userId");
CREATE INDEX IF NOT EXISTS idx_account_userid ON "account"("userId");
CREATE INDEX IF NOT EXISTS idx_account_providerid ON "account"("providerId");
CREATE INDEX IF NOT EXISTS idx_kcbsession_userid ON "kcbSession"("userId");
CREATE INDEX IF NOT EXISTS idx_kcboauthstate_state ON "kcbOAuthState"(state);
```

### Option B: Using TypeScript (Recommended)

Run migrations programmatically:

```bash
cd scripts
node migrate-kcb-schema.mjs
```

## Step 3: Add Login Button to Your UI

Create a login component:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function KCBLoginButton() {
  const router = useRouter()

  const handleLogin = () => {
    router.push('/api/auth/kcb/login')
  }

  return (
    <Button onClick={handleLogin}>
      Login with KCB
    </Button>
  )
}
```

Use in your page:

```tsx
import { KCBLoginButton } from '@/components/kcb-login-button'

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <KCBLoginButton />
    </div>
  )
}
```

## Step 4: Verify the Installation

### Test the Login Flow

1. **Start the dev server:**
   ```bash
   pnpm dev
   ```

2. **Click the Login button:**
   - Opens `/api/auth/kcb/login`
   - Should redirect to KCB authorization page

3. **Authorize the application:**
   - Log in with KCB credentials
   - Approve requested scopes

4. **Check the callback:**
   - Should redirect back to `/dashboard`
   - Check database for new user:
     ```sql
     SELECT * FROM "user" ORDER BY "createdAt" DESC LIMIT 1;
     ```

### Monitor Console Logs

Watch the console for detailed logs:

```
[KCB Login] Initiating OAuth flow
[KCB Login] Generating OAuth state...
[KCB Login] State generated successfully
[KCB Login] Redirecting to KCB authorization endpoint: ...

[KCB Callback] Received OAuth callback...
[KCB Callback] Validating OAuth state...
[KCB Callback] OAuth state validated successfully
[KCB Callback] Exchanging authorization code for token...
[KCB] Token exchange successful: { tokenType: 'Bearer', expiresIn: 3600 }
[KCB Callback] User profile fetched successfully: { userId: '123', email: '...' }
[KCB Callback] OAuth callback completed successfully: { userId: '...', duration: '450ms' }
```

## Error Handling

### Understanding Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "status": 401,
  "error": "INVALID_STATE",
  "message": "OAuth state validation failed - potential CSRF attack",
  "code": "CSRF_MISMATCH",
  "details": { /* detailed error info */ },
  "timestamp": "2024-07-19T10:30:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Common Error Codes

| Code | Status | Meaning | Solution |
|------|--------|---------|----------|
| `INVALID_STATE` | 401 | CSRF token mismatch | Check redirect URI matches exactly |
| `MISSING_PARAMETERS` | 400 | Missing code or state | Ensure KCB callback includes both params |
| `CONFIG_ERROR` | 500 | Missing env variables | Check `.env.local` has all required vars |
| `NO_REFRESH_TOKEN` | 401 | Can't refresh token | User needs to log in again |
| `UNKNOWN_ERROR` | 500 | Unexpected error | Check console logs and request ID |

### Troubleshooting Checklist

- [ ] All environment variables set in `.env.local`
- [ ] Database connection string is correct
- [ ] KCB provider redirect URI matches exactly
- [ ] All database tables created
- [ ] Client ID and secret are correct
- [ ] Browser cookies are enabled
- [ ] Using HTTPS in production
- [ ] No other auth middleware conflicting

## Security Implementation

### CSRF Protection
✅ Implemented via `kcbOAuthState` table
- State parameter generated and stored
- State validated on callback
- Expired states cleaned up automatically

### Token Security
✅ Tokens stored securely
- Access tokens in `account` table
- Refresh tokens in `kcbSession` table
- Session cookies are httpOnly

### User Isolation
✅ Data scoped by user ID
- Each user can only access their own sessions
- Database queries always filter by userId

## Advanced Topics

### Implementing Token Refresh

Tokens expire (usually after 1 hour). Refresh automatically:

```ts
// In a server action or middleware
import { getKCBSession } from '@/lib/services/kcb.service'

async function checkAndRefreshToken(userId: string) {
  const session = await getKCBSession(userId)
  
  if (session && new Date() > new Date(session.expiresAt)) {
    // Token expired, refresh it
    const response = await fetch('/api/auth/kcb/refresh', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    
    const data = await response.json()
    return data.accessToken
  }
  
  return session?.accessToken
}
```

### Customizing Redirect After Login

Change `KCB_SUCCESS_REDIRECT_URL` in `.env.local`:

```env
# Redirect to specific dashboard
KCB_SUCCESS_REDIRECT_URL=/admin/dashboard

# Or redirect based on role (implement in callback)
# See /app/api/auth/kcb/callback/route.ts
```

### Multiple OAuth Providers

To add other providers (Google, GitHub, etc.):

1. Create `lib/services/google.service.ts` following same pattern
2. Add routes: `/api/auth/google/login`, `/api/auth/google/callback`
3. Update database schema to distinguish providers by `providerId`
4. Add login buttons for each provider

### Monitoring and Analytics

Track authentication events:

```ts
// In callback handler
await db.insert(authEvents).values({
  id: crypto.randomUUID(),
  userId: appUser.id,
  provider: 'kcb',
  event: 'login_success',
  timestamp: new Date(),
})
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Switch to HTTPS URLs
- [ ] Update `KCB_REDIRECT_URI` to production domain
- [ ] Update `KCB_SUCCESS_REDIRECT_URL` if needed
- [ ] Set strong `KCB_CLIENT_SECRET` (store in Vercel Secrets)
- [ ] Enable secure cookies (automatic when NODE_ENV=production)
- [ ] Test token refresh logic
- [ ] Set up database backups
- [ ] Monitor authentication logs

### Vercel Deployment

1. Add environment variables in Vercel dashboard:
   - Settings → Environment Variables
   - Add all `KCB_*` and `DATABASE_URL` variables

2. Update redirect URI:
   ```
   KCB_REDIRECT_URI=https://your-production-domain.com/api/auth/kcb/callback
   ```

3. Deploy and test:
   ```bash
   git push origin main
   ```

## Maintenance

### Database Cleanup

The service automatically cleans up expired OAuth states. For manual cleanup:

```sql
DELETE FROM "kcbOAuthState" WHERE "expiresAt" < NOW();
DELETE FROM "kcbSession" WHERE "expiresAt" < NOW();
```

### Monitoring Logs

Search for authentication issues:

```bash
# All KCB logs
grep "\[KCB\]" /var/log/app.log

# Errors only
grep "\[KCB\].*Error" /var/log/app.log

# Specific request
grep "550e8400-e29b-41d4-a716-446655440000" /var/log/app.log
```

### Performance Optimization

- Use indexes (created automatically)
- Archive old `authEvents` table
- Implement connection pooling (Neon handles this)

## Support and Documentation

- **KCB Provider Docs:** https://kcb-auth.example.com/docs
- **OAuth 2.0 Spec:** https://tools.ietf.org/html/rfc6749
- **Neon Docs:** https://neon.tech/docs
- **Troubleshooting Guide:** See `lib/services/kcb.troubleshooting.md`

## Quick Reference: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/kcb/login` | GET | Initiate OAuth flow |
| `/api/auth/kcb/callback` | GET | OAuth callback handler |
| `/api/auth/kcb/refresh` | POST | Refresh access token |

## Next Steps

1. ✅ Set up environment variables
2. ✅ Initialize database
3. ✅ Add login button
4. ✅ Test OAuth flow
5. ✅ Deploy to production
6. ✅ Monitor and maintain

Questions? See `lib/services/kcb.troubleshooting.md` for detailed troubleshooting.
