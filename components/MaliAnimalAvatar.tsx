import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AnimalType = 'fox' | 'cat' | 'panda' | 'bunny' | 'bear' | 'lion' | 'owl' | 'parrot';
// EmoteType is derived from the EMOTES registry below — add an entry there
// and every consumer (including the AI's emote vocabulary) picks it up.
export type EmoteType = keyof typeof EMOTES;

export const ANIMALS: Record<AnimalType, { emoji: string; name: string; gradient: string; accent: string }> = {
  fox:    { emoji: '🦊', name: 'Hadithi',  gradient: 'from-orange-400 via-red-400 to-orange-600',   accent: 'orange' },
  cat:    { emoji: '🐱', name: 'Paka',     gradient: 'from-violet-400 via-purple-400 to-indigo-500', accent: 'purple' },
  panda:  { emoji: '🐼', name: 'Nguvu',    gradient: 'from-slate-300 via-gray-400 to-slate-600',     accent: 'slate'  },
  bunny:  { emoji: '🐇', name: 'Haraka',   gradient: 'from-pink-300 via-rose-400 to-pink-500',       accent: 'pink'   },
  bear:   { emoji: '🐻', name: 'Simba',    gradient: 'from-amber-500 via-orange-500 to-amber-700',   accent: 'amber'  },
  lion:   { emoji: '🦁', name: 'Mfalme',   gradient: 'from-yellow-400 via-amber-400 to-yellow-600',  accent: 'yellow' },
  owl:    { emoji: '🦉', name: 'Akili',    gradient: 'from-teal-400 via-cyan-400 to-teal-600',       accent: 'teal'   },
  parrot: { emoji: '🐦', name: 'Kelele',   gradient: 'from-emerald-400 via-green-400 to-teal-500',   accent: 'emerald'},
};

// Motion presets for the avatar container while an emote plays
const POP    = { scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] };
const BOUNCE = { y: [0, -5, 0], scale: [1, 1.06, 1] };
const WIGGLE = { rotate: [0, -8, 8, -4, 0] };
const ZOOM   = { scale: [1, 1.25, 0.95, 1] };
const SHAKE  = { x: [-3, 3, -3, 3, 0] };
const e = (overlay: string, label: string, animation: object = POP) => ({ overlay, animation, label });

