import React from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Tag, Zap, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { DealCard } from './DealCard';
import { Product } from '../../types';
import { formatTZS } from '../../constants';

interface DealsTabProps {
  activeDeals: any[];
  products: Product[];
}

export const DealsTab: React.FC<DealsTabProps> = ({ activeDeals, products }) => {
  const navigate = useNavigate();
  const saleProducts = products.filter(p => p.base_price && p.price < p.base_price);

  return (
    <motion.div key="deals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      {activeDeals.length === 0 ? (
        <div className="flex flex-col items-center py-20 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
          <Tag className="w-10 h-10 mb-3 opacity-20" />
          <p className="font-semibold text-sm">No active deals right now</p>
          <p className="text-xs mt-1">Check back soon — new deals drop weekly.</p>
          <Link to="/shop" className="mt-4 text-xs font-bold text-emerald-500">Browse all products</Link>
        </div>
      ) : (
        <>
          {activeDeals.some(o => o.is_flash_sale) && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-rose-500 fill-current" />
                <h2 className="font-bold text-foreground">Flash Sales</h2>
                <span className="text-[10px] text-foreground/35 font-medium">Limited time</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeals.filter(o => o.is_flash_sale).map(o => <DealCard key={o.id} offer={o} />)}
              </div>
            </div>
          )}

          {activeDeals.some(o => o.is_auto_apply && !o.is_flash_sale) && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h2 className="font-bold text-foreground">Auto-Applied Savings</h2>
                <span className="text-[10px] text-foreground/35 font-medium">No code needed</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeals.filter(o => o.is_auto_apply && !o.is_flash_sale).map(o => <DealCard key={o.id} offer={o} />)}
              </div>
            </div>
          )}

          {activeDeals.some(o => !o.is_auto_apply && o.code) && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-foreground/50" />
                <h2 className="font-bold text-foreground">Coupon Codes</h2>
                <span className="text-[10px] text-foreground/35 font-medium">Enter at checkout</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeals.filter(o => !o.is_auto_apply && o.code).map(o => <DealCard key={o.id} offer={o} />)}
              </div>
            </div>
          )}
        </>
      )}

      {saleProducts.length > 0 && (
        <div className="pt-6 border-t border-foreground/8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-foreground/50" />
              <h2 className="font-bold text-foreground">On Sale Now</h2>
            </div>
            <Link to="/shop" className="text-xs font-bold text-emerald-500 flex items-center gap-1">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {saleProducts.slice(0, 6).map(p => (
              <button key={p.id} onClick={() => navigate(`/product/${p.id}`)} className="text-left group">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-foreground/[0.04] mb-2">
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" loading="lazy" decoding="async" />
                  )}
                  <div className="absolute top-1.5 left-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    -{Math.round((1 - p.price / p.base_price!) * 100)}%
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-foreground truncate">{p.name}</p>
                <p className="text-[11px] font-bold text-emerald-600">{formatTZS(p.price)}</p>
                <p className="text-[10px] text-foreground/35 line-through">{formatTZS(p.base_price!)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
