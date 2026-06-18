import { clearAuthAttempts, safeRedirect } from '../src/security';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Lock, ArrowRight, ArrowLeft, ShoppingBag, Store,
  Eye, EyeOff, Check, ShieldCheck, Zap, TrendingUp, Globe2,
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';

// ── Left-panel rotating value props ─────────────────────────────────────────────
const HIGHLIGHTS = [
  {
    icon: Store,
    title: 'Sell to all of Tanzania',
    body: 'List your products in minutes and reach buyers from Dar to Mwanza.',
  },
  {
    icon: TrendingUp,
    title: 'Grow with real insights',
    body: 'Live inventory, sales analytics and AI restock alerts in one dashboard.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    body: 'Protected payments, verified vendors and buyer guarantees on every order.',
  },
];

const STATS = [
  { value: '12K+', label: 'Active sellers' },
  { value: '480K', label: 'Products listed' },
  { value: '99.9%', label: 'Uptime' },
];

// ── Subtle animated background mesh (no theatrics) ──────────────────────────────
const Mesh = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* grid */}
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)',
      }}
    />
    <motion.div
      className="absolute -top-1/4 left-1/4 w-[36rem] h-[36rem] rounded-full bg-emerald-500/20 blur-[120px]"
      animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-0 right-0 w-[30rem] h-[30rem] rounded-full bg-teal-400/10 blur-[120px]"
      animate={{ x: [0, -30, 0], y: [0, 20, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
    />
  </div>
);

// ── Main component ──────────────────────────────────────────────────────────────
export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const { user } = useAppState();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(() => {
    const m = searchParams.get('mode');
    return m === 'signup' || m === 'forgot' ? m : 'login';
  });
  const [role, setRole] = useState<'buyer' | 'seller'>(() =>
    searchParams.get('role') === 'seller' ? 'seller' : 'buyer'
  );
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const redirectPath = safeRedirect(searchParams.get('redirect'), '/');

  useEffect(() => {
    if (user && !user.is_banned) {
      clearAuthAttempts(formData.email);
      navigate(redirectPath);
    }
  }, [user, navigate, redirectPath]);

  // Rotate left-panel highlights
  useEffect(() => {
    const id = setInterval(() => setHighlight(p => (p + 1) % HIGHLIGHTS.length), 5000);
    return () => clearInterval(id);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const security = useMemo(() => {
    const p = formData.password;
    if (!p) return { strength: 0, hints: [] as string[] };
    const checks = {
      long: p.length >= 8,
      upper: /[A-Z]/.test(p),
      number: /[0-9]/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    const hints = [
      !checks.long && '8+ characters',
      !checks.upper && 'an uppercase letter',
      !checks.number && 'a number',
      !checks.symbol && 'a symbol',
    ].filter(Boolean) as string[];
    return { strength: passed, hints };
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

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
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Incorrect email or password.');
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
            throw new Error('Your account has been banned. Please contact support.');
          }
        }

        addToast('Welcome back to MaliMart', 'success');
      } else if (mode === 'signup') {
        if (!formData.name.trim()) throw new Error('Name is required.');
        if (security.strength < 2) throw new Error('Please use a stronger password.');

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { role, full_name: formData.name } },
        });

        if (error) throw error;
        addToast('Account created — check your email to verify.', 'success');
        setMode('login');
      } else if (mode === 'forgot') {
        if (!formData.email) throw new Error('Email is required.');
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        addToast('Password reset link sent to your inbox.', 'success');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const HL = HIGHLIGHTS[highlight];

  const title =
    mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password';
  const subtitle =
    mode === 'login'
      ? 'Sign in to continue to your marketplace.'
      : mode === 'signup'
      ? 'Start buying and selling in minutes.'
      : 'We’ll email you a secure reset link.';

  const inputBase =
    'peer w-full h-[52px] sm:h-12 rounded-xl border border-foreground/15 bg-foreground/[0.02] pl-11 pr-4 text-base sm:text-sm font-medium text-foreground placeholder:text-foreground/35 outline-none transition-all focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/10 focus:bg-background';

  return (
    <div className="min-h-screen w-full flex font-sans bg-background">
      {/* ── LEFT BRAND PANEL ── */}
      <div className="hidden lg:flex w-[46%] xl:w-[44%] relative flex-col justify-between p-12 xl:p-16 text-white overflow-hidden bg-slate-950">
        <Mesh />

        {/* Logo */}
        <Link to="/" className="relative z-10 flex items-center gap-2.5 w-fit">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/30">
            M
          </div>
          <span className="font-bold text-lg tracking-tight">MaliMart</span>
        </Link>

        {/* Center: rotating highlight */}
        <div className="relative z-10 max-w-md">
          <div className="flex gap-1.5 mb-8">
            {HIGHLIGHTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setHighlight(i)}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i === highlight ? 'w-8 bg-emerald-400' : 'w-4 bg-white/15 hover:bg-white/30'
                }`}
                aria-label={`Highlight ${i + 1}`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={highlight}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center mb-6">
                <HL.icon className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-3xl xl:text-4xl font-bold tracking-tight leading-[1.1] mb-4">
                {HL.title}
              </h2>
              <p className="text-white/55 text-base leading-relaxed">{HL.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 flex items-center gap-8">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 py-8 relative"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        {/* Mobile hero — gives small screens brand context the side panel can't */}
        <div className="lg:hidden w-full max-w-[400px] mb-8">
          <Link to="/" className="flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/25">
              M
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">MaliMart</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/45">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Secure</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-emerald-500" /> 12K+ sellers</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5 text-emerald-500" /> Tanzania</span>
          </div>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mb-8"
            >
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">{title}</h1>
              <p className="text-foreground/50 text-[15px]">{subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} method="post" className="space-y-4">
            {/* Role selector (signup) */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-2 p-1 bg-foreground/[0.04] rounded-xl border border-foreground/8">
                {(['buyer', 'seller'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`relative h-11 rounded-lg text-sm font-semibold capitalize transition-all flex items-center justify-center gap-2 ${
                      role === r
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-foreground/45 hover:text-foreground/70'
                    }`}
                  >
                    {r === 'buyer' ? <ShoppingBag className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                    {r === 'buyer' ? 'I’m buying' : 'I’m selling'}
                  </button>
                ))}
              </div>
            )}

            {/* Name (signup) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-[13px] font-semibold text-foreground/70 mb-1.5">
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-foreground/35 peer-focus:text-emerald-500" />
                  <input
                    id="auth-name"
                    name="name"
                    placeholder="Juma Hamisi"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={inputBase}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="auth-email" className="block text-[13px] font-semibold text-foreground/70 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-foreground/35 peer-focus:text-emerald-500" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={inputBase}
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-password" className="block text-[13px] font-semibold text-foreground/70">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[13px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-foreground/35 peer-focus:text-emerald-500" />
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`${inputBase} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/35 hover:text-foreground/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>

                {/* Password strength (signup) */}
                {mode === 'signup' && formData.password && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                            i <= security.strength
                              ? security.strength <= 1
                                ? 'bg-red-500'
                                : security.strength === 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                              : 'bg-foreground/10'
                          }`}
                        />
                      ))}
                    </div>
                    {security.hints.length > 0 ? (
                      <p className="text-xs text-foreground/45">Add {security.hints.join(', ')}</p>
                    ) : (
                      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Strong password
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.99 }}
              className="w-full h-[52px] sm:h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base sm:text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <div className="mt-7 text-center">
            {mode === 'forgot' ? (
              <button
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/55 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            ) : (
              <p className="text-sm text-foreground/55">
                {mode === 'login' ? 'New to MaliMart? ' : 'Already have an account? '}
                <button
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError('');
                  }}
                  className="font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {mode === 'login' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            )}
          </div>

          {/* Trust strip (desktop — mobile shows the hero version up top) */}
          <div className="mt-10 pt-6 border-t border-foreground/8 hidden lg:flex items-center justify-center gap-5 text-foreground/35">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Fast setup
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
              <Globe2 className="w-3.5 h-3.5" /> Tanzania
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
