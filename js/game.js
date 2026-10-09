/* ============================================================
 *  game.js —— 状态机 / 渲染 / 交互 / AI 回合
 * ============================================================ */
(function () {
'use strict';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let S = null;
let selected = new Set();          // 选中的手牌 uid
let busy = false;                  // 动画 / AI 进行中
let pendingJokerPicks = [];
let audioCtx = null;
let difficulty = 'normal';

/* ============================================================
 *  音效
 * ============================================================ */
function sfx(kind) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const P = {
      click: { f: 520, f2: 680, d: .07, type: 'triangle', v: .05 },
      play:  { f: 420, f2: 900, d: .22, type: 'sawtooth', v: .05 },
      dmg:   { f: 190, f2: 60,  d: .30, type: 'square',   v: .055 },
      joker: { f: 700, f2: 1400,d: .35, type: 'triangle', v: .06 },
      win:   { f: 400, f2: 900, d: .60, type: 'sine',     v: .07 },
      lose:  { f: 300, f2: 90,  d: .70, type: 'sawtooth', v: .06 },
    }[kind];
    if (!P) return;
    o.type = P.type;
    o.frequency.setValueAtTime(P.f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, P.f2), t + P.d);
    g.gain.setValueAtTime(P.v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + P.d);
    o.start(t); o.stop(t + P.d + .02);
  } catch (e) { /* 静默 */ }
}

/* ============================================================
 *  初始化
 * ============================================================ */
function makePlayer(name, isAI) {
  return {
    name, isAI,
    hp: CONFIG.MAX_HP, maxHp: CONFIG.MAX_HP, armor: 0,
    deck: buildDeck(), hand: [], discardPile: [],
    jokers: [],
    playsLeft: CONFIG.BASE_PLAYS, discardsLeft: CONFIG.BASE_DISCARDS,
    playsUsed: 0,
    turnScore: 0, totalScore: 0, bestPlay: 0,
    jokersThisTurn: 0,
    stats: { damage: 0, plays: 0 },
  };
}

function startGame() {
  S = {
    phase: 'player',
    turn: 'me',
    round: 1,
    me: makePlayer('YOU', false),
    opp: makePlayer('OPPONENT', true),
  };
  selected.clear();
  pendingJokerPicks = [];
  busy = false;

  // 困难难度给 AI 起手小丑
  const cfg = AI_LEVELS[difficulty];
  for (let i = 0; i < cfg.startJokers; i++) {
    addJoker(S.opp, JOKERS[Math.floor(Math.random() * JOKERS.length)]);
  }

  refillHand(S.me);
  refillHand(S.opp);
  $('game').classList.remove('hidden');
  $('oppName').textContent = 'OPPONENT · ' + cfg.label;
  renderAll();
  banner('YOUR TURN');
  log('Click cards to select (up to 5), then PLAY to score a poker hand.');
}

/* ============================================================
 *  回合流程
 * ============================================================ */
function startTurn(who) {
  const p = who === 'me' ? S.me : S.opp;
  S.turn = who;
  S.phase = who === 'me' ? 'player' : 'opp';
  selected.clear();
  p.turnScore = 0;
  p.jokersThisTurn = 0;

  // 回合开始：护甲 / 出牌次数 / 弃牌次数加成
  let armor = 0, bonusPlay = 0, bonusDiscard = 0;
  p.jokers.forEach(j => {
    if (j.turnArmor) armor += j.turnArmor;
    if (j.bonusPlay) bonusPlay += j.bonusPlay;
    if (j.bonusDiscard) bonusDiscard += j.bonusDiscard;
  });
  if (armor) { p.armor += armor; }

  p.playsLeft = CONFIG.BASE_PLAYS + bonusPlay;
  p.discardsLeft = CONFIG.BASE_DISCARDS + bonusDiscard;
  p.playsUsed = 0;

  // 双方都补满手牌：玩家回合时对手也应显示等量牌背
  refillHand(S.me);
  refillHand(S.opp);
  renderStaged([], null);
  resetReadout();
  busy = (who !== 'me');
  renderAll();

  if (who === 'me') {
    banner('YOUR TURN');
    log(`ROUND ${S.round} · ${p.playsLeft} plays / ${p.discardsLeft} discards left`);
  } else {
    runOppTurn();
  }
}

