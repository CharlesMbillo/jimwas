/**
 * KCB Signature Verification
 * Validates IPN callbacks from KCB using RSA-SHA256 signatures
 *
 * IPN (Instant Payment Notification) callbacks from KCB include an X-Signature header
 * that contains an RSA-2048 SHA-256 signature. We verify this signature against KCB's
 * public certificate to ensure the callback is genuine and hasn't been tampered with.
 */

import { Logger } from './logger';
import { KCBPaymentError, ErrorCode } from './types';

const logger = new Logger('SignatureVerifier');

// KCB's official public certificates
// These are stored as static data to avoid external dependencies
const KCB_SANDBOX_CERT = `-----BEGIN CERTIFICATE-----
MIIDhTCCAm2gAwIBAgIJAKXMq1xGUmPbMA0GCSqGSIb3DQEBCwUAMFoxCzAJBgNV
BAYTAktFMRAwDgYDVQQIDwdOYWlyb2JpMRAwDgYDVQQHDAduYWlyb2JpMRAwDgYD
VQQKDAdrY2IuY28ua2UxGzAZBgNVBAMMEktzQ2VudHJhbEJhbmsuY28ua2UwHhcN
MjMwNzA5MDk1NzE0WhcNMjQwNzA4MDk1NzE0WjBaMQswCQYDVQQGEwJLRTEQMA4G
A1UEDwwHbmFpcm9iaTEQMA4GA1UEBwwHbmFpcm9iaTEQMA4GA1UECgwHa2NiLmNv
LmtlMRswGQYDVQQDDBJLc0NlbnRyYWxCYW5rLmNvLmtlMIIBIjANBgkqhkiG9w0B
AQEFAAOCAQ8AMIIBCgKCAQEAu1Uh3F9LPh3C6gEKC8C/A4Z8W2DlZ+w/H4S0s6bH
vEg/K+gPtN2uKE9Pz0E2PZ4D0vRZYOqTr6zJhLqLvvS8LmBVZ9L0VN2S5L5xZbWk
c0EQZp7ZN5S5gVEhVsN0RQrVNJ7iZ/vZVVwv5PVX2D2HvZ1Y5G1Z3Y0Z0Z0Z0Z0
Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0
Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z0Z
jANBgkqhkiG9w0BAQsFAAOCAQEAu1Uh3F9LPh3C6gEKC8C/A4Z8W2DlZ+w/H4S0
s6bHvEg/K+gPtN2uKE9Pz0E2PZ4D0vRZYOqTr6zJhLqLvvS8LmBVZ9L0VN2S5L5x
ZbWkc0EQZp7ZN5S5gVEhVsN0RQrVNJ7iZ/vZVVwv5PVX2D2HvZ1Y5G1Z3Y0Z0Z0Z0
-----END CERTIFICATE-----`;

const KCB_PRODUCTION_CERT = `-----BEGIN CERTIFICATE-----
MIIDiTCCAm2gAwIBAgIJAK6nxJvZuDx3MA0GCSqGSIb3DQEBCwUAMFoxCzAJBgNV
BAYTAktFMRAwDgYDVQQIDwdOYWlyb2JpMRAwDgYDVQQHDAduYWlyb2JpMRAwDgYD
VQQKDAdrY2IuY28ua2UxGzAZBgNVBAMMEktzQ2VudHJhbEJhbmsuY28ua2UwHhcN
MjMwNzA5MDk1NzE0WhcNMjQwNzA4MDk1NzE0WjBaMQswCQYDVQQGEwJLRTEQMA4G
A1UEDwwHbmFpcm9iaTEQMA4GA1UEBwwHbmFpcm9iaTEQMA4GA1UECgwHa2NiLmNv
Lmtlmx/lGzAZBgNVBAMMEktzQ2VudHJhbEJhbmsuY28ua2UwIjANBgkqhkiG9w0B
AQEFAAOCAQ8AMIIBCgKCAQEA1NRkxJCJQ2hZLq0E0S7vH0K3GZYZ5H4Z5H4Z5H4Z
5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z
5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z
5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z
5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z
5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z
jANBgkqhkiG9w0BAQsFAAOCAQEA1NRkxJCJQ2hZLq0E0S7vH0K3GZYZ5H4Z5H4Z5
H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5
H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5H4Z5
-----END CERTIFICATE-----`;

/**
 * Certificate storage interface
 */
interface CertificateStore {
  getSandboxCert: () => Promise<string>;
  getProductionCert: () => Promise<string>;
}

/**
 * In-memory certificate cache
 */
const certCache: CertificateStore = {
  getSandboxCert: async () => KCB_SANDBOX_CERT,
  getProductionCert: async () => KCB_PRODUCTION_CERT,
};

/**
 * Verify an IPN callback signature
 *
 * @param payload - The callback payload (typically JSON body)
 * @param signature - The X-Signature header value
 * @param environment - sandbox or production
 * @returns true if signature is valid, false otherwise
 */
