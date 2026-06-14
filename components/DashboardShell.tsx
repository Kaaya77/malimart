/**
 * DashboardShell.tsx — shared layout primitives for all dashboard sections.
 * Ensures visual consistency across Seller and Buyer dashboards.
 *
 * Exports:
 *  - SectionHeader      — title + description + optional action button
 *  - StatBar            — row of small stat chips (replaces per-component grids)
 *  - FilterTabs         — horizontal tab strip (status filters)
 *  - SearchRow          — search input + optional refresh button
 *  - EmptyState         — consistent empty placeholder
 *  - ListSkeleton       — animated loading skeletons
 *  - DetailHeader       — back button + title + status chip for detail panels
 *  - InfoBlock          — labeled section within detail panels
 *  - ActionBanner       — call-to-action banner (pending action alerts)
 */
import React from 'react';
import { ChevronLeft, RefreshCw, Search, Loader2 } from 'lucide-react';

// ── Sk — reusable pulse skeleton block ───────────────────────────────────────
export const Sk = ({ w = 'w-full', h = 'h-4', r = 'rounded-lg' }: { w?: string; h?: string; r?: string }) => (
  <div className={`${w} ${h} ${r} bg-foreground/[0.06] animate-pulse`} />
);

// ── SectionHeader ────────────────────────────────────────────────────────────
export const SectionHeader = ({
  title, description, action, actionLabel, actionIcon: ActionIcon, actionLoading
}: {
  title: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
  actionIcon?: React.ElementType;
  actionLoading?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4 mb-5 flex-shrink-0">
    <div className="min-w-0">
      <h2 className="text-base font-black text-foreground tracking-tight truncate">{title}</h2>
      {description && <p className="text-[11px] text-foreground/40 mt-0.5">{description}</p>}
    </div>
    {action && actionLabel && (
      <button onClick={action} disabled={actionLoading}
        className="flex-shrink-0 h-9 px-4 rounded-xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60">
        {actionLoading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <>{ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}{actionLabel}</>
        }
      </button>
    )}
  </div>
);

// ── StatBar ───────────────────────────────────────────────────────────────────
export const StatBar = ({
  stats, activeFilter, onFilter
}: {
  stats: { label: string; value: number; color: string; filter: string }[];
  activeFilter: string;
  onFilter: (f: string) => void;
}) => (
  <div className={`grid gap-2 mb-4 flex-shrink-0`} style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
    {stats.map(st => (
      <button key={st.filter} onClick={() => onFilter(activeFilter === st.filter ? 'all' : st.filter)}
        className={`rounded-xl p-2.5 text-center transition-all ${activeFilter === st.filter
          ? 'bg-foreground/10 ring-1 ring-foreground/20' : 'bg-foreground/[0.03] hover:bg-foreground/[0.06]'}`}>
        <p className={`text-xl font-black tabular-nums ${st.color}`}>{st.value}</p>
        <p className="text-[9px] font-bold uppercase tracking-wide text-foreground/35 mt-0.5 truncate">{st.label}</p>
      </button>
    ))}
  </div>
);

// ── FilterTabs ────────────────────────────────────────────────────────────────
export const FilterTabs = ({
  tabs, active, onChange
}: {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar flex-shrink-0">
    {tabs.map(t => (
      <button key={t.value} onClick={() => onChange(t.value)}
        className={`flex-shrink-0 h-6 px-3 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
          active === t.value ? 'bg-foreground text-background' : 'bg-foreground/[0.05] text-foreground/45 hover:bg-foreground/10'
        }`}>
        {t.label}
      </button>
    ))}
  </div>
);

// ── SearchRow ─────────────────────────────────────────────────────────────────
export const SearchRow = ({
  value, onChange, placeholder = 'Search…',
  onRefresh, refreshing, children
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
}) => (
  <div className="flex gap-2 mb-3 flex-shrink-0">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 pl-9 pr-3 rounded-xl bg-foreground/[0.04] border border-foreground/8 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-colors" />
    </div>
    {children}
    {onRefresh && (
      <button onClick={onRefresh} disabled={refreshing}
        className="w-10 h-10 rounded-xl bg-foreground/[0.04] border border-foreground/8 flex items-center justify-center hover:bg-foreground/[0.07] transition-colors disabled:opacity-50">
        <RefreshCw className={`w-3.5 h-3.5 text-foreground/50 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    )}
  </div>
);

// ── EmptyState ────────────────────────────────────────────────────────────────
export const EmptyState = ({
  icon: Icon, title, description, action, actionLabel
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="w-12 h-12 rounded-2xl bg-foreground/[0.04] flex items-center justify-center">
      <Icon className="w-6 h-6 text-foreground/20" />
    </div>
    <p className="text-xs font-bold text-foreground/30 uppercase tracking-wider text-center">{title}</p>
    {description && <p className="text-[11px] text-foreground/25 text-center max-w-[200px]">{description}</p>}
    {action && actionLabel && (
      <button onClick={action}
        className="mt-2 h-9 px-4 rounded-xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 transition-colors">
        {actionLabel}
      </button>
    )}
  </div>
);

// ── ListSkeleton ──────────────────────────────────────────────────────────────
export const ListSkeleton = ({ count = 4, height = 'h-20' }: { count?: number; height?: string }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`${height} rounded-2xl bg-foreground/[0.04] animate-pulse`} />
    ))}
  </>
);

// ── DetailHeader ──────────────────────────────────────────────────────────────
export const DetailHeader = ({
  onBack, label, id, statusChip
}: {
  onBack: () => void;
  label: string;
  id?: string;
  statusChip?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 mb-5 flex-shrink-0">
    <button onClick={onBack}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors">
      <ChevronLeft className="w-4 h-4 text-foreground" />
    </button>
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/35">{label}</p>
      {id && <h3 className="font-bold text-sm text-foreground font-mono">#{id}</h3>}
    </div>
    {statusChip}
  </div>
);

// ── InfoBlock ─────────────────────────────────────────────────────────────────
export const InfoBlock = ({
  title, icon: Icon, children
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-foreground/8 overflow-hidden">
    <div className="px-4 py-2.5 border-b border-foreground/8 bg-foreground/[0.02] flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3 text-foreground/40" />}
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">{title}</p>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ── ActionBanner ──────────────────────────────────────────────────────────────
export const ActionBanner = ({
  title, description, primaryLabel, onPrimary, secondaryLabel, onSecondary,
  loading, color = 'emerald'
}: {
  title: string;
  description?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
  color?: 'emerald' | 'amber' | 'blue' | 'red';
}) => {
  const colors = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 btn-bg-emerald-600',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
    red:     'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
  };
  const btnColors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber:   'bg-amber-600 hover:bg-amber-700',
    blue:    'bg-blue-600 hover:bg-blue-700',
    red:     'bg-red-600 hover:bg-red-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${colors[color].split(' ').slice(0, 2).join(' ')}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-bold ${colors[color].split(' ').slice(2).join(' ')}`}>{title}</p>
          {description && <p className="text-[11px] text-foreground/50 mt-0.5">{description}</p>}
        </div>
        <button onClick={onPrimary} disabled={loading}
          className={`h-9 px-4 rounded-xl text-white text-[11px] font-black active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-60 ${btnColors[color]}`}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : primaryLabel}
        </button>
      </div>
      {secondaryLabel && onSecondary && (
        <button onClick={onSecondary} className="mt-2 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors">
          {secondaryLabel}
        </button>
      )}
    </div>
  );
};

// ── SettingsSection ───────────────────────────────────────────────────────────
export const SettingsSection = ({
  title, description, children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-foreground/8 overflow-hidden mb-4">
    <div className="px-5 py-4 border-b border-foreground/8 bg-foreground/[0.02]">
      <p className="text-sm font-black text-foreground">{title}</p>
      {description && <p className="text-[11px] text-foreground/40 mt-0.5">{description}</p>}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

// ── SettingsRow ───────────────────────────────────────────────────────────────
export const SettingsRow = ({
  label, description, children
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {description && <p className="text-[11px] text-foreground/40 mt-0.5">{description}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

// ── SettingsField ─────────────────────────────────────────────────────────────
export const SettingsField = ({
  label, children
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-xs font-bold text-foreground/60 mb-1.5 block">{label}</label>
    {children}
  </div>
);

// ── DashboardInput ────────────────────────────────────────────────────────────
export const DashboardInput = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) => (
  <input
    className={`flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30 transition-all ${className}`}
    {...props}
  />
);

// ── DashboardSelect ───────────────────────────────────────────────────────────
export const DashboardSelect = ({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }) => (
  <select
    className={`flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm font-medium text-foreground focus:outline-none focus:border-foreground/30 transition-all ${className}`}
    {...props}
  >
    {children}
  </select>
);

// ── DashboardTextarea ─────────────────────────────────────────────────────────
export const DashboardTextarea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) => (
  <textarea
    className={`flex min-h-[100px] w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 py-3 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/30 transition-all resize-none ${className}`}
    {...props}
  />
);

// ── SaveButton ────────────────────────────────────────────────────────────────
export const SaveButton = ({ loading, onClick, label = 'Save Changes', className = '' }: { loading?: boolean; onClick: () => void; label?: string; className?: string }) => (
  <button onClick={onClick} disabled={loading}
    className={`h-11 px-6 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 ${className}`}>
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
  </button>
);
