import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Filter, RotateCcw, Check, Star } from 'lucide-react';
import { Category } from '../types';

// FIX #1: Footer gains safe-area-inset-bottom so Apply/Reset buttons
// don't sit behind the iOS home indicator.
// FIX #2: Color labels changed from opacity-0/group-hover:opacity-100
// (invisible on touch devices) to always-visible on mobile,
// hidden-on-hover only on sm+ (pointer: fine) screens.

interface FilterSidebarProps {
 isOpen: boolean;
 onClose: () => void;
 categories: Category[];
 onFilterChange: (filters: any) => void;
 activeFilters: any;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
 isOpen,
 onClose,
 categories,
 onFilterChange,
 activeFilters
}) => {
 const [priceRange, setPriceRange] = useState<[number, number]>(activeFilters.priceRange || [0, 5000000]);
 const [selectedCategories, setSelectedCategories] = useState<string[]>(activeFilters.categories || []);
 const [selectedMaterials, setSelectedMaterials] = useState<string[]>(activeFilters.materials || []);
 const [selectedColors, setSelectedColors] = useState<string[]>(activeFilters.colors || []);
 const [selectedSizes, setSelectedSizes] = useState<string[]>(activeFilters.sizes || []);
 const [location, setLocation] = useState<string>(activeFilters.location || '');
 const [rating, setRating] = useState<number | null>(activeFilters.rating || null);
 const [verified, setVerified] = useState<boolean>(activeFilters.verified || false);
 const [stock, setStock] = useState<boolean>(activeFilters.stock || false);

 const materials = ["Ebony", "Cotton", "Leather", "Wood", "Metal", "Beads", "Clay"];
 const colors = ["Black", "Brown", "White", "Red", "Blue", "Green", "Gold", "Silver"];
 const sizes = ["Small", "Medium", "Large", "Extra Large", "Custom"];

 const handleReset = () => {
 setPriceRange([0, 5000000]);
 setSelectedCategories([]);
 setSelectedMaterials([]);
 setSelectedColors([]);
 setSelectedSizes([]);
 setLocation('');
 setRating(null);
 setVerified(false);
 setStock(false);
 onFilterChange({
 priceRange: [0, 5000000],
 categories: [],
 materials: [],
 colors: [],
 sizes: [],
 location: '',
 rating: null,
 verified: false,
 stock: false
 });
 };

 const handleApply = () => {
 onFilterChange({
 priceRange,
 categories: selectedCategories,
 materials: selectedMaterials,
 colors: selectedColors,
 sizes: selectedSizes,
 location,
 rating,
 verified,
 stock
 });
 onClose();
 };

 const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
 if (list.includes(item)) {
 setList(list.filter(i => i !== item));
 } else {
 setList([...list, item]);
 }
 };

 return (
 <AnimatePresence>
 {isOpen && (
 <>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={onClose}
 className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
 />
 <motion.div
 initial={{ x: '100%' }}
 animate={{ x: 0 }}
 exit={{ x: '100%' }}
 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
 className="fixed top-0 right-0 h-full w-full max-w-md bg-background dark:bg-background shadow-2xl z-[101] flex flex-col"
 >
 <div className="p-6 border-b border-foreground/10 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Filter className="w-5 h-5" />
 <h2 className="font-serif text-2xl">Advanced Filters</h2>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-foreground/[0.04] rounded-full transition-colors">
 <X className="w-6 h-6" />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-6 space-y-8">
 {/* Price Range */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-6 opacity-50">Price Range (TZS)</h3>
 <div className="space-y-4">
 <div className="flex items-center justify-between text-sm font-mono">
 <span>{priceRange[0].toLocaleString()}</span>
 <span>{priceRange[1].toLocaleString()}</span>
 </div>
 <input
 type="range"
 min="0"
 max="5000000"
 step="10000"
 value={priceRange[1]}
 onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
 className="w-full accent-foreground dark:accent-background"
 />
 </div>
 </section>

 {/* Categories */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Categories</h3>
 <div className="grid grid-cols-2 gap-2">
 {categories.map(cat => (
 <button
 key={cat.id}
 onClick={() => toggleItem(selectedCategories, setSelectedCategories, cat.id)}
 className={`px-4 py-2 text-xs text-left border transition-all ${selectedCategories.includes(cat.id) ? 'bg-primary text-background border-foreground dark:bg-background dark:text-foreground dark:border-background' : 'border-foreground/10 hover:border-foreground/30 dark:hover:border-background/30'}`}
 >
 {cat.name}
 </button>
 ))}
 </div>
 </section>

 {/* Materials */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Materials</h3>
 <div className="flex flex-wrap gap-2">
 {materials.map(material => (
 <button
 key={material}
 onClick={() => toggleItem(selectedMaterials, setSelectedMaterials, material)}
 className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] border rounded-full transition-all ${selectedMaterials.includes(material) ? 'bg-primary text-background border-foreground dark:bg-background dark:text-foreground dark:border-background' : 'border-foreground/10'}`}
 >
 {material}
 </button>
 ))}
 </div>
 </section>

 {/* Colors */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Colors</h3>
 <div className="flex flex-wrap gap-3">
 {colors.map(color => (
 <button
 key={color}
 onClick={() => toggleItem(selectedColors, setSelectedColors, color)}
 className="group flex flex-col items-center gap-1.5"
 aria-label={color}
 aria-pressed={selectedColors.includes(color)}
 >
 <div
 className={`w-8 h-8 rounded-full border border-foreground/10 flex items-center justify-center transition-all ${selectedColors.includes(color) ? 'ring-2 ring-foreground dark:ring-background ring-offset-2 dark:ring-offset-background' : ''}`}
 style={{ backgroundColor: color.toLowerCase() }}
 >
 {selectedColors.includes(color) && (
 <Check className={`w-4 h-4 ${color.toLowerCase() === 'white' ? 'text-black' : 'text-white'}`} />
 )}
 </div>
 {/* FIX #2: Always visible on mobile (touch), fade-in on hover for pointer devices */}
 <span className="text-[8px] uppercase tracking-[0.1em] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
 {color}
 </span>
 </button>
 ))}
 </div>
 </section>

 {/* Sizes */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Sizes</h3>
 <div className="space-y-2">
 {sizes.map(size => (
 <label key={size} className="flex items-center gap-3 cursor-pointer group">
 <div
 onClick={() => toggleItem(selectedSizes, setSelectedSizes, size)}
 className={`w-5 h-5 border flex items-center justify-center transition-all ${selectedSizes.includes(size) ? 'bg-primary border-foreground dark:bg-background dark:border-background' : 'border-foreground/20 group-hover:border-foreground/50 dark:group-hover:border-background/50'}`}
 >
 {selectedSizes.includes(size) && <Check className="w-3 h-3 text-background dark:text-foreground" />}
 </div>
 <span className="text-sm font-light">{size}</span>
 </label>
 ))}
 </div>
 </section>

 {/* Location */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Location</h3>
 <input
 type="text"
 placeholder="e.g. Dar es Salaam"
 value={location}
 onChange={(e) => setLocation(e.target.value)}
 className="w-full h-12 bg-foreground/[0.04] border border-foreground/10 rounded-xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/40"
 />
 </section>

 {/* Rating */}
 <section>
 <h3 className="text-xs uppercase tracking-[0.2em] font-bold mb-4 opacity-50">Minimum Rating</h3>
 <div className="flex gap-2">
 {[1, 2, 3, 4, 5].map((star) => (
 <button
 key={star}
 onClick={() => setRating(star === rating ? null : star)}
 className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${rating && star <= rating ? 'bg-primary text-background border-foreground dark:bg-background dark:text-foreground dark:border-background' : 'border-foreground/10'}`}
 >
 <Star className={`w-4 h-4 ${rating && star <= rating ? 'fill-current' : ''}`} />
 </button>
 ))}
 </div>
 </section>

 {/* Toggles */}
 <section className="space-y-4">
 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-xs uppercase tracking-[0.1em] font-bold opacity-50">Verified Sellers Only</span>
 <div
 onClick={() => setVerified(!verified)}
 className={`w-12 h-6 rounded-full transition-all relative ${verified ? 'bg-emerald-500' : 'bg-primary/20 dark:bg-background/20'}`}
 >
 <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${verified ? 'translate-x-6' : ''}`} />
 </div>
 </label>
 <label className="flex items-center justify-between cursor-pointer group">
 <span className="text-xs uppercase tracking-[0.1em] font-bold opacity-50">In Stock Only</span>
 <div
 onClick={() => setStock(!stock)}
 className={`w-12 h-6 rounded-full transition-all relative ${stock ? 'bg-foreground' : 'bg-primary/20 dark:bg-background/20'}`}
 >
 <div className={`absolute top-1 left-1 w-4 h-4 bg-white dark:bg-background rounded-full transition-transform ${stock ? 'translate-x-6' : ''}`} />
 </div>
 </label>
 </section>
 </div>

 {/* FIX #1: Footer with safe-area-inset-bottom padding */}
 <div
 className="px-6 pt-6 border-t border-foreground/10 grid grid-cols-2 gap-4"
 style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
 >
 <button
 onClick={handleReset}
 className="flex items-center justify-center gap-2 px-6 py-4 border border-foreground/20 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] transition-colors"
 >
 <RotateCcw className="w-3 h-3" /> Reset
 </button>
 <button
 onClick={handleApply}
 className="px-6 py-4 bg-primary text-background dark:bg-background dark:text-foreground text-[10px] uppercase tracking-[0.2em] font-bold hover:opacity-90 transition-opacity shadow-lg"
 >
 Apply Filters
 </button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
};
