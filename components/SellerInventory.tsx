/**
 * SellerInventory — production-grade inventory management
 *
 * Security: all mutations go through SECURITY DEFINER RPCs
 *   - update_product_stock  (stock adj + audit log)
 *   - toggle_product_boost
 *   - set_product_status
 *   - duplicate_product
 *   - archive_products (batch soft-delete)
 *   - reorder_products (persist drag sort)
 *
 * Features: server-side search/filter/sort, pagination, bulk ops,
 *   stock adjustment modal, inline status toggle, real chart,
 *   inventory movement history from inventory_logs
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Plus, Zap, Trash2,
  CheckSquare, Square, Copy, Package, X,
  Download, ArrowUpDown, History, Layers,
  DollarSign, BarChart3, AlertCircle, Clock,
  Percent, Upload, ChevronDown, ChevronUp,
  RefreshCw, Edit2, ToggleLeft, ToggleRight,
  Minus, TrendingUp, TrendingDown, Loader2,
  GripVertical, MoreHorizontal, Star, Eye,
  Check, AlertTriangle, ArrowUpRight, Wand2, Share2
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useDebounce } from '../src/hooks/useDebounce';
import { useToast, ConfirmModal } from './UI';
import { Product } from '../types';
import { formatTZS, CURRENCY, CATEGORY_HIERARCHY } from '../constants';
import { supabase } from '../services/supabaseClient';
import { rateLimit } from '../src/security';
import { withCache, invalidate, TTL } from '../services/queryCache';
import { QuickProductForm } from './QuickProductForm';
import { CSVImport } from './CSVImport';
import { BulkEditModal } from './BulkEditModal';
import { AutoDiscountModal } from './AutoDiscountModal';

// ── Types ──────────────────────────────────────────────────────────────────────
interface InventoryProduct extends Product {
  units_sold_30d?: number;
  revenue_30d?: number;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  recent_movements?: InventoryMovement[];
}

interface InventoryMovement {
  id: string;
  reason: string;
  delta: number;
  stock_before: number;
  stock_after: number;
  created_at: string;
  notes?: string;
}

interface RpcTotals {
  total: number;
  low_stock: number;
  out_of_stock: number;
  active: number;
  draft: number;
  archived: number;
  inventory_value: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (d?: string) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' });
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  draft:    { label: 'Draft',     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
  inactive: { label: 'Inactive',  color: 'text-foreground/40', bg: 'bg-foreground/[0.05]' },
  archived: { label: 'Archived',  color: 'text-foreground/30', bg: 'bg-foreground/[0.03]' },
};

const REASON_LABELS: Record<string, string> = {
  sale: 'Sale', sale_reversed: 'Return', return: 'Return',
  restock: 'Restock', adjustment: 'Manual adj.',
  damaged: 'Damaged', reserved: 'Reserved', reservation_released: 'Released',
};

// ── Stock Adjustment Modal ─────────────────────────────────────────────────────
const StockAdjustModal = ({
  product, onClose, onSave,
}: {
  product: InventoryProduct;
  onClose: () => void;
  onSave: (delta: number, reason: string, notes: string) => Promise<void>;
}) => {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('adjustment');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const newStock = Math.max(0, product.stock + delta);

  const handleSave = async () => {
    if (delta === 0) return;
    setSaving(true);
    await onSave(delta, reason, notes);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-3xl border border-foreground/8 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-foreground/8 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-foreground/40">Adjust Stock</p>
            <h3 className="text-sm font-black text-foreground mt-0.5 truncate max-w-[220px]">{product.name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current → New stock visual */}
          <div className="flex items-center justify-between rounded-2xl bg-foreground/[0.03] p-4">
            <div className="text-center">
              <p className="text-[10px] text-foreground/40 mb-1">Current</p>
              <p className="text-2xl font-black text-foreground">{product.stock}</p>
            </div>
            <div className="flex items-center gap-1 text-foreground/30">
              {delta !== 0 ? (
                delta > 0
                  ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div className="text-center">
              <p className="text-[10px] text-foreground/40 mb-1">New Total</p>
              <p className={`text-2xl font-black ${newStock === 0 ? 'text-red-500' : newStock < 5 ? 'text-amber-500' : 'text-emerald-600'}`}>{newStock}</p>
            </div>
          </div>

          {/* Delta input */}
          <div>
            <label className="text-xs font-bold text-foreground/60 mb-2 block">Change Amount</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setDelta(d => d - 1)}
                className="w-10 h-10 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors text-foreground/60 font-black">
                −
              </button>
              <input
                type="number"
                value={delta}
                onChange={e => setDelta(parseInt(e.target.value) || 0)}
                className="flex-1 h-10 rounded-xl border border-foreground/15 bg-foreground/[0.04] text-center text-sm font-black text-foreground outline-none focus:border-foreground/30"
              />
              <button onClick={() => setDelta(d => d + 1)}
                className="w-10 h-10 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-foreground/60 font-black">
                +
              </button>
            </div>
            <p className="text-[10px] text-foreground/30 mt-1 text-center">
              Negative reduces stock, positive increases
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-bold text-foreground/60 mb-2 block">Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full h-10 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3 text-sm text-foreground outline-none focus:border-foreground/30"
            >
              <option value="adjustment">Manual Adjustment</option>
              <option value="restock">Restock / New Delivery</option>
              <option value="damaged">Damaged / Lost</option>
              <option value="return">Customer Return</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-foreground/60 mb-2 block">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. New shipment from supplier"
              className="w-full h-10 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3 text-sm text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/30"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-foreground/15 text-sm font-bold text-foreground/60 hover:bg-foreground/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={delta === 0 || saving}
            className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Movement History Panel ────────────────────────────────────────────────────
const MovementHistory = ({ movements }: { movements: InventoryMovement[] }) => {
  if (!movements || movements.length === 0) {
    return (
      <div className="px-4 pb-3 pt-2">
        <p className="text-[10px] text-foreground/30 italic">No movement history</p>
      </div>
    );
  }
  return (
    <div className="px-4 pb-3 pt-1 space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-foreground/30 mb-2 flex items-center gap-1">
        <History className="w-3 h-3" /> Stock Movements
      </p>
      {movements.slice(0, 5).map((m) => (
        <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-foreground/5 last:border-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black ${m.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {m.delta > 0 ? '+' : ''}{m.delta}
            </span>
            <span className="text-[10px] text-foreground/50">{REASON_LABELS[m.reason] || m.reason}</span>
            {m.notes && <span className="text-[10px] text-foreground/30 italic truncate max-w-[120px]">{m.notes}</span>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-foreground/30">
            <span>{m.stock_before} → {m.stock_after}</span>
            <span>{timeAgo(m.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Inventory Row ─────────────────────────────────────────────────────────────
const InventoryRow = ({
  product, isSelected, onSelect, onEdit, onArchive,
  onToggleStatus, onToggleBoost, onDuplicate, onStockAdjust,
  onDragStart, onDragOver, onDrop, onCreatePromo, onAutoDiscount,
  updating,
}: {
  product: InventoryProduct;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (p: InventoryProduct) => void;
  onArchive: (id: string) => void;
  onToggleStatus: (p: InventoryProduct) => void;
  onToggleBoost: (p: InventoryProduct) => void;
  onDuplicate: (p: InventoryProduct) => void;
  onStockAdjust: (p: InventoryProduct) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onCreatePromo: (p: InventoryProduct) => void;
  onAutoDiscount: (p: InventoryProduct) => void;
  updating: boolean;
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const stockPct = Math.min(100, Math.max(0, (product.stock / Math.max(product.stock, 50)) * 100));

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

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/product/${product.id}`;
    if (navigator.share) {
      navigator.share({ title: product.name, url });
    } else {
      navigator.clipboard.writeText(url);
      addToast('Product link copied', 'success');
    }
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, product.id)}
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, product.id)}
      className={`group relative border-b border-foreground/5 last:border-0 transition-colors ${
        isSelected ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-foreground/[0.02]'
      } ${updating ? 'opacity-60 pointer-events-none' : ''}`}
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
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              product.stock === 0 ? 'bg-red-50 text-red-600' :
              product.is_low_stock ? 'bg-amber-50 text-amber-600' :
              'bg-emerald-50 text-emerald-600'
            }`}>
              {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
            </span>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onStockAdjust(product)}
            className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 active:scale-90">
            <BarChart3 className="w-4 h-4" />
          </button>
          <button onClick={() => onEdit(product)}
            className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/50 active:scale-90">
            <Edit2 className="w-4 h-4" />
          </button>
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

        {/* Stock bar + adjust */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[10px] font-bold ${
                product.stock === 0 ? 'text-red-500' :
                product.is_low_stock ? 'text-amber-500' :
                'text-foreground/40'
              }`}>
                {product.stock === 0 ? '⚠ Out of stock' : product.is_low_stock ? '↓ Low stock' : 'In stock'}
              </span>
              <span className="text-xs font-black text-foreground">{product.stock}</span>
            </div>
            <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  product.stock === 0 ? 'bg-red-400' :
                  product.is_low_stock ? 'bg-amber-400' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${stockPct}%` }}
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

        {/* Toggle status */}
        <div className="flex justify-center">
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
                <button onClick={() => { onArchive(product.id); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2.5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />Archive
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movement history panel */}
      {showHistory && (
        <MovementHistory movements={product.recent_movements || []} />
      )}
    </div>
  );
};

// ── Stat Cards ────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, icon: Icon, accent = false, alert = false }: any) => (
  <div className={`relative p-5 rounded-2xl border transition-all ${
    alert ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30' :
    accent ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-900/30' :
    'border-foreground/8 bg-card hover:shadow-sm'
  }`}>
    <div className="flex items-start justify-between mb-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1">{title}</p>
        <p className={`text-2xl font-black ${alert ? 'text-amber-700 dark:text-amber-400' : accent ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>
          {value}
        </p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        alert ? 'bg-amber-100 dark:bg-amber-900/30' :
        accent ? 'bg-emerald-100 dark:bg-emerald-900/30' :
        'bg-foreground/[0.06]'
      }`}>
        <Icon className={`w-4.5 h-4.5 ${alert ? 'text-amber-600' : accent ? 'text-emerald-600' : 'text-foreground/50'}`} />
      </div>
    </div>
    {sub && <p className="text-[11px] text-foreground/40">{sub}</p>}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export const SellerInventory = ({
  products: initialProducts,
  userId,
  refresh,
  onCreatePromo,
}: {
  products: Product[];
  userId: string;
  refresh: () => void;
  onCreatePromo: (p: Product) => void;
}) => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState<RpcTotals | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState({ key: 'created_at', asc: false });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(0);

  // Selection + operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [stockAdjProduct, setStockAdjProduct] = useState<InventoryProduct | null>(null);
  const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isAutoDiscountOpen, setIsAutoDiscountOpen] = useState(false);
  const [productForDiscount, setProductForDiscount] = useState<InventoryProduct | null>(null);
  const [archiveModal, setArchiveModal] = useState<{ ids: string[]; open: boolean }>({ ids: [], open: false });

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const sortMap: Record<string, string> = {
        created_at: sort.asc ? 'created_asc' : 'created_desc',
        price: 'revenue_desc',
        stock: sort.asc ? 'stock_asc' : 'stock_desc',
        name: 'name_asc',
      };
      const cacheKey = `seller:inventory:${userId}:${page}:${status}:${debouncedSearch}:${lowStockOnly}:${sort.key}:${sort.asc}`;
      // Use 60s cache; silent=true (mutations) busts the cache before refetching
      if (silent) invalidate(cacheKey);
      const data = await withCache(cacheKey, 60_000, async () => {
        const { data: d, error } = await supabase.rpc('get_seller_inventory', {
          p_seller_id: userId,
          p_limit: PAGE_SIZE,
          p_offset: page * PAGE_SIZE,
          p_status: status !== 'All' ? status.toLowerCase() : null,
          p_search: debouncedSearch || null,
          p_low_stock_only: lowStockOnly,
          p_sort: sortMap[sort.key] ?? 'created_desc',
        });
        if (error) throw error;
        return d;
      });
      setProducts((data?.products ?? []) as InventoryProduct[]);
      setTotalCount(data?.pagination?.matched ?? 0);
      if (data?.totals) setTotals(data.totals as RpcTotals);
    } catch (e: any) {
      if (!silent) addToast('Failed to load inventory', 'error');
      console.error('[SellerInventory]', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, page, debouncedSearch, status, sort, lowStockOnly]);

  useEffect(() => { setPage(0); }, [debouncedSearch, status, lowStockOnly]);
  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  // ── Mutations (all via secure RPCs) ─────────────────────────────────────────

  const setUpdating = (id: string, on: boolean) => setUpdatingIds(prev => {
    const s = new Set(prev); on ? s.add(id) : s.delete(id); return s;
  });

  const handleStockAdjust = async (product: InventoryProduct, delta: number, reason: string, notes: string) => {
    if (!rateLimit(`stock-${product.id}`, 10)) {
      addToast('Too many adjustments. Wait a moment.', 'error');
      return;
    }
    setUpdating(product.id, true);
    // Optimistic
    setProducts(prev => prev.map(p => p.id === product.id
      ? { ...p, stock: Math.max(0, p.stock + delta) }
      : p
    ));
    try {
      const { error } = await supabase.rpc('update_product_stock', {
        p_product_id: product.id,
        p_delta: delta,
        p_reason: reason,
        p_notes: notes || null,
      });
      if (error) throw error;
      addToast(`Stock updated: ${product.stock} → ${Math.max(0, product.stock + delta)}`, 'success');
      fetchInventory(true);
    } catch (err: any) {
      addToast(err.message || 'Stock update failed', 'error');
      fetchInventory(true); // revert
    } finally {
      setUpdating(product.id, false);
    }
  };

  const handleToggleBoost = async (product: InventoryProduct) => {
    if (!rateLimit(`boost-${product.id}`, 5)) return addToast('Too fast', 'error');
    setUpdating(product.id, true);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_boosted: !p.is_boosted } : p));
    try {
      const { data, error } = await supabase.rpc('toggle_product_boost', { p_product_id: product.id });
      if (error) throw error;
      addToast(data ? 'Product boosted ⚡' : 'Boost removed', 'success');
    } catch (err: any) {
      addToast(err.message || 'Boost failed', 'error');
      fetchInventory(true);
    } finally {
      setUpdating(product.id, false);
    }
  };

  const handleToggleStatus = async (product: InventoryProduct) => {
    const newStatus = product.status === 'active' ? 'draft' : 'active';
    setUpdating(product.id, true);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    try {
      const { error } = await supabase.rpc('set_product_status', {
        p_product_id: product.id,
        p_status: newStatus,
      });
      if (error) throw error;
      addToast(`Status → ${newStatus}`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Status update failed', 'error');
      fetchInventory(true);
    } finally {
      setUpdating(product.id, false);
    }
  };

  const handleDuplicate = async (product: InventoryProduct) => {
    if (!rateLimit(`dup-${product.id}`, 3)) return addToast('Too fast', 'error');
    try {
      const { data, error } = await supabase.rpc('duplicate_product', { p_product_id: product.id });
      if (error) throw error;
      addToast('Product duplicated as draft ✓', 'success');
      fetchInventory(true);
    } catch (err: any) {
      addToast(err.message || 'Duplicate failed', 'error');
    }
  };

  const handleArchive = async () => {
    const ids = archiveModal.ids;
    if (ids.length === 0) return;
    try {
      const { data, error } = await supabase.rpc('archive_products', { p_product_ids: ids });
      if (error) throw error;
      addToast(`${data} product${data !== 1 ? 's' : ''} archived`, 'success');
      setSelectedIds(new Set());
      fetchInventory(true);
    } catch (err: any) {
      addToast(err.message || 'Archive failed', 'error');
    } finally {
      setArchiveModal({ ids: [], open: false });
    }
  };

  // ── Drag-and-drop sort (persisted via RPC) ─────────────────────────────────
  const dragId = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId.current || dragId.current === targetId) return;
    const from = products.findIndex(p => p.id === dragId.current);
    const to   = products.findIndex(p => p.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...products];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setProducts(reordered);
    // Persist
    try {
      await supabase.rpc('reorder_products', { p_ordered_ids: reordered.map(p => p.id) });
    } catch {
      addToast('Sort order could not be saved', 'error');
    }
    dragId.current = null;
  };

  // ── Export CSV (all products, not just current page) ───────────────────────
  const handleExportCSV = async () => {
    try {
      // Fetch all without pagination for export
      const { data, error } = await supabase.rpc('get_seller_inventory', {
        p_seller_id: userId,
        p_limit: 9999,
        p_offset: 0,
        p_status: null,
        p_search: null,
        p_low_stock_only: false,
        p_sort: 'created_desc',
      });
      if (error) throw error;
      const all: InventoryProduct[] = data?.products ?? [];
      const headers = ['ID', 'Name', 'SKU', 'Category', 'Status', 'Price (TZS)', 'Stock', 'Sold 30d', 'Revenue 30d', 'Low Stock', 'Created'];
      const rows = all.map(p => [
        p.id, `"${p.name.replace(/"/g, '""')}"`, p.sku || '', p.category || '',
        p.status, p.price, p.stock,
        (p as any).units_sold_30d || 0,
        (p as any).revenue_30d || 0,
        p.is_low_stock ? 'Yes' : 'No',
        new Date(p.created_at).toISOString().split('T')[0],
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `inventory_${new Date().toISOString().split('T')[0]}.csv` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('CSV exported', 'success');
    } catch (err: any) {
      addToast('Export failed', 'error');
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-5 pb-10">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Total Products"
          value={totals?.total ?? products.length}
          sub={`${totals?.active ?? 0} live`}
          icon={Package}
          accent={false}
        />
        <StatCard
          title="Inventory Value"
          value={formatTZS(totals?.inventory_value ?? 0)}
          sub="At retail price"
          icon={DollarSign}
          accent
        />
        <StatCard
          title="Low Stock"
          value={totals?.low_stock ?? 0}
          sub="Below threshold"
          icon={AlertTriangle}
          alert={(totals?.low_stock ?? 0) > 0}
        />
        <StatCard
          title="Out of Stock"
          value={totals?.out_of_stock ?? 0}
          sub="Needs restocking"
          icon={AlertCircle}
          alert={(totals?.out_of_stock ?? 0) > 0}
        />
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-10 px-3 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm text-foreground outline-none focus:border-foreground/25 transition-colors min-w-[120px]"
        >
          <option value="All">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Category filter */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-10 px-3 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm text-foreground outline-none focus:border-foreground/25 transition-colors min-w-[140px]"
        >
          <option value="All">All Categories</option>
          {Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Low stock toggle */}
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`h-10 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
            lowStockOnly
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
              : 'border-foreground/12 bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.07]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low stock
        </button>

        {/* Refresh */}
        <button onClick={() => fetchInventory(true)} disabled={refreshing}
          className="h-10 w-10 rounded-xl border border-foreground/12 bg-foreground/[0.04] flex items-center justify-center text-foreground/50 hover:bg-foreground/[0.07] transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Actions */}
        <button onClick={() => navigate('/seller/products/new')}
          className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" /> Add
        </button>
        <button onClick={() => setIsQuickFormOpen(true)}
          className="h-10 px-4 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] transition-all flex items-center gap-2 flex-shrink-0">
          <Zap className="w-4 h-4" />
        </button>
        <button onClick={handleExportCSV}
          className="h-10 px-4 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] transition-all flex items-center gap-2 flex-shrink-0">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={() => setIsCSVImportOpen(true)}
          className="h-10 px-4 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] transition-all flex items-center gap-2 flex-shrink-0">
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-2xl">
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-white/30 mx-1" />
          <button onClick={() => setIsBulkEditOpen(true)}
            className="text-sm font-semibold hover:underline flex items-center gap-1">
            <Edit2 className="w-3.5 h-3.5" />Bulk Edit
          </button>
          <button onClick={() => setArchiveModal({ ids: Array.from(selectedIds), open: true })}
            className="text-sm font-semibold hover:underline flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />Archive
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-foreground/8 overflow-hidden bg-card">
        {/* Table header (desktop) */}
        <div className="hidden md:grid items-center px-4 py-3 border-b border-foreground/8 bg-foreground/[0.02] text-[9px] font-black uppercase tracking-widest text-foreground/40"
          style={{ gridTemplateColumns: '28px 28px 56px 1fr 140px 180px 110px 120px' }}>
          <button onClick={toggleSelectAll} className="flex justify-center">
            {selectedIds.size === products.length && products.length > 0
              ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              : <Square className="w-3.5 h-3.5" />
            }
          </button>
          <div />
          <div />
          <button className="flex items-center gap-1 pl-1 hover:text-foreground/70 transition-colors"
            onClick={() => setSort(s => ({ key: 'name', asc: !s.asc }))}>
            Product <ArrowUpDown className="w-3 h-3" />
          </button>
          <button className="flex items-center justify-end gap-1 hover:text-foreground/70 transition-colors"
            onClick={() => setSort(s => ({ key: 'price', asc: !s.asc }))}>
            Price <ArrowUpDown className="w-3 h-3" />
          </button>
          <button className="flex items-center justify-center gap-1 hover:text-foreground/70 transition-colors"
            onClick={() => setSort(s => ({ key: 'stock', asc: !s.asc }))}>
            Stock <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="text-center">Status</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows */}
        <div>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-14 rounded-xl bg-foreground/[0.04] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
                <Package className="w-7 h-7 text-foreground/20" />
              </div>
              <p className="text-sm font-bold text-foreground/30">
                {debouncedSearch ? 'No products match your search' : lowStockOnly ? 'No low-stock products' : 'No products yet'}
              </p>
              {!debouncedSearch && !lowStockOnly && (
                <button onClick={() => navigate('/seller/products/new')}
                  className="mt-2 h-10 px-6 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors">
                  Add your first product
                </button>
              )}
            </div>
          ) : (
            products.map(p => (
              <InventoryRow
                key={p.id}
                product={p}
                isSelected={selectedIds.has(p.id)}
                onSelect={() => toggleSelect(p.id)}
                onEdit={prod => navigate(`/seller/products/${prod.id}/edit`)}
                onArchive={id => setArchiveModal({ ids: [id], open: true })}
                onToggleStatus={handleToggleStatus}
                onToggleBoost={handleToggleBoost}
                onDuplicate={handleDuplicate}
                onStockAdjust={prod => setStockAdjProduct(prod)}
                onDragStart={handleDragStart}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onCreatePromo={prod => onCreatePromo(prod as Product)}
                onAutoDiscount={prod => { setProductForDiscount(prod); setIsAutoDiscountOpen(true); }}
                updating={updatingIds.has(p.id)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-foreground/8 flex items-center justify-between bg-foreground/[0.01]">
            <p className="text-[11px] text-foreground/40">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="h-8 px-4 rounded-lg border border-foreground/12 text-xs font-semibold text-foreground/60 hover:bg-foreground/[0.05] disabled:opacity-30 transition-colors">
                Prev
              </button>
              <span className="h-8 px-3 flex items-center text-xs text-foreground/40">
                {page + 1} / {totalPages}
              </span>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
                className="h-8 px-4 rounded-lg border border-foreground/12 text-xs font-semibold text-foreground/60 hover:bg-foreground/[0.05] disabled:opacity-30 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stock adjustment modal */}
      {stockAdjProduct && (
        <StockAdjustModal
          product={stockAdjProduct}
          onClose={() => setStockAdjProduct(null)}
          onSave={(delta, reason, notes) => handleStockAdjust(stockAdjProduct, delta, reason, notes)}
        />
      )}

      {/* Archive confirm */}
      <ConfirmModal
        isOpen={archiveModal.open}
        onClose={() => setArchiveModal({ ids: [], open: false })}
        onConfirm={handleArchive}
        title="Archive Products"
        message={`Archive ${archiveModal.ids.length} product${archiveModal.ids.length !== 1 ? 's' : ''}? They will be removed from your store but kept in records. You can restore them from the database.`}
        confirmText="Archive"
        isDestructive
      />

      {/* Forms */}

      {isQuickFormOpen && (
        <QuickProductForm
          onClose={() => setIsQuickFormOpen(false)}
          onSuccess={() => { fetchInventory(true); setIsQuickFormOpen(false); }}
        />
      )}
      {isCSVImportOpen && (
        <CSVImport
          onClose={() => setIsCSVImportOpen(false)}
          onSuccess={() => { fetchInventory(true); setIsCSVImportOpen(false); }}
        />
      )}
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        products={products.filter(p => selectedIds.has(p.id)) as any}
        onSave={() => { fetchInventory(true); setIsBulkEditOpen(false); }}
      />
      <AutoDiscountModal
        isOpen={isAutoDiscountOpen}
        onClose={() => { setIsAutoDiscountOpen(false); setProductForDiscount(null); }}
        product={productForDiscount as any}
        onSave={() => fetchInventory(true)}
      />
    </div>
  );
};
