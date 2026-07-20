# KCB BUNI Payment Gateway - Next Steps Implementation Guide

**Current Progress:** 30% Complete (Core + Settings + Auto-Save)  
**Next Phase Target:** 60% Complete (Database + API Endpoints)  
**Estimated Time:** 5-7 days for one developer  

---

## Quick Start for Next Developer

### 1. Understand Current State (30 minutes)
```bash
# Read the audit report first
cat KCB_BUNI_AUDIT_REPORT_2026.md

# Check the existing implementation
cat src/lib/modules/payments/kcb/types.ts       # Type definitions
cat src/lib/modules/payments/kcb/client.ts      # Main client
cat src/lib/kcb-payment-manager.ts              # Auto-save layer
cat src/lib/modules/payments/kcb/repository.ts  # Database layer

# Review fixed settings
cat src/lib/settings-types.ts                   # KCBSettings interface
grep -A 20 "passkey\|Initiator" src/routes/settings.tsx # Production passkey field
```

### 2. Get KCB Sandbox Credentials (Time varies)
- Contact KCB or Safaricom for sandbox credentials
- Required fields:
  - Consumer Key (API Client ID)
  - Consumer Secret (API Client Secret)
  - Organization Shortcode
  - Organization Passkey

### 3. Implement Phase 3 (Database + API)
See detailed steps below.

---

## Phase 3: Database Migrations & API Endpoints

### Step 1: Create Supabase Migrations

#### Migration File 1: payment_transactions
```sql
-- supabase/migrations/20260717_create_payment_transactions.sql

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_request_id VARCHAR(255) UNIQUE NOT NULL,
  checkout_request_id VARCHAR(255) UNIQUE NOT NULL,
  invoice_id VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  receipt VARCHAR(255),
  result_code INTEGER,
  result_desc TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE,
  raw_payload JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_payment_transactions_merchant_request 
  ON public.payment_transactions(merchant_request_id);

CREATE INDEX idx_payment_transactions_checkout_request 
  ON public.payment_transactions(checkout_request_id);

CREATE INDEX idx_payment_transactions_status 
  ON public.payment_transactions(status);

CREATE INDEX idx_payment_transactions_created_at 
  ON public.payment_transactions(created_at DESC);

CREATE INDEX idx_payment_transactions_customer_id 
  ON public.payment_transactions(customer_id);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Users can view their transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (auth.uid()::text = (SELECT user_id FROM public.customers WHERE id = customer_id)::text);

CREATE POLICY "Users can create transactions"
  ON public.payment_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage all transactions"
  ON public.payment_transactions
  FOR ALL
  USING (auth.role() = 'service_role');
```

#### Migration File 2: payment_callbacks
```sql
-- supabase/migrations/20260717_create_payment_callbacks.sql

CREATE TABLE IF NOT EXISTS public.payment_callbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  merchant_request_id VARCHAR(255) NOT NULL,
  checkout_request_id VARCHAR(255) NOT NULL,
  result_code INTEGER NOT NULL,
  result_desc TEXT,
  signature VARCHAR(1024) NOT NULL,
  payload JSONB NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payment_callbacks_transaction_id 
  ON public.payment_callbacks(transaction_id);

CREATE INDEX idx_payment_callbacks_verified 
  ON public.payment_callbacks(verified);

CREATE INDEX idx_payment_callbacks_created_at 
  ON public.payment_callbacks(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage callbacks"
  ON public.payment_callbacks
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Step 2: Create API Endpoint - STK Push Initiation

**File:** `app/api/payments/kcb/stk-push/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getKCBClient } from '@/src/lib/modules/payments/kcb';
import { createPaymentTransaction } from '@/src/lib/modules/payments/kcb/repository';
import { autoSavePayment } from '@/src/lib/kcb-payment-manager';
import type { STKPushRequest } from '@/src/lib/modules/payments/kcb/types';

