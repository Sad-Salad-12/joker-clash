/* ============================================================
 *  engine.js —— 牌型识别 / 计分 / 牌堆 / AI
 * ============================================================ */

/* ---------- 牌堆 ---------- */
function buildDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const rd of RANK_DEFS) {
      deck.push({
        uid: s.id + '_' + rd.r + '_' + Math.random().toString(36).slice(2, 7),
        suit: s.id,
        suitSymbol: s.symbol,
        color: s.color,
        r: rd.r,
        label: rd.label,
        chips: rd.chips,
        face: !!rd.face,
      });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 牌型识别 ---------- */
function detectHand(cards) {
  const n = cards.length;
  if (!n) return 'high';

  const rankMap = {}, suitMap = {};
  cards.forEach(c => {
    rankMap[c.r] = (rankMap[c.r] || 0) + 1;
    suitMap[c.suit] = (suitMap[c.suit] || 0) + 1;
  });
  const counts = Object.values(rankMap).sort((a, b) => b - a);
  const distinctRanks = Object.keys(rankMap).length;

  const isFlush = n >= 5 && Object.keys(suitMap).length === 1;
  let isStraight = false;
  let isRoyal = false;

  if (n >= 5 && distinctRanks === n) {
    const uniq = Object.keys(rankMap).map(Number).sort((a, b) => a - b);
    if (uniq.every((v, i) => i === 0 || v === uniq[i - 1] + 1)) isStraight = true;
    // A 作为 1 的顺子：A 2 3 4 5
    if (!isStraight && uniq.join(',') === '2,3,4,5,14') isStraight = true;
    if (isStraight && uniq[uniq.length - 1] === 14 && uniq[0] === 10) isRoyal = true;
  }

  if (isFlush && isRoyal) return 'royal';
  if (isFlush && isStraight) return 'straightFlush';
  if (counts[0] === 4) return 'four';
  if (counts[0] === 3 && counts[1] === 2) return 'fullHouse';
  if (isFlush) return 'flush';
  if (isStraight) return 'straight';
  if (counts[0] === 3) return 'three';
  if (counts[0] === 2 && counts[1] === 2) return 'twoPair';
  if (counts[0] === 2) return 'pair';
  return 'high';
}

/* ---------- 计分上下文 ---------- */
function buildContext(cards, player, opponent, playIndex) {
  let redCount = 0, blackCount = 0, faceCount = 0;
  let evenCount = 0, oddCount = 0, aceCount = 0;
  let bigCount = 0, smallCount = 0;
  const suitSet = new Set(), rankSet = new Set();

  cards.forEach(c => {
    if (c.color === 'red') redCount++; else blackCount++;
    if (c.face) faceCount++;
    if (c.r % 2 === 0) evenCount++; else oddCount++;
    if (c.r === 14) aceCount++;
    if (c.r >= 9) bigCount++;
    if (c.r <= 5) smallCount++;
    suitSet.add(c.suit);
    rankSet.add(c.r);
  });

  const key = detectHand(cards);
  return {
    cards, key, count: cards.length,
    redCount, blackCount, faceCount, evenCount, oddCount, aceCount,
    bigCount, smallCount,
    suitCount: suitSet.size, rankCount: rankSet.size,
    playIndex,
    player, opponent,
  };
}

/* ---------- 核心计分 ---------- */
function evaluate(cards, player, opponent, playIndex) {
  const ctx = buildContext(cards, player, opponent, playIndex);
  const type = HAND_TYPES[ctx.key];

  let chips = type.chips;
  let mult = type.mult;
  let xmult = 1;
  const triggers = [];

  // 每张牌的基础筹码
  cards.forEach(c => { chips += c.chips; });

  const baseChips = chips;
  const baseMult = mult;

  // 逐个应用小丑
  for (const j of player.jokers) {
    let res = null;
    try { res = j.apply(ctx); } catch (e) { res = null; }
    if (!res) continue;
    if (res.chips) chips += res.chips;
    if (res.mult) mult += res.mult;
    if (res.xmult) xmult *= res.xmult;
    triggers.push({ joker: j, note: res.note });
  }

  const total = Math.max(0, Math.round(chips * mult * xmult));

  // 附带效果（治疗 / 自损 / 护甲）
  let heal = 0, selfDamage = 0;
  player.jokers.forEach(j => {
    // 效果型小丑无论是否计分都生效
    if (j.heal) heal += j.heal;
    if (j.selfDamage) selfDamage += j.selfDamage;
  });

  return {
    key: ctx.key,
    name: type.name,
    baseChips, baseMult,
    chips, mult, xmult,
    total, triggers,
    heal, selfDamage,
    ctx,
  };
}

/* ---------- 组合枚举（AI 用） ---------- */
function enumerateCombos(hand, maxSize) {
  const combos = [];
  const n = hand.length;
  const limit = Math.min(maxSize || CONFIG.MAX_SELECT, n);
  const rec = (start, cur) => {
    if (cur.length > 0) combos.push(cur.slice());
    if (cur.length === limit) return;
    for (let i = start; i < n; i++) {
      cur.push(hand[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return combos;
}

/* ---------- AI ---------- */
const AI_LEVELS = {
  easy:   { label: 'EASY',   mistakeRate: 0.45, startJokers: 0, jokerPick: 'random' },
  normal: { label: 'NORMAL', mistakeRate: 0.12, startJokers: 1, jokerPick: 'best' },
  hard:   { label: 'HARD',   mistakeRate: 0,    startJokers: 1, jokerPick: 'best' },
};

function aiChoosePlay(player, opponent, playIndex, level) {
  const combos = enumerateCombos(player.hand);
  if (!combos.length) return null;

  const scored = combos.map(combo => ({ combo, res: evaluate(combo, player, opponent, playIndex) }));
  scored.sort((a, b) => b.res.total - a.res.total);

  const cfg = AI_LEVELS[level] || AI_LEVELS.normal;
  if (Math.random() < cfg.mistakeRate) {
    // 失误：从前 60% 里随机挑一个
    const pool = scored.slice(0, Math.max(1, Math.floor(scored.length * 0.6)));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return scored[0];
}

function aiChooseDiscard(player, opponent, playIndex, level) {
  // 找出最优 5 张组合，弃掉不在其中的"废牌"
  const combos = enumerateCombos(player.hand, 5).filter(c => c.length >= 4);
  if (!combos.length) return [];
  let best = null;
  for (const combo of combos) {
    const res = evaluate(combo, player, opponent, playIndex);
    if (!best || res.total > best.res.total) best = { combo, res };
  }
  if (!best) return [];

  // 如果最优组合已经不错，就不弃牌
  const threshold = level === 'hard' ? 150 : level === 'normal' ? 120 : 90;
  if (best.res.total >= threshold) return [];

  const keep = new Set(best.combo.map(c => c.uid));
  const rankMap = {};
  player.hand.forEach(c => { rankMap[c.r] = (rankMap[c.r] || 0) + 1; });

  // 废牌评分：不在最优组合中 + 点数孤立 + 非人头/A
  const junk = player.hand
    .filter(c => !keep.has(c.uid))
    .map(c => ({
      card: c,
      score: (rankMap[c.r] > 1 ? -3 : 0) + (c.face ? -2 : 0) + (c.r === 14 ? -2 : 0) + c.chips * 0.1,
    }))
    .sort((a, b) => a.score - b.score);

  return junk.slice(0, 2).map(x => x.card);
}

function aiPickJoker(choices, player, level) {
  const cfg = AI_LEVELS[level] || AI_LEVELS.normal;
  if (cfg.jokerPick === 'random' || !choices.length) {
    return choices[Math.floor(Math.random() * choices.length)];
  }
  // 简单启发式：优先 xmult > 通用加成 > 条件加成
  const rank = j => {
    const d = (j.desc || '');
    if (/x[0-9]/.test(d)) return 3;        // x2 / x3 / x4 / x1.5 — multiplicative
    if (d.includes(' per ')) return 2;     // scales with every card played
    return 1;
  };
  return choices.slice().sort((a, b) => rank(b) - rank(a))[0];
}

/* ---------- 抽牌 / 洗牌 ---------- */
function drawCards(player, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (!player.deck.length) {
      if (!player.discardPile.length) break;
      player.deck = shuffle(player.discardPile);
      player.discardPile = [];
    }
    const c = player.deck.pop();
    player.hand.push(c);
    drawn.push(c);
  }
  return drawn;
}

function refillHand(player) {
  const need = CONFIG.HAND_SIZE - player.hand.length;
  if (need > 0) return drawCards(player, need);
  return [];
}
