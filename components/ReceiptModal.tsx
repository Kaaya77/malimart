import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Share2, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from './UI';
import { formatTZS } from '../constants';
import { Order, VendorProfile } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  order: Order;
  seller?: VendorProfile;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, order, seller, onClose }) => {
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const subtotal  = order.items?.reduce((a: number, i: any) => a + (i.price_at_purchase * i.quantity), 0) ?? 0;
  const delivery  = order.delivery_fee ?? 0;
  const discount  = order.discount_amount ?? 0;
  const total     = order.total ?? 0;
  const dateStr   = new Date(order.created_at ?? Date.now())
    .toLocaleDateString('en-TZ', { year: 'numeric', month: 'long', day: 'numeric' });
  const orderId   = (order.id ?? '').slice(0, 8).toUpperCase();
  const payMethod = order.payment_method ?? 'Mobile Money';

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const el = document.getElementById('mali-receipt');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, Math.min(h, pdf.internal.pageSize.getHeight()));
      pdf.save(`MaliMart-Receipt-${orderId}.pdf`);
      addToast('Receipt downloaded!', 'success');
    } catch {
      addToast('Could not generate PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const text = `MaliMart Receipt #${orderId}\nTotal: ${formatTZS(total)}\nDate: ${dateStr}\nPaid via: ${payMethod}`;
    if (navigator.share) {
      try { await navigator.share({ title: `MaliMart Receipt #${orderId}`, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      addToast('Receipt info copied!', 'success');
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-smrint:bg-white print:p-0 print:block"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-background rounded-3xl shadow-2xl border border-foreground/8 max-h-[94dvh] flex flex-col print:shadow-none print:rounded-none print:border-none print:max-h-none">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-foreground/8 shrink-0 print:hidden">
          <span className="text-sm font-bold text-foreground">Receipt #{orderId}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-foreground text-background text-xs font-bold hover:bg-foreground/85 transition-colors disabled:opacity-50 active:scale-95"
            >
              {downloading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Generating…</>
                : <><Download className="w-3.5 h-3.5 stroke-[2.5]"/> PDF</>
              }
            </button>
            {[
              { icon: Share2, action: handleShare, label: 'Share' },
              { icon: Printer, action: handlePrint, label: 'Print' },
              { icon: X, action: onClose, label: 'Close' },
            ].map(({ icon: Icon, action, label }) => (
              <button key={label} onClick={action} aria-label={label}
                className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center text-foreground/60 hover:bg-foreground/10 transition-colors active:scale-90">
                <Icon className="w-3.5 h-3.5 stroke-[2]"/>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable receipt body */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div id="mali-receipt" className="bg-white text-gray-900 font-sans">

            {/* Brand header */}
            <div className="bg-gray-950 px-8 py-7 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-black">M</span>
                </div>
                <div>
                  <p className="text-white font-black text-lg tracking-tight leading-none">MaliMart</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Tanzania's Marketplace</p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full mb-1">
                  <CheckCircle2 className="w-3 h-3"/> Confirmed
                </div>
                <p className="text-gray-500 text-[10px]">{dateStr}</p>
              </div>
            </div>

            {/* Order ID + Total */}
            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-1">Order Number</p>
                <p className="font-black text-xl text-gray-900 font-mono">#{orderId}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-1">Total Paid</p>
                <p className="font-black text-xl text-emerald-600">{formatTZS(total)}</p>
              </div>
            </div>

            {/* From / To */}
            <div className="px-8 py-5 grid grid-cols-2 gap-4 border-b border-gray-100">
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-2">From</p>
                <p className="font-bold text-sm text-gray-800">{seller?.store_name || 'MaliMart Seller'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{seller?.region || 'Tanzania'}</p>
                {seller?.contact_phone && <p className="text-xs text-gray-400 mt-0.5">{seller.contact_phone}</p>}
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-2">To</p>
                <p className="font-bold text-sm text-gray-800">{order.buyer?.full_name || 'Customer'}</p>
                {order.shipping_address?.street && <p className="text-xs text-gray-500 mt-0.5">{order.shipping_address.street}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{order.shipping_address?.city || 'Tanzania'}</p>
              </div>
            </div>

            {/* Line items */}
            <div className="px-8 py-5 border-b border-gray-100">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-4">Items Purchased</p>
              <div className="space-y-3.5">
                {order.items?.map((item: any, i: number) => {
                  const img = item.products?.images?.[0] || item.image_url;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      {img && <img src={img} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" decoding="async"/>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{item.products?.name || item.name}</p>
                        <p className="text-xs text-gray-400">Qty {item.quantity} × {formatTZS(item.price_at_purchase)}</p>
                      </div>
                      <p className="font-bold text-sm text-gray-900 shrink-0">{formatTZS(item.price_at_purchase * item.quantity)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            <div className="px-8 py-5 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span className="font-semibold text-gray-700">{formatTZS(subtotal)}</span>
              </div>
              {delivery > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Delivery fee</span><span className="font-semibold text-gray-700">{formatTZS(delivery)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm font-semibold text-emerald-600">
                  <span>Discount</span><span>−{formatTZS(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-gray-900">
                <div>
                  <p className="font-black text-base text-gray-900">Total Paid</p>
                  <p className="text-xs text-gray-400">{payMethod}</p>
                </div>
                <p className="text-2xl font-black text-gray-900">{formatTZS(total)}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-gray-50 text-center">
              <p className="text-xs font-semibold text-gray-500">Thank you for shopping with MaliMart</p>
              <p className="text-[10px] text-gray-400 mt-1">support@malimart.tz · malimart.vercel.app</p>
              <div className="flex justify-center gap-1 mt-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: i % 2 === 0 ? '#10b981' : '#e5e7eb'}}/>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};
