import { recordAuthAttempt, clearAuthAttempts, safeRedirect, isValidEmail, rateLimit } from '../src/security';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import {
 User, Mail, Lock, ArrowRight, ArrowLeft, ShoppingBag, Store,
 Loader2, Eye, EyeOff, X, Globe, Sparkles, Zap
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, Input, Label, useToast } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';
import { MaliAnimalAvatar, AnimalPicker, useAnimalAvatar, ANIMALS, type EmoteType } from '../components/MaliAnimalAvatar';

// ── Fun rotating content ───────────────────────────────────────────────────────
const FUN_GREETINGS = [
  { text: 'Karibu! 🎉', sub: 'Tanzania\'s most fun marketplace' },
  { text: 'Habari yako? 🌟', sub: 'Ready to shop or sell today?' },
  { text: 'Shida si kitu! 🛍️', sub: 'Your perfect market awaits' },
  { text: 'Poa kabisa! 🔥', sub: 'The best deals in the republic' },
  { text: 'Twende! 🚀', sub: 'Your next favourite thing is here' },
];

const FLOATING_EMOJIS = ['🛍️','🎁','👗','👟','💎','🍎','📱','🌸','⭐','🎨','🏺','🌿','🎶','💄','🧴','🍊','🎀','💍'];

// ── Confetti particle ─────────────────────────────────────────────────────────
const Confetti = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            backgroundColor: ['#10b981','#f59e0b','#ec4899','#6366f1','#ef4444','#06b6d4'][i % 6],
            rotate: Math.random() * 360,
          }}
          animate={{
            y: ['0vh', '110vh'],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, Math.random() * 720 - 360],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 1.5,
            delay: Math.random() * 0.8,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
};

// ── Floating emoji particles ──────────────────────────────────────────────────
const FloatingParticle = ({ emoji, delay, x, duration }: { emoji: string; delay: number; x: number; duration: number }) => (
  <motion.div
    className="absolute text-2xl select-none pointer-events-none opacity-0"
    style={{ left: `${x}%`, bottom: '-40px' }}
    animate={{
      y: [0, -window.innerHeight - 80],
      opacity: [0, 0.7, 0.5, 0],
      rotate: [0, (Math.random() - 0.5) * 40],
      scale: [0.6, 1, 0.8],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      repeatDelay: Math.random() * 8 + 4,
      ease: 'linear',
    }}
  >
    {emoji}
  </motion.div>
);

