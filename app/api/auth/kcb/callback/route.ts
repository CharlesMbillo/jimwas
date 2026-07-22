/**
 * KCB OAuth Callback Route
 *
 * Handles OAuth authorization callback from KCB
 * - Validates authorization code and state
 * - Exchanges code for access token
 * - Creates or links user account
 * - Returns JWT for client-side authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  validateOAuthState,
  exchangeCodeForToken,
  fetchUserProfile,
  saveKCBSession,
  type KCBErrorResponse,
} from '@/lib/services/kcb.service'
import { db } from '@/lib/db'
import { user, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const context = 'KCB OAuth Callback'
  const startTime = Date.now()

  try {
    // Extract query parameters
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const redirectUri = searchParams.get('redirect_uri') || process.env.KCB_REDIRECT_URI

    console.log('[KCB Callback] Received OAuth callback:', {
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription,
      redirectUri,
    })

    // Handle OAuth errors from provider
    if (error) {
      console.error('[KCB Callback] OAuth provider error:', { error, errorDescription })

      return NextResponse.json(
        {
          success: false,
          status: 401,
          error,
          message: errorDescription || 'KCB OAuth authorization failed',
          details: { errorFromProvider: error },
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 401 },
      )
    }

    // Validate required parameters
    if (!code || !state) {
      const missingParams = []
      if (!code) missingParams.push('code')
      if (!state) missingParams.push('state')

      console.error('[KCB Callback] Missing required parameters:', missingParams)

      return NextResponse.json(
        {
          success: false,
          status: 400,
          error: 'MISSING_PARAMETERS',
          message: `Missing required OAuth parameters: ${missingParams.join(', ')}`,
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 400 },
      )
    }

    // Validate state for CSRF protection
    console.log('[KCB Callback] Validating OAuth state...')
    const stateIsValid = await validateOAuthState(state, redirectUri!)

    if (!stateIsValid) {
      console.error('[KCB Callback] OAuth state validation failed:', state.substring(0, 8) + '...')

      return NextResponse.json(
        {
          success: false,
          status: 401,
          error: 'INVALID_STATE',
          message: 'OAuth state validation failed - potential CSRF attack',
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 401 },
      )
    }

    // Exchange code for access token
    console.log('[KCB Callback] Exchanging authorization code for token...')
    const tokenResponse = await exchangeCodeForToken(code, redirectUri!)

    if (!tokenResponse.success) {
      const errorResp = tokenResponse as KCBErrorResponse
      console.error('[KCB Callback] Token exchange failed:', {
        status: errorResp.status,
        error: errorResp.error,
        message: errorResp.message,
      })

      return NextResponse.json(errorResp, { status: errorResp.status || 500 })
    }

    // Fetch user profile
    console.log('[KCB Callback] Fetching user profile...')
    const userProfile = await fetchUserProfile(tokenResponse.accessToken)

    if (!userProfile || !('id' in userProfile)) {
      const errorResp = userProfile as KCBErrorResponse
      console.error('[KCB Callback] Failed to fetch user profile:', {
        status: errorResp.status,
        error: errorResp.error,
        message: errorResp.message,
      })

      return NextResponse.json(errorResp, { status: errorResp.status || 500 })
    }

    // Find or create user account
    console.log('[KCB Callback] Looking up or creating user account...', {
      email: userProfile.email,
      kcbUserId: userProfile.id,
    })

    let appUser = await db.query.user.findFirst({
      where: eq(user.email, userProfile.email),
    })

    if (!appUser) {
      // Create new user
      const newUserId = crypto.randomUUID()
      appUser = await db
        .insert(user)
        .values({
          id: newUserId,
          email: userProfile.email,
          name: userProfile.name || userProfile.email.split('@')[0],
          image: userProfile.picture,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0])

      console.log('[KCB Callback] Created new user:', { userId: newUserId, email: userProfile.email })
    }

    // Link KCB account
    console.log('[KCB Callback] Linking KCB account...')

    const existingAccount = await db.query.account.findFirst({
      where: eq(account.accountId, userProfile.id),
    })

    if (!existingAccount) {
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userProfile.id,
        providerId: 'kcb',
        userId: appUser.id,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        idToken: null,
        accessTokenExpiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000),
        refreshTokenExpiresAt: null,
        scope: tokenResponse.scope,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      console.log('[KCB Callback] Created new account link:', {
        accountId: userProfile.id,
        userId: appUser.id,
      })
    } else {
      // Update existing account
      await db
        .update(account)
        .set({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          accessTokenExpiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(account.id, existingAccount.id))

      console.log('[KCB Callback] Updated existing account link')
    }

    // Save KCB session
    console.log('[KCB Callback] Saving KCB session...')
    const sessionResult = await saveKCBSession(appUser.id, userProfile.id, tokenResponse)

    if (typeof sessionResult === 'string') {
      console.log('[KCB Callback] KCB session saved successfully:', {
        sessionId: sessionResult.substring(0, 8) + '...',
      })
    } else {
      const errorResp = sessionResult as KCBErrorResponse
      console.error('[KCB Callback] Failed to save KCB session:', errorResp)
      return NextResponse.json(errorResp, { status: 500 })
    }

    const duration = Date.now() - startTime
    console.log('[KCB Callback] OAuth callback completed successfully:', {
      userId: appUser.id,
      duration: `${duration}ms`,
    })

    // Redirect to success page with session info
    const callbackUrl = process.env.KCB_SUCCESS_REDIRECT_URL || '/dashboard'
    const response = NextResponse.redirect(new URL(callbackUrl, req.url), { status: 302 })

    // Set session cookie
    response.cookies.set('kcb-session-id', typeof sessionResult === 'string' ? sessionResult : '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenResponse.expiresIn,
    })

    return response
  } catch (err) {
    const duration = Date.now() - startTime
    console.error('[KCB Callback] Unhandled error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      {
        success: false,
        status: 500,
        error: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      } satisfies KCBErrorResponse,
      { status: 500 },
    )
  }
}
