/**
 * KCB Token Refresh Route
 *
 * Refreshes expired access tokens using refresh token
 * - Validates user session
 * - Exchanges refresh token for new access token
 * - Updates session data
 */

import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken, getKCBSession, saveKCBSession, type KCBErrorResponse } from '@/lib/services/kcb.service'
import { db } from '@/lib/db'
import { kcbSession, account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const context = 'KCB Token Refresh'

  try {
    // Get user ID from session or request body
    const body = await req.json().catch(() => ({}))
    const userId = body.userId

    console.log('[KCB Refresh] Token refresh requested:', { hasUserId: !!userId })

    if (!userId) {
      console.error('[KCB Refresh] Missing user ID')

      return NextResponse.json(
        {
          success: false,
          status: 400,
          error: 'MISSING_USER_ID',
          message: 'User ID is required to refresh token',
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 400 },
      )
    }

    // Get current KCB session
    console.log('[KCB Refresh] Fetching current KCB session...')
    const session = await getKCBSession(userId)

    if (!session || !session.refreshToken) {
      console.error('[KCB Refresh] No valid KCB session with refresh token found:', { userId })

      return NextResponse.json(
        {
          success: false,
          status: 401,
          error: 'NO_REFRESH_TOKEN',
          message: 'No valid KCB session found or refresh token is missing',
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 401 },
      )
    }

    // Refresh the access token
    console.log('[KCB Refresh] Refreshing access token...')
    const tokenResponse = await refreshAccessToken(session.refreshToken)

    if (!tokenResponse.success) {
      const errorResp = tokenResponse as KCBErrorResponse
      console.error('[KCB Refresh] Token refresh failed:', {
        status: errorResp.status,
        error: errorResp.error,
        message: errorResp.message,
      })

      return NextResponse.json(errorResp, { status: errorResp.status || 500 })
    }

    // Update KCB session
    console.log('[KCB Refresh] Updating KCB session...')
    const expiresAt = new Date(Date.now() + tokenResponse.expiresIn * 1000)

    await db
      .update(kcbSession)
      .set({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        expiresAt,
        expiresIn: tokenResponse.expiresIn,
        updatedAt: new Date(),
      })
      .where(eq(kcbSession.userId, userId))

    console.log('[KCB Refresh] Session updated successfully')

    // Also update the account record
    const accountRecord = await db.query.account.findFirst({
      where: eq(account.providerId, 'kcb'),
    })

    if (accountRecord) {
      await db
        .update(account)
        .set({
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          accessTokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(account.id, accountRecord.id))

      console.log('[KCB Refresh] Account record updated')
    }

    // Return new token information
    return NextResponse.json(
      {
        success: true,
        accessToken: tokenResponse.accessToken,
        tokenType: tokenResponse.tokenType,
        expiresIn: tokenResponse.expiresIn,
        scope: tokenResponse.scope,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[KCB Refresh] Unhandled error:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
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