function endTurn(who) {
  const p = who === 'me' ? S.me : S.opp;
  // 手牌全部进入弃牌堆
  p.discardPile.push(...p.hand);
  p.hand = [];
  renderAll();

  if (who === 'me') {
    startTurn('opp');
  } else {
    S.round++;
    startTurn('me');
  }
}

/* ============================================================
 *  出牌结算
 * ============================================================ */
function resolvePlay(p, cards, res) {
  const foe = p === S.me ? S.opp : S.me;

  // 移出手牌
  const uids = new Set(cards.map(c => c.uid));
  p.hand = p.hand.filter(c => !uids.has(c.uid));
  p.discardPile.push(...cards);

  p.playsLeft--;
  p.playsUsed++;
  p.turnScore += res.total;
  p.totalScore += res.total;
  p.bestPlay = Math.max(p.bestPlay, res.total);
  p.stats.plays++;

  // 治疗 / 自损
  if (res.heal) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + res.heal);
    if (p.hp > before) floatNum('+' + (p.hp - before), heroEl(p), 'heal');
  }
  if (res.selfDamage) {
    p.hp = Math.max(0, p.hp - res.selfDamage);
    floatNum('-' + res.selfDamage, heroEl(p), '');
  }

  // 伤害
  const dmg = Math.max(1, Math.ceil(res.total / CONFIG.DAMAGE_DIVISOR));
  const realDmg = applyDamage(foe, dmg);
  p.stats.damage += realDmg;

  // 补满手牌
  refillHand(p);

  return { dmg, realDmg };
}

function applyDamage(target, dmg) {
  let remain = dmg;
  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, remain);
    target.armor -= absorbed;
    remain -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remain);
  return remain;
}

function currentPlayIndex(p) {
  return p.playsUsed;
}

/* ============================================================
 *  玩家操作
 * ============================================================ */
function onCardClick(uid) {
  if (busy || S.phase !== 'player') return;
  if (selected.has(uid)) {
    selected.delete(uid);
  } else {
    if (selected.size >= CONFIG.MAX_SELECT) {
      log(`You can play at most ${CONFIG.MAX_SELECT} cards at once.`);
      return;
    }
    selected.add(uid);
  }
  sfx('click');
  renderHandMe();
  updateReadout();
  renderButtons();
}

function getSelectedCards() {
  return S.me.hand.filter(c => selected.has(c.uid));
}

async function doPlay() {
  const cards = getSelectedCards();
  if (!cards.length || busy || S.phase !== 'player') return;
  busy = true;
  sfx('play');

  const res = evaluate(cards, S.me, S.opp, currentPlayIndex(S.me));

  // 出牌飞出动画
  cards.forEach(c => {
    const el = $('handMe').querySelector('[data-uid="' + c.uid + '"]');
    if (el) el.classList.add('leaving');
  });
  await sleep(400);
  selected.clear();

  const out = resolvePlay(S.me, cards, res);
  const foeEl = heroEl(S.opp);

  floatNum(res.total + ' PTS', $('readout'), 'score');
  await sleep(180);
  floatNum('-' + out.realDmg, foeEl, '');
  hitFlash(foeEl);
  sfx('dmg');

  renderAll();
  await sleep(420);

  // 小丑奖励判定
  if (res.total >= CONFIG.JOKER_TRIGGER && S.me.jokersThisTurn < CONFIG.JOKER_TRIGGER_PER_TURN) {
    S.me.jokersThisTurn++;
    pendingJokerPicks.push({ side: 'me', score: res.total });
  }

  if (checkGameOver()) return;

  await processJokerPicks();
  if (checkGameOver()) return;

  if (S.me.playsLeft <= 0 || S.me.hand.length === 0) {
    log('Out of plays — turn over.');
    await sleep(500);
    endTurn('me');
    return;
  }

  busy = false;
  renderAll();
}

