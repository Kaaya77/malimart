import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, Home, ShoppingBag } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Card, Skeleton } from '../components/UI';
import { Order, Address } from '../types';
import { formatTZS } from '../constants';
import { OrderTracking } from '../components/CheckoutComponents';

export const OrderConfirmationPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location;
    const { orders, user } = useAppState();
    const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(state?.order || null);

    useEffect(() => {
        if (!confirmedOrder) {
            const latestOrder = orders?.[0];
            if (latestOrder) {
                setConfirmedOrder(latestOrder);
            } else {
                // If no order is found, maybe redirect after a few seconds
                setTimeout(() => navigate('/orders'), 3000);
            }
        }
    }, [orders, confirmedOrder, navigate]);

    if (!confirmedOrder) {
        return (
            <div className="container mx-auto px-6 py-20 text-center min-h-[80vh] flex flex-col items-center justify-center">
                <div className="animate-pulse">
                    <h2 className="text-3xl font-bold text-foreground/80">Loading your order details...</h2>
                    <p className="text-foreground/55 mt-2">If you are not redirected, please check your orders page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background font-sans min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] pt-24">
            <div className="container mx-auto px-4 md:px-6 py-8 md:py-16">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <Card className="max-w-4xl mx-auto p-6 md:p-12 rounded-3xl">
                        <div className="text-center mb-12">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                            >
                                <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
                            </motion.div>
                            <h1 className="text-4xl md:text-5xl font-black text-foreground font-display uppercase tracking-tighter">Thank You, {user?.user_metadata?.full_name || 'Valued Customer'}!</h1>
                            <p className="text-foreground/55 mt-4 text-lg font-medium">Your order has been placed successfully.</p>
                            <p className="text-xs text-foreground/40 mt-2 font-bold uppercase tracking-widest">Order ID: #{confirmedOrder.id.slice(0, 8)}</p>
                        </div>

                        <div className="mb-12">
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2"><Package className="w-4 h-4 text-brand-500" /> Order Progress</h3>
                            <OrderTracking order={confirmedOrder} />
                        </div>

                        <motion.div 
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: { opacity: 0 },
                                visible: {
                                    opacity: 1,
                                    transition: { staggerChildren: 0.1, delayChildren: 0.4 }
                                }
                            }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 text-sm"
                        >
                            <motion.div 
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
                                }}
                                className="bg-foreground/[0.02] dark:bg-background/5 p-6 rounded-[2rem]"
                            >
                                <h4 className="font-black uppercase tracking-widest text-xs text-foreground/40 mb-4">Shipping To</h4>
                                {(() => {
                                    const addr = confirmedOrder.address;
                                    if (addr && typeof addr === 'object') {
                                        const a = addr as Address;
                                        return (
                                            <>
                                                <p className="font-bold text-foreground">{a.street}</p>
                                                <p className="text-foreground/55">{a.city || ''}, {a.postal_code || ''}</p>
                                                <p className="text-foreground/55">{a.phone || ''}</p>
                                            </>
                                        );
                                    }
                                    return (
                                        <p className="font-bold text-foreground">{addr || 'N/A'}</p>
                                    );
                                })()}
                            </motion.div>
                            <motion.div 
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
                                }}
                                className="bg-foreground/[0.02] dark:bg-background/5 p-6 rounded-[2rem]"
                            >
                                <h4 className="font-black uppercase tracking-widest text-xs text-foreground/40 mb-4">Order Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between"><span className="text-foreground/55">Subtotal:</span><span className="font-bold text-foreground">{formatTZS(confirmedOrder.subtotal)}</span></div>
                                    <div className="flex justify-between"><span className="text-foreground/55">VAT:</span><span className="font-bold text-foreground">{formatTZS(confirmedOrder.vat)}</span></div>
                                    <div className="flex justify-between"><span className="text-foreground/55">Delivery:</span><span className="font-bold text-foreground">{formatTZS(confirmedOrder.delivery_fee)}</span></div>
                                    {confirmedOrder.discount > 0 && <div className="flex justify-between text-emerald-500"><span className="font-bold">Discount:</span><span className="font-bold">-{formatTZS(confirmedOrder.discount)}</span></div>}
                                    <div className="flex justify-between font-black text-lg text-foreground pt-2 border-t border-foreground/10 mt-2"><span>Total:</span><span>{formatTZS(confirmedOrder.total)}</span></div>
                                </div>
                            </motion.div>
                        </motion.div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/orders"><Button variant="outline" className="h-14 w-full sm:w-auto px-8 rounded-2xl text-xs font-black uppercase tracking-widest"><Package className="w-4 h-4 mr-2"/> My Orders</Button></Link>
                            <Link to="/shop"><Button variant="brand" className="h-14 w-full sm:w-auto px-8 rounded-2xl text-xs font-black uppercase tracking-widest"><ShoppingBag className="w-4 h-4 mr-2"/> Continue Shopping</Button></Link>
                        </div>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};
