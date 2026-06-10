/**
 * BulkEditModal — production-grade batch product editor
 * All saves go through bulk_edit_products() SECURITY DEFINER RPC
 * which validates ownership per-row and writes inventory_logs for stock changes.
 */
import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { supabase } from '../services/supabaseClient';
import { useToast } from './UI';
import { formatTZS } from '../constants';
import { rateLimit } from '../src/security';

interface EditRow {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: string;
  sku: string;
  // track dirty state
  _dirty: boolean;
  _original: { name: string; price: number; stock: number; status: string };
}

export const BulkEditModal = ({
  isOpen, onClose, products, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSave: () => void;
}) => {
  const [rows, setRows] = useState<EditRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ saved: number; errors: any[] } | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setRows(products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        status: p.status,
        sku: p.sku || '',
        _dirty: false,
        _original: { name: p.name, price: p.price, stock: p.stock, status: p.status },
      })));
      setSaveResult(null);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const update = (id: string, field: keyof EditRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Mark dirty if different from original
      updated._dirty = (
        updated.name !== r._original.name ||
        updated.price !== r._original.price ||
        updated.stock !== r._original.stock ||
        updated.status !== r._original.status
      );
      return updated;
    }));
  };

  const dirtyRows = rows.filter(r => r._dirty);

  const handleSave = async () => {
    if (dirtyRows.length === 0) { addToast('No changes to save', 'info'); onClose(); return; }
    if (!rateLimit('bulk-edit', 5)) { addToast('Too fast — wait a moment', 'error'); return; }

    // Validate
    for (const row of dirtyRows) {
      if (!row.name.trim()) { addToast(`Row: empty product name not allowed`, 'error'); return; }
      if (row.price < 0) { addToast(`"${row.name}": price cannot be negative`, 'error'); return; }
      if (row.stock < 0) { addToast(`"${row.name}": stock cannot be negative`, 'error'); return; }
    }

    setIsSaving(true);
    try {
      const payload = dirtyRows.map(r => ({
        id: r.id,
        name: r.name.trim(),
        price: r.price,
        stock: r.stock,
        status: r.status,
      }));

      const { data, error } = await supabase.rpc('bulk_edit_products', {
        p_updates: JSON.stringify(payload),
      });
      if (error) throw error;

      const result = data as { saved: number; errors: any[] };
      setSaveResult(result);

      if (result.saved > 0) {
        addToast(`${result.saved} product${result.saved !== 1 ? 's' : ''} updated`, 'success');
        onSave();
      }
      if (result.errors?.length > 0) {
        addToast(`${result.errors.length} item${result.errors.length !== 1 ? 's' : ''} failed`, 'error');
      }
      if (result.errors?.length === 0) onClose();
    } catch (err: any) {
      addToast(err.message || 'Save failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-background border border-foreground/8 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/8">
          <div>
            <h2 className="text-base font-black text-foreground">Bulk Edit</h2>
            <p className="text-xs text-foreground/40 mt-0.5">
              {dirtyRows.length > 0 ? `${dirtyRows.length} unsaved change${dirtyRows.length !== 1 ? 's' : ''}` : `${rows.length} products`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        {/* Error summary */}
        {saveResult?.errors && saveResult.errors.length > 0 && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {saveResult.errors.length} items could not be saved:
            </p>
            {saveResult.errors.slice(0, 3).map((e, i) => (
              <p key={i} className="text-[10px] text-red-600 dark:text-red-400">• {e.error}</p>
            ))}
            {saveResult.errors.length > 3 && (
              <p className="text-[10px] text-red-500">...and {saveResult.errors.length - 3} more</p>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead className="sticky top-0 bg-foreground/[0.02] border-b border-foreground/8 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-foreground/40 w-8"></th>
                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-foreground/40">Product</th>
                <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest text-foreground/40 w-32">Price (TZS)</th>
                <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest text-foreground/40 w-24">Stock</th>
                <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-foreground/40 w-28">Status</th>
                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-foreground/40 w-28">SKU</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={`border-b border-foreground/5 last:border-0 ${row._dirty ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                  {/* Dirty indicator */}
                  <td className="px-4 py-2 w-8">
                    {row._dirty && (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mx-auto" title="Unsaved changes" />
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-2 py-1.5">
                    <input
                      value={row.name}
                      onChange={e => update(row.id, 'name', e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-transparent bg-transparent text-sm text-foreground hover:border-foreground/15 focus:border-foreground/25 focus:bg-foreground/[0.03] outline-none transition-all"
                    />
                  </td>

                  {/* Price */}
                  <td className="px-2 py-1.5 w-32">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={row.price}
                      onChange={e => update(row.id, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full h-9 px-3 rounded-lg border border-transparent bg-transparent text-sm text-foreground text-right hover:border-foreground/15 focus:border-foreground/25 focus:bg-foreground/[0.03] outline-none transition-all"
                    />
                  </td>

                  {/* Stock */}
                  <td className="px-2 py-1.5 w-24">
                    <input
                      type="number"
                      min="0"
                      value={row.stock}
                      onChange={e => update(row.id, 'stock', Math.max(0, parseInt(e.target.value) || 0))}
                      className={`w-full h-9 px-3 rounded-lg border border-transparent bg-transparent text-sm text-right hover:border-foreground/15 focus:border-foreground/25 focus:bg-foreground/[0.03] outline-none transition-all ${
                        row.stock === 0 ? 'text-red-500 font-bold' :
                        row.stock < 5 ? 'text-amber-600 font-bold' :
                        'text-foreground'
                      }`}
                    />
                  </td>

                  {/* Status */}
                  <td className="px-2 py-1.5 w-28">
                    <select
                      value={row.status}
                      onChange={e => update(row.id, 'status', e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-transparent bg-transparent text-xs text-foreground hover:border-foreground/15 focus:border-foreground/25 outline-none transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>

                  {/* SKU (read-only) */}
                  <td className="px-4 py-1.5 w-28">
                    <span className="text-[10px] font-mono text-foreground/30 truncate block">{row.sku || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-foreground/8 flex items-center justify-between gap-4 bg-foreground/[0.01]">
          <p className="text-[11px] text-foreground/40">
            {dirtyRows.length === 0
              ? 'Edit cells above to make changes'
              : `${dirtyRows.length} product${dirtyRows.length !== 1 ? 's' : ''} will be updated · stock changes are logged`
            }
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="h-10 px-5 rounded-xl border border-foreground/15 text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.04] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || dirtyRows.length === 0}
              className="h-10 px-6 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                : <><Save className="w-4 h-4" />Save {dirtyRows.length > 0 ? dirtyRows.length : ''} Changes</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
