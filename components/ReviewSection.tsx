import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Star, ThumbsUp, Loader2, User, Camera, X, ChevronDown, ChevronUp, Edit2, Trash2, Flag, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { useAppState } from '../context/AppContext';
import { Textarea, useToast } from './UI';
// Security helpers (inline if module not found)
const sanitizeText = (s: string, max = 2000) => s.replace(/<[^>]*>/g, '').slice(0, max).trim();
const rateLimit = (() => {
  const b = new Map<string,{n:number;t:number}>();
  return (k: string, max = 10) => {
    const now = Date.now(); const e = b.get(k) ?? {n:max,t:now};
    e.n = Math.min(max, e.n + ((now-e.t)/60000)*max); e.t = now; b.set(k,e);
    if (e.n < 1) return false; e.n--; return true;
  };
})();
import { Review } from '../types';

// ─── Reusable star picker ─────────────────────────────────────────────────────
const Stars: React.FC<{ value: number; onChange?: (v: number) => void; size?: 'xs'|'sm'|'md'|'lg' }> = ({
  value, onChange, size = 'sm'
}) => {
  const [hover, setHover] = useState(0);
  const sz = { xs:'w-3 h-3', sm:'w-4 h-4', md:'w-6 h-6', lg:'w-8 h-8' }[size];
  const ro = !onChange;
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" disabled={ro}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => !ro && setHover(s)}
          onMouseLeave={() => !ro && setHover(0)}
          className={ro ? 'cursor-default' : 'hover:scale-110 active:scale-95 transition-transform'}>
          <Star className={`${sz} transition-colors ${(hover || value) >= s ? 'fill-amber-400 text-amber-400' : 'fill-none text-foreground/15'}`}/>
        </button>
      ))}
    </div>
  );
};

// ─── Rating bar row ───────────────────────────────────────────────────────────
const RatingBar: React.FC<{ star: number; count: number; total: number; onClick: () => void }> = ({ star, count, total, onClick }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 group py-0.5">
      <span className="text-[11px] font-bold text-foreground/40 w-3 shrink-0 text-right">{star}</span>
      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0"/>
      <div className="flex-1 h-1.5 bg-foreground/[0.07] rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full ${pct > 60 ? 'bg-amber-400' : pct > 30 ? 'bg-amber-300' : 'bg-foreground/20'}`}/>
      </div>
      <span className="text-[10px] text-foreground/25 w-4 text-right shrink-0">{count}</span>
    </button>
  );
};

interface ReviewSectionProps { productId: string; }

