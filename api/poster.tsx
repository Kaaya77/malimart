/**
 * POST /api/poster
 *
 * Renders the 1080×1350 "share as poster" image server-side via @vercel/og
 * (Satori) and returns it as a PNG. This replaces the old client-side
 * html2canvas capture, which repeatedly produced garbled/overlapping output:
 * html2canvas mis-lays-out elements that sit under a CSS-transformed ancestor
 * (the modal's framer-motion animation + the scale(0.25) preview wrapper) and
 * is generally unreliable with flexbox + fixed heights + fonts. Satori renders
 * the exact same layout deterministically, exactly like /api/og already does
 * for link-preview cards.
 *
 * The client passes the fields it already has (product data + a QR data URL it
 * generates locally), so this endpoint needs no DB access and no server-side
 * QR library — it is a pure layout → PNG function.
 */
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

interface PosterBody {
  img?: string;          // product image URL (Satori fetches server-side)
  name?: string;
  brand?: string;
  price?: string;        // pre-formatted, e.g. "TZS 45,000"
  salePrice?: string | null;
  sellerName?: string;
  verified?: boolean;
  rating?: number | null;
  reviewCount?: number;
  qr?: string;           // data: URL PNG generated client-side
  shortUrl?: string;
}

const cream = '#faf9f6', ink = '#1c1917', emerald = '#059669', muted = '#8a8580';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Only same-origin browser POSTs (this spends Satori render time).
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  if (origin && origin !== url.origin) return new Response('Forbidden', { status: 403 });

  let b: PosterBody;
  try { b = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }

  const name = (b.name || 'Product').slice(0, 120);
  const brand = b.brand ? String(b.brand).slice(0, 40) : '';
  const sellerName = (b.sellerName || 'MaliMart Seller').slice(0, 60);
  const price = b.price || '';
  const salePrice = b.salePrice || null;
  const rating = typeof b.rating === 'number' ? b.rating : null;
  const reviewCount = b.reviewCount || 0;
  const shortUrl = (b.shortUrl || '').slice(0, 80);
  const img = b.img;
  const qr = b.qr;
  const verified = !!b.verified;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: cream, color: ink, fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', padding: 64, position: 'relative' }}>
        {/* Kitenge accent strip */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14, display: 'flex', background: 'repeating-linear-gradient(-45deg,#059669 0 28px,#f59e0b 28px 42px,#0c4a6e 42px 70px,#f59e0b 70px 84px)' }} />

        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: emerald, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900 }}>M</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, fontWeight: 800, display: 'flex' }}>MaliMart</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 4.5, color: emerald, display: 'flex' }}>MARKETPLACE</div>
          </div>
        </div>

        {/* Product image */}
        <div style={{ width: '100%', height: 620, borderRadius: 32, overflow: 'hidden', background: '#ece9e2', display: 'flex', position: 'relative' }}>
          {img && <img src={img} width={952} height={620} style={{ width: 952, height: 620, objectFit: 'cover' }} />}
          {salePrice && (
            <div style={{ position: 'absolute', top: 24, left: 24, background: '#ef4444', color: '#fff', fontSize: 22, fontWeight: 800, padding: '10px 20px', borderRadius: 999, display: 'flex' }}>SALE</div>
          )}
        </div>

        {/* Info */}
        <div style={{ marginTop: 40, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {brand && <div style={{ fontSize: 22, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, display: 'flex' }}>{brand}</div>}
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, maxHeight: 180, overflow: 'hidden', display: 'flex' }}>{name}</div>

          {/* Price + rating — bottom-aligned to match the preview */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: emerald, color: '#fff', padding: '14px 28px', borderRadius: 18, fontSize: 46, fontWeight: 900 }}>{salePrice || price}</div>
              {salePrice && <div style={{ fontSize: 28, color: muted, textDecoration: 'line-through', display: 'flex' }}>{price}</div>}
            </div>
            {rating != null && rating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 700 }}>
                {/* lucide Star (filled) — matches the preview icon */}
                <svg width={30} height={30} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'flex' }}>
                  <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.878L2.16 9.795a.53.53 0 0 1 .294-.904l5.166-.756a2.122 2.122 0 0 0 1.593-1.16z" />
                </svg>
                <span style={{ display: 'flex' }}>{rating.toFixed(1)}</span>
                {reviewCount > 0 && <span style={{ color: muted, fontSize: 22, fontWeight: 600, display: 'flex' }}>({reviewCount})</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, fontSize: 26, fontWeight: 700, color: '#57534e' }}>
            <span style={{ display: 'flex' }}>by {sellerName}</span>
            {verified && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb' }}>
                {/* lucide ShieldCheck — matches the preview icon */}
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'flex' }}>
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span style={{ display: 'flex' }}>Verified</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer: QR + scan-to-shop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, paddingTop: 36, borderTop: '2px solid rgba(28,25,23,0.08)' }}>
          <div style={{ width: 140, height: 140, borderRadius: 20, background: '#fff', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
            {qr && <img src={qr} width={112} height={112} style={{ width: 112, height: 112 }} />}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, fontWeight: 800, display: 'flex' }}>Scan to shop</div>
            <div style={{ fontSize: 22, color: muted, fontWeight: 600, marginTop: 6, display: 'flex' }}>{shortUrl}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { 'cache-control': 'no-store' } }
  );
}
