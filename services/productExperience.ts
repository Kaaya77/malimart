/**
 * Product Experience System
 * Maps product categories and user actions to fun emoji, colors,
 * celebration messages, and avatar emotes for personalized moments.
 */

export type ProductCategory = string;
export type ActionType =
  | 'add_to_cart'
  | 'purchase'
  | 'list_product'
  | 'stock_update'
  | 'product_view'
  | 'search'
  | 'wishlist'
  | 'share'
  | 'review';

// Category → experience mapping
const CATEGORY_VIBES: Record<string, {
  emoji: string[];
  color: string;
  gradient: string;
  tagline: string[];
  celebrationMsg: string[];
}> = {
  'Electronics': {
    emoji: ['⚡','📱','💻','🎮','🔋'],
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    tagline: ['Powering up!', 'Wired in!', 'Charge it up!'],
    celebrationMsg: ['Tech secured! ⚡', 'Plugged in! 🔌', 'You just leveled up! 🎮'],
  },
  'Fashion': {
    emoji: ['👗','👟','💄','👜','🧣'],
    color: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    tagline: ['Looking fresh!', 'Style secured!', 'Drip incoming!'],
    celebrationMsg: ['Slay! 💅', 'Style unlocked! 👗', 'Outfit secured! ✨'],
  },
  'Food & Grocery': {
    emoji: ['🍎','🥑','🍊','🫐','🌿'],
    color: 'green',
    gradient: 'from-green-500 to-emerald-600',
    tagline: ['Yummy!', 'Fresh pick!', 'Eating good!'],
    celebrationMsg: ['Feast incoming! 🍽️', 'Bon appétit! 🍎', 'Foodie vibes! 🌿'],
  },
  'Beauty': {
    emoji: ['💄','🧴','✨','💅','🪞'],
    color: 'purple',
    gradient: 'from-purple-500 to-fuchsia-500',
    tagline: ['Glowing up!', 'Self-care unlocked!', 'Beauty secured!'],
    celebrationMsg: ['Glow up! ✨', 'Self-care mode: ON! 💆', 'Beautiful choice! 💄'],
  },
  'Home & Living': {
    emoji: ['🏡','🪴','🛋️','🕯️','🧹'],
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    tagline: ['Home sweet home!', 'Cozy vibes!', 'Nesting mode!'],
    celebrationMsg: ['Home upgrade! 🏡', 'Cozy secured! 🛋️', 'Interior goals! 🪴'],
  },
  'Sports': {
    emoji: ['⚽','🏋️','🚴','🏃','🥊'],
    color: 'orange',
    gradient: 'from-orange-500 to-red-500',
    tagline: ['Game on!', 'Beast mode!', 'Get moving!'],
    celebrationMsg: ['Champion move! 🏆', 'Beast mode activated! 💪', 'Go get it! 🏃'],
  },
  'Books & Education': {
    emoji: ['📚','🎓','📝','🔭','🧠'],
    color: 'teal',
    gradient: 'from-teal-500 to-cyan-600',
    tagline: ['Knowledge unlocked!', 'Leveling up!', 'Big brain energy!'],
    celebrationMsg: ['Wisdom secured! 📚', 'Big brain move! 🧠', 'Knowledge is power! 🎓'],
  },
  'Toys & Kids': {
    emoji: ['🧸','🎨','🎡','🪀','🎪'],
    color: 'yellow',
    gradient: 'from-yellow-400 to-orange-400',
    tagline: ['Playful!', 'Fun incoming!', 'Adventure awaits!'],
    celebrationMsg: ['Playtime! 🎉', 'Fun secured! 🎨', 'Adventure awaits! 🧸'],
  },
  'Art & Crafts': {
    emoji: ['🎨','✏️','🖼️','🧵','🪡'],
    color: 'rose',
    gradient: 'from-rose-400 to-pink-500',
    tagline: ['Masterpiece incoming!', 'Create magic!', 'Artist mode!'],
    celebrationMsg: ['Masterpiece! 🎨', 'Create something beautiful! ✏️', 'Artist secured! 🖼️'],
  },
  'Health & Wellness': {
    emoji: ['💊','🧘','🫁','💪','🌱'],
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-500',
    tagline: ['Healthy choice!', 'Wellness unlocked!', 'Self-care!'],
    celebrationMsg: ['Healthy choice! 💪', 'Wellness secured! 🌱', 'Feel-good pick! 🧘'],
  },
};

