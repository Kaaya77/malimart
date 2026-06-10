// supabase/functions/clickpesa-payment/index.ts
//
// Initiates a ClickPesa USSD-PUSH payment for an order.
// SECURITY MODEL:
//  - CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY live ONLY in Edge Function secrets
//  - The amount is read from the orders table SERVER-SIDE — the client
//    sends only { orderId, phoneNumber }; it can never set the price
//  - The caller must be authenticated and must own the order
//
// Deploy:  supabase functions deploy clickpesa-payment
// Secrets: supabase secrets set CLICKPESA_CLIENT_ID=... CLICKPESA_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";

const CLICKPESA_BASE = "https://api.clickpesa.com/third-parties";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function clickpesaToken(): Promise<string> {
  const res = await fetch(`${CLICKPESA_BASE}/generate-token`, {
    method: "POST",
    headers: {
      "client-id": Deno.env.get("CLICKPESA_CLIENT_ID")!,
      "api-key": Deno.env.get("CLICKPESA_API_KEY")!,
    },
  });
  if (!res.ok) throw new Error(`ClickPesa auth failed: ${res.status}`);
  const data = await res.json();
  // Per docs, the token already includes the "Bearer " prefix
  return data.token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ── 1. Authenticate the caller ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { orderId, phoneNumber } = await req.json();
    if (!orderId || !phoneNumber) return json({ error: "orderId and phoneNumber required" }, 400);

    // Normalise phone: ClickPesa wants 255XXXXXXXXX (no plus sign)
    const phone = String(phoneNumber).replace(/\D/g, "").replace(/^0/, "255");
    if (!/^255\d{9}$/.test(phone)) return json({ error: "Invalid Tanzanian phone number" }, 400);

    // ── 2. Load the order SERVER-SIDE (service role) ───────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, user_id, total, payment_status")
      .eq("id", orderId)
      .single();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== user.id) return json({ error: "Not your order" }, 403);
    if (order.payment_status === "paid") return json({ error: "Order already paid" }, 409);

    const amount = Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Invalid order total" }, 400);

    // ── 3. Create our payment record with an alphanumeric reference ────
    // ClickPesa rejects non-alphanumeric refs (UUIDs have hyphens)
    const orderReference =
      "MM" + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    const { error: payErr } = await admin.from("payments").insert({
      order_id: order.id,
      user_id: user.id,
      order_reference: orderReference,
      phone_number: phone,
      amount,
      currency: "TZS",
      status: "PROCESSING",
    });
    if (payErr) return json({ error: "Could not create payment record" }, 500);

    // ── 4. Fire the USSD-PUSH ──────────────────────────────────────────
    const token = await clickpesaToken();
    const pushRes = await fetch(`${CLICKPESA_BASE}/payments/initiate-ussd-push-request`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: String(Math.round(amount)),
        currency: "TZS",
        orderReference,
        phoneNumber: phone,
      }),
    });
    const push = await pushRes.json();

    if (!pushRes.ok) {
      await admin.from("payments")
        .update({ status: "FAILED", failure_message: push?.message ?? `HTTP ${pushRes.status}`, updated_at: new Date().toISOString() })
        .eq("order_reference", orderReference);
      return json({ error: push?.message ?? "Payment initiation failed" }, 502);
    }

    await admin.from("payments")
      .update({ provider_payment_id: push.id ?? null, channel: push.channel ?? null, updated_at: new Date().toISOString() })
      .eq("order_reference", orderReference);
    await admin.from("orders")
      .update({ payment_status: "processing", payment_ref: orderReference })
      .eq("id", order.id);

    return json({
      success: true,
      orderReference,
      status: push.status ?? "PROCESSING",
      message: "USSD prompt sent — ask the customer to enter their PIN",
    });
  } catch (e) {
    console.error("clickpesa-payment error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
