/**
 * KCB OAuth Service
 *
 * Comprehensive OAuth 2.0 Authorization Code Flow implementation for KCB authentication.
 * Includes detailed error handling, logging, and state management.
 */

import axios, { AxiosError } from 'axios'
import { db } from '@/lib/db'
import { kcbSession, kcbOAuthState, user, account } from '@/lib/db/schema'
import { eq, lt } from 'drizzle-orm'
import crypto from 'crypto'

/**
 * Detailed error response structure
 */
export interface KCBErrorResponse {
  success: false
  status: number | null
  error: string | null
  message: string
  code?: string
  details?: Record<string, any>
  timestamp: string
  requestId?: string
}

/**
 * Successful token response structure
 */
export interface KCBTokenResponse {
  success: true
  accessToken: string
  tokenType: string
  expiresIn: number
  refreshToken?: string
  scope?: string
  kcbUserId: string
}

/**
 * OAuth state tracking for CSRF protection
 */
export interface OAuthStateData {
  state: string
  codeChallenge?: string
  redirectUri: string
  expiresAt: Date
}

/**
 * KCB User profile from token endpoint
 */
export interface KCBUserProfile {
  id: string
  email: string
  name?: string
  picture?: string
  scope: string[]
}

/**
 * Configure KCB endpoints and credentials from environment
 */
const KCB_CONFIG = {
  baseUrl: process.env.KCB_BASE_URL || 'https://kcb-auth.example.com',
  authorizationEndpoint: process.env.KCB_AUTH_ENDPOINT || '/oauth/authorize',
  tokenEndpoint: process.env.KCB_TOKEN_ENDPOINT || '/oauth/token',
  userInfoEndpoint: process.env.KCB_USER_INFO_ENDPOINT || '/oauth/userinfo',
  clientId: process.env.KCB_CLIENT_ID,
  clientSecret: process.env.KCB_CLIENT_SECRET,
  redirectUri: process.env.KCB_REDIRECT_URI,
}

/**
 * Validate KCB configuration
 */
function validateKCBConfig(): void {
  const required = ['clientId', 'clientSecret', 'redirectUri']
  const missing = required.filter((key) => !KCB_CONFIG[key as keyof typeof KCB_CONFIG])

  if (missing.length > 0) {
    console.error('[KCB] Missing configuration:', missing)
    throw new Error(`KCB configuration incomplete: missing ${missing.join(', ')}`)
  }
}

/**
 * Format detailed error response
 */
function formatErrorResponse(
  err: any,
  context: string,
  status: number = 500,
): KCBErrorResponse {
  const timestamp = new Date().toISOString()
  const requestId = crypto.randomUUID()

  // Handle Axios errors with detailed response data
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<any>
    const responseStatus = axiosErr.response?.status || status
    const responseData = axiosErr.response?.data || {}

    console.error(`[KCB] Axios Error in ${context}:`, {
      status: responseStatus,
      statusText: axiosErr.response?.statusText,
      data: responseData,
      message: axiosErr.message,
      code: axiosErr.code,
      config: {
        url: axiosErr.config?.url,
        method: axiosErr.config?.method,
      },
    })

    return {
      success: false,
      status: responseStatus,
      error: responseData?.error || axiosErr.message,
      message: responseData?.error_description || `KCB ${context} failed`,
      code: responseData?.error_code || axiosErr.code,
      details: {
        statusText: axiosErr.response?.statusText,
        errorResponse: responseData,
      },
      timestamp,
      requestId,
    }
  }

  // Handle standard errors
  if (err instanceof Error) {
    console.error(`[KCB] Error in ${context}:`, {
      message: err.message,
      stack: err.stack,
      context,
    })

    return {
      success: false,
      status: null,
      error: err.name,
      message: err.message,
      timestamp,
      requestId,
    }
  }

  // Handle unknown errors
  console.error(`[KCB] Unknown error in ${context}:`, err)

  return {
    success: false,
    status: null,
    error: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    timestamp,
    requestId,
  }
}

/**
 * Generate OAuth state for CSRF protection
 */
export async function generateOAuthState(redirectUri: string): Promise<OAuthStateData> {
  try {
    const state = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store state in database for validation later
    await db.insert(kcbOAuthState).values({
      id: crypto.randomUUID(),
      state,
      redirectUri,
      expiresAt,
      createdAt: new Date(),
    })

    console.log('[KCB] Generated OAuth state:', { state: state.substring(0, 8) + '...', redirectUri })

    return { state, redirectUri, expiresAt }
  } catch (err) {
    const errorResponse = formatErrorResponse(err, 'generateOAuthState')
    console.error('[KCB] Failed to generate OAuth state:', errorResponse)
    throw new Error('Failed to generate OAuth state')
  }
}

/**
 * Validate OAuth state for CSRF protection
 */
