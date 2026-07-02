/**
 * ReceiptPage — printable order receipt at /order/:id/receipt
 * Replaces ReceiptModal overlay in BuyerPage.
 * Fetches order + seller data directly so it's URL-shareable
 * and works from any entrypoint (email link, bookmark, etc).
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchOrderReceipt } from '../services/orderApi';
import { ReceiptModal } from '../components/ReceiptModal';
import { Order, VendorProfile } from '../types';
import { useAppState } from '../context/AppContext';

export const ReceiptPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppState();

  // Accept pre-loaded data from navigation state (fast path)
  const [order, setOrder] = useState<Order | null>(location.state?.order ?? null);
  const [seller, setSeller] = useState<VendorProfile | null>(location.state?.seller ?? null);
  const [loading, setLoading] = useState(!location.state?.order);

  useEffect(() => {
    if (order) return;
    if (!id) { navigate(-1); return; }

    // Old code read `vendor_profiles` (owner-only under RLS, so buyers always got
    // an empty seller) and only the FIRST item's seller. fetchOrderReceipt reads
    // the public storefront view and covers every seller in the order.
    fetchOrderReceipt(id).then(receipt => {
      if (!receipt) { navigate(-1); return; }
      setOrder(receipt.order);
      if (receipt.primarySeller) setSeller(receipt.primarySeller);
      setLoading(false);
    });
  }, [id]);

  if (!user) { navigate('/login', { replace: true }); return null; }

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-foreground/8">
        <div className="container mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-foreground/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <span className="text-sm font-bold text-foreground">Order Receipt</span>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-foreground/[0.04] animate-pulse"
                style={{ animationDelay: `${i*80}ms` }} />
            ))}
          </div>
        ) : order ? (
          <ReceiptModal
            isOpen={true}
            order={order}
            seller={seller ?? {} as VendorProfile}
            onClose={() => navigate(-1)}
          />
        ) : null}
      </div>
    </div>
  );
};
