/**
 * ResetPasswordPage — completes the password recovery flow.
 *
 * Before this page existed, "Forgot password" emails led nowhere: Supabase
 * signed the user in via the recovery link, but no UI ever asked for a new
 * password. This page listens for the recovery session and finishes the job.
 *
 * Route: /auth/reset  (linked from resetPasswordForEmail's redirectTo)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../components/UI';
import { KitengeStrip } from '../components/MaliSoul';

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [ready, setReady] = useState<boolean | null>(null); // null = checking
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link signs the user in with a temporary session.
    // PASSWORD_RECOVERY fires on arrival; an existing session also qualifies.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setReady(prev => prev ?? !!data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const score = strength(pw);
  const valid = score >= 2 && pw === pw2;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) { addToast(error.message, 'error'); return; }
    setDone(true);
    addToast('Password updated — karibu tena!', 'success');
    setTimeout(() => navigate('/'), 1800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground mb-1">Set a new password</h1>
        <p className="text-sm text-foreground/50 mb-6">Choose something strong — your account, your duka.</p>
        <KitengeStrip className="w-24 mx-auto mb-8" />

        {ready === null && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-foreground/40" /></div>
        )}

        {ready === false && (
          <div className="rounded-2xl border border-foreground/10 p-6 space-y-3">
            <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">This reset link is invalid or has expired</p>
            <p className="text-xs text-foreground/50">Request a new one from the login page.</p>
            <button onClick={() => navigate('/login')} className="mt-2 px-6 h-11 rounded-xl bg-foreground text-background text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Back to login</button>
          </div>
        )}

        {ready && !done && (
          <div className="space-y-4 text-left">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="New password"
                autoFocus
                className="w-full h-14 rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 pr-12 font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-emerald-500/40 transition-all"
              />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {/* Strength meter */}
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < score ? (score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-foreground/10'}`} />
              ))}
            </div>
            <input
              type={show ? 'text' : 'password'}
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              placeholder="Confirm new password"
              className="w-full h-14 rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-emerald-500/40 transition-all"
            />
            {pw2 && pw !== pw2 && <p className="text-xs font-semibold text-red-500">Passwords don't match</p>}
            <button
              onClick={save}
              disabled={!valid || saving}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Update password
            </button>
          </div>
        )}

        {done && (
          <div className="mali-pop flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            <p className="font-bold text-foreground">Password updated!</p>
            <p className="text-xs text-foreground/50">Taking you home…</p>
          </div>
        )}
      </div>
    </div>
  );
};