async function doDiscard() {
  const cards = getSelectedCards();
  if (!cards.length || busy || S.phase !== 'player' || S.me.discardsLeft <= 0) return;
  busy = true;
  sfx('click');

  cards.forEach(c => {
    const el = $('handMe').querySelector('[data-uid="' + c.uid + '"]');
    if (el) el.classList.add('leaving');
  });
  await sleep(380);
  selected.clear();

  const uids = new Set(cards.map(c => c.uid));
  S.me.hand = S.me.hand.filter(c => !uids.has(c.uid));
  S.me.discardPile.push(...cards);
  S.me.discardsLeft--;

  refillHand(S.me);
  renderAll();
  log(`Discarded ${cards.length} · ${S.me.discardsLeft} discards left`);
  await sleep(260);
  busy = false;
  renderAll();
}

/* ============================================================
 *  AI 回合
 * ============================================================ */
async function runOppTurn() {
  const p = S.opp;
  busy = true;
  renderAll();
  banner('OPPONENT TURN');
  log('Opponent is thinking…');
  await sleep(700);

  // 弃牌阶段
  let guard = 0;
  while (p.discardsLeft > 0 && guard++ < 5) {
    const junk = aiChooseDiscard(p, S.me, currentPlayIndex(p), difficulty);
    if (!junk.length) break;
    const uids = new Set(junk.map(c => c.uid));
    p.hand = p.hand.filter(c => !uids.has(c.uid));
    p.discardPile.push(...junk);
    p.discardsLeft--;
    refillHand(p);
    renderAll();
    log(`Opponent discarded ${junk.length}`);
    await sleep(520);
  }

  // 出牌阶段
  guard = 0;
  while (p.playsLeft > 0 && p.hp > 0 && S.me.hp > 0 && guard++ < 10) {
    const pick = aiChoosePlay(p, S.me, currentPlayIndex(p), difficulty);
    if (!pick || !pick.combo.length) break;
    await sleep(330);

    // 展示 AI 打出的组合
    renderStaged(pick.combo, pick.res);
    log(`Opponent plays ${pick.res.name} (${pick.combo.length} cards)`);
    sfx('play');
    await sleep(620);

    const out = resolvePlay(p, pick.combo, pick.res);
    floatNum(pick.res.total + ' PTS', $('readout'), 'score');
    await sleep(180);
    floatNum('-' + out.realDmg, heroEl(S.me), '');
    hitFlash(heroEl(S.me));
    sfx('dmg');
    renderAll();
    await sleep(400);

    if (S.me.hp <= 0) { checkGameOver(); return; }

    if (pick.res.total >= CONFIG.JOKER_TRIGGER && p.jokersThisTurn < CONFIG.JOKER_TRIGGER_PER_TURN) {
      p.jokersThisTurn++;
      pendingJokerPicks.push({ side: 'opp', score: pick.res.total });
      await processJokerPicks();
    }
  }

  await sleep(400);
  if (checkGameOver()) return;
  endTurn('opp');
}

/* ============================================================
 *  小丑奖励
 * ============================================================ */
function randomJokerChoices(p) {
  const owned = new Set(p.jokers.map(j => j.id));
  const pool = JOKERS.filter(j => !owned.has(j.id));
  const src = pool.length >= 3 ? pool : JOKERS;
  return shuffle(src).slice(0, 3);
}

function addJoker(p, joker) {
  if (p.jokers.some(j => j.id === joker.id)) return false;
  p.jokers.push(joker);
  return true;
}

async function processJokerPicks() {
  while (pendingJokerPicks.length) {
    const pick = pendingJokerPicks.shift();
    if (pick.side === 'me') {
      await askPlayerJoker(pick);
      if (checkGameOver()) return;
    } else {
      const p = S.opp;
      const choices = randomJokerChoices(p);
      const chosen = aiPickJoker(choices, p, difficulty);
      if (p.jokers.length >= CONFIG.MAX_JOKERS) {
        p.jokers.shift();
        log('Opponent swapped out a Joker');
      }
      addJoker(p, chosen);
      sfx('joker');
      renderAll();
      log('Opponent picked up: ' + chosen.name);
      await sleep(700);
    }
  }
}

