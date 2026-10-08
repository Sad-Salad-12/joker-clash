/* ============================================================
 *  data.js —— 牌库 / 牌型表 / 小丑牌定义
 * ============================================================ */

const SUITS = [
  { id: 'S', symbol: '♠', name: '黑桃', color: 'black' },
  { id: 'H', symbol: '♥', name: '红桃', color: 'red' },
  { id: 'C', symbol: '♣', name: '梅花', color: 'black' },
  { id: 'D', symbol: '♦', name: '方块', color: 'red' },
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

/* ---------- 牌型表（Balatro 风格） ---------- */
const HAND_TYPES = {
  high:           { name: '高牌',   chips: 5,   mult: 1,  key: 'high' },
  pair:           { name: '对子',   chips: 10,  mult: 2,  key: 'pair' },
  twoPair:        { name: '两对',   chips: 20,  mult: 2,  key: 'twoPair' },
  three:          { name: '三条',   chips: 30,  mult: 3,  key: 'three' },
  straight:       { name: '顺子',   chips: 30,  mult: 4,  key: 'straight' },
  flush:          { name: '同花',   chips: 35,  mult: 4,  key: 'flush' },
  fullHouse:      { name: '葫芦',   chips: 40,  mult: 4,  key: 'fullHouse' },
  four:           { name: '四条',   chips: 60,  mult: 7,  key: 'four' },
  straightFlush:  { name: '同花顺', chips: 100, mult: 8,  key: 'straightFlush' },
  royal:          { name: '皇家同花顺', chips: 120, mult: 12, key: 'royal' },
};

/* ---------- 小丑牌 ----------
 * apply(ctx) 返回 { chips, mult, xmult, note } 中的若干项，返回 null 表示不触发
 * ctx 字段见 engine.js buildContext()
 */
const JOKERS = [
  { id: 'greedy',   name: '贪婪小丑', icon: '💰', desc: '打出同花时 +40 筹码',
    apply: c => (c.key === 'flush' || c.key === 'straightFlush' || c.key === 'royal') ? { chips: 40 } : null },

  { id: 'smooth',   name: '顺滑小丑', icon: '🛹', desc: '打出顺子时 +40 筹码',
    apply: c => (c.key === 'straight' || c.key === 'straightFlush' || c.key === 'royal') ? { chips: 40 } : null },

  { id: 'fourleaf', name: '四叶草',   icon: '🍀', desc: '恰好打出 4 张牌时 +8 倍率',
    apply: c => c.count === 4 ? { mult: 8 } : null },

  { id: 'lone',     name: '独行侠',   icon: '🥷', desc: '恰好打出 1 张牌时 +10 倍率',
    apply: c => c.count === 1 ? { mult: 10 } : null },

  { id: 'fullhouse',name: '满堂彩',   icon: '🎪', desc: '恰好打出 5 张牌时 +12 倍率',
    apply: c => c.count === 5 ? { mult: 12 } : null },

  { id: 'redqueen', name: '红心皇后', icon: '👑', desc: '每张红色牌 +3 倍率',
    apply: c => ({ mult: c.redCount * 3 }) },

  { id: 'blackking',name: '黑桃国王', icon: '🂡', desc: '每张黑色牌 +6 筹码',
    apply: c => ({ chips: c.blackCount * 6 }) },

  { id: 'court',    name: '宫廷小丑', icon: '🎭', desc: '每张 J / Q / K +8 筹码',
    apply: c => ({ chips: c.faceCount * 8 }) },

  { id: 'even',     name: '偶数先生', icon: '🎳', desc: '每张偶数牌 +2 倍率',
    apply: c => ({ mult: c.evenCount * 2 }) },

  { id: 'odd',      name: '奇数先生', icon: '🥧', desc: '每张奇数牌 +8 筹码',
    apply: c => ({ chips: c.oddCount * 8 }) },

  { id: 'ace',      name: '王牌',     icon: '🅰️', desc: '每张 A +15 筹码',
    apply: c => ({ chips: c.aceCount * 15 }) },

  { id: 'double',   name: '翻倍小丑', icon: '✖️', desc: '得分 ×2',
    apply: () => ({ xmult: 2 }) },

  { id: 'triple',   name: '三倍小丑', icon: '🧊', desc: '打出三条 / 葫芦时 ×3 倍率',
    apply: c => (c.key === 'three' || c.key === 'fullHouse') ? { xmult: 3 } : null },

  { id: 'pairjoker',name: '对对小丑', icon: '👯', desc: '打出对子 / 两对时 +30 筹码',
    apply: c => (c.key === 'pair' || c.key === 'twoPair') ? { chips: 30 } : null },

  { id: 'glass',    name: '玻璃小丑', icon: '🔮', desc: '得分 ×2，但每次出牌自损 3 点生命', selfDamage: 3,
    apply: () => ({ xmult: 2 }) },

  { id: 'lucky',    name: '幸运骰子', icon: '🎲', desc: '25% 概率触发 ×4 倍率',
    apply: () => (Math.random() < 0.25 ? { xmult: 4, note: '幸运触发！' } : null) },

  { id: 'vampire',  name: '吸血鬼',   icon: '🧛', desc: '每次出牌回复 3 点生命', heal: 3,
    apply: () => ({}) },

  { id: 'berserk',  name: '狂战士',   icon: '🩸', desc: '生命低于 20 时得分 ×2',
    apply: c => c.player.hp < 20 ? { xmult: 2, note: '狂暴！' } : null },

  { id: 'collector',name: '收藏家',   icon: '📚', desc: '每张重复点数的牌 +6 筹码',
    apply: c => ({ chips: (c.count - c.rankCount) * 6 }) },

  { id: 'rainbow',  name: '彩虹',     icon: '🌈', desc: '打出 5 种不同点数时 +10 倍率',
    apply: c => c.rankCount >= 5 ? { mult: 10 } : null },

  { id: 'volcano',  name: '火山',     icon: '🌋', desc: '每张打出的牌 +6 筹码',
    apply: c => ({ chips: c.count * 6 }) },

  { id: 'mirror',   name: '镜像',     icon: '🪞', desc: '本回合第 2 次及以后出牌 ×1.5 倍率',
    apply: c => c.playIndex >= 1 ? { xmult: 1.5 } : null },

  { id: 'lightning',name: '闪电',     icon: '⚡', desc: '每回合首次出牌 ×3 倍率',
    apply: c => c.playIndex === 0 ? { xmult: 3 } : null },

  { id: 'stoneskin',name: '石肤',     icon: '🪨', desc: '每回合开始获得 6 点护甲', turnArmor: 6,
    apply: () => ({}) },

  { id: 'scholar',  name: '智慧书',   icon: '📖', desc: '每回合 +1 次弃牌', bonusDiscard: 1,
    apply: () => ({}) },

  { id: 'cat',      name: '复制猫',   icon: '🐱', desc: '每回合 +1 次出牌', bonusPlay: 1,
    apply: () => ({}) },

  { id: 'giant',    name: '巨人',     icon: '🗿', desc: '每张 9 以上的牌 +6 筹码',
    apply: c => ({ chips: c.bigCount * 6 }) },

  { id: 'tiny',     name: '小矮人',   icon: '🧸', desc: '每张 5 以下的牌 +3 倍率',
    apply: c => ({ mult: c.smallCount * 3 }) },
];

const JOKER_MAP = JOKERS.reduce((m, j) => { m[j.id] = j; return m; }, {});

/* ---------- 全局常量 ---------- */
const CONFIG = {
  MAX_HP: 150,
  HAND_SIZE: 8,
  MAX_SELECT: 5,
  BASE_PLAYS: 4,
  BASE_DISCARDS: 3,
  MAX_JOKERS: 5,
  DAMAGE_DIVISOR: 95,   // 伤害 = ceil(得分 / DAMAGE_DIVISOR)
  JOKER_TRIGGER: 160,   // 单次出牌得分 ≥ 此值触发小丑三选一
  JOKER_TRIGGER_PER_TURN: 1,
};
