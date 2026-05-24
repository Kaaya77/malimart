import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
 MessageSquare, X, Send, Sparkles, User, Bot, Loader2, 
 Maximize2, Mic, MicOff, Waves, Image as ImageIcon, 
 ShoppingBag, ArrowRight, Zap, Minimize2, Paperclip, 
 TrendingUp, Box, HelpCircle, Trash2
} from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Button, Input, Card, Badge, useToast } from './UI';
import { useAppState } from '../context/AppContext';
import { CURRENCY } from '../constants';

// --- AUDIO HELPERS ---
function resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
 const ratio = fromRate / toRate;
 const newLength = Math.round(data.length / ratio);
 const result = new Float32Array(newLength);
 for (let i = 0; i < newLength; i++) {
 const pos = i * ratio;
 const index = Math.floor(pos);
 const frac = pos - index;
 if (index + 1 < data.length) {
 result[i] = data[index] * (1 - frac) + data[index + 1] * frac;
 } else {
 result[i] = data[index];
 }
 }
 return result;
}

function encode(bytes: Uint8Array) {
 let binary = '';
 const len = bytes.byteLength;
 for (let i = 0; i < len; i++) {
 binary += String.fromCharCode(bytes[i]);
 }
 return btoa(binary);
}

function decode(base64: string) {
 const binaryString = atob(base64);
 const len = binaryString.length;
 const bytes = new Uint8Array(len);
 for (let i = 0; i < len; i++) {
 bytes[i] = binaryString.charCodeAt(i);
 }
 return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
 const dataInt16 = new Int16Array(data.buffer);
 const frameCount = dataInt16.length / numChannels;
 const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
 for (let channel = 0; channel < numChannels; channel++) {
 const channelData = buffer.getChannelData(channel);
 for (let i = 0; i < frameCount; i++) {
 channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
 }
 }
 return buffer;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
 const l = data.length;
 const int16 = new Int16Array(l);
 for (let i = 0; i < l; i++) {
 // Clamp and convert to Int16 PCM
 const s = Math.max(-1, Math.min(1, data[i]));
 int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
 }
 return {
 data: encode(new Uint8Array(int16.buffer)),
 mimeType: 'audio/pcm;rate=16000',
 };
}

// --- VISUALIZER COMPONENT ---
const AudioVisualizer = ({ analyser }: { analyser: AnalyserNode | null }) => {
 const canvasRef = useRef<HTMLCanvasElement>(null);

 useEffect(() => {
 if (!analyser || !canvasRef.current) return;
 const canvas = canvasRef.current;
 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 const bufferLength = analyser.frequencyBinCount;
 const dataArray = new Uint8Array(bufferLength);
 let animationId: number;

 const draw = () => {
 animationId = requestAnimationFrame(draw);
 analyser.getByteFrequencyData(dataArray);

 ctx.clearRect(0, 0, canvas.width, canvas.height);
 const width = canvas.width;
 const height = canvas.height;
 const barWidth = (width / bufferLength) * 2.5;
 let x = 0;

 for (let i = 0; i < bufferLength; i++) {
 const barHeight = (dataArray[i] / 255) * height;
 const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
 gradient.addColorStop(0, '#10b981');
 gradient.addColorStop(1, '#059669');

 ctx.fillStyle = gradient;
 
 if (barHeight > 0) {
 ctx.beginPath();
 ctx.roundRect(x, (height - barHeight) / 2 + (height / 2) - barHeight/2, barWidth, barHeight, [4]);
 ctx.fill();
 }

 x += barWidth + 2;
 }
 };

 draw();
 return () => cancelAnimationFrame(animationId);
 }, [analyser]);

 return <canvas ref={canvasRef} width={300} height={80} className="w-full h-20 opacity-90" />;
};

