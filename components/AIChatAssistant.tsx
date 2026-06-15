import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  X, Send, Sparkles, Loader2, Maximize2, Mic, MicOff,
  ShoppingBag, Minimize2, Paperclip, Zap, ChevronRight, Trash2, Volume2
} from 'lucide-react';
import { getLiveAI } from '../services/aiClient';
import { getAI } from '../services/aiClient';
import { MODELS } from '../services/aiModels';
import { useToast } from './UI';
import { useAppState } from '../context/AppContext';
import { formatTZS } from '../constants';
import { LiveServerMessage, Modality } from '@google/genai';

// ── Audio helpers (unchanged) ─────────────────────────────────────────────────
function resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const result = new Float32Array(Math.round(data.length / ratio));
  for (let i = 0; i < result.length; i++) {
    const pos = i * ratio; const idx = Math.floor(pos); const frac = pos - idx;
    result[i] = idx + 1 < data.length ? data[idx] * (1 - frac) + data[idx + 1] * frac : data[idx];
  }
  return result;
}
function encode(bytes: Uint8Array) {
  let b = ''; for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}
function decode(b64: string) {
  const s = atob(b64); const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  type: 'text' | 'product';
  productId?: string;
  image?: string;
  ts: number;
  streaming?: boolean;
  suggestions?: string[];
}

// ── Mali avatar ───────────────────────────────────────────────────────────────
const MaliAvatar = ({ size = 32, pulse = false }: { size?: number; pulse?: boolean }) => (
  <div
    style={{ width: size, height: size }}
    className={`rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 relative overflow-hidden ${pulse ? 'animate-pulse' : ''}`}
  >
    <span style={{ fontSize: size * 0.55 }} className="select-none">🛍️</span>
    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/10" />
  </div>
);

// ── Waveform bars (voice mode) ────────────────────────────────────────────────
const WaveBar = ({ delay }: { delay: number }) => {
  const h = useSpring(Math.random() * 24 + 8, { stiffness: 120, damping: 8 });
  useEffect(() => {
    const id = setInterval(() => h.set(Math.random() * 36 + 8), 180 + delay * 30);
    return () => clearInterval(id);
  }, [h, delay]);
  const height = useTransform(h, v => `${v}px`);
  return <motion.div style={{ height }} className="w-1 rounded-full bg-emerald-400 origin-center" />;
};
const LiveWaveform = () => (
  <div className="flex items-center gap-1 h-12">
    {Array.from({ length: 16 }, (_, i) => <WaveBar key={i} delay={i} />)}
  </div>
);

