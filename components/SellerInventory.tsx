
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
 Search, Filter, Plus, Zap, Archive, Trash2, 
 CheckSquare, Square, Copy, Eye, Star, ChevronDown, 
 Edit3, Edit2, Package, ArrowUpRight, AlertTriangle, X,
 Download, ArrowUpDown, TrendingUp, Minus, MoreHorizontal,
 Calendar, History, Layers, ArrowRight, GripVertical, Check,
 DollarSign, BarChart3, AlertCircle, Clock, Percent, Share2, Upload, Wand2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppState } from '../context/AppContext';
import { Input, useToast, Label, Switch, ConfirmModal } from './UI';
import { Product, ProductVariant } from '../types';
import { formatTZS, CURRENCY, CATEGORY_HIERARCHY } from '../constants';
import { supabase } from '../services/supabaseClient';
import { ProductForm } from './ProductForm';
import { QuickProductForm } from './QuickProductForm';
import { CSVImport } from './CSVImport';
import { BulkEditModal } from './BulkEditModal';
import { AutoDiscountModal } from './AutoDiscountModal';

// --- Utility: Time Ago ---
const timeAgo = (dateStr?: string) => {
 if (!dateStr) return 'Unknown';
 const date = new Date(dateStr);
 const now = new Date();
 const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
 if (seconds < 60) return 'Just now';
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return date.toLocaleDateString();
};

// --- Sub-Components ---

const StatCard = ({ title, value, subtext, icon: Icon, color, secondaryValue, secondaryLabel }: any) => (
 <div className="relative overflow-hidden p-8 bg-background dark:bg-background border border-foreground/10 group hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
 <div className="flex justify-between items-start mb-8 relative z-10">
 <div>
 <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-2 text-foreground">{title}</p>
 <h3 className="text-4xl font-serif font-light text-foreground tracking-wide">{value}</h3>
 </div>
 <div className="w-10 h-10 flex items-center justify-center border border-foreground/10 rounded-none">
 <Icon className="w-4 h-4 text-foreground stroke-[1]" />
 </div>
 </div>
 <div className="flex items-center justify-between relative z-10">
 <p className="text-[11px] uppercase tracking-[0.1em] opacity-60 text-foreground">{subtext}</p>
 {secondaryValue && (
 <div className="text-right">
 <span className="block text-lg font-serif text-foreground">{secondaryValue}</span>
 <span className="text-[9px] uppercase tracking-[0.2em] opacity-40 text-foreground">{secondaryLabel}</span>
 </div>
 )}
 </div>
 </div>
);

const AdvancedFilterDrawer = ({ isOpen, onClose, filters, setFilters, onApply }: any) => {
 if (!isOpen) return null;
 return (
 <div className="absolute top-full left-0 mt-4 w-[320px] bg-background dark:bg-background border border-foreground/10 z-50 p-8 animate-in slide-in-from-top-4 shadow-2xl">
 <div className="flex justify-between items-center mb-8">
 <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground">Advanced Filters</h3>
 <button onClick={onClose} className="hover:opacity-50 transition-opacity"><X className="w-4 h-4 stroke-[1] text-foreground"/></button>
 </div>
 <div className="space-y-8">
 <div>
 <Label className="text-[10px] uppercase tracking-[0.1em] opacity-60 mb-4 block">Price Range ({formatTZS(filters.priceMin || 0)} - {formatTZS(filters.priceMax || 1000000)})</Label>
 <div className="flex gap-4">
 <Input type="number" placeholder="Min" value={filters.priceMin} onChange={(e:any) => setFilters({...filters, priceMin: Number(e.target.value)})} className="h-12 bg-transparent border-foreground/20 rounded-none text-xs focus:border-foreground" />
 <Input type="number" placeholder="Max" value={filters.priceMax} onChange={(e:any) => setFilters({...filters, priceMax: Number(e.target.value)})} className="h-12 bg-transparent border-foreground/20 rounded-none text-xs focus:border-foreground" />
 </div>
 </div>
 <div>
 <Label className="text-[10px] uppercase tracking-[0.1em] opacity-60 mb-4 block">Stock Level</Label>
 <div className="flex gap-4">
 <Input type="number" placeholder="Min Stock" value={filters.stockMin} onChange={(e:any) => setFilters({...filters, stockMin: Number(e.target.value)})} className="h-12 bg-transparent border-foreground/20 rounded-none text-xs focus:border-foreground" />
 <Input type="number" placeholder="Max Stock" value={filters.stockMax} onChange={(e:any) => setFilters({...filters, stockMax: Number(e.target.value)})} className="h-12 bg-transparent border-foreground/20 rounded-none text-xs focus:border-foreground" />
 </div>
 </div>
 <div>
 <div className="flex justify-between items-center mb-4"><Label className="text-[10px] uppercase tracking-[0.1em] opacity-60 mb-0">Flags</Label></div>
 <div className="flex flex-col gap-4">
 <div className="flex items-center gap-3"><Switch checked={filters.isBoosted} onCheckedChange={(v:boolean) => setFilters({...filters, isBoosted: v})} /><span className="text-[11px] uppercase tracking-[0.1em] text-foreground">Boosted Only</span></div>
 <div className="flex items-center gap-3"><Switch checked={filters.hasVariants} onCheckedChange={(v:boolean) => setFilters({...filters, hasVariants: v})} /><span className="text-[11px] uppercase tracking-[0.1em] text-foreground">Has Variants</span></div>
 </div>
 </div>
 <div className="pt-4">
 <button className="w-full h-12 bg-primary text-background dark:bg-background dark:text-foreground text-[10px] uppercase tracking-[0.2em] hover:opacity-90 transition-opacity" onClick={() => { onApply(); onClose(); }}>Apply Filters</button>
 </div>
 </div>
 </div>
 );
};

