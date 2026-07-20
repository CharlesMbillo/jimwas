import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { checkoutRequestId, phone, amount } = await req.json();

    if (!checkoutRequestId) {
      return new Response(
        JSON.stringify({ error: "checkoutRequestId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Sandbox Simulate] Processing payment: ${checkoutRequestId}`);

    // Generate simulated response data
    const kcbReceiptNumber = `KCB${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`;
    const currentTime = new Date().toISOString();

    // First, try to find existing transaction
    const { data: existingTx } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (existingTx) {
      // Update existing transaction
      await supabase
        .from("mpesa_transactions")
        .update({
          status: "success",
          mpesa_receipt_number: kcbReceiptNumber,
          result_code: "0",
          result_desc: "The service request has been accepted successfully",
          callback_received: true,
          callback_payload: {
            Body: {
              stkCallback: {
                MerchantRequestID: existingTx.merchant_request_id,
                CheckoutRequestID: checkoutRequestId,
                ResultCode: 0,
                ResultDesc: "The service request has been accepted successfully",
                CallbackMetadata: {
                  Item: [
                    { Name: "Amount", Value: amount || existingTx.amount },
                    { Name: "MpesaReceiptNumber", Value: kcbReceiptNumber },
                    { Name: "TransactionDate", Value: new Date().toISOString() },
                    { Name: "PhoneNumber", Value: phone || existingTx.phone_number },
                  ],
                },
              },
            },
          },
          updated_at: currentTime,
        })
        .eq("checkout_request_id", checkoutRequestId);

      console.log(`[Sandbox Simulate] Updated existing transaction: ${checkoutRequestId}`);
    } else {
      // Create new transaction (if somehow it doesn't exist)
      await supabase
        .from("mpesa_transactions")
        .insert({
          id: `sim_${checkoutRequestId}`,
          checkout_request_id: checkoutRequestId,
          merchant_request_id: `SIM-${Date.now()}`,
          phone_number: phone || "254700000000",
          amount: amount || 1000,
          status: "success",
          mpesa_receipt_number: kcbReceiptNumber,
          result_code: "0",
          result_desc: "The service request has been accepted successfully",
          callback_received: true,
          callback_payload: {
            Body: {
              stkCallback: {
                MerchantRequestID: `SIM-${Date.now()}`,
                CheckoutRequestID: checkoutRequestId,
                ResultCode: 0,
                ResultDesc: "The service request has been accepted successfully",
                CallbackMetadata: {
                  Item: [
                    { Name: "Amount", Value: amount || 1000 },
                    { Name: "MpesaReceiptNumber", Value: kcbReceiptNumber },
                    { Name: "TransactionDate", Value: new Date().toISOString() },
                    { Name: "PhoneNumber", Value: phone || "254700000000" },
                  ],
                },
              },
            },
          },
          created_at: currentTime,
          updated_at: currentTime,
        });

      console.log(`[Sandbox Simulate] Created new simulated transaction: ${checkoutRequestId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "success",
        mpesaReceiptNumber: kcbReceiptNumber,
        resultDesc: "Simulated payment successful",
        message: "Sandbox payment simulation complete. Transaction marked as successful.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Sandbox Simulate] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Simulation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
