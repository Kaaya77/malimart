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
import { STATUS_CFG, REASON_LABELS } from './config';

export const StatCard = ({ title, value, sub, icon: Icon, accent = false, alert = false }: any) => {
  const tone = alert
    ? { ring: 'ring-amber-500/20', chip: 'bg-amber-500/12 text-amber-600', bar: 'bg-amber-500', value: 'text-amber-700 dark:text-amber-400' }
    : accent
    ? { ring: 'ring-emerald-500/20', chip: 'bg-emerald-500/12 text-emerald-600', bar: 'bg-emerald-500', value: 'text-foreground' }
    : { ring: 'ring-transparent', chip: 'bg-foreground/[0.06] text-foreground/50', bar: 'bg-foreground/20', value: 'text-foreground' };

  return (
    <div className={`group relative p-4 sm:p-5 rounded-2xl border border-foreground/8 glass-surface ring-1 ${tone.ring} hover:border-foreground/15 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] transition-all overflow-hidden`}>
      {/* top accent line */}
      <div className={`absolute top-0 left-4 right-4 h-px ${tone.bar} opacity-40`} />
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40">{title}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone.chip} transition-transform group-hover:scale-110`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl sm:text-[1.7rem] font-bold tracking-tight leading-none tabular-nums ${tone.value}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] font-medium text-foreground/40 mt-1.5">{sub}</p>}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────