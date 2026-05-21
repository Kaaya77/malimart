import { recordAuthAttempt, clearAuthAttempts, safeRedirect, isValidEmail, rateLimit } from '../src/security';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
 User, Mail, Lock, ArrowRight, ArrowLeft, ShoppingBag, Store, 
 Loader2, ShieldCheck, Eye, EyeOff, Sparkles, MapPin, Gem, 
 AlertTriangle, X, Star, Globe, Check
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, Input, Label, useToast, Badge } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';

const QUOTES = [
 { text: "Curating the finest artisan crafts from across the United Republic.", author: "MaliMart Vision" },
 { text: "Your gateway to authentic Tanzanian style and quality.", author: "Heritage Collection" },
 { text: "Supporting local merchants, empowering every community.", author: "Community First" }
];

export const LoginPage = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { addToast } = useToast();
 const { user } = useAppState();
 
 const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
 const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
 const [formData, setFormData] = useState({ email: '', password: '', name: '' });
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [activeQuote, setActiveQuote] = useState(0);

 const redirectPath = safeRedirect(searchParams.get('redirect'), '/');

 useEffect(() => {
 if (user && !user.is_banned) clearAuthAttempts(formData.email);
        navigate(redirectPath);
 }, [user, navigate, redirectPath]);

 useEffect(() => {
 const interval = setInterval(() => {
 setActiveQuote(prev => (prev + 1) % QUOTES.length);
 }, 6000);
 return () => clearInterval(interval);
 }, []);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 setFormData({ ...formData, [e.target.name]: e.target.value });
 setError('');
 };

 const security = useMemo(() => {
 const p = formData.password;
 return {
 strength: p.length === 0 ? 0 : p.length < 6 ? 1 : p.length < 10 ? 2 : 3
 };
 }, [formData.password]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError('');

 try {
 if (mode === 'login') {
 const { data: authData, error } = await supabase.auth.signInWithPassword({ 
 email: formData.email, 
 password: formData.password 
 });

 if (error) {
 if (error.message.includes("Invalid login credentials")) {
 throw new Error("Incorrect email or password.");
 }
 throw error;
 }

 if (authData.user) {
 // Check if user is banned
 const { data: profile } = await supabase
 .from('profiles')
 .select('is_banned')
 .eq('id', authData.user.id)
 .single();

 if (profile?.is_banned) {
 await supabase.auth.signOut();
 throw new Error("Your account has been banned. Please contact support if you believe this is an error.");
 }
 }

 addToast("Welcome back to MaliMart", 'success');
 navigate(redirectPath);
 } else if (mode === 'signup') {
 if (!formData.name.trim()) throw new Error("Name is required.");
 if (security.strength < 2) throw new Error("Please use a stronger password.");
 
 const { data, error } = await supabase.auth.signUp({
 email: formData.email,
 password: formData.password,
 options: { data: { role, full_name: formData.name } }
 });

 if (error) throw error;
 addToast("Account created! Verify your email to continue.", 'success');
 setMode('login');
 } else if (mode === 'forgot') {
 if (!formData.email) throw new Error("Email is required.");
 const { error } = await supabase.auth.resetPasswordForEmail(formData.email);
 if (error) throw error;
 addToast("Password reset email sent.", "success");
 setMode('login');
 }
 } catch (err: any) {
 setError(err.message || "An unexpected error occurred.");
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen w-full flex font-sans bg-background overflow-hidden relative">
 
 {/* LEFT PANEL: VISUAL & BRANDING */}
 <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 bg-slate-900 text-white overflow-hidden">
 {/* Dynamic Background Image */}
 <div className="absolute inset-0 z-0">
 <img 
 src="https://images.unsplash.com/photo-1606744888344-493238951221?q=80&w=2069&auto=format&fit=crop" 
 className="w-full h-full object-cover opacity-60 mix-blend-overlay"
 alt="Background" loading="lazy" decoding="async"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
 </div>

 {/* Logo Area */}
 <div className="relative z-10 flex items-center gap-3">
 <div className="w-12 h-12 bg-background text-black rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">M</div>
 <span className="font-black text-2xl tracking-tight font-display">MaliMart.</span>
 </div>

 {/* Quote Carousel */}
 <div className="relative z-10 max-w-lg mb-20">
 <div className="h-40 relative">
 {QUOTES.map((q, i) => (
 <div 
 key={i} 
 className={`absolute inset-0 transition-all duration-1000 ease-in-out transform ${i === activeQuote ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
 >
 <p className="text-4xl font-display font-medium leading-tight mb-6">"{q.text}"</p>
 <div className="flex items-center gap-3">
 <div className="h-0.5 w-8 bg-brand-500"></div>
 <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">{q.author}</span>
 </div>
 </div>
 ))}
 </div>
 {/* Dots */}
 <div className="flex gap-2 mt-8">
 {QUOTES.map((_, i) => (
 <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === activeQuote ? 'w-8 bg-brand-500' : 'w-2 bg-background/20'}`}></div>
 ))}
 </div>
 </div>

 {/* Footer Info */}
 <div className="relative z-10 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-foreground/55">
 <span className="flex items-center gap-2"><Globe className="w-4 h-4"/> Tanzania's Marketplace</span>
 <span>© {new Date().getFullYear()}</span>
 </div>
 </div>

 {/* RIGHT PANEL: INTERACTION */}
 <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10 bg-background">
 <div className="w-full max-w-[440px] animate-in slide-in-from-right-8 duration-700">
 
 {/* Mobile Header */}
 <div className="flex lg:hidden justify-between items-center mb-10">
 <Link to="/" className="flex items-center gap-2">
 <div className="w-10 h-10 bg-black dark:bg-background text-white dark:text-black rounded-xl flex items-center justify-center font-black text-lg">M</div>
 <span className="font-black text-xl tracking-tight text-foreground">MaliMart.</span>
 </Link>
 <Link to="/" className="p-2 bg-foreground/[0.05] rounded-full"><X className="w-5 h-5"/></Link>
 </div>

 <div className="mb-10">
 <h2 className="text-5xl md:text-6xl font-black font-display text-foreground mb-4 tracking-tight leading-[0.9]">
 {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join the Hub' : 'Recovery'}
 </h2>
 <p className="text-foreground/55 text-base font-medium">
 {mode === 'login' ? 'Enter your credentials to access your account.' : mode === 'signup' ? 'Create an account to start trading.' : 'We will send you a link to reset your password.'}
 </p>
 </div>

 {error && (
 <div className="mb-8 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-start gap-3 text-red-600 dark:text-red-400">
 <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
 <p className="text-sm font-bold leading-relaxed">{error}</p>
 </div>
 )}

 <motion.form 
 key={mode}
 initial="hidden"
 animate="visible"
 variants={{
 hidden: { opacity: 0 },
 visible: {
 opacity: 1,
 transition: { staggerChildren: 0.1 }
 }
 }}
 onSubmit={handleSubmit} 
 className="space-y-6"
 >
 {mode === 'signup' && (
 <motion.div 
 variants={{
 hidden: { opacity: 0, x: -20 },
 visible: { opacity: 1, x: 0 }
 }}
 className="grid grid-cols-2 gap-3 p-1.5 bg-foreground/[0.05] rounded-2xl"
 >
 <button type="button" onClick={() => setRole('buyer')} className={`py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${role === 'buyer' ? 'bg-card text-foreground shadow-md' : 'text-foreground/40 hover:text-foreground/65'}`}>
 <ShoppingBag className="w-4 h-4"/> Buyer
 </button>
 <button type="button" onClick={() => setRole('seller')} className={`py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${role === 'seller' ? 'bg-card text-foreground shadow-md' : 'text-foreground/40 hover:text-foreground/65'}`}>
 <Store className="w-4 h-4"/> Seller
 </button>
 </motion.div>
 )}

 {mode === 'signup' && (
 <motion.div 
 variants={{
 hidden: { opacity: 0, x: -20 },
 visible: { opacity: 1, x: 0 }
 }}
 className="space-y-2"
 >
 <Label>Full Name</Label>
 <div className="relative group">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
 <Input 
 name="name" 
 placeholder="e.g. Juma Hamisi" 
 value={formData.name} 
 onChange={handleInputChange} 
 className="pl-12 h-16 bg-foreground/[0.04] border-transparent focus:border-foreground/20 focus:bg-foreground/[0.06] font-bold text-lg"
 />
 </div>
 </motion.div>
 )}

 <motion.div 
 variants={{
 hidden: { opacity: 0, x: -20 },
 visible: { opacity: 1, x: 0 }
 }}
 className="space-y-2"
 >
 <Label>Email Address</Label>
 <div className="relative group">
 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
 <Input 
 name="email" 
 type="email" 
 placeholder="name@example.com" 
 value={formData.email} 
 onChange={handleInputChange} 
 className="pl-12 h-16 bg-foreground/[0.04] border-transparent focus:border-foreground/20 focus:bg-foreground/[0.06] font-bold text-lg"
 />
 </div>
 </motion.div>

 {mode !== 'forgot' && (
 <motion.div 
 variants={{
 hidden: { opacity: 0, x: -20 },
 visible: { opacity: 1, x: 0 }
 }}
 className="space-y-2"
 >
 <div className="flex justify-between items-center">
 <Label>Password</Label>
 {mode === 'login' && <button type="button" onClick={() => setMode('forgot')} className="text-[10px] font-bold uppercase tracking-widest text-brand-600 hover:text-brand-700">Forgot?</button>}
 </div>
 <div className="relative group">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
 <Input 
 name="password" 
 type={showPassword ? "text" : "password"} 
 placeholder="••••••••" 
 value={formData.password} 
 onChange={handleInputChange} 
 className="pl-12 pr-12 h-16 bg-foreground/[0.04] border-transparent focus:border-foreground/20 focus:bg-foreground/[0.06] font-bold text-lg"
 />
 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/65">
 {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
 </button>
 </div>
 {mode === 'signup' && formData.password && (
 <div className="flex gap-1 pt-1">
 {[1, 2, 3].map(i => (
 <div key={i} className={`h-1 rounded-full flex-1 transition-colors ${i <= security.strength ? (security.strength === 1 ? 'bg-red-500' : security.strength === 2 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-foreground/8'}`}></div>
 ))}
 </div>
 )}
 </motion.div>
 )}

 <motion.div
 variants={{
 hidden: { opacity: 0, y: 20 },
 visible: { opacity: 1, y: 0 }
 }}
 >
 <Button 
 variant="brand" 
 className="w-full h-16 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
 isLoading={loading}
 >
 {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Link'}
 </Button>
 </motion.div>
 </motion.form>

 <div className="mt-10 pt-10 border-t border-foreground/8 text-center">
 {mode === 'forgot' ? (
 <button onClick={() => setMode('login')} className="flex items-center justify-center gap-2 text-foreground/55 hover:text-foreground dark:hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
 <ArrowLeft className="w-4 h-4"/> Back to Login
 </button>
 ) : (
 <p className="text-foreground/55 text-sm font-medium">
 {mode === 'login' ? "New to MaliMart? " : "Already have an account? "}
 <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }} className="text-brand-600 font-bold hover:underline">
 {mode === 'login' ? 'Create Account' : 'Login'}
 </button>
 </p>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};