const DEFAULT_VIBE = {
  emoji: ['🛍️','✨','🎁','💫','🌟'],
  color: 'emerald',
  gradient: 'from-emerald-500 to-teal-500',
  tagline: ['Great pick!', 'Nice find!', 'Love it!'],
  celebrationMsg: ['Added! ✨', 'Great choice! 🛍️', 'MaliMart delivers! 🌟'],
};

const ACTION_EMOTES: Record<ActionType, string> = {
  add_to_cart: 'excited',
  purchase:    'dancing',
  list_product: 'love',
  stock_update: 'happy',
  product_view: 'idle',
  search:      'thinking',
  wishlist:    'love',
  share:       'waving',
  review:      'cool',
};

const ACTION_SOUNDS: Record<ActionType, string[]> = {
  add_to_cart:  ['Boom! 🛍️', 'Yoink! ✨', 'In the bag! 🎁', 'Grabbed it! 🔥'],
  purchase:     ['Kachow! 💸', 'Order placed! 🎊', 'Poa sana! 🇹🇿', 'That\'s a W! 🏆'],
  list_product: ['Listed! 🚀', 'You\'re a merchant! 💼', 'Open for business! 🏪'],
  stock_update: ['Updated! 📦', 'Stock secured! ✅', 'Numbers locked! 🔢'],
  product_view: ['Nice taste! 👀', 'Checking it out! 🔍'],
  search:       ['Searching...', 'On the hunt! 🔍'],
  wishlist:     ['Saved! 💖', 'On the list! ✨', 'Future purchase! 🔮'],
  share:        ['Shared! 📣', 'Spreading the love! 💌'],
  review:       ['Review time! ⭐', 'Your opinion matters! 💬'],
};

function getVibe(category?: string) {
  if (!category) return DEFAULT_VIBE;
  const key = Object.keys(CATEGORY_VIBES).find(k =>
    category.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(category.toLowerCase())
  );
  return key ? CATEGORY_VIBES[key] : DEFAULT_VIBE;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getCategoryEmoji(category?: string): string {
  return pick(getVibe(category).emoji);
}

export function getCategoryGradient(category?: string): string {
  return getVibe(category).gradient;
}

export function getCategoryColor(category?: string): string {
  return getVibe(category).color;
}

export function getActionMessage(action: ActionType, category?: string): string {
  const actionMsg = pick(ACTION_SOUNDS[action]);
  const vibe = getVibe(category);
  if (action === 'add_to_cart' || action === 'purchase') {
    return Math.random() > 0.5 ? actionMsg : pick(vibe.celebrationMsg);
  }
  return actionMsg;
}

export function getActionEmote(action: ActionType): string {
  return ACTION_EMOTES[action] || 'idle';
}

export function getTagline(category?: string): string {
  return pick(getVibe(category).tagline);
}

// Generates floating emoji particles for a given category
export function getCategoryParticles(category?: string): string[] {
  const vibe = getVibe(category);
  return [...vibe.emoji, ...DEFAULT_VIBE.emoji.slice(0, 2)];
}

// Returns a random fun fact / tip based on category
const CATEGORY_TIPS: Record<string, string[]> = {
  'Electronics': ['Charge fully before first use! ⚡', 'Check the warranty! 🛡️'],
  'Fashion':     ['Check the size guide! 📏', 'Pair with confidence! 💃'],
  'Food & Grocery': ['Fresh from local farms! 🌿', 'Store in a cool place! ❄️'],
  'Beauty':      ['Patch test first! 🧪', 'Less is more! ✨'],
};

export function getCategoryTip(category?: string): string | null {
  if (!category) return null;
  const key = Object.keys(CATEGORY_TIPS).find(k =>
    category.toLowerCase().includes(k.toLowerCase())
  );
  if (!key) return null;
  return pick(CATEGORY_TIPS[key]);
}
