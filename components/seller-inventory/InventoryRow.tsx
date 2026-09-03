import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Plus, Zap, Trash2,
  CheckSquare, Square, Copy, Package, X,
  Download, ArrowUpDown, History, Layers,
  DollarSign, BarChart3, AlertCircle, Clock,
  Percent, Upload, ChevronDown, ChevronUp,
  RefreshCw, Edit2, ToggleLeft, ToggleRight,
  Minus, TrendingUp, TrendingDown, Loader2,
  GripVertical, MoreHorizontal, Star, Eye,
  Check, AlertTriangle, ArrowUpRight, Wand2, Share2,
  RotateCcw
} from 'lucide-react';
import { useToast } from '../UI';
import { Product } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';
import { supabase } from '../../services/supabaseClient';
import { withCache, invalidate, TTL } from '../../services/queryCache';
import { STATUS_CFG, REASON_LABELS, timeAgo } from './config';
import type { InventoryProduct, InventoryMovement } from './config';

import { MovementHistory } from './MovementHistory';
import { ProductShare } from '../ProductShare';

export interface RowModeration {
  takedown_reason?: string | null;
  appeal?: {
    status: 'pending' | 'approved' | 'rejected';
    admin_response?: string | null;
    created_at?: string;
  } | null;
}

export const InventoryRow = ({
  product, isSelected, onSelect, onEdit, onArchive, onRestore,
  onToggleStatus, onToggleBoost, onDuplicate, onStockAdjust,
  onDragStart, onDragOver, onDrop, onCreatePromo, onAutoDiscount, onQuickAdjust,
  updating, moderation, onAppeal,
}: {
  product: InventoryProduct;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (p: InventoryProduct) => void;
  onArchive: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleStatus: (p: InventoryProduct) => void;
  onToggleBoost: (p: InventoryProduct) => void;
  onDuplicate: (p: InventoryProduct) => void;
  onStockAdjust: (p: InventoryProduct) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onCreatePromo: (p: InventoryProduct) => void;
  onAutoDiscount: (p: InventoryProduct) => void;
  /** Instant +/-1, no modal — the row buttons promise this, so they must do it. */
  onQuickAdjust: (p: InventoryProduct, delta: 1 | -1) => void;
  updating: boolean;
  moderation?: RowModeration | null;
  onAppeal?: (p: InventoryProduct) => void;
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { addToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const cfg = STATUS_CFG[product.status] || STATUS_CFG.draft;
  const variants = (product as any).variants || [];
  const hasVariants = variants.length > 0;
  const displayPrice = product.sale_price && product.sale_price < product.price
    ? product.sale_price : product.price;
  const margin = product.cost_price && displayPrice
    ? ((displayPrice - product.cost_price) / displayPrice * 100)
    : 0;
  // Was `stock / Math.max(stock, 50) * 100` — for any stock >= 50 that is
  // `stock / stock`, i.e. ALWAYS exactly 100%. A product with 51 units and one
  // with 5,000 rendered an identical full bar; the bar could never distinguish
  // "healthy" from "wildly overstocked", and stopped moving right when it
  // would have started being useful. Scaled against the seller's own reorder
  // point instead, so it reads relative to what "enough stock" means for THIS
  // product rather than a flat, arbitrary ceiling.
  const stockReference = Math.max((product.low_stock_threshold || 5) * 4, 20);
  const stockPct = Math.min(100, Math.max(0, (product.stock / stockReference) * 100));

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCopySku = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.sku) {
      navigator.clipboard.writeText(product.sku);
      addToast('SKU copied', 'success');
    }
  };

  // Unified share experience: open the ProductShare sheet (channels + poster).
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setShareOpen(true);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: updating ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2 }}
      draggable
      onDragStart={(e: any) => onDragStart(e, product.id)}
      onDragOver={(e: any) => onDragOver(e)}
      onDrop={(e: any) => onDrop(e, product.id)}
      className={`group relative border-b border-foreground/5 last:border-0 transition-colors ${
        isSelected ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-foreground/[0.02]'
      } ${updating ? 'pointer-events-none' : ''}`}
    >
      {/* Mobile layout */}
      <div className="flex md:hidden items-center gap-3 p-3.5">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.05] flex-shrink-0 cursor-pointer" onClick={() => onEdit(product)}>
          {product.images?.[0]
            ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" loading="lazy" />
            : <Package className="w-5 h-5 text-foreground/20 m-auto mt-3.5" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            {product.status !== 'archived' && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                product.stock === 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                product.is_low_stock ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
              }`}>
                {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
              </span>
            )}
          </div>
          {product.status !== 'archived' && (
            <p className="text-[10px] text-foreground/35 mt-0.5">{formatTZS(displayPrice)}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {product.status === 'archived' ? (
            <button onClick={() => onRestore?.(product.id)}
              className="h-9 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 active:scale-90">
              <RotateCcw className="w-3.5 h-3.5" />Restore
            </button>
          ) : (
            <>
              <button onClick={() => onStockAdjust(product)}
                className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 active:scale-90">
                <BarChart3 className="w-4 h-4" />
              </button>
              <button onClick={() => onEdit(product)}
                className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 active:scale-90">
                <Edit2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid items-center p-4 gap-4" style={{ gridTemplateColumns: '28px 28px 56px 1fr 140px 180px 110px 120px' }}>

        {/* Drag handle */}
        <div className="cursor-grab text-foreground/20 hover:text-foreground/60 transition-colors active:cursor-grabbing flex justify-center">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onSelect(); }}
          className="text-foreground/30 hover:text-foreground/70 transition-colors flex justify-center">
          {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
        </button>

        {/* Thumbnail */}
        <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-foreground/[0.05] cursor-pointer flex-shrink-0" onClick={() => onEdit(product)}>
          {product.images?.[0]
            ? <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" alt="" />
            : <Package className="w-5 h-5 text-foreground/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          }
          {product.is_boosted && (
            <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="min-w-0 pl-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-emerald-600 transition-colors"
              onClick={() => onEdit(product)}>
              {product.name}
            </p>
            <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {product.sku && (
              <button onClick={handleCopySku}
                className="text-[10px] font-mono text-foreground/35 hover:text-foreground/70 transition-colors flex items-center gap-1 group/sku">
                {product.sku}
                <Copy className="w-3 h-3 opacity-0 group-hover/sku:opacity-100 transition-opacity" />
              </button>
            )}
            {hasVariants && (
              <span className="text-[10px] text-foreground/35 flex items-center gap-0.5">
                <Layers className="w-3 h-3" />{variants.length}
              </span>
            )}
            {(product as any).units_sold_30d > 0 && (
              <span className="text-[10px] text-foreground/35 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                {(product as any).units_sold_30d} sold/30d
              </span>
            )}
          </div>
        </div>

        {/* Price + margin */}
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">{formatTZS(displayPrice)}</p>
          {product.sale_price && product.sale_price < product.price && (
            <p className="text-[10px] text-foreground/30 line-through">{formatTZS(product.price)}</p>
          )}
          {margin > 0 && (
            <span className="text-[10px] text-foreground/40">{margin.toFixed(0)}% margin</span>
          )}
        </div>

        {/* Stock bar + quick ±1 + adjust modal */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[10px] font-bold ${
                product.stock === 0 ? 'text-red-500' :
                product.is_low_stock ? 'text-amber-500' :
                'text-foreground/40'
              }`}>
                {product.stock === 0 ? '⚠ Out' : product.is_low_stock ? '↓ Low' : 'OK'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={e => { e.stopPropagation(); onQuickAdjust(product, -1); }}
                  className="w-5 h-5 rounded-md bg-foreground/[0.05] flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-foreground/30 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Remove 1"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="text-xs font-black text-foreground tabular-nums w-7 text-center">{product.stock}</span>
                <button
                  onClick={e => { e.stopPropagation(); onQuickAdjust(product, 1); }}
                  className="w-5 h-5 rounded-md bg-foreground/[0.05] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-foreground/30 flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Add 1"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  product.stock === 0 ? 'bg-red-400' :
                  product.is_low_stock ? 'bg-amber-400' :
                  'bg-emerald-500'
                }`}
                initial={false}
                animate={{ width: `${stockPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onStockAdjust(product); }}
            className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/[0.10] transition-colors text-foreground/40 flex-shrink-0"
            title="Adjust stock"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle status — suspended products can only be reinstated via appeal */}
        <div className="flex justify-center">
          {product.status === 'suspended' ? (
            <span className="h-7 px-3 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />Suspended
            </span>
          ) : (
          <button
            onClick={e => { e.stopPropagation(); onToggleStatus(product); }}
            className={`h-7 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
              product.status === 'active'
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20'
                : 'bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/10'
            }`}
            title={product.status === 'active' ? 'Set to Draft' : 'Set to Active'}
          >
            {product.status === 'active'
              ? <><ToggleRight className="w-3.5 h-3.5" />Live</>
              : <><ToggleLeft className="w-3.5 h-3.5" />{cfg.label}</>
            }
          </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onToggleBoost(product); }}
            title={product.is_boosted ? 'Remove boost' : 'Boost listing'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              product.is_boosted ? 'bg-emerald-100 text-emerald-600' : 'bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/10'
            }`}>
            <Zap className={`w-3.5 h-3.5 ${product.is_boosted ? 'fill-current' : ''}`} />
          </button>
          <button onClick={e => { e.stopPropagation(); setShowHistory(!showHistory); }}
            title="Stock history"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              showHistory ? 'bg-foreground/10 text-foreground' : 'bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/10'
            }`}>
            <History className="w-3.5 h-3.5" />
          </button>
          <div ref={menuRef} className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="w-7 h-7 rounded-lg bg-foreground/[0.05] flex items-center justify-center text-foreground/40 hover:bg-foreground/10 transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-foreground/8 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <button onClick={() => { onEdit(product); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.04] flex items-center gap-2.5 transition-colors">
                  <Edit2 className="w-3.5 h-3.5 text-foreground/40" />Edit Product
                </button>
                <button onClick={() => { onDuplicate(product); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.04] flex items-center gap-2.5 transition-colors">
                  <Copy className="w-3.5 h-3.5 text-foreground/40" />Duplicate
                </button>
                <button onClick={() => { onCreatePromo(product); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.04] flex items-center gap-2.5 transition-colors">
                  <Percent className="w-3.5 h-3.5 text-foreground/40" />Create Promo
                </button>
                <button onClick={() => { onAutoDiscount(product); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.04] flex items-center gap-2.5 transition-colors">
                  <Clock className="w-3.5 h-3.5 text-foreground/40" />Auto-Discount
                </button>
                <button onClick={handleShare}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.04] flex items-center gap-2.5 transition-colors">
                  <Share2 className="w-3.5 h-3.5 text-foreground/40" />Share
                </button>
                <div className="h-px bg-foreground/8 mx-2" />
                {product.status === 'archived' ? (
                  <button onClick={() => { onRestore?.(product.id); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center gap-2.5 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />Restore as Draft
                  </button>
                ) : (
                  <button onClick={() => { onArchive(product.id); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2.5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Moderation banner — suspension notice + appeal path (fairness: never a silent takedown) */}
      {(product.status === 'suspended' || moderation?.appeal) && (
        <div
          className="mx-3.5 md:mx-4 mb-3.5 p-3.5 rounded-2xl border border-red-200/70 dark:border-red-900/40 bg-red-50/60 dark:bg-red-900/10 flex flex-col md:flex-row md:items-center gap-3"
          onClick={e => e.stopPropagation()}
          role="status"
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            {product.status === 'suspended' && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
                    <AlertTriangle className="w-3 h-3" />Suspended by MaliMart
                  </span>
                </div>
                <p className="text-xs font-semibold text-red-800 dark:text-red-300 leading-relaxed">
                  Reason: {moderation?.takedown_reason || (product as any).takedown_reason || 'No reason provided — contact support.'}
                </p>
              </>
            )}
            {moderation?.appeal && (
              <p className="text-xs font-medium text-foreground/70 leading-relaxed">
                {moderation.appeal.status === 'pending' && (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />Appeal pending review
                  </span>
                )}
                {moderation.appeal.status === 'approved' && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                    <Check className="w-3.5 h-3.5" />Appeal approved — listing reinstated
                  </span>
                )}
                {moderation.appeal.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-bold">
                    <X className="w-3.5 h-3.5" />Appeal rejected
                  </span>
                )}
                {moderation.appeal.admin_response && (
                  <span className="block mt-1 text-foreground/60">
                    MaliMart: {moderation.appeal.admin_response}
                  </span>
                )}
              </p>
            )}
          </div>
          {product.status === 'suspended' && onAppeal
            && (!moderation?.appeal || moderation.appeal.status === 'rejected') && (
            <button
              onClick={() => onAppeal(product)}
              className="flex-shrink-0 min-h-[44px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 active:scale-95"
              aria-label={`Appeal the suspension of ${product.name}`}
            >
              {moderation?.appeal?.status === 'rejected' ? 'Appeal again' : 'Appeal'}
            </button>
          )}
        </div>
      )}

      {/* Movement history panel */}
      {showHistory && (
        <MovementHistory movements={product.recent_movements || []} />
      )}

      {/* Unified share sheet (channels + poster) */}
      <ProductShare product={product} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </motion.div>
  );
};

// ── Stat Cards ────────────────────────────────────────────────────────────────