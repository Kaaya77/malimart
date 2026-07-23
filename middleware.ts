/**
 * Edge middleware: when a social/link crawler requests a product page, serve the
 * per-product Open Graph meta document (/api/share-meta) so links unfurl as a
 * rich poster. Real users fall through to the normal SPA.
 */
import { next, rewrite } from '@vercel/edge';

export const config = { matcher: '/product/:path*' };

// Only match link-unfurling BOTS. Deliberately NOT the generic word "preview"
// (matched some real in-app browsers) and not bare "Telegram"/"Snapchat" — the
// human in-app browsers those apps open send a normal WebView UA. Mis-matching a
// human sends them to the share-meta redirect, which felt like a broken page.
const CRAWLER =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterest\/|redditbot|Embedly|Googlebot|bingbot|Applebot|vkShare|SkypeUriPreview|Flipboard|bitlybot|Nuzzel|Qwantify|Outbrain|Mastodon|ia_archiver/i;

export default function middleware(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  const url = new URL(req.url);
  // A human bounced here by mistake carries ?nc=1 from the share-meta redirect —
  // never intercept that (prevents any product→share-meta→product loop).
  if (url.searchParams.has('nc') || !CRAWLER.test(ua)) return next();

  const rawId = url.pathname.split('/')[2] || '';
  const uuidMatch = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const id = uuidMatch ? uuidMatch[0] : rawId;
  if (!id) return next();

  return rewrite(new URL(`/api/share-meta?id=${encodeURIComponent(id)}&path=${encodeURIComponent(url.pathname)}`, url.origin));
}