export const AIChatAssistant = () => {
 const { products, addToCart, user } = useAppState();
 const { addToast } = useToast();
 const [isOpen, setIsOpen] = useState(false);
 const [isMinimized, setIsMinimized] = useState(false);
 const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string, type?: 'text' | 'product', productId?: string, image?: string }[]>([
 { role: 'assistant', text: "Welcome! I'm Mali. How can I help you shop today?", type: 'text' }
 ]);
 const [input, setInput] = useState('');

 const clearChat = () => {
 setMessages([{ role: 'assistant', text: "Chat cleared. How can I help you now?", type: 'text' }]);
 setAttachment(null);
 setInput('');
 if (isLive) stopLiveSession();
 };

 const quickActions = [
 { label: 'New Arrivals', icon: Sparkles, query: 'Show me the newest products' },
 { label: 'Best Sellers', icon: TrendingUp, query: 'What are your most popular items?' },
 { label: 'Style Advice', icon: Zap, query: 'Can you give me some style advice?' },
 { label: 'My Orders', icon: Box, query: 'How do I check my order status?' },
 ];
 const [attachment, setAttachment] = useState<string | null>(null);
 const [isLive, setIsLive] = useState(false);
 const [isConnecting, setIsConnecting] = useState(false);
 const [isTyping, setIsTyping] = useState(false);
 const scrollRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 
 // Audio State
 const sessionRef = useRef<any>(null);
 const audioContextRef = useRef<AudioContext | null>(null);
 const analyserRef = useRef<AnalyserNode | null>(null);
 const nextStartTimeRef = useRef<number>(0);
 const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
 
 // Input Audio State
 const inputAudioContextRef = useRef<AudioContext | null>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const processorRef = useRef<ScriptProcessorNode | null>(null);
 const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

 const scrollToBottom = () => {
 if (scrollRef.current) {
 scrollRef.current.scrollTo({
 top: scrollRef.current.scrollHeight,
 behavior: 'smooth'
 });
 }
 };

 useEffect(() => {
 scrollToBottom();
 }, [messages, isMinimized, isOpen, isTyping, isLive]);

 useEffect(() => {
 return () => { stopLiveSession(); };
 }, []);

 const getSystemInstruction = () => {
 const productContext = products.slice(0, 40).map(p => 
 `ID: ${p.id}, Name: ${p.name}, Price: ${p.price} ${CURRENCY}, Cat: ${p.category}, Brand: ${p.brand || 'N/A'}`
 ).join('\n');

 const userContext = user ? `User: ${user.full_name}, Role: ${user.role}` : 'User: Guest';

 return `You are Mali, a helpful AI assistant for MaliMart.
 
 CONTEXT:
 ${userContext}
 
 PERSONA:
 - Tone: Warm, energetic, professional.
 - Language: English only. Do not use Swahili.
 - Goal: Help users find products, answer questions about orders, and provide style advice.
 
 INVENTORY:
 ${productContext}
 
 RULES:
 1. Recommend products from inventory and append [PRODUCT:ID] tags.
 2. Keep text responses concise and helpful.
 3. Communicate exclusively in English.
 4. If the user asks about their role or profile, use the provided context.
 5. For general questions about Tanzania or craftsmanship, use your internal knowledge but keep it relevant to MaliMart.
 `;
 };

 const stopLiveSession = useCallback(() => {
 if (sessionRef.current) {
 sessionRef.current.then((s: any) => s.close());
 sessionRef.current = null;
 }
 
 // Stop Output
 sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
 sourcesRef.current.clear();
 if (audioContextRef.current) {
 audioContextRef.current.close();
 audioContextRef.current = null;
 analyserRef.current = null;
 }

 // Stop Input
 if (streamRef.current) {
 streamRef.current.getTracks().forEach(track => track.stop());
 streamRef.current = null;
 }
 if (processorRef.current) {
 processorRef.current.disconnect();
 processorRef.current = null;
 }
 if (inputSourceRef.current) {
 inputSourceRef.current.disconnect();
 inputSourceRef.current = null;
 }
 if (inputAudioContextRef.current) {
 inputAudioContextRef.current.close();
 inputAudioContextRef.current = null;
 }

 setIsLive(false);
 setIsConnecting(false);
 }, []);

 const startLiveSession = async () => {
 if (!process.env.GEMINI_API_KEY) return;
 if (isConnecting || isLive) {
 stopLiveSession();
 return;
 }

 setIsConnecting(true);
 try {
 // 1. Setup Audio Output Context
 const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
 audioContextRef.current = outCtx;
 const analyser = outCtx.createAnalyser();
 analyser.fftSize = 256;
 analyserRef.current = analyser;
 nextStartTimeRef.current = 0;

 // 2. Setup Audio Input
 const stream = await navigator.mediaDevices.getUserMedia({ audio: {
 channelCount: 1,
 sampleRate: 16000,
 }});
 streamRef.current = stream;

 const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
 inputAudioContextRef.current = inputCtx;
 const source = inputCtx.createMediaStreamSource(stream);
 inputSourceRef.current = source;
 const processor = inputCtx.createScriptProcessor(4096, 1, 1);
 processorRef.current = processor;

 // 3. Connect to Gemini Live
 const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 const sessionPromise = ai.live.connect({
 model: 'gemini-2.5-flash-native-audio-preview-12-2025',
 config: {
 responseModalities: [Modality.AUDIO],
 speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
 systemInstruction: getSystemInstruction(),
 outputAudioTranscription: {},
 },
 callbacks: {
 onopen: () => {
 setIsLive(true);
 setIsConnecting(false);
 
 // Start sending audio once connected
 processor.onaudioprocess = (e) => {
 const inputData = e.inputBuffer.getChannelData(0);
 const resampledData = resample(inputData, e.inputBuffer.sampleRate, 16000);
 const blob = createBlob(resampledData);
 sessionPromise.then((session) => {
 session.sendRealtimeInput({ audio: blob });
 });
 };
 source.connect(processor);
 processor.connect(inputCtx.destination);
 },
 onmessage: async (message: LiveServerMessage) => {
 // Handle Transcription
 if (message.serverContent?.outputTranscription) {
 const text = message.serverContent.outputTranscription.text;
 setMessages(prev => {
 const last = prev[prev.length - 1];
 if (last?.role === 'assistant' && last.type === 'text') {
 return [...prev.slice(0, -1), { ...last, text: last.text + text }];
 }
 return [...prev, { role: 'assistant', text, type: 'text' }];
 });
 }
 
 // Handle Audio Output
 const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
 if (audioData && outCtx.state !== 'closed') {
 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
 const buffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
 const source = outCtx.createBufferSource();
 source.buffer = buffer;
 source.connect(analyser);
 analyser.connect(outCtx.destination);
 source.start(nextStartTimeRef.current);
 nextStartTimeRef.current += buffer.duration;
 sourcesRef.current.add(source);
 source.onended = () => sourcesRef.current.delete(source);
 }
 },
 onclose: () => stopLiveSession(),
 onerror: (e) => {
 stopLiveSession();
 },
 }
 });
 sessionRef.current = sessionPromise;
 } catch (e) {
 stopLiveSession();
 }
 };

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => setAttachment(reader.result as string);
 reader.readAsDataURL(file);
 }
 };

 const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
 if (e) e.preventDefault();
 const textToSend = overrideText || input.trim();
 if (!textToSend && !attachment) return;
 if (isLive) stopLiveSession();
 const currentAttachment = attachment;
 setInput('');
 setAttachment(null);
 setMessages(prev => [...prev, { role: 'user', text: textToSend, image: currentAttachment || undefined, type: 'text' }]);
 setIsTyping(true);

 try {
 const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 const history = messages
 .filter(m => m.type === 'text')
 .map(m => ({
 role: m.role === 'assistant' ? 'model' : 'user',
 parts: [{ text: m.text }]
 }));

 const chat = ai.chats.create({
 model: 'gemini-2.0-flash',
 history: history,
 config: { 
 systemInstruction: getSystemInstruction(),
 tools: [{ googleSearch: {} }]
 }
 });

 let messagePayload: any = [];
 if (currentAttachment) {
 const base64Data = currentAttachment.split(',')[1];
 messagePayload.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
 }
 if (textToSend) messagePayload.push({ text: textToSend });

 const result = await chat.sendMessage({ message: messagePayload }); 
 const responseText = result.text || '';
 const productRegex = /\[PRODUCT:([a-zA-Z0-9-]+)\]/g;
 let match;
 let lastIndex = 0;
 const newMessages: any[] = [];

 if (!responseText.match(productRegex)) {
 newMessages.push({ role: 'assistant', text: responseText, type: 'text' });
 } else {
 while ((match = productRegex.exec(responseText)) !== null) {
 const textPart = responseText.slice(lastIndex, match.index).trim();
 if (textPart) newMessages.push({ role: 'assistant', text: textPart, type: 'text' });
 const productId = match[1];
 const product = products.find(p => p.id === productId);
 if (product) newMessages.push({ role: 'assistant', text: "Here is a recommendation:", type: 'product', productId: product.id });
 lastIndex = productRegex.lastIndex;
 }
 const remainingText = responseText.slice(lastIndex).trim();
 if (remainingText) newMessages.push({ role: 'assistant', text: remainingText, type: 'text' });
 }
 setMessages(prev => [...prev, ...newMessages]);
 } catch (err) {
 setMessages(prev => [...prev, { role: 'assistant', text: "Sorry! Something went wrong. Please try again.", type: 'text' }]);
 } finally {
 setIsTyping(false);
 }
 };

 const magicCompose = async () => {
 if (!input.trim() || isTyping) return;
 
 setIsTyping(true);
 try {
 const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
 const response = await ai.models.generateContent({
 model: 'gemini-2.0-flash',
 contents: `Refine this shopping query to be more specific and professional for a shopping assistant: "${input}". Return ONLY the refined query.`,
 });
 const refined = response.text?.trim() || input;
 setInput(refined);
 } catch (error) {
 } finally {
 setIsTyping(false);
 }
 };

 const renderMessage = (m: any, i: number) => {
 if (m.type === 'product' && m.productId) {
 const product = products.find(p => p.id === m.productId);
 if (!product) return null;
 return (
 <div key={i} className="mb-4 ml-2 animate-in fade-in slide-in-from-bottom-2 w-[85%]">
 <div className="bg-background p-3 rounded-2xl border border-foreground/8 shadow-sm flex gap-3 items-center">
 <div className="w-16 h-16 rounded-xl overflow-hidden bg-foreground/8 shrink-0 relative">
 <img src={product.images?.[0]} className="w-full h-full object-cover" alt={product.name} loading="lazy" decoding="async" />
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="font-bold text-[10px] text-foreground truncate mb-0.5">{product.name}</h4>
 <p className="text-[10px] font-black text-brand-600 mb-2">{product.price.toLocaleString()} {CURRENCY}</p>
 <Button variant="brand" size="sm" onClick={() => { addToCart(product); addToast(`Added ${product.name}`, "success"); }} className="h-7 w-full text-[8px] rounded-lg uppercase font-black">Add to Bag</Button>
 </div>
 </div>
 </div>
 );
 }
 return (
 <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} mb-3 animate-in fade-in slide-in-from-bottom-2`}>
 {m.image && (
 <div className="mb-1.5 max-w-[150px] rounded-2xl overflow-hidden border border-foreground/8 shadow-sm">
 <img src={m.image} alt="User upload" className="w-full h-full object-cover" loading="lazy" decoding="async" />
 </div>
 )}
 <div className={`px-3.5 py-2.5 rounded-2xl text-[11px] font-medium shadow-sm max-w-[85%] leading-relaxed ${m.role === 'user' ? 'bg-foreground text-background rounded-tr-none' : 'bg-card border border-foreground/10 rounded-tl-none'}`}>
 {m.role === 'assistant' ? (
 <div className="markdown-body">
 <ReactMarkdown>{m.text}</ReactMarkdown>
 </div>
 ) : (
 m.text
 )}
 </div>
 </div>
 );
 };

 if (!isOpen) {
 return (
 <button onClick={() => setIsOpen(true)} className="fixed bottom-[84px] right-4 md:bottom-6 md:right-4 z-[90] w-12 h-12 bg-foreground text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-500 group animate-in zoom-in">
 <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
 </button>
 );
 }

 return (
 <div className={`fixed bottom-[84px] right-4 md:bottom-4 md:right-4 z-[90] w-[calc(100vw-2rem)] md:w-[360px] transition-all duration-500 ${isMinimized ? 'h-16' : 'h-[480px] md:h-[520px]'} animate-in slide-in-from-bottom-4 shadow-2xl rounded-3xl`}>
 <Card className="flex flex-col h-full rounded-3xl overflow-hidden bg-background/98 backdrop-blur-xl border border-foreground/10 shadow-2xl">
 <div className="px-4 py-3.5 bg-background border-b border-foreground/8 flex justify-between items-center shrink-0 z-20">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
 <Bot className="w-5 h-5 text-white relative z-10" />
 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
 </div>
 <div>
 <h3 className="font-black text-xs uppercase tracking-tight text-foreground">Mali Assistant</h3>
 <div className="flex items-center gap-1.5">
 <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
 <span className="text-[7px] font-bold uppercase tracking-widest text-foreground/40">{isLive ? 'Voice Active' : 'Online'}</span>
 </div>
 </div>
 </div>
 <div className="flex gap-1">
 <button onClick={clearChat} className="p-1.5 hover:bg-foreground/10 rounded-lg" title="Clear Chat">
 <Trash2 className="w-3.5 h-3.5 text-foreground/55" />
 </button>
 <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-foreground/10 rounded-lg">
 {isMinimized ? <Maximize2 className="w-3.5 h-3.5 text-foreground/55" /> : <Minimize2 className="w-3.5 h-3.5 text-foreground/55" />}
 </button>
 <button onClick={() => { stopLiveSession(); setIsOpen(false); }} className="p-1.5 hover:bg-rose-500/10 text-foreground/50 hover:text-rose-500 rounded-lg">
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {!isMinimized && (
 <>
 <div className="flex-1 overflow-y-auto relative bg-foreground/[0.02] no-scrollbar">
 {isLive && (
 <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in">
 <div className="mb-8 relative">
 <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
 <div className="w-16 h-16 rounded-full bg-emerald-500/40 flex items-center justify-center">
 <Mic className="w-8 h-8 text-white" />
 </div>
 </div>
 </div>
 <AudioVisualizer analyser={analyserRef.current} />
 <p className="text-white text-xs font-black uppercase tracking-widest mt-6 mb-8 animate-pulse">Listening...</p>
 <button onClick={stopLiveSession} className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-full text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition-all">End Call</button>
 </div>
 )}
 <div className="p-4 min-h-full" ref={scrollRef}>
 {messages.map((m, i) => renderMessage(m, i))}
 
 {messages.length === 1 && (
 <div className="grid grid-cols-2 gap-2 mt-4 animate-in fade-in slide-in-from-bottom-4">
 {quickActions.map((action, i) => (
 <button 
 key={i}
 onClick={() => handleSend(undefined, action.query)}
 className="flex flex-col items-center justify-center p-3 bg-card border border-foreground/8 rounded-2xl hover:border-emerald-500/50 transition-all group"
 >
 <action.icon className="w-5 h-5 mb-2 text-emerald-600 group-hover:scale-110 transition-transform" />
 <span className="text-[9px] font-black uppercase tracking-widest text-foreground/60">{action.label}</span>
 </button>
 ))}
 </div>
 )}

 {isTyping && (
 <div className="flex items-center gap-1.5 text-foreground/40 text-xs ml-3 animate-pulse mb-3">
 <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></div>
 <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce delay-100"></div>
 <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce delay-200"></div>
 </div>
 )}
 </div>
 </div>
 <div className="p-3 bg-background border-t border-foreground/8 relative z-10 space-y-3">
 <form onSubmit={(e) => handleSend(e)} className="flex gap-2 items-center">
 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-foreground/8 rounded-xl text-foreground/55 hover:text-emerald-600 transition-all flex-shrink-0">
 <Paperclip className="w-4 h-4" />
 </button>
 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
 <div className="flex-1 bg-foreground/8 rounded-2xl flex items-center px-4 min-h-[44px] border-2 border-transparent focus-within:border-emerald-500/20 transition-all gap-2">
 <Input placeholder="Ask anything..." value={input} onChange={e => setInput(e.target.value)} disabled={isLive} className="bg-transparent border-none p-0 h-auto text-[11px] font-bold focus:ring-0 w-full" />
 {input.trim() && !isLive && (
 <button 
 type="button"
 onClick={magicCompose}
 disabled={isTyping}
 className="p-1 text-foreground/40 hover:text-emerald-500 transition-colors disabled:opacity-50"
 title="Magic Compose"
 >
 <Sparkles className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 {input.trim() || attachment ? (
 <Button type="submit" variant="brand" className="h-[44px] w-[44px] p-0 rounded-2xl shadow-lg flex-shrink-0">
 <ArrowRight className="w-5 h-5" />
 </Button>
 ) : (
 <button type="button" onClick={() => isLive ? stopLiveSession() : startLiveSession()} disabled={isConnecting} className={`h-[44px] w-[44px] flex items-center justify-center rounded-2xl transition-all shadow-lg flex-shrink-0 ${isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-foreground text-background'}`}>
 {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />)}
 </button>
 )}
 </form>
 </div>
 </>
 )}
 </Card>
 </div>
 );
};