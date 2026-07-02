import React from 'react';
import { Badge, Button, EmptyState } from '../../components/UI';
import { formatTZS } from '../../constants';
import { motion } from 'framer-motion';
import { MessageSquare, Package, Search } from 'lucide-react';
import { useAdmin } from './context';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

const statusVariant = (status: string) => {
    if (['active', 'approved', 'resolved'].includes(status)) return 'success';
    if (['banned', 'rejected', 'disputed'].includes(status)) return 'danger';
    return 'secondary';
};

export const ProductsTab = () => {
    const { filteredProducts, handleMessageUser, handleToggleProductStatus, productSearch, setProductSearch } = useAdmin();

    const renderThumb = (p: any) => (
        <div className="w-12 h-16 bg-muted/50 rounded-xl overflow-hidden border border-border shadow-sm flex items-center justify-center flex-shrink-0">
            {p.images && p.images[0] ? (
                <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
            ) : (
                <Package className="w-5 h-5 text-muted-foreground stroke-2" />
            )}
        </div>
    );

    const renderActions = (p: any) => (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="icon"
                className={`h-9 w-9 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all ${focusRing}`}
                onClick={() => handleMessageUser(p.seller_id, p.profiles?.full_name || 'Seller', { type: 'support', label: p.name, id: p.id })}
                title="Message Seller"
                aria-label="Message Seller"
            >
                <MessageSquare className="w-4 h-4 text-foreground/70" />
            </Button>
            <Button
                variant={p.status === 'active' ? 'outline' : 'primary'}
                size="sm"
                className={`h-9 px-4 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm hover:shadow-md transition-all ${p.status === 'active' ? 'border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground' : ''} ${focusRing}`}
                onClick={() => handleToggleProductStatus(p.id, p.status)}
                aria-label={p.status === 'active' ? `Take down ${p.name}` : `Restore ${p.name}`}
            >
                {p.status === 'active' ? 'Take Down' : 'Restore'}
            </Button>
        </div>
    );

    return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="glass-surface rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <h3 className="font-sans font-black text-lg tracking-tight">Product Moderation</h3>
                                    <div className="w-full md:w-72">
                                        <div className="relative w-full">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                            <input
                                                type="text"
                                                placeholder="SEARCH PRODUCTS..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                aria-label="Search products"
                                                className={`w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider transition-all placeholder:text-muted-foreground ${focusRing}`}
                                            />
                                        </div>
                                        {productSearch && (
                                            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground" aria-live="polite">
                                                {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {filteredProducts.length === 0 ? (
                                    <EmptyState
                                        icon={Package}
                                        title={productSearch ? 'No products match your search' : 'No products yet'}
                                        subtitle={productSearch ? 'Try a different product or seller name.' : 'Newly listed products will appear here.'}
                                    />
                                ) : (
                                <>
                                {/* Desktop table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-widest text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-5 font-sans">Product</th>
                                                <th className="p-5 font-sans">Seller</th>
                                                <th className="p-5 font-sans">Price</th>
                                                <th className="p-5 font-sans">Status</th>
                                                <th className="p-5 font-sans text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredProducts.map((p, index) => (
                                                <motion.tr
                                                    key={p.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-4">
                                                            {renderThumb(p)}
                                                            <div>
                                                                <p className="font-sans font-bold text-sm text-foreground line-clamp-1">{p.name}</p>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{p.category}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-xs font-bold text-foreground">{p.profiles?.full_name || 'Unknown'}</td>
                                                    <td className="p-5 font-mono text-sm font-medium text-foreground">{formatTZS(p.price)}</td>
                                                    <td className="p-5">
                                                        <Badge variant={statusVariant(p.status)} className="text-[10px] font-bold uppercase tracking-widest rounded-full">
                                                            {p.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex justify-end">
                                                            {renderActions(p)}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile card list */}
                                <div className="md:hidden divide-y divide-border">
                                    {filteredProducts.map((p, index) => (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="p-5 space-y-3"
                                        >
                                            <div className="flex items-start gap-4">
                                                {renderThumb(p)}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-sans font-bold text-sm text-foreground line-clamp-1">{p.name}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{p.category}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">By {p.profiles?.full_name || 'Unknown'}</p>
                                                </div>
                                                <Badge variant={statusVariant(p.status)} className="text-[10px] font-bold uppercase tracking-widest rounded-full flex-shrink-0">
                                                    {p.status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-mono text-sm font-medium text-foreground">{formatTZS(p.price)}</p>
                                                {renderActions(p)}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                </>
                                )}
                            </motion.div>
    );
};
