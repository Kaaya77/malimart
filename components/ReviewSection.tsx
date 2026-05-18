
import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, ThumbsUp, Loader2, Sparkles, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';
// Added Skeleton to the imports from UI
import { Button, Input, Textarea, Badge, useToast, Card, Skeleton } from './UI';
import { Review } from '../types';

interface ReviewSectionProps {
  productId: string;
}

export const ReviewSection = ({ productId }: ReviewSectionProps) => {
  const { user } = useAppState();
  const { addToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [showForm, setShowForm] = useState(false);

  const fetchReviews = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*, user:profiles(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    
    if (data) setReviews(data as Review[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return addToast("Login to review", "error");
    if (!newReview.comment) return addToast("Comment is required", "error");

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        product_id: productId,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment
      });

      if (error) throw error;
      addToast("Review shared!", "success");
      setNewReview({ rating: 5, comment: '' });
      setShowForm(false);
      fetchReviews();
    } catch (e) {
      addToast("Failed to submit review", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
        <h3 className="font-sans text-2xl font-extrabold">Reviews</h3>
        {!showForm && user && (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)} className="text-sm font-bold bg-foreground/5 px-4 py-2 rounded-full hover:bg-foreground/10 transition-colors">
            Write a Review
          </motion.button>
        )}
      </div>

      {showForm && (
        <div className="p-6 bg-foreground/5 rounded-2xl animate-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-foreground/60">Your Rating</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star} 
                    type="button" 
                    onClick={() => setNewReview({...newReview, rating: star})}
                    className={`transition-transform hover:scale-110 ${newReview.rating >= star ? 'text-yellow-400' : 'text-foreground/20'}`}
                  >
                    <Star className={`w-8 h-8 ${newReview.rating >= star ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
            </div>
            
            <Textarea 
              placeholder="Tell others about your experience..." 
              value={newReview.comment} 
              onChange={e => setNewReview({...newReview, comment: e.target.value})}
              className="h-32 bg-background border-transparent focus:border-primary rounded-xl text-base font-medium placeholder:opacity-40"
            />

            <div className="flex flex-col gap-3">
                  <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" disabled={isSubmitting} className="w-full h-12 bg-primary text-primary-foreground rounded-full text-base font-extrabold shadow-md disabled:opacity-50">
                      {isSubmitting ? 'Posting...' : 'Post Review'}
                  </motion.button>
                  <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button" onClick={() => setShowForm(false)} className="w-full h-12 bg-foreground/5 text-foreground rounded-full text-base font-extrabold hover:bg-foreground/10 transition-colors">
                      Cancel
                  </motion.button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map(i => <div key={i} className="h-24 w-full bg-foreground/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 bg-foreground/5 rounded-2xl">
          <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold text-foreground/60">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map(review => (
            <div key={review.id} className="p-6 bg-foreground/5 rounded-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm">
                    <User className="w-5 h-5 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{review.user?.full_name || 'Verified Client'}</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-foreground/20'}`} />)}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-foreground/40">{new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <p className="text-base leading-relaxed font-medium text-foreground/80">{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
