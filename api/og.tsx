/**
 * GET /api/og?id=<productId>
 *
 * Renders a beautiful 1200×630 Open Graph poster for a product, used as the
 * og:image / twitter:image so links unfurl as a branded card in WhatsApp,
 * Facebook, X, Telegram, iMessage, etc.
 *
 * Runs on the Edge runtime via @vercel/og (Satori).
 */
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const tzs = (n: number) => 'TZS ' + Math.round(n || 0).toLocaleString('en-US');

async function fetchProduct(id: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=name,price,sale_price,images,brand,rating,review_count,seller_id&limit=1`;
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return null;
  const rows = await res.json();
  const p = Array.isArray(rows) ? rows[0] : null;
  if (!p) return null;

  let seller: any = null;
  if (p.seller_id) {
    const sres = await fetch(
      `${SUPABASE_URL}/rest/v1/vendor_profiles?seller_id=eq.${p.seller_id}&select=store_name,is_verified&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (sres.ok) { const s = await sres.json(); seller = Array.isArray(s) ? s[0] : null; }
  }
  return { ...p, seller };
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || '';
  const p = id ? await fetchProduct(id) : null;

  const cream = '#faf9f6', ink = '#1c1917', emerald = '#059669', muted = '#8a8580';
  const img: string | undefined = p?.images?.[0];
  const onSale = p?.sale_price && p.sale_price < p.price;
  const price = p ? tzs(onSale ? p.sale_price : p.price) : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: cream, fontFamily: 'sans-serif', position: 'relative' }}>
        {/* kitenge accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, display: 'flex', background: 'repeating-linear-gradient(-45deg,#059669 0 24px,#f59e0b 24px 36px,#0c4a6e 36px 60px,#f59e0b 60px 72px)' }} />

        {/* Product image */}
        <div style={{ width: 560, height: 630, display: 'flex', background: '#ece9e2' }}>
          {img && <img src={img} width={560} height={630} style={{ width: 560, height: 630, objectFit: 'cover' }} />}
        </div>

        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 56px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: emerald, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 900 }}>M</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: ink }}>MaliMart</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 4, color: emerald }}>MARKETPLACE</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {p?.brand && <div style={{ fontSize: 22, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{p.brand}</div>}
            <div style={{ fontSize: 52, fontWeight: 800, color: ink, lineHeight: 1.05, maxHeight: 230, overflow: 'hidden', display: 'flex' }}>
              {p?.name || 'Discover authentic Tanzanian products'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {p && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: emerald, color: '#fff', padding: '14px 30px', borderRadius: 18, fontSize: 44, fontWeight: 900 }}>{price}</div>
                {onSale && <div style={{ fontSize: 30, color: muted, textDecoration: 'line-through', display: 'flex' }}>{tzs(p.price)}</div>}
                {typeof p.rating === 'number' && p.rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 700, color: ink }}>
                    <span style={{ color: '#f59e0b', fontSize: 32 }}>★</span>{p.rating.toFixed(1)}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 700, color: '#57534e' }}>
              {p?.seller?.store_name ? <span style={{ display: 'flex' }}>by {p.seller.store_name}</span> : <span style={{ display: 'flex' }}>Verified Tanzanian sellers</span>}
              {p?.seller?.is_verified && <span style={{ display: 'flex', color: '#2563eb' }}>✓ Verified</span>}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