// Every overlay below is verified available as a Google Noto ANIMATED emoji
// (checked against fonts.gstatic.com) except 🇹🇿, which falls back to a glyph.
const EMOTES = {
  // ── Core (hand-tuned motion) ──────────────────────────────────────────────
  idle:        { overlay: '',   animation: {}, label: '' },
  happy:       e('😊', 'Happy!', WIGGLE),
  thinking:    e('🤔', 'Thinking…', BOUNCE),
  excited:     e('🤩', 'Woah!', ZOOM),
  surprised:   e('😲', 'Whoa!', ZOOM),
  love:        e('😍', 'Love it!', BOUNCE),
  sleeping:    e('😴', 'Zzzz…', { rotate: [0, 3, -3, 0] }),
  dancing:     e('💃', 'Yay!', { x: [-4, 4, -4], rotate: [-5, 5, -5] }),
  waving:      e('👋', 'Hi!', { rotate: [0, 15, -5, 15, 0] }),
  cool:        e('😎', 'Cool!'),
  sad:         e('😢', 'Oops…', { y: [0, 3, 0], rotate: [-3, 3, -3] }),
  searching:   e('🧐', 'Searching…', SHAKE),
  lightbulb:   e('💡', 'Aha!', { scale: [1, 1.3, 1], y: [0, -6, 0] }),
  catalog:     e('👀', 'Checking…', WIGGLE),
  gifting:     e('🎁', 'Gift!'),
  mindblown:   e('🤯', 'Mind blown!', ZOOM),
  facepalm:    e('😅', 'Oops!', BOUNCE),
  shrug:       e('😕', 'Dunno!', WIGGLE),
  heartEyes:   e('😻', 'In love!'),
  clapping:    e('👏', 'Bravo!'),
  sleepy:      e('😪', 'Late night…', BOUNCE),
  shy:         e('🙈', 'Aw shucks!', { scale: [1, 0.9, 1], rotate: [-8, 0] }),
  flexing:     e('💪', 'Got you!'),
  celebrating: e('🎉', 'Woohoo!', ZOOM),
  tanzanian:   e('🇹🇿', 'Tanzanian pride!', BOUNCE),
  counting:    e('🪙', 'Counting coins…', WIGGLE),
  // ── Joy & laughter ────────────────────────────────────────────────────────
  grin:        e('😀', 'Heee!'),          beam:        e('😄', 'So good!'),
  laugh:       e('😆', 'Haha!', WIGGLE),  joy:         e('😂', 'Dying! 😂', WIGGLE),
  rofl:        e('🤣', "Can't breathe!", WIGGLE), wink: e('😉', 'You know it 😉'),
  angel:       e('😇', 'Innocent!', BOUNCE), smitten:  e('🥰', 'Adorable!', BOUNCE),
  yum:         e('😋', 'Tamu sana!'),     tongueOut:   e('😛', 'Bleh!'),
  playful:     e('😜', 'Just playing!'),  zany:        e('🤪', 'Wild!', ZOOM),
  giggle:      e('🤭', 'Hehe…', BOUNCE),  hug:         e('🤗', 'Big hug!', BOUNCE),
  // ── Money & deals ─────────────────────────────────────────────────────────
  moneyFace:   e('🤑', 'Deal alert!', ZOOM), gem:      e('💎', 'Premium!', BOUNCE),
  fire:        e('🔥', 'Hot deal!', ZOOM),   bullseye: e('🎯', 'Perfect match!'),
  trophy:      e('🏆', 'Winner!', BOUNCE),   goldMedal: e('🥇', 'Top pick!', BOUNCE),
  rocket:      e('🚀', 'To the moon!', { y: [0, -8, 0], scale: [1, 1.1, 1] }),
  // ── Reactions ─────────────────────────────────────────────────────────────
  shush:       e('🤫', 'Secret…', BOUNCE), neutral:    e('😐', 'Hmm.'),
  unamused:    e('😒', 'Really?'),         eyeRoll:    e('🙄', 'Oh please…', WIGGLE),
  grimace:     e('😬', 'Yikes!', SHAKE),   relieved:   e('😌', 'Phew!', BOUNCE),
  pensive:     e('😔', 'Thinking it over…'), drool:    e('🤤', 'Want it…', BOUNCE),
  cowboy:      e('🤠', 'Yeehaw!', WIGGLE), partyFace:  e('🥳', 'Party time!', ZOOM),
  disguised:   e('🥸', 'Incognito!'),      worried:    e('😟', 'Hmm, careful…'),
  frowning:    e('🙁', 'Aww…'),            openMouth:  e('😮', 'Oh!', ZOOM),
  hushed:      e('😯', 'Really?!'),        flushed:    e('😳', 'Oh my!', ZOOM),
  pleading:    e('🥺', 'Please?', BOUNCE), fearful:    e('😨', 'Scary!', SHAKE),
  coldSweat:   e('😰', 'Close call!', SHAKE), bawling: e('😭', 'Nooo!', SHAKE),
  screaming:   e('😱', 'WHAT!', ZOOM),     confounded: e('😖', 'Ugh!', SHAKE),
  persevering: e('😣', 'Hang on…'),        disappointed: e('😞', 'Sorry…'),
  downcast:    e('😓', 'My bad…'),         weary:      e('😩', 'So tired…'),
  exhausted:   e('😫', 'Whew!'),           yawning:    e('🥱', 'Sleepy time…', BOUNCE),
  triumphant:  e('😤', 'Nailed it!', ZOOM), enraged:   e('😡', 'Grrr!', SHAKE),
  angry:       e('😠', 'Not cool!', SHAKE), cursing:   e('🤬', '@#$%!', SHAKE),
  smirk:       e('😏', 'I know things…'),  saluting:   e('🫡', 'On it, boss!', BOUNCE),
  melting:     e('🫠', 'Melting…', { y: [0, 4, 0], scale: [1, 0.95, 1] }),
  peeking:     e('🫣', "Can't look!"),     holdingTears: e('🥹', 'So touching…', BOUNCE),
  kissing:     e('😘', 'Mwah!', BOUNCE),   kissingClosed: e('😚', 'Asante!', BOUNCE),
  // ── Sick day / weather ────────────────────────────────────────────────────
  masked:      e('😷', 'Stay safe!'),      fever:      e('🤒', 'Not feeling it…'),
  bandaged:    e('🤕', 'Ouch!'),           nauseated:  e('🤢', 'Eww…', SHAKE),
  sneezing:    e('🤧', 'Achoo!', SHAKE),   overheated: e('🥵', 'So hot!', SHAKE),
  freezing:    e('🥶', 'Brrr!', SHAKE),    woozy:      e('🥴', 'Dizzy…', WIGGLE),
  dizzy:       e('😵', 'Whoa…', WIGGLE),
  // ── Characters ────────────────────────────────────────────────────────────
  devilish:    e('😈', 'Mischief!', WIGGLE), imp:      e('👿', 'Grr!', SHAKE),
  skull:       e('💀', "I'm dead 💀", WIGGLE), stinky: e('💩', 'Oops!', BOUNCE),
  clown:       e('🤡', 'Silly me!', WIGGLE), ghost:    e('👻', 'Boo!', { y: [0, -6, 0], x: [-2, 2, 0] }),
  alien:       e('👽', 'Out of this world!'), robot:   e('🤖', 'Beep boop!', SHAKE),
  // ── Cat moods ─────────────────────────────────────────────────────────────
  catGrin:     e('😺', 'Purrfect!'),       catJoy:     e('😹', 'Hilarious!', WIGGLE),
  catSmile:    e('😸', 'Happy cat!'),      catSmirk:   e('😼', 'Sneaky…'),
  catShock:    e('🙀', 'Gasp!', ZOOM),     catCry:     e('😿', 'Sad kitty…'),
  hearNoEvil:  e('🙉', 'Not listening!'),  speakNoEvil: e('🙊', 'My lips are sealed!'),
  // ── Hearts & sparkle ──────────────────────────────────────────────────────
  redHeart:    e('❤️', 'Love!', BOUNCE),   brokenHeart: e('💔', 'Heartbreak…'),
  sparklingHeart: e('💖', 'Sparkles!', ZOOM), growingHeart: e('💗', 'More love!', ZOOM),
  beatingHeart: e('💓', 'Heartbeat!', { scale: [1, 1.15, 1, 1.15, 1] }),
  twoHearts:   e('💕', 'Double love!', BOUNCE),
  star:        e('⭐', 'Star!', WIGGLE),   glowingStar: e('🌟', 'Shining!', ZOOM),
  dizzyStar:   e('💫', 'Wheee!', WIGGLE),  sparkles:    e('✨', 'Magic!', ZOOM),
  confettiBall: e('🎊', 'Confetti!', ZOOM), balloon:    e('🎈', 'Fun!', { y: [0, -6, 0] }),
  birthday:    e('🎂', 'Celebrate!', BOUNCE), rainbow:  e('🌈', 'Beautiful!', BOUNCE),
  bolt:        e('⚡', 'Fast!', SHAKE),
  // ── Hands ─────────────────────────────────────────────────────────────────
  handshake:   e('🤝', 'Deal!', BOUNCE),   praying:    e('🙏', 'Asante sana!', BOUNCE),
  thumbsUp:    e('👍', 'Approved!'),       thumbsDown: e('👎', 'Skip it.'),
  okHand:      e('👌', 'Perfect!'),        victory:    e('✌️', 'Victory!'),
  crossedFingers: e('🤞', 'Fingers crossed!'), loveYou: e('🤟', 'Love you!'),
  rockOn:      e('🤘', 'Rock on!', WIGGLE), callMe:    e('🤙', 'Call me!', WIGGLE),
  fistBump:    e('✊', 'Respect!', BOUNCE), punch:     e('👊', 'Boom!', ZOOM),
  heartHands:  e('🫶', 'Heart hands!', BOUNCE),
} satisfies Record<string, { overlay: string; animation: object; label: string }>;

