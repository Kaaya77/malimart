import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useToast } from '../UI';
import { Product } from '../../types';
import { formatTZS, CURRENCY } from '../../constants';
import { supabase } from '../../services/supabaseClient';
import { withCache, invalidate, TTL } from '../../services/queryCache';
import { STATUS_CFG, REASON_LABELS, timeAgo } from './config';
import type { InventoryProduct, InventoryMovement } from './config';

export const StockAdjustModal = ({
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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