import React from 'react';
import { Modal } from './UI';
import { Order } from '../types';
import { formatTZS } from '../constants';

export const OrderDetailsModal = ({ isOpen, onClose, order }: { isOpen: boolean, onClose: () => void, order: Order | null }) => {
    if (!order) return null;
    return (
        <Modal isOpen={isOpen} title={`Order #${order.id.slice(0, 8)}`} onClose={onClose}>
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
                    <span className="text-sm font-serif opacity-60">Status</span>
                    <span className="text-sm uppercase tracking-widest font-bold">{order.status}</span>
                </div>
                <div className="flex justify-between items-center border-b border-foreground/10 pb-4">
                    <span className="text-sm font-serif opacity-60">Total</span>
                    <span className="text-sm font-mono font-bold">{formatTZS(order.total)}</span>
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-serif opacity-60">Items</span>
                    <div className="space-y-2">
                        {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.products?.name} x {item.quantity}</span>
                                <span className="font-mono">{formatTZS(item.price_at_purchase * item.quantity)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