// All playable emote names (excludes idle) — the AI picks from this list.
export const EMOTE_KEYS = Object.keys(EMOTES).filter(k => k !== 'idle') as EmoteType[];
export const isEmote = (s: string): s is EmoteType => s in EMOTES;
export const randomEmote = (pool?: readonly EmoteType[]): EmoteType => {
  const src = pool?.length ? pool : EMOTE_KEYS;
  return src[Math.floor(Math.random() * src.length)];
};

// ── Animated 3D emoji (Google Noto Animated Emoji) ───────────────────────────
// Served as animated WebP from fonts.gstatic.com — already covered by the CSP
// img-src and the service worker's google-fonts cache (1-year SWR), so this
// costs zero new dependencies and zero CSP changes. Any emoji Google hasn't
// animated (or a reduced-motion preference) falls back to the plain glyph.
const notoUrl = (emoji: string) => {
  const cps = [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f'); // Noto URLs omit variation selectors
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${cps.join('_')}/512.webp`;
};

// Remember which emoji 404'd so remounts don't re-request broken URLs.
const notoMisses = new Set<string>();
const prefersStill = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const AnimatedEmoji = ({ emoji, size, className = '' }: { emoji: string; size: number; className?: string }) => {
  const [failed, setFailed] = useState(() => prefersStill || notoMisses.has(emoji));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(prefersStill || notoMisses.has(emoji));
    setLoaded(false);
  }, [emoji]);

  if (failed) {
    return (
      <span className={`select-none ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }
  // Glyph sits underneath until the WebP arrives — no blank flash on first load.
  return (
    <span className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}>
      {!loaded && (
        <span aria-hidden style={{ fontSize: size * 0.92, lineHeight: 1, position: 'absolute' }}>
          {emoji}
        </span>
      )}
      <img
        src={notoUrl(emoji)}
        width={size} height={size}
        alt="" aria-hidden draggable={false}
        decoding="async"
        className="pointer-events-none relative"
        style={{ width: size, height: size, objectFit: 'contain', opacity: loaded ? 1 : 0, transition: 'opacity 150ms' }}
        onLoad={() => setLoaded(true)}
        onError={() => { notoMisses.add(emoji); setFailed(true); }}
      />
    </span>
  );
};

