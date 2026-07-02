import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, MessageCircle, Twitter, Facebook, Link2, Instagram, Loader2, QrCode, Download, ImageIcon, ChevronRight } from 'lucide-react';
import { useToast } from './UI';
import { Product } from '../types';
import { formatTZS, CURRENCY } from '../constants';
import { SharePoster } from './SharePoster';

/** Generic payload for non-product shares (store pages, gift lists, …). */
export interface ShareData {
  title: string;
  url: string;
  /** Message prepended to the link in WhatsApp/SMS/etc. Defaults to the title. */
  text?: string;
  image?: string;
  subtitle?: string;
}

interface ProductShareProps {
  /** Product share — enables the poster flow. */
  product?: Product;
  /** Generic share — poster flow hidden. Ignored when `product` is set. */
  share?: ShareData;
  isOpen: boolean;
  onClose: () => void;
}

const SHARE_CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: 'bg-[#25D366] text-white',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49 11.815 11.815 0 0012.05 0zm0 21.785a9.855 9.855 0 01-5.032-1.378l-.36-.214-3.742.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884z"/>
      </svg>
    ),
    build: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: 'bg-[#1DA1F2] text-white',
    icon: () => <Twitter className="w-5 h-5 fill-current stroke-none"/>,
    build: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'bg-[#1877F2] text-white',
    icon: () => <Facebook className="w-5 h-5 fill-current stroke-none"/>,
    build: (url: string, _text: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: 'bg-[#229ED9] text-white',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    build: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'sms',
    label: 'SMS',
    color: 'bg-emerald-600 text-white',
    icon: () => <MessageCircle className="w-5 h-5 stroke-[2]"/>,
    build: (url: string, text: string) => `sms:?body=${encodeURIComponent(`${text}\n${url}`)}`,
  },
];

export const ProductShare: React.FC<ProductShareProps> = ({ product, share, isOpen, onClose }) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showPoster, setShowPoster] = useState(false);

  const shareUrl = product ? `${window.location.origin}/product/${product.id}` : share?.url || '';
  const shareText = product
    ? `🛒 Check out ${product.name} on MaliMart — ${formatTZS(product.price)} ${CURRENCY}\nAuthentic Tanzanian product, verified seller.`
    : share?.text || share?.title || '';
  const headerTitle = product ? product.name : share?.title || '';
  const headerSubtitle = product ? formatTZS(product.price) : share?.subtitle;
  const headerImage = product ? product.images?.[0] : share?.image;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    addToast('Link copied!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: headerTitle,
        text: shareText,
        url: shareUrl,
      });
    } catch {}
  };

  if (!isOpen || (!product && !share)) return null;

  return createPortal(
    <>
    {product && <SharePoster product={product} isOpen={showPoster} onClose={() => setShowPoster(false)} />}
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          role="dialog" aria-modal="true" aria-label={`Share ${headerTitle}`}
          className="w-full max-w-sm bg-background rounded-t-3xl md:rounded-3xl shadow-2xl border border-foreground/8 overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Handle bar mobile */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-foreground/15"/>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl overflow-hidden bg-foreground/[0.04] shrink-0 flex items-center justify-center">
                {headerImage
                  ? <img src={headerImage} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                  : <Share2 className="w-5 h-5 text-emerald-600 stroke-[2]"/>}
              </div>
              <div>
                <p className="font-bold text-foreground text-sm truncate max-w-[180px]">{headerTitle}</p>
                {headerSubtitle && <p className="text-xs text-emerald-600 font-semibold">{headerSubtitle}</p>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close share dialog"
              className="w-11 h-11 -m-1.5 rounded-full flex items-center justify-center text-foreground/50 hover:bg-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
              <X className="w-4 h-4 stroke-[2.5]"/>
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Create poster — the headline action (product shares only) */}
            {product && (
            <button onClick={() => setShowPoster(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/15 transition-colors active:scale-[0.98] text-left">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/20">
                <ImageIcon className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Create a poster</p>
                <p className="text-xs text-foreground/50">Beautiful image with QR — perfect for Stories & status</p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-600/60 shrink-0" />
            </button>
            )}

            {/* Native share (mobile) */}
            {navigator.share && (
              <button onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-foreground text-background font-bold text-sm hover:bg-foreground/85 transition-colors active:scale-[0.98]">
                <Share2 className="w-4 h-4 stroke-[2.5]"/> Share via…
              </button>
            )}

            {/* Social channels */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-3">Share on</p>
              <div className="grid grid-cols-5 gap-2">
                {SHARE_CHANNELS.map(ch => {
                  const Icon = ch.icon;
                  const url = ch.build(shareUrl, shareText);
                  return (
                    <a key={ch.id} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 group active:scale-90 transition-transform">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform ${ch.color}`}>
                        <Icon/>
                      </div>
                      <span className="text-[9px] font-semibold text-foreground/40 text-center leading-tight">{ch.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Copy link */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2">Direct link</p>
              <div className="flex items-center gap-2 p-3 bg-foreground/[0.04] rounded-2xl border border-foreground/8">
                <Link2 className="w-4 h-4 text-foreground/30 shrink-0 stroke-[2]"/>
                <p className="flex-1 text-xs font-mono text-foreground/50 truncate">{shareUrl}</p>
                <button onClick={copyLink}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition-all shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-foreground text-background hover:bg-foreground/85'}`}>
                  {copied ? <><Check className="w-3.5 h-3.5 stroke-[3]"/> Copied!</> : <><Copy className="w-3.5 h-3.5 stroke-[2.5]"/> Copy</>}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </>,
    document.body
  );
};