function askPlayerJoker(pick) {
  return new Promise(resolve => {
    const choices = randomJokerChoices(S.me);
    const full = S.me.jokers.length >= CONFIG.MAX_JOKERS;
    $('pickTitle').textContent = pick.score + ' POINTS!';
    $('pickSub').textContent = full
      ? 'Joker slots are full — your pick replaces the oldest Joker'
      : 'Pick one Joker to keep for the rest of the match';
    const box = $('jokerChoices');
    box.innerHTML = '';
    choices.forEach(j => {
      const el = document.createElement('div');
      el.className = 'jcard';
      el.innerHTML =
        '<div class="jc-icon">' + j.icon + '</div>' +
        '<div class="jc-name">' + j.name + '</div>' +
        '<div class="jc-desc">' + j.desc + '</div>' +
        '<div class="jc-tag">JOKER</div>';
      el.onclick = () => {
        if (full) S.me.jokers.shift();
        addJoker(S.me, j);
        sfx('joker');
        $('jokerScreen').classList.add('hidden');
        renderAll();
        log('You picked up: ' + j.name + ' — ' + j.desc);
        resolve();
      };
      box.appendChild(el);
    });
    $('jokerScreen').classList.remove('hidden');
  });
}

/* ============================================================
 *  胜负
 * ============================================================ */
function checkGameOver() {
  if (!S) return false;
  if (S.me.hp > 0 && S.opp.hp > 0) return false;
  S.phase = 'over';
  busy = true;
  const win = S.opp.hp <= 0 && S.me.hp > 0;
  const draw = S.me.hp <= 0 && S.opp.hp <= 0;

  setTimeout(() => {
    const t = $('endTitle');
    t.textContent = draw ? 'DRAW' : (win ? 'VICTORY' : 'DEFEAT');
    t.className = 'end-title ' + (draw ? '' : (win ? 'win' : 'lose'));
    $('endSub').textContent = draw
      ? 'You knocked each other out'
      : (win ? `You finished them off with ${S.me.hp} HP left`
             : `You went down — opponent still had ${S.opp.hp} HP`);

    const stats = [
      ['TOTAL SCORE', S.me.totalScore],
      ['BEST PLAY', S.me.bestPlay],
      ['DAMAGE DEALT', S.me.stats.damage],
      ['ROUNDS', S.round],
      ['JOKERS', S.me.jokers.length],
    ];
    $('endStats').innerHTML = stats.map(s =>
      '<div class="stat"><div class="sv">' + s[1] + '</div><div class="sl">' + s[0] + '</div></div>'
    ).join('');
    $('endScreen').classList.remove('hidden');
    sfx(win ? 'win' : 'lose');
  }, 700);
  return true;
}

/* ============================================================
 *  渲染
 * ============================================================ */
function heroEl(p) { return p === S.me ? $('heroMe') : $('heroOpp'); }

function renderAll() {
  if (!S) return;
  renderHandMe();
  renderHandOpp();
  renderJokers(S.me, $('jokersMe'));
  renderJokers(S.opp, $('jokersOpp'));
  renderCrystals(S.me, $('crystalsMe'));
  renderCrystals(S.opp, $('crystalsOpp'));
  renderHero(S.me, $('hpMe'), $('hpBarMe'), $('armorMe'));
  renderHero(S.opp, $('hpOpp'), $('hpBarOpp'), $('armorOpp'));
  $('meTurnScore').textContent = S.me.turnScore;
  $('oppTurnScore').textContent = S.opp.turnScore;
  $('discardMe').textContent = S.me.discardPile.length;
  $('discardOpp').textContent = S.opp.discardPile.length;
  $('etSub').textContent = 'PLAYS ' + S.me.playsLeft;
  renderButtons();
  if (S.phase === 'player') updateReadout();
}

function renderButtons() {
  const myTurn = S.phase === 'player' && !busy;
  const n = selected.size;
  $('btnPlay').disabled = !myTurn || n === 0 || S.me.playsLeft <= 0;
  $('btnDiscard').disabled = !myTurn || n === 0 || S.me.discardsLeft <= 0;
  $('btnHint').disabled = !myTurn || S.me.playsLeft <= 0;
  $('btnClear').disabled = !myTurn || n === 0;
  $('btnEnd').disabled = !myTurn;
  $('btnEnd').classList.toggle('attention', myTurn && S.me.playsLeft <= 0);
}

