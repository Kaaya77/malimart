import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Label, Modal, Textarea, useToast } from '../../components/UI';
import { fetchProductAppeals, resolveProductAppeal, ProductAppeal } from '../../services/moderationApi';
import { Package, ShieldAlert } from 'lucide-react';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

const appealBadge = (status: ProductAppeal['status']) =>
    status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'secondary';

// Product-suspension appeals review queue. Sellers file these from their
// Inventory page after an admin takedown; approving reinstates the product,
// rejecting requires a written response. Both outcomes notify the seller.
export const ProductAppealsPanel = () => {
    const { addToast } = useToast();
    const [appeals, setAppeals] = useState<ProductAppeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    // Reject dialog (response required)
    const [rejectTarget, setRejectTarget] = useState<ProductAppeal | null>(null);
    const [rejectResponse, setRejectResponse] = useState('');
    const responseValid = rejectResponse.trim().length >= 5;

    const load = async () => {
        try {
            setAppeals(await fetchProductAppeals());
        } catch (e: any) {
            addToast(e?.message || 'Failed to load product appeals', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleApprove = async (appeal: ProductAppeal) => {
        setResolvingId(appeal.id);
        try {
            await resolveProductAppeal(appeal.id, true);
            addToast('Appeal approved — product reinstated and seller notified', 'success');
            await load();
        } catch (e: any) {
            addToast(e?.message || 'Failed to approve appeal', 'error');
        } finally {
            setResolvingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectTarget || !responseValid) return;
        setResolvingId(rejectTarget.id);
        try {
            await resolveProductAppeal(rejectTarget.id, false, rejectResponse.trim());
            addToast('Appeal rejected — seller notified with your response', 'success');
            setRejectTarget(null);
            setRejectResponse('');
            await load();
        } catch (e: any) {
            addToast(e?.message || 'Failed to reject appeal', 'error');
        } finally {
            setResolvingId(null);
        }
    };

    const pending = appeals.filter(a => a.status === 'pending');
    const resolved = appeals.filter(a => a.status !== 'pending');

    const renderAppeal = (appeal: ProductAppeal) => (
        <Card key={appeal.id} className="p-6 rounded-3xl border border-foreground/8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-14 rounded-xl overflow-hidden bg-foreground/[0.05] flex items-center justify-center flex-shrink-0">
                        {appeal.product?.images?.[0]
                            ? <img src={appeal.product.images[0]} alt={appeal.product?.name || 'Product'} className="w-full h-full object-cover" />
                            : <Package className="w-5 h-5 text-foreground/25" />
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="font-sans font-bold text-sm text-foreground line-clamp-1">{appeal.product?.name || 'Deleted product'}</p>
                        <p className="text-xs text-foreground/50 mt-0.5">
                            {appeal.seller?.full_name || 'Unknown seller'}
                            {appeal.seller?.email ? <span className="ml-2 text-foreground/35">{appeal.seller.email}</span> : null}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mt-1">
                            Filed {new Date(appeal.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>
                <Badge variant={appealBadge(appeal.status)} className="text-[10px] font-bold uppercase tracking-widest rounded-full self-start flex-shrink-0">
                    {appeal.status}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-destructive/70 mb-1.5">Takedown reason</p>
                    <p className="text-sm font-medium text-foreground leading-relaxed">{appeal.takedown_reason || 'No reason recorded'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/70 dark:text-emerald-400/70 mb-1.5">Seller's appeal</p>
                    <p className="text-sm font-medium text-foreground leading-relaxed">"{appeal.reason}"</p>
                </div>
            </div>

            {appeal.admin_response && (
                <p className="text-xs font-medium text-foreground/60 mb-4">
                    <span className="font-bold uppercase tracking-widest text-[10px] text-foreground/40 mr-2">Response</span>
                    {appeal.admin_response}
                </p>
            )}

            {appeal.status === 'pending' && (
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => { setRejectTarget(appeal); setRejectResponse(''); }}
                        disabled={resolvingId === appeal.id}
                        className={`min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground ${focusRing}`}
                    >
                        Reject
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => handleApprove(appeal)}
                        disabled={resolvingId === appeal.id}
                        isLoading={resolvingId === appeal.id}
                        className={`min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest ${focusRing}`}
                    >
                        Approve & reinstate
                    </Button>
                </div>
            )}
        </Card>
    );

    return (
        <section aria-label="Product suspension appeals" className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                    <h3 className="font-sans font-black text-lg tracking-tight text-foreground">Product Appeals</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                        {pending.length} pending review
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-32 rounded-3xl bg-foreground/[0.04] animate-pulse" />)}
                </div>
            ) : appeals.length === 0 ? (
                <Card className="rounded-3xl border border-foreground/8">
                    <EmptyState
                        icon={ShieldAlert}
                        title="No product appeals"
                        subtitle="When a seller contests a product takedown, the appeal will appear here for review."
                    />
                </Card>
            ) : (
                <div className="space-y-4">
                    {pending.map(renderAppeal)}
                    {resolved.length > 0 && (
                        <details className="group">
                            <summary className={`cursor-pointer list-none inline-flex items-center min-h-[44px] px-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors ${focusRing}`}>
                                Resolved appeals ({resolved.length})
                            </summary>
                            <div className="space-y-4 mt-4">
                                {resolved.map(renderAppeal)}
                            </div>
                        </details>
                    )}
                </div>
            )}

            {/* Reject dialog — response to the seller is mandatory */}
            <Modal
                isOpen={!!rejectTarget}
                onClose={() => { if (!resolvingId) { setRejectTarget(null); setRejectResponse(''); } }}
                title={rejectTarget ? `Reject appeal — "${rejectTarget.product?.name || 'product'}"` : 'Reject appeal'}
                size="md"
            >
                <div className="space-y-4">
                    <p className="text-xs font-medium text-foreground/60 leading-relaxed">
                        The product stays suspended. Your response is sent to the seller so they
                        understand the final decision — it is required.
                    </p>
                    <div>
                        <Label htmlFor="appeal-reject-response">Response to seller (required)</Label>
                        <Textarea
                            id="appeal-reject-response"
                            value={rejectResponse}
                            onChange={(e: any) => setRejectResponse(e.target.value)}
                            placeholder="e.g. The listing still violates our counterfeit policy — the brand authorization document was not provided."
                            aria-required="true"
                            autoFocus
                        />
                        {!responseValid && rejectResponse.length > 0 && (
                            <p className="mt-2 text-[10px] font-bold text-destructive" aria-live="polite">
                                Please write at least 5 characters.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => { setRejectTarget(null); setRejectResponse(''); }}
                            disabled={!!resolvingId}
                            className={`min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest ${focusRing}`}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleReject}
                            disabled={!responseValid || !!resolvingId}
                            isLoading={!!resolvingId}
                            className={`min-h-[44px] px-6 rounded-2xl text-xs font-bold uppercase tracking-widest ${focusRing}`}
                        >
                            Reject & notify seller
                        </Button>
                    </div>
                </div>
            </Modal>
        </section>
    );
};
