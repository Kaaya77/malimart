export type ExploreTab = 'categories' | 'stores' | 'trending' | 'deals';
export type TrendSubTab = 'hot' | 'new' | 'rated';

export const CATEGORY_IMAGES: Record<string, string> = {
  'Fashion & Beauty':    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
  'Pantry & Spices':     'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
  'Handicrafts':         'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&q=80&w=800',
  'Electronics':         'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=800',
  'Home & Living':       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
  'Agriculture':         'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=800',
  'Construction':        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=800',
  'Kids & Toys':         'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&q=80&w=800',
  'Vehicles':            'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800',
  'Books & Stationery':  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800',
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  'Fashion & Beauty': '👗', 'Pantry & Spices': '🌶️', 'Handicrafts': '🪵',
  'Electronics': '📱', 'Home & Living': '🏠', 'Agriculture': '🌾',
  'Construction': '🏗️', 'Kids & Toys': '🧸', 'Vehicles': '🚗', 'Books & Stationery': '📚',
};