const HistoryLog = ({ productId }: { productId: string }) => {
 const [logs, setLogs] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchLogs = async () => {
 const { data } = await supabase.from('activity_logs')
 .select('*')
 .eq('entity_id', productId)
 .order('created_at', { ascending: false })
 .limit(3);
 setLogs(data || []);
 setLoading(false);
 };
 fetchLogs();
 }, [productId]);

 if (loading) return <div className="p-4 text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground">Loading history...</div>;
 if (logs.length === 0) return <div className="p-4 text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground italic">No recent activity recorded.</div>;

 return (
 <div className="p-6 space-y-4 bg-foreground/[0.05] dark:bg-background/5 border-t border-foreground/10">
 <h4 className="text-[9px] uppercase tracking-[0.2em] opacity-60 flex items-center gap-2 text-foreground"><History className="w-3 h-3 stroke-[1]"/> Recent Activity</h4>
 {logs.map(log => (
 <div key={log.id} className="flex justify-between items-center border-b border-foreground/10 pb-2 last:border-0 last:pb-0">
 <span className="text-[11px] uppercase tracking-[0.1em] text-foreground">{log.action_type.replace(/_/g, ' ')}</span>
 <span className="text-[10px] font-mono opacity-60 text-foreground">{new Date(log.created_at).toLocaleString()}</span>
 </div>
 ))}
 </div>
 );
};

interface InventoryRowProps {
 product: Product;
 isSelected: boolean;
 onSelect: () => void;
 onEdit: (p: Product) => void;
 onDelete: (id: string) => void;
 onToggleStatus: (p: Product) => void;
 onToggleBoost: (p: Product) => void;
 onDuplicate: (p: Product) => void;
 onDuplicateVariant: (p: Product) => void;
 onUpdateStock: (id: string, delta: number) => void;
 onDragStart: (e: React.DragEvent, id: string) => void;
 onDragOver: (e: React.DragEvent) => void;
 onDrop: (e: React.DragEvent, targetId: string) => void;
 onCreatePromo: (p: Product) => void;
 onAutoDiscount: (p: Product) => void;
}