export async function POST(req: NextRequest) {
  try {
    // Validate request body
    const body = await req.json();
    const { phoneNumber, amount, invoiceNumber, description, customerId } = body;

    // Validate required fields
    if (!phoneNumber || !amount || !invoiceNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount < 1 || amount > 999999.99) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get KCB client
    const client = getKCBClient();

    // Initiate STK Push
    const stk_response = await client.initiateSTKPush({
      phoneNumber,
      amount,
      invoiceNumber,
      description,
    } as STKPushRequest);

    // Auto-save payment
    const payment = await autoSavePayment(stk_response, {
      customerId,
      userAgent: req.headers.get('user-agent'),
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    });

    // Also save to database for persistence
    try {
      await createPaymentTransaction({
        stk_response,
        invoice_id: invoiceNumber,
        customer_id: customerId,
        description,
      });
    } catch (dbError) {
      // Log but don't fail - payment was initiated
      console.error('[v0] Database save failed (non-blocking):', dbError);
    }

    return NextResponse.json({
      success: true,
      merchantRequestId: stk_response.merchantRequestId,
      checkoutRequestId: stk_response.checkoutRequestId,
      phoneNumber: stk_response.phoneNumber,
      amount: stk_response.amount,
      timestamp: stk_response.timestamp,
    });
  } catch (error) {
    console.error('[v0] STK Push error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to initiate payment',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

### Step 3: Create API Endpoint - Payment Status Query

**File:** `app/api/payments/kcb/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getKCBClient } from '@/src/lib/modules/payments/kcb';
import { 
  getPaymentTransaction,
  updatePaymentTransaction 
} from '@/src/lib/modules/payments/kcb/repository';
import { updatePaymentStatus } from '@/src/lib/kcb-payment-manager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { merchantRequestId, checkoutRequestId } = body;

    if (!merchantRequestId || !checkoutRequestId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get KCB client
    const client = getKCBClient();

    // Query payment status from KCB
    const status = await client.queryPaymentStatus(
      merchantRequestId,
      checkoutRequestId
    );

    // Update in database
    try {
      await updatePaymentTransaction(checkoutRequestId, {
        status: status.status as any,
        receipt: status.receipt,
        result_code: status.resultCode,
        result_desc: status.resultDesc,
      });
    } catch (dbError) {
      // Log but continue - status query succeeded
      console.warn('[v0] Database update failed:', dbError);
    }

    return NextResponse.json({
      status: status.status,
      receipt: status.receipt,
      resultCode: status.resultCode,
      resultDesc: status.resultDesc,
    });
  } catch (error) {
    console.error('[v0] Status query error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to query status',
      },
      { status: 500 }
    );
  }
}
```

### Step 4: Create API Endpoint - Payment History

**File:** `app/api/payments/kcb/history/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTransactionHistory } from '@/src/lib/modules/payments/kcb/repository';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const transactions = await getTransactionHistory(limit, offset);

    return NextResponse.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error('[v0] History query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
```

---

## Phase 4: Signature Verification

### Create Signature Module
**File:** `src/lib/modules/payments/kcb/signature.ts`

```typescript
/**
 * KCB IPN Signature Verification
 * RSA-SHA256 signature verification for payment callbacks
 */

import type { IPNPayload } from './types';

export interface VerificationResult {
  valid: boolean;
  payload: IPNPayload;
  error?: string;
}

/**
 * Verify IPN signature (RSA-SHA256)
 */
export async function verifyIPNSignature(
  payload: string,
  signature: string,
  publicCertPath?: string
): Promise<VerificationResult> {
  try {
    // Get the public certificate
    const cert = await loadPublicCertificate(publicCertPath);
    if (!cert) {
      return {
        valid: false,
        payload: {},
        error: 'Public certificate not found',
      };
    }

    // Verify signature using crypto
    const isValid = await verifySHA256Signature(payload, signature, cert);

    // Parse payload
    let parsedPayload: IPNPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (e) {
      return {
        valid: false,
        payload: {},
        error: 'Invalid JSON payload',
      };
    }

    return {
      valid: isValid,
      payload: parsedPayload,
    };
  } catch (error) {
    console.error('[v0] Signature verification failed:', error);
    return {
      valid: false,
      payload: {},
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Load public certificate for verification
 */
async function loadPublicCertificate(
  certPath?: string
): Promise<string | null> {
  try {
    // Try to load from configured path
    if (certPath) {
      const response = await fetch(certPath);
      if (response.ok) {
        return await response.text();
      }
    }

    // Try to load from environment or default location
    const envCert = process.env.KCB_PUBLIC_CERT;
    if (envCert) {
      return envCert;
    }

    // Try default path
    try {
      const response = await fetch('/certs/kcb-public.pem');
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Ignore
    }

    return null;
  } catch (error) {
    console.error('[v0] Failed to load certificate:', error);
    return null;
  }
}

/**
 * Verify RSA-SHA256 signature
 */
async function verifySHA256Signature(
  payload: string,
  signature: string,
  publicCert: string
): Promise<boolean> {
  try {
    // Decode signature from base64
    const signatureBuffer = Uint8Array.from(
      atob(signature),
      c => c.charCodeAt(0)
    );

    // Create crypto key from certificate
    const key = await crypto.subtle.importKey(
      'spki',
      extractPublicKeyFromCert(publicCert),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBuffer,
      new TextEncoder().encode(payload)
    );

    return verified;
  } catch (error) {
    console.error('[v0] RSA verification failed:', error);
    return false;
  }
}

/**
 * Extract public key from PEM certificate
 */
function extractPublicKeyFromCert(certPem: string): ArrayBuffer {
  // Remove PEM headers
  const pemContents = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  // Convert base64 to binary
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}
```

### Create IPN Callback Handler
**File:** `app/api/payments/kcb/ipn/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyIPNSignature } from '@/src/lib/modules/payments/kcb/signature';
import {
  getPaymentTransaction,
  updatePaymentTransaction,
  savePaymentCallback,
  markCallbackProcessed,
} from '@/src/lib/modules/payments/kcb/repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-kcb-signature') || '';

    // Verify signature
    const verification = await verifyIPNSignature(body, signature);

    if (!verification.valid) {
      console.warn('[v0] Invalid IPN signature');
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    const payload = verification.payload;

    // Find transaction
    const transaction = await getPaymentTransaction(
      payload.checkoutRequestId
    );

    if (!transaction) {
      console.warn('[v0] Transaction not found for IPN:', payload.checkoutRequestId);
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Save callback record
    const callback = await savePaymentCallback({
      transaction_id: transaction.id,
      ipn_payload: payload,
      signature,
      verified: true,
    });

    // Update transaction status
    const statusMap: Record<number, string> = {
      0: 'paid',
      14: 'insufficient_funds',
      17: 'cancelled',
      20: 'timeout',
    };

    const newStatus = statusMap[payload.resultCode] || 'failed';

    await updatePaymentTransaction(payload.checkoutRequestId, {
      status: newStatus as any,
      receipt: payload.receipt,
      result_code: payload.resultCode,
      result_desc: payload.resultDescription,
      transaction_date: new Date().toISOString(),
    });

    // Mark callback as processed
    await markCallbackProcessed(callback.id);

    // Return success
    return NextResponse.json({
      status: 'success',
      message: 'Payment callback processed',
    });
  } catch (error) {
    console.error('[v0] IPN processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}
```

---

## Testing Instructions

### 1. Test STK Push Endpoint
```bash
curl -X POST http://localhost:3000/api/payments/kcb/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "amount": 1000,
    "invoiceNumber": "INV-20260717-001",
    "description": "Test payment",
    "customerId": "customer-123"
  }'
```

### 2. Test Status Query Endpoint
```bash
curl -X POST http://localhost:3000/api/payments/kcb/status \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRequestId": "merchant-req-id",
    "checkoutRequestId": "checkout-req-id"
  }'
```

### 3. Test Payment History Endpoint
```bash
curl http://localhost:3000/api/payments/kcb/history?limit=20&offset=0
```

---

## Deployment Checklist

- [ ] Create and run Supabase migrations
- [ ] Test API endpoints locally
- [ ] Deploy to staging environment
- [ ] Test with KCB sandbox credentials
- [ ] Get production KCB credentials
- [ ] Deploy signature verification
- [ ] Test IPN callback handler
- [ ] Configure payment auto-retry
- [ ] Set up payment monitoring/alerts
- [ ] Deploy to production
- [ ] Monitor for 7 days post-launch

---

## Troubleshooting

### Payment Not Persisting
1. Check Supabase connection in `.env`
2. Verify payment_transactions table exists
3. Check browser console for errors
4. Verify IndexedDB has kcb_payment_records store

### IPN Callback Not Working
1. Verify certificate path is correct
2. Check signature format (base64 encoded)
3. Enable HTTPS for production
4. Test callback URL is accessible

### Status Query Returns Pending
1. Wait 5-10 seconds (STK dialog response time)
2. Check merchant_request_id format
3. Verify KCB API credentials
4. Check network logs for API errors

---

## Reference Documentation

- KCB BUNI API: https://developer.kcb.co.ke/
- Payment Flow Diagram: See KCB_BUNI_AUDIT_REPORT_2026.md
- Type Definitions: `src/lib/modules/payments/kcb/types.ts`
- Repository Interface: `src/lib/modules/payments/kcb/repository.ts`

---

**Next Steps:** Choose one endpoint to implement first, test thoroughly, then proceed to the others.
