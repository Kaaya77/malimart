import {
  Tag, Shirt, Sparkles, HeartPulse, Cpu, ShoppingBasket, Soup, Sofa,
  Palette, Sprout, BookOpen, Dumbbell, ToyBrick, Car, Wrench, HardHat,
} from 'lucide-react';
import type { ElementType } from 'react';

/**
 * One flat icon + accent color per category name, shared by CategoryStrip
 * (homepage) and the merged Shop page's category chip rail. Previously each
 * surface kept its own map — CategoryStrip its own Unsplash-URL map, the old
 * CategoriesPage its own emoji/photo maps (categoryConstants.ts) — three
 * independently-maintained sources of "what does this category look like"
 * that inevitably drifted. One map now; the icon-tile visual language it
 * backs was chosen deliberately over photography (see CategoryStrip's
 * docstring) so this file carries no image URLs to keep in sync with DB
 * category names in the first place.
 */
export const CATEGORY_META: Record<string, { icon: ElementType; color: string }> = {
  'Fashion':                 { icon: Shirt, color: '#e879a0' },
  'Fashion & Beauty':        { icon: Shirt, color: '#e879a0' },
  'Beauty':                  { icon: Sparkles, color: '#f472b6' },
  'Health & Beauty':         { icon: HeartPulse, color: '#fb7185' },
  'Electronics':             { icon: Cpu, color: '#38bdf8' },
  'Food & Groceries':        { icon: ShoppingBasket, color: '#fb923c' },
  'Food & Pantry':           { icon: ShoppingBasket, color: '#fb923c' },
  'Pantry & Spices':         { icon: Soup, color: '#f59e0b' },
  'Home & Living':           { icon: Sofa, color: '#34d399' },
  'Crafts & Art':            { icon: Palette, color: '#a78bfa' },
  'Handicrafts':             { icon: Palette, color: '#a78bfa' },
  'Handicrafts & Products':  { icon: Palette, color: '#a78bfa' },
  'Agriculture':             { icon: Sprout, color: '#4ade80' },
  'Books':                   { icon: BookOpen, color: '#60a5fa' },
  'Books & Education':       { icon: BookOpen, color: '#818cf8' },
  'Books & Stationery':      { icon: BookOpen, color: '#60a5fa' },
  'Sports':                  { icon: Dumbbell, color: '#f97316' },
  'Sports & Outdoors':       { icon: Dumbbell, color: '#22d3ee' },
  'Toys & Kids':             { icon: ToyBrick, color: '#f43f5e' },
  'Kids & Toys':             { icon: ToyBrick, color: '#f43f5e' },
  'Vehicles & Parts':        { icon: Car, color: '#64748b' },
  'Vehicles':                { icon: Car, color: '#64748b' },
  'Services':                { icon: Wrench, color: '#0ea5e9' },
  'Construction':            { icon: HardHat, color: '#eab308' },
  'Construction & Hardware': { icon: HardHat, color: '#eab308' },
};

export const CATEGORY_FALLBACK: { icon: ElementType; color: string } = { icon: Tag, color: '#10b981' };

export const categoryMeta = (name: string) => CATEGORY_META[name] || CATEGORY_FALLBACK;
