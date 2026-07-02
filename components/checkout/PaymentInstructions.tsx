import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, MapPin, Truck, ShieldCheck, X,
  Plus, Smartphone, Banknote, Home, Receipt,
  ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
  Package, ArrowRight, CheckCircle2, Clock, Wallet,
  Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare,
  CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart,
  HelpCircle, Phone, Lock, Sparkles, AlertCircle
} from 'lucide-react';
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from '../UI';
import { formatTZS, CURRENCY } from '../../constants';
import { useAppState } from '../../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../../types';

export const PaymentInstructions = ({ method, seller }: { method: string; seller: VendorProfile }) => {
  if (method === 'cash') return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/15 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
      Have exact cash ready for the delivery driver.
    </div>
  );
  const getLipaNumber = () => {
    if (seller.lipa_namba) return { num: seller.lipa_namba, type: 'Lipa Namba' };
    if (seller.mobile_number) return { num: seller.mobile_number, type: seller.mobile_operator || 'Mobile' };
    return null;
  };
  const lipa = getLipaNumber();
  // public_vendor_profiles exposes no payment fields, so these are often absent —
  // render nothing rather than an empty "How to Pay" header.
  if (method === 'lipa_namba' && !lipa) return null;
  if (method === 'mobile_transfer' && !seller.account_number) return null;
  return (
    <div className="mt-4 text-[11px] text-foreground/60 space-y-2">
      <p className="font-black uppercase tracking-wider text-foreground/50 text-[9px]">How to Pay</p>
      {method === 'lipa_namba' && lipa && (
        <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium bg-foreground/[0.04] p-4 rounded-xl">
          <li>Open mobile money (M-Pesa / Tigo / Airtel)</li>
          <li>Select "Pay Bills" or "Pay Merchant"</li>
          <li>Enter: <strong className="text-foreground font-mono">{lipa.num}</strong></li>
          <li>Enter the amount shown above</li>
          <li>Paste the Transaction ID below</li>
        </ol>
      )}
      {method === 'mobile_transfer' && seller.account_number && (
        <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium bg-foreground/[0.04] p-4 rounded-xl">
          <li>Open bank app or USSD</li>
          <li>Select "Bank Transfer"</li>
          <li>Bank: <strong className="text-foreground">{seller.bank_name}</strong></li>
          <li>Account: <strong className="text-foreground font-mono">{seller.account_number}</strong></li>
          <li>Name: <strong className="text-foreground">{seller.bank_account_name}</strong></li>
          <li>Paste Transaction ID below</li>
        </ol>
      )}
    </div>
  );
};