const STORAGE_KEY = 'mali_animal';

export function useAnimalAvatar() {
  const [animal, setAnimalState] = useState<AnimalType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as AnimalType;
    return saved && ANIMALS[saved] ? saved : 'fox';
  });

  const setAnimal = useCallback((a: AnimalType) => {
    setAnimalState(a);
    localStorage.setItem(STORAGE_KEY, a);
  }, []);

  return { animal, setAnimal, animalInfo: ANIMALS[animal] };
}

interface MaliAnimalAvatarProps {
  size?: number;
  rings?: boolean;
  pulse?: boolean;
  emote?: EmoteType;
  animal?: AnimalType;
  showEmoteLabel?: boolean;
  className?: string;
}

export const MaliAnimalAvatar = ({
  size = 36,
  rings = false,
  pulse = false,
  emote = 'idle',
  animal: animalProp,
  showEmoteLabel = false,
  className = '',
}: MaliAnimalAvatarProps) => {
  const { animal: storedAnimal } = useAnimalAvatar();
  const animal = animalProp ?? storedAnimal;
  const info = ANIMALS[animal];
  const emoteInfo = EMOTES[emote];
  const br = size * 0.28;

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {rings && [1, 2, 3].map(i => (
        <motion.div key={i}
          className={`absolute inset-0 rounded-[${br}px] border border-current opacity-30`}
          style={{ borderRadius: br, color: info.accent }}
          animate={{ scale: [1, 1.2 + i * 0.12], opacity: [0.4, 0] }}
          transition={{ duration: 1.8, delay: i * 0.4, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${info.gradient} flex items-center justify-center shadow-lg`}
        style={{ borderRadius: br }}
        animate={pulse ? { scale: [1, 1.05, 1] } : (Object.keys(emoteInfo.animation).length > 0 ? emoteInfo.animation as any : undefined)}
        transition={pulse
          ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.6, ease: 'easeInOut' }
        }
      >
        {/* Animal face (3D animated when Noto has it) — fades back while emoting */}
        <motion.div
          style={{ position: 'relative', zIndex: 1 }}
          animate={{ opacity: emote !== 'idle' && emoteInfo.overlay ? 0.18 : 1 }}
          transition={{ duration: 0.25 }}
        >
          <AnimatedEmoji emoji={info.emoji} size={size * 0.62} />
        </motion.div>

        {/* Facial expression — fills the face area when emoting */}
        <AnimatePresence>
          {emote !== 'idle' && emoteInfo.overlay && (
            <motion.div
              key={emote}
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 2 }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              <AnimatedEmoji emoji={emoteInfo.overlay} size={size * 0.66} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-white/15 pointer-events-none" style={{ borderRadius: br, zIndex: 3 }} />
      </motion.div>

      {/* Corner badge for non-face action emotes (👋 waving, 🕺 dancing, etc.)
          kept small so the main face expression is dominant */}

      {/* Emote label */}
      <AnimatePresence>
        {showEmoteLabel && emote !== 'idle' && emoteInfo.label && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.8 }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black whitespace-nowrap text-foreground/60 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded-full border border-foreground/10"
          >
            {emoteInfo.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Confetti burst (reusable) ─────────────────────────────────────────────────
const CONFETTI_COLORS = ['#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6','#ec4899','#14b8a6','#f97316'];

export const MaliConfetti = ({ count = 40 }: { count?: number }) => (
  <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-2 h-2 rounded-sm"
        style={{
          left: `${Math.random() * 100}%`,
          top: '-10px',
          backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          rotate: Math.random() * 360,
        }}
        animate={{
          y: ['0vh', `${80 + Math.random() * 30}vh`],
          x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
          rotate: [0, (Math.random() - 0.5) * 720],
          opacity: [1, 1, 0],
        }}
        transition={{ duration: 2 + Math.random() * 1.5, delay: Math.random() * 0.6, ease: 'easeIn' }}
      />
    ))}
  </div>
);

// ── Animal Picker UI ───────────────────────────────────────────────────────────
interface AnimalPickerProps {
  onClose?: () => void;
}

export const AnimalPicker = ({ onClose }: AnimalPickerProps) => {
  const { animal, setAnimal } = useAnimalAvatar();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      className="bg-background border border-foreground/10 rounded-2xl shadow-xl p-4 w-64"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-3">Choose your companion</p>
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(ANIMALS) as [AnimalType, typeof ANIMALS[AnimalType]][]).map(([key, info]) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.12, y: -2 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { setAnimal(key); onClose?.(); }}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              animal === key
                ? 'bg-emerald-500/15 ring-2 ring-emerald-500/40'
                : 'hover:bg-foreground/5'
            }`}
          >
            <AnimatedEmoji emoji={info.emoji} size={26} />
            <span className="text-[8px] font-bold text-foreground/50">{info.name}</span>
          </motion.button>
        ))}
      </div>
      <p className="text-[9px] text-foreground/30 text-center mt-3">Your Mali companion follows you everywhere ✨</p>
    </motion.div>
  );
};
