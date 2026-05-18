import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { useAppState } from '../context/AppContext';
import { mapCSVColumnsToSchema } from '../services/geminiService';

export const CSVImport = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'mapping' | 'uploading' | 'success' | 'error'>('idle');
    const { addToast } = useToast();
    const { user } = useAppState();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file || !user) return;
        setLoading(true);
        setStatus('parsing');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    setStatus('mapping');
                    const headers = results.meta.fields || [];
                    const mapping = await mapCSVColumnsToSchema(headers);
                    
                    const products = results.data.map((row: any) => {
                        const transformed: any = { seller_id: user.id, status: 'active' };
                        Object.entries(mapping).forEach(([csvHeader, schemaField]) => {
                            const value = row[csvHeader];
                            if (schemaField === 'price') transformed.price = parseFloat(value) || 0;
                            else if (schemaField === 'stock') transformed.stock = parseInt(value) || 0;
                            else if (schemaField === 'name') transformed.name = value || 'Unnamed Product';
                            else if (schemaField === 'category') transformed.category = value || 'Uncategorized';
                        });
                        return transformed;
                    });

                    setStatus('uploading');
                    const { error } = await supabase.from('products').insert(products);
                    
                    if (error) throw error;

                    setStatus('success');
                    addToast("Products imported successfully", "success");
                    onSuccess();
                } catch (error) {
                    console.error(error);
                    setStatus('error');
                    addToast("Import failed", "error");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-background p-8 w-full max-w-md border border-foreground/10 dark:border-background/10">
                <h2 className="text-xl font-serif mb-6">Import Products (CSV)</h2>
                <input type="file" accept=".csv" onChange={handleFileChange} className="mb-4 w-full" />
                
                {status === 'idle' && (
                    <button onClick={handleImport} disabled={!file} className="w-full h-12 bg-primary text-background dark:bg-background dark:text-foreground disabled:opacity-50">
                        Import
                    </button>
                )}
                
                {loading && (
                    <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="animate-spin w-4 h-4" />
                        <span>{status === 'parsing' ? 'Parsing CSV...' : status === 'mapping' ? 'Mapping with AI...' : 'Uploading...'}</span>
                    </div>
                )}
                
                <button onClick={onClose} className="mt-4 w-full text-xs opacity-60">Cancel</button>
            </div>
        </div>
    );
};
