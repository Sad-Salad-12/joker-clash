/* ============================================================
 *  data.js —— Deck / hand types / Joker definitions
 * ============================================================ */

const SUITS = [
  { id: 'S', symbol: '♠', name: 'Spades',   color: 'black' },
  { id: 'H', symbol: '♥', name: 'Hearts',   color: 'red' },
  { id: 'C', symbol: '♣', name: 'Clubs',    color: 'black' },
  { id: 'D', symbol: '♦', name: 'Diamonds', color: 'red' },
];

const RANK_DEFS = [
  { r: 2,  label: '2',  chips: 2 },
  { r: 3,  label: '3',  chips: 3 },
  { r: 4,  label: '4',  chips: 4 },
  { r: 5,  label: '5',  chips: 5 },
  { r: 6,  label: '6',  chips: 6 },
  { r: 7,  label: '7',  chips: 7 },
  { r: 8,  label: '8',  chips: 8 },
  { r: 9,  label: '9',  chips: 9 },
  { r: 10, label: '10', chips: 10 },
  { r: 11, label: 'J',  chips: 10, face: true },
  { r: 12, label: 'Q',  chips: 10, face: true },
  { r: 13, label: 'K',  chips: 10, face: true },
  { r: 14, label: 'A',  chips: 11 },
];

/* ---------- Hand types (Balatro style) ---------- */
const HAND_TYPES = {
  high:           { name: 'High Card',       chips: 5,   mult: 1,  key: 'high' },
  pair:           { name: 'Pair',            chips: 10,  mult: 2,  key: 'pair' },
  twoPair:        { name: 'Two Pair',        chips: 20,  mult: 2,  key: 'twoPair' },
  three:          { name: 'Three of a Kind', chips: 30,  mult: 3,  key: 'three' },
  straight:       { name: 'Straight',        chips: 30,  mult: 4,  key: 'straight' },
  flush:          { name: 'Flush',           chips: 35,  mult: 4,  key: 'flush' },
  fullHouse:      { name: 'Full House',      chips: 40,  mult: 4,  key: 'fullHouse' },
  four:           { name: 'Four of a Kind',  chips: 60,  mult: 7,  key: 'four' },
  straightFlush:  { name: 'Straight Flush',  chips: 100, mult: 8,  key: 'straightFlush' },
  royal:          { name: 'Royal Flush',     chips: 120, mult: 12, key: 'royal' },
};

/* ---------- Jokers ----------
 * apply(ctx) returns some of { chips, mult, xmult, note }; null = not triggered
 * see buildContext() in engine.js for ctx fields
 */
