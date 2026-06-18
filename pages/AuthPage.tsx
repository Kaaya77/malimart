import { clearAuthAttempts, safeRedirect } from '../src/security';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Lock, ArrowRight, ArrowLeft, ShoppingBag, Store,
  Eye, EyeOff, Check, ShieldCheck, Sparkles,
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';

const TAGLINES = [
  'Tanzania’s most loved marketplace',
  'Buy and sell with confidence',
  'From Dar to Mwanza, in one tap',
];

// ── Animated aurora backdrop ────────────────────────────────────────────────────
const Aurora = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900" />
    <div className="aurora aurora-1 w-[40rem] h-[40rem] -top-40 -left-32 bg-emerald-500/40" />
    <div className="aurora aurora-2 w-[34rem] h-[34rem] top-1/3 -right-32 bg-teal-400/30" />
    <div className="aurora aurora-3 w-[30rem] h-[30rem] -bottom-40 left-1/4 bg-violet-500/25" />
    {/* fine grid */}
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
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
  const [tagline, setTagline] = useState(0);

  const redirectPath = safeRedirect(searchParams.get('redirect'), '/');

  useEffect(() => {
    if (user && !user.is_banned) {
      clearAuthAttempts(formData.email);
      navigate(redirectPath);
    }
  }, [user, navigate, redirectPath]);

  useEffect(() => {
    const id = setInterval(() => setTagline(p => (p + 1) % TAGLINES.length), 4000);
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

  const title =
    mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password';
  const subtitle =
    mode === 'login'
      ? 'Sign in to continue to your marketplace.'
      : mode === 'signup'
      ? 'Start buying and selling in minutes.'
      : 'We’ll email you a secure reset link.';

  const inputBase =
    'glass-input peer w-full h-[52px] rounded-2xl pl-11 pr-4 text-base sm:text-[15px] font-medium text-white placeholder:text-white/45 outline-none';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center font-sans relative px-5 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <Aurora />

      {/* Glass card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel relative z-10 w-full max-w-[420px] rounded-[28px] p-6 sm:p-8 text-white"
      >
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 mb-7 w-fit">
          <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center font-black text-lg shadow-lg">
            M
          </div>
          <span className="font-bold text-lg tracking-tight">MaliMart</span>
        </Link>

        {/* Heading */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mb-6"
          >
            <h1 className="text-[1.7rem] sm:text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-white/55 text-sm mt-1.5">{subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 18 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-300/30 text-red-100 text-sm font-medium backdrop-blur">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} method="post" className="space-y-4">
          {/* Role selector (signup) */}
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/[0.06] border border-white/15">
              {(['buyer', 'seller'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`relative h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    role === r
                      ? 'bg-white/90 text-slate-900 shadow-lg'
                      : 'text-white/60 hover:text-white/90'
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
              <label htmlFor="auth-name" className="block text-[13px] font-semibold text-white/70 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/45" />
                <input id="auth-name" name="name" placeholder="Juma Hamisi"
                  value={formData.name} onChange={handleInputChange} className={inputBase} />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="auth-email" className="block text-[13px] font-semibold text-white/70 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/45" />
              <input id="auth-email" name="email" type="email" required autoComplete="email"
                placeholder="name@example.com" value={formData.email} onChange={handleInputChange} className={inputBase} />
            </div>
          </div>

          {/* Password */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="block text-[13px] font-semibold text-white/70">
                  Password
                </label>
                {mode === 'login' && (
                  <button type="button" onClick={() => setMode('forgot')}
                    className="text-[13px] font-semibold text-emerald-300 hover:text-emerald-200">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/45" />
                <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••"
                  value={formData.password} onChange={handleInputChange} className={`${inputBase} pr-11`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/80 transition-colors">
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>

              {/* Password strength (signup) */}
              {mode === 'signup' && formData.password && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i}
                        className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                          i <= security.strength
                            ? security.strength <= 1 ? 'bg-red-400'
                            : security.strength === 2 ? 'bg-amber-400'
                            : 'bg-emerald-400'
                            : 'bg-white/15'
                        }`}
                      />
                    ))}
                  </div>
                  {security.hints.length > 0 ? (
                    <p className="text-xs text-white/50">Add {security.hints.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-emerald-300 font-medium flex items-center gap-1">
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
            className="w-full h-[52px] rounded-2xl bg-white text-slate-900 text-base font-semibold shadow-xl shadow-black/20 hover:bg-white/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          {mode === 'forgot' ? (
            <button onClick={() => setMode('login')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>
          ) : (
            <p className="text-sm text-white/55">
              {mode === 'login' ? 'New to MaliMart? ' : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          )}
        </div>

        {/* Rotating tagline */}
        <div className="mt-7 pt-5 border-t border-white/10 flex items-center justify-center gap-2 text-white/45 h-5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
          <AnimatePresence mode="wait">
            <motion.span
              key={tagline}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-medium"
            >
              {TAGLINES[tagline]}
            </motion.span>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
