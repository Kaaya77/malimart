import React, { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from '../../components/UI';
import { KeyRound, LogOut, Mail } from 'lucide-react';
import { useAppState } from '../../context/AppContext';
import { supabase } from '../../services/supabaseClient';
import { changeMyPassword, requestMyAccountDeletion } from '../../services/accountApi';

// Seller Settings had no path to account-security actions at all — a seller
// who wanted to change their password or delete their account had nowhere
// to go from here, unlike Buyer Settings' whole Security & Privacy tab.
// Scoped to what's actually seller-account-relevant: password and deletion,
// not a duplicate of every buyer-only toggle (2FA/analytics/etc belong to
// the account, not the store, and aren't built out here either way).
export const SecurityTab = () => {
    const { user } = useAppState();
    const { addToast } = useToast();

    const [sendingReset, setSendingReset] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setSendingReset(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/auth/reset`,
            });
            if (error) throw error;
            addToast('Password reset link sent to ' + user.email, 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to send reset email', 'error');
        } finally {
            setSendingReset(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 8) { addToast('Password must be at least 8 characters', 'error'); return; }
        if (newPassword !== confirmPassword) { addToast('Passwords do not match', 'error'); return; }
        setChangingPassword(true);
        try {
            await changeMyPassword(newPassword);
            addToast('Password updated', 'success');
            setShowChangePassword(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            addToast(err.message || 'Failed to update password', 'error');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleRequestDeletion = async () => {
        if (!user || confirmText.trim().toLowerCase() !== (user.email || '').toLowerCase()) return;
        setIsRequesting(true);
        try {
            await requestMyAccountDeletion(user.id);
            addToast('Account deletion requested', 'success');
            setIsConfirmOpen(false);
            setConfirmText('');
        } catch {
            addToast('Failed to request deletion', 'error');
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <Card>
                <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Protect the account behind your store.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-foreground/55">Set a new password now, or get a reset link by email.</p>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => setShowChangePassword(v => !v)}>
                                <KeyRound className="w-3.5 h-3.5" /> Change
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handlePasswordReset} isLoading={sendingReset}>
                                {!sendingReset && <Mail className="w-3.5 h-3.5" />}
                                {sendingReset ? 'Sending…' : 'Email link'}
                            </Button>
                        </div>
                    </div>
                    {showChangePassword && (
                        <div className="mt-3 p-3 rounded-xl bg-foreground/[0.03] border border-foreground/[0.08] space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <Input type="password" placeholder="New password (min. 8 characters)" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} aria-label="New password" />
                            <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} aria-label="Confirm new password" />
                            <div className="flex justify-end gap-2 pt-1">
                                <Button variant="ghost" size="sm" onClick={() => { setShowChangePassword(false); setNewPassword(''); setConfirmPassword(''); }}>Cancel</Button>
                                <Button variant="primary" size="sm" onClick={handleChangePassword} isLoading={changingPassword} disabled={!newPassword || !confirmPassword}>
                                    {changingPassword ? 'Saving…' : 'Save password'}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="p-5 rounded-2xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-red-600 dark:text-red-400">Danger Zone</p>
                        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <p className="font-medium text-sm text-foreground">Delete Account</p>
                                <p className="text-xs text-muted-foreground">Permanently request deletion of your seller account, store and data. This cannot be undone.</p>
                            </div>
                            <Button variant="danger" className="shrink-0" onClick={() => setIsConfirmOpen(true)}>
                                <LogOut className="w-4 h-4 mr-2" /> Delete Account
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isConfirmOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <Card className="max-w-md w-full shadow-2xl border-none">
                        <CardContent className="pt-6">
                            <h3 className="text-lg font-bold text-foreground">Request Account Deletion</h3>
                            <p className="text-sm text-muted-foreground mt-1.5">
                                This closes your store and is irreversible. To confirm, type your account email
                                {user?.email && <> — <span className="font-mono font-semibold text-foreground">{user.email}</span></>} — below.
                            </p>
                            <Input
                                className="mt-4"
                                placeholder="Type your email to confirm"
                                aria-label="Type your email to confirm account deletion"
                                value={confirmText}
                                onChange={(e: any) => setConfirmText(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-3 pt-5">
                                <Button variant="secondary" className="flex-1" onClick={() => { setIsConfirmOpen(false); setConfirmText(''); }}>Cancel</Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={handleRequestDeletion}
                                    isLoading={isRequesting}
                                    disabled={confirmText.trim().toLowerCase() !== (user?.email || '').toLowerCase()}
                                >
                                    {isRequesting ? 'Requesting…' : 'Request Deletion'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
