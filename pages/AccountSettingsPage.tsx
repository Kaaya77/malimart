// =====================================================================
// SettingsPage.tsx — one settings surface for ALL roles.
// Tabs: Profile · Appearance · Notifications · Security · Privacy
// Every save goes through update_my_settings (server-side whitelist),
// so users can customize freely without touching protected columns
// (role, wallet_balance, tier, is_banned are unreachable by design).
// Route: /account/settings
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import {
  updateMySettings, revokeSession, revokeOtherSessions,
} from "../services/accountApi";
import { applyTheme, ACCENTS, ThemeMode } from "../services/theme";
import { compressImage } from "../services/imageCompression";
import ConfirmDialog from "../components/ConfirmDialog";

type Tab = "profile" | "appearance" | "notifications" | "security" | "privacy";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "profile",       label: "Profile",       icon: "👤" },
  { id: "appearance",    label: "Appearance",    icon: "🎨" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "security",      label: "Security",      icon: "🔒" },
  { id: "privacy",       label: "Privacy",       icon: "🛡️" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-neutral-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      </div>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-[var(--mm-accent)]" : "bg-neutral-300 dark:bg-neutral-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5.5 left-0.5 translate-x-[1.25rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mm-accent)]";

export function AccountSettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [p, setP] = useState<Record<string, any> | null>(null);
  const [dirty, setDirty] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !p) return;
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const compressed = await compressImage(file, 400, 0.8);
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('mali-mart-uploads')
        .upload(path, compressed, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('mali-mart-uploads').getPublicUrl(path);
      const url = data.publicUrl + `?v=${Date.now()}`;
      set('avatar_url', url);
      await updateMySettings({ avatar_url: url });
      setToast('Avatar updated');
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(err.message || 'Upload failed');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).single();
      setP(data);
      const { data: s } = await supabase
        .from("user_sessions").select("*").is("revoked_at", null)
        .order("last_active_at", { ascending: false });
      setSessions(s ?? []);
    })();
  }, []);

  const set = (k: string, v: unknown) => {
    setP((prev) => ({ ...prev!, [k]: v }));
    setDirty((d) => ({ ...d, [k]: v }));
    if (["theme_mode", "theme_accent", "reduced_motion", "high_contrast_mode"].includes(k) && p) {
      applyTheme({ ...p, [k]: v } as any);
    }
  };

  const save = async () => {
    if (Object.keys(dirty).length === 0) return;
    setSaving(true);
    try {
      await updateMySettings(dirty);
      setDirty({});
      setToast("Changes saved");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (!p) return <div className="p-8 text-sm text-neutral-500">Loading settings…</div>;
  const isSeller = p.role === "seller";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-neutral-500">Manage your profile, appearance and security.</p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition
              ${tab === t.id ? "bg-[var(--mm-accent)] text-[var(--mm-accent-on)]"
                             : "bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6">
        {tab === "profile" && (
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Avatar upload */}
            <div className="sm:col-span-2 flex items-center gap-5">
              <div className="relative w-20 h-20 shrink-0 group">
                <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden border-2 border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <span className="text-2xl text-neutral-400">{(p.full_name || p.display_name || '?')[0]?.toUpperCase()}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {uploadingAvatar
                    ? <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div>
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-xs text-neutral-400 mt-0.5">Hover and click to upload. Max 5 MB.</p>
                <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="mt-1.5 text-xs font-semibold underline underline-offset-2 hover:opacity-60 transition-opacity">
                  {uploadingAvatar ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            </div>
            <Field label="Full name"><input className={input} value={p.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
            <Field label="Display name" hint="Shown publicly on reviews and chat">
              <input className={input} value={p.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} /></Field>
            <Field label="Phone"><input className={input} value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+255…" /></Field>
            <Field label="Region">
              <select className={input} value={p.region ?? ""} onChange={(e) => set("region", e.target.value)}>
                <option value="">Select region</option>
                {["Dar es Salaam","Arusha","Mwanza","Dodoma","Mbeya","Morogoro","Tanga","Zanzibar","Kigoma","Other"].map((r) =>
                  <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Bio" hint="A short intro, max 280 characters">
                <textarea className={input} rows={3} maxLength={280} value={p.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
              </Field>
            </div>
            <Field label="Language">
              <select className={input} value={p.language ?? "sw"} onChange={(e) => set("language", e.target.value)}>
                <option value="sw">Kiswahili</option><option value="en">English</option>
              </select>
            </Field>
            <Field label="Currency">
              <select className={input} value={p.default_currency ?? "TZS"} onChange={(e) => set("default_currency", e.target.value)}>
                <option value="TZS">TZS — Tanzanian Shilling</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </Field>
          </div>
        )}

        {tab === "appearance" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                  <button key={m} onClick={() => set("theme_mode", m)}
                    className={`rounded-xl border-2 px-3 py-4 text-sm font-medium capitalize
                      ${p.theme_mode === m ? "border-[var(--mm-accent)] bg-[var(--mm-accent-soft)] dark:bg-neutral-900"
                                           : "border-neutral-200 dark:border-neutral-800"}`}>
                    {m === "light" ? "☀️" : m === "dark" ? "🌙" : "💻"} {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Accent colour</p>
              <p className="text-xs text-neutral-400">Curated palette — every accent meets contrast standards.</p>
              <div className="mt-2 flex gap-3">
                {Object.entries(ACCENTS).map(([name, a]) => (
                  <button key={name} title={name} onClick={() => set("theme_accent", name)}
                    className={`h-10 w-10 rounded-full ring-offset-2 transition ${p.theme_accent === name ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}
                    style={{ backgroundColor: a.base }} aria-label={`${name} accent`} />
                ))}
              </div>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
              <Toggle label="Reduced motion" hint="Minimise animations across the app"
                value={!!p.reduced_motion} onChange={(v) => set("reduced_motion", v)} />
              <Toggle label="High contrast" hint="Stronger colours for readability"
                value={!!p.high_contrast_mode} onChange={(v) => set("high_contrast_mode", v)} />
              <Toggle label="Sound effects" hint="Subtle sounds for messages and actions"
                value={!!p.sound_effects} onChange={(v) => set("sound_effects", v)} />
            </div>
            <Field label="Signature emoji" hint="Appears next to your name in chat">
              <input className={`${input} w-24 text-center text-xl`} maxLength={4}
                value={p.signature_emoji ?? ""} onChange={(e) => set("signature_emoji", e.target.value)} />
            </Field>
          </div>
        )}

        {tab === "notifications" && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            <Toggle label="Order updates" hint="Status changes, delivery and refunds"
              value={!!p.order_notifications} onChange={(v) => set("order_notifications", v)} />
            <Toggle label="Email" value={!!p.email_notifications} onChange={(v) => set("email_notifications", v)} />
            <Toggle label="SMS" hint="Standard network charges may apply"
              value={!!p.sms_notifications} onChange={(v) => set("sms_notifications", v)} />
            <Toggle label="Push" value={!!p.push_notifications} onChange={(v) => set("push_notifications", v)} />
            <Toggle label="Stock alerts" hint={isSeller ? "Low-stock warnings for your products" : "Back-in-stock alerts for wishlist items"}
              value={!!p.stock_alerts} onChange={(v) => set("stock_alerts", v)} />
            <Toggle label="Newsletter" hint="Deals and platform news, at most weekly"
              value={!!p.newsletter} onChange={(v) => set("newsletter", v)} />
            {isSeller && (
              <Toggle label="Vacation mode" hint="Pause your shop — products stay listed but can't be ordered"
                value={!!p.vacation_mode} onChange={(v) => set("vacation_mode", v)} />
            )}
          </div>
        )}

        {tab === "security" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-neutral-400">We'll email you a secure reset link.</p>
              <button
                onClick={async () => {
                  const { data } = await supabase.auth.getUser();
                  if (data.user?.email) {
                    await supabase.auth.resetPasswordForEmail(data.user.email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    setToast("Reset link sent to your email");
                    setTimeout(() => setToast(null), 2500);
                  }
                }}
                className="mt-2 rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900">
                Send password reset email
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Active sessions</p>
                <button onClick={() => setConfirmRevokeAll(true)}
                  className="text-xs font-semibold text-red-600">Sign out everywhere else</button>
              </div>
              <div className="mt-2 space-y-2">
                {sessions.length === 0 && <p className="text-xs text-neutral-400">No tracked sessions yet.</p>}
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5">
                    <div>
                      <p className="text-sm">{s.device_label || s.user_agent?.slice(0, 48) || "Unknown device"}</p>
                      <p className="text-xs text-neutral-400">
                        {s.ip_address} · active {new Date(s.last_active_at ?? s.created_at).toLocaleString("en-TZ")}
                      </p>
                    </div>
                    <button onClick={async () => { await revokeSession(s.id);
                      setSessions((x) => x.filter((y) => y.id !== s.id)); }}
                      className="text-xs font-medium text-red-600 hover:underline">Revoke</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "privacy" && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            <Toggle label="Public profile" hint="Others can view your profile, reviews and follows"
              value={!!p.profile_visibility} onChange={(v) => set("profile_visibility", v)} />
            <Toggle label="Opt out of analytics" hint="We'll exclude your activity from usage analytics"
              value={!!p.opt_out_analytics} onChange={(v) => set("opt_out_analytics", v)} />
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {Object.keys(dirty).length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <span className="text-sm text-neutral-500">{Object.keys(dirty).length} unsaved change(s)</span>
            <button onClick={save} disabled={saving}
              className="rounded-xl bg-[var(--mm-accent)] px-6 py-2.5 text-sm font-semibold text-[var(--mm-accent-on)] disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900">
          {toast}
        </div>
      )}

      <ConfirmDialog
        open={confirmRevokeAll}
        title="Sign out everywhere else?"
        description="All other devices will be signed out immediately. Your current session stays active."
        confirmLabel="Sign out other devices"
        onConfirm={async () => {
          const kept = sessions[0]?.id;
          await revokeOtherSessions(kept);
          setSessions((s) => s.slice(0, 1));
        }}
        onClose={() => setConfirmRevokeAll(false)}
      />
    </div>
  );
}