/* ---------- 手牌 ---------- */
const SUIT_FILE = { S: 'Spades', H: 'Hearts', C: 'Clubs', D: 'Diamonds' };

function makeCardEl(c) {
  const el = document.createElement('div');
  el.className = 'card ' + c.color;
  el.dataset.uid = c.uid;
  el.innerHTML = '<img class="c-img" draggable="false" alt="" src="assets/cards/card' + SUIT_FILE[c.suit] + c.label + '.png">';
  return el;
}

function makeBackEl() {
  const el = document.createElement('div');
  el.className = 'card back';
  el.innerHTML = '<img class="c-img" draggable="false" alt="" src="assets/cards/back.png">';
  return el;
}

function layoutFan(container, spacing) {
  const kids = [...container.children];
  const n = kids.length;
  if (!n) return;
  // Size the fan from the container's real width so it can never overflow.
  // Edge cards are rotated, so budget for the rotated bounding box, not the raw width.
  const avail = container.clientWidth || 780;
  const cardW = kids[0].offsetWidth || 92;
  const cardH = kids[0].offsetHeight || 130;
  const rad = 20 * Math.PI / 180;                       // max tilt, matches maxRot below
  // transform-origin sits below the card (50% 165%), so a tilt also swings the card
  // sideways: budget for that swing plus the rotated half-width at both fan ends.
  const tilt = 1.15 * cardH * Math.sin(rad) +
               (cardW * Math.cos(rad) + cardH * Math.sin(rad)) / 2;
  const spread = spacing || Math.max(30, Math.min(100, ((avail - 2 * tilt) * 0.95) / Math.max(n - 1, 1)));
  const totalW = spread * (n - 1);
  const maxRot = 20;
  kids.forEach((el, i) => {
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
    const x = -totalW / 2 + spread * i;
    const rot = t * maxRot;
    const lift = t * t * 28;
    el.style.setProperty('--x', x.toFixed(1) + 'px');
    el.style.setProperty('--rot', rot.toFixed(2) + 'deg');
    el.style.setProperty('--lift', lift.toFixed(1) + 'px');
    el.style.zIndex = String(10 + i);
  });
}

function renderHandMe() {
  const box = $('handMe');
  const old = new Map();
  [...box.children].forEach(el => old.set(el.dataset.uid, el));
  box.innerHTML = '';
  S.me.hand.forEach(c => {
    let el = old.get(c.uid);
    if (!el) { el = makeCardEl(c); el.classList.add('dealing'); }
    if (selected.has(c.uid)) el.classList.add('selected'); else el.classList.remove('selected');
    if (busy || S.phase !== 'player') el.classList.add('disabled'); else el.classList.remove('disabled');
    box.appendChild(el);
  });
  layoutFan(box);
}

function renderHandOpp() {
  const box = $('handOpp');
  const n = S.opp.hand.length;
  const cur = box.children.length;
  if (cur === n) { layoutFan(box, 46); return; }
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = makeBackEl();
    el.dataset.uid = 'back_' + i;
    if (cur > 0) el.classList.add('dealing');
    box.appendChild(el);
  }
  layoutFan(box, 46);
}

/* ---------- 小丑槽 ---------- */
function renderJokers(p, box) {
  box.innerHTML = '';
  p.jokers.forEach(j => {
    const el = document.createElement('div');
    el.className = 'joker';
    el.dataset.desc = j.name + '：' + j.desc;
    el.innerHTML = '<div class="j-icon">' + j.icon + '</div><div class="j-name">' + j.name + '</div>';
    box.appendChild(el);
  });
  for (let i = p.jokers.length; i < CONFIG.MAX_JOKERS; i++) {
    const s = document.createElement('div');
    s.className = 'jslot';
    s.textContent = '✦';
    box.appendChild(s);
  }
}

/* ---------- 水晶 ---------- */
function renderCrystals(p, box) {
  const total = Math.max(p.playsLeft, CONFIG.BASE_PLAYS);
  box.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'crystal' + (i < p.playsLeft ? ' on' : '');
    box.appendChild(d);
  }
}

