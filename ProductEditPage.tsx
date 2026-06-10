/**
 * ProductEditPage — full-page wrapper for ProductForm
 * Routes: /seller/products/new  →  create
 *         /seller/products/:id/edit  →  edit existing
 *
 * Navigates back to /seller?tab=products on save or cancel,
 * preserving the inventory scroll position via browser history.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { ProductForm } from '../components/ProductForm';
import { supabase } from '../services/supabaseClient';

export const ProductEditPage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user, refreshProducts } = useAppState();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(!!id);

  const isNew = !id;
  const backUrl = '/seller?tab=products';

  useEffect(() => {
    if (!id) return;
    supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .eq('seller_id', user?.id ?? '')
      .single()
      .then(({ data, error }) => {
        if (error || !data) navigate(backUrl, { replace: true });
        else setProduct(data);
        setLoading(false);
      });
  }, [id]);

  if (!user || user.role !== 'seller') {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div
      className="min-h-screen pt-20 md:pt-24 pb-16"
      style={{ background: 'linear-gradient(180deg, #080b12 0%, #0b0e17 100%)' }}
    >
      <div className="container mx-auto max-w-5xl px-4 md:px-6">

        {/* Header */}
        <div className="flex items-center gap-4 py-6">
          <button
            onClick={() => navigate(backUrl)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: 'rgba(245,158,11,0.65)' }}>
              {isNew ? 'New Product' : 'Edit Product'}
            </p>
            <h1 className="text-xl font-black" style={{ color: '#fff' }}>
              {isNew ? 'Add to Inventory' : (loading ? 'Loading…' : product?.name ?? 'Edit Product')}
            </h1>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)', animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {/* Form — rendered inline (no modal overhead) */}
        {!loading && (
          <ProductForm
            initialData={isNew ? null : product}
            onClose={() => navigate(backUrl)}
            onSuccess={() => {
              refreshProducts();
              navigate(backUrl);
            }}
          />
        )}
      </div>
    </div>
  );
};
