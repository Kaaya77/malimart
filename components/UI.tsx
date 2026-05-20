
import React, { Component, ReactNode, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Slot } from '@radix-ui/react-slot';
import { useAppState } from '../context/AppContext';
import { Loader2, X, AlertTriangle, ChevronDown, Sun, Moon, ShieldCheck, Printer, Download, CheckCircle2, Package, Truck, CreditCard, Store, Sparkles, RotateCcw, Percent, MessageSquare, Share2, ShieldAlert, BadgeCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ShareButton } from './ShareButton';
import { Order, VendorProfile, Product } from '../types';
import { formatTZS } from '../constants';

// --- Error Boundary ---
interface ErrorBoundaryProps {
 children?: ReactNode;
}

interface ErrorBoundaryState {
 hasError: boolean;
 error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 public state: ErrorBoundaryState = { hasError: false, error: null };

 constructor(props: ErrorBoundaryProps) {
 super(props);
 }

 static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
 
 componentDidCatch(error: Error, errorInfo: any) { console.error(error, errorInfo); }
 
 render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen flex items-center justify-center p-6 bg-background">
 <div className="text-center max-w-md">
 <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
 <AlertTriangle className="w-8 h-8 text-red-500" />
 </div>
 <h2 className="text-2xl font-semibold mb-2 text-foreground">Something went wrong.</h2>
 <p className="text-muted-foreground text-sm mb-8">{this.state.error?.message}</p>
 <button onClick={() => window.location.reload()} className="px-8 py-4 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:scale-105 transition-transform">Reload Application</button>
 </div>
 </div>
 );
 }
 return (this as any).props.children;
 }
}

