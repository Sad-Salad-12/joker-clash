/* 逻辑冒烟测试：牌型识别 / 计分 / AI */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src =
  fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8') + '\n' +
  `return { SUITS, RANK_DEFS, HAND_TYPES, JOKERS, CONFIG, buildDeck, detectHand,
            evaluate, enumerateCombos, aiChoosePlay, aiChooseDiscard, drawCards, refillHand, buildContext };`;

const M = new Function(src)();

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  if (actual === expected) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '  期望=' + expected + ' 实际=' + actual); }
}

// 造牌工具
const C = (suit, r) => {
  const s = M.SUITS.find(x => x.id === suit);
  const rd = M.RANK_DEFS.find(x => x.r === r);
  return { uid: suit + r, suit, suitSymbol: s.symbol, color: s.color, r, label: rd.label, chips: rd.chips, face: !!rd.face };
};

console.log('\n[1] 牌型识别');
eq(M.detectHand([C('S', 7), C('H', 7)]), 'pair', '对子');
eq(M.detectHand([C('S', 7), C('H', 7), C('D', 3), C('C', 3)]), 'twoPair', '两对');
eq(M.detectHand([C('S', 7), C('H', 7), C('D', 7)]), 'three', '三条');
eq(M.detectHand([C('S', 5), C('H', 6), C('D', 7), C('C', 8), C('S', 9)]), 'straight', '顺子');
eq(M.detectHand([C('S', 5), C('S', 6), C('S', 7), C('S', 8), C('S', 9)]), 'straightFlush', '同花顺');
eq(M.detectHand([C('S', 10), C('S', 11), C('S', 12), C('S', 13), C('S', 14)]), 'royal', '皇家同花顺');
eq(M.detectHand([C('S', 14), C('H', 2), C('D', 3), C('C', 4), C('S', 5)]), 'straight', 'A-2-3-4-5 顺子');
eq(M.detectHand([C('S', 9), C('H', 9), C('D', 9), C('C', 4), C('S', 4)]), 'fullHouse', '葫芦');
eq(M.detectHand([C('S', 9), C('H', 9), C('D', 9), C('C', 9)]), 'four', '四条');
eq(M.detectHand([C('S', 2), C('S', 6), C('S', 10), C('S', 13), C('S', 4)]), 'flush', '同花');
eq(M.detectHand([C('S', 2), C('H', 6), C('D', 10)]), 'high', '高牌');

console.log('\n[2] 计分公式 (筹码 + 牌面) × 倍率');
const mkPlayer = (jokers = []) => ({
  name: 'T', hp: M.CONFIG.MAX_HP, maxHp: M.CONFIG.MAX_HP, armor: 0, jokers,
  deck: [], hand: [], discardPile: [], playsLeft: 4, discardsLeft: 3, playsUsed: 0,
  turnScore: 0, totalScore: 0, bestPlay: 0, stats: {},
});
// 对子 K K: (10 + 10 + 10) × 2 = 60
let r = M.evaluate([C('S', 13), C('H', 13)], mkPlayer(), null, 0);
eq(r.total, 60, '对子 K K = 60 分');
// 高牌 A: (5 + 11) × 1 = 16
r = M.evaluate([C('S', 14)], mkPlayer(), null, 0);
eq(r.total, 16, '高牌 A = 16 分');
// 葫芦 999 44: (40 + 9*3 + 4*2) × 4 = (40+27+8)*4 = 300
r = M.evaluate([C('S', 9), C('H', 9), C('D', 9), C('C', 4), C('S', 4)], mkPlayer(), null, 0);
eq(r.total, 300, '葫芦 99944 = 300 分');
// 小丑：翻倍小丑 ×2
r = M.evaluate([C('S', 13), C('H', 13)], mkPlayer([M.JOKERS.find(j => j.id === 'double')]), null, 0);
eq(r.total, 120, '对子 + 翻倍小丑 = 120 分');
// 小丑：红心皇后 每张红牌 +3 倍率
r = M.evaluate([C('H', 13), C('D', 13)], mkPlayer([M.JOKERS.find(j => j.id === 'redqueen')]), null, 0);
// (10 + 10 + 10) × (2 + 6) = 240
eq(r.total, 240, '红对子 + 红心皇后 = 240 分');
// 王牌：每张 A +15 筹码
r = M.evaluate([C('S', 14), C('H', 14)], mkPlayer([M.JOKERS.find(j => j.id === 'ace')]), null, 0);
// (10 + 11 + 11 + 30) × 2 = 124
eq(r.total, 124, '对A + 王牌 = 124 分');

console.log('\n[3] 小丑完整性');
eq(M.JOKERS.length >= 24, true, '小丑数量 ≥ 24 (' + M.JOKERS.length + ')');
let jokerErr = 0;
M.JOKERS.forEach(j => {
  const p = mkPlayer([j]);
  try {
    const out = M.evaluate([C('H', 5), C('H', 6), C('H', 7), C('H', 8), C('H', 9)], p, null, 1);
    if (typeof out.total !== 'number' || isNaN(out.total)) { jokerErr++; console.log('    ! 异常小丑: ' + j.id); }
  } catch (e) { jokerErr++; console.log('    ! 抛错小丑: ' + j.id + ' ' + e.message); }
});
eq(jokerErr, 0, '所有小丑在同花顺场景下无异常');

console.log('\n[4] 牌堆与抽牌');
const deck = M.buildDeck();
eq(deck.length, 52, '标准 52 张牌堆');
const p = mkPlayer();
p.deck = deck;
M.refillHand(p);
eq(p.hand.length, M.CONFIG.HAND_SIZE, '起手 8 张');
eq(p.deck.length, 44, '牌堆剩余 44 张');

console.log('\n[5] AI 决策');
const foe = mkPlayer();
const pick = M.aiChoosePlay(p, foe, 0, 'hard');
eq(!!pick && pick.combo.length >= 1 && pick.combo.length <= 5, true, 'AI 返回 1-5 张合法组合');
eq(typeof pick.res.total === 'number' && pick.res.total > 0, true, 'AI 组合得分有效 (' + pick.res.total + ')');
const combos = M.enumerateCombos(p.hand, 5);
eq(combos.length, 218, '8 张手牌共 218 种出牌组合');
// 困难 AI 应选出不劣于随机组合的最优解
const best = Math.max(...combos.map(c => M.evaluate(c, p, foe, 0).total));
eq(pick.res.total >= best * 0.99, true, '困难 AI 选出接近最优解 (' + pick.res.total + '/' + best + ')');

console.log('\n[6] 伤害换算');
const dmgOf = t => Math.max(1, Math.ceil(t / M.CONFIG.DAMAGE_DIVISOR));
eq(dmgOf(16), 1, '16 分 → 1 点伤害');
eq(dmgOf(95), 1, '95 分 → 1 点伤害');
eq(dmgOf(300), 4, '300 分 → 4 点伤害');
eq(dmgOf(1200), 13, '1200 分 → 13 点伤害');
eq(M.CONFIG.MAX_HP, 150, '生命上限 150');

console.log('\n———————————————');
console.log(fail === 0 ? `全部通过：${pass} 项` : `通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
