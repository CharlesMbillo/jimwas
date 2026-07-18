import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface STKPushRequest {
  phone: string;
  amount: number;
  transactionId?: string;
  customerId?: string;
  cashierId?: string;
  cashierName?: string;
  accountReference?: string;
  transactionDesc?: string;
}

// Format phone to 254XXXXXXXXX
function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0") && p.length === 10) return "254" + p.slice(1);
  if (p.startsWith("+254")) return p.slice(1);
  if (p.startsWith("254") && p.length === 12) return p;
  if (p.length === 9) return "254" + p;
  return p;
}

function generateTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

function generatePassword(shortCode: string, passkey: string, timestamp: string): string {
  return btoa(shortCode + passkey + timestamp);
}

async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  environment: string
): Promise<string> {
  const baseUrl =
    environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  console.log(`[getAccessToken] Calling ${baseUrl}/oauth/v1/generate with environment: ${environment}`);
  
  try {
    const resp = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    console.log(`[getAccessToken] Auth response status: ${resp.status}`);
    const text = await resp.text();
    
    if (!resp.ok) {
      console.error(`[getAccessToken] Auth failed: ${text}`);
      let msg = `Auth failed (${resp.status})`;
      try {
        const json = JSON.parse(text);
        msg = json.error_description || json.errorMessage || json.error || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    
    const data = JSON.parse(text);
    if (!data.access_token) {
      console.error(`[getAccessToken] No access token in response: ${text}`);
      throw new Error("No access token in Safaricom response");
    }
    
    console.log(`[getAccessToken] Successfully obtained access token`);
    return data.access_token;
  } catch (error) {
    console.error(`[getAccessToken] Exception:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const body: STKPushRequest = await req.json();

    if (!body.phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be greater than 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load KCB BUNI settings
    const { data: settings, error: settingsError } = await supabase
      .from("kcb_settings")
      .select("*")
      .eq("id", "kcb-settings")
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "KCB BUNI settings not found in database" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!settings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "KCB BUNI is disabled. Enable it in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!settings.client_id || !settings.client_secret) {
      return new Response(
        JSON.stringify({ error: "KCB Client ID and Secret are required. Configure them in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!settings.org_passkey) {
      return new Response(
        JSON.stringify({ error: "KCB Organization Passkey is required. Add it in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Use org_shortcode for KCB BUNI
    const effectiveShortCode = settings.org_shortcode;
    if (!effectiveShortCode) {
      return new Response(
        JSON.stringify({ error: "KCB Organization Shortcode is required. Add it in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhone(body.phone);
    if (formattedPhone.length !== 12 || !formattedPhone.startsWith("254")) {
      return new Response(
        JSON.stringify({ error: `Invalid phone number format: ${body.phone}. Use format 07XXXXXXXX or +2547XXXXXXXX` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callbackUrl = settings.callback_url || `${supabaseUrl}/functions/v1/mpesa-callback`;
    const timeoutUrl = settings.timeout_url || `${supabaseUrl}/functions/v1/mpesa-timeout`;
    const accountRef = (body.accountReference || `PAY${Date.now()}`).substring(0, 12);
    const transactionDesc = (body.transactionDesc || "POS Payment").substring(0, 13);

    // Determine transaction type: C2B PayBill vs Buy Goods (till)
    const transactionType = settings.till_number
      ? "CustomerBuyGoodsOnline"
      : "CustomerPayBillOnline";

    const baseUrl =
      settings.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    console.log("Getting KCB BUNI access token...");
    
    // In sandbox mode with test credentials, mock the token generation
    let accessToken: string;
    if (settings.environment === 'sandbox' && 
        (settings.client_id?.includes('test') || settings.client_id === 'demo')) {
      console.log("[SANDBOX MODE] Mocking access token for testing");
      accessToken = btoa(`sandbox-token-${Date.now()}`);
    } else {
      accessToken = await getAccessToken(
        settings.client_id,
        settings.client_secret,
        settings.environment
      );
    }

    const timestamp = generateTimestamp();
    const password = generatePassword(effectiveShortCode, settings.org_passkey, timestamp);

    const stkBody = {
      BusinessShortCode: effectiveShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: Math.round(body.amount),
      PartyA: formattedPhone,
      PartyB: effectiveShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountRef,
      TransactionDesc: transactionDesc,
    };

    console.log("STK Push request:", JSON.stringify({ ...stkBody, Password: "***" }));

    const stkResp = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkBody),
    });

    const stkData = await stkResp.json();
    console.log("STK Push response:", JSON.stringify(stkData));

    if (stkData.errorCode || stkData.ResponseCode !== "0") {
      const errMsg = stkData.errorMessage || stkData.ResponseDescription || stkData.CustomerMessage || "STK Push failed";
      return new Response(
        JSON.stringify({ error: errMsg, safaricomCode: stkData.errorCode || stkData.ResponseCode }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkoutRequestId = stkData.CheckoutRequestID;
    const merchantRequestId = stkData.MerchantRequestID;

    // Store in mpesa_transactions
    const { data: mpesaTx, error: insertError } = await supabase
      .from("mpesa_transactions")
      .insert({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        phone_number: formattedPhone,
        amount: body.amount,
        status: "pending",
        transaction_id: body.transactionId || null,
        customer_id: body.customerId || null,
        cashier_id: body.cashierId || null,
        cashier_name: body.cashierName || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to store mpesa_transaction:", insertError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId,
        merchantRequestId,
        mpesaTransactionId: mpesaTx?.id,
        message: "STK Push sent. Ask customer to check their phone.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    console.error("STK Push error:", errorMsg, error);
    const errorResponse = JSON.stringify({ 
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString()
    });
    console.log("Sending error response:", errorResponse);
    return new Response(
      errorResponse,
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
