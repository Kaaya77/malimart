// supabase/functions/clickpesa-webhook/index.ts
//
// Receives ClickPesa webhooks (PAYMENT RECEIVED / PAYMENT FAILED).
//
// SECURITY MODEL — never trust the webhook payload alone:
// Anyone who discovers this URL could POST a forged "PAYMENT RECEIVED".
// So before marking anything paid, we RE-QUERY the ClickPesa API for the
// orderReference using our own credentials. Money is only confirmed when
// ClickPesa's API itself says SUCCESS and the amount matches our record.
//
// Deploy:  supabase functions deploy clickpesa-webhook --no-verify-jwt
//          (ClickPesa can't send Supabase JWTs — verification happens above)
// Configure in ClickPesa Dashboard → Settings → Developers → your application
// → Application Webhooks → PAYMENT RECEIVED + PAYMENT FAILED:
//   https://ubpapxdmqlepynonhaeo.functions.supabase.co/clickpesa-webhook

import { createClient } from "jsr:@supabase/supabase-js@2";

const CLICKPESA_BASE = "https://api.clickpesa.com/third-parties";

async function clickpesaToken(): Promise<string> {
  const res = await fetch(`${CLICKPESA_BASE}/generate-token`, {
    method: "POST",
    headers: {
      "client-id": Deno.env.get("CLICKPESA_CLIENT_ID")!,
      "api-key": Deno.env.get("CLICKPESA_API_KEY")!,
    },
  });
  if (!res.ok) throw new Error(`ClickPesa auth failed: ${res.status}`);
  return (await res.json()).token as string;
}

/** Source of truth: ask ClickPesa directly what this payment's status is */
async function verifyWithClickPesa(orderReference: string) {
  const token = await clickpesaToken();
  const res = await fetch(
    `${CLICKPESA_BASE}/payments/${encodeURIComponent(orderReference)}`,
    { headers: { Authorization: token } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Endpoint may return an array of attempts for the reference
  const p = Array.isArray(data) ? data[0] : data;
  return p ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  try {
    const payload = await req.json();
    const event: string = payload?.event ?? "";
    const orderReference: string | undefined = payload?.data?.orderReference;
    if (!orderReference) return new Response("ok", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up OUR payment record — unknown references are ignored
    const { data: payment } = await admin
      .from("payments")
      .select("id, order_id, user_id, amount, status")
      .eq("order_reference", orderReference)
      .single();
    if (!payment) return new Response("ok", { status: 200 });
    if (payment.status === "SUCCESS") return new Response("ok", { status: 200 }); // idempotent

    if (event === "PAYMENT RECEIVED") {
      // ── Verify against ClickPesa's API, not the payload ──────────────
      const verified = await verifyWithClickPesa(orderReference);
      const verifiedStatus = verified?.status;
      const verifiedAmount = Number(verified?.collectedAmount ?? 0);

      if ((verifiedStatus === "SUCCESS" || verifiedStatus === "SETTLED") &&
          verifiedAmount >= Math.round(Number(payment.amount))) {
        await admin.from("payments").update({
          status: "SUCCESS",
          channel: verified.channel ?? payload?.data?.channel ?? null,
          provider_payment_id: verified.id ?? null,
          updated_at: new Date().toISOString(),
        }).eq("id", payment.id);

        await admin.from("orders").update({
          payment_status: "paid",
          status: "processing", // paid orders move into fulfilment
        }).eq("id", payment.order_id);

        await admin.from("notifications").insert({
          user_id: payment.user_id,
          type: "order",
          title: "Payment confirmed",
          message: `Your payment of TZS ${Number(payment.amount).toLocaleString()} was received. Your order is now being processed.`,
          link: `/buyer?tab=orders`,
        });
      } else {
        console.warn("Webhook claimed PAYMENT RECEIVED but API verification failed", {
          orderReference, verifiedStatus, verifiedAmount, expected: payment.amount,
        });
      }
    } else if (event === "PAYMENT FAILED") {
      await admin.from("payments").update({
        status: "FAILED",
        failure_message: payload?.data?.message ?? "Payment failed",
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      await admin.from("orders").update({ payment_status: "failed" })
        .eq("id", payment.order_id);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("clickpesa-webhook error:", e);
    // Always 200 — ClickPesa retries on non-2xx; our errors shouldn't cause storms
    return new Response("ok", { status: 200 });
  }
});
