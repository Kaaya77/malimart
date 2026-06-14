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

import { STATUS_CFG } from './seller-inventory/config';
import { StockAdjustModal } from './seller-inventory/StockAdjustModal';
import { InventoryRow } from './seller-inventory/InventoryRow';
import { StatCard } from './seller-inventory/StatCard';

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

  // Seed from preloaded context data — instant display on first visit
  useEffect(() => {
    if (contextInventory?.length && !debouncedSearch && status === 'All' && !lowStockOnly && page === 0) {
      setProducts(contextInventory as InventoryProduct[]);
      setLoading(false);
    }
  }, [contextInventory]);

  useEffect(() => { setPage(0); }, [debouncedSearch, status, lowStockOnly]);
  useEffect(() => { fetchInventory(!!contextInventory?.length); }, [fetchInventory]);

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
    setSelectedIds(prev => prev.size === displayedProducts.length ? new Set() : new Set(displayedProducts.map(p => p.id)));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // Category is a client-side display filter (RPC doesn't support p_category yet)
  const displayedProducts = useMemo(
    () => category === 'All' ? products : products.filter(p => p.category === category),
    [products, category]
  );
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigate('/seller/products/new')}
            className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Product
          </button>
          <button onClick={() => setIsQuickFormOpen(true)} title="Quick add"
            className="h-10 px-3.5 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground transition-all flex items-center gap-1.5">
            <Zap className="w-4 h-4" /><span className="hidden sm:inline text-xs">Quick</span>
          </button>
          <button onClick={handleExportCSV} title="Export CSV"
            className="h-10 px-3.5 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground transition-all flex items-center gap-1.5">
            <Download className="w-4 h-4" /><span className="hidden sm:inline text-xs">Export</span>
          </button>
          <button onClick={() => setIsCSVImportOpen(true)} title="Import CSV"
            className="h-10 px-3.5 rounded-xl border border-foreground/12 bg-foreground/[0.04] text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground transition-all flex items-center gap-1.5">
            <Upload className="w-4 h-4" /><span className="hidden sm:inline text-xs">Import</span>
          </button>
        </div>
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
            displayedProducts.map(p => (
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
