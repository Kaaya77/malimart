/**
 * GET /api/share-meta?id=<productId>
 *
 * Returns a tiny HTML document with per-product Open Graph / Twitter tags so
 * social crawlers render a rich preview (og:image -> /api/og). Real users are
 * only routed here by middleware when a crawler is detected; if a human lands
 * here anyway, we redirect them to the real product page.
 */
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const esc = (s: string) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tzs = (n: number) => 'TZS ' + Math.round(n || 0).toLocaleString('en-US');

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || '';
  const origin = url.origin;
  const productUrl = `${origin}/product/${id}`;

  let title = 'MaliMart — Tanzania’s Marketplace';
  let desc = 'Discover authentic Tanzanian products from verified local sellers.';
  let image = `${origin}/api/og`;

  if (id && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=name,price,sale_price&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        const p = Array.isArray(rows) ? rows[0] : null;
        if (p) {
          const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
          title = `${p.name} — ${tzs(price)} | MaliMart`;
          desc = `${p.name} on MaliMart. Authentic Tanzanian product from a verified seller. Tap to shop.`;
          image = `${origin}/api/og?id=${encodeURIComponent(id)}`;
        }
      }
    } catch { /* fall back to defaults */ }
  }

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="MaliMart" />
<meta property="og:url" content="${esc(productUrl)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="canonical" href="${esc(productUrl)}" />
<meta http-equiv="refresh" content="0; url=${esc(productUrl)}" />
</head><body>
<p>Redirecting to <a href="${esc(productUrl)}">${esc(title)}</a>…</p>
<script>location.replace(${JSON.stringify(productUrl)});</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
