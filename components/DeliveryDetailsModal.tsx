import React, { useState } from 'react';
import { Button, Input, Label, Select } from './UI';
import { X, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeliveryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (details: { method: string; cost?: number | null; driverName?: string; driverPhone?: string; notes?: string }) => void;
}

const METHODS = [
  'Own driver / rider',
  'Bus / coach parcel',
  'Boda boda',
  'Courier partner',
  'Customer pickup',
];

/** Collected right before a seller marks an order shipped — how it's going
 * out, what it actually costs (if different from the checkout estimate),
 * and who the buyer can contact if the delivery method involves a driver. */
export const DeliveryDetailsModal = ({ isOpen, onClose, onConfirm }: DeliveryDetailsModalProps) => {
  const [method, setMethod] = useState(METHODS[0]);
  const [cost, setCost] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [notes, setNotes] = useState('');

  const needsDriverContact = method === 'Own driver / rider' || method === 'Boda boda';

  const handleConfirm = () => {
    onConfirm({
      method,
      cost: cost.trim() ? Number(cost) : null,
      driverName: driverName.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setMethod(METHODS[0]); setCost(''); setDriverName(''); setDriverPhone(''); setNotes('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-background rounded-3xl p-8 max-w-md w-full shadow-2xl border border-foreground/8 relative max-h-[90vh] overflow-y-auto"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-foreground/40 hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Truck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Delivery Details</h2>
            </div>

            <p className="text-sm text-foreground/55 mb-6">
              Tell the buyer how this order is going out before you mark it shipped.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">Delivery method</Label>
                <Select value={method} onChange={(e: any) => setMethod(e.target.value)} className="h-12 rounded-2xl">
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>

              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">
                  Actual delivery cost (TZS) <span className="normal-case font-medium text-foreground/30">— optional, only if different from checkout</span>
                </Label>
                <Input type="number" min="0" value={cost} onChange={(e: any) => setCost(e.target.value)}
                  placeholder="e.g. 5000" className="h-12 rounded-2xl bg-foreground/[0.02] dark:bg-background/5 border-none" />
              </div>

              {needsDriverContact && (
                <>
                  <div>
                    <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">Driver name</Label>
                    <Input value={driverName} onChange={(e: any) => setDriverName(e.target.value)}
                      placeholder="e.g. Juma" className="h-12 rounded-2xl bg-foreground/[0.02] dark:bg-background/5 border-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">Driver phone</Label>
                    <Input value={driverPhone} onChange={(e: any) => setDriverPhone(e.target.value)}
                      placeholder="e.g. 0712 345 678" className="h-12 rounded-2xl bg-foreground/[0.02] dark:bg-background/5 border-none" />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-foreground/40 mb-2 block">
                  Extra details <span className="normal-case font-medium text-foreground/30">— optional</span>
                </Label>
                <Input value={notes} onChange={(e: any) => setNotes(e.target.value)}
                  placeholder="e.g. arriving between 2-4pm" className="h-12 rounded-2xl bg-foreground/[0.02] dark:bg-background/5 border-none" />
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-2xl">Cancel</Button>
              <Button onClick={handleConfirm} className="flex-1 h-12 rounded-2xl uppercase tracking-widest text-xs font-black">
                Save &amp; Mark Shipped
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
