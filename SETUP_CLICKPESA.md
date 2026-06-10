# ClickPesa Integration — Setup Guide

Everything below the line is a one-time setup. Code is already in the repo.

## Architecture (why it's built this way)

```
Buyer's phone ──USSD PIN──▶ ClickPesa ──webhook──▶ clickpesa-webhook (Edge Fn)
                               ▲                        │ re-verifies via API
React client ──orderId+phone──▶ clickpesa-payment       ▼
              (NEVER amount)    (Edge Fn, reads      payments + orders tables
                                amount from DB)      (only webhook can mark paid)
```

- Secrets live ONLY in Edge Function secrets — never in the repo, client, or chat
- The client cannot set the amount (read from the orders table server-side)
- A forged webhook cannot mark an order paid — the webhook re-queries
  ClickPesa's API with our credentials before trusting anything

---

## 1. ClickPesa dashboard (merchant.clickpesa.com)

1. Settings → Developers → create an **API application**
2. Enable the **COLLECTION API** feature on the application
3. Copy the **Client ID** and **API Key** (do NOT paste them anywhere except step 2 below)
4. Application Webhooks → add for BOTH `PAYMENT RECEIVED` and `PAYMENT FAILED`:
   `https://ubpapxdmqlepynonhaeo.functions.supabase.co/clickpesa-webhook`

## 2. Supabase secrets (dashboard → Edge Functions → Secrets, or CLI)

```bash
supabase secrets set CLICKPESA_CLIENT_ID=<your client id>
supabase secrets set CLICKPESA_API_KEY=<your api key>
```
(SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

## 3. Apply the migration

SQL Editor → run `supabase/migrations/20260611000000_clickpesa_payments.sql`
(creates the `payments` table + `orders.payment_status`).

## 4. Deploy the functions

```bash
supabase functions deploy clickpesa-payment
supabase functions deploy clickpesa-webhook --no-verify-jwt
```
(`--no-verify-jwt` because ClickPesa can't send Supabase JWTs — the function
does its own verification by re-querying ClickPesa's API.)

## 5. Wire the UI

Render where payment should happen (checkout success step / unpaid order view):

```tsx
import { PayWithMobileMoney } from '../components/PayWithMobileMoney';

<PayWithMobileMoney
  orderId={order.id}
  amount={order.total}
  onPaid={() => addToast('Payment received!', 'success')}
/>
```

## 6. Test before going live

1. Place a real order for a small amount (e.g. TZS 1,000)
2. Pay it with your own phone — confirm the USSD prompt arrives
3. Verify: `payments` row flips to SUCCESS, order `payment_status` = 'paid',
   buyer gets the in-app notification
4. Test a declined payment (cancel the prompt) — order should show 'failed'

## Statuses

| payments.status | orders.payment_status | Meaning                          |
|-----------------|----------------------|----------------------------------|
| PROCESSING      | processing           | USSD sent, awaiting PIN          |
| SUCCESS/SETTLED | paid                 | Verified by ClickPesa API        |
| FAILED          | failed               | Declined / cancelled / timed out |