export const ReviewSection: React.FC<ReviewSectionProps> = ({ productId }) => {
  const { user } = useAppState();
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [reviews, setReviews]       = useState<Review[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [sortBy, setSortBy]         = useState<'newest'|'highest'|'lowest'|'helpful'>('newest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId]   = useState<string|null>(null);
  const [votedIds, setVotedIds]     = useState<Set<string>>(new Set());

  const [form, setForm]     = useState({ rating: 5, comment: '', images: [] as string[] });
  const [editForm, setEditForm] = useState({ rating: 5, comment: '' });

  // Load voted set from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`mm_rv_${productId}`);
      if (raw) setVotedIds(new Set(JSON.parse(raw)));
    } catch {}
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('*, user:profiles!user_id(id, full_name, avatar_url)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (data) setReviews(data as Review[]);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, [productId]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]; // index 0 = 1-star, 4 = 5-star
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
    return { avg, total: reviews.length, dist };
  }, [reviews]);

  const sorted = useMemo(() => {
    const a = [...reviews];
    if (sortBy === 'highest') return a.sort((x, y) => y.rating - x.rating);
    if (sortBy === 'lowest')  return a.sort((x, y) => x.rating - y.rating);
    if (sortBy === 'helpful') return a.sort((x, y) => (y.helpful_count || 0) - (x.helpful_count || 0));
    return a;
  }, [reviews, sortBy]);

  const userHasReviewed = reviews.some(r => (r as any).user?.id === user?.id);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg','image/png','image/webp'];
    if (!ALLOWED.includes(file.type)) { addToast('Use JPG, PNG, or WebP', 'error'); return; }
    if (file.size > 10*1024*1024) { addToast('Max 10 MB per photo', 'error'); return; }
    if (form.images.length >= 3) { addToast('Max 3 photos', 'error'); return; }
    setUploading(true);
    try {
      const path = `reviews/${productId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error } = await supabase.storage.from('mali-mart-uploads').upload(path, await compressImage(file), { upsert: false, cacheControl: IMMUTABLE_CACHE });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
      if (pub?.publicUrl) setForm(p => ({ ...p, images: [...p.images, pub.publicUrl] }));
      addToast('Photo added', 'success');
    } catch { addToast('Upload failed — try again', 'error'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return addToast('Sign in to leave a review', 'error');
    if (userHasReviewed) return addToast('You already reviewed this product', 'error');
    const comment = sanitizeText(form.comment, 2000);
    if (comment.length < 10) return addToast('Write at least 10 characters', 'error');
    if (!rateLimit(`review:${user.id}`, 3)) return addToast('Too many submissions — wait a moment', 'error');
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        product_id: productId, user_id: user.id,
        rating: form.rating, comment, images: form.images,
        helpful_count: 0,
      });
      if (error) throw error;
      // Best-effort rating aggregate update via RPC
      supabase.rpc('update_product_rating', { p_product_id: productId })
        .then(() => {}, () => {});
      addToast('Review published — thank you!', 'success');
      setForm({ rating: 5, comment: '', images: [] });
      setShowForm(false);
      fetchReviews();
    } catch { addToast('Failed to submit review', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleSaveEdit = async (reviewId: string) => {
    if (!editForm.comment.trim()) return addToast('Comment required', 'error');
    try {
      await supabase.from('reviews')
        .update({ rating: editForm.rating, comment: sanitizeText(editForm.comment, 2000), updated_at: new Date().toISOString() })
        .eq('id', reviewId).eq('user_id', user?.id);
      addToast('Review updated', 'success');
      setEditingId(null);
      fetchReviews();
    } catch { addToast('Update failed', 'error'); }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user?.id);
      addToast('Review deleted', 'success');
      fetchReviews();
    } catch { addToast('Delete failed', 'error'); }
  };

  const handleHelpful = async (review: Review) => {
    if (votedIds.has(review.id)) return;
    const newCount = (review.helpful_count || 0) + 1;
    setReviews(prev => prev.map(r => r.id === review.id ? { ...r, helpful_count: newCount } : r));
    const next = new Set([...votedIds, review.id]);
    setVotedIds(next);
    try {
      const { error } = await supabase.from('reviews').update({ helpful_count: newCount }).eq('id', review.id);
      if (error) throw error;
      localStorage.setItem(`mm_rv_${productId}`, JSON.stringify([...next]));
    } catch {
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, helpful_count: review.helpful_count || 0 } : r));
      setVotedIds(votedIds);
      addToast('Could not save your vote — please try again', 'error');
    }
  };

  const handleReport = async (reviewId: string) => {
    if (!user) return addToast('Sign in to report', 'error');
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: reviewId,
      category: 'review',
      reason: 'Inappropriate content',
    });
    if (error) { addToast('Report failed', 'error'); return; }
    addToast('Report submitted', 'success');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 font-sans">

      {/* ── Summary row ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">

        {/* Big average */}
        <div className="flex flex-col items-center justify-center min-w-[100px] pt-1">
          <p className="text-5xl font-black text-foreground leading-none">
            {stats.avg > 0 ? stats.avg.toFixed(1) : '—'}
          </p>
          <Stars value={Math.round(stats.avg)} size="xs"/>
          <p className="text-[10px] text-foreground/35 mt-1 font-medium">{stats.total} review{stats.total !== 1 ? 's' : ''}</p>
        </div>

        {/* Distribution bars */}
        <div className="flex-1 space-y-1 py-1">
          {[5,4,3,2,1].map((star, i) => (
            <RatingBar key={star} star={star} count={stats.dist[star-1]} total={stats.total}
              onClick={() => setSortBy(star >= 4 ? 'highest' : 'lowest')}/>
          ))}
        </div>

        {/* Write review CTA */}
        {user && !userHasReviewed && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="self-start sm:self-center shrink-0 h-10 px-5 rounded-2xl bg-foreground text-background text-xs font-bold hover:bg-foreground/85 transition-colors active:scale-[0.97]">
            Write Review
          </button>
        )}
      </div>

      {/* ── Review form ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.form onSubmit={handleSubmit}
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
            className="bg-foreground/[0.03] border border-foreground/10 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground text-sm">Your Review</h4>
              <button type="button" onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-full bg-foreground/[0.07] flex items-center justify-center text-foreground/40 hover:bg-foreground/10">
                <X className="w-3.5 h-3.5 stroke-[2.5]"/>
              </button>
            </div>

            {/* Stars */}
            <div className="flex items-center gap-3">
              <Stars value={form.rating} onChange={r => setForm(p => ({...p, rating:r}))} size="lg"/>
              <span className="text-sm text-foreground/45 font-medium">
                {['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'][form.rating]}
              </span>
            </div>

            {/* Comment */}
            <div>
              <Textarea value={form.comment} onChange={(e:any) => setForm(p => ({...p, comment:e.target.value}))}
                placeholder="Describe your experience — quality, packaging, delivery speed…"
                className="min-h-[90px] rounded-2xl text-sm resize-none"/>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-foreground/25">Min 10 characters</span>
                <span className={`text-[10px] ${form.comment.length >= 10 ? 'text-emerald-500' : 'text-foreground/25'}`}>
                  {form.comment.length}/2000
                </span>
              </div>
            </div>

            {/* Photo upload */}
            <div>
              <p className="text-[10px] font-semibold text-foreground/40 mb-2 uppercase tracking-wide">
                Photos <span className="text-foreground/25 font-normal">(optional, up to 3)</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {form.images.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-foreground/[0.04]">
                    <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                    <button type="button" onClick={() => setForm(p => ({...p, images:p.images.filter((_,j)=>j!==i)}))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
                      <X className="w-2.5 h-2.5 text-white stroke-[3]"/>
                    </button>
                  </div>
                ))}
                {form.images.length < 3 && (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-foreground/15 flex flex-col items-center justify-center cursor-pointer hover:border-foreground/30 hover:bg-foreground/[0.03] transition-all text-foreground/30">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4"/>}
                    <span className="text-[8px] mt-0.5">Add</span>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={handleImageUpload} disabled={uploading}/>
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 h-11 rounded-2xl bg-foreground/[0.06] text-foreground/55 text-sm font-semibold hover:bg-foreground/10 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting || form.comment.length < 10}
                className="flex-[2] h-11 rounded-2xl bg-foreground text-background text-sm font-bold disabled:opacity-40 hover:bg-foreground/85 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin"/> Posting…</>
                  : 'Publish Review'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Sort bar ────────────────────────────────────────────────────── */}
      {reviews.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-foreground/30 font-semibold uppercase tracking-wide">Sort:</span>
          {(['newest','helpful','highest','lowest'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all capitalize ${sortBy===s ? 'bg-foreground text-background' : 'bg-foreground/[0.06] text-foreground/45 hover:bg-foreground/10'}`}>
              {s === 'newest' ? 'Newest' : s === 'helpful' ? 'Most helpful' : s === 'highest' ? 'Highest rated' : 'Lowest rated'}
            </button>
          ))}
        </div>
      )}

      {/* ── Review list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 shimmer rounded-2xl"/>)}</div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-12 border border-dashed border-foreground/10 rounded-3xl text-foreground/30 gap-2">
          <MessageSquare className="w-8 h-8 opacity-20"/>
          <p className="text-sm font-semibold">No reviews yet</p>
          <p className="text-xs">Be the first to share your experience</p>
          {user && !userHasReviewed && (
            <button onClick={() => setShowForm(true)}
              className="mt-2 h-9 px-5 rounded-full bg-foreground text-background text-xs font-bold hover:bg-foreground/85 transition-colors">
              Write the first review
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map(review => {
            const isOwn      = (review as any).user?.id === user?.id;
            const isEditing  = editingId === review.id;
            const isExpanded = expandedIds.has(review.id);
            const isLong     = (review.comment?.length || 0) > 200;
            const voted      = votedIds.has(review.id);

            return (
              <motion.article key={review.id}
                initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                className="bg-foreground/[0.02] border border-foreground/8 rounded-2xl p-4 md:p-5 space-y-3 group">

                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-foreground/[0.07] overflow-hidden shrink-0 flex items-center justify-center">
                    {(review as any).user?.avatar_url
                      ? <img src={(review as any).user.avatar_url} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                      : <span className="text-sm font-black text-foreground/35">{((review as any).user?.full_name || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{(review as any).user?.full_name || 'Verified Buyer'}</p>
                      <span className="text-[10px] text-foreground/30 font-medium shrink-0">
                        {new Date(review.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                        {review.updated_at && review.updated_at !== review.created_at && ' (edited)'}
                      </span>
                    </div>
                    <Stars value={review.rating} size="xs"/>
                  </div>
                  {/* Owner controls */}
                  {isOwn && !isEditing && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => { setEditingId(review.id); setEditForm({rating:review.rating,comment:review.comment}); }}
                        className="w-7 h-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-colors">
                        <Edit2 className="w-3 h-3 stroke-[2]"/>
                      </button>
                      <button onClick={() => handleDelete(review.id)}
                        className="w-7 h-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center text-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="w-3 h-3 stroke-[2]"/>
                      </button>
                    </div>
                  )}
                </div>

                {/* Comment / edit form */}
                {isEditing ? (
                  <div className="space-y-3">
                    <Stars value={editForm.rating} onChange={r => setEditForm(p=>({...p,rating:r}))} size="md"/>
                    <Textarea value={editForm.comment} onChange={(e:any)=>setEditForm(p=>({...p,comment:e.target.value}))}
                      className="text-sm rounded-xl min-h-[70px] resize-none"/>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingId(null)}
                        className="flex-1 h-9 rounded-xl bg-foreground/[0.06] text-foreground/55 text-xs font-semibold hover:bg-foreground/10 transition-colors">
                        Cancel
                      </button>
                      <button type="button" onClick={() => handleSaveEdit(review.id)}
                        className="flex-[2] h-9 rounded-xl bg-foreground text-background text-xs font-bold hover:bg-foreground/85 transition-colors">
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className={`text-sm text-foreground/70 leading-relaxed ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                      {review.comment}
                    </p>
                    {isLong && (
                      <button onClick={() => {
                        const next = new Set(expandedIds);
                        isExpanded ? next.delete(review.id) : next.add(review.id);
                        setExpandedIds(next);
                      }} className="flex items-center gap-1 text-[11px] font-semibold text-foreground/35 hover:text-foreground mt-1 transition-colors">
                        {isExpanded ? <><ChevronUp className="w-3 h-3"/>Show less</> : <><ChevronDown className="w-3 h-3"/>Read more</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Photos */}
                {(review as any).images?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {(review as any).images.map((img:string, i:number) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer"
                        className="w-16 h-16 rounded-xl overflow-hidden bg-foreground/[0.04] hover:opacity-80 transition-opacity shrink-0">
                        <img src={img} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
                      </a>
                    ))}
                  </div>
                )}

                {/* Footer actions */}
                {!isEditing && (
                  <div className="flex items-center gap-4 pt-1 border-t border-foreground/5">
                    <button onClick={() => handleHelpful(review)} disabled={voted}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${voted ? 'text-emerald-500' : 'text-foreground/30 hover:text-foreground/60'}`}>
                      <ThumbsUp className={`w-3.5 h-3.5 stroke-[2] ${voted ? 'fill-current' : ''}`}/>
                      Helpful{review.helpful_count ? ` (${review.helpful_count})` : ''}
                    </button>
                    {!isOwn && (
                      <button onClick={() => handleReport(review.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-foreground/20 hover:text-rose-500 transition-colors ml-auto">
                        <Flag className="w-3 h-3 stroke-[2]"/> Report
                      </button>
                    )}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
};