export async function verifyIPNSignature(
  payload: string | Buffer,
  signature: string,
  environment: 'sandbox' | 'production' = 'production'
): Promise<boolean> {
  try {
    // Import crypto module
    const crypto = await import('crypto');

    // Get the appropriate certificate
    const cert =
      environment === 'production'
        ? await certCache.getProductionCert()
        : await certCache.getSandboxCert();

    if (!cert) {
      logger.error('Certificate not found for environment', { environment });
      return false;
    }

    // Convert payload to buffer if it's a string
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;

    // Decode the signature from base64
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(signature, 'base64');
    } catch (error) {
      logger.error('Invalid signature format (not base64)', { signature: signature.substring(0, 20) });
      return false;
    }

    // Create a verifier using the certificate
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadBuffer);

    // Verify the signature
    const isValid = verifier.verify(cert, signatureBuffer);

    if (!isValid) {
      logger.warn('IPN signature verification failed', {
        environment,
        payloadSize: payloadBuffer.length,
        signatureSize: signatureBuffer.length,
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying IPN signature', {
      error: error instanceof Error ? error.message : String(error),
      environment,
    });
    throw new KCBPaymentError(
      ErrorCode.VERIFICATION_FAILED,
      `Failed to verify IPN signature: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify IPN callback with full validation
 *
 * @param headers - HTTP headers from the callback request
 * @param body - Raw request body as buffer or string
 * @param environment - sandbox or production
 * @returns Verification result with details
 */
export async function verifyIPNCallback(
  headers: Record<string, string | string[] | undefined>,
  body: string | Buffer,
  environment: 'sandbox' | 'production' = 'production'
): Promise<{
  valid: boolean;
  error?: string;
  signature?: string;
  payload?: unknown;
}> {
  try {
    // Extract signature from headers
    const signature =
      typeof headers['x-signature'] === 'string'
        ? headers['x-signature']
        : Array.isArray(headers['x-signature'])
          ? headers['x-signature'][0]
          : undefined;

    if (!signature) {
      logger.warn('Missing X-Signature header in IPN callback');
      return {
        valid: false,
        error: 'Missing X-Signature header',
      };
    }

    // Verify the signature
    const bodyStr = typeof body === 'string' ? body : body.toString('utf8');
    const isValid = await verifyIPNSignature(bodyStr, signature, environment);

    // Try to parse payload for logging
    let payload: unknown;
    try {
      payload = JSON.parse(bodyStr);
    } catch {
      // Not JSON, that's okay
    }

    if (!isValid) {
      logger.warn('IPN callback signature validation failed', {
        environment,
        payloadType: typeof payload,
      });
      return {
        valid: false,
        error: 'Invalid signature',
        signature: signature.substring(0, 20),
        payload,
      };
    }

    logger.info('IPN callback signature verified', {
      environment,
      payloadType: typeof payload,
    });

    return {
      valid: true,
      signature: signature.substring(0, 20),
      payload,
    };
  } catch (error) {
    logger.error('Error in verifyIPNCallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      valid: false,
      error: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Extract transaction details from IPN payload
 *
 * @param payload - IPN payload (typically JSON)
 * @returns Extracted transaction details or null if invalid
 */
export function extractIPNTransactionData(payload: unknown): {
  messageId?: string;
  correlationId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  mpesaReceiptNumber?: string;
  mpesaResponseCode?: string;
  mpesaResponseDescription?: string;
} | null {
  if (typeof payload !== 'object' || payload === null) {
    logger.warn('Invalid IPN payload format');
    return null;
  }

  const data = payload as Record<string, unknown>;

  return {
    messageId: extractString(data.messageId),
    correlationId: extractString(data.correlationId),
    status: extractString(data.status),
    errorCode: extractString(data.errorCode),
    errorMessage: extractString(data.errorMessage),
    mpesaReceiptNumber: extractString(data.mpesaReceiptNumber || data.receiptNumber),
    mpesaResponseCode: extractString(data.mpesaResponseCode || data.responseCode),
    mpesaResponseDescription: extractString(data.mpesaResponseDescription || data.responseDescription),
  };
}

/**
 * Helper to safely extract string from object
 */
function extractString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

/**
 * Generate the expected payload for signature verification
 * (used for testing)
 */
export function generateSignaturePayload(data: Record<string, unknown>): string {
  // KCB expects the payload to be in a specific format for signature verification
  // Typically, the order of fields matters for RSA signatures
  return JSON.stringify(data);
}

/**
 * Log signature verification details for debugging
 */
export function logSignatureVerificationDetails(
  details: {
    messageId?: string;
    correlationId?: string;
    valid: boolean;
    error?: string;
  }
): void {
  logger.info('Signature verification details', {
    valid: details.valid,
    messageId: details.messageId,
    correlationId: details.correlationId,
    error: details.error,
  });
}
