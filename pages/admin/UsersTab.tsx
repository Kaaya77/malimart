import React from 'react';
import { Badge, Button, EmptyState } from '../../components/UI';
import { setUserRole } from '../../services/adminApi';
import { motion } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Lock, MessageSquare, Search, Trash2, Unlock, Users } from 'lucide-react';
import { useAdmin } from './context';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

export const UsersTab = () => {
    const { addToast, confirmDeleteUser, fetchAdminData, filteredUsers, handleMessageUser, handleToggleUserBan, setUserSearch, userSearch } = useAdmin();

    const handleToggleRole = (u: any) => {
        const newRole = u.role === 'seller' ? 'buyer' : 'seller';
        setUserRole(u.id, newRole).then(() => {
            addToast(`User ${newRole === 'seller' ? 'promoted to seller' : 'demoted to buyer'}`, "success");
            fetchAdminData();
        });
    };

    const renderStatusBadges = (u: any) => (
        <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest rounded-full">
                {u.role}
            </Badge>
            {u.is_banned && (
                <Badge variant="danger" className="text-[10px] font-bold uppercase tracking-widest rounded-full">
                    Banned
                </Badge>
            )}
        </div>
    );

    const renderActions = (u: any) => (
        u.role !== 'admin' ? (
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all ${focusRing}`}
                    onClick={() => handleMessageUser(u.id, u.full_name)}
                    title="Message User"
                    aria-label="Message User"
                >
                    <MessageSquare className="w-4 h-4 text-foreground/70" />
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-xl glass-surface border-border shadow-sm hover:shadow-md transition-all ${focusRing}`}
                    onClick={() => handleToggleRole(u)}
                    title={u.role === 'seller' ? 'Demote to Buyer' : 'Promote to Seller'}
                    aria-label={u.role === 'seller' ? 'Demote to Buyer' : 'Promote to Seller'}
                >
                    {u.role === 'seller' ? <ArrowDownCircle className="w-4 h-4 text-foreground/70" /> : <ArrowUpCircle className="w-4 h-4 text-foreground/70" />}
                </Button>

                <Button
                    variant={u.is_banned ? "primary" : "outline"}
                    size="icon"
                    className={`h-9 w-9 rounded-xl shadow-sm hover:shadow-md transition-all ${u.is_banned ? '' : 'glass-surface border-border'} ${focusRing}`}
                    onClick={() => handleToggleUserBan(u.id, u.is_banned)}
                    title={u.is_banned ? 'Unban User' : 'Ban User'}
                    aria-label={u.is_banned ? 'Unban User' : 'Ban User'}
                >
                    {u.is_banned ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4 text-foreground/70"/>}
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 rounded-xl glass-surface border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm hover:shadow-md transition-all ${focusRing}`}
                    onClick={() => confirmDeleteUser(u.id)}
                    title="Delete User"
                    aria-label="Delete User"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        ) : null
    );

    return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="glass-surface rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <h3 className="font-sans font-black text-lg tracking-tight">User Directory</h3>
                                    <div className="w-full md:w-72">
                                        <div className="relative w-full">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                            <input
                                                type="text"
                                                placeholder="SEARCH USERS..."
                                                value={userSearch}
                                                onChange={(e) => setUserSearch(e.target.value)}
                                                aria-label="Search users"
                                                className={`w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider transition-all placeholder:text-muted-foreground ${focusRing}`}
                                            />
                                        </div>
                                        {userSearch && (
                                            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground" aria-live="polite">
                                                {filteredUsers.length} result{filteredUsers.length === 1 ? '' : 's'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {filteredUsers.length === 0 ? (
                                    <EmptyState
                                        icon={Users}
                                        title={userSearch ? 'No users match your search' : 'No users yet'}
                                        subtitle={userSearch ? 'Try a different name or email.' : 'New signups will appear here.'}
                                    />
                                ) : (
                                <>
                                {/* Desktop table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-widest text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-5 font-sans">User</th>
                                                <th className="p-5 font-sans">Role</th>
                                                <th className="p-5 font-sans">Joined</th>
                                                <th className="p-5 font-sans text-right">Actions</th>
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
                                                    <td className="p-5">
                                                        <p className="font-sans font-bold text-sm text-foreground">{u.full_name || 'Unknown'}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{u.email}</p>
                                                    </td>
                                                    <td className="p-5">
                                                        {renderStatusBadges(u)}
                                                    </td>
                                                    <td className="p-5 text-xs font-medium text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                                                    <td className="p-5">
                                                        <div className="flex justify-end">
                                                            {renderActions(u)}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile card list */}
                                <div className="md:hidden divide-y divide-border">
                                    {filteredUsers.map((u, index) => (
                                        <motion.div
                                            key={u.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="p-5 space-y-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-sans font-bold text-sm text-foreground truncate">{u.full_name || 'Unknown'}</p>
                                                    <p className="text-xs text-muted-foreground mt-1 truncate">{u.email}</p>
                                                </div>
                                                {renderStatusBadges(u)}
                                            </div>
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                                Joined {new Date(u.created_at).toLocaleDateString()}
                                            </p>
                                            {renderActions(u)}
                                        </motion.div>
                                    ))}
                                </div>
                                </>
                                )}
                            </motion.div>
    );
};