// --- Toast Context ---
const ToastContext = React.createContext<any>(null);
export const ToastProvider = ({ children }: { children?: ReactNode }) => {
 const [toasts, setToasts] = React.useState<{id: string, msg: string, type: string}[]>([]);
 const addToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
 const id = Math.random().toString(36).substring(7);
 setToasts(prev => [...prev, { id, msg, type }]);
 setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
 };
 return (
 <ToastContext.Provider value={{ addToast }}>
 {children}
 <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[250] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
 <AnimatePresence>
 {toasts.map(t => (
 <motion.div 
 key={t.id} 
 layout
 initial={{ opacity: 0, y: -20, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
 className="glass p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-3 pointer-events-auto bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/5 relative overflow-hidden group"
 >
 <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none" />
 <div className={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.1)] ${t.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/50' : t.type === 'error' ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500 shadow-blue-500/50'}`}></div>
 <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{t.msg}</p>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 </ToastContext.Provider>
 );
};
export const useToast = () => React.useContext(ToastContext);

// --- Components ---

export const Button = ({ variant = 'primary', size = 'default', className = '', asChild = false, isLoading, children, ...props }: any) => {
 const base = "relative inline-flex items-center justify-center transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none overflow-hidden group whitespace-nowrap font-bold";
 
 const variants: any = {
 primary: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
 secondary: "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]",
 brand: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
 danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
 outline: "border-2 border-foreground/20 text-foreground hover:border-foreground/40",
 ghost: "hover:bg-foreground/[0.06] text-foreground",
 link: "text-emerald-600 dark:text-emerald-400 hover:underline p-0 h-auto"
 };
 
 const sizes: any = { 
 default: "h-12 px-6 rounded-2xl text-sm", 
 sm: "h-10 px-4 rounded-xl text-xs", 
 lg: "h-14 px-8 rounded-2xl text-base", 
 xl: "h-16 px-10 rounded-3xl text-lg",
 icon: "h-12 w-12 rounded-2xl" 
 };

 const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

 if (asChild) {
 return (
 <Slot className={classes} {...props}>
 {children}
 </Slot>
 );
 }

 return (
 <motion.button 
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 className={classes} 
 disabled={isLoading || props.disabled} 
 {...props}
 >
 <span className="relative flex items-center justify-center">
 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {children}
 </span>
 </motion.button>
 );
};

export const Input = ({ className = '', ...props }: any) => (
 <div className="relative group w-full">
 <input 
 className={`flex h-14 w-full rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-foreground/30 focus:bg-background transition-all ${className}`} 
 {...props} 
 />
 </div>
);

export const Textarea = ({ className = '', ...props }: any) => (
 <textarea className={`flex min-h-[120px] w-full rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 py-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-foreground/30 focus:bg-background transition-all resize-none ${className}`} {...props} />
);

export const Label = ({ className = '', ...props }: any) => (
 <label className={`text-xs font-bold text-foreground/70 mb-2 block ${className}`} {...props} />
);

export const Card = ({ className = '', ...props }: any) => (
 <div 
 className={`rounded-3xl border border-foreground/8 bg-card text-foreground relative overflow-hidden shadow-sm ${className}`} 
 {...props}
 >
 <div className="relative z-10">{props.children}</div>
 </div>
);

export const CardHeader = ({ className = '', ...props }: any) => (
 <div className={`p-6 border-b border-foreground/8 ${className}`} {...props} />
);

export const CardContent = ({ className = '', ...props }: any) => (
 <div className={`p-6 ${className}`} {...props} />
);

export const CardTitle = ({ className = '', ...props }: any) => (
 <h3 className={`text-xl font-black tracking-tight text-slate-900 dark:text-white ${className}`} {...props} />
);

export const CardDescription = ({ className = '', ...props }: any) => (
 <p className={`text-sm font-medium text-foreground/55 mt-1 ${className}`} {...props} />
);

export const Badge = ({ variant = 'default', className = '', ...props }: any) => {
 const variants: any = {
 default: "bg-foreground/[0.08] text-foreground",
 secondary: "bg-foreground/[0.04] text-foreground/65 border border-foreground/10",
 outline: "border-2 border-foreground/20 text-foreground/70",
 success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
 danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
 };
 return <div className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-bold transition-all ${variants[variant]} ${className}`} {...props} />;
};

export const VerifiedBadge = ({ className = '' }: { className?: string }) => (
 <div className={`inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${className}`}>
 <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
 Verified
 </div>
);

export const Switch = ({ checked, onCheckedChange, className = '' }: any) => (
 <button 
 type="button" 
 role="switch" 
 aria-checked={checked} 
 onClick={() => onCheckedChange(!checked)} 
 className={`peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-foreground/20'} ${className}`}
 >
 <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
 </button>
);

export const Skeleton = ({ className = '' }: any) => (
 <div className={`relative overflow-hidden bg-foreground/[0.06] rounded-2xl ${className}`}>
 <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent" />
 </div>
);

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }: any) => {
 if (!isOpen) return null;
 return (
 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-background w-full max-w-md p-8 rounded-3xl shadow-2xl border border-foreground/8 animate-in zoom-in-95 duration-200">
 <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">{title}</h3>
 <p className="text-sm font-medium text-foreground/55 mb-8">{message}</p>
 <div className="flex justify-end gap-3">
 <Button 
 variant="secondary"
 onClick={onClose}
 className="rounded-xl font-bold px-6"
 >
 {cancelText}
 </Button>
 <Button 
 variant={isDestructive ? 'danger' : 'primary'}
 onClick={() => { onConfirm(); onClose(); }}
 className="rounded-xl font-bold px-6"
 >
 {confirmText}
 </Button>
 </div>
 </div>
 </div>
 );
};

export const SpotlightCard = ({ children, className = '', ...props }: any) => (
 <div className={`group relative overflow-hidden ${className}`} {...props}>
 {children}
 </div>
);

export const Reveal = ({ children, className = '', delay = 0 }: any) => (
 <div className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
 {children}
 </div>
);

export const Accordion = ({ title, children, defaultOpen = false }: { title: string, children?: React.ReactNode, defaultOpen?: boolean }) => {
 const [isOpen, setIsOpen] = useState(defaultOpen);
 return (
 <div className="border-b border-foreground/8 py-4">
 <button 
 onClick={() => setIsOpen(!isOpen)} 
 className="flex w-full items-center justify-between py-2 text-left hover:opacity-70 transition-opacity"
 >
 <span className="text-sm font-bold text-foreground">{title}</span>
 <ChevronDown className={`w-5 h-5 stroke-[2] text-foreground/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
 <div className="text-sm font-medium leading-relaxed text-foreground/55">
 {children}
 </div>
 </div>
 </div>
 );
};

export const ThemeToggle = () => {
 const { isDark, toggleTheme } = useAppState();

 return (
 <button 
 onClick={toggleTheme}
 className="w-12 h-12 flex items-center justify-center bg-foreground/8 rounded-2xl hover:bg-foreground/12 transition-colors text-foreground"
 >
 {isDark ? <Sun className="w-5 h-5 stroke-[2]" /> : <Moon className="w-5 h-5 stroke-[2]" />}
 </button>
 );
};

export const ImageDropzone = ({ currentImage, onImageSelected }: any) => (
 <div className="relative w-full h-full border-2 border-dashed border-foreground/15 rounded-3xl flex flex-col items-center justify-center bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-all cursor-pointer overflow-hidden group" onClick={() => document.getElementById('img-upload')?.click()}>
 {currentImage ? (
 <img src={currentImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Upload" />
 ) : (
 <div className="text-center p-6">
 <div className="w-12 h-12 bg-foreground/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4"><X className="w-5 h-5 text-slate-400 rotate-45 stroke-[2]" /></div>
 <p className="text-xs font-bold text-slate-500">Upload Photo</p>
 </div>
 )}
 <input id="img-upload" type="file" className="hidden" accept="image/*" onChange={(e) => {
 if (e.target.files?.[0]) {
 onImageSelected(e.target.files[0]);
 }
 }} />
 </div>
);

export const Modal = ({ isOpen, title, onClose, children }: any) => {
 return (
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
 >
 <motion.div
 initial={{ opacity: 0, y: 20, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 20, scale: 0.95 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="max-w-2xl w-full"
 >
 <div className="p-6 md:p-8 space-y-6 bg-background rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto">
 <div className="flex justify-between items-center border-b border-foreground/8 pb-6">
 <h3 className="text-2xl font-black tracking-tight text-foreground">{title}</h3>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 stroke-[2] text-slate-500" /></button>
 </div>
 <div className="text-slate-900 dark:text-white">
 {children}
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};

export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, isDangerous, confirmText = "Confirm", isLoading }: any) => {
 if (!isOpen) return null;
 return (
 <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
 <div className="max-w-sm w-full p-6 space-y-6 bg-background rounded-3xl shadow-2xl border border-foreground/8 animate-in zoom-in-95">
 <div className="text-center">
 <h3 className="text-2xl font-black tracking-tight mb-4 text-foreground">{title}</h3>
 <p className="text-sm font-medium text-foreground/55 leading-relaxed">{message}</p>
 </div>
 <div className="flex gap-3">
 <Button variant="secondary" onClick={onCancel} className="flex-1 rounded-xl font-bold" disabled={isLoading}>Cancel</Button>
 <Button variant={isDangerous ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1 rounded-xl font-bold" isLoading={isLoading}>{confirmText}</Button>
 </div>
 </div>
 </div>
 );
};

export const ReceiptModal = ({ isOpen, order, seller, onClose }: { isOpen: boolean, order: Order, seller?: VendorProfile, onClose: () => void }) => {
 if (!isOpen) return null;
 
 const subtotal = order.items?.reduce((acc: number, item: any) => acc + (item.price_at_purchase * item.quantity), 0) || 0;
 const deliveryFee = order.delivery_fee || 0;
 const discount = order.discount_amount || 0;
 const total = order.total;

 const handlePrint = () => {
 window.print();
 };

 const handleShare = async () => {
 if (navigator.share) {
 try {
 await navigator.share({
 title: `Mali Mart Receipt - ${order.id}`,
 text: `Receipt for order ${order.id} from ${seller?.store_name || 'Mali Mart'}`,
 url: window.location.href
 });
 } catch (err) {
 }
 } else {
 // Fallback: Copy link to clipboard
 navigator.clipboard.writeText(window.location.href);
 alert('Link copied to clipboard');
 }
 };

 return (
 <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300 print:bg-white print:p-0">
 <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto print:shadow-none print:border-none print:m-0 print:p-0 print:max-h-none">
 
 {/* Receipt Header - Print Friendly */}
 <div className="p-8 md:p-10 space-y-8" id="receipt-content">
 <div className="flex justify-between items-start">
 <div className="space-y-2">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center rounded-2xl">
 <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
 </div>
 <div>
 <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Receipt</h3>
 <p className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(0, 8)}</p>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2 print:hidden">
 <button onClick={handleShare} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-full text-slate-500" title="Share Receipt">
 <Share2 className="w-5 h-5 stroke-[2]" />
 </button>
 <button onClick={handlePrint} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-full text-slate-500" title="Print Receipt">
 <Printer className="w-5 h-5 stroke-[2]" />
 </button>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-full text-slate-500 ml-2"><X className="w-6 h-6 stroke-[2]" /></button>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl">
 <div className="space-y-2">
 <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-2">
 <Store className="w-3 h-3" /> From
 </p>
 <div>
 <p className="font-bold text-base text-slate-900 dark:text-white">{seller?.store_name || 'Mali Mart Vendor'}</p>
 <p className="text-sm font-medium text-slate-500">
 {seller?.region || 'Tanzania'}<br />
 {seller?.contact_phone || 'Verified Artisan'}
 </p>
 </div>
 </div>

 <div className="space-y-2">
 <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-2">
 <Package className="w-3 h-3" /> To
 </p>
 <div>
 <p className="font-bold text-base text-slate-900 dark:text-white">{order.buyer?.full_name || 'Valued Client'}</p>
 <p className="text-sm font-medium text-slate-500">
 {order.shipping_address?.street || 'Pick-up Order'}<br />
 {order.shipping_address?.city || 'Tanzania'}<br />
 {order.buyer?.phone}
 </p>
 </div>
 </div>
 </div>

 <div className="space-y-6">
 <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Order Details</h4>
 
 <div className="space-y-4">
 {order.items?.map((item: any, idx: number) => (
 <div key={idx} className="flex justify-between items-start group">
 <div className="space-y-1">
 <p className="font-bold text-sm text-slate-900 dark:text-white">{item.products?.name}</p>
 <p className="text-xs font-medium text-slate-500">Qty: {item.quantity} × {formatTZS(item.price_at_purchase)}</p>
 </div>
 <p className="font-black text-sm text-slate-900 dark:text-white">{formatTZS(item.price_at_purchase * item.quantity)}</p>
 </div>
 ))}
 </div>
 </div>

 <div className="pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-700 space-y-3">
 <div className="flex justify-between text-sm font-medium text-slate-500">
 <span>Subtotal</span>
 <span className="font-bold text-slate-900 dark:text-white">{formatTZS(subtotal)}</span>
 </div>
 {deliveryFee > 0 && (
 <div className="flex justify-between text-sm font-medium text-slate-500">
 <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Delivery</span>
 <span className="font-bold text-slate-900 dark:text-white">{formatTZS(deliveryFee)}</span>
 </div>
 )}
 {discount > 0 && (
 <div className="flex justify-between text-sm font-bold text-emerald-600">
 <span>Discount Applied</span>
 <span>-{formatTZS(discount)}</span>
 </div>
 )}
 <div className="flex justify-between items-end pt-4 border-t border-slate-100 dark:border-slate-800">
 <div>
 <p className="text-lg font-black text-slate-900 dark:text-white">Total</p>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid via {order.payment_method || 'M-Pesa'}</p>
 </div>
 <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{formatTZS(total)}</p>
 </div>
 </div>

 <div className="pt-8 text-center">
 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thank you for shopping with Mali Mart</p>
 </div>
 </div>

 {/* Actions */}
 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap gap-3 print:hidden rounded-b-[2rem]">
 <Button variant="secondary" onClick={onClose} className="flex-1 rounded-xl font-bold">Close</Button>
 <Button variant="primary" onClick={() => window.print()} className="flex-1 gap-2 rounded-xl font-bold">
 <Printer className="w-4 h-4" /> Print
 </Button>
 <Button 
 variant="primary" 
 onClick={async () => {
 const element = document.getElementById('receipt-content');
 if (!element) return;
 const canvas = await html2canvas(element, { scale: 2 });
 const imgData = canvas.toDataURL('image/png');
 const pdf = new jsPDF('p', 'mm', 'a4');
 const imgProps = pdf.getImageProperties(imgData);
 const pdfWidth = pdf.internal.pageSize.getWidth();
 const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
 pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
 pdf.save(`receipt-${order.id}.pdf`);
 }} 
 className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl font-bold"
 >
 <Download className="w-4 h-4" /> Save PDF
 </Button>
 </div>
 </div>
 </div>
 );
};

// --- PremiumStatCard ---
export const PremiumStatCard = ({ title, value, icon: Icon, color = "text-foreground", loading, trend }: { title: string, value: string | number, icon: any, color?: string, loading?: boolean, trend?: string | { value: string, positive?: boolean, isPositive?: boolean } }) => {
 const trendValue = typeof trend === 'string' ? trend : trend?.value;
 const isPositive = typeof trend === 'object' ? (trend.positive ?? trend.isPositive ?? true) : true;

 return (
 <Card className="p-5 md:p-6 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all overflow-hidden relative group">
 <div className="relative z-10 min-w-0 flex-1">
 <p className="text-[11px] font-bold text-foreground/45 uppercase tracking-widest mb-2 flex items-center gap-2 flex-wrap">
 {title}
 {trendValue && (
 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
 {trendValue}
 </span>
 )}
 </p>
 {loading ? (
 <Skeleton className="h-8 w-28 rounded-xl" />
 ) : (
 <p className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-none truncate">{value}</p>
 )}
 </div>
 <div className={`relative z-10 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl bg-foreground/[0.06] ${color} transition-transform group-hover:scale-110 shrink-0 ml-3`}>
 <Icon className="w-5 h-5 md:w-6 md:h-6 stroke-[2]" />
 </div>
 </Card>
 );
};

// --- GraphicalTag ---
export const GraphicalTag = ({ type, label, id, onClick }: { type: 'order' | 'return' | 'offer' | 'support' | 'system' | 'shipment' | 'security' | 'wallet' | 'promotion' | 'product', label: string, id?: string, onClick?: () => void }) => {
 const configs = {
 order: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
 return: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
 offer: { icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
 support: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 system: { icon: ShieldCheck, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' },
 shipment: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
 security: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
 wallet: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 promotion: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
 product: { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
 };

 const config = configs[type];
 const Icon = config.icon;

 return (
 <div 
 className={`inline-flex items-center gap-3 px-4 py-2 border ${config.border} ${config.bg} rounded-2xl relative overflow-hidden group transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`}
 onClick={onClick}
 >
 <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm ${config.color}`}>
 <Icon className="w-4 h-4 stroke-[2]" />
 </div>
 
 <div className="flex flex-col">
 <span className={`text-[10px] font-extrabold uppercase tracking-wider ${config.color}`}>{type}</span>
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-foreground">{label}</span>
 {id && <span className="text-[10px] font-medium opacity-50">#{id.slice(0, 6)}</span>}
 </div>
 </div>
 </div>
 );
};

// --- GraphicalIcon ---
export const GraphicalIcon = ({ type, className = "" }: { type: string, className?: string }) => {
 const configs = {
 order: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
 shipment: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
 message: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 offer: { icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
 security: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
 wallet: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 promotion: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
 return: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
 };
 const config = configs[type as keyof typeof configs] || { icon: Sparkles, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100' };
 const Icon = config.icon;
 return (
 <div className={`w-12 h-12 flex items-center justify-center rounded-2xl border ${config.border} ${config.bg} ${config.color} relative group overflow-hidden ${className}`}>
 <Icon className="w-6 h-6 stroke-[2] relative z-10 group-hover:scale-110 transition-transform duration-500" />
 </div>
 );
};

// --- UserProfileModal ---
export const UserProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
 if (!isOpen || !user) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
 <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-[2rem] relative shadow-2xl">
 <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
 <X className="w-6 h-6 stroke-[2] text-slate-500" />
 </button>

 <div className="flex flex-col items-center text-center space-y-6">
 <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-black text-3xl overflow-hidden shadow-sm">
 {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name?.slice(0, 1).toUpperCase()}
 </div>

 <div className="space-y-2">
 <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{user.name}</h3>
 <div className="flex items-center justify-center gap-2">
 <Badge variant="secondary" className="text-xs font-bold py-1 px-3 border-none bg-slate-100 dark:bg-slate-800">{user.role}</Badge>
 {user.is_verified && <Badge variant="success" className="text-xs font-bold py-1 px-3 border-none">Verified</Badge>}
 </div>
 </div>

 <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Member Since</span>
 <span className="text-slate-900 dark:text-white">{new Date(user.created_at).toLocaleDateString()}</span>
 </div>
 {user.region && (
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Region</span>
 <span className="text-slate-900 dark:text-white">{user.region}</span>
 </div>
 )}
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Trust Score</span>
 <span className="text-emerald-600">{user.trust_score || 95}%</span>
 </div>
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Total Orders</span>
 <span>{user.total_orders || 12}</span>
 </div>
 <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] opacity-60">
 <span>Response Rate</span>
 <span>{user.response_rate || '98%'}</span>
 </div>
 </div>

 <Button variant="primary" className="w-full h-12 rounded-xl text-[10px] uppercase tracking-[0.15em]" onClick={onClose}>Close Profile</Button>
 </div>
 </div>
 </div>
 );
};

// --- Progress ---
export const Progress = ({ value = 0, className = '' }: { value: number, className?: string }) => (
 <div className={`relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
 <motion.div 
 initial={{ width: 0 }}
 animate={{ width: `${value}%` }}
 transition={{ duration: 0.8, ease: "easeOut" }}
 className="h-full w-full flex-1 bg-emerald-500 transition-all rounded-full" 
 />
 </div>
);

// --- SatisfyingOrderGraphic ---
export const SatisfyingOrderGraphic = ({ status }: { status: string }) => {
 const stages = [
 { id: 'pending', icon: Package, label: 'Order Placed', color: 'bg-amber-500' },
 { id: 'processing', icon: Loader2, label: 'Artisan Preparing', color: 'bg-blue-500' },
 { id: 'shipped', icon: Truck, label: 'On Its Way', color: 'bg-indigo-500' },
 { id: 'delivered', icon: CheckCircle2, label: 'Arrived Safely', color: 'bg-emerald-500' }
 ];

 const currentIndex = stages.findIndex(s => s.id === status);
 const activeStage = stages[currentIndex] || stages[0];

 return (
 <div className="relative py-12 px-8 bg-foreground/5 rounded-3xl overflow-hidden group">
 <div className="relative z-10 flex flex-col items-center text-center space-y-8">
 <div className="relative">
 <AnimatePresence mode="wait">
 <motion.div
 key={status}
 initial={{ scale: 0.8, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 1.2, opacity: 0, y: -20 }}
 transition={{ duration: 0.4, ease: "easeOut" }}
 className={`w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center relative group-hover:scale-105 transition-transform duration-500`}
 >
 <activeStage.icon className={`w-12 h-12 text-foreground ${status === 'processing' ? 'animate-spin' : ''} stroke-[2]`} />
 </motion.div>
 </AnimatePresence>
 </div>

 <div className="space-y-4">
 <motion.h4 
 key={activeStage.label}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="text-2xl font-extrabold tracking-tight text-foreground"
 >
 {activeStage.label}
 </motion.h4>
 <div className="flex gap-2 justify-center">
 {stages.map((s, i) => (
 <div 
 key={s.id}
 className={`h-2 rounded-full transition-all duration-500 ${i <= currentIndex ? 'w-8 bg-primary' : 'w-2 bg-foreground/10'}`}
 />
 ))}
 </div>
 </div>

 <p className="text-sm font-medium opacity-60 max-w-[250px] leading-relaxed">
 {status === 'pending' && "Your request has been received by the artisan."}
 {status === 'processing' && "The artisan is carefully crafting your artifact."}
 {status === 'shipped' && "Your artifact is traveling to its new home."}
 {status === 'delivered' && "Heritage successfully delivered to your doorstep."}
 </p>
 </div>
 </div>
 );
};

// --- ModernFollowCard ---
export const ModernFollowCard = ({ vendor, onUnfollow, onViewStore }: { vendor: VendorProfile, onUnfollow: () => void, onViewStore: () => void }) => (
 <div className="group relative bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 dark:border-white/5 flex flex-col h-full">
 <div className="h-32 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
 {vendor.banner_url ? (
 <img src={vendor.banner_url} alt={vendor.store_name} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
 ) : (
 <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-indigo-500/20" />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
 <div className="absolute bottom-4 left-6 flex items-center gap-4">
 <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-lg overflow-hidden border-2 border-white">
 <img src={vendor.logo_url || `https://ui-avatars.com/api/?name=${vendor.store_name}`} className="w-full h-full object-cover rounded-xl" />
 </div>
 <div className="text-white">
 <h3 className="font-black text-lg leading-tight flex items-center gap-2">
 {vendor.store_name}
 {vendor.is_verified && <BadgeCheck className="w-4 h-4 text-blue-400" />}
 </h3>
 <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Store</p>
 </div>
 </div>
 </div>
 <div className="p-6 flex-1 flex flex-col">
 <p className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 flex-1">
 {vendor.description || "No description provided."}
 </p>
 <div className="flex gap-3 mt-auto">
 <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onUnfollow}>Unfollow</Button>
 <Button className="flex-1 rounded-xl font-bold" onClick={onViewStore}>Visit Store</Button>
 </div>
 </div>
 </div>
);
