import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue, useAnimate } from 'framer-motion';
import { X, Send, Mic, MicOff, Paperclip, ChevronRight, Trash2, Volume2, Loader2, Zap, Copy, Check, ShoppingBag, ChevronLeft } from 'lucide-react';
import { getAI, getLiveAI } from '../services/aiClient';
import { MODELS } from '../services/aiModels';
import { useToast } from './UI';
import { useAppState } from '../context/AppContext';
import { formatTZS } from '../constants';
import { LiveServerMessage, Modality } from '@google/genai';
import { MaliAnimalAvatar, AnimalPicker, useAnimalAvatar, type EmoteType } from './MaliAnimalAvatar';

// â”€â”€ Audio helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function resample(data: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to;
  const out = new Float32Array(Math.round(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio; const idx = Math.floor(pos); const f = pos - idx;
    out[i] = idx + 1 < data.length ? data[idx] * (1 - f) + data[idx + 1] * f : data[idx];
  }
  return out;
}
function encode(b: Uint8Array) {
  let s = ''; for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function decode(b64: string) {
  const s = atob(b64); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sr: number, ch: number): Promise<AudioBuffer> {
  const i16 = new Int16Array(data.buffer); const frames = i16.length / ch;
  const buf = ctx.createBuffer(ch, frames, sr);
  for (let c = 0; c < ch; c++) {
    const cd = buf.getChannelData(c);
    for (let i = 0; i < frames; i++) cd[i] = i16[i * ch + c] / 32768.0;
  }
  return buf;
}
function createBlob(data: Float32Array) {
  const i16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) { const s = Math.max(-1, Math.min(1, data[i])); i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  return { data: encode(new Uint8Array(i16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  type: 'text' | 'products';
  productIds?: string[];
  image?: string;
  ts: number;
  streaming?: boolean;
  suggestions?: string[];
}

// â”€â”€ Animated mesh background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MeshBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
    <motion.div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-emerald-500/6 blur-3xl"
      animate={{ x: [0,40,0], y: [0,-30,0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.div className="absolute top-1/2 -right-20 w-48 h-48 rounded-full bg-teal-400/5 blur-3xl"
      animate={{ x: [0,-25,0], y: [0,35,0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
    <motion.div className="absolute -bottom-12 left-1/3 w-56 h-56 rounded-full bg-emerald-600/4 blur-3xl"
      animate={{ x: [0,20,0], y: [0,-20,0] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 4 }} />
  </div>
);

// â”€â”€ Mali avatar with optional rings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MaliAvatar now delegates to MaliAnimalAvatar
const MaliAvatar = ({ size = 36, rings = false, pulse = false, emote }: { size?: number; rings?: boolean; pulse?: boolean; emote?: EmoteType }) => (
  <MaliAnimalAvatar size={size} rings={rings} pulse={pulse} emote={emote ?? 'idle'} />
);

// â”€â”€ Voice mode waveform (canvas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const VoiceCanvas = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width; const H = canvas.height;
    let id: number;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let phase = 0;

    const draw = () => {
      id = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      phase += 0.04;

      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(16,185,129,0)');
        grad.addColorStop(0.2, 'rgba(16,185,129,0.9)');
        grad.addColorStop(0.8, 'rgba(20,184,166,0.9)');
        grad.addColorStop(1, 'rgba(20,184,166,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#10b981';
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * W;
          const y = ((data[i] / 128.0) - 1) * (H * 0.4) + H / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // idle animated sine
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(16,185,129,0)');
        grad.addColorStop(0.3, 'rgba(16,185,129,0.6)');
        grad.addColorStop(0.7, 'rgba(20,184,166,0.6)');
        grad.addColorStop(1, 'rgba(20,184,166,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#10b981';
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
          const t = x / W;
          const y = H / 2 + Math.sin(t * Math.PI * 4 + phase) * 10 * Math.sin(t * Math.PI);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [analyser]);
  return <canvas ref={ref} width={320} height={60} className="w-full h-[60px]" />;
};

// â”€â”€ Typing indicator with rotating context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const THINKING = [
  'Browsing the catalogâ€¦',
  'Thinking of ideasâ€¦',
  'Considering your styleâ€¦',
  'Checking the best optionsâ€¦',
  'Crafting a responseâ€¦',
];
const TypingBubble = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % THINKING.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }} className="flex items-end gap-2 mb-3">
      <MaliAvatar size={28} pulse />
      <div className="px-4 py-3 bg-card border border-foreground/8 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-3 max-w-[200px]">
        <div className="flex gap-1">
          {[0, 0.18, 0.36].map(d => (
            <motion.span key={d} className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              animate={{ y: [0,-6,0], opacity: [0.4,1,0.4] }}
              transition={{ duration: 0.9, delay: d, repeat: Infinity, ease: 'easeInOut' }} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.span key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
            className="text-[9px] font-medium text-foreground/40 whitespace-nowrap">
            {THINKING[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// â”€â”€ Suggestion chips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SuggestionChips = ({ chips, onPick }: { chips: string[]; onPick: (s: string) => void }) => (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5 mt-2">
    {chips.map((c, i) => (
      <motion.button key={c} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.08 }} whileHover={{ scale: 1.05, y: -1 }} whileTap={{ scale: 0.95 }}
        onClick={() => onPick(c)}
        className="px-3 py-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 rounded-full text-[10px] font-bold transition-all flex items-center gap-1">
        <ChevronRight className="w-2.5 h-2.5" />{c}
      </motion.button>
    ))}
  </motion.div>
);

// â”€â”€ Product carousel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ProductCarousel = ({ ids, products, onAdd }: {
  ids: string[]; products: any[]; onAdd: (p: any) => void;
}) => {
  const items = ids.map(id => products.find(p => p.id === id)).filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!items.length) return null;
  const p = items[idx];
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      className="ml-9 mb-3 w-[82%]">
      <div className="bg-background rounded-2xl border border-foreground/8 shadow-sm overflow-hidden">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div key={p.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex gap-3 p-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-foreground/5 flex-shrink-0 relative group">
                <img src={p.images?.[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={p.name} loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[11px] text-foreground line-clamp-2 leading-snug mb-1">{p.name}</p>
                <p className="text-[12px] font-black text-emerald-600 mb-2">{formatTZS(p.price)}</p>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => onAdd(p)}
                  className="flex items-center gap-1.5 h-7 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-shadow">
                  <ShoppingBag className="w-2.5 h-2.5" /> Add to bag
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
          {items.length > 1 && (
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex gap-1">
                {items.map((_: any, i: number) => (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-4 bg-emerald-500' : 'w-1.5 bg-foreground/20'}`} />
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setIdx(i => Math.max(0, i - 1))}
                  className="w-5 h-5 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors disabled:opacity-30"
                  disabled={idx === 0}>
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button onClick={() => setIdx(i => Math.min(items.length - 1, i + 1))}
                  className="w-5 h-5 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors disabled:opacity-30"
                  disabled={idx === items.length - 1}>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <p className="text-[9px] text-foreground/30 font-medium ml-1 mt-1">{idx + 1} of {items.length} recommendations</p>
      )}
    </motion.div>
  );
};

// â”€â”€ Message bubble â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MessageBubble = ({ m, isFirst, products, onAdd, onSuggest }: {
  m: Msg; isFirst: boolean; products: any[];
  onAdd: (p: any) => void; onSuggest: (s: string) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isUser = m.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(m.text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const time = (() => {
    const diff = Date.now() - m.ts;
    if (diff < 60_000) return 'just now';
    return new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  })();

  if (m.type === 'products' && m.productIds?.length) {
    return <ProductCarousel ids={m.productIds} products={products} onAdd={onAdd} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, x: isUser ? 12 : -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-2`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <div className={`flex items-end gap-2 max-w-[88%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && isFirst && <MaliAvatar size={28} />}
        {!isUser && !isFirst && <div className="w-7 flex-shrink-0" />}

        <div className="relative flex flex-col gap-0.5">
          {m.image && (
            <div className="mb-1 max-w-[160px] rounded-2xl overflow-hidden border border-foreground/10 shadow-sm">
              <img src={m.image} alt="" className="w-full object-cover" />
            </div>
          )}

          <div className={`relative px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm group ${
            isUser
              ? 'bg-gradient-to-br from-foreground to-foreground/85 text-background rounded-br-[4px]'
              : 'bg-card/80 backdrop-blur-sm border border-foreground/8 rounded-bl-[4px] text-foreground'
          }`}>
            {isUser ? (
              <span className="font-medium">{m.text}</span>
            ) : (
              <div className="prose prose-sm max-w-none text-foreground [&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:font-black [&_code]:text-emerald-500 [&_code]:bg-emerald-500/8 [&_code]:px-1 [&_code]:rounded [&_a]:text-emerald-500 [&_a]:no-underline">
                <ReactMarkdown>{m.text}</ReactMarkdown>
                {m.streaming && (
                  <motion.span className="inline-block w-0.5 h-3.5 bg-emerald-500 rounded-full ml-0.5 align-middle"
                    animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
                )}
              </div>
            )}

            {/* Copy button */}
            <AnimatePresence>
              {hovered && !m.streaming && (
                <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
                  onClick={copy}
                  className={`absolute -top-2 ${isUser ? 'left-0 -translate-x-full -ml-1' : 'right-0 translate-x-full ml-1'} w-6 h-6 rounded-lg bg-background border border-foreground/10 flex items-center justify-center shadow-sm hover:bg-foreground/5 transition-colors`}>
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-foreground/40" />}
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <span className={`text-[8px] text-foreground/20 font-medium px-1 ${isUser ? 'text-right' : ''}`}>{time}</span>
        </div>
      </div>

      {!isUser && m.suggestions?.length && !m.streaming ? (
        <div className="ml-9 w-full max-w-[88%]">
          <SuggestionChips chips={m.suggestions} onPick={onSuggest} />
        </div>
      ) : null}
    </motion.div>
  );
};

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const AIChatAssistant = () => {
  const { products, addToCart, user } = useAppState();
  const { addToast } = useToast();

  const firstName = user?.full_name?.split(' ')[0] || (user as any)?.display_name || null;
  const { animalInfo } = useAnimalAvatar();

  const _greetWithName = [
    (n: string, a: typeof animalInfo) => `Hey ${n}! Your ${a.name} companion is ready to help. What are we shopping for? ${a.emoji}`,
    (n: string, a: typeof animalInfo) => `Habari ${n}! ${a.emoji} Let's find something amazing today!`,
    (n: string, a: typeof animalInfo) => `Karibu ${n}! Shopping time is best time ${a.emoji}`,
  ];
  const _greetNoName = [
    (a: typeof animalInfo) => `Jambo! ${a.emoji} I'm ${a.name}, your MaliMart companion. What are we hunting for?`,
    (a: typeof animalInfo) => `Hey there! ${a.emoji} Ready to find something amazing in Tanzania's best marketplace?`,
    (a: typeof animalInfo) => `Karibu! ${a.emoji} ${a.name} here — your personal shopping buddy!`,
  ];
  const _pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const greeting = firstName ? _pick(_greetWithName)(firstName, animalInfo) : _pick(_greetNoName)(animalInfo);

  const [isOpen, setIsOpen]         = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages]     = useState<Msg[]>([
    { id: '0', role: 'assistant', text: greeting, type: 'text', ts: Date.now() }
  ]);
  const [input, setInput]           = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isLive, setIsLive]         = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping]     = useState(false);
  const [avatarEmote, setAvatarEmote] = useState<EmoteType>('waving');
  const [showAnimalPicker, setShowAnimalPicker] = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef         = useRef<any>(null);
  const audioContextRef    = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const nextStartRef       = useRef<number>(0);
  const sourcesRef         = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputAudioCtxRef   = useRef<AudioContext | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const processorRef       = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef     = useRef<MediaStreamAudioSourceNode | null>(null);

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => { if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 250); }, [isOpen, isMinimized]);
  useEffect(() => () => stopLiveSession(), []);

  const clearChat = () => {
    if (isLive) stopLiveSession();
    setMessages([{ id: '0', role: 'assistant', text: greeting, type: 'text', ts: Date.now() }]);
    setAttachment(null); setInput('');
  };

  const getSystem = () => {
    const catalog = products.slice(0, 60).map(p => `[${p.id}] ${p.name} Â· ${formatTZS(p.price)} Â· ${p.category}`).join('\n');
    const who = user ? `${(user as any).full_name || (user as any).display_name || 'shopper'}, ${(user as any).role || 'buyer'}` : 'guest';
    return `You are Mali â€” a warm, sharp, culturally-proud shopping companion for MaliMart, Tanzania's finest marketplace.

PERSONALITY: You're like the smartest friend at the market â€” you know every product, remember what people like, give honest takes ("honestly skip that, this one's way better"), celebrate Tanzanian craft, and keep it fun. Never robotic, never corporate. You ask good follow-up questions and give opinions, not just descriptions.

USER: ${who}

CATALOG:
${catalog}

RESPONSE FORMAT:
1. Answer in 2-4 sentences max unless detail is requested â€” respect people's time
2. Use [PRODUCT:id] tags when recommending specific products (can include multiple)
3. At the END of every response add exactly this JSON (and nothing else after it):
   {"suggestions":["short follow-up 1","short follow-up 2","short follow-up 3"]}
   Keep suggestions to 5 words or less each
4. Be specific and human: "This kanzu would be perfect for a Zanzibar ceremony" beats "Nice formal wear"
5. If asked about something not in catalog â€” say so honestly and suggest the closest match`;
  };

  // â”€â”€ Live voice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const stopLiveSession = useCallback(() => {
    sessionRef.current?.then((s: any) => { try { s.close(); } catch {} });
    sessionRef.current = null;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current.clear();
    audioContextRef.current?.close(); audioContextRef.current = null; analyserRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    processorRef.current?.disconnect(); processorRef.current = null;
    inputSourceRef.current?.disconnect(); inputSourceRef.current = null;
    inputAudioCtxRef.current?.close(); inputAudioCtxRef.current = null;
    setIsLive(false); setIsConnecting(false);
  }, []);

  const startLiveSession = async () => {
    if (isConnecting || isLive) { stopLiveSession(); return; }
    setIsConnecting(true);
    try {
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outCtx;
      const analyser = outCtx.createAnalyser(); analyser.fftSize = 512;
      analyserRef.current = analyser; nextStartRef.current = 0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      inputAudioCtxRef.current = inCtx;
      const src = inCtx.createMediaStreamSource(stream); inputSourceRef.current = src;
      const processor = inCtx.createScriptProcessor(4096, 1, 1); processorRef.current = processor;
      const ai = await getLiveAI();
      const sp = ai.live.connect({
        model: MODELS.LIVE_AUDIO,
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }, systemInstruction: getSystem(), outputAudioTranscription: {} },
        callbacks: {
          onopen: () => {
            setIsLive(true); setIsConnecting(false);
            processor.onaudioprocess = (e) => {
              const blob = createBlob(resample(e.inputBuffer.getChannelData(0), e.inputBuffer.sampleRate, 16000));
              sp.then(s => s.sendRealtimeInput({ audio: blob }));
            };
            src.connect(processor); processor.connect(inCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription?.text) {
              const t = msg.serverContent.outputTranscription.text;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return last?.role === 'assistant' && last.type === 'text'
                  ? [...prev.slice(0, -1), { ...last, text: last.text + t }]
                  : [...prev, { id: genId(), role: 'assistant', text: t, type: 'text', ts: Date.now() }];
              });
            }
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outCtx.state !== 'closed') {
              nextStartRef.current = Math.max(nextStartRef.current, outCtx.currentTime);
              const buf = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
              const s = outCtx.createBufferSource(); s.buffer = buf;
              s.connect(analyser); analyser.connect(outCtx.destination);
              s.start(nextStartRef.current); nextStartRef.current += buf.duration;
              sourcesRef.current.add(s); s.onended = () => sourcesRef.current.delete(s);
            }
          },
          onclose: () => stopLiveSession(),
          onerror: () => stopLiveSession(),
        },
      });
      sessionRef.current = sp;
    } catch { stopLiveSession(); }
  };

  // â”€â”€ Send (streaming) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSend = async (e?: React.FormEvent, override?: string) => {
    if (e) e.preventDefault();
    const text = override || input.trim();
    if (!text && !attachment) return;
    if (isLive) stopLiveSession();
    const img = attachment;
    setInput(''); setAttachment(null);
    setMessages(prev => [...prev, { id: genId(), role: 'user', text, image: img || undefined, type: 'text', ts: Date.now() }]);
    setIsTyping(true);
    setAvatarEmote('thinking');

    try {
      const ai = getAI();
      const history = messages.filter(m => m.type === 'text' && !m.streaming)
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
      const chat = ai.chats.create({ model: MODELS.TEXT, history, config: { systemInstruction: getSystem(), tools: [{ googleSearch: {} }] } });
      const payload: any[] = [];
      if (img) payload.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } });
      if (text) payload.push({ text });

      const stream = await chat.sendMessageStream({ message: payload });
      const aid = genId();
      setIsTyping(false);
      setAvatarEmote('happy');
      setTimeout(() => setAvatarEmote('idle'), 1800);
      setMessages(prev => [...prev, { id: aid, role: 'assistant', text: '', type: 'text', ts: Date.now(), streaming: true }]);

      let full = '';
      for await (const chunk of stream) {
        full += chunk.text || '';
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, text: full } : m));
      }

      // Extract suggestions JSON
      const suggestMatch = full.match(/\{"suggestions"\s*:\s*\[[^\]]+\]\s*\}/);
      let suggestions: string[] = [];
      let cleanText = full;
      if (suggestMatch) {
        try { suggestions = JSON.parse(suggestMatch[0]).suggestions?.slice(0, 3) || []; } catch {}
        cleanText = full.replace(suggestMatch[0], '').trim();
      }

      // Extract product tags â€” group into carousel
      const productRegex = /\[PRODUCT:([a-zA-Z0-9-]+)\]/g;
      const productIds: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = productRegex.exec(cleanText)) !== null) productIds.push(match[1]);
      const textOnly = cleanText.replace(/\[PRODUCT:[^\]]+\]/g, '').trim();

      const newMsgs: Msg[] = [];
      if (textOnly) newMsgs.push({ id: aid, role: 'assistant', text: textOnly, type: 'text', ts: Date.now(), streaming: false, suggestions: productIds.length ? [] : suggestions });
      if (productIds.length) {
        const validIds = productIds.filter(id => products.find(p => p.id === id));
        if (validIds.length) newMsgs.push({ id: genId(), role: 'assistant', text: '', type: 'products', productIds: validIds, ts: Date.now(), suggestions });
        else if (textOnly) newMsgs[0].suggestions = suggestions;
      }

      if (newMsgs.length) {
        setMessages(prev => [...prev.filter(m => m.id !== aid), ...newMsgs]);
      } else {
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, text: cleanText, streaming: false, suggestions } : m));
      }
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: genId(), role: 'assistant', type: 'text', ts: Date.now(), text: "Oops, something went sideways! Try again â€” I'm still here ðŸ˜Š" }]);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachment(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Detect grouped messages (consecutive same-sender, within 60s)
  const isFirstInGroup = (i: number) => {
    if (i === 0) return true;
    const prev = messages[i - 1]; const curr = messages[i];
    return prev.role !== curr.role || curr.ts - prev.ts > 60_000;
  };

  // â”€â”€ FAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!isOpen) return (
    <div className="fixed bottom-[84px] right-4 md:bottom-6 md:right-4 z-[90]">
      <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="relative w-14 h-14 rounded-[18px]"
      >
        {/* Glow halo */}
        <motion.div className="absolute inset-0 rounded-[18px] bg-gradient-to-br from-emerald-400 to-teal-600 blur-xl"
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.2, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />

        {/* Orbiting particles */}
        {[0, 120, 240].map(deg => (
          <motion.div key={deg} className="absolute inset-0 pointer-events-none"
            animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            style={{ rotate: deg }}>
            <div className="absolute top-0 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-2 rounded-full bg-emerald-300 shadow-sm shadow-emerald-400" />
          </motion.div>
        ))}

        {/* Button surface -- shows user's chosen animal */}
        <div className="absolute inset-0 rounded-[18px] flex items-center justify-center shadow-xl overflow-hidden">
          <MaliAnimalAvatar size={56} pulse emote="waving" />
        </div>
      </motion.button>
    </div>
  );

  // â”€â”€ Chat window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const starters = [
    { emoji: 'âœ¨', label: "What's new?",   q: "What's new in the store?" },
    { emoji: 'ðŸŽ', label: 'Gift ideas',    q: 'Help me find a gift under 50,000 TZS' },
    { emoji: 'ðŸ‘—', label: 'Style advice',  q: 'Give me style advice for a Tanzanian summer' },
    { emoji: 'ðŸ”¥', label: 'Best deals',    q: 'Show me the best deals right now' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 28, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 28, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`fixed bottom-[84px] right-4 md:bottom-4 md:right-4 z-[90] w-[calc(100vw-2rem)] md:w-[390px] ${isMinimized ? 'h-16' : 'h-[550px] md:h-[590px]'} transition-[height] duration-300 ease-out`}
    >
      {/* Gradient border wrapper */}
      <div className="h-full p-px rounded-3xl bg-gradient-to-b from-emerald-500/20 via-foreground/5 to-teal-500/15 shadow-2xl shadow-black/25">
        <div className="flex flex-col h-full rounded-[23px] overflow-hidden bg-background/97 backdrop-blur-2xl relative">
          <MeshBackground />

          {/* â”€â”€ Header â”€â”€ */}
          <div className="relative z-10 px-4 py-3 border-b border-foreground/6 flex items-center justify-between flex-shrink-0 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                  onClick={() => setShowAnimalPicker(v => !v)} title="Change companion">
                  <MaliAvatar size={38} rings={isLive} emote={avatarEmote} />
                </motion.button>
                <AnimatePresence>
                  {showAnimalPicker && (
                    <div className="absolute top-12 left-0 z-50">
                      <AnimalPicker onClose={() => setShowAnimalPicker(false)} />
                    </div>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <p className="font-black text-sm bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">{animalInfo.name}</p>
                <div className="flex items-center gap-1.5">
                  <motion.span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500' : 'bg-emerald-500'}`}
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">
                    {isConnecting ? 'Connectingâ€¦' : isLive ? 'Voice on' : 'Ready to help'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={clearChat} className="p-2 hover:bg-foreground/6 rounded-xl transition-colors" title="Clear">
                <Trash2 className="w-3.5 h-3.5 text-foreground/35" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setIsMinimized(v => !v)} className="p-2 hover:bg-foreground/6 rounded-xl transition-colors">
                <motion.div animate={{ rotate: isMinimized ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-foreground/35">
                    <path d="M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    {!isMinimized && <path d="M4 4l3-3 3 3M4 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>}
                  </svg>
                </motion.div>
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => { stopLiveSession(); setIsOpen(false); }}
                className="p-2 hover:bg-rose-500/8 hover:text-rose-500 text-foreground/35 rounded-xl transition-colors">
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* â”€â”€ Voice overlay â”€â”€ */}
              <AnimatePresence>
                {isLive && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 bg-background/95 backdrop-blur-lg flex flex-col items-center justify-center gap-5">
                    {/* Ambient orbs */}
                    {[
                      { cls: 'top-8 left-8 w-24 h-24 bg-emerald-500/8', dur: 4 },
                      { cls: 'bottom-16 right-8 w-32 h-32 bg-teal-500/6', dur: 5 },
                      { cls: 'top-1/3 right-4 w-16 h-16 bg-emerald-400/10', dur: 3 },
                    ].map((o, i) => (
                      <motion.div key={i} className={`absolute rounded-full blur-2xl pointer-events-none ${o.cls}`}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }} />
                    ))}
                    <MaliAvatar size={72} rings pulse />
                    <div className="w-full px-8">
                      <VoiceCanvas analyser={analyserRef.current} />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/50">Mali is listening</p>
                      <p className="text-[9px] text-foreground/25">Speak naturally â€” she'll respond</p>
                    </div>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={stopLiveSession}
                      className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/25 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
                      <MicOff className="w-3.5 h-3.5" /> End voice
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* â”€â”€ Messages â”€â”€ */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 relative z-10 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <MessageBubble key={m.id} m={m} isFirst={isFirstInGroup(i)}
                      products={products}
                      onAdd={p => { addToCart(p); addToast(`Added ${p.name} to bag ðŸ›ï¸`, 'success'); }}
                      onSuggest={s => handleSend(undefined, s)} />
                  ))}
                </AnimatePresence>

                {/* Quick starters on fresh chat */}
                <AnimatePresence>
                  {messages.length === 1 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }} transition={{ delay: 0.4 }}
                      className="grid grid-cols-2 gap-2 mt-2">
                      {starters.map((s, i) => (
                        <motion.button key={s.q}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.45 + i * 0.08 }}
                          whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                          onClick={() => handleSend(undefined, s.q)}
                          className="flex items-center gap-2.5 p-3 bg-card/60 border border-foreground/6 rounded-2xl hover:border-emerald-500/25 hover:bg-emerald-500/4 transition-all text-left group">
                          <motion.span className="text-xl" whileHover={{ scale: 1.2, rotate: 10 }} transition={{ type: 'spring', stiffness: 400 }}>
                            {s.emoji}
                          </motion.span>
                          <span className="text-[11px] font-bold text-foreground/60 group-hover:text-foreground/80 leading-tight transition-colors">{s.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>{isTyping && <TypingBubble />}</AnimatePresence>
              </div>

              {/* â”€â”€ Input â”€â”€ */}
              <div className="relative z-10 px-3 pb-3 pt-2 border-t border-foreground/6 bg-background/80 backdrop-blur-sm flex-shrink-0">
                {/* Attachment preview */}
                <AnimatePresence>
                  {attachment && (
                    <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }} className="flex items-center gap-2 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-foreground/10 shadow-sm flex-shrink-0">
                        <img src={attachment} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-foreground/40 font-medium flex-1">Image attached</span>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAttachment(null)}
                        className="w-5 h-5 rounded-full bg-foreground/8 flex items-center justify-center">
                        <X className="w-2.5 h-2.5 text-foreground/50" />
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSend} className="flex gap-2 items-center">
                  <motion.button type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/5 hover:bg-foreground/8 text-foreground/35 hover:text-emerald-600 transition-all flex-shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </motion.button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />

                  <div className="flex-1 relative">
                    <motion.input ref={inputRef} value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={isLive ? 'Speakingâ€¦' : 'Ask Mali anythingâ€¦'}
                      disabled={isLive}
                      className="w-full h-10 pl-4 pr-10 rounded-2xl bg-foreground/[0.05] border border-foreground/8 focus:border-emerald-500/40 focus:bg-foreground/[0.07] text-[12px] font-medium text-foreground placeholder:text-foreground/25 outline-none transition-all"
                    />
                    <AnimatePresence>
                      {input.trim() && (
                        <motion.button type="button" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          onClick={async () => {
                            setIsTyping(true);
                            try {
                              const ai = getAI();
                              const r = await ai.models.generateContent({
                                model: MODELS.TEXT,
                                contents: `Rephrase this shopping query to be clearer and more specific for a Tanzanian marketplace, return ONLY the rephrased query: "${input}"`,
                              });
                              setInput(r.text?.trim() || input);
                            } finally { setIsTyping(false); }
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/25 hover:text-emerald-500 transition-colors"
                          title="AI refine">
                          <Zap className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait">
                    {input.trim() || attachment ? (
                      <motion.button key="send" type="submit" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
                        className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/35 transition-shadow hover:shadow-emerald-500/55">
                        <Send className="w-4 h-4 text-white" />
                      </motion.button>
                    ) : (
                      <motion.button key="mic" type="button" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
                        onClick={() => isLive ? stopLiveSession() : startLiveSession()}
                        disabled={isConnecting}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-all ${
                          isLive ? 'bg-red-500 shadow-red-500/35' : 'bg-foreground shadow-black/15'
                        }`}>
                        {isConnecting ? <Loader2 className="w-4 h-4 text-background animate-spin" />
                          : isLive ? <Volume2 className="w-4 h-4 text-white" />
                          : <Mic className="w-4 h-4 text-background" />}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
