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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Zap, Trash2,
  CheckSquare, Square, Package, X,
  Download, ArrowUpDown,
  DollarSign, AlertCircle,
  Upload,
  RefreshCw, Edit2,
  TrendingUp,
  Check, AlertTriangle, Wand2,
  RotateCcw, LayoutGrid, List
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useDebounce } from '../src/hooks/useDebounce';
import { useToast, ConfirmModal, Modal, Textarea, Label, Button } from './UI';
import { Product } from '../types';
import { formatTZS, CURRENCY } from '../constants';
import { useCategoryOptions } from '../hooks/useCategoryOptions';
import { supabase } from '../services/supabaseClient';
import { rateLimit } from '../src/security';
import { withCache, invalidate, TTL } from '../services/queryCache';
import { getMyProductModeration, submitProductAppeal, SellerModerationEntry } from '../services/moderationApi';
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

import { STATUS_CFG } from './seller-inventory/config';
import { StockAdjustModal } from './seller-inventory/StockAdjustModal';
import { InventoryRow } from './seller-inventory/InventoryRow';
import { StatCard } from './seller-inventory/StatCard';
import { AIInventoryInsights } from './seller-inventory/AIInventoryInsights';
import { getCategoryEmoji, getCategoryGradient } from '../services/productExperience';

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
  const { sellerInventory: contextInventory, refreshSellerData } = useAppState();
  const categoryOptions = useCategoryOptions();
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>(
    (contextInventory || []) as InventoryProduct[]
  );
  const [loading, setLoading] = useState(!contextInventory?.length);
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
  const [restoreModal, setRestoreModal] = useState<{ ids: string[]; open: boolean }>({ ids: [], open: false });
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);

  // Moderation (admin takedowns + appeals) — keyed by product_id
  const [moderationMap, setModerationMap] = useState<Record<string, SellerModerationEntry>>({});
  const [appealProduct, setAppealProduct] = useState<InventoryProduct | null>(null);
  const [appealText, setAppealText] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const appealValid = appealText.trim().length >= 10;

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
      const cacheKey = `seller:inventory:${userId}:${page}:${status}:${category}:${debouncedSearch}:${lowStockOnly}:${sort.key}:${sort.asc}`;
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
          p_category: category !== 'All' ? category : null,
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
  }, [userId, page, debouncedSearch, status, category, sort, lowStockOnly]);

  // Fetch suspension/appeal info (get_seller_inventory doesn't return takedown_reason)
  const fetchModeration = useCallback(async () => {
    try {
      const entries = await getMyProductModeration();
      setModerationMap(Object.fromEntries((entries || []).map(e => [e.product_id, e])));
    } catch (e: any) {
      // Non-fatal: inventory still works; RPC may not exist until migration ships
      console.error('[SellerInventory] moderation fetch', e?.message);
    }
  }, []);

  useEffect(() => { fetchModeration(); }, [fetchModeration]);

  const handleSubmitAppeal = async () => {
    if (!appealProduct || !appealValid || appealSubmitting) return;
    setAppealSubmitting(true);
    try {
      await submitProductAppeal(appealProduct.id, appealText.trim());
      addToast('Appeal submitted — MaliMart will review it and respond', 'success');
      setAppealProduct(null);
      setAppealText('');
      fetchModeration();
    } catch (e: any) {
      addToast(e?.message || 'Failed to submit appeal', 'error');
    } finally {
      setAppealSubmitting(false);
    }
  };

  // Seed from preloaded context data — instant display on first visit
  useEffect(() => {
    if (contextInventory?.length && !debouncedSearch && status === 'All' && category === 'All' && !lowStockOnly && page === 0) {
      setProducts(contextInventory as InventoryProduct[]);
      setLoading(false);
    }
  }, [contextInventory]);

  useEffect(() => {
    setPage(0);
    // Selection used to survive a filter change untouched. Select 5 rows,
    // narrow the search or switch tabs, and those 5 ids stayed in
    // `selectedIds` — invisible, since the products they pointed at were no
    // longer in `products`. The bulk-action bar still said "5 selected," and
    // Archive/Bulk Edit acted on ids the seller could no longer see and had
    // likely forgotten selecting. Selection is scoped to what's on screen.
    setSelectedIds(new Set());
  }, [debouncedSearch, status, category, lowStockOnly]);

  // Same reasoning, for manual pagination: Next/Prev swaps `products` without
  // touching the filters above, so it needs its own clear.
  useEffect(() => { setSelectedIds(new Set()); }, [page]);
  useEffect(() => { fetchInventory(!!contextInventory?.length); }, [fetchInventory]);

  // Supabase Realtime: live stock updates when products change in DB
  useEffect(() => {
    const channel = supabase
      .channel(`inventory:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'products',
        filter: `seller_id=eq.${userId}`,
      }, (payload) => {
        setLiveIndicator(true);
        setTimeout(() => setLiveIndicator(false), 2000);
        setProducts(prev => prev.map(p =>
          p.id === payload.new.id ? { ...p, ...payload.new } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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

  const handleRestore = async () => {
    const ids = restoreModal.ids;
    if (ids.length === 0) return;
    try {
      const { data, error } = await supabase.rpc('restore_products', { p_product_ids: ids });
      if (error) throw error;
      addToast(`${data} product${data !== 1 ? 's' : ''} restored as draft ✓`, 'success');
      setSelectedIds(new Set());
      fetchInventory(true);
    } catch (err: any) {
      addToast(err.message || 'Restore failed', 'error');
    } finally {
      setRestoreModal({ ids: [], open: false });
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
    setSelectedIds(prev => prev.size === displayedProducts.length ? new Set() : new Set(displayedProducts.map(p => p.id)));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const displayedProducts = products; // server-side filtered via p_category
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => window.innerWidth < 768 ? 'cards' : 'table');

  const STATUS_TABS = [
    { value: 'All', label: 'All', count: totals?.total },
    { value: 'active', label: 'Active', count: totals?.active },
    { value: 'draft', label: 'Draft', count: totals?.draft },
    { value: 'archived', label: 'Archived', count: totals?.archived },
  ];

  return (
    <div className="space-y-5 pb-10">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
            <AnimatePresence>
              {liveIndicator && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 text-[10px] font-bold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-sm text-foreground/50 mt-1">
            {totals?.total ?? products.length} products · {formatTZS(totals?.inventory_value ?? 0)} in stock value
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button onClick={() => setShowAIInsights(true)}
            className="h-11 sm:h-10 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/12 transition-all flex items-center justify-center gap-2">
            <Wand2 className="w-4 h-4" />AI Insights
          </button>
          <button onClick={() => navigate('/seller/products/new')}
            className="h-11 sm:h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />New Product
          </button>
        </div>
      </div>

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

      {/* Low-stock alert banner */}
      <AnimatePresence>
        {!alertDismissed && totals && (totals.out_of_stock > 0 || totals.low_stock > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold flex-1">
              {totals.out_of_stock > 0 && <span><strong>{totals.out_of_stock}</strong> out of stock</span>}
              {totals.out_of_stock > 0 && totals.low_stock > 0 && <span className="mx-1.5 opacity-40">·</span>}
              {totals.low_stock > 0 && <span><strong>{totals.low_stock}</strong> running low</span>}
              <button
                onClick={() => { setStatus('All'); setLowStockOnly(true); setAlertDismissed(true); }}
                className="ml-3 text-amber-700 dark:text-amber-400 underline underline-offset-2 text-xs font-bold"
              >View all</button>
            </p>
            <button onClick={() => setAlertDismissed(true)} className="text-amber-500 hover:text-amber-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control toolbar */}
      <div className="rounded-2xl border border-foreground/8 glass-surface p-3 space-y-3">
        {/* Row 1: search + view/tools */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-foreground/12 bg-foreground/[0.03] text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>
          {/* Refresh */}
          <button onClick={() => fetchInventory(true)} disabled={refreshing} title="Refresh"
            className="h-10 w-10 rounded-xl border border-foreground/12 bg-foreground/[0.03] flex items-center justify-center text-foreground/50 hover:bg-foreground/[0.06] transition-colors disabled:opacity-40 flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border border-foreground/12 bg-foreground/[0.03] overflow-hidden flex-shrink-0">
            <button onClick={() => setViewMode('cards')} title="Card view"
              className={`h-10 px-2.5 flex items-center transition-colors ${viewMode === 'cards' ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/35 hover:text-foreground/60'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('table')} title="Table view"
              className={`h-10 px-2.5 flex items-center transition-colors ${viewMode === 'table' ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/35 hover:text-foreground/60'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* Data tools */}
          <div className="hidden sm:flex items-center rounded-xl border border-foreground/12 bg-foreground/[0.03] overflow-hidden flex-shrink-0 divide-x divide-foreground/8">
            <button onClick={() => setIsQuickFormOpen(true)} title="Quick add"
              className="h-10 px-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground transition-all">
              <Zap className="w-4 h-4" />Quick
            </button>
            <button onClick={handleExportCSV} title="Export CSV"
              className="h-10 px-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground transition-all">
              <Download className="w-4 h-4" />Export
            </button>
            <button onClick={() => setIsCSVImportOpen(true)} title="Import CSV"
              className="h-10 px-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground transition-all">
              <Upload className="w-4 h-4" />Import
            </button>
          </div>
        </div>

        {/* Row 2: status tabs + filters — horizontal scroll on mobile, no wrap */}
        <div className="flex md:flex-wrap items-center gap-2 pt-3 border-t border-foreground/8 overflow-x-auto no-scrollbar -mx-1 px-1">
          {/* Status tabs */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                className={`relative h-9 px-3.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                  status === tab.value
                    ? 'bg-foreground/[0.07] text-foreground'
                    : 'text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.03]'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1.5 text-[10px] font-bold tabular-nums ${
                    status === tab.value ? 'text-emerald-600' : 'text-foreground/30'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 md:ml-auto flex-shrink-0">
            {/* Category filter */}
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="h-9 px-3 max-w-[9.5rem] sm:max-w-none truncate rounded-xl border border-foreground/12 bg-foreground/[0.03] text-xs font-medium text-foreground outline-none focus:border-emerald-500/50 transition-colors flex-shrink-0"
            >
              <option value="All">All Categories</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Low stock toggle */}
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`h-9 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                lowStockOnly
                  ? 'border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-foreground/12 bg-foreground/[0.03] text-foreground/50 hover:bg-foreground/[0.06]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low stock
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20"
          >
            <span className="text-sm font-bold">{selectedIds.size} selected</span>
            <div className="h-4 w-px bg-white/30 mx-1" />
            <button onClick={() => setIsBulkEditOpen(true)}
              className="text-sm font-semibold hover:underline flex items-center gap-1.5 opacity-90 hover:opacity-100">
              <Edit2 className="w-3.5 h-3.5" />Bulk Edit
            </button>
            {status === 'archived' ? (
              <button onClick={() => setRestoreModal({ ids: Array.from(selectedIds), open: true })}
                className="text-sm font-semibold hover:underline flex items-center gap-1.5 opacity-90 hover:opacity-100">
                <RotateCcw className="w-3.5 h-3.5" />Restore
              </button>
            ) : (
              <button onClick={() => setArchiveModal({ ids: Array.from(selectedIds), open: true })}
                className="text-sm font-semibold hover:underline flex items-center gap-1.5 opacity-90 hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />Archive
              </button>
            )}
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card view (mobile-first) */}
      {viewMode === 'cards' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-52 rounded-2xl bg-foreground/[0.04] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
                <Package className="w-7 h-7 text-foreground/20" />
              </div>
              <p className="text-sm font-bold text-foreground/30">
                {debouncedSearch ? 'No products match your search' : 'No products yet'}
              </p>
              {!debouncedSearch && (
                <button onClick={() => navigate('/seller/products/new')}
                  className="mt-2 h-10 px-6 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors">
                  Add your first product
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {displayedProducts.map((p, idx) => {
                  const statusColor = p.status === 'active' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                    p.status === 'draft' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                    p.status === 'suspended' ? 'bg-red-600 text-white' :
                    'bg-foreground/8 text-foreground/50';
                  const mod = moderationMap[p.id];
                  const stockAlert = (p as any).is_out_of_stock ? 'text-red-500' : (p as any).is_low_stock ? 'text-amber-500' : 'text-emerald-600';
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`relative glass-surface rounded-2xl border overflow-hidden cursor-pointer group transition-all hover:shadow-md ${
                        selectedIds.has(p.id) ? 'border-emerald-500/50 ring-2 ring-emerald-500/20' : 'border-foreground/8 hover:border-foreground/15'
                      }`}
                      // The whole card used to BE the select toggle, with no
                      // visible checkbox anywhere — clicking a product photo
                      // silently selected it instead of opening it, the
                      // opposite of what table view (checkbox to select,
                      // thumbnail/name to open) already trained the seller to
                      // expect. The card body now opens the product, matching
                      // the table row; the checkbox below is the only way to
                      // select, and is not hover-gated — a hover-only
                      // affordance does not exist on the phones most sellers
                      // are actually using this on.
                      onClick={() => navigate(`/seller/products/${p.id}/edit`)}
                    >
                      {/* Product image */}
                      <div className="relative aspect-square bg-foreground/[0.03] overflow-hidden">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${getCategoryGradient(p.category)} opacity-20 flex items-center justify-center`}>
                            <span className="text-3xl opacity-60">{getCategoryEmoji(p.category)}</span>
                          </div>
                        )}
                        {/* Status badge */}
                        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColor}`}>
                          {p.status}
                        </div>
                        {/* Select checkbox — explicit and always visible, not
                            the card's implicit click target anymore. */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}
                          aria-label={selectedIds.has(p.id) ? `Deselect ${p.name}` : `Select ${p.name}`}
                          aria-pressed={selectedIds.has(p.id)}
                          className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center shadow-sm transition-colors ${
                            selectedIds.has(p.id)
                              ? 'bg-emerald-500 text-white'
                              : 'bg-background/80 backdrop-blur-sm text-foreground/40 hover:text-foreground/70 border border-foreground/10'
                          }`}
                        >
                          {selectedIds.has(p.id) ? <Check className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        {/* Selected overlay */}
                        {selectedIds.has(p.id) && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-emerald-500/10 pointer-events-none"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-foreground leading-snug line-clamp-2 mb-1.5">{p.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-emerald-600">{formatTZS(p.price)}</span>
                          <span className={`text-[10px] font-bold ${stockAlert}`}>
                            {(p as any).is_out_of_stock ? '0 left' : `${p.stock} left`}
                          </span>
                        </div>

                        {/* Suspension notice + appeal (card view) */}
                        {p.status === 'suspended' && (
                          <div className="mt-2 p-2 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-900/40" onClick={e => e.stopPropagation()}>
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Suspended by MaliMart</p>
                            {(mod?.takedown_reason || (p as any).takedown_reason) && (
                              <p className="text-[10px] font-medium text-red-700/80 dark:text-red-300/80 mt-0.5 line-clamp-2">
                                {mod?.takedown_reason || (p as any).takedown_reason}
                              </p>
                            )}
                            {mod?.appeal?.status === 'pending' ? (
                              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">Appeal pending review</p>
                            ) : (
                              <button
                                onClick={() => { setAppealProduct(p); setAppealText(''); }}
                                className="mt-1.5 w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider transition-colors active:scale-95"
                                aria-label={`Appeal the suspension of ${p.name}`}
                              >
                                {mod?.appeal?.status === 'rejected' ? 'Appeal again' : 'Appeal'}
                              </button>
                            )}
                            {mod?.appeal?.status === 'rejected' && mod.appeal.admin_response && (
                              <p className="text-[10px] font-medium text-foreground/55 mt-1 line-clamp-2">MaliMart: {mod.appeal.admin_response}</p>
                            )}
                          </div>
                        )}

                        {/* Quick actions */}
                        <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/seller/products/${p.id}/edit`)}
                            className="flex-1 h-7 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-[9px] font-black uppercase text-foreground/60 hover:text-foreground transition-all flex items-center justify-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => setStockAdjProduct(p)}
                            className="flex-1 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[9px] font-black uppercase text-emerald-600 transition-all flex items-center justify-center gap-1"
                          >
                            <TrendingUp className="w-3 h-3" /> Stock
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
      <div className="rounded-2xl border border-foreground/8 overflow-hidden glass-surface">
        {/* Table header (desktop) */}
        <div className="hidden md:grid items-center px-4 py-3 border-b border-foreground/8 bg-foreground/[0.02] text-[9px] font-black uppercase tracking-widest text-foreground/40"
          style={{ gridTemplateColumns: '28px 28px 56px 1fr 140px 180px 110px 120px' }}>
          <button onClick={toggleSelectAll} className="flex justify-center">
            {selectedIds.size === displayedProducts.length && displayedProducts.length > 0
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
                {debouncedSearch ? 'No products match your search' : lowStockOnly ? 'No low-stock products' : category !== 'All' ? `No products in ${category}` : 'No products yet'}
              </p>
              {!debouncedSearch && !lowStockOnly && category === 'All' && (
                <button onClick={() => navigate('/seller/products/new')}
                  className="mt-2 h-10 px-6 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors">
                  Add your first product
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {displayedProducts.map(p => (
                <InventoryRow
                  key={p.id}
                  product={p}
                  isSelected={selectedIds.has(p.id)}
                  onSelect={() => toggleSelect(p.id)}
                  onEdit={prod => navigate(`/seller/products/${prod.id}/edit`)}
                  onArchive={id => setArchiveModal({ ids: [id], open: true })}
                  onRestore={id => setRestoreModal({ ids: [id], open: true })}
                  onToggleStatus={handleToggleStatus}
                  onToggleBoost={handleToggleBoost}
                  onDuplicate={handleDuplicate}
                  onStockAdjust={prod => setStockAdjProduct(prod)}
                  onQuickAdjust={(prod, delta) => handleStockAdjust(prod, delta, 'adjustment', '')}
                  onDragStart={handleDragStart}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onCreatePromo={prod => onCreatePromo(prod as Product)}
                  onAutoDiscount={prod => { setProductForDiscount(prod); setIsAutoDiscountOpen(true); }}
                  updating={updatingIds.has(p.id)}
                  moderation={moderationMap[p.id]}
                  onAppeal={prod => { setAppealProduct(prod); setAppealText(''); }}
                />
              ))}
            </AnimatePresence>
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
      )}

      {/* Pagination for card view */}
      {viewMode === 'cards' && totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-foreground/40">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="h-9 px-4 rounded-xl border border-foreground/12 text-xs font-semibold text-foreground/60 hover:bg-foreground/[0.05] disabled:opacity-30 transition-colors">
              Prev
            </button>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}
              className="h-9 px-4 rounded-xl border border-foreground/12 text-xs font-semibold text-foreground/60 hover:bg-foreground/[0.05] disabled:opacity-30 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

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
        message={`Archive ${archiveModal.ids.length} product${archiveModal.ids.length !== 1 ? 's' : ''}? They'll be hidden from your store. You can restore them any time from the Archived tab.`}
        confirmText="Archive"
        isDestructive
      />

      {/* Appeal a suspension */}
      <Modal
        isOpen={!!appealProduct}
        onClose={() => { if (!appealSubmitting) { setAppealProduct(null); setAppealText(''); } }}
        title={appealProduct ? `Appeal suspension — ${appealProduct.name}` : 'Appeal suspension'}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-900/40">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Why it was suspended</p>
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {(appealProduct && (moderationMap[appealProduct.id]?.takedown_reason || (appealProduct as any).takedown_reason)) || 'No reason recorded.'}
            </p>
          </div>
          <div>
            <Label htmlFor="appeal-reason">Your appeal (required)</Label>
            <Textarea
              id="appeal-reason"
              value={appealText}
              onChange={(e: any) => setAppealText(e.target.value)}
              placeholder="Explain why this listing should be reinstated — e.g. proof of authenticity, corrected photos or description..."
              aria-required="true"
              autoFocus
            />
            <p className="mt-2 text-[10px] font-medium text-foreground/45" aria-live="polite">
              {appealValid
                ? 'MaliMart will review your appeal and notify you of the decision.'
                : 'Please write at least 10 characters so the review team has enough context.'}
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => { setAppealProduct(null); setAppealText(''); }}
              disabled={appealSubmitting}
              className="min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitAppeal}
              disabled={!appealValid || appealSubmitting}
              isLoading={appealSubmitting}
              className="min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              Submit appeal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restore confirm */}
      <ConfirmModal
        isOpen={restoreModal.open}
        onClose={() => setRestoreModal({ ids: [], open: false })}
        onConfirm={handleRestore}
        title="Restore Products"
        message={`Restore ${restoreModal.ids.length} product${restoreModal.ids.length !== 1 ? 's' : ''} as draft? You can set them back to active once you review them.`}
        confirmText="Restore"
        isDestructive={false}
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

      {/* AI Inventory Insights panel */}
      <AnimatePresence>
        {showAIInsights && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[199] bg-black/30 backdrop-blur-sm"
              onClick={() => setShowAIInsights(false)}
            />
            <AIInventoryInsights
              products={products as any}
              onClose={() => setShowAIInsights(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
