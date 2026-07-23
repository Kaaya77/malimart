import React, { useEffect, useState } from 'react';
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
 * (clean-premium look + QR code). The QR is generated client-side; the final
 * 1080×1350 PNG is rendered SERVER-SIDE by /api/poster (@vercel/og / Satori),
 * the same deterministic renderer behind the /api/og link-preview cards. This
 * replaced client-side html2canvas, which produced garbled/overlapping output.
 *
 * For places that DON'T unfurl links (Instagram, Stories/Status, print), this
 * gives sellers a polished image. Link-preview cards (WhatsApp/FB/X) are handled
 * separately by the /api/og Open Graph image.
 */
export const SharePoster: React.FC<SharePosterProps> = ({ product, isOpen, onClose }) => {
  const { addToast } = useToast();
  const [qr, setQr] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Pre-rendered poster PNG, cached once generated. Eagerly built when the QR is
  // ready so the Share button can call navigator.share() SYNCHRONOUSLY on tap —
  // iOS/Safari revokes the transient user-activation the moment you `await`
  // anything before share(), which was making "Share image" silently fail while
  // Download (no activation needed) worked.
  const posterBlobRef = React.useRef<Blob | null>(null);
  const [posterReady, setPosterReady] = useState(false);

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
          color: { dark: '#1c1917', light: '#ffffff' },
        });
        if (!cancelled) setQr(data);
      } catch { /* QR is optional */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, productUrl]);

  // Render the poster SERVER-SIDE via /api/poster (@vercel/og / Satori) — the
  // same deterministic renderer that produces the link-preview cards. This
  // replaces client-side html2canvas, which repeatedly produced garbled,
  // overlapping output because it mis-lays-out any element under a
  // CSS-transformed ancestor (the modal's framer-motion animation + the
  // scale(0.25) preview wrapper). The server just needs the fields the client
  // already has, including the locally-generated QR.
  const capture = async (): Promise<Blob> => {
    const res = await fetch('/api/poster', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        img,
        name: product.name,
        brand: (product as any).brand,
        price: formatTZS(product.price),
        salePrice: product.sale_price && product.sale_price < product.price ? formatTZS(product.sale_price) : null,
        sellerName,
        verified: !!verified,
        rating,
        reviewCount: (product as any).review_count || 0,
        qr,
        shortUrl,
      }),
    });
    if (!res.ok) throw new Error(`poster render failed: ${res.status}`);
    return await res.blob();
  };

  /** Return the cached poster, rendering it once on demand. */
  const getPoster = async (): Promise<Blob> => {
    if (posterBlobRef.current) return posterBlobRef.current;
    const blob = await capture();
    posterBlobRef.current = blob;
    setPosterReady(true);
    return blob;
  };

  // Eagerly render the poster as soon as the QR is ready, so Share can fire
  // without an intervening await (see posterBlobRef note above).
  useEffect(() => {
    if (!isOpen || !qr) return;
    posterBlobRef.current = null;
    setPosterReady(false);
    let cancelled = false;
    capture()
      .then(blob => { if (!cancelled) { posterBlobRef.current = blob; setPosterReady(true); } })
      .catch(() => { /* generated on demand instead */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, qr]);

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `malimart-${product.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.png`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      triggerDownload(await getPoster());
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
    const cached = posterBlobRef.current;
    const canShareFiles = !!navigator.canShare && !!navigator.share;

    // Fast path: poster already rendered → share synchronously, preserving the
    // tap's user-activation (the iOS/Safari requirement that a pre-share await
    // would have broken).
    if (cached && canShareFiles) {
      const file = new File([cached], `malimart-${product.id}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: product.name, text: `${product.name} — ${formatTZS(product.price)} on MaliMart` });
        } catch (e: any) {
          if (e?.name !== 'AbortError') addToast('Sharing was cancelled', 'info');
        }
        return;
      }
    }

    // Slow path: poster not ready yet, or file-sharing unsupported.
    setBusy(true);
    try {
      const blob = await getPoster();
      const file = new File([blob], `malimart-${product.id}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: product.name, text: `${product.name} — ${formatTZS(product.price)} on MaliMart` });
      } else {
        triggerDownload(blob);
        addToast('Sharing images isn’t supported on this device — poster downloaded instead', 'info');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') addToast('Could not share the poster', 'error');
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

          {/* Scaled preview of the poster (React render of the same design the
              server draws) — purely a visual approximation. The actual
              downloaded/shared PNG is rendered server-side by /api/poster, so
              this preview no longer needs to be pixel-identical or captured. */}
          <div className="px-5 pt-5 flex justify-center">
            <div className="overflow-hidden rounded-2xl shadow-lg border border-foreground/10" style={{ width: 270, height: 337.5 }}>
              <div style={{ transform: 'scale(0.25)', transformOrigin: 'top left' }}>
                <PosterCanvas
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

// ── On-screen preview approximation of the 1080×1350 poster (the real PNG is
//    rendered by /api/poster). Kept in sync with that endpoint's layout. ───────
const PosterCanvas = ({
  img, name, brand, price, salePrice, sellerName, verified, rating, reviewCount, qr, shortUrl,
}: {
  img?: string; name: string; brand?: string; price: string; salePrice: string | null;
  sellerName: string; verified: boolean; rating: number | null; reviewCount: number;
  qr: string; shortUrl: string;
}) => (
  <div
    style={{
      width: 1080, height: 1350, background: '#0a0a0b', color: '#fafafa',
      fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', display: 'flex',
      flexDirection: 'column', padding: 72, boxSizing: 'border-box',
    }}
  >
    {/* Thin neutral accent sweep */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 10,
      background: 'linear-gradient(90deg,#059669 0%,#10b981 45%,#0d9488 100%)',
    }} />

    {/* Header: brand */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: '#10b981', color: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 900 }}>M</div>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fafafa' }}>MaliMart</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.28em', color: '#10b981' }}>MARKETPLACE</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 999, padding: '9px 20px' }}>
        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.18em', color: '#10b981' }}>SCAN &amp; SHOP</span>
      </div>
    </div>

    {/* Spotlight — product floated in a glowing rounded card */}
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', height: 600, borderRadius: 40, overflow: 'hidden', background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 110px rgba(16,185,129,0.22)', position: 'relative' }}>
        {img && <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {salePrice && (
          <div style={{ position: 'absolute', top: 24, left: 24, background: '#ef4444', color: '#fff', fontSize: 22, fontWeight: 800, padding: '10px 20px', borderRadius: 999 }}>SALE</div>
        )}
      </div>
    </div>

    {/* Info */}
    <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column' }}>
      {brand && <div style={{ fontSize: 22, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>{brand}</div>}
      <div style={{ fontSize: 56, fontWeight: 800, color: '#fafafa', lineHeight: 1.1, maxHeight: 130, overflow: 'hidden' }}>{name}</div>

      {/* Price pill + rating */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#10b981', color: '#05271c', padding: '16px 34px', borderRadius: 999, boxShadow: '0 14px 44px rgba(16,185,129,0.38)' }}>
            <span style={{ fontSize: 48, fontWeight: 900 }}>{salePrice || price}</span>
          </div>
          {salePrice && <span style={{ fontSize: 28, color: '#a1a1aa', textDecoration: 'line-through' }}>{price}</span>}
        </div>
        {rating != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 700, color: '#fafafa' }}>
            <Star style={{ width: 30, height: 30, fill: '#fbbf24', color: '#fbbf24' }} />
            {rating.toFixed(1)}
            {reviewCount > 0 && <span style={{ color: '#a1a1aa', fontSize: 22, fontWeight: 600 }}>({reviewCount})</span>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26, fontSize: 26, fontWeight: 700, color: '#a1a1aa' }}>
        <span>by {sellerName}</span>
        {verified && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34d399' }}>
            <ShieldCheck style={{ width: 26, height: 26 }} /> Verified
          </span>
        )}
      </div>
    </div>

    {/* Footer: QR + scan-to-shop */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 40, paddingTop: 36, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
      <div style={{ width: 132, height: 132, borderRadius: 20, background: '#fff', padding: 14, boxSizing: 'border-box', flexShrink: 0, boxShadow: '0 10px 34px rgba(0,0,0,0.5)' }}>
        {qr && <img src={qr} style={{ width: '100%', height: '100%' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#fafafa' }}>Scan to shop</div>
        <div style={{ fontSize: 22, color: '#a1a1aa', fontWeight: 600, marginTop: 6, wordBreak: 'break-all' }}>{shortUrl}</div>
      </div>
    </div>
  </div>
);