/* ---------- 英雄 ---------- */
function renderHero(p, hpEl, barEl, armorEl) {
  hpEl.textContent = p.hp;
  barEl.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
  if (p.armor > 0) {
    armorEl.classList.remove('hidden');
    armorEl.querySelector('span').textContent = p.armor;
  } else {
    armorEl.classList.add('hidden');
  }
}

/* ---------- 计分板 ---------- */
function renderStaged(cards, res) {
  const box = $('stagedCards');
  if (!cards || !cards.length) {
    box.innerHTML = '<div class="empty-hint">PICK CARDS</div>';
    return;
  }
  box.innerHTML = '';
  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'mini ' + c.color;
    el.innerHTML = '<img class="m-img" draggable="false" alt="" src="assets/cards/card' + SUIT_FILE[c.suit] + c.label + '.png">';
    box.appendChild(el);
  });
  if (res) showResult(res);
}

function showResult(res) {
  $('handTypeName').textContent = res.name;
  $('chipsVal').textContent = res.chips;
  $('multVal').textContent = res.mult;
  const x = $('xmultVal');
  if (res.xmult > 1) {
    x.classList.remove('hidden');
    x.textContent = '×' + (Math.round(res.xmult * 100) / 100);
  } else {
    x.classList.add('hidden');
  }
  $('finalScore').textContent = res.total;
  $('finalScore').classList.remove('pop');
  void $('finalScore').offsetWidth;
  $('finalScore').classList.add('pop');
  const dmg = Math.max(1, Math.ceil(res.total / CONFIG.DAMAGE_DIVISOR));
  $('dmgPreview').textContent = 'DEALS ' + dmg + ' DAMAGE';
}

function resetReadout() {
  $('handTypeName').textContent = 'PICK CARDS';
  $('chipsVal').textContent = '0';
  $('multVal').textContent = '0';
  $('xmultVal').classList.add('hidden');
  $('finalScore').textContent = '0';
  $('dmgPreview').textContent = '';
}

function updateReadout() {
  const cards = getSelectedCards();
  if (!cards.length) {
    renderStaged([], null);
    resetReadout();
    return;
  }
  const res = evaluate(cards, S.me, S.opp, currentPlayIndex(S.me));
  renderStaged(cards, res);
}

/* 推荐组合：帮玩家找出当前手牌的最优解 */
function doHint() {
  if (busy || S.phase !== 'player') return;
  const pick = aiChoosePlay(S.me, S.opp, currentPlayIndex(S.me), 'hard');
  if (!pick) return;
  selected = new Set(pick.combo.map(c => c.uid));
  sfx('click');
  renderHandMe();
  updateReadout();
  renderButtons();
  log('Best combo selected: ' + pick.res.name + ' — ' + pick.res.total + ' points');
}

/* ============================================================
 *  特效
 * ============================================================ */
function floatNum(text, anchorEl, cls) {
  const r = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-num ' + (cls || '');
  el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top + r.height / 2) + 'px';
  $('fxLayer').appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function hitFlash(heroElement) {
  const el = document.createElement('div');
  el.className = 'hit-flash';
  heroElement.appendChild(el);
  heroElement.classList.add('shake');
  setTimeout(() => { el.remove(); heroElement.classList.remove('shake'); }, 520);
}

function banner(text) {
  const b = $('turnBanner');
  b.textContent = text;
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  setTimeout(() => b.classList.add('hidden'), 950);
}

function log(text) { $('logLine').textContent = text; }

/* ============================================================
 *  绑定
 * ============================================================ */