export async function validateOAuthState(state: string, redirectUri: string): Promise<boolean> {
  try {
    const storedState = await db.query.kcbOAuthState.findFirst({
      where: eq(kcbOAuthState.state, state),
    })

    if (!storedState) {
      console.warn('[KCB] OAuth state not found in database:', state.substring(0, 8) + '...')
      return false
    }

    // Check if state has expired
    if (new Date() > storedState.expiresAt) {
      console.warn('[KCB] OAuth state has expired:', state.substring(0, 8) + '...')
      await db.delete(kcbOAuthState).where(eq(kcbOAuthState.state, state))
      return false
    }

    // Verify redirect URI matches
    if (storedState.redirectUri !== redirectUri) {
      console.warn('[KCB] Redirect URI mismatch:', {
        stored: storedState.redirectUri,
        provided: redirectUri,
      })
      return false
    }

    // Clean up the used state
    await db.delete(kcbOAuthState).where(eq(kcbOAuthState.state, state))

    console.log('[KCB] OAuth state validated successfully')
    return true
  } catch (err) {
    const errorResponse = formatErrorResponse(err, 'validateOAuthState')
    console.error('[KCB] Failed to validate OAuth state:', errorResponse)
    throw new Error('Failed to validate OAuth state')
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<KCBTokenResponse | KCBErrorResponse> {
  const context = 'exchangeCodeForToken'

  try {
    validateKCBConfig()

    console.log('[KCB] Exchanging authorization code for token:', {
      code: code.substring(0, 8) + '...',
      redirectUri,
    })

    const tokenUrl = `${KCB_CONFIG.baseUrl}${KCB_CONFIG.tokenEndpoint}`

    const response = await axios.post(
      tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: KCB_CONFIG.clientId,
        client_secret: KCB_CONFIG.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000, // 10 second timeout
      },
    )

    console.log('[KCB] Token exchange successful:', {
      tokenType: response.data.token_type,
      expiresIn: response.data.expires_in,
      hasRefreshToken: !!response.data.refresh_token,
    })

    // Decode JWT to get user ID (if using JWT, otherwise fetch from userinfo)
    const kcbUserId = response.data.user_id || response.data.sub || 'unknown'

    return {
      success: true,
      accessToken: response.data.access_token,
      tokenType: response.data.token_type || 'Bearer',
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token,
      scope: response.data.scope,
      kcbUserId,
    }
  } catch (err) {
    return formatErrorResponse(err, context)
  }
}

/**
 * Fetch user profile using access token
 */
export async function fetchUserProfile(accessToken: string): Promise<KCBUserProfile | KCBErrorResponse> {
  const context = 'fetchUserProfile'

  try {
    validateKCBConfig()

    console.log('[KCB] Fetching user profile with access token')

    const userInfoUrl = `${KCB_CONFIG.baseUrl}${KCB_CONFIG.userInfoEndpoint}`

    const response = await axios.get(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 10000,
    })

    console.log('[KCB] User profile fetched successfully:', {
      userId: response.data.id || response.data.sub,
      email: response.data.email,
    })

    return {
      id: response.data.id || response.data.sub,
      email: response.data.email,
      name: response.data.name,
      picture: response.data.picture,
      scope: response.data.scope ? response.data.scope.split(' ') : [],
    }
  } catch (err) {
    return formatErrorResponse(err, context)
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<KCBTokenResponse | KCBErrorResponse> {
  const context = 'refreshAccessToken'

  try {
    validateKCBConfig()

    console.log('[KCB] Refreshing access token')

    const tokenUrl = `${KCB_CONFIG.baseUrl}${KCB_CONFIG.tokenEndpoint}`

    const response = await axios.post(
      tokenUrl,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: KCB_CONFIG.clientId,
        client_secret: KCB_CONFIG.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      },
    )

    console.log('[KCB] Access token refreshed successfully')

    const kcbUserId = response.data.user_id || response.data.sub || 'unknown'

    return {
      success: true,
      accessToken: response.data.access_token,
      tokenType: response.data.token_type || 'Bearer',
      expiresIn: response.data.expires_in,
      refreshToken: response.data.refresh_token || refreshToken,
      scope: response.data.scope,
      kcbUserId,
    }
  } catch (err) {
    return formatErrorResponse(err, context)
  }
}

/**
 * Save KCB session to database
 */
export async function saveKCBSession(
  userId: string,
  kcbUserId: string,
  tokenData: KCBTokenResponse,
): Promise<string | KCBErrorResponse> {
  const context = 'saveKCBSession'

  try {
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + tokenData.expiresIn * 1000)

    await db.insert(kcbSession).values({
      id: sessionId,
      userId,
      kcbUserId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenType: tokenData.tokenType,
      expiresAt,
      scope: tokenData.scope,
      expiresIn: tokenData.expiresIn,
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('[KCB] KCB session saved:', { sessionId: sessionId.substring(0, 8) + '...', userId })

    return sessionId
  } catch (err) {
    return formatErrorResponse(err, context)
  }
}

/**
 * Get active KCB session
 */
export async function getKCBSession(userId: string): Promise<(typeof kcbSession.$inferSelect) | null> {
  try {
    const session = await db.query.kcbSession.findFirst({
      where: eq(kcbSession.userId, userId),
    })

    if (session && new Date() > session.expiresAt) {
      console.log('[KCB] KCB session has expired, removing:', userId)
      await db.delete(kcbSession).where(eq(kcbSession.userId, userId))
      return null
    }

    return session || null
  } catch (err) {
    const errorResponse = formatErrorResponse(err, 'getKCBSession')
    console.error('[KCB] Failed to get KCB session:', errorResponse)
    return null
  }
}

/**
 * Clean up expired OAuth states
 */
export async function cleanupExpiredStates(): Promise<number> {
  try {
    const result = await db.delete(kcbOAuthState).where(lt(kcbOAuthState.expiresAt, new Date()))

    console.log('[KCB] Cleaned up expired OAuth states')

    return result.rowCount || 0
  } catch (err) {
    const errorResponse = formatErrorResponse(err, 'cleanupExpiredStates')
    console.error('[KCB] Failed to cleanup expired states:', errorResponse)
    return 0
  }
}