const JOKERS = [
  { id: 'greedy',   name: 'Greedy Joker',  icon: '💰', desc: '+40 Chips when you play a Flush',
    apply: c => (c.key === 'flush' || c.key === 'straightFlush' || c.key === 'royal') ? { chips: 40 } : null },

  { id: 'smooth',   name: 'Smooth Joker',  icon: '🛹', desc: '+40 Chips when you play a Straight',
    apply: c => (c.key === 'straight' || c.key === 'straightFlush' || c.key === 'royal') ? { chips: 40 } : null },

  { id: 'fourleaf', name: 'Four Leaf',     icon: '🍀', desc: '+8 Mult on exactly 4 cards',
    apply: c => c.count === 4 ? { mult: 8 } : null },

  { id: 'lone',     name: 'Lone Wolf',     icon: '🥷', desc: '+10 Mult on exactly 1 card',
    apply: c => c.count === 1 ? { mult: 10 } : null },

  { id: 'fullhouse',name: 'Showman',       icon: '🎪', desc: '+12 Mult on exactly 5 cards',
    apply: c => c.count === 5 ? { mult: 12 } : null },

  { id: 'redqueen', name: 'Red Queen',     icon: '👑', desc: '+3 Mult per red card',
    apply: c => ({ mult: c.redCount * 3 }) },

  { id: 'blackking',name: 'Black King',    icon: '🂡', desc: '+6 Chips per black card',
    apply: c => ({ chips: c.blackCount * 6 }) },

  { id: 'court',    name: 'Court Jester',  icon: '🎭', desc: '+8 Chips per J / Q / K',
    apply: c => ({ chips: c.faceCount * 8 }) },

  { id: 'even',     name: 'Even Steven',   icon: '🎳', desc: '+2 Mult per even-ranked card',
    apply: c => ({ mult: c.evenCount * 2 }) },

  { id: 'odd',      name: 'Odd Todd',      icon: '🥧', desc: '+8 Chips per odd-ranked card',
    apply: c => ({ chips: c.oddCount * 8 }) },

  { id: 'ace',      name: 'Ace Up',        icon: '🅰️', desc: '+15 Chips per Ace',
    apply: c => ({ chips: c.aceCount * 15 }) },

  { id: 'double',   name: 'Doubler',       icon: '✖️', desc: 'x2 Mult',
    apply: () => ({ xmult: 2 }) },

  { id: 'triple',   name: 'Trifecta',      icon: '🧊', desc: 'x3 Mult on Three of a Kind / Full House',
    apply: c => (c.key === 'three' || c.key === 'fullHouse') ? { xmult: 3 } : null },

  { id: 'pairjoker',name: 'Twin Joker',    icon: '👯', desc: '+30 Chips on Pair / Two Pair',
    apply: c => (c.key === 'pair' || c.key === 'twoPair') ? { chips: 30 } : null },

  { id: 'glass',    name: 'Glass Joker',   icon: '🔮', desc: 'x2 Mult, but lose 3 HP every play', selfDamage: 3,
    apply: () => ({ xmult: 2 }) },

  { id: 'lucky',    name: 'Lucky Dice',    icon: '🎲', desc: '25% chance to trigger x4 Mult',
    apply: () => (Math.random() < 0.25 ? { xmult: 4, note: 'LUCKY!' } : null) },

  { id: 'vampire',  name: 'Vampire',       icon: '🧛', desc: 'Heal 3 HP every play', heal: 3,
    apply: () => ({}) },

  { id: 'berserk',  name: 'Berserker',     icon: '🩸', desc: 'x2 Mult while below 20 HP',
    apply: c => c.player.hp < 20 ? { xmult: 2, note: 'FRENZY!' } : null },

  { id: 'collector',name: 'Collector',     icon: '📚', desc: '+6 Chips per duplicate rank',
    apply: c => ({ chips: (c.count - c.rankCount) * 6 }) },

  { id: 'rainbow',  name: 'Rainbow',       icon: '🌈', desc: '+10 Mult on 5 different ranks',
    apply: c => c.rankCount >= 5 ? { mult: 10 } : null },

  { id: 'volcano',  name: 'Volcano',       icon: '🌋', desc: '+6 Chips per card played',
    apply: c => ({ chips: c.count * 6 }) },

  { id: 'mirror',   name: 'Mirror',        icon: '🪞', desc: 'x1.5 Mult from your 2nd play onward',
    apply: c => c.playIndex >= 1 ? { xmult: 1.5 } : null },

  { id: 'lightning',name: 'Lightning',     icon: '⚡', desc: 'x3 Mult on your first play each turn',
    apply: c => c.playIndex === 0 ? { xmult: 3 } : null },

  { id: 'stoneskin',name: 'Stone Skin',    icon: '🪨', desc: 'Gain 6 Armor at the start of each turn', turnArmor: 6,
    apply: () => ({}) },

  { id: 'scholar',  name: 'Scholar',       icon: '📖', desc: '+1 Discard each turn', bonusDiscard: 1,
    apply: () => ({}) },

  { id: 'cat',      name: 'Copycat',       icon: '🐱', desc: '+1 Play each turn', bonusPlay: 1,
    apply: () => ({}) },

  { id: 'giant',    name: 'Giant',         icon: '🗿', desc: '+6 Chips per card ranked 9 or higher',
    apply: c => ({ chips: c.bigCount * 6 }) },

  { id: 'tiny',     name: 'Small Fry',     icon: '🧸', desc: '+3 Mult per card ranked 5 or lower',
    apply: c => ({ mult: c.smallCount * 3 }) },
];

const JOKER_MAP = JOKERS.reduce((m, j) => { m[j.id] = j; return m; }, {});

/* ---------- Global config ---------- */
const CONFIG = {
  MAX_HP: 150,
  HAND_SIZE: 8,
  MAX_SELECT: 5,
  BASE_PLAYS: 4,
  BASE_DISCARDS: 3,
  MAX_JOKERS: 5,
  DAMAGE_DIVISOR: 95,   // damage = ceil(score / DAMAGE_DIVISOR)
  JOKER_TRIGGER: 160,   // scoring >= this in one play triggers a Joker draft
  JOKER_TRIGGER_PER_TURN: 1,
};
