import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '../ProductCard';
import { Product } from '../../types';

interface ProductGridSectionProps {
  title: string;
  description: string;
  products: Product[];
  navigate: (path: string) => void;
  setActiveProduct: (product: Product) => void;
}

export const ProductGridSection = ({
  title,
  description,
  products,
  navigate,
  setActiveProduct
}: ProductGridSectionProps) => {
  return (
    <motion.section 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5 }}
        className="py-12 container mx-auto px-4 sm:px-6"
    >
        <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-1">{title}</h2>
                <p className="text-foreground/60 font-medium text-sm md:text-base">{description}</p>
            </div>
            <button onClick={() => navigate('/shop')} className="text-primary font-bold text-sm hover:underline flex items-center gap-1 bg-primary/10 px-4 py-2 rounded-full transition-colors hover:bg-primary/20">
                See all <ArrowRight className="w-4 h-4" />
            </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {products.map((p, index) => (
                <ProductCard key={p.id} product={p} index={index} onClick={() => navigate(`/product/${p.id}`)} onQuickView={() => setActiveProduct(p)} />
            ))}
        </div>
    </motion.section>
  );
};
