import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ArrowRight, Sparkles, ShoppingBag, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppState } from '../context/AppContext';

export const CategoriesPage = () => {
    const { categories } = useAppState();

    // Group categories if they have parent_id, otherwise treat as top-level
    const organizedCategories = useMemo(() => {
        const topLevel = categories.filter(c => !c.parent_id);
        const children = categories.filter(c => c.parent_id);

        return topLevel.map(parent => ({
            ...parent,
            subcategories: children.filter(child => child.parent_id === parent.id)
        }));
    }, [categories]);

    // Fallback if no categories are found in DB yet
    const displayCategories = organizedCategories.length > 0 ? organizedCategories : [];

    return (
        <div className="min-h-screen bg-background dark:bg-background pt-32 pb-24 px-6">
            <div className="container mx-auto max-w-7xl">
                {/* Header Section */}
                <div className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.8 }}
                        >
                            <span className="text-[10px] uppercase tracking-[0.4em] text-foreground/40 dark:text-background/40 font-semibold mb-4 block">
                                Curated Collections
                            </span>
                            <h1 className="text-6xl md:text-8xl font-serif font-light tracking-tight text-foreground dark:text-background leading-[0.9]">
                                Explore <br />
                                <span className="italic opacity-80">Our Universe</span>
                            </h1>
                        </motion.div>
                    </div>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="text-lg text-foreground/60 dark:text-background/60 font-light max-w-sm leading-relaxed"
                    >
                        From heritage craftsmanship to modern essentials, discover the finest selection of authentic Tanzanian products.
                    </motion.p>
                </div>

                {/* Featured Categories Grid */}
                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.1 }
                        }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12"
                >
                    {displayCategories.map((category, index) => (
                        <motion.div
                            key={category.id}
                            variants={{
                                hidden: { opacity: 0, y: 30 },
                                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
                            }}
                            className="group relative"
                        >
                            {/* Category Card */}
                            <div className="relative aspect-[4/5] overflow-hidden bg-primary/5 dark:bg-background/5 mb-8">
                                <img 
                                    src={category.image_url || `https://picsum.photos/seed/${category.name}/800/1000`} 
                                    alt={category.name}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale-[0.5] group-hover:grayscale-0"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                {/* Floating Badge */}
                                <div className="absolute top-6 left-6">
                                    <div className="w-10 h-10 rounded-full bg-background/90 dark:bg-background/90 backdrop-blur-md flex items-center justify-center text-foreground dark:text-background shadow-xl">
                                        {index % 3 === 0 ? <Sparkles className="w-4 h-4" /> : index % 3 === 1 ? <Zap className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                                    </div>
                                </div>

                                {/* Quick View Overlay */}
                                <div className="absolute bottom-8 left-8 right-8 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                    <Link 
                                        to={`/shop?category=${encodeURIComponent(category.name)}`}
                                        className="w-full py-4 bg-background text-foreground text-[10px] uppercase tracking-[0.3em] font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-background transition-colors"
                                    >
                                        Explore Collection <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>

                            {/* Category Info */}
                            <div className="space-y-6">
                                <div className="flex items-end justify-between">
                                    <h3 className="text-3xl font-serif font-light text-foreground dark:text-background">
                                        {category.name}
                                    </h3>
                                    <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">
                                        {category.subcategories.length > 0 ? `${category.subcategories.length} Styles` : 'New Arrival'}
                                    </span>
                                </div>

                                {category.subcategories.length > 0 && (
                                    <motion.div 
                                        initial="hidden"
                                        whileInView="visible"
                                        viewport={{ once: true }}
                                        variants={{
                                            hidden: { opacity: 0 },
                                            visible: {
                                                opacity: 1,
                                                transition: { staggerChildren: 0.05 }
                                            }
                                        }}
                                        className="flex flex-wrap gap-2"
                                    >
                                        {category.subcategories.slice(0, 4).map(sub => (
                                            <motion.div
                                                key={sub.id}
                                                variants={{
                                                    hidden: { opacity: 0, scale: 0.9 },
                                                    visible: { opacity: 1, scale: 1 }
                                                }}
                                            >
                                                <Link 
                                                    to={`/shop?category=${encodeURIComponent(sub.name)}`}
                                                    className="px-4 py-2 border border-foreground/10 dark:border-background/10 text-[10px] uppercase tracking-widest text-foreground/60 dark:text-background/60 hover:border-foreground hover:text-foreground dark:hover:border-background dark:hover:text-background transition-all"
                                                >
                                                    {sub.name}
                                                </Link>
                                            </motion.div>
                                        ))}
                                        {category.subcategories.length > 4 && (
                                            <motion.span 
                                                variants={{
                                                    hidden: { opacity: 0 },
                                                    visible: { opacity: 1 }
                                                }}
                                                className="px-4 py-2 text-[10px] uppercase tracking-widest opacity-30 italic"
                                            >
                                                + {category.subcategories.length - 4} more
                                            </motion.span>
                                        )}
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Bottom CTA */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-32 pt-24 border-t border-foreground/10 dark:border-background/10 text-center"
                >
                    <h2 className="text-4xl md:text-6xl font-serif font-light text-foreground dark:text-background mb-12">
                        Can't find what you're <br />
                        <span className="italic opacity-80">looking for?</span>
                    </h2>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                        <Link 
                            to="/shop"
                            className="px-12 py-5 bg-primary text-background dark:bg-background dark:text-foreground text-[11px] uppercase tracking-[0.3em] font-bold hover:opacity-80 transition-opacity"
                        >
                            View All Catalog
                        </Link>
                        <Link 
                            to="/about"
                            className="px-12 py-5 border border-foreground dark:border-background text-foreground dark:text-background text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground transition-all"
                        >
                            Learn Our Process
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
