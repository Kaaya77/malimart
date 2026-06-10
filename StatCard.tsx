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

export const StatCard = ({ title, value, sub, icon: Icon, accent = false, alert = false }: any) => (
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