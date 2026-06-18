import React from 'react';
import { Badge, Button } from '../../components/UI';
import { formatTZS } from '../../constants';
import { motion } from 'framer-motion';
import { MessageSquare, Package, Search } from 'lucide-react';
import { useAdmin } from './context';

export const ProductsTab = () => {
    const { filteredProducts, handleMessageUser, handleToggleProductStatus, name, productSearch, setProductSearch, status } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="glass-surface rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <h3 className="font-sans font-bold text-lg tracking-tight">Product Moderation</h3>
                                    <div className="relative w-full md:w-72">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                        <input 
                                            type="text" 
                                            placeholder="SEARCH PRODUCTS..." 
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" 
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-6 font-sans">Product</th>
                                                <th className="p-6 font-sans">Seller</th>
                                                <th className="p-6 font-sans">Price</th>
                                                <th className="p-6 font-sans">Status</th>
                                                <th className="p-6 font-sans text-right">Actions</th>
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
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-16 bg-muted/50 rounded-xl overflow-hidden border border-border shadow-sm flex items-center justify-center">
                                                                {p.images && p.images[0] ? (
                                                                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Package className="w-5 h-5 text-muted-foreground stroke-2" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-sans font-bold text-sm text-foreground line-clamp-1">{p.name}</p>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{p.category}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-xs font-bold text-foreground">{p.profiles?.full_name || 'Unknown'}</td>
                                                    <td className="p-6 font-mono font-medium text-foreground">{formatTZS(p.price)}</td>
                                                    <td className="p-6">
                                                        <Badge variant={p.status === 'active' ? 'secondary' : 'outline'} className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                            {p.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-6 text-right flex justify-end gap-2">
                                                        <Button 
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all"
                                                            onClick={() => handleMessageUser(p.seller_id, p.profiles?.full_name || 'Seller', { type: 'support', label: p.name, id: p.id })}
                                                            title="Message Seller"
                                                        >
                                                            <MessageSquare className="w-4 h-4 text-foreground/70" />
                                                        </Button>
                                                        <Button 
                                                            variant={p.status === 'active' ? 'outline' : 'default'}
                                                            size="sm"
                                                            className={`h-8 px-4 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all ${p.status === 'active' ? 'border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground' : ''}`}
                                                            onClick={() => handleToggleProductStatus(p.id, p.status)}
                                                        >
                                                            {p.status === 'active' ? 'Take Down' : 'Restore'}
                                                        </Button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
    );
};
