import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2, Loader2, Check, ShieldCheck, Star } from 'lucide-react';
import { useToast } from './UI';
import { Product } from '../types';
import { formatTZS } from '../constants';

interface SharePosterProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SharePoster — generates a beautiful, downloadable/shareable product poster
 * (clean-premium look + QR code) entirely client-side via html2canvas.
 *
 * For places that DON'T unfurl links (Instagram, Stories/Status, print), this
 * gives sellers a polished image. Link-preview cards (WhatsApp/FB/X) are handled
 * separately by the /api/og Open Graph image.
 */
export const SharePoster: React.FC<SharePosterProps> = ({ product, isOpen, onClose }) => {
  const { addToast } = useToast();
  const posterRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const productUrl = `${window.location.origin}/product/${slugify(product.name) ? `${slugify(product.name)}-` : ''}${product.id}`;
  const shortUrl = productUrl.replace(/^https?:\/\//, '');
  const img = product.images?.[0];
  const sellerName = (product as any).seller_name || (product as any).store_name || 'MaliMart Seller';
  const verified = (product as any).seller_verified ?? (product as any).is_verified ?? false;
  const rating = typeof product.rating === 'number' ? product.rating : null;

  // Generate the QR (dark on transparent — sits on a white chip)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const data = await QRCode.toDataURL(productUrl, {
          margin: 0,
          width: 320,
          errorCorrectionLevel: 'M',
          color: { dark: '#1c1917', light: '#00000000' },
        });
        if (!cancelled) setQr(data);
      } catch { /* QR is optional */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, productUrl]);

  const capture = async (): Promise<Blob | null> => {
    const el = posterRef.current;
    if (!el) return null;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#faf9f6',
      useCORS: true,
      logging: false,
    });
    return await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.95));
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await capture();
      if (!blob) throw new Error('capture failed');
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `malimart-${product.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.png`,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      addToast('Poster downloaded', 'success');
    } catch {
      addToast('Could not create poster', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleShareImage = async () => {
    setBusy(true);
    try {
      const blob = await capture();
      if (!blob) throw new Error('capture failed');
      const file = new File([blob], `malimart-${product.id}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: product.name,
          text: `${product.name} — ${formatTZS(product.price)} on MaliMart`,
        });
      } else {
        await handleDownload();
        addToast('Sharing not supported here — poster downloaded instead', 'info');
      }
    } catch {
      /* user cancelled share — no error toast */
    } finally {
      setBusy(false);
    }
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
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-foreground/15" />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
            <p className="font-bold text-foreground text-sm">Share as poster</p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-foreground/[0.06] flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors">
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Scaled preview of the poster */}
          <div className="px-5 pt-5 flex justify-center">
            <div className="overflow-hidden rounded-2xl shadow-lg border border-foreground/10" style={{ width: 270, height: 337.5 }}>
              <div style={{ transform: 'scale(0.25)', transformOrigin: 'top left' }}>
                <PosterCanvas
                  innerRef={posterRef}
                  img={img}
                  name={product.name}
                  brand={(product as any).brand}
                  price={formatTZS(product.price)}
                  salePrice={product.sale_price && product.sale_price < product.price ? formatTZS(product.sale_price) : null}
                  sellerName={sellerName}
                  verified={!!verified}
                  rating={rating}
                  reviewCount={(product as any).review_count || 0}
                  qr={qr}
                  shortUrl={shortUrl}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 grid grid-cols-2 gap-3">
            <button
              onClick={handleDownload}
              disabled={busy}
              className="h-12 rounded-2xl border border-foreground/12 bg-foreground/[0.04] text-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-foreground/[0.07] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Download className="w-4 h-4 stroke-[2.2]" />}
              {done ? 'Saved' : 'Download'}
            </button>
            <button
              onClick={handleShareImage}
              disabled={busy}
              className="h-12 rounded-2xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-emerald-600/20"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4 stroke-[2.2]" />}
              Share image
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// ── The actual poster (1080×1350), rendered off-layout and captured ──────────────
const PosterCanvas = ({
  innerRef, img, name, brand, price, salePrice, sellerName, verified, rating, reviewCount, qr, shortUrl,
}: {
  innerRef: React.Ref<HTMLDivElement>;
  img?: string; name: string; brand?: string; price: string; salePrice: string | null;
  sellerName: string; verified: boolean; rating: number | null; reviewCount: number;
  qr: string; shortUrl: string;
}) => (
  <div
    ref={innerRef}
    style={{
      width: 1080, height: 1350, background: '#faf9f6', color: '#1c1917',
      fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', display: 'flex',
      flexDirection: 'column', padding: 64, boxSizing: 'border-box',
    }}
  >
    {/* Kitenge accent strip */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 14,
      background: 'repeating-linear-gradient(-45deg,#059669 0 28px,#f59e0b 28px 42px,#0c4a6e 42px 70px,#f59e0b 70px 84px)',
    }} />

    {/* Brand row */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900 }}>M</div>
      <div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>MaliMart</div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.28em', color: '#059669' }}>MARKETPLACE</div>
      </div>
    </div>

    {/* Product image */}
    <div style={{ width: '100%', height: 620, borderRadius: 32, overflow: 'hidden', background: '#ece9e2', flexShrink: 0, position: 'relative' }}>
      {img && <img src={img} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {salePrice && (
        <div style={{ position: 'absolute', top: 24, left: 24, background: '#ef4444', color: '#fff', fontSize: 22, fontWeight: 800, padding: '10px 20px', borderRadius: 999 }}>SALE</div>
      )}
    </div>

    {/* Info */}
    <div style={{ marginTop: 40, flex: 1, display: 'flex', flexDirection: 'column' }}>
      {brand && <div style={{ fontSize: 22, fontWeight: 700, color: '#8a8580', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{brand}</div>}
      <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', maxHeight: 168, overflow: 'hidden' }}>{name}</div>

      {/* Price + seller */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 14, background: '#059669', color: '#fff', padding: '14px 28px', borderRadius: 18 }}>
            <span style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-0.02em' }}>{salePrice || price}</span>
          </div>
          {salePrice && <span style={{ fontSize: 28, color: '#8a8580', textDecoration: 'line-through', marginLeft: 18 }}>{price}</span>}
        </div>
        {rating != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 700 }}>
            <Star style={{ width: 30, height: 30, fill: '#f59e0b', color: '#f59e0b' }} />
            {rating.toFixed(1)}
            {reviewCount > 0 && <span style={{ color: '#8a8580', fontSize: 22, fontWeight: 600 }}>({reviewCount})</span>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, fontSize: 26, fontWeight: 700, color: '#57534e' }}>
        <span>by {sellerName}</span>
        {verified && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb' }}>
            <ShieldCheck style={{ width: 26, height: 26 }} /> Verified
          </span>
        )}
      </div>
    </div>

    {/* Footer: QR + scan-to-shop */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 36, borderTop: '2px solid rgba(28,25,23,0.08)' }}>
      <div style={{ width: 140, height: 140, borderRadius: 20, background: '#fff', padding: 14, boxSizing: 'border-box', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
        {qr && <img src={qr} style={{ width: '100%', height: '100%' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.01em' }}>Scan to shop</div>
        <div style={{ fontSize: 22, color: '#8a8580', fontWeight: 600, marginTop: 6, wordBreak: 'break-all' }}>{shortUrl}</div>
      </div>
    </div>
  </div>
);
