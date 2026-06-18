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
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-10">
      {/* Slim back bar */}
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <button
          onClick={() => navigate(backUrl)}
          className="group inline-flex items-center gap-2 h-10 pl-2 pr-4 rounded-xl text-sm font-semibold text-foreground/55 hover:text-foreground hover:bg-foreground/[0.05] transition-all my-4"
        >
          <span className="w-7 h-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center group-hover:bg-foreground/[0.1] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </span>
          Back to inventory
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="container mx-auto max-w-3xl px-4 md:px-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-foreground/[0.04] animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}

      {/* Form — rendered inline (no modal overhead) */}
      {!loading && (
        <ProductForm
          mode="page"
          initialData={isNew ? null : product}
          onClose={() => navigate(backUrl)}
          onSuccess={() => {
            refreshProducts();
            navigate(backUrl);
          }}
        />
      )}
    </div>
  );
};