const InventoryRow: React.FC<InventoryRowProps> = ({ 
 product, isSelected, onSelect, onEdit, onDelete, onToggleStatus, onToggleBoost,
 onDuplicate, onDuplicateVariant, onUpdateStock, onDragStart, onDragOver, onDrop, onCreatePromo, onAutoDiscount
}) => {
 const [isExpanded, setIsExpanded] = useState(false);
 const { addToast } = useToast();
 const isLowStock = product.stock < (product.low_stock_threshold || 5);
 
 // Profit calculation
 const variants = product.variants?.filter(v => v.is_active !== false) || [];
 const hasVariants = variants.length > 0;
 const prices = hasVariants ? variants.map(v => v.base_price) : [product.price];
 const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
 const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
 const isRange = hasVariants && minPrice !== maxPrice;

 const profit = product.cost_price ? minPrice - product.cost_price : 0;
 const margin = minPrice && product.cost_price ? ((minPrice - product.cost_price) / minPrice) * 100 : 0;

 const handleCopySku = (e: React.MouseEvent) => {
 e.stopPropagation();
 navigator.clipboard.writeText(product.sku || '');
 addToast("SKU Copied", "success");
 };

 return (
 <div 
 draggable 
 onDragStart={(e) => onDragStart(e, product.id)}
 onDragOver={onDragOver}
 onDrop={(e) => onDrop(e, product.id)}
 className={`group relative transition-all duration-300 border-b border-foreground/10 hover:bg-foreground/[0.04] ${isSelected ? 'bg-foreground/[0.04]' : ''}`}
 >
 {/* Mobile card layout */}
 <div className="flex md:hidden items-center gap-3 p-4">
 <div className="relative w-14 h-18 min-w-[56px] bg-foreground/[0.03] overflow-hidden rounded-xl border border-foreground/10 cursor-pointer" onClick={() => onEdit(product)}>
 {product.images?.[0]
 ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
 : <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-foreground/30 stroke-[1]"/></div>
 }
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
 <p className="text-[11px] text-foreground/45 truncate">{product.category}</p>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[12px] font-bold text-foreground">{CURRENCY} {Math.round(product.price).toLocaleString()}</span>
 <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${product.stock <= 0 ? 'bg-red-500/10 text-red-600' : product.stock <= 5 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
 {product.stock <= 0 ? 'Out of stock' : `${product.stock} left`}
 </span>
 </div>
 </div>
 <div className="flex gap-1 shrink-0">
 <button onClick={() => onEdit(product)} className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground/60 active:scale-90 transition-transform"><Edit2 className="w-3.5 h-3.5 stroke-[2]"/></button>
 <button onClick={() => onDelete(product.id)} className="w-9 h-9 rounded-xl bg-red-500/8 flex items-center justify-center text-red-500/70 active:scale-90 transition-transform"><Trash2 className="w-3.5 h-3.5 stroke-[2]"/></button>
 </div>
 </div>
 {/* Desktop table row */}
 <div className="hidden md:grid grid-cols-12 gap-6 items-center p-6">
 {/* Drag Handle & Checkbox */}
 <div className="col-span-1 flex items-center justify-center gap-4">
 <div className="cursor-grab opacity-30 hover:opacity-100 transition-opacity active:cursor-grabbing text-foreground"><GripVertical className="w-4 h-4 stroke-[1]"/></div>
 <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="opacity-50 hover:opacity-100 transition-opacity text-foreground">
 {isSelected ? <CheckSquare className="w-4 h-4 stroke-[1]" /> : <Square className="w-4 h-4 stroke-[1]" />}
 </button>
 </div>

 {/* Product Info */}
 <div className="col-span-4 flex items-center gap-6">
 <div className="relative w-16 h-20 bg-foreground/[0.03] overflow-hidden shrink-0 border border-foreground/10 group/img cursor-pointer" onClick={() => onEdit(product)}>
 {product.images?.[0] ? <img src={product.images[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><Package className="w-5 h-5 stroke-[1]"/></div>}
 {product.is_boosted && <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 text-white rounded-bl-lg"><Zap className="w-3 h-3 fill-current"/></div>}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-3">
 <p className="font-serif text-lg truncate cursor-pointer hover:opacity-70 transition-opacity text-foreground" onClick={() => onEdit(product)}>{product.name}</p>
 {/* Feature 1: Status Badges */}
 {product.status === 'draft' && <span className="text-[9px] uppercase tracking-[0.2em] border border-foreground/20 px-2 py-1 text-foreground">Draft</span>}
 </div>
 {/* Feature 2: Smart SKU Chip */}
 <div className="flex items-center gap-4 mt-2">
 <button onClick={handleCopySku} className="text-[10px] font-mono opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2 group/sku text-foreground" title="Copy SKU">
 {product.sku || 'NO-SKU'} <Copy className="w-3 h-3 opacity-0 group-hover/sku:opacity-100 transition-opacity stroke-[1]"/>
 </button>
 {/* Feature 3: Variant Indicator */}
 {hasVariants && <span className="text-[9px] uppercase tracking-[0.2em] opacity-60 flex items-center gap-1 text-foreground"><Layers className="w-3 h-3 stroke-[1]"/> {product.variants?.length} Vars</span>}
 </div>
 </div>
 </div>

 {/* Financials (Price & Margin) */}
 <div className="col-span-2 text-right">
 <p className="font-serif text-lg text-foreground">
 {formatTZS(minPrice)}
 {isRange && <span className="opacity-60 text-sm"> - {formatTZS(maxPrice)}</span>}
 </p>
 {/* Feature 4: Profit Margin Badge */}
 {margin > 0 && (
 <div className="flex justify-end mt-2">
 <span className="text-[9px] uppercase tracking-[0.2em] border border-foreground/20 px-2 py-1 text-foreground">
 {margin.toFixed(0)}% Margin
 </span>
 </div>
 )}
 </div>

 {/* Stock Level (Animated) */}
 <div className="col-span-3 flex flex-col justify-center px-6">
 <div className="flex justify-between items-end mb-2">
 <span className={`text-[10px] uppercase tracking-[0.2em] ${isLowStock ? 'text-red-500 animate-pulse' : 'opacity-60 text-foreground'}`}>
 {isLowStock ? 'Low Stock' : 'In Stock'}
 </span>
 <span className="text-sm font-serif text-foreground">{product.stock}</span>
 </div>
 {/* Feature 5: Stock Level Animation */}
 <div className="h-px w-full bg-primary/10 dark:bg-background/10 relative">
 <div 
 className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${isLowStock ? 'bg-red-500' : 'bg-foreground'}`}
 style={{ width: `${Math.min(100, (product.stock / 100) * 100)}%` }}
 ></div>
 </div>
 {/* Feature 6: Relative Time */}
 <p className="text-[9px] uppercase tracking-[0.1em] opacity-40 text-right mt-3 flex items-center justify-end gap-2 text-foreground"><Clock className="w-3 h-3 stroke-[1]"/> {timeAgo(product.updated_at)}</p>
 </div>

 {/* Actions */}
 <div className="col-span-2 flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
 <button onClick={() => onToggleBoost(product)} title={product.is_boosted ? "Remove Boost" : "Boost Listing"} className={`p-2 transition-opacity hover:opacity-50 ${product.is_boosted ? 'text-foreground' : 'opacity-40 text-foreground'}`}>
 <Zap className={`w-4 h-4 stroke-[1] ${product.is_boosted ? 'fill-current' : ''}`}/>
 </button>
 <button onClick={() => {
 const text = `Check out this product: ${product.name} - ${formatTZS(product.price)}`;
 const url = `${window.location.origin}/product/${product.id}`;
 if (navigator.share) {
 navigator.share({ title: product.name, text, url });
 } else {
 navigator.clipboard.writeText(`${text} ${url}`);
 addToast("Product link copied to clipboard", "success");
 }
 }} title="Share Product" className="p-2 transition-opacity hover:opacity-50 opacity-40 text-foreground">
 <Share2 className="w-4 h-4 stroke-[1]"/>
 </button>
 <button onClick={async () => {
 addToast("Generating social post...", "info");
 try {
 const { generateSocialPost } = await import('../services/geminiService');
 const post = await generateSocialPost(product);
 navigator.clipboard.writeText(post);
 addToast("Social post generated and copied!", "success");
 } catch (e) {
 addToast("Failed to generate post", "error");
 }
 }} title="Generate Social Post" className="p-2 transition-opacity hover:opacity-50 opacity-40 text-foreground">
 <Wand2 className="w-4 h-4 stroke-[1]"/>
 </button>
 <button onClick={() => setIsExpanded(!isExpanded)} className={`p-2 transition-opacity hover:opacity-50 ${isExpanded ? 'opacity-100 text-foreground' : 'opacity-40 text-foreground'}`}><History className="w-4 h-4 stroke-[1]"/></button>
 <div className="relative group/menu">
 <button className="p-2 transition-opacity hover:opacity-50 opacity-40 text-foreground"><MoreHorizontal className="w-4 h-4 stroke-[1]"/></button>
 <div className="absolute right-0 top-full mt-2 w-56 bg-background dark:bg-background border border-foreground/10 shadow-2xl hidden group-hover/menu:block z-50 animate-in fade-in zoom-in-95">
 <button onClick={() => onEdit(product)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] flex items-center gap-4 text-foreground transition-colors"><Edit3 className="w-3 h-3 stroke-[1]"/> Edit</button>
 <button onClick={() => onCreatePromo(product)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] flex items-center gap-4 text-foreground transition-colors"><Percent className="w-3 h-3 stroke-[1]"/> Create Promo</button>
 <button onClick={() => onAutoDiscount(product)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] flex items-center gap-4 text-foreground transition-colors"><Clock className="w-3 h-3 stroke-[1]"/> Auto-Discount Rule</button>
 <button onClick={() => onDuplicate(product)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] flex items-center gap-4 text-foreground transition-colors"><Copy className="w-3 h-3 stroke-[1]"/> Duplicate</button>
 <button onClick={() => onDuplicateVariant(product)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] flex items-center gap-4 text-foreground transition-colors"><Layers className="w-3 h-3 stroke-[1]"/> Copy to Variant</button>
 <div className="h-px bg-primary/10 dark:bg-background/10"></div>
 <button onClick={() => onDelete(product.id)} className="w-full text-left px-6 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 flex items-center gap-4 transition-colors"><Trash2 className="w-3 h-3 stroke-[1]"/> Delete</button>
 </div>
 </div>
 </div>
 </div>
 {isExpanded && <div className="animate-in slide-in-from-top-2"><HistoryLog productId={product.id} /></div>}
 </div>
 );
};

export const SellerInventory = ({ products: initialProducts, userId, refresh, onCreatePromo }: { products: Product[], userId: string, refresh: () => void, onCreatePromo: (p: Product) => void }) => {
 const { addToast } = useToast();
 const [products, setProducts] = useState<Product[]>(initialProducts);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(0);
 const [totalCount, setTotalCount] = useState(0);
 const PAGE_SIZE = 50;

 // Filters & Sort State
 const [search, setSearch] = useState('');
 const [category, setCategory] = useState('All');
 const [status, setStatus] = useState('All');
 const [sort, setSort] = useState({ key: 'created_at', asc: false });
 const [advFilters, setAdvFilters] = useState({ priceMin: '', priceMax: '', stockMin: '', stockMax: '', isBoosted: false, hasVariants: false });
 const [isFilterOpen, setIsFilterOpen] = useState(false);
 
 // Selection
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [editingProduct, setEditingProduct] = useState<Product | null>(null);
 const [isFormOpen, setIsFormOpen] = useState(false);
 const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
 const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
 const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
 const [isAutoDiscountOpen, setIsAutoDiscountOpen] = useState(false);
 const [productForDiscount, setProductForDiscount] = useState<Product | null>(null);
 const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
 const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);

 // Analytics Data (Enhanced)
 const stats = useMemo(() => {
 const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
 const value = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
 const lowStock = products.filter(p => p.stock < (p.low_stock_threshold || 5)).length;
 // Count total variants across all loaded products
 const totalVariants = products.reduce((acc, p) => acc + ((p.variants?.length || 0)), 0);
 return { totalStock, value, lowStock, totalVariants };
 }, [products]);

 // Data Fetching
 const fetchInventory = useCallback(async () => {
 setLoading(true);
 let query = supabase.from('products').select('*, variants:product_variants(*)', { count: 'exact' }).eq('seller_id', userId).is('deleted_at', null);

 if (search) query = query.ilike('name', `%${search}%`);
 if (category !== 'All') query = query.eq('category', category);
 if (status !== 'All') query = query.eq('status', status.toLowerCase());
 
 // Advanced Filters
 if (advFilters.priceMin) query = query.gte('price', Number(advFilters.priceMin));
 if (advFilters.priceMax) query = query.lte('price', Number(advFilters.priceMax));
 if (advFilters.stockMin) query = query.gte('stock', Number(advFilters.stockMin));
 if (advFilters.stockMax) query = query.lte('stock', Number(advFilters.stockMax));
 if (advFilters.isBoosted) query = query.eq('is_boosted', true);

 query = query.order(sort.key, { ascending: sort.asc });
 query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

 const { data, error, count } = await query;
 
 if (error) {
 addToast("Error fetching inventory", "error");
 } else {
 let result = data as Product[];
 if (advFilters.hasVariants) {
 result = result.filter(p => (p.variants?.length || 0) > 0);
 }
 setProducts(result);
 setTotalCount(count || 0);
 }
 setLoading(false);
 }, [userId, page, search, category, status, sort, advFilters]);

 useEffect(() => { fetchInventory(); }, [fetchInventory]);

 // --- Actions ---

 const handleUpdateStock = async (id: string, delta: number) => {
 const product = products.find(p => p.id === id);
 if (!product) return;
 const newStock = Math.max(0, product.stock + delta);
 
 // Optimistic UI
 setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p));
 
 const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', id);
 if (error) {
 fetchInventory(); // Revert on error
 addToast("Failed to update stock", "error");
 } else {
 // Log Activity
 await supabase.from('activity_logs').insert({
 user_id: userId,
 action_type: 'stock_update',
 entity_id: id,
 details: { old: product.stock, new: newStock, delta }
 });
 }
 };

 const handleToggleBoost = async (product: Product) => {
 const newVal = !product.is_boosted;
 // Optimistic
 setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_boosted: newVal } : p));
 
 const { error } = await supabase.from('products').update({ is_boosted: newVal }).eq('id', product.id);
 if (error) {
 fetchInventory();
 addToast("Boost update failed", "error");
 } else {
 addToast(newVal ? "Product Boosted!" : "Boost Removed", "success");
 }
 };

 const handleDuplicate = async (product: Product) => {
 const { id, created_at, updated_at, ...rest } = product;
 const newProduct = {
 ...rest,
 name: `${rest.name} (Copy)`,
 status: 'draft',
 sku: `${rest.sku}-COPY-${Math.floor(Math.random() * 1000)}`,
 sort_order: 0
 };
 
 const { error } = await supabase.from('products').insert(newProduct);
 if (!error) {
 addToast("Product duplicated", "success");
 fetchInventory();
 } else {
 addToast("Duplication failed", "error");
 }
 };

 const handleDuplicateVariant = async (product: Product) => {
 const newVariant = {
 product_id: product.id,
 base_price: product.price,
 sale_price: product.price,
 stock: product.stock,
 sku: `${product.sku}-VAR-${Date.now().toString().slice(-4)}`,
 attributes: { "Style": "Standard Copy" }, // Default
 is_active: true
 };
 const { error } = await supabase.from('product_variants').insert(newVariant);
 if (!error) addToast("Created variant from base product", "success");
 else addToast("Variant creation failed", "error");
 };

 const confirmDelete = (ids: string[]) => {
 setItemsToDelete(ids);
 setIsConfirmDeleteOpen(true);
 };

 const handleDelete = async () => {
 if (itemsToDelete.length === 0) return;
 
 // Use soft delete by setting deleted_at
 const { error } = await supabase.from('products')
 .update({ deleted_at: new Date().toISOString() })
 .in('id', itemsToDelete);

 if (!error) {
 addToast("Items archived successfully", "success");
 setSelectedIds(new Set());
 fetchInventory();
 } else {
 addToast("Archiving failed. Please try again.", "error");
 }
 setItemsToDelete([]);
 setIsConfirmDeleteOpen(false);
 };

 const handleExportCSV = () => {
 const headers = ['ID', 'Name', 'Category', 'Base Price', 'Stock', 'Status', 'Created'];
 const csvContent = [
 headers.join(','),
 ...products.map(p => [p.id, `"${p.name}"`, p.category, p.price, p.stock, p.status, p.created_at].join(','))
 ].join('\n');
 
 const blob = new Blob([csvContent], { type: 'text/csv' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
 a.click();
 addToast("Export downloaded", "success");
 };

 // Drag and Drop Sorting (Local + Batch Update)
 const handleDragStart = (e: React.DragEvent, id: string) => {
 e.dataTransfer.setData("text/plain", id);
 e.dataTransfer.effectAllowed = "move";
 };

 const handleDrop = async (e: React.DragEvent, targetId: string) => {
 e.preventDefault();
 const draggedId = e.dataTransfer.getData("text/plain");
 if (draggedId === targetId) return;

 const fromIndex = products.findIndex(p => p.id === draggedId);
 const toIndex = products.findIndex(p => p.id === targetId);
 
 if (fromIndex === -1 || toIndex === -1) return;

 const newItems = [...products];
 const [movedItem] = newItems.splice(fromIndex, 1);
 newItems.splice(toIndex, 0, movedItem);

 // Optimistic Update
 setProducts(newItems);

 try {
 const updates = newItems.map((p, index) => ({ id: p.id, sort_order: index }));
 // Note: In real app, consider using an RPC for batch updates or loop.
 // For now, simple toast to indicate drag success.
 addToast("Order updated locally (Save not persisted in demo)", "info"); 
 } catch (e) {
 }
 };

 return (
 <div className="space-y-12 pb-20">
 {/* 1. Analytics Dashboard (With Chart) */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4">
 <div className="lg:col-span-2 p-8 bg-background dark:bg-background border border-foreground/10">
 <h4 className="text-[10px] uppercase tracking-[0.2em] opacity-60 mb-8 text-foreground">Inventory Value Trend</h4>
 <div className="h-[200px] min-w-0 relative">
 <ResponsiveContainer width="100%" aspect={3}>
 <AreaChart data={products.slice(0, 10)}>
 <defs>
 <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#1a1a1a" stopOpacity={0.1}/>
 <stop offset="95%" stopColor="#1a1a1a" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
 <XAxis dataKey="name" hide />
 <YAxis hide />
 <Tooltip 
 contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '0', color: '#f5f2ed', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
 itemStyle={{ color: '#f5f2ed' }}
 />
 <Area type="monotone" dataKey="price" stroke="currentColor" className="text-foreground" fillOpacity={1} fill="url(#colorValue)" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="grid grid-cols-1 gap-6">
 <StatCard 
 title="Total Value" 
 value={formatTZS(stats.value)} 
 subtext="Retail value" 
 icon={DollarSign} 
 />
 <StatCard 
 title="Stock Health" 
 value={`${((1 - (stats.lowStock / (totalCount || 1))) * 100).toFixed(0)}%`} 
 subtext="Healthy Stock" 
 icon={BarChart3} 
 />
 </div>
 </div>

 {/* 2. Control Bar */}
 <div className="flex flex-col xl:flex-row justify-between gap-6 sticky top-24 z-20 bg-background/90 backdrop-blur-xl py-4 border-b border-foreground/10">
 <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto relative">
 <div className="relative group w-full sm:w-[320px]">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity text-foreground stroke-[1]" />
 <Input 
 placeholder="Search inventory..." 
 value={search} 
 onChange={(e:any) => setSearch(e.target.value)} 
 className="h-12 pl-12 bg-transparent border-foreground/20 rounded-none text-xs focus:border-foreground"
 />
 </div>
 <div className="flex gap-4 overflow-x-auto no-scrollbar">
 <select 
 value={status} 
 onChange={(e) => setStatus(e.target.value)}
 className="h-12 pl-4 pr-10 bg-transparent border border-foreground/20 rounded-none text-[10px] uppercase tracking-[0.2em] outline-none focus:border-foreground cursor-pointer appearance-none min-w-[120px] text-foreground"
 >
 <option value="All">Status</option>
 <option value="active">Active</option>
 <option value="draft">Draft</option>
 </select>
 <select 
 value={category} 
 onChange={(e) => setCategory(e.target.value)}
 className="h-12 pl-4 pr-10 bg-transparent border border-foreground/20 rounded-none text-[10px] uppercase tracking-[0.2em] outline-none focus:border-foreground cursor-pointer appearance-none min-w-[140px] text-foreground"
 >
 <option value="All">Category</option>
 {Object.keys(CATEGORY_HIERARCHY).map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 <button 
 onClick={() => setIsFilterOpen(!isFilterOpen)} 
 className={`h-12 px-6 border flex items-center gap-3 transition-all text-[10px] uppercase tracking-[0.2em] ${isFilterOpen ? 'bg-primary text-background dark:bg-background dark:text-foreground border-foreground dark:border-background' : 'bg-transparent border-foreground/20 hover:border-foreground text-foreground'}`}
 >
 <Filter className="w-4 h-4 stroke-[1]" /> Filters
 </button>
 </div>
 {/* Advanced Filter Drawer */}
 <AdvancedFilterDrawer 
 isOpen={isFilterOpen} 
 onClose={() => setIsFilterOpen(false)} 
 filters={advFilters} 
 setFilters={setAdvFilters}
 onApply={fetchInventory} 
 />
 </div>

 <div className="flex items-center gap-4">
 {selectedIds.size > 0 && (
 <div className="flex items-center gap-4 animate-in slide-in-from-right fade-in mr-4 bg-primary text-background dark:bg-background dark:text-foreground px-6 py-3">
 <span className="text-[10px] uppercase tracking-[0.2em]">{selectedIds.size} Selected</span>
 <div className="h-4 w-px bg-current opacity-20 mx-2"></div>
 <button onClick={() => confirmDelete(Array.from(selectedIds))} className="hover:opacity-50 transition-opacity"><Trash2 className="w-4 h-4 stroke-[1]"/></button>
 <button onClick={() => setSelectedIds(new Set())} className="hover:opacity-50 transition-opacity"><X className="w-4 h-4 stroke-[1]"/></button>
 </div>
 )}
 <button className="h-12 px-6 bg-foreground text-background text-[10px] uppercase tracking-[0.15em] font-bold rounded-xl hover:bg-foreground/90 transition-all active:scale-95 flex items-center gap-2" onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}>
 <Plus className="w-4 h-4 stroke-[1]" /> Add Product
 </button>
 <button className="h-12 px-6 bg-foreground/[0.05] text-foreground text-[10px] uppercase tracking-[0.15em] font-semibold rounded-xl border border-foreground/10 hover:bg-foreground/[0.08] transition-all active:scale-95 flex items-center gap-2" onClick={() => { setIsQuickFormOpen(true); }}>
 <Zap className="w-4 h-4 stroke-[1]" /> Quick Add
 </button>
 <button className="h-12 px-6 bg-foreground/[0.05] text-foreground text-[10px] uppercase tracking-[0.15em] font-semibold rounded-xl border border-foreground/10 hover:bg-foreground/[0.08] transition-all active:scale-95 flex items-center gap-2" onClick={() => { setIsBulkEditOpen(true); }}>
 <Layers className="w-4 h-4 stroke-[1]" /> Bulk Edit
 </button>
 <button className="h-12 px-6 bg-foreground/[0.05] text-foreground text-[10px] uppercase tracking-[0.15em] font-semibold rounded-xl border border-foreground/10 hover:bg-foreground/[0.08] transition-all active:scale-95 flex items-center gap-2" onClick={() => { setIsCSVImportOpen(true); }}>
 <Upload className="w-4 h-4 stroke-[1]" /> Import CSV
 </button>
 </div>
 </div>

 {/* 3. Inventory Table */}
 <div className="bg-background dark:bg-background border border-foreground/10 overflow-hidden flex flex-col min-h-[500px]">
 {/* Table Header */}
 <div className="hidden md:grid grid-cols-12 gap-6 px-6 py-6 border-b border-foreground/10 text-[9px] uppercase tracking-[0.2em] opacity-60 text-foreground sticky top-0 z-10 bg-background/95 backdrop-blur-xl">
 <div className="col-span-1 text-center">Order</div>
 <div className="col-span-4 pl-6">Product Details</div>
 <div className="col-span-2 text-right cursor-pointer hover:opacity-100 transition-opacity flex justify-end gap-2" onClick={() => setSort({ key: 'price', asc: !sort.asc })}>
 Price <ArrowUpDown className="w-3 h-3 stroke-[1]" />
 </div>
 <div className="col-span-3 text-center cursor-pointer hover:opacity-100 transition-opacity flex justify-center gap-2" onClick={() => setSort({ key: 'stock', asc: !sort.asc })}>
 Stock Level <ArrowUpDown className="w-3 h-3 stroke-[1]" />
 </div>
 <div className="col-span-2 text-right pr-6">Actions</div>
 </div>

 {/* Rows */}
 <div className="divide-y divide-foreground/10 dark:divide-background/10">
 {loading ? (
 <div className="p-4 space-y-4">
 {[1, 2, 3, 4, 5].map(i => (
 <div key={i} className="flex items-center gap-4 animate-pulse">
 <div className="w-12 h-12 bg-primary/10 dark:bg-background/10 rounded-none"></div>
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-primary/10 dark:bg-background/10 w-1/3"></div>
 <div className="h-3 bg-primary/10 dark:bg-background/10 w-1/4"></div>
 </div>
 <div className="w-24 h-4 bg-primary/10 dark:bg-background/10"></div>
 <div className="w-16 h-4 bg-primary/10 dark:bg-background/10"></div>
 </div>
 ))}
 </div>
 ) : products.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-foreground/40">
 <Package className="w-16 h-16 mb-4 opacity-50" />
 <p className="text-[10px] uppercase tracking-[0.2em]">No Inventory Found</p>
 </div>
 ) : (
 products.map(p => (
 <InventoryRow 
 key={p.id} 
 product={p} 
 isSelected={selectedIds.has(p.id)}
 onSelect={() => { const s = new Set(selectedIds); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setSelectedIds(s); }}
 onEdit={(p) => { setEditingProduct(p); setIsFormOpen(true); }}
 onDelete={(id) => confirmDelete([id])}
 onToggleStatus={async (prod) => { await supabase.from('products').update({ status: prod.status === 'active' ? 'draft' : 'active' }).eq('id', prod.id); fetchInventory(); }}
 onToggleBoost={handleToggleBoost}
 onDuplicate={handleDuplicate}
 onDuplicateVariant={handleDuplicateVariant}
 onUpdateStock={handleUpdateStock}
 onDragStart={handleDragStart}
 onDragOver={(e) => e.preventDefault()}
 onDrop={handleDrop}
 onCreatePromo={onCreatePromo}
 onAutoDiscount={(p) => { setProductForDiscount(p); setIsAutoDiscountOpen(true); }}
 />
 ))
 )}
 </div>

 {/* Pagination */}
 <div className="p-6 border-t border-foreground/10 flex justify-between items-center bg-background/50 dark:bg-background/50">
 <span className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground">Showing {products.length} of {totalCount} items</span>
 <div className="flex gap-4">
 <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="h-10 px-6 border border-foreground/20 text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-primary hover:text-background dark:hover:text-foreground transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit">Prev</button>
 <button disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)} className="h-10 px-6 border border-foreground/20 text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-primary hover:text-background dark:hover:text-foreground transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit">Next</button>
 </div>
 </div>
 </div>

 <ConfirmModal 
 isOpen={isConfirmDeleteOpen}
 onClose={() => {
 setIsConfirmDeleteOpen(false);
 setItemsToDelete([]);
 }}
 onConfirm={handleDelete}
 title="Archive Products"
 message={`Are you sure you want to archive ${itemsToDelete.length} item(s)? This will remove them from your store but keep them in your history.`}
 confirmText="Archive"
 isDestructive={true}
 />

 {isFormOpen && (
 <ProductForm 
 initialData={editingProduct} 
 onClose={() => setIsFormOpen(false)} 
 onSuccess={() => { fetchInventory(); setIsFormOpen(false); }} 
 />
 )}
 {isQuickFormOpen && (
 <QuickProductForm 
 onClose={() => setIsQuickFormOpen(false)} 
 onSuccess={() => { fetchInventory(); setIsQuickFormOpen(false); }} 
 />
 )}
 {isCSVImportOpen && (
 <CSVImport 
 onClose={() => setIsCSVImportOpen(false)} 
 onSuccess={() => { fetchInventory(); setIsCSVImportOpen(false); }} 
 />
 )}
 <BulkEditModal 
 isOpen={isBulkEditOpen}
 onClose={() => setIsBulkEditOpen(false)}
 products={products}
 onSave={fetchInventory}
 />
 <AutoDiscountModal 
 isOpen={isAutoDiscountOpen}
 onClose={() => { setIsAutoDiscountOpen(false); setProductForDiscount(null); }}
 product={productForDiscount}
 onSave={() => { fetchInventory(); }}
 />
 </div>
 );
};
