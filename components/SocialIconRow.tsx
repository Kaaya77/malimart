import React from 'react';
import { Instagram, Facebook, Youtube, Linkedin, X as XIcon, Globe } from 'lucide-react';

/**
 * One compact icon per platform in SOCIAL_PLATFORMS order, always rendered —
 * colored + clickable when the seller has added that link, muted gray and
 * inert when they haven't. Showing the full, consistent row (not just the
 * ones that are set) is what makes "added" read as an accomplishment rather
 * than an arbitrary subset of icons appearing.
 */

const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39c1.44.79 3.06 1.2 4.71 1.2h.004c5.46 0 9.91-4.45 9.91-9.91C21.93 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.42 1.33-1.96 1.4-.5.07-1.13.1-1.83-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.15.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.05.17-.19.72-.84.92-1.13.19-.29.39-.24.65-.15.27.1 1.68.79 1.97.94.29.14.48.22.55.34.07.13.07.72-.17 1.4Z"/>
  </svg>
);

const TikTokGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.6 2h-3.2v13.6a2.6 2.6 0 1 1-2.6-2.6c.16 0 .32.01.47.03V9.8a5.8 5.8 0 1 0 5.53 5.79V8.9a7.8 7.8 0 0 0 4.5 1.43V7.1a4.6 4.6 0 0 1-4.7-5.1Z"/>
  </svg>
);

const PLATFORM_ICON: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'WhatsApp':     { icon: WhatsAppGlyph, color: '#25D366', bg: '#25D36620' },
  'Instagram':    { icon: Instagram,     color: '#E1306C', bg: '#E1306C20' },
  'TikTok':       { icon: TikTokGlyph,   color: '#000000', bg: '#00000015' },
  'Facebook':     { icon: Facebook,      color: '#1877F2', bg: '#1877F220' },
  'X (Twitter)':  { icon: XIcon,         color: '#000000', bg: '#00000015' },
  'YouTube':      { icon: Youtube,       color: '#FF0000', bg: '#FF000020' },
  'LinkedIn':     { icon: Linkedin,      color: '#0A66C2', bg: '#0A66C220' },
};
const PLATFORM_ORDER = Object.keys(PLATFORM_ICON);

function resolveHref(link: { platform?: string; url: string }): string {
  const raw = link.url.trim();
  if (/^https?:\/\//.test(raw)) return raw;
  const platform = (link.platform || '').toLowerCase();
  if (platform.includes('whatsapp')) return `https://wa.me/${raw.replace(/[^0-9]/g, '')}`;
  if (platform.includes('instagram')) return `https://instagram.com/${raw.replace(/^@/, '')}`;
  if (platform.includes('tiktok')) return `https://tiktok.com/@${raw.replace(/^@/, '')}`;
  if (platform.includes('facebook')) return `https://facebook.com/${raw}`;
  return `https://${raw}`;
}

export const SocialIconRow: React.FC<{ links?: { platform?: string; url: string }[] | null; size?: 'sm' | 'md' }> = ({ links, size = 'md' }) => {
  const byPlatform = new Map(
    (Array.isArray(links) ? links : [])
      .filter(l => l?.url?.trim())
      .map(l => [l.platform, l] as const)
  );
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const iconDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-1.5">
      {PLATFORM_ORDER.map(platform => {
        const meta = PLATFORM_ICON[platform];
        const Icon = meta.icon;
        const link = byPlatform.get(platform);
        if (!link) {
          return (
            <span key={platform} title={`${platform} — not added`}
              className={`${dim} rounded-full bg-foreground/[0.05] flex items-center justify-center text-foreground/20`}>
              <Icon className={iconDim} />
            </span>
          );
        }
        return (
          <a key={platform} href={resolveHref(link)} target="_blank" rel="noopener noreferrer"
            title={platform}
            style={{ backgroundColor: meta.bg, color: meta.color }}
            className={`${dim} rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95`}>
            <Icon className={iconDim} />
          </a>
        );
      })}
    </div>
  );
};