// ── Typing indicator ──────────────────────────────────────────────────────────
const TypingBubble = () => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 4, scale: 0.9 }}
    className="flex items-end gap-2 mb-3"
  >
    <MaliAvatar size={28} pulse />
    <div className="px-4 py-3 bg-card border border-foreground/8 rounded-2xl rounded-bl-sm shadow-sm flex gap-1.5 items-center">
      {[0, 0.15, 0.3].map(d => (
        <motion.span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-emerald-500"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, delay: d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  </motion.div>
);

// ── Quick suggestion chips ────────────────────────────────────────────────────
const SuggestionChips = ({ chips, onPick }: { chips: string[]; onPick: (s: string) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-wrap gap-1.5 mt-2 mb-1"
  >
    {chips.map((c, i) => (
      <motion.button
        key={c}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.07 }}
        onClick={() => onPick(c)}
        className="px-3 py-1.5 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
      >
        <ChevronRight className="w-2.5 h-2.5" />
        {c}
      </motion.button>
    ))}
  </motion.div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const AIChatAssistant = () => {
  const { products, addToCart, user } = useAppState();
  const { addToast } = useToast();

  const firstName = user?.full_name?.split(' ')[0] || user?.display_name || null;

  const greeting = firstName
    ? `Hey ${firstName}! 👋 I'm Mali, your shopping companion. What are we hunting for today?`
    : `Hey! 👋 I'm Mali — part shopping buddy, part style advisor. What can I help you find today?`;

  const [isOpen, setIsOpen]           = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages]       = useState<Msg[]>([
    { id: '0', role: 'assistant', text: greeting, type: 'text', ts: Date.now() }
  ]);
  const [input, setInput]         = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isLive, setIsLive]         = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTyping, setIsTyping]     = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // audio refs
  const sessionRef         = useRef<any>(null);
  const audioContextRef    = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const nextStartTimeRef   = useRef<number>(0);
  const sourcesRef         = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputAudioCtxRef   = useRef<AudioContext | null>(null);
  const streamRef          = useRef<MediaStream | null>(null);
  const processorRef       = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef     = useRef<MediaStreamAudioSourceNode | null>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, isLive, isMinimized]);
  useEffect(() => () => stopLiveSession(), []);

  // auto-focus input when chat opens
  useEffect(() => { if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 200); }, [isOpen, isMinimized]);

  const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const clearChat = () => {
    if (isLive) stopLiveSession();
    setMessages([{ id: '0', role: 'assistant', text: greeting, type: 'text', ts: Date.now() }]);
    setAttachment(null);
    setInput('');
  };

  const getSystemInstruction = () => {
    const catalog = products.slice(0, 50).map(p =>
      `[${p.id}] ${p.name} — ${formatTZS(p.price)} — ${p.category}`
    ).join('\n');
    const who = user ? `${user.full_name || user.display_name}, ${user.role}` : 'guest shopper';

    return `You are Mali — a warm, witty, culturally-aware shopping companion for MaliMart, Tanzania's premier online marketplace.

PERSONALITY:
- You're like a knowledgeable friend who genuinely loves helping people find great things
- Warm, encouraging, occasionally playful — never corporate or stiff
- You celebrate Tanzanian craftsmanship and culture with pride
- You ask follow-up questions to understand what someone really needs
- You give honest opinions ("honestly, for your budget I'd go with X") not just sales pitches
- Short replies unless detail is needed — respect the user's time

CURRENT USER: ${who}

PRODUCT CATALOG (use [PRODUCT:id] to recommend):
${catalog}

RULES:
1. When recommending products embed [PRODUCT:id] tags — don't just name them
2. After each response include a JSON block: {"suggestions":["follow-up 1","follow-up 2","follow-up 3"]} with 2-3 short clickable follow-ups relevant to the conversation
3. Keep main response text concise and human (2-4 sentences max unless the user asks for detail)
4. Be specific — "This dress would work great for a Dar es Salaam evening out" beats "This is a nice product"
5. If you don't have something in the catalog, say so honestly and suggest the closest alternative`;
  };

  // ── Live voice session ──────────────────────────────────────────────────────
  const stopLiveSession = useCallback(() => {
    sessionRef.current?.then((s: any) => { try { s.close(); } catch (_) {} });
    sessionRef.current = null;
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
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
      const analyser = outCtx.createAnalyser(); analyser.fftSize = 256;
      analyserRef.current = analyser; nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      inputAudioCtxRef.current = inCtx;
      const source = inCtx.createMediaStreamSource(stream); inputSourceRef.current = source;
      const processor = inCtx.createScriptProcessor(4096, 1, 1); processorRef.current = processor;

      const ai = await getLiveAI();
      const sp = ai.live.connect({
        model: MODELS.LIVE_AUDIO,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: getSystemInstruction(),
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsLive(true); setIsConnecting(false);
            processor.onaudioprocess = (e) => {
              const blob = createBlob(resample(e.inputBuffer.getChannelData(0), e.inputBuffer.sampleRate, 16000));
              sp.then(s => s.sendRealtimeInput({ audio: blob }));
            };
            source.connect(processor); processor.connect(inCtx.destination);
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
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buf = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
              const src = outCtx.createBufferSource(); src.buffer = buf;
              src.connect(analyser); analyser.connect(outCtx.destination);
              src.start(nextStartTimeRef.current); nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(src); src.onended = () => sourcesRef.current.delete(src);
            }
          },
          onclose: () => stopLiveSession(),
          onerror: () => stopLiveSession(),
        },
      });
      sessionRef.current = sp;
    } catch {
      stopLiveSession();
    }
  };

  // ── Send message (streaming) ─────────────────────────────────────────────────
  const handleSend = async (e?: React.FormEvent, override?: string) => {
    if (e) e.preventDefault();
    const text = override || input.trim();
    if (!text && !attachment) return;
    if (isLive) stopLiveSession();

    const img = attachment;
    setInput(''); setAttachment(null);
    const userMsg: Msg = { id: genId(), role: 'user', text, image: img || undefined, type: 'text', ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const ai = getAI();
      const history = messages
        .filter(m => m.type === 'text' && !m.streaming)
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));

      const chat = ai.chats.create({
        model: MODELS.SMART,
        history,
        config: { systemInstruction: getSystemInstruction(), tools: [{ googleSearch: {} }] },
      });

      const payload: any[] = [];
      if (img) payload.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } });
      if (text) payload.push({ text });

      // Use streaming so text appears character-by-character
      const streamResult = await chat.sendMessageStream({ message: payload });

      const assistantId = genId();
      setIsTyping(false);
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', text: '', type: 'text', ts: Date.now(), streaming: true }]);

      let full = '';
      for await (const chunk of streamResult) {
        const delta = chunk.text || '';
        full += delta;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: full } : m));
      }

      // Parse suggestions JSON from response
      const suggestMatch = full.match(/\{"suggestions"\s*:\s*\[([^\]]+)\]\s*\}/);
      let suggestions: string[] = [];
      let cleanText = full;
      if (suggestMatch) {
        try {
          const parsed = JSON.parse(suggestMatch[0]);
          suggestions = parsed.suggestions?.slice(0, 3) || [];
        } catch { /* ignore parse error */ }
        cleanText = full.replace(suggestMatch[0], '').trim();
      }

      // Parse [PRODUCT:id] tags from cleaned text
      const productRegex = /\[PRODUCT:([a-zA-Z0-9-]+)\]/g;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const extras: Msg[] = [];

      if (productRegex.test(cleanText)) {
        productRegex.lastIndex = 0;
        while ((match = productRegex.exec(cleanText)) !== null) {
          const before = cleanText.slice(lastIndex, match.index).trim();
          if (before) extras.push({ id: genId(), role: 'assistant', text: before, type: 'text', ts: Date.now() });
          const product = products.find(p => p.id === match![1]);
          if (product) extras.push({ id: genId(), role: 'assistant', text: '', type: 'product', productId: product.id, ts: Date.now() });
          lastIndex = productRegex.lastIndex;
        }
        const tail = cleanText.slice(lastIndex).replace(/\[PRODUCT:[^\]]+\]/g, '').trim();
        if (tail) extras.push({ id: genId(), role: 'assistant', text: tail, type: 'text', ts: Date.now(), suggestions });
        else if (extras.length) extras[extras.length - 1].suggestions = suggestions;
        // replace streaming placeholder with first text part
        const firstText = extras.find(m => m.type === 'text');
        setMessages(prev => [
          ...prev.filter(m => m.id !== assistantId),
          ...(firstText ? extras.map(m => m === firstText ? { ...m, streaming: false } : m) : extras),
        ]);
      } else {
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, text: cleanText, streaming: false, suggestions }
          : m
        ));
      }
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: genId(), role: 'assistant', type: 'text', ts: Date.now(),
        text: "Oops, hit a snag! Try again — I'm right here 😊",
      }]);
    }
  };

  // ── File attach ───────────────────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachment(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Render message ────────────────────────────────────────────────────────────
  const renderMsg = (m: Msg, i: number) => {
    if (m.type === 'product' && m.productId) {
      const p = products.find(x => x.id === m.productId);
      if (!p) return null;
      return (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.05 * (i % 5) }}
          className="mb-3 ml-9 w-[82%]"
        >
          <div className="bg-background rounded-2xl border border-foreground/8 shadow-sm overflow-hidden">
            <div className="flex gap-3 p-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-foreground/5 flex-shrink-0">
                <img src={p.images?.[0]} className="w-full h-full object-cover" alt={p.name} loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[11px] text-foreground line-clamp-2 leading-snug mb-1">{p.name}</p>
                <p className="text-[11px] font-black text-emerald-600 mb-2">{formatTZS(p.price)}</p>
                <button
                  onClick={() => { addToCart(p); addToast(`Added ${p.name} to bag`, 'success'); }}
                  className="flex items-center gap-1.5 h-7 px-3 bg-foreground text-background rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors"
                >
                  <ShoppingBag className="w-2.5 h-2.5" /> Add to bag
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    const isUser = m.role === 'user';
    return (
      <motion.div
        key={m.id}
        initial={{ opacity: 0, y: 10, x: isUser ? 10 : -10 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.03 * (i % 5) }}
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3`}
      >
        <div className={`flex items-end gap-2 max-w-[88%] ${isUser ? 'flex-row-reverse' : ''}`}>
          {!isUser && <MaliAvatar size={28} />}
          <div className="flex flex-col gap-0.5">
            {m.image && (
              <div className="mb-1 max-w-[140px] rounded-2xl overflow-hidden border border-foreground/8">
                <img src={m.image} alt="" className="w-full object-cover" />
              </div>
            )}
            <div className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
              isUser
                ? 'bg-foreground text-background rounded-br-sm'
                : 'bg-card border border-foreground/8 rounded-bl-sm text-foreground'
            }`}>
              {isUser ? (
                <span className="font-medium">{m.text}</span>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_li]:my-0 [&_strong]:font-black text-foreground">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                  {m.streaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-emerald-500 animate-pulse ml-0.5 rounded-full align-middle" />
                  )}
                </div>
              )}
            </div>
            <span className={`text-[8px] text-foreground/25 font-medium px-1 ${isUser ? 'text-right' : ''}`}>
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        {!isUser && m.suggestions?.length ? (
          <div className="ml-9 mt-0.5 w-full">
            <SuggestionChips chips={m.suggestions} onPick={s => handleSend(undefined, s)} />
          </div>
        ) : null}
      </motion.div>
    );
  };

  // ── Quick-start grid ──────────────────────────────────────────────────────────
  const starters = [
    { emoji: '✨', label: 'New arrivals', q: "What's new in the store?" },
    { emoji: '🎁', label: 'Gift ideas', q: 'Help me find a gift under 50,000 TZS' },
    { emoji: '👗', label: 'Style advice', q: 'Give me some style advice for a Tanzanian summer' },
    { emoji: '🔥', label: 'Best deals', q: 'Show me the best deals right now' },
  ];

  // ── FAB (closed state) ────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[84px] right-4 md:bottom-6 md:right-4 z-[90] w-14 h-14 rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #10b981, #0d9488)' }}
      >
        <span className="text-2xl select-none">🛍️</span>
        <motion.div
          className="absolute inset-0 bg-white/20"
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.button>
    );
  }

  // ── Chat window ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      className={`fixed bottom-[84px] right-4 md:bottom-4 md:right-4 z-[90] w-[calc(100vw-2rem)] md:w-[380px] transition-[height] duration-300 ease-out ${isMinimized ? 'h-16' : 'h-[520px] md:h-[560px]'}`}
    >
      <div className="flex flex-col h-full rounded-3xl overflow-hidden bg-background/98 backdrop-blur-2xl border border-foreground/10 shadow-2xl shadow-black/20">

        {/* ── Header ── */}
        <div className="px-4 py-3 border-b border-foreground/8 flex items-center justify-between flex-shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <MaliAvatar size={36} />
            <div>
              <p className="font-black text-sm text-foreground">Mali</p>
              <div className="flex items-center gap-1.5">
                <motion.span
                  className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500' : 'bg-emerald-500'}`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">
                  {isLive ? 'Voice on' : isConnecting ? 'Connecting…' : 'Ready to help'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={clearChat} className="p-2 hover:bg-foreground/8 rounded-xl transition-colors" title="Clear chat">
              <Trash2 className="w-3.5 h-3.5 text-foreground/40" />
            </button>
            <button onClick={() => setIsMinimized(v => !v)} className="p-2 hover:bg-foreground/8 rounded-xl transition-colors">
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5 text-foreground/40" /> : <Minimize2 className="w-3.5 h-3.5 text-foreground/40" />}
            </button>
            <button onClick={() => { stopLiveSession(); setIsOpen(false); }} className="p-2 hover:bg-rose-500/10 hover:text-rose-500 text-foreground/40 rounded-xl transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* ── Live voice overlay ── */}
            <AnimatePresence>
              {isLive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 bg-background flex flex-col items-center justify-center gap-6 rounded-3xl"
                >
                  <MaliAvatar size={72} pulse />
                  <LiveWaveform />
                  <p className="text-sm font-black uppercase tracking-widest text-foreground/60">Mali is listening…</p>
                  <button
                    onClick={stopLiveSession}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all"
                  >
                    <MicOff className="w-3.5 h-3.5" /> End voice chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Messages ── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-foreground/[0.015] px-4 py-4 space-y-0 scroll-smooth">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => renderMsg(m, i))}
              </AnimatePresence>

              {/* Quick starters — only on first message */}
              {messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 gap-2 mt-3"
                >
                  {starters.map((s, i) => (
                    <motion.button
                      key={s.q}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.07 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSend(undefined, s.q)}
                      className="flex items-center gap-2.5 p-3 bg-card border border-foreground/8 rounded-2xl hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left"
                    >
                      <span className="text-xl">{s.emoji}</span>
                      <span className="text-[11px] font-bold text-foreground/70 leading-tight">{s.label}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}

              {/* Typing indicator */}
              <AnimatePresence>{isTyping && <TypingBubble />}</AnimatePresence>
            </div>

            {/* ── Input bar ── */}
            <div className="px-3 py-3 border-t border-foreground/8 bg-background flex-shrink-0">
              {/* Attachment preview */}
              <AnimatePresence>
                {attachment && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 flex items-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-foreground/10">
                      <img src={attachment} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-foreground/50 font-medium">Image attached</span>
                    <button onClick={() => setAttachment(null)} className="ml-auto text-foreground/30 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-emerald-600 transition-all flex-shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFile} />

                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={isLive ? 'Speaking…' : 'Message Mali…'}
                    disabled={isLive}
                    className="w-full h-10 pl-4 pr-10 rounded-2xl bg-foreground/[0.06] border border-transparent focus:border-emerald-500/30 text-[12px] font-medium text-foreground placeholder:text-foreground/30 outline-none transition-all"
                  />
                  {input.trim() && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsTyping(true);
                        try {
                          const ai = getAI();
                          const r = await ai.models.generateContent({
                            model: MODELS.SMART,
                            contents: `Rephrase this shopping query to be clearer and more specific, return only the rephrased query: "${input}"`,
                          });
                          setInput(r.text?.trim() || input);
                        } finally { setIsTyping(false); }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-emerald-500 transition-colors"
                      title="Refine with AI"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {input.trim() || attachment ? (
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30 transition-colors"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => isLive ? stopLiveSession() : startLiveSession()}
                    disabled={isConnecting}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-all ${
                      isLive ? 'bg-red-500 shadow-red-500/30' : 'bg-foreground shadow-black/20'
                    }`}
                  >
                    {isConnecting
                      ? <Loader2 className="w-4 h-4 text-background animate-spin" />
                      : isLive
                      ? <Volume2 className="w-4 h-4 text-white" />
                      : <Mic className="w-4 h-4 text-background" />
                    }
                  </motion.button>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