// ── Mouse-following glow ──────────────────────────────────────────────────────
const MouseGlow = () => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, { stiffness: 60, damping: 20 });
  const smoothY = useSpring(y, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [x, y]);

  return (
    <motion.div
      className="fixed pointer-events-none z-0 w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        x: smoothX, y: smoothY,
        background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
      }}
    />
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const LoginPage = () => {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { addToast } = useToast();
 const { user } = useAppState();
 const { animal, setAnimal, animalInfo } = useAnimalAvatar();

 const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(() => {
   const m = searchParams.get('mode');
   return m === 'signup' || m === 'forgot' ? m : 'login';
 });
 const [role, setRole] = useState<'buyer' | 'seller'>(() => {
   return searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
 });
 const [formData, setFormData] = useState({ email: '', password: '', name: '' });
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [greeting, setGreeting] = useState(0);
 const [showConfetti, setShowConfetti] = useState(false);
 const [avatarEmote, setAvatarEmote] = useState<EmoteType>('waving');
 const [showAnimalPicker, setShowAnimalPicker] = useState(false);
 const [logoClicks, setLogoClicks] = useState(0);
 const [easterEgg, setEasterEgg] = useState(false);

 const redirectPath = safeRedirect(searchParams.get('redirect'), '/');

 useEffect(() => {
   if (user && !user.is_banned) {
     clearAuthAttempts(formData.email);
     navigate(redirectPath);
   }
 }, [user, navigate, redirectPath]);

 // Rotate greetings
 useEffect(() => {
   const id = setInterval(() => setGreeting(p => (p + 1) % FUN_GREETINGS.length), 4000);
   return () => clearInterval(id);
 }, []);

 // Initial waving, then settle to idle
 useEffect(() => {
   const t = setTimeout(() => setAvatarEmote('idle'), 2500);
   return () => clearTimeout(t);
 }, []);

 // React to mode change
 useEffect(() => {
   setAvatarEmote('excited');
   const t = setTimeout(() => setAvatarEmote('idle'), 1500);
   return () => clearTimeout(t);
 }, [mode]);

 // React to errors
 useEffect(() => {
   if (error) {
     setAvatarEmote('sad');
     const t = setTimeout(() => setAvatarEmote('idle'), 2500);
     return () => clearTimeout(t);
   }
 }, [error]);

 // Easter egg: click logo 5 times
 const handleLogoClick = () => {
   const next = logoClicks + 1;
   setLogoClicks(next);
   if (next >= 5) {
     setEasterEgg(true);
     setAvatarEmote('dancing');
     setShowConfetti(true);
     setLogoClicks(0);
     setTimeout(() => { setShowConfetti(false); setEasterEgg(false); setAvatarEmote('idle'); }, 3000);
   }
 };

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
   setFormData({ ...formData, [e.target.name]: e.target.value });
   setError('');
   if (avatarEmote === 'idle') setAvatarEmote('thinking');
   clearTimeout((handleInputChange as any)._t);
   (handleInputChange as any)._t = setTimeout(() => setAvatarEmote('idle'), 1200);
 };

 const security = useMemo(() => {
   const p = formData.password;
   if (!p) return { strength: 0, hints: [] };
   const checks = {
     long: p.length >= 8,
     upper: /[A-Z]/.test(p),
     number: /[0-9]/.test(p),
     symbol: /[^A-Za-z0-9]/.test(p),
   };
   const passed = Object.values(checks).filter(Boolean).length;
   const hints = [
     !checks.long && '8+ characters',
     !checks.upper && 'uppercase letter',
     !checks.number && 'a number',
     !checks.symbol && 'a symbol',
   ].filter(Boolean) as string[];
   return { strength: passed, hints };
 }, [formData.password]);

 // React to password strength
 useEffect(() => {
   if (security.strength === 4) {
     setAvatarEmote('love');
     const t = setTimeout(() => setAvatarEmote('idle'), 1500);
     return () => clearTimeout(t);
   }
 }, [security.strength]);

 const handleSubmit = async (e: React.FormEvent) => {
   e.preventDefault();
   setLoading(true);
   setError('');
   setAvatarEmote('thinking');

   try {
     if (mode === 'login') {
       const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
         Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

       const { data: authData, error } = await withTimeout(
         supabase.auth.signInWithPassword({ email: formData.email, password: formData.password }),
         12_000,
         'Login timed out — check your connection and try again.'
       );

       if (error) {
         if (error.message.includes("Invalid login credentials")) {
           throw new Error("Incorrect email or password.");
         }
         throw error;
       }

       if (authData.user) {
         const { data: profile } = await withTimeout(
           Promise.resolve(supabase.from('profiles').select('is_banned').eq('id', authData.user.id).single()),
           8_000,
           'Login timed out — check your connection and try again.'
         );
         if (profile?.is_banned) {
           await supabase.auth.signOut();
           throw new Error("Your account has been banned. Please contact support.");
         }
       }

       setAvatarEmote('excited');
       addToast("Welcome back to MaliMart! 🎉", 'success');
     } else if (mode === 'signup') {
       if (!formData.name.trim()) throw new Error("Name is required.");
       if (security.strength < 2) throw new Error("Please use a stronger password.");

       const { data, error } = await supabase.auth.signUp({
         email: formData.email,
         password: formData.password,
         options: { data: { role, full_name: formData.name } }
       });

       if (error) throw error;
       setAvatarEmote('dancing');
       setShowConfetti(true);
       setTimeout(() => { setShowConfetti(false); }, 3000);
       addToast("Account created! Check your email to verify. 🎊", 'success');
       setMode('login');
     } else if (mode === 'forgot') {
       if (!formData.email) throw new Error("Email is required.");
       const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
         redirectTo: `${window.location.origin}/auth/reset`
       });
       if (error) throw error;
       setAvatarEmote('happy');
       addToast("Password reset email sent! 📬", "success");
       setMode('login');
     }
   } catch (err: any) {
     setError(err.message || "An unexpected error occurred.");
   } finally {
     setLoading(false);
   }
 };

 // Random floating emojis (stable positions)
 const particles = useMemo(() =>
   FLOATING_EMOJIS.map((emoji, i) => ({
     emoji,
     x: (i * 5.5 + 3) % 95,
     delay: i * 0.7,
     duration: 8 + (i % 5) * 2,
   })), []
 );

 return (
   <div className="min-h-screen w-full flex font-sans bg-background overflow-hidden relative">
     <MouseGlow />
     <Confetti active={showConfetti} />

     {/* ── LEFT PANEL ── */}
     <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden"
       style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>

       {/* Floating particles */}
       <div className="absolute inset-0 overflow-hidden pointer-events-none">
         {particles.map((p, i) => (
           <FloatingParticle key={i} {...p} />
         ))}
       </div>

       {/* Animated gradient orbs */}
       <div className="absolute inset-0 pointer-events-none">
         <motion.div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl"
           animate={{ scale: [1, 1.3, 1], x: [0, 30, 0], y: [0, -20, 0] }}
           transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
         <motion.div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-violet-500/10 blur-3xl"
           animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], y: [0, 30, 0] }}
           transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }} />
         <motion.div className="absolute top-1/2 right-1/3 w-40 h-40 rounded-full bg-pink-500/8 blur-2xl"
           animate={{ scale: [1, 1.4, 1] }}
           transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />
       </div>

       {/* Logo */}
       <div className="relative z-10 flex items-center gap-3 cursor-pointer" onClick={handleLogoClick}>
         <motion.div
           whileHover={{ rotate: 10, scale: 1.1 }}
           whileTap={{ scale: 0.9 }}
           className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-2xl text-slate-900 shadow-xl"
         >
           {easterEgg ? '🎊' : 'M'}
         </motion.div>
         <span className="font-black text-2xl tracking-tight text-white">MaliMart.</span>
         {logoClicks > 0 && logoClicks < 5 && (
           <motion.span
             key={logoClicks}
             initial={{ opacity: 1, y: 0, scale: 1 }}
             animate={{ opacity: 0, y: -20, scale: 0.7 }}
             transition={{ duration: 0.8 }}
             className="absolute -top-4 left-0 text-xs text-white/60 font-bold"
           >
             {5 - logoClicks} more...
           </motion.span>
         )}
       </div>

       {/* Center content: animal + rotating greeting */}
       <div className="relative z-10 flex flex-col items-center gap-8">
         {/* Big animal avatar with animation */}
         <motion.div
           className="relative"
           animate={{ y: [0, -10, 0] }}
           transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
         >
           <MaliAnimalAvatar size={120} rings emote={avatarEmote} showEmoteLabel pulse />
           {/* Glow ring */}
           <div className="absolute inset-0 -m-4 rounded-full blur-xl opacity-40"
             style={{ background: `radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)` }} />
         </motion.div>

         {/* Rotating greetings */}
         <div className="text-center h-28 relative w-full max-w-sm">
           <AnimatePresence mode="wait">
             <motion.div
               key={greeting}
               initial={{ opacity: 0, y: 20, scale: 0.9 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -20, scale: 0.9 }}
               transition={{ duration: 0.5, ease: 'backOut' }}
               className="absolute inset-0 flex flex-col items-center justify-center gap-2"
             >
               <p className="text-4xl font-black text-white tracking-tight">{FUN_GREETINGS[greeting].text}</p>
               <p className="text-white/50 text-base font-medium">{FUN_GREETINGS[greeting].sub}</p>
             </motion.div>
           </AnimatePresence>
         </div>

         {/* Animal picker */}
         <div className="relative">
           <motion.button
             whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
             onClick={() => setShowAnimalPicker(v => !v)}
             className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-xs font-bold transition-all border border-white/10"
           >
             <span>{animalInfo.emoji}</span>
             Change companion
             <Sparkles className="w-3 h-3" />
           </motion.button>
           <AnimatePresence>
             {showAnimalPicker && (
               <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-50">
                 <AnimalPicker onClose={() => setShowAnimalPicker(false)} />
               </div>
             )}
           </AnimatePresence>
         </div>
       </div>

       {/* Footer */}
       <div className="relative z-10 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/30">
         <span className="flex items-center gap-2"><Globe className="w-4 h-4"/> Tanzania's Marketplace</span>
         <span>© {new Date().getFullYear()}</span>
       </div>
     </div>

     {/* ── RIGHT PANEL ── */}
     <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10 bg-background">
       <div className="w-full max-w-[440px] animate-in slide-in-from-right-8 duration-700">

         {/* Mobile header */}
         <div className="flex lg:hidden justify-between items-center mb-8">
           <Link to="/" className="flex items-center gap-2">
             <motion.div whileHover={{ rotate: 10 }} onClick={handleLogoClick}
               className="w-10 h-10 bg-foreground text-background rounded-xl flex items-center justify-center font-black text-lg">
               {easterEgg ? '🎊' : 'M'}
             </motion.div>
             <span className="font-black text-xl tracking-tight text-foreground">MaliMart.</span>
           </Link>
           <div className="flex items-center gap-2">
             {/* Mobile animal avatar */}
             <motion.button
               whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
               onClick={() => setShowAnimalPicker(v => !v)}
               className="relative"
             >
               <MaliAnimalAvatar size={36} emote={avatarEmote} />
             </motion.button>
             <Link to="/" className="p-2 bg-foreground/[0.05] rounded-full"><X className="w-5 h-5"/></Link>
           </div>
           <AnimatePresence>
             {showAnimalPicker && (
               <div className="absolute top-20 right-6 z-50">
                 <AnimalPicker onClose={() => setShowAnimalPicker(false)} />
               </div>
             )}
           </AnimatePresence>
         </div>

         {/* Heading */}
         <div className="mb-8">
           <AnimatePresence mode="wait">
             <motion.h2
               key={mode}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="text-5xl md:text-6xl font-black font-display text-foreground mb-3 tracking-tight leading-[0.9]"
             >
               {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join the Hub' : 'Recovery'}
             </motion.h2>
           </AnimatePresence>
           <p className="text-foreground/55 text-base font-medium">
             {mode === 'login' ? 'Enter your credentials to continue.' :
              mode === 'signup' ? 'Create your account and start trading.' :
              'We\'ll send you a password reset link.'}
           </p>
         </div>

         {/* Error */}
         <AnimatePresence>
           {error && (
             <motion.div
               initial={{ opacity: 0, y: -8, scale: 0.97 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -8, scale: 0.97 }}
               className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-start gap-3 text-red-600 dark:text-red-400"
             >
               <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.4 }} className="text-xl">😬</motion.span>
               <p className="text-sm font-bold leading-relaxed">{error}</p>
             </motion.div>
           )}
         </AnimatePresence>

         {/* Form */}
         <motion.form
           key={mode}
           initial="hidden"
           animate="visible"
           variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
           onSubmit={handleSubmit}
           className="space-y-5"
         >
           {/* Role selector (signup) */}
           {mode === 'signup' && (
             <motion.div variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
               className="grid grid-cols-2 gap-3 p-1.5 bg-foreground/[0.05] rounded-2xl">
               {(['buyer', 'seller'] as const).map(r => (
                 <motion.button
                   key={r}
                   type="button"
                   whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                   onClick={() => setRole(r)}
                   className={`py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                     role === r ? 'bg-card text-foreground shadow-md' : 'text-foreground/40 hover:text-foreground/65'
                   }`}
                 >
                   {r === 'buyer' ? <ShoppingBag className="w-4 h-4"/> : <Store className="w-4 h-4"/>}
                   {r}
                 </motion.button>
               ))}
             </motion.div>
           )}

           {/* Name (signup) */}
           {mode === 'signup' && (
             <motion.div variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
               <Label>Full Name</Label>
               <div className="relative group">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
                 <Input
                   name="name"
                   placeholder="e.g. Juma Hamisi"
                   value={formData.name}
                   onChange={handleInputChange}
                   className="pl-12 h-14 bg-foreground/[0.06] border border-foreground/[0.12] focus:border-brand-500/40 focus:bg-foreground/[0.09] font-bold text-base"
                 />
               </div>
             </motion.div>
           )}

           {/* Email */}
           <motion.div variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
             <Label htmlFor="auth-email">Email Address</Label>
             <div className="relative group">
               <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
               <Input
                 id="auth-email"
                 name="email"
                 type="email"
                 placeholder="name@example.com"
                 value={formData.email}
                 onChange={handleInputChange}
                 className="pl-12 h-14 bg-foreground/[0.06] border border-foreground/[0.12] focus:border-brand-500/40 focus:bg-foreground/[0.09] font-bold text-base"
               />
             </div>
           </motion.div>

           {/* Password */}
           {mode !== 'forgot' && (
             <motion.div variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }} className="space-y-2">
               <div className="flex justify-between items-center">
                 <Label htmlFor="auth-password">Password</Label>
                 {mode === 'login' && (
                   <button type="button" onClick={() => setMode('forgot')}
                     className="text-[10px] font-bold uppercase tracking-widest text-brand-600 hover:text-brand-700">
                     Forgot?
                   </button>
                 )}
               </div>
               <div className="relative group">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-brand-500 transition-colors"/>
                 <Input
                   id="auth-password"
                   name="password"
                   type={showPassword ? 'text' : 'password'}
                   placeholder="••••••••"
                   value={formData.password}
                   onChange={handleInputChange}
                   className="pl-12 pr-12 h-14 bg-foreground/[0.06] border border-foreground/[0.12] focus:border-brand-500/40 focus:bg-foreground/[0.09] font-bold text-base"
                 />
                 <button type="button" onClick={() => setShowPassword(!showPassword)}
                   aria-label={showPassword ? 'Hide password' : 'Show password'}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/65 transition-colors">
                   {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                 </button>
               </div>
               {/* Password strength */}
               {mode === 'signup' && formData.password && (
                 <div className="space-y-1.5 pt-1">
                   <div className="flex gap-1">
                     {[1, 2, 3, 4].map(i => (
                       <motion.div
                         key={i}
                         className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                           i <= security.strength
                             ? security.strength <= 1 ? 'bg-red-500'
                             : security.strength === 2 ? 'bg-amber-500'
                             : security.strength === 3 ? 'bg-emerald-400'
                             : 'bg-emerald-500'
                             : 'bg-foreground/8'
                         }`}
                         animate={i <= security.strength ? { scaleX: [0.5, 1] } : {}}
                         transition={{ duration: 0.3 }}
                       />
                     ))}
                   </div>
                   {security.hints.length > 0 && (
                     <p className="text-[11px] text-foreground/45">Add: {security.hints.join(', ')}</p>
                   )}
                   {security.strength === 4 && (
                     <motion.p
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       className="text-[11px] text-emerald-600 font-bold"
                     >
                       🔒 Strong password! {animalInfo.emoji} approves
                     </motion.p>
                   )}
                 </div>
               )}
             </motion.div>
           )}

           {/* Submit */}
           <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
             <Button
               type="submit"
               variant="brand"
               className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
               isLoading={loading}
             >
               {!loading && (
                 <span className="flex items-center gap-2">
                   {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Link'}
                   <Zap className="w-4 h-4" />
                 </span>
               )}
             </Button>
           </motion.div>
         </motion.form>

         {/* Footer links */}
         <div className="mt-8 pt-8 border-t border-foreground/8 text-center">
           {mode === 'forgot' ? (
             <button onClick={() => setMode('login')}
               className="flex items-center justify-center gap-2 text-foreground/55 hover:text-foreground transition-colors text-xs font-bold uppercase tracking-widest">
               <ArrowLeft className="w-4 h-4"/> Back to Login
             </button>
           ) : (
             <p className="text-foreground/55 text-sm font-medium">
               {mode === 'login' ? 'New to MaliMart? ' : 'Already have an account? '}
               <button
                 onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                 className="text-brand-600 font-bold hover:underline"
               >
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
