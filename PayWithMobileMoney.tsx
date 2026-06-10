/**
 * PayWithMobileMoney — self-contained ClickPesa USSD-PUSH payment flow.
 *
 * Drop into the checkout success step or order detail view:
 *   <PayWithMobileMoney orderId={order.id} amount={order.total}
 *     onPaid={() => ...} onFailed={() => ...} />
 *
 * Flow: enter phone → USSD prompt fires on their handset → user enters
 * PIN → webhook confirms server-side → this component sees SUCCESS.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { initiateMobileMoneyPayment, waitForPayment, PaymentStatus } from '../services/clickpesaService';
import { formatTZS } from '../constants';

type Phase = 'input' | 'pushing' | 'waiting' | 'success' | 'failed' | 'timeout';

export const PayWithMobileMoney: React.FC<{
  orderId: string;
  amount: number;
  onPaid?: () => void;
  onFailed?: () => void;
}> = ({ orderId, amount, onPaid, onFailed }) => {
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [message, setMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const validPhone = /^(0|255|\+255)?[67]\d{8}$/.test(phone.replace(/\s/g, ''));

  const start = async () => {
    setPhase('pushing');
    setMessage('');
    const res = await initiateMobileMoneyPayment(orderId, phone.replace(/\s/g, ''));
    if (!mounted.current) return;

    if (res.error || !res.orderReference) {
      setPhase('failed');
      setMessage(res.error || 'Could not start the payment');
      onFailed?.();
      return;
    }

    setPhase('waiting');
    const final: PaymentStatus = await waitForPayment(
      res.orderReference,
      (_s, secs) => mounted.current && setElapsed(secs),
    );
    if (!mounted.current) return;

    if (final === 'SUCCESS' || final === 'SETTLED') { setPhase('success'); onPaid?.(); }
    else if (final === 'FAILED') { setPhase('failed'); setMessage('The payment was declined or cancelled'); onFailed?.(); }
    else { setPhase('timeout'); }
  };

  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Pay with Mobile Money</p>
          <p className="text-xs text-foreground/50">M-Pesa · Tigo Pesa · Airtel Money · HaloPesa</p>
        </div>
        <span className="ml-auto text-sm font-black text-emerald-600">{formatTZS(amount)}</span>
      </div>

      {phase === 'input' && (
        <>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className="w-full h-12 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-medium text-foreground placeholder:text-foreground/30 outline-none focus:border-emerald-500/40 transition-all"
          />
          <button
            onClick={start}
            disabled={!validPhone}
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            Send payment request
          </button>
          <p className="text-[11px] text-foreground/40 text-center">
            A PIN prompt will appear on this number. No charges until you confirm.
          </p>
        </>
      )}

      {(phase === 'pushing' || phase === 'waiting') && (
        <div className="flex flex-col items-center py-4 gap-3 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-semibold text-foreground">
            {phase === 'pushing' ? 'Sending request…' : 'Check your phone'}
          </p>
          {phase === 'waiting' && (
            <p className="text-xs text-foreground/50 max-w-[260px]">
              Enter your mobile money PIN on the prompt sent to {phone}. Waiting for confirmation… {elapsed}s
            </p>
          )}
        </div>
      )}

      {phase === 'success' && (
        <div className="flex flex-col items-center py-4 gap-2 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          <p className="text-sm font-bold text-foreground">Payment confirmed</p>
          <p className="text-xs text-foreground/50">Your order is now being processed.</p>
        </div>
      )}

      {(phase === 'failed' || phase === 'timeout') && (
        <div className="flex flex-col items-center py-4 gap-3 text-center">
          <XCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm font-bold text-foreground">
            {phase === 'timeout' ? "We haven't received confirmation yet" : 'Payment not completed'}
          </p>
          {message && <p className="text-xs text-foreground/50">{message}</p>}
          {phase === 'timeout' && (
            <p className="text-xs text-foreground/50 max-w-[280px]">
              If you entered your PIN, the confirmation may still arrive — check your orders in a few minutes before retrying.
            </p>
          )}
          <button
            onClick={() => { setPhase('input'); setMessage(''); }}
            className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}
    </div>
  );
};
