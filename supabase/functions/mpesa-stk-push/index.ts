import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MPESA_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load M-Pesa settings from the database (persists across restarts)
    const { data: settings, error: settingsError } = await supabase
      .from("mpesa_settings")
      .select("*")
      .eq("id", MPESA_SETTINGS_ID)
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "M-Pesa settings not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.enabled) {
      return new Response(
        JSON.stringify({ error: "M-Pesa STK Push is disabled. Enable it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, amount, accountReference, transactionDesc } = await req.json();

    if (!phone || !amount) {
      return new Response(
        JSON.stringify({ error: "Phone and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get OAuth access token from Safaricom
    const authUrl = settings.environment === "production"
      ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    const authHeader = btoa(`${settings.consumer_key}:${settings.consumer_secret}`);

    const tokenResponse = await fetch(authUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to get M-Pesa access token", details: tokenError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Generate password (shortcode + passkey + timestamp)
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14);
    const password = btoa(`${settings.shortcode}${settings.passkey}${timestamp}`);

    // Step 3: Send STK Push request
    const stkUrl = settings.environment === "production"
      ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
      : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const stkResponse = await fetch(stkUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: settings.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: settings.shortcode,
        PhoneNumber: phone,
        CallBackURL: settings.callback_url,
        AccountReference: accountReference || "Jimwas POS",
        TransactionDesc: transactionDesc || "Payment for goods",
      }),
    });

    const stkData = await stkResponse.json();

    if (!stkResponse.ok) {
      return new Response(
        JSON.stringify({ error: "STK Push failed", details: stkData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: stkData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