function bind() {
  $('handMe').addEventListener('click', e => {
    const el = e.target.closest('.card');
    if (el && el.dataset.uid) onCardClick(el.dataset.uid);
  });

  $('btnPlay').onclick = doPlay;
  $('btnDiscard').onclick = doDiscard;
  $('btnHint').onclick = doHint;
  $('btnClear').onclick = () => {
    if (busy || S.phase !== 'player') return;
    selected.clear();
    sfx('click');
    renderHandMe();
    updateReadout();
    renderButtons();
  };
  $('btnEnd').onclick = async () => {
    if (busy || S.phase !== 'player') return;
    busy = true;
    selected.clear();
    renderAll();
    await sleep(220);
    endTurn('me');
  };

  $('diffRow').addEventListener('click', e => {
    const b = e.target.closest('.dp-btn');
    if (!b) return;
    difficulty = b.dataset.level;
    [...$('diffRow').children].forEach(x => x.classList.toggle('active', x === b));
    sfx('click');
  });

  $('btnStart').onclick = () => {
    sfx('click');
    $('startScreen').classList.add('hidden');
    startGame();
  };
  $('btnRestart').onclick = () => {
    sfx('click');
    $('endScreen').classList.add('hidden');
    startGame();
  };

  document.addEventListener('keydown', e => {
    if (!S || S.phase !== 'player' || busy) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!$('btnPlay').disabled) doPlay(); }
    if (e.key === 'Escape') { selected.clear(); renderHandMe(); updateReadout(); renderButtons(); }
    if (e.key === 'h' || e.key === 'H') doHint();
  });
}

/* ============================================================
 *  演示局面：URL 加 ?shot=1 时直接摆出一张"战斗中"的画面，
 *  仅用于生成封面截图，不参与正常对局流程。
 * ============================================================ */
function makeCard(suitId, rank) {
  const s = SUITS.find(x => x.id === suitId);
  const rd = RANK_DEFS.find(x => x.r === rank);
  return {
    uid: 'shot_' + suitId + rank, suit: suitId, suitSymbol: s.symbol, color: s.color,
    r: rank, label: rd.label, chips: rd.chips, face: !!rd.face,
  };
}

function setupShot() {
  S = {
    phase: 'player', turn: 'me', round: 4,
    me: makePlayer('YOU', false),
    opp: makePlayer('OPPONENT', true),
  };
  S.me.hp = 96;
  S.opp.hp = 62;
  S.me.jokers = [JOKER_MAP.double, JOKER_MAP.court];
  S.opp.jokers = [JOKER_MAP.triple, JOKER_MAP.stoneskin, JOKER_MAP.vampire];

  // 一手皇家同花顺 + 三张散牌
  S.me.hand = [
    makeCard('H', 10), makeCard('H', 11), makeCard('H', 12),
    makeCard('H', 13), makeCard('H', 14),
    makeCard('S', 2), makeCard('D', 5), makeCard('C', 7),
  ];
  S.opp.hand = [
    makeCard('S', 3), makeCard('S', 4), makeCard('S', 5), makeCard('S', 6),
    makeCard('C', 9), makeCard('D', 9), makeCard('H', 9), makeCard('C', 11),
  ];

  S.me.playsLeft = 2; S.opp.playsLeft = 4;
  S.me.discardsLeft = 3; S.opp.discardsLeft = 3;
  S.me.playsUsed = 2;
  S.me.turnScore = 1284; S.opp.turnScore = 903;
  S.me.discardPile = [makeCard('C', 2), makeCard('D', 3)];
  S.opp.discardPile = [makeCard('C', 2), makeCard('D', 3), makeCard('H', 4),
                       makeCard('S', 6), makeCard('D', 8)];

  selected = new Set(S.me.hand.slice(0, 5).map(c => c.uid));
  busy = false;

  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  $('jokerScreen').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('oppName').textContent = 'OPPONENT · HARD';

  renderAll();
  log('Royal Flush assembled — this hand ends the match.');
}

bind();

// 后台预热牌面素材（延迟启动，不拖慢首屏）
setTimeout(function preloadCards() {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const urls = ['assets/cards/back.png'];
  ['Spades', 'Hearts', 'Clubs', 'Diamonds'].forEach(s => {
    ranks.forEach(r => urls.push('assets/cards/card' + s + r + '.png'));
  });
  let i = 0;
  (function next() {
    if (i >= urls.length) return;
    const im = new Image();
    im.onload = im.onerror = next;   // 串行预热，避免抢占带宽
    im.src = urls[i++];
  })();
}, 700);

// ?shot=1 直接进入演示局面，否则显示开始界面
if (new URLSearchParams(location.search).has('shot')) {
  setupShot();
}
window.__JOKER_CLASH__ = { getState: () => S, setupShot };
})();
