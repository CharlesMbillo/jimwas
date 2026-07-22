/**
 * KCB OAuth Login Initiation Route
 *
 * Initiates OAuth 2.0 Authorization Code Flow:
 * - Generates CSRF-protected state
 * - Redirects user to KCB authorization endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateOAuthState, type KCBErrorResponse } from '@/lib/services/kcb.service'

const KCB_CONFIG = {
  baseUrl: process.env.KCB_BASE_URL || 'https://kcb-auth.example.com',
  authorizationEndpoint: process.env.KCB_AUTH_ENDPOINT || '/oauth/authorize',
  clientId: process.env.KCB_CLIENT_ID,
  redirectUri: process.env.KCB_REDIRECT_URI,
  scope: process.env.KCB_SCOPE || 'openid profile email',
  responseType: 'code',
}

export async function GET(req: NextRequest) {
  const context = 'KCB OAuth Login'

  try {
    console.log('[KCB Login] Initiating OAuth flow')

    // Validate configuration
    if (!KCB_CONFIG.clientId || !KCB_CONFIG.redirectUri) {
      console.error('[KCB Login] Missing KCB configuration:', {
        hasClientId: !!KCB_CONFIG.clientId,
        hasRedirectUri: !!KCB_CONFIG.redirectUri,
      })

      return NextResponse.json(
        {
          success: false,
          status: 500,
          error: 'CONFIG_ERROR',
          message: 'KCB OAuth configuration is incomplete',
          details: {
            missing: !KCB_CONFIG.clientId ? ['clientId'] : !KCB_CONFIG.redirectUri ? ['redirectUri'] : [],
          },
          timestamp: new Date().toISOString(),
        } satisfies KCBErrorResponse,
        { status: 500 },
      )
    }

    // Generate OAuth state for CSRF protection
    console.log('[KCB Login] Generating OAuth state...')
    const stateData = await generateOAuthState(KCB_CONFIG.redirectUri)

    console.log('[KCB Login] State generated successfully')

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: KCB_CONFIG.clientId,
      response_type: KCB_CONFIG.responseType,
      redirect_uri: KCB_CONFIG.redirectUri,
      scope: KCB_CONFIG.scope,
      state: stateData.state,
    })

    const authorizationUrl = `${KCB_CONFIG.baseUrl}${KCB_CONFIG.authorizationEndpoint}?${params.toString()}`

    console.log('[KCB Login] Redirecting to KCB authorization endpoint:', {
      url: authorizationUrl.substring(0, 100) + '...',
      clientId: KCB_CONFIG.clientId.substring(0, 8) + '...',
      scope: KCB_CONFIG.scope,
    })

    return NextResponse.redirect(authorizationUrl, { status: 302 })
  } catch (err) {
    console.error('[KCB Login] Failed to initiate OAuth flow:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        status: 500,
        error: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'Failed to initiate OAuth flow',
        timestamp: new Date().toISOString(),
      } satisfies KCBErrorResponse,
      { status: 500 },
    )
  }
}
