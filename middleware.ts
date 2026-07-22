/**
 * Edge middleware: when a social/link crawler requests a product page, serve the
 * per-product Open Graph meta document (/api/share-meta) so links unfurl as a
 * rich poster. Real users fall through to the normal SPA.
 */
import { next, rewrite } from '@vercel/edge';

export const config = { matcher: '/product/:path*' };

const CRAWLER =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Telegram|Slackbot|LinkedInBot|Discordbot|Pinterest|redditbot|Embedly|Googlebot|bingbot|Applebot|vkShare|SkypeUriPreview|Snapchat|Flipboard|Tumblr|bitlybot|Nuzzel|Qwantify|Outbrain|Mastodon|ia_archiver|preview/i;

export default function middleware(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (!CRAWLER.test(ua)) return next();

  const url = new URL(req.url);
  const rawId = url.pathname.split('/')[2] || '';
  const uuidMatch = rawId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const id = uuidMatch ? uuidMatch[0] : rawId;
  if (!id) return next();

  return rewrite(new URL(`/api/share-meta?id=${encodeURIComponent(id)}&path=${encodeURIComponent(url.pathname)}`, url.origin));
}
