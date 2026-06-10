/**
 * ClickPesa payment service (client side)
 *
 * The client NEVER touches ClickPesa directly and NEVER sends an amount.
 * It asks our Edge Function to initiate (server reads the amount from the
 * order row), then watches the payments table — which only the webhook
 * (service role) can flip to SUCCESS.
 */
import { supabase } from './supabaseClient';

export interface InitiateResult {
  success?: boolean;
  orderReference?: string;
  status?: string;
  message?: string;
  error?: string;
}

export async function initiateMobileMoneyPayment(
  orderId: string,
  phoneNumber: string,
): Promise<InitiateResult> {
  try {
    const { data, error } = await supabase.functions.invoke('clickpesa-payment', {
      body: { orderId, phoneNumber },
    });
    if (error) return { error: error.message || 'Payment initiation failed' };
    return data as InitiateResult;
  } catch (e: any) {
    return { error: e?.message || 'Network error — please try again' };
  }
}

export type PaymentStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SETTLED' | 'UNKNOWN';

/** Read current status from our payments table (RLS: user sees own rows). */
export async function getPaymentStatus(orderReference: string): Promise<PaymentStatus> {
  const { data } = await supabase
    .from('payments')
    .select('status')
    .eq('order_reference', orderReference)
    .single();
  return (data?.status as PaymentStatus) ?? 'UNKNOWN';
}

/**
 * Poll until the webhook resolves the payment or we time out.
 * Mobile money confirmation typically lands within 5–60 seconds.
 */
export async function waitForPayment(
  orderReference: string,
  onTick?: (status: PaymentStatus, secondsElapsed: number) => void,
  timeoutMs = 120_000,
  intervalMs = 4_000,
): Promise<PaymentStatus> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getPaymentStatus(orderReference);
    onTick?.(status, Math.round((Date.now() - start) / 1000));
    if (status === 'SUCCESS' || status === 'SETTLED' || status === 'FAILED') return status;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return 'PROCESSING'; // still pending — UI should tell the user to check orders later
}
