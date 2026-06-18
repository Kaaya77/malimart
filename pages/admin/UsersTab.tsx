import React from 'react';
import { Badge, Button } from '../../components/UI';
import { supabase } from '../../services/supabaseClient';
import { motion } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Lock, MessageSquare, Search, Trash2, Unlock } from 'lucide-react';
import { useAdmin } from './context';

export const UsersTab = () => {
    const { addToast, confirmDeleteUser, fetchAdminData, filteredUsers, handleMessageUser, handleToggleUserBan, setUserSearch, userSearch } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="glass-surface rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <h3 className="font-sans font-bold text-lg tracking-tight">User Directory</h3>
                                    <div className="relative w-full md:w-72">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                        <input 
                                            type="text" 
                                            placeholder="SEARCH USERS..." 
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            className="w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" 
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-6 font-sans">User</th>
                                                <th className="p-6 font-sans">Role</th>
                                                <th className="p-6 font-sans">Joined</th>
                                                <th className="p-6 font-sans text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredUsers.map((u, index) => (
                                                <motion.tr 
                                                    key={u.id} 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="p-6">
                                                        <p className="font-sans font-bold text-sm text-foreground">{u.full_name || 'Unknown'}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{u.email}</p>
                                                    </td>
                                                    <td className="p-6 flex items-center gap-2">
                                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                            {u.role}
                                                        </Badge>
                                                        {u.is_banned && (
                                                            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                                Banned
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-6 text-xs font-medium text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                                                    <td className="p-6 text-right flex justify-end gap-2">
                                                        {u.role !== 'admin' && (
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => handleMessageUser(u.id, u.full_name)}
                                                                    title="Message User"
                                                                >
                                                                    <MessageSquare className="w-4 h-4 text-foreground/70" />
                                                                </Button>
                                                                
                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => {
                                                                        const newRole = u.role === 'seller' ? 'buyer' : 'seller';
                                                                        supabase.from('profiles').update({ role: newRole }).eq('id', u.id).then(() => {
                                                                            addToast(`User ${newRole === 'seller' ? 'promoted to seller' : 'demoted to buyer'}`, "success");
                                                                            fetchAdminData();
                                                                        });
                                                                    }}
                                                                    title={u.role === 'seller' ? 'Demote to Buyer' : 'Promote to Seller'}
                                                                >
                                                                    {u.role === 'seller' ? <ArrowDownCircle className="w-4 h-4 text-foreground/70" /> : <ArrowUpCircle className="w-4 h-4 text-foreground/70" />}
                                                                </Button>

                                                                <Button 
                                                                    variant={u.is_banned ? "default" : "outline"}
                                                                    size="icon"
                                                                    className={`h-8 w-8 rounded-xl shadow-sm hover:shadow-md transition-all ${u.is_banned ? 'bg-primary text-white' : 'glass-surface border-border'}`}
                                                                    onClick={() => handleToggleUserBan(u.id, u.is_banned)}
                                                                    title={u.is_banned ? 'Unban User' : 'Ban User'}
                                                                >
                                                                    {u.is_banned ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4 text-foreground/70"/>}
                                                                </Button>

                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl glass-surface border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => confirmDeleteUser(u.id)}
                                                                    title="Delete User"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
    );
};
