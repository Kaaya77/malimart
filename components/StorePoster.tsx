import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Loader2, Check } from 'lucide-react';
import { useToast } from './UI';
import { VendorProfile } from '../types';

interface StorePosterProps {
  vendor: VendorProfile;
  storeUrl: string;
  productCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Store "business card" poster — a shareable 1080×1350 PNG with the store logo,
 * name, verified badge, location and a QR to the storefront. Rendered
 * server-side by /api/poster (kind:'store'), the same Satori renderer used for
 * product posters. The blob is pre-generated once the QR is ready so the Share
 * button can fire synchronously (iOS Web Share activation requirement).
 */
export const StorePoster: React.FC<StorePosterProps> = ({ vendor, storeUrl, productCount, isOpen, onClose }) => {
  const { addToast } = useToast();
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const shortUrl = storeUrl.replace(/^https?:\/\//, '');
  const location = [vendor.district, vendor.region].filter(Boolean).join(', ');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const data = await QRCode.toDataURL(storeUrl, { margin: 0, width: 320, errorCorrectionLevel: 'M', color: { dark: '#1c1917', light: '#ffffff' } });
        if (!cancelled) setQr(data);
      } catch { /* QR optional */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, storeUrl]);

  const render = async (): Promise<Blob> => {
    const res = await fetch('/api/poster', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'store',
        img: vendor.logo_url || vendor.banner_url,
        name: vendor.store_name || 'MaliMart store',
        tagline: vendor.description || '',
        verified: !!vendor.is_verified,
        productCount: productCount || 0,
        location,
        qr,
        shortUrl,
      }),
    });
    if (!res.ok) throw new Error(`store poster render failed: ${res.status}`);
    return await res.blob();
  };

  const getPoster = async () => (blobRef.current ??= await render());

  // Eagerly render once the QR is ready (keeps Share within the tap activation).
  useEffect(() => {
    if (!isOpen || !qr) return;
    blobRef.current = null;
    let cancelled = false;
    render().then(b => { if (!cancelled) blobRef.current = b; }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qr]);

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `malimart-store-${(vendor.store_name || 'store').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.png`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      triggerDownload(await getPoster());
      setDone(true); setTimeout(() => setDone(false), 2500);
      addToast('Store card downloaded', 'success');
    } catch { addToast('Could not create store card', 'error'); }
    finally { setBusy(false); }
  };

  const handleShare = async () => {
    const cached = blobRef.current;
    if (cached && navigator.canShare && navigator.share) {
      const file = new File([cached], `malimart-store.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: vendor.store_name }); }
        catch (e: any) { if (e?.name !== 'AbortError') addToast('Sharing was cancelled', 'info'); }
        return;
      }
    }
    setBusy(true);
    try {
      const blob = await getPoster();
      const file = new File([blob], `malimart-store.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: vendor.store_name });
      } else {
        triggerDownload(blob);
        addToast('Sharing images isn’t supported here — card downloaded instead', 'info');
      }
    } catch (e: any) { if (e?.name !== 'AbortError') addToast('Could not share the store card', 'error'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[320] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          className="w-full max-w-md bg-background rounded-t-3xl md:rounded-3xl shadow-2xl border border-foreground/8 overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 rounded-full bg-foreground/15" /></div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
            <p className="font-bold text-foreground text-sm">Share store card</p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-foreground/[0.06] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors">
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Simple preview */}
          <div className="px-5 pt-5 flex justify-center">
            <div className="w-[220px] rounded-2xl border border-foreground/10 bg-[#0a0a0b] text-white p-6 flex flex-col items-center shadow-lg">
              <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white/5 flex items-center justify-center mb-3">
                {vendor.logo_url || vendor.banner_url
                  ? <img src={vendor.logo_url || vendor.banner_url} className="w-full h-full object-cover" alt="" />
                  : <span className="text-3xl font-black text-emerald-400">{(vendor.store_name || 'S').charAt(0).toUpperCase()}</span>}
              </div>
              <p className="text-sm font-bold text-center leading-tight">{vendor.store_name}</p>
              {vendor.is_verified && <p className="text-[10px] text-emerald-400 font-semibold mt-1">✓ Verified seller</p>}
              {location && <p className="text-[10px] text-white/45 mt-1">📍 {location}</p>}
              <div className="mt-3 w-14 h-14 rounded-lg bg-white p-1">{qr && <img src={qr} className="w-full h-full" alt="QR" />}</div>
              <p className="text-[8px] text-white/40 mt-1.5 break-all text-center">{shortUrl}</p>
            </div>
          </div>

          <div className="p-5 grid grid-cols-2 gap-3">
            <button onClick={handleDownload} disabled={busy}
              className="h-12 rounded-2xl border border-foreground/12 bg-foreground/[0.04] text-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-foreground/[0.07] active:scale-[0.98] transition-all disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Download className="w-4 h-4 stroke-[2.2]" />}
              {done ? 'Saved' : 'Download'}
            </button>
            <button onClick={handleShare} disabled={busy}
              className="h-12 rounded-2xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-emerald-600/20">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4 stroke-[2.2]" />}
              Share card
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
