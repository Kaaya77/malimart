// =====================================================================
// dateDecks.ts — the "I'm on the date right now" content.
//
// Deliberately static data, not AI-generated:
//   • works with no signal, which is the actual condition in a restaurant
//   • costs nothing per open, so it can be used freely all evening
//   • is instant, and this is used under social pressure at a table
//
// LANGUAGE: English only for now. Swahili is the real differentiator for
// this product and these decks are the first thing that should be
// translated — but shipping shaky translations of intimate prompts is worse
// than shipping none, so that pass is deliberately left for a native pass
// rather than guessed at here.
// =====================================================================

export type DeckId = 'icebreakers' | 'deeper' | 'would_you_rather' | 'never_have_i' | 'playful';

export interface Deck {
  id: DeckId;
  name: string;
  blurb: string;
  /** Rough read on how exposing the deck is — the UI orders gentlest first. */
  intensity: 1 | 2 | 3;
  cards: string[];
}

export const DECKS: Deck[] = [
  {
    id: 'icebreakers',
    name: 'Openers',
    blurb: 'For the first twenty minutes, when nobody has relaxed yet.',
    intensity: 1,
    cards: [
      'What did you actually do today — the boring version, not the highlight.',
      "What's something you're good at that never comes up?",
      'Who in your family are you most like?',
      "What's the last thing that made you laugh out loud?",
      'Where did you grow up, and would you go back?',
      "What's a song you'd be embarrassed for me to find in your playlist?",
      'Are you a morning person or are you lying?',
      "What's the best meal you've had in this city?",
      'What were you like at sixteen?',
      "What's something everyone seems to love that you just don't get?",
      'What do you do when you have a completely free Saturday?',
      "What's the last thing you bought that you actually think about?",
    ],
  },
  {
    id: 'deeper',
    name: 'Going deeper',
    blurb: 'Third date and beyond. Ask one, then actually listen.',
    intensity: 3,
    cards: [
      'What are you working on about yourself right now?',
      'When was the last time you felt genuinely proud?',
      "What's something you believed strongly five years ago that you don't now?",
      'Who do you call when something goes badly?',
      'What does a good life look like to you in ten years?',
      'What are you more afraid of — failing, or not trying?',
      "What's the kindest thing anyone has done for you?",
      'What do people get wrong about you?',
      'What would you do if money stopped being a problem tomorrow?',
      'What part of your family do you want to keep, and what do you want to leave behind?',
      "What's something you've never told anyone at this table?",
      'How do you know when you trust someone?',
    ],
  },
  {
    id: 'would_you_rather',
    name: 'Would you rather',
    blurb: 'When the conversation stalls and you need something easy.',
    intensity: 1,
    cards: [
      'Would you rather live by the beach or in the middle of the city?',
      'Would you rather never use social media again, or never watch another film?',
      'Would you rather be famous for something small or excellent at something private?',
      'Would you rather always be 20 minutes early or 10 minutes late?',
      'Would you rather have one long holiday a year or a long weekend every month?',
      'Would you rather cook every meal yourself or never cook again?',
      'Would you rather know when you die or how?',
      'Would you rather lose your phone or your wallet?',
      'Would you rather be the funniest person in the room or the smartest?',
      'Would you rather travel to ten countries once or one country ten times?',
    ],
  },
  {
    id: 'never_have_i',
    name: 'Never have I ever',
    blurb: 'Light and confessional. Stop before it gets uncomfortable.',
    intensity: 2,
    cards: [
      'Never have I ever pretended to recognise someone I had completely forgotten.',
      'Never have I ever cancelled plans by inventing an emergency.',
      'Never have I ever sent a message to entirely the wrong person.',
      'Never have I ever stayed in a queue so long I forgot what it was for.',
      'Never have I ever lied about having seen a famous film.',
      'Never have I ever gone somewhere just because it would look good in a photo.',
      'Never have I ever eaten something I was allergic to out of politeness.',
      'Never have I ever fallen asleep somewhere genuinely embarrassing.',
      'Never have I ever re-read a message I sent more than five times.',
      'Never have I ever agreed with an opinion I did not understand.',
    ],
  },
  {
    id: 'playful',
    name: 'Dare or drink',
    blurb: 'Silly, low stakes. Nothing here should make anyone feel cornered.',
    intensity: 2,
    cards: [
      'Show the last photo in your camera roll. No scrolling first.',
      'Let the other person order your next drink or dish, no vetoes.',
      'Say something you genuinely admire about the other person. Out loud.',
      'Do your best impression of the person at the next table. Quietly.',
      'Text a friend a single word and refuse to explain until tomorrow.',
      'Swap phones and change nothing but the wallpaper.',
      'Speak only in questions for the next two minutes.',
      'Recommend a song, play it right now, and defend it.',
      'Read your most recent search history entry aloud.',
      'Tell the story of the worst date you have ever been on.',
    ],
  },
];

export const getDeck = (id: DeckId): Deck | undefined => DECKS.find(d => d.id === id);

/**
 * Beginner mode — the first-date walkthrough.
 * The nerves this addresses are the reason someone opens the app at all, so
 * the tone is plain and reassuring rather than instructional.
 */
export interface GuideStep {
  heading: string;
  body: string;
}

export const FIRST_DATE_GUIDE: GuideStep[] = [
  {
    heading: 'Pick somewhere you can leave',
    body: 'A walk, a coffee, a cinema — anything with a natural ending. A long sit-down dinner on a first date traps you both if it is not going well. Two hours is plenty.',
  },
  {
    heading: 'Arrive first',
    body: 'Ten minutes early. Not because it impresses anyone, but because walking in to find someone already waiting is the worst possible start for your nerves.',
  },
  {
    heading: 'Settle the money question before you go',
    body: 'Decide in advance what you are comfortable with and be straightforward about it. Offering to pay and being happy to split are both fine; the only bad version is being weird about it at the table.',
  },
  {
    heading: 'Have three things ready',
    body: 'Not a script — just three things you could ask about if silence lands. Openers from the deck will do. You will probably use none of them, and that is the point.',
  },
  {
    heading: 'Ask, then follow up',
    body: 'The whole skill is the second question. They mention their sister, you ask about the sister. People remember feeling listened to far longer than they remember anything clever you said.',
  },
  {
    heading: 'End it on purpose',
    body: 'Do not let it fizzle out at midnight because neither of you wanted to go first. "I have really enjoyed this, I should head off" is a complete sentence and a good one.',
  },
  {
    heading: 'Say what you actually think afterwards',
    body: 'If you liked it, say so that night or the next morning. Waiting three days is a rule invented by people who were scared. If you did not, say that kindly rather than disappearing.',
  },
];

/** Pre-date checklist. Ten seconds, and it turns dread into readiness. */
export const PRE_DATE_CHECKLIST: string[] = [
  'Booked, or checked that they are open',
  'They know where and when',
  'Money on your phone for the bill and the ride',
  'Transport home sorted for both of you',
  'Checked their allergies and what they avoid',
  'Three things ready to ask about',
];
