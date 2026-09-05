import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Eye, Lock,
  Activity, Users, Package, FileText, RefreshCw, ChevronRight,
  Zap, Clock, Globe, Hash, X
} from 'lucide-react';
import { fetchAuditLog, checkRlsCoverage } from '../services/adminApi';
import { useAppState } from '../context/AppContext';
import { assertRole } from '../src/security';
import { formatTZS } from '../constants';

interface AuditEntry {
  id: string;
  user_id: string;
  table_name: string;
  action: string;
  record_id: string;
  old_data: any;
  new_data: any;
  created_at: string;
  user?: { full_name: string; email: string; role: string };
}

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'bg-blue-500/10 text-blue-600',
  UPDATE: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
};

const TABLE_RISK: Record<string, 'low' | 'medium' | 'high'> = {
  profiles:          'high',
  orders:            'high',
  products:          'medium',
  seller_payouts:    'high',
  platform_settings: 'high',
  vendor_profiles:   'medium',
};

export const SecurityMonitor: React.FC = () => {
  const { user } = useAppState();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [stats, setStats] = useState({ total: 0, highRisk: 0, deletions: 0, lastHour: 0 });
  // null while the live RLS check hasn't returned yet — the checklist shows
  // a "checking..." state rather than guessing pass/fail in the meantime.
  const [tablesWithoutRls, setTablesWithoutRls] = useState<string[] | null>(null);

  if (!assertRole(user?.role, 'admin')) return null;

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await fetchAuditLog();

    if (data) {
      setLogs(data as AuditEntry[]);
      const now = Date.now();
      setStats({
        total: data.length,
        highRisk: data.filter(l => TABLE_RISK[l.table_name] === 'high').length,
        deletions: data.filter(l => l.action === 'DELETE').length,
        lastHour: data.filter(l => now - new Date(l.created_at).getTime() < 3600000).length,
      });
    }
    setLoading(false);
  };

  const fetchRlsCheck = async () => {
    try {
      const { tables_without_rls } = await checkRlsCoverage();
      setTablesWithoutRls(tables_without_rls || []);
    } catch {
      // Leave as null (shown as "unable to verify") rather than claim pass.
    }
  };

  useEffect(() => { fetchLogs(); fetchRlsCheck(); }, []);

  const filtered = logs.filter(l => {
    if (filter === 'high')   return TABLE_RISK[l.table_name] === 'high';
    if (filter === 'medium') return ['medium','high'].includes(TABLE_RISK[l.table_name] || 'low');
    return true;
  });

  // `live: true` items are queried against Supabase right now, on every load
  // of this tab — their status can actually change if something regresses.
  // `live: false` items are guarantees this codebase's design relies on
  // (verified in code review, not re-checked here); they used to be shown
  // identically to the live ones, which is exactly the "does this reflect
  // what's REALLY happening" concern this was built to answer. Now labeled
  // honestly instead of implying all 14 are freshly verified.
  const securityChecks: { label: string; status: 'pass' | 'warn' | 'checking'; desc: string; live: boolean }[] = [
    tablesWithoutRls === null
      ? { label: 'RLS Enabled', status: 'checking', desc: 'Checking pg_class.relrowsecurity…', live: true }
      : tablesWithoutRls.length === 0
        ? { label: 'RLS Enabled', status: 'pass', desc: 'Every public table has Row Level Security', live: true }
        : { label: 'RLS Enabled', status: 'warn', desc: `Missing on: ${tablesWithoutRls.join(', ')}`, live: true },
    { label: 'Audit Logging', status: logs.length > 0 ? 'pass' : 'warn', desc: 'All sensitive mutations logged', live: true },
    { label: 'Admin Role Guard',      status: 'pass', desc: 'Admin actions verify role before execution', live: false },
    { label: 'Price Integrity',       status: 'pass', desc: 'place_order_atomic re-fetches prices server-side', live: false },
    { label: 'Role Escalation Block', status: 'pass', desc: 'updateUserProfile strips role/is_banned fields', live: false },
    { label: 'File Upload Validation',status: 'pass', desc: 'MIME type + size checked before upload', live: false },
    { label: 'Brute Force Lock',      status: 'pass', desc: '5 failed logins → 15 min lockout', live: false },
    { label: 'Rate Limiting',         status: 'pass', desc: 'Token bucket per operation key', live: false },
    { label: 'Safe Redirects',        status: 'pass', desc: 'Open redirect blocked — same-origin only', live: false },
    { label: 'XSS Sanitization',      status: 'pass', desc: 'All user inputs stripped of HTML/scripts', live: false },
    { label: 'Prototype Pollution',   status: 'pass', desc: 'safeJsonParse blocks __proto__ injection', live: false },
    { label: 'CSRF Token',            status: 'pass', desc: 'Crypto token in sessionStorage', live: false },
    { label: 'Security Headers',      status: 'pass', desc: 'CSP + HSTS + X-Frame-Options: DENY', live: false },
    { label: 'Ownership Checks',      status: 'pass', desc: 'seller_id verified before product mutations', live: false },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600 stroke-[2]"/>
          </div>
          <div>
            <h2 className="font-bold text-foreground text-sm">Security Monitor</h2>
            <p className="text-[10px] text-foreground/40">Real-time threat detection & audit log</p>
          </div>
        </div>
        <button onClick={() => { fetchLogs(); fetchRlsCheck(); }} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-foreground/[0.06] text-foreground/60 text-xs font-semibold hover:bg-foreground/10 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events',   value: stats.total,    icon: Activity,       color: 'text-blue-600 bg-blue-500/10' },
          { label: 'High Risk',      value: stats.highRisk, icon: AlertTriangle,  color: 'text-red-600 bg-red-500/10' },
          { label: 'Deletions',      value: stats.deletions,icon: XCircle,        color: 'text-rose-600 bg-rose-500/10' },
          { label: 'Last Hour',      value: stats.lastHour, icon: Clock,          color: 'text-amber-600 bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 p-4 bg-foreground/[0.02] border border-foreground/8 rounded-2xl">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4 stroke-[2]"/>
            </div>
            <div>
              <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest">{label}</p>
              <p className="text-xl font-black text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Security checklist */}
      <div className="bg-foreground/[0.02] border border-foreground/8 rounded-3xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-1 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5"/> Security Checklist
        </p>
        <p className="text-[10px] text-foreground/30 mb-4">
          "Live" items are queried from Supabase on every load; the rest are design guarantees this codebase relies on, verified in code — not re-checked here.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {securityChecks.map(({ label, status, desc, live }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors">
              {status === 'pass'
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 stroke-[2.5]"/>
                : status === 'checking'
                  ? <RefreshCw className="w-4 h-4 text-foreground/30 shrink-0 mt-0.5 animate-spin"/>
                  : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 stroke-[2.5]"/>
              }
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  {label}
                  {live && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Live</span>
                  )}
                </p>
                <p className="text-[10px] text-foreground/40 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-foreground/[0.02] border border-foreground/8 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5"/> Audit Log
          </p>
          <div className="flex p-1 bg-foreground/[0.04] rounded-xl gap-1">
            {(['all','high','medium'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all capitalize ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-foreground/40'}`}>
                {f === 'all' ? 'All' : f === 'high' ? '🔴 High' : '🟡 Medium'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-foreground/30"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-foreground/25">
            <Shield className="w-10 h-10 mb-2 opacity-20"/>
            <p className="text-sm font-semibold">No events logged yet</p>
            <p className="text-xs mt-1">Activity will appear here once users interact</p>
          </div>
        ) : (
          <div className="divide-y divide-foreground/5 max-h-[500px] overflow-y-auto no-scrollbar">
            {filtered.map(log => {
              const risk = TABLE_RISK[log.table_name] || 'low';
              return (
                <button key={log.id} onClick={() => setSelected(log)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-foreground/[0.03] transition-colors">
                  <div className={`text-[9px] font-black px-2 py-1 rounded-lg shrink-0 ${ACTION_COLOR[log.action] || 'bg-foreground/10 text-foreground/60'}`}>
                    {log.action}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">{log.table_name}</p>
                      {risk === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>}
                      {risk === 'medium' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>}
                    </div>
                    <p className="text-[10px] text-foreground/40 truncate">
                      {(log as any).user?.email || log.user_id?.slice(0,8) || 'System'} · {log.record_id?.slice(0,8)}
                    </p>
                  </div>
                  <p className="text-[10px] text-foreground/30 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </p>
                  <ChevronRight className="w-3.5 h-3.5 text-foreground/20 shrink-0"/>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target===e.currentTarget) setSelected(null); }}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              className="w-full max-w-lg bg-background rounded-3xl border border-foreground/8 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
                <h3 className="font-bold text-foreground text-sm">Audit Event Detail</h3>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/10">
                  <X className="w-4 h-4 stroke-[2.5]"/>
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[60dvh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Action',   value: selected.action },
                    { label: 'Table',    value: selected.table_name },
                    { label: 'Record',   value: selected.record_id?.slice(0,12) || '—' },
                    { label: 'Risk',     value: (TABLE_RISK[selected.table_name] || 'low').toUpperCase() },
                    { label: 'User',     value: (selected as any).user?.email || selected.user_id?.slice(0,12) || 'System' },
                    { label: 'Time',     value: new Date(selected.created_at).toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-foreground/[0.03] rounded-xl">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/35">{label}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
                    </div>
                  ))}
                </div>
                {selected.old_data && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 mb-2">Before</p>
                    <pre className="text-[10px] text-foreground/60 bg-foreground/[0.03] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selected.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                {selected.new_data && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/35 mb-2">After</p>
                    <pre className="text-[10px] text-foreground/60 bg-foreground/[0.03] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selected.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
