import { safeJsonParse } from '../src/security';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight, TrendingUp, Tag, Clock, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { formatTZS } from '../constants';
import { useDebounce } from '../src/hooks/useDebounce';
import { supabase } from '../services/supabaseClient';
import { getAI } from '../services/aiClient';
import { MODELS } from '../services/aiModels';

interface SearchModalProps {
 isSearchOpen: boolean;
 setIsSearchOpen: (isOpen: boolean) => void;
 searchQuery: string;
 setSearchQuery: (query: string) => void;
 handleSearch: (e: React.FormEvent) => void;
 isSearching: boolean;
 searchResults: { products: any[]; categories: string[] };
 searchInputRef: React.RefObject<HTMLInputElement>;
}

const RECENT_KEY = 'malimart:recent-searches';

/**
 * Mobile-first full-screen search.
 *
 * No giant editorial heading (the previous version had a 7xl placeholder
 * input — looked dated, wasted vertical space on mobile).
 *
 * Structure:
 * - Compact pill input at top with close button
 * - If no query: trending categories + recent searches + popular products grid
 * - If query: inline results filtered from local products
 *
 * Esc + click backdrop both close.
 */
export const SearchModal = ({
 isSearchOpen,
 setIsSearchOpen,
 searchQuery,
 setSearchQuery,
 handleSearch,
 isSearching,
 searchInputRef,
}: SearchModalProps) => {
 const navigate = useNavigate();
 const { products } = useAppState();

 // Debounce prevents per-keystroke filtering
 const debouncedQuery = useDebounce(searchQuery, 300);

 // Server-side search: full-catalog coverage beyond the 60-item context cache
 const [serverResults, setServerResults] = useState<any[]>([]);
 const [serverSearching, setServerSearching] = useState(false);

 useEffect(() => {
   const q = debouncedQuery.trim();
   if (q.length < 2) { setServerResults([]); return; }
   let cancelled = false;
   setServerSearching(true);
   (async () => {
     try {
       const { data } = await supabase
         .from('products')
         .select('id,name,price,images,category,seller_name,seller_id,status')
         .eq('status', 'active')
         .is('deleted_at', null)
         .or(`name.ilike.%${q}%,category.ilike.%${q}%,seller_name.ilike.%${q}%`)
         .limit(12);
       if (!cancelled) { setServerResults(data ?? []); setServerSearching(false); }
     } catch {
       if (!cancelled) setServerSearching(false);
     }
   })();
   return () => { cancelled = true; };
 }, [debouncedQuery]);

 // AI intent parsing — interprets natural language queries
 const [aiIntent, setAiIntent] = useState<{ keywords: string; note: string; maxPrice?: number } | null>(null);
 const aiIntentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const lastParsedQuery = useRef('');

 useEffect(() => {
   const q = debouncedQuery.trim();
   if (q.length < 5 || q === lastParsedQuery.current) return;
   // Only trigger AI for natural-language-looking queries (contains space or price words)
   const looksNatural = /\s/.test(q) || /\d{3,}|cheap|under|below|best|good|affordable/i.test(q);
   if (!looksNatural) { setAiIntent(null); return; }
   if (aiIntentTimer.current) clearTimeout(aiIntentTimer.current);
   aiIntentTimer.current = setTimeout(async () => {
     lastParsedQuery.current = q;
     try {
       const ai = getAI();
       const res = await ai.models.generateContent({
         model: MODELS.FAST,
         contents: [{ role: 'user', parts: [{ text: `You are a search assistant for MaliMart, a Tanzanian e-commerce marketplace. The user typed this search query: "${q}". Extract structured intent as JSON with these fields: keywords (main search term, 1-3 words), note (what you understood, max 8 words), maxPrice (number in TZS if mentioned, else null). Respond ONLY with valid JSON, no markdown.` }] }],
         config: { maxOutputTokens: 80 },
       });
       const text = (res.text ?? '').trim().replace(/```json|```/g, '');
       const parsed = JSON.parse(text);
       if (parsed?.keywords) setAiIntent(parsed);
     } catch { /* silent */ }
   }, 600);
   return () => { if (aiIntentTimer.current) clearTimeout(aiIntentTimer.current); };
 }, [debouncedQuery]);

 // When aiIntent changes, refine server search with extracted keywords
 useEffect(() => {
   if (!aiIntent?.keywords) return;
   const q = aiIntent.keywords;
   let cancelled = false;
   setServerSearching(true);
   (async () => {
     try {
       let query = supabase.from('products').select('id,name,price,images,category,seller_name,seller_id,status').eq('status', 'active').is('deleted_at', null).or(`name.ilike.%${q}%,category.ilike.%${q}%,seller_name.ilike.%${q}%`);
       if (aiIntent.maxPrice) query = query.lte('price', aiIntent.maxPrice);
       const { data } = await query.limit(12);
       if (!cancelled) setServerResults(data ?? []);
     } catch { /* silent */ }
     finally { if (!cancelled) setServerSearching(false); }
   })();
   return () => { cancelled = true; };
 }, [aiIntent]);

 // Merge: local in-memory results first, then any server-only results not in context
 const liveResults = useMemo(() => {
   const q = debouncedQuery.trim().toLowerCase();
   if (!q || q.length < 2) return [];
   const local = products.filter(p =>
     p.name?.toLowerCase().includes(q) ||
     p.category?.toLowerCase().includes(q) ||
     p.seller_name?.toLowerCase().includes(q)
   );
   const localIds = new Set(local.map(p => p.id));
   const serverOnly = serverResults.filter(p => !localIds.has(p.id));
   return [...local, ...serverOnly].slice(0, 8);
 }, [debouncedQuery, products, serverResults]);

 // Popular products (rating × reviews)
 const popularProducts = useMemo(() => {
 return [...products]
 .sort((a, b) => (b.rating || 0) * (b.review_count || 0) - (a.rating || 0) * (a.review_count || 0))
 .slice(0, 6);
 }, [products]);

 const trendingTags = useMemo(() => {
 const tagSet = new Set<string>();
 products.forEach(p => p.category && tagSet.add(p.category));
 return Array.from(tagSet).slice(0, 8);
 }, [products]);

 // Recent searches (localStorage)
 const [recent, setRecent] = useState<string[]>([]);
 useEffect(() => {
 if (!isSearchOpen) return;
 try {
 const raw = localStorage.getItem(RECENT_KEY);
 setRecent(raw ? safeJsonParse(raw, null) : []);
 } catch { setRecent([]); }
 }, [isSearchOpen]);

 const pushRecent = (q: string) => {
 if (!q.trim()) return;
 const next = [q, ...recent.filter(r => r !== q)].slice(0, 5);
 setRecent(next);
 try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
 };

 // Focus input on open
 useEffect(() => {
 if (!isSearchOpen) return;
 const t = setTimeout(() => searchInputRef.current?.focus(), 120);
 document.body.style.overflow = 'hidden';
 const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setIsSearchOpen(false);
 window.addEventListener('keydown', onEsc);
 return () => {
 clearTimeout(t);
 document.body.style.overflow = '';
 window.removeEventListener('keydown', onEsc);
 };
 }, [isSearchOpen, setIsSearchOpen, searchInputRef]);

 const goToShop = (q: string) => {
 pushRecent(q);
 navigate(`/shop?q=${encodeURIComponent(q)}`);
 setIsSearchOpen(false);
 };

 return (
 <AnimatePresence>
 {isSearchOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="fixed inset-0 z-[120] bg-background flex flex-col"
 >
 {/* Header */}
 <div className="flex items-center gap-2 p-4 md:p-5 border-b border-foreground/8">
 <form onSubmit={(e) => { pushRecent(searchQuery); handleSearch(e); }} className="flex-1 relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/45 stroke-[2.2]" />
 <input
 ref={searchInputRef}
 type="text"
 placeholder="Search products, brands, sellers…"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 className="w-full h-12 pl-11 pr-12 rounded-xl bg-foreground/[0.04] text-foreground text-[15px] font-medium placeholder:text-foreground/40 focus:outline-none focus:bg-foreground/[0.07] transition-colors"
 />
 {searchQuery && (
 <button
 type="button"
 onClick={() => setSearchQuery('')}
 aria-label="Clear search"
 className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/15 flex items-center justify-center"
 >
 <X className="w-3.5 h-3.5 stroke-[2.5]" />
 </button>
 )}
 </form>
 <button
 onClick={() => setIsSearchOpen(false)}
 className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70 hover:text-foreground px-3 flex-shrink-0"
 >
 Cancel
 <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-[10px] font-mono text-foreground/35 border border-foreground/10">
   Esc
 </kbd>
 </button>
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto">
 {/* Live results */}
 {searchQuery.trim().length >= 2 && (
 <div className="px-4 md:px-5 py-4">
 {serverSearching ? (
 <div className="flex items-center justify-center py-12 text-foreground/45">
 <Loader2 className="w-5 h-5 animate-spin mr-2" /> Searching…
 </div>
 ) : liveResults.length === 0 ? (
 <div className="text-center py-12">
   {aiIntent && (
     <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-4">
       <Sparkles className="w-3 h-3" />
       <span>AI: {aiIntent.note}</span>
       {aiIntent.maxPrice && <span className="opacity-60">· under {formatTZS(aiIntent.maxPrice)}</span>}
     </div>
   )}
 <p className="text-sm text-foreground/55">
 No results for <span className="font-semibold text-foreground">"{searchQuery}"</span>.
 </p>
 <button
 onClick={() => goToShop(searchQuery)}
 className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
 >
 Search all of MaliMart
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>
 ) : (
 <>
 <AnimatePresence>
   {aiIntent && (
     <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
       className="flex items-center gap-2 mb-3">
       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
         <Sparkles className="w-3 h-3" />
         <span>{aiIntent.note}</span>
         {aiIntent.maxPrice && <span className="opacity-60">· under {formatTZS(aiIntent.maxPrice)}</span>}
       </div>
       <button onClick={() => setAiIntent(null)} className="text-foreground/30 hover:text-foreground/60 transition-colors">
         <X className="w-3 h-3" />
       </button>
     </motion.div>
   )}
 </AnimatePresence>
 <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-3">
 Matching products
 </p>
 <div className="space-y-2">
 {liveResults.map(p => (
 <button
 key={p.id}
 onClick={() => { setIsSearchOpen(false); navigate(`/product/${p.id}`); pushRecent(p.name); }}
 className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-foreground/[0.04] text-left transition-colors"
 >
 <img src={p.images?.[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover bg-foreground/5 flex-shrink-0" loading="lazy" decoding="async" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
 <p className="text-[12px] text-foreground/50 truncate">{p.seller_name} · {p.category}</p>
 </div>
 <span className="text-sm font-bold text-foreground tabular-nums flex-shrink-0">
 {formatTZS(Math.round(p.price))}
 </span>
 </button>
 ))}
 </div>
 <button
 onClick={() => goToShop(searchQuery)}
 className="w-full mt-4 h-12 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.07] text-sm font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
 >
 See all results for "{searchQuery}"
 <ArrowRight className="w-4 h-4 stroke-[2.2]" />
 </button>
 </>
 )}
 </div>
 )}

 {/* Empty state */}
 {searchQuery.trim().length < 2 && (
 <div className="px-4 md:px-5 py-4 space-y-7">
 {recent.length > 0 && (
 <section>
 <div className="flex items-center justify-between mb-2.5">
   <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 flex items-center gap-1.5">
     <Clock className="w-3.5 h-3.5" /> Recent
   </p>
   <button
     onClick={() => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch {} }}
     className="flex items-center gap-1 text-[11px] text-foreground/35 hover:text-foreground/60 transition-colors"
   >
     <Trash2 className="w-3 h-3" /> Clear
   </button>
 </div>
 <div className="flex flex-wrap gap-2">
 {recent.map(r => (
 <button
 key={r}
 onClick={() => goToShop(r)}
 className="px-3 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[13px] font-medium text-foreground transition-colors"
 >
 {r}
 </button>
 ))}
 </div>
 </section>
 )}

 {trendingTags.length > 0 && (
 <section>
 <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-2.5 flex items-center gap-1.5">
 <Tag className="w-3.5 h-3.5" /> Categories
 </p>
 <div className="flex flex-wrap gap-2">
 {trendingTags.map(t => (
 <button
 key={t}
 onClick={() => { setIsSearchOpen(false); navigate(`/shop?category=${encodeURIComponent(t)}`); }}
 className="px-3 py-1.5 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[13px] font-medium text-foreground transition-colors"
 >
 {t}
 </button>
 ))}
 </div>
 </section>
 )}

 {popularProducts.length > 0 && (
 <section>
 <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45 mb-3 flex items-center gap-1.5">
 <TrendingUp className="w-3.5 h-3.5" /> Trending products
 </p>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 {popularProducts.map(p => (
 <button
 key={p.id}
 onClick={() => { setIsSearchOpen(false); navigate(`/product/${p.id}`); }}
 className="text-left group"
 >
 <div className="aspect-square rounded-xl overflow-hidden bg-foreground/5 mb-2">
 <img src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" loading="lazy" decoding="async" />
 </div>
 <p className="text-[13px] font-semibold text-foreground line-clamp-1">{p.name}</p>
 <p className="text-xs font-bold text-foreground/70 tabular-nums">{formatTZS(p.price)}</p>
 </button>
 ))}
 </div>
 </section>
 )}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};
