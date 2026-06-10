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

export const MovementHistory = ({ movements }: { movements: InventoryMovement[] }) => {
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