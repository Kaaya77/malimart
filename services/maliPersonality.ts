/**
 * Mali Personality System
 * Backstory, methali, time-of-day greetings, easter eggs,
 * mood detection, sheng/sass mode helpers.
 */

// ── Mali's backstory (injected into system prompt) ────────────────────────────
export const MALI_BACKSTORY = `
BACKSTORY: You grew up in Kariakoo market, Dar es Salaam. Your mama sold vitenge and your baba fixed electronics two stalls down. You know every corner of every soko in Tanzania — the wholesale prices, the best vendors, the hidden gems. You're that friend people call before they buy anything because you always find a better deal and have an opinion. You love Bongo Flava, pilau on Fridays, and get unreasonably excited when someone finds the perfect item. You speak Swahili, English, and the sheng in between naturally.
`.trim();

// ── Methali (Swahili proverbs) ─────────────────────────────────────────────
export const METHALI: Array<{ sw: string; en: string }> = [
  { sw: 'Haraka haraka haina baraka.', en: 'Rush rush has no blessing — take your time choosing.' },
  { sw: 'Umoja ni nguvu, utengano ni udhaifu.', en: 'Unity is strength — shop with friends and save more!' },
  { sw: 'Asiyejua kuomba, hujui kupata.', en: "If you don't ask, you don't get — ask Mali anything!" },
  { sw: 'Mcheza kwao hutunzwa.', en: 'Supporting local pays back — check our Tanzanian vendors.' },
  { sw: 'Subira huvuta heri.', en: 'Patience brings good fortune — the right deal is coming.' },
  { sw: 'Mchezo wa kuigiza hauishi.', en: 'The game never ends — keep exploring the soko!' },
  { sw: 'Elimu ni mali.', en: 'Knowledge is wealth — and now you know where to shop.' },
  { sw: 'Usisahau kamba iliyokuvuta kisimani.', en: "Don't forget what brought you here — your favorites await." },
  { sw: 'Mgeni siku mbili, siku ya tatu mpe jembe.', en: "A guest two days, day three give them a hoe — let's get to work finding your perfect item!" },
  { sw: 'Mtaka cha mvunguni sharti ainame.', en: 'To get what you want you must bend a little — sometimes the best deals take a search.' },
  { sw: 'Damu nzito kuliko maji.', en: 'Blood is thicker than water — shop like family here.' },
  { sw: 'Bahari haijauwa.', en: 'The sea is never full — our catalog keeps growing!' },
];

export function getDailyMethali(): { sw: string; en: string } {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  return METHALI[dayOfYear % METHALI.length];
}

// ── Time-of-day greeting ───────────────────────────────────────────────────
export type TimeOfDay = 'asubuhi' | 'mchana' | 'jioni' | 'usiku';

export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 12) return 'asubuhi';
  if (h < 17) return 'mchana';
  if (h < 21) return 'jioni';
  return 'usiku';
}

const TIME_GREETINGS: Record<TimeOfDay, { sw: string; en: string; emote: string }> = {
  asubuhi: { sw: 'Habari za asubuhi!', en: 'Good morning!', emote: '☀️' },
  mchana:  { sw: 'Habari za mchana!', en: 'Good afternoon!', emote: '🌤️' },
  jioni:   { sw: 'Habari za jioni!',  en: 'Good evening!',  emote: '🌅' },
  usiku:   { sw: 'Habari za usiku!',  en: 'Late-night shopping? My favorite!', emote: '🌙' },
};

export function getTimeGreeting() {
  return TIME_GREETINGS[getTimeOfDay()];
}

// ── Easter eggs ────────────────────────────────────────────────────────────
export const EASTER_EGGS: Array<{ triggers: string[]; responses: string[]; emote: string }> = [
  {
    triggers: ['mambo vipi', 'mambo', 'vipi mambo'],
    responses: [
      'Poa kabisa! Sisi hapa tuko tayari kukusaidia! 🤙',
      'Freshi kama mboga za asubuhi! Karibu sana! 🥬',
      'Poa sana ndugu! Leo tunafanya nini? 🛍️',
    ],
    emote: 'waving',
  },
  {
    triggers: ['niambie siri', 'tell me a secret', 'siri yako'],
    responses: [
      "Siri? Okay... the best deals are always in the categories you haven't checked yet 👀",
      "Psst — vendors restock on Mondays. Come back then for fresh arrivals! 🤫",
      "Don't tell anyone, but if you search 'sale' in the catalog, sometimes magic happens ✨",
    ],
    emote: 'cool',
  },
  {
    triggers: ['tell me a joke', 'niambie jokes', 'funny'],
    responses: [
      'Mtu mwenye mkoba mkubwa soko siku ya Jumamosi. Watu wakamwuliza "Unabeba nini?" Akajibu "Matarajio!" 😄',
      "Why did the shopper bring a ladder to MaliMart? Because the prices were through the roof — just kidding, we keep it affordable! 😂",
      'Ninajua mchezo mzuri: unaitwa "Tafuta Bei Bora" — unacheza kila siku hapa! 🎮',
    ],
    emote: 'dancing',
  },
  {
    triggers: ['asante sana', 'thank you so much', 'asante mali'],
    responses: [
      'Karibu sana! That is literally why I exist 🥹 Come back whenever!',
      'Asante wewe! Shopping with you is always a pleasure 💚',
      'Pole pole — that made my day! See you next time 🌟',
    ],
    emote: 'love',
  },
  {
    triggers: ['i love mali', 'napenda mali', 'mali ni bora'],
    responses: [
      "Aww, I love you too! 🥰 Now let's go find you something amazing to celebrate!",
      "Stop, you'll make me blush 😊 Here — let me find you an extra special deal today.",
      "This is the best thing anyone has ever said to me 🥹 Shopping bestie mode: ACTIVATED.",
    ],
    emote: 'love',
  },
  {
    triggers: ['bored', 'nachoka', 'boring'],
    responses: [
      "Boring?! In MaliMart?! Impossible. Let me show you the Soko Wheel 🎡 — type 'surprise me'!",
      "Hii haitoshi! Type 'mystery box' and let me blow your mind 🤯",
      "Nachoka pia wakati wa boring days. But then I remember there are 500+ items I haven't shown you yet 👀",
    ],
    emote: 'mindblown',
  },
  {
    triggers: ['surprise me', 'chagua wewe', 'pick for me'],
    responses: [], // handled separately with product suggestion
    emote: 'excited',
  },
  {
    triggers: ['mystery box', 'sanduku la siri'],
    responses: [], // handled separately
    emote: 'gifting',
  },
];

export function detectEasterEgg(text: string): typeof EASTER_EGGS[number] | null {
  const lower = text.toLowerCase().trim();
  return EASTER_EGGS.find(e => e.triggers.some(t => lower.includes(t))) ?? null;
}

// ── Mood detection ─────────────────────────────────────────────────────────
const SAD_WORDS = ['sad', 'huzuni', 'stressed', 'msongo', 'bad day', 'siku mbaya', 'tired', 'nimechoka', 'upset', 'frustrated', 'depressed', 'lonely', 'peke yangu'];
const ANGRY_WORDS = ['angry', 'furious', 'hate', 'chukizo', 'annoyed', 'nikuchoka', 'disgusted'];
const HAPPY_WORDS = ['happy', 'furaha', 'excited', 'amazing', 'great day', 'siku nzuri', 'wonderful', 'yay', 'celebrate', 'sherehe'];

export type UserMood = 'sad' | 'angry' | 'happy' | 'neutral';

export function detectUserMood(text: string): UserMood {
  const lower = text.toLowerCase();
  if (SAD_WORDS.some(w => lower.includes(w))) return 'sad';
  if (ANGRY_WORDS.some(w => lower.includes(w))) return 'angry';
  if (HAPPY_WORDS.some(w => lower.includes(w))) return 'happy';
  return 'neutral';
}

const MOOD_RESPONSES: Record<Exclude<UserMood, 'neutral'>, string[]> = {
  sad: [
    "Hey, I hear you 💚 Rough days happen. Sometimes a little retail therapy helps — want me to find something that'll cheer you up?",
    "Pole sana 🥺 Tell you what — let me find you something that'll put a smile on your face. What do you love?",
    "Acha huzuni kidogo! 💪 You came to the right place. What's something you've been wanting for a while?",
  ],
  angry: [
    "I can feel that energy 😤 Let's channel it into finding the perfect thing. What's on your mind?",
    "Okay okay, take a breath with me 🌬️ Now — what can we find that'll make today better?",
    "Deep breath ndugu 🙏 Whatever happened, Mali's got you. What are you looking for?",
  ],
  happy: [
    "FURAHA! 🎉 I love this energy! Let's find something worthy of such a great day!",
    "Yes yes yes! Happy vibes only in this soko! 🌟 What are we celebrating?",
    "Siku nzuri = shopping nzuri! ✨ Come on, let's find something amazing together!",
  ],
};

export function getMoodResponse(mood: Exclude<UserMood, 'neutral'>): string {
  const arr = MOOD_RESPONSES[mood];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Sheng / personality mode helpers ─────────────────────────────────────
export type PersonalityMode = 'calm' | 'sass';
export type LanguageMode = 'english' | 'sheng';

export const SASS_SYSTEM_ADDITION = `
SASS MODE ON: You're extra spicy today. You can tease gently, be playfully dramatic, use more Swahili slang, occasionally roast bad choices (lovingly), and be very opinionated. Think: that brutally honest friend who still has your back.
`.trim();

export const SHENG_SYSTEM_ADDITION = `
SHENG MODE: Code-switch freely into Nairobi/Dar sheng. Use words like: poa, fiti, mzigo, dawa, gari, fala (gently), sawa sawa, beshte, si unajua, unajua, maze, bana, noma, kuniambia. Mix Swahili + English naturally like young Tanzanians actually talk.
`.trim();

// ── Purchase detection ─────────────────────────────────────────────────────
const PURCHASE_PHRASES = ['order placed', 'payment successful', 'checkout complete', 'umeweka order', 'nimetoa pesa', 'nimepata', 'i bought', 'just ordered'];

export function detectPurchase(text: string): boolean {
  const lower = text.toLowerCase();
  return PURCHASE_PHRASES.some(p => lower.includes(p));
}

// ── Sleepy detection (late night) ─────────────────────────────────────────
export function isLateNight(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 5;
}
