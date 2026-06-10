/**
 * CSVImport — validated CSV product import
 * Uses import_products_csv() SECURITY DEFINER RPC which:
 *   - validates name, price, stock
 *   - deduplicates by SKU
 *   - enforces 500 row batch limit
 *   - forces seller_id to auth.uid() (no spoofing)
 *   - imports as 'draft' by default (safe)
 */
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Loader2, CheckCircle2, AlertCircle, X, FileText, Info } from 'lucide-react';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { mapCSVColumnsToSchema } from '../services/geminiService';

const BATCH_LIMIT = 500;

type Status = 'idle' | 'parsing' | 'mapping' | 'uploading' | 'done';

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { row: any; error: string }[];
}

export const CSVImport = ({
  onClose, onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<any[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) { addToast('Please select a .csv file', 'error'); return; }
    if (f.size > 5 * 1024 * 1024) { addToast('File too large (max 5 MB)', 'error'); return; }
    setFile(f);
    // Parse preview (first 3 rows)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      preview: 3,
      complete: res => setPreview(res.data),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus('parsing');
    setProgress('Parsing CSV…');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];

          if (rows.length === 0) {
            addToast('CSV is empty', 'error');
            setStatus('idle');
            return;
          }
          if (rows.length > BATCH_LIMIT) {
            addToast(`Too many rows (max ${BATCH_LIMIT}). Got ${rows.length}.`, 'error');
            setStatus('idle');
            return;
          }

          setStatus('mapping');
          setProgress('Mapping columns with AI…');
          const headers = results.meta.fields || [];
          const mapping = await mapCSVColumnsToSchema(headers);

          // Transform rows using the AI-generated column mapping
          const products = rows.map((row: any) => {
            const p: Record<string, any> = {};
            Object.entries(mapping).forEach(([csvCol, schemaField]) => {
              const val = row[csvCol];
              if (schemaField === 'name') p.name = String(val || '').trim();
              else if (schemaField === 'price') p.price = parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
              else if (schemaField === 'stock') p.stock = parseInt(String(val)) || 0;
              else if (schemaField === 'category') p.category = String(val || '').trim();
              else if (schemaField === 'sku') p.sku = String(val || '').trim();
              else if (schemaField === 'description') p.description = String(val || '').trim();
              else if (schemaField === 'status') p.status = ['active','draft'].includes(String(val).toLowerCase()) ? String(val).toLowerCase() : 'draft';
            });
            return p;
          });

          setStatus('uploading');
          setProgress(`Importing ${products.length} products…`);

          const { data, error } = await supabase.rpc('import_products_csv', {
            p_products: JSON.stringify(products),
          });
          if (error) throw error;

          const res = data as ImportResult;
          setResult(res);
          setStatus('done');

          if (res.inserted > 0) {
            addToast(`${res.inserted} product${res.inserted !== 1 ? 's' : ''} imported as draft`, 'success');
            onSuccess();
          }
        } catch (err: any) {
          addToast(err.message || 'Import failed', 'error');
          setStatus('idle');
          setProgress('');
        }
      },
      error: () => {
        addToast('Failed to parse CSV file', 'error');
        setStatus('idle');
      },
    });
  };

  const statusLabel: Record<Status, string> = {
    idle: '', parsing: 'Parsing CSV…', mapping: 'Mapping columns with AI…',
    uploading: 'Importing to database…', done: 'Import complete',
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={status === 'idle' ? onClose : undefined} />
      <div className="relative w-full max-w-lg bg-background border border-foreground/8 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/8">
          <div>
            <h2 className="text-base font-black text-foreground">Import Products</h2>
            <p className="text-xs text-foreground/40 mt-0.5">Upload a CSV — max {BATCH_LIMIT} rows, 5 MB</p>
          </div>
          <button onClick={onClose} disabled={status !== 'idle' && status !== 'done'}
            className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center hover:bg-foreground/10 transition-colors disabled:opacity-30">
            <X className="w-4 h-4 text-foreground/60" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Info banner */}
          <div className="flex gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
              <p><strong>Products import as Draft</strong> — review before publishing.</p>
              <p>Required column: <code className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1 rounded">name</code> · Optional: price, stock, category, sku, description</p>
              <p>Duplicate SKUs (for your store) are skipped automatically.</p>
            </div>
          </div>

          {/* Drop zone */}
          {status === 'idle' && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                file ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-foreground/15 hover:border-foreground/30 hover:bg-foreground/[0.02]'
              }`}
            >
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{file.name}</p>
                    <p className="text-[10px] text-foreground/40">{(file.size / 1024).toFixed(1)} KB · {preview.length} preview rows</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground/50">Drop CSV here or click to browse</p>
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {status === 'idle' && preview.length > 0 && (
            <div className="rounded-xl border border-foreground/8 overflow-hidden">
              <div className="px-4 py-2 bg-foreground/[0.02] border-b border-foreground/8">
                <p className="text-[9px] font-black uppercase tracking-widest text-foreground/40">Preview (first {preview.length} rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-foreground/5">
                      {Object.keys(preview[0] || {}).slice(0, 5).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-bold text-foreground/40 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-foreground/5 last:border-0">
                        {Object.values(row).slice(0, 5).map((v: any, j) => (
                          <td key={j} className="px-3 py-2 text-foreground/60 truncate max-w-[120px]">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {status !== 'idle' && status !== 'done' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-foreground/[0.03]">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">{statusLabel[status]}</p>
                <p className="text-[11px] text-foreground/40">This may take a moment…</p>
              </div>
            </div>
          )}

          {/* Result */}
          {status === 'done' && result && (
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-4 rounded-2xl ${
                result.inserted > 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-foreground/[0.03]'
              }`}>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-black text-foreground">
                    {result.inserted} product{result.inserted !== 1 ? 's' : ''} imported
                    {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
                  </p>
                  <p className="text-[11px] text-foreground/50">All imported as Draft — review and publish from inventory</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="rounded-xl border border-red-200/50 dark:border-red-900/30 overflow-hidden">
                  <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-200/30 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest">
                      {result.errors.length} skipped rows
                    </p>
                  </div>
                  <div className="max-h-32 overflow-y-auto p-3 space-y-1">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <p key={i} className="text-[10px] text-foreground/60">
                        <strong>{e.row?.name || 'Row'}</strong>: {e.error}
                      </p>
                    ))}
                    {result.errors.length > 10 && (
                      <p className="text-[10px] text-foreground/40">…and {result.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {status === 'done' ? (
            <button onClick={onClose}
              className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={status !== 'idle'}
                className="flex-1 h-11 rounded-xl border border-foreground/15 text-sm font-semibold text-foreground/60 hover:bg-foreground/[0.04] disabled:opacity-30 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || status !== 'idle'}
                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import {preview.length > 0 ? `(${preview.length} previewed)` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
