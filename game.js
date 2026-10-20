// ========================================================
// 受験サクセス 完全版ゲームエンジン（イベントキュー＆安定性強化版）
// ========================================================

// 1. Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'start') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      osc.frequency.setValueAtTime(880.00, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.50, now + 0.24);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'levelup') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(739.99, now + 0.1);
      osc.frequency.setValueAtTime(880.00, now + 0.2);
      osc.frequency.setValueAtTime(1174.66, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'fail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'rest') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'battle_hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch (e) {
    console.warn(e);
  }
}

// ========================================================
// 1.5 Game Juice エフェクトエンジン
// （視覚演出・振動・パーティクル・カウントアップ）
// ========================================================
const previousValues = {};

function triggerScreenShake() {
  const gc = document.getElementById('game-container');
  if (!gc) return;
  gc.classList.remove('screen-shake');
  void gc.offsetWidth; // reflow
  gc.classList.add('screen-shake');
  setTimeout(() => gc.classList.remove('screen-shake'), 380);
}

function triggerScreenBounce() {
  const gc = document.getElementById('game-container');
  if (!gc) return;
  gc.classList.remove('screen-bounce');
  void gc.offsetWidth; // reflow
  gc.classList.add('screen-bounce');
  setTimeout(() => gc.classList.remove('screen-bounce'), 360);
}

function showFloatingText(text, x, y, type = 'exp') {
  const container = document.getElementById('floating-text-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `floating-text ${type}`;
  el.textContent = text;

  // コンテナ相対座標の計算
  const rect = container.getBoundingClientRect();
  const relX = Math.max(30, Math.min(rect.width - 30, x ? (x - rect.left) : (rect.width / 2)));
  const relY = Math.max(30, Math.min(rect.height - 30, y ? (y - rect.top) : (rect.height * 0.45)));

  el.style.left = `${relX}px`;
  el.style.top = `${relY}px`;

  container.appendChild(el);
  setTimeout(() => el.remove(), 860);
}

function triggerParticles(x, y, count = 16, type = 'star') {
  const container = document.getElementById('particle-container');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const originX = x ? (x - rect.left) : (rect.width / 2);
  const originY = y ? (y - rect.top) : (rect.height * 0.45);

  const icons = {
    star: ['⭐', '✨', '🌟', '✦'],
    gold: ['👑', '✨', '⚡', '🌟'],
    heal: ['💖', '🍀', '✨', '💚'],
    mood: ['🔥', '✨', '🎮', '💖'],
    confetti: ['🌸', '🎉', '🎊', '✨']
  };
  const list = icons[type] || icons.star;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.textContent = list[Math.floor(Math.random() * list.length)];
    p.style.fontSize = `${Math.random() * 0.6 + 0.8}rem`;
    p.style.left = `${originX}px`;
    p.style.top = `${originY}px`;

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = Math.random() * 90 + 40;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = (Math.random() - 0.5) * 720;

    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.setProperty('--rot', `${rot}deg`);

    container.appendChild(p);
    setTimeout(() => p.remove(), 760);
  }
}

function animateNumberValue(el, targetVal, isScore = false, isMoney = false) {
  if (!el) return;
  const key = el.id;
  const currentVal = previousValues[key] !== undefined ? previousValues[key] : targetVal;
  previousValues[key] = targetVal;

  if (currentVal === targetVal) {
    el.textContent = isMoney ? `¥${targetVal.toLocaleString()}` : targetVal;
    return;
  }

  // アニメーションカウントアップ
  const startTime = performance.now();
  const duration = 350;

  // バウンスクラス付与
  el.classList.remove('number-pop', 'number-pop-green');
  void el.offsetWidth;
  if (isScore && targetVal > currentVal) {
    el.classList.add('number-pop');
  } else if (!isScore && targetVal > currentVal) {
    el.classList.add('number-pop-green');
  }
  setTimeout(() => el.classList.remove('number-pop', 'number-pop-green'), 360);

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // イージング
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(currentVal + (targetVal - currentVal) * easeProgress);

    el.textContent = isMoney ? `¥${value.toLocaleString()}` : value;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = isMoney ? `¥${targetVal.toLocaleString()}` : targetVal;
    }
  }

  requestAnimationFrame(step);
}

// 2. ゲーム状態
let state = createInitialState();

function createInitialState(playerName = '合格太郎') {
  return {
    playerName: playerName,
    year: 1,
    month: 4,
    week: 1,
    totalTurn: 1,
    maxTurns: 144,

    course: '未定',
    club: '未定',
    targetUniv: null,

    daijobuAppeared: false,
    kyotsuDone: false,
    secondaryDone: false,

    stamina: 80,
    maxStamina: 100,
    stress: 10,
    motivation: 2,
    money: 3000,

    subjects: {
      eng:  { score: 38, exp: 0, nextExp: 20 },
      math: { score: 35, exp: 0, nextExp: 20 },
      jp:   { score: 40, exp: 0, nextExp: 20 },
      sci:  { score: 36, exp: 0, nextExp: 20 }
    },

    traits: [],

    friends: {
      aoi: { met: false, affection: 0 },
      shindo: { met: false, affection: 0 }
    },
    hasAmulet: false,

    history: []
  };
}

const MOTIVATIONS = [
  { label: '絶不調', class: 'terrible', multiplier: 0.7, failPenalty: 25 },
  { label: '不調', class: 'bad', multiplier: 0.85, failPenalty: 15 },
  { label: '普通', class: 'normal', multiplier: 1.0, failPenalty: 0 },
  { label: '好調', class: 'good', multiplier: 1.15, failPenalty: -5 },
  { label: '絶好調', class: 'great', multiplier: 1.3, failPenalty: -10 }
];

const UNIV_LIST = [
  { id: 'todai', name: '東京大学・京都大学', border: 72, desc: '国内最高峰。全教科で圧倒的偏差値と金特が必要。' },
  { id: 'waseda', name: '早稲田大学・慶應義塾大学', border: 66, desc: '最難関私立。特化型の高い学力と本番力が要求される。' },
  { id: 'march', name: 'MARCH・関関同立', border: 58, desc: '人気難関私立。バランスの取れた学力で合格を狙う。' },
  { id: 'kokuritsu', name: '地方国公立大学', border: 54, desc: '共通テスト重視。全教科で安定した得点力が必須。' },
  { id: 'standard', name: '中堅私立大学', border: 46, desc: 'まずはここを確実に押さえる。基本問題が鍵。' }
];

const TRAITS_MASTER = [
  { id: 'strong_exam', name: '本番に強い', desc: '模試や本番試験で偏差値+5の補正ボーナス！', type: 'blue' },
  { id: 'speed_reading', name: '速読術', desc: '英語・国語の学習で獲得できる経験値+25%', type: 'blue' },
  { id: 'focus_mind', name: '集中力◯', desc: '勉強の失敗率が半減する', type: 'blue' },
  { id: 'night_owl', name: '夜型集中', desc: '勉強時の獲得経験値がすべて+15%', type: 'blue' },
  { id: 'morning_bird', name: '朝型習慣', desc: '体力の回復量が常に+10', type: 'blue' },
  { id: 'review_master', name: '復習上手', desc: '模試やテストを受けた後の全科目経験値ボーナスUP', type: 'blue' },

  { id: 'miracle_pass', name: '逆転合格の奇跡', desc: '【金特】入試本番でE判定でも驚異的な底力を発揮する', type: 'gold' },
  { id: 'math_spark', name: '数理の閃き', desc: '【金特】数学・理科の難問が自動で部分点/正解に変化する', type: 'gold' },
  { id: 'lang_master', name: '言語の極意', desc: '【金特】英語・国語の長文読解で無類の安定感を誇る', type: 'gold' },

  { id: 'careless_mistake', name: 'ケアレスミス癖', desc: '【赤特】模試や本番で30%の確率で失点する', cureMoney: 2000, type: 'red' },
  { id: 'weak_exam', name: '本番に弱い', desc: '【赤特】模試や入試で緊張し偏差値-5補正', cureMoney: 2000, type: 'red' },
  { id: 'sns_addict', name: 'SNS中毒', desc: '【赤特】勉強時に15%の確率でサボりが発生する', cureMoney: 1500, type: 'red' },
  { id: 'insomnia', name: '不眠症', desc: '【赤特】休養コマンドの体力回復量が半減する', cureMoney: 1500, type: 'red' }
];

function getRank(score) {
  if (score >= 75) return { rank: 'S', class: 'rank-s' };
  if (score >= 68) return { rank: 'A', class: 'rank-a' };
  if (score >= 62) return { rank: 'B', class: 'rank-b' };
  if (score >= 55) return { rank: 'C', class: 'rank-c' };
  if (score >= 48) return { rank: 'D', class: 'rank-d' };
  if (score >= 40) return { rank: 'E', class: 'rank-e' };
  if (score >= 35) return { rank: 'F', class: 'rank-f' };
  return { rank: 'G', class: 'rank-g' };
}

// ================= モーダル＆イベントキューシステム =================
// 複数のモーダルやイベントが重なっても順番に1つずつ表示する仕組み
const modalQueue = [];
let isModalShowing = false;

function enqueueModal(modalFn) {
  modalQueue.push(modalFn);
  if (!isModalShowing) {
    showNextModal();
  }
}

function showNextModal() {
  if (modalQueue.length === 0) {
    isModalShowing = false;
    return;
  }
  isModalShowing = true;
  const nextFn = modalQueue.shift();
  nextFn();
}

// ================= スタート画面処理 =================

function startGame() {
  playSound('start');
  const nameInput = document.getElementById('player-name-input');
  const playerName = (nameInput.value.trim()) || '合格太郎';

  state = createInitialState(playerName);
  initInnateTraits();

  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('main-game-screen').style.display = 'flex';

  setDialog('担任の先生', `${state.playerName}、今日から高校生活が始まるぞ！3年後の志望校合格に向けて、毎日の積み重ねを大切にしよう！`);
  renderUI();
}

function returnToTitle() {
  playSound('click');
  document.getElementById('event-modal').classList.remove('active');
  document.getElementById('main-game-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
}

function openHowToPlayModal() {
  playSound('click');
  document.getElementById('how-to-modal').classList.add('active');
}
function closeHowToPlayModal() {
  playSound('click');
  document.getElementById('how-to-modal').classList.remove('active');
}

function openOBRosterModal() {
  playSound('click');
  const body = document.getElementById('ob-modal-body');
  body.innerHTML = '';

  const obDataStr = localStorage.getItem('juken_success_ob');
  if (obDataStr) {
    try {
      const ob = JSON.parse(obDataStr);
      body.innerHTML = `
        <div class="ob-history-card">
          <div class="avatar">👨‍🎓</div>
          <div class="info">
            <div class="name">${ob.name} 先輩</div>
            <div class="univ">🌸 【${ob.univ}】 現役合格！</div>
            <div class="date">合格年: ${ob.year}年 / 習得特能数: ${ob.traitsCount}個</div>
          </div>
        </div>
        <p style="font-size:0.75rem; color:#475569; margin-top:8px;">
          ※登録された先輩は、2周目以降の高校生活で激励に現れ、大量の経験値を差し入れしてくれます！
        </p>
      `;
    } catch(e) {}
  } else {
    body.innerHTML = `
      <div style="text-align: center; padding: 20px 0; color: #64748b; font-size: 0.85rem; font-weight: 700;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🎓</div>
        まだ合格実績データがありません。<br>
        第一志望大学に合格してゲームをクリアすると、<br>
        ここにあなたのキャラが栄光のOBとして登録されます！
      </div>
    `;
  }

  document.getElementById('ob-modal').classList.add('active');
}
function closeOBRosterModal() {
  playSound('click');
  document.getElementById('ob-modal').classList.remove('active');
}

function switchTab(tabName) {
  playSound('click');
  ['academic', 'traits', 'relations', 'history'].forEach(t => {
    document.getElementById(`tab-content-${t}`).style.display = (t === tabName) ? 'block' : 'none';
    document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === tabName);
  });
}

function renderUI() {
  document.getElementById('turn-year').textContent = `${state.year}年目`;
  document.getElementById('turn-month-week').textContent = `${state.month}月 ${state.week}週`;
  const remaining = state.maxTurns - state.totalTurn + 1;
  document.getElementById('turn-count').textContent = `残り ${remaining} 週`;

  const univBadge = document.getElementById('target-univ-badge');
  if (state.targetUniv) {
    univBadge.textContent = `志望: ${state.targetUniv.name} (${state.targetUniv.border})`;
  } else {
    univBadge.textContent = '志望校: 未決定 (高3決定)';
  }

  document.getElementById('scene-course-badge').textContent = `コース: ${state.course} | 部活: ${state.club}`;

  const mot = MOTIVATIONS[state.motivation];
  const motBadge = document.getElementById('motivation-badge');
  motBadge.textContent = mot.label;
  motBadge.className = `motivation-badge ${mot.class}`;

  document.getElementById('stamina-text').textContent = `${state.stamina} / ${state.maxStamina}`;
  const stamBar = document.getElementById('stamina-bar');
  const stamPercent = Math.max(0, Math.min(100, (state.stamina / state.maxStamina) * 100));
  stamBar.style.width = `${stamPercent}%`;
  stamBar.className = 'bar-inner stamina-bar';
  if (stamPercent <= 25) stamBar.classList.add('danger');
  else if (stamPercent <= 50) stamBar.classList.add('warning');

  document.getElementById('stress-text').textContent = `${state.stress}%`;
  const stressBar = document.getElementById('stress-bar');
  stressBar.style.width = `${state.stress}%`;
  stressBar.className = 'bar-inner stress-bar';
  if (state.stress >= 70) stressBar.classList.add('danger');

  const moneyEl = document.getElementById('money-text');
  animateNumberValue(moneyEl, state.money, false, true);

  const sciLabel = state.course === '理系' ? '理科(物化)' : (state.course === '文系' ? '社会(歴公)' : '理科/社会');
  document.getElementById('subj-name-sci').textContent = sciLabel;
  const studySciLabel = document.getElementById('study-name-sci');
  if (studySciLabel) studySciLabel.textContent = `${sciLabel}の集中学習`;

  const subjs = ['eng', 'math', 'jp', 'sci'];
  subjs.forEach(s => {
    const data = state.subjects[s];
    const rankInfo = getRank(data.score);

    const rankEl = document.getElementById(`rank-${s}`);
    const scoreEl = document.getElementById(`val-${s}`);
    const nextEl = document.getElementById(`next-${s}`);
    const barEl = document.getElementById(`bar-${s}`);

    rankEl.textContent = rankInfo.rank;
    rankEl.className = `subj-rank ${rankInfo.class}`;
    animateNumberValue(scoreEl, data.score, true, false);

    const remainingExp = data.nextExp - data.exp;
    nextEl.textContent = `次まで ${remainingExp} pt`;

    const progressPercent = Math.min(100, Math.floor((data.exp / data.nextExp) * 100));
    barEl.style.width = `${progressPercent}%`;
  });

  renderTraitsSummary();
  renderTraitsDetailTab();
  renderRelationsGrid();
  renderHistoryList();
}

function renderTraitsSummary() {
  const container = document.getElementById('traits-summary-list');
  container.innerHTML = '';
  if (state.traits.length === 0) {
    container.innerHTML = '<span class="trait-badge empty">特能なし</span>';
  } else {
    state.traits.forEach(tId => {
      const trait = TRAITS_MASTER.find(t => t.id === tId);
      if (trait) {
        const badge = document.createElement('span');
        let typeClass = '';
        if (trait.type === 'gold') typeClass = 'gold';
        else if (trait.type === 'red') typeClass = 'red';
        badge.className = `trait-badge ${typeClass}`;
        badge.textContent = trait.name;
        container.appendChild(badge);
      }
    });
  }
}

function renderTraitsDetailTab() {
  const container = document.getElementById('traits-detail-list');
  container.innerHTML = '';
  if (state.traits.length === 0) {
    container.innerHTML = '<div class="history-item empty">現在習得している特殊能力はありません。<br>日々の勉強やイベントで閃くことがあります！</div>';
    return;
  }
  state.traits.forEach(tId => {
    const trait = TRAITS_MASTER.find(t => t.id === tId);
    if (!trait) return;
    const card = document.createElement('div');
    card.className = `trait-detail-card ${trait.type}`;
    card.innerHTML = `
      <div class="trait-detail-info">
        <div class="t-name">${trait.name} ${trait.type === 'gold' ? '👑' : (trait.type === 'red' ? '⚠️' : '🔹')}</div>
        <div class="t-desc">${trait.desc}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderRelationsGrid() {
  const container = document.getElementById('relations-grid');
  container.innerHTML = '';

  // 1. あおい
  const aoiCard = document.createElement('div');
  if (state.friends.aoi.met) {
    aoiCard.className = 'relation-card';
    aoiCard.innerHTML = `
      <div class="rel-avatar">👧</div>
      <div class="rel-info">
        <div class="rel-name">あおい (幼馴染)</div>
        <div class="rel-bar-row">
          <span>好感度: <b>${state.friends.aoi.affection}%</b></span>
          <div class="bar-outer mini"><div class="bar-inner rel-bar" style="width:${state.friends.aoi.affection}%"></div></div>
        </div>
        <div class="rel-desc">${state.hasAmulet ? '🌸 合格祈願お守りをもらった！' : '一緒に息抜きや自習ができる。好感度高でお守り？'}</div>
      </div>
    `;
  } else {
    aoiCard.className = 'relation-card unmet';
    aoiCard.innerHTML = `
      <div class="rel-avatar">❓</div>
      <div class="rel-info">
        <div class="rel-name">？？？ (未遭遇)</div>
        <div class="rel-desc">高校生活の中で誰かと再会するかも…？</div>
      </div>
    `;
  }
  container.appendChild(aoiCard);

  // 2. 神童くん
  const shindoCard = document.createElement('div');
  if (state.friends.shindo.met) {
    shindoCard.className = 'relation-card';
    shindoCard.innerHTML = `
      <div class="rel-avatar">👦</div>
      <div class="rel-info">
        <div class="rel-name">神童くん (学年1位の秀才)</div>
        <div class="rel-bar-row">
          <span>友好度: <b>${state.friends.shindo.affection}%</b></span>
          <div class="bar-outer mini"><div class="bar-inner rel-bar" style="width:${state.friends.shindo.affection}%"></div></div>
        </div>
        <div class="rel-desc">ファミレスで勉強法を教えてくれる良きライバル。</div>
      </div>
    `;
  } else {
    shindoCard.className = 'relation-card unmet';
    shindoCard.innerHTML = `
      <div class="rel-avatar">❓</div>
      <div class="rel-info">
        <div class="rel-name">？？？ (未遭遇)</div>
        <div class="rel-desc">テストや模試で好成績を残すと出会えるかも…？</div>
      </div>
    `;
  }
  container.appendChild(shindoCard);

  // 3. OB先輩
  const obData = localStorage.getItem('juken_success_ob');
  const obCard = document.createElement('div');
  if (obData) {
    try {
      const ob = JSON.parse(obData);
      obCard.className = 'relation-card';
      obCard.innerHTML = `
        <div class="rel-avatar">👨‍🎓</div>
        <div class="rel-info">
          <div class="rel-name">${ob.name}先輩 (${ob.univ}合格OB)</div>
          <div class="rel-desc">前周回クリアデータより来校！大量経験値やアドバイスをくれます。</div>
        </div>
      `;
    } catch(e) {}
  } else {
    obCard.className = 'relation-card unmet';
    obCard.innerHTML = `
      <div class="rel-avatar">🎓</div>
      <div class="rel-info">
        <div class="rel-name">OBの先輩 (未登録)</div>
        <div class="rel-desc">大学に合格してゲームをクリアすると、次周回でOBとして登場！</div>
      </div>
    `;
  }
  container.appendChild(obCard);
}

function renderHistoryList() {
  const el = document.getElementById('history-list');
  el.innerHTML = '';
  if (state.history.length === 0) {
    el.innerHTML = '<div class="history-item empty">まだ模試や定期テストの記録はありません。</div>';
    return;
  }
  state.history.forEach(h => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = h;
    el.appendChild(item);
  });
}

function setDialog(speaker, message) {
  document.getElementById('dialog-name').textContent = speaker;
  document.getElementById('dialog-content').textContent = message;
}

function advanceTurn() {
  state.totalTurn++;
  state.week++;
  if (state.week > 4) {
    state.week = 1;
    state.month++;
    if (state.month > 12) {
      state.month = 1; // 12月の次は1月（同じ学年）
    } else if (state.month === 4) {
      state.year++; // 3月4週の次（4月1週）に学年が上がる！
    }
  }

  if (state.week === 1) {
    state.money += 3500;
  }

  renderUI();

  if (state.totalTurn > state.maxTurns) {
    triggerGameEnd();
    return;
  }

  checkScheduledEvents();
}

function addExpToSubject(subjectKey, amount) {
  const subj = state.subjects[subjectKey];
  subj.exp += amount;

  let levelUps = 0;
  while (subj.exp >= subj.nextExp) {
    subj.exp -= subj.nextExp;
    subj.score += 1;
    levelUps++;
    subj.nextExp = Math.floor(20 + (subj.score - 30) * 0.8);
  }
  return levelUps;
}

function openStudyMenu() {
  playSound('click');
  document.getElementById('study-modal').classList.add('active');
}
function closeStudyMenu() {
  document.getElementById('study-modal').classList.remove('active');
}

function executeStudy(subject) {
  closeStudyMenu();

  if (state.traits.includes('sns_addict') && Math.random() < 0.2) {
    playSound('fail');
    state.stamina = Math.max(0, state.stamina - 10);
    state.stress = Math.min(100, state.stress + 5);
    enqueueModal(() => {
      showEventModal(
        '📱 SNS中毒が発動…！',
        '勉強しようとスマホを開いたはずが、気づけば動画やSNSを1時間見続けてしまった…！',
        ['勉強サボり発生', '体力 -10', '経験値獲得なし'],
        '📱',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, 'うわああ！ちょっとスマホを見ただけなのに…！');
    renderUI();
    return;
  }

  let stamCost = 15;
  let stressCost = 6;
  if (subject === 'math') { stamCost = 18; stressCost = 8; }
  if (subject === 'jp') { stamCost = 12; stressCost = 4; }
  if (subject === 'all') { stamCost = 24; stressCost = 12; }

  if (state.club === '運動部') stamCost += 3;

  let failRate = 0;
  if (state.stamina < 40) failRate = (40 - state.stamina) * 1.5;
  if (state.stamina < 15) failRate = 75;
  if (state.traits.includes('focus_mind')) failRate = Math.floor(failRate / 2);
  failRate += MOTIVATIONS[state.motivation].failPenalty;
  if (state.stress > 70) failRate += 15;
  failRate = Math.max(0, Math.min(95, failRate));

  const isFailed = Math.random() * 100 < failRate;

  if (isFailed) {
    playSound('fail');
    triggerScreenShake();
    showFloatingText('勉強失敗…！', null, null, 'damage');
    state.stamina = Math.max(0, state.stamina - Math.floor(stamCost * 1.2));
    state.stress = Math.min(100, state.stress + 10);

    let motDown = false;
    if (state.motivation > 0 && Math.random() < 0.5) {
      state.motivation--;
      motDown = true;
    }

    let gotBadTrait = false;
    if (state.stress >= 80 && !state.traits.includes('insomnia') && Math.random() < 0.3) {
      state.traits.push('insomnia');
      gotBadTrait = true;
    }

    enqueueModal(() => {
      showEventModal(
        '😫 勉強失敗…！',
        '集中力が切れて机に突っ伏して寝てしまった…！',
        [
          `体力 -${Math.floor(stamCost * 1.2)}`,
          'ストレス +10%',
          motDown ? `やる気ダウン ⤵ (${MOTIVATIONS[state.motivation].label})` : '経験値は獲得できなかった',
          gotBadTrait ? '【赤特】不眠症 を発症してしまった！' : ''
        ].filter(Boolean),
        '💤',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '集中が続かない…少し休んで頭をすっきりさせなきゃ。');
  } else {
    state.stamina = Math.max(0, state.stamina - stamCost);
    state.stress = Math.min(100, state.stress + stressCost);

    const motMulti = MOTIVATIONS[state.motivation].multiplier;
    let baseExp = 18;
    if (state.traits.includes('night_owl')) baseExp *= 1.15;

    const isZone = Math.random() < 0.12;
    const zoneBonus = isZone ? 1.6 : 1.0;

    let rewardLines = [`体力 -${stamCost} / ストレス +${stressCost}%`];
    let anyLevelUp = false;

    if (subject === 'all') {
      const pts = Math.round((baseExp * 0.7) * motMulti * zoneBonus);
      const subjs = ['eng', 'math', 'jp', 'sci'];
      subjs.forEach(s => {
        const up = addExpToSubject(s, pts);
        if (up > 0) anyLevelUp = true;
      });
      rewardLines.push(`全科目経験値: 各 +${pts} pt 獲得！`);
      showFloatingText(`全科目 +${pts} pt`, null, null, 'exp');
    } else {
      let mult = 1.0;
      if (state.traits.includes('speed_reading') && (subject === 'eng' || subject === 'jp')) mult = 1.25;
      if (state.club === '文化部' && (subject === 'eng' || subject === 'jp')) mult = 1.2;

      const gainedExp = Math.round(baseExp * motMulti * zoneBonus * mult);
      const levelUps = addExpToSubject(subject, gainedExp);

      const subjNames = { eng: '英語', math: '数学', jp: '国語', sci: document.getElementById('subj-name-sci').textContent };
      rewardLines.push(`${subjNames[subject]}経験値: +${gainedExp} pt 獲得！`);
      showFloatingText(`${subjNames[subject]} +${gainedExp} pt`, null, null, 'exp');

      if (levelUps > 0) {
        anyLevelUp = true;
        rewardLines.push(`🎉 【${subjNames[subject]} 偏差値 UP! ➔ ${state.subjects[subject].score}】`);
      }
    }

    if (anyLevelUp) {
      playSound('levelup');
      showFloatingText('偏差値 UP! ⤴', null, null, 'levelup');
      triggerParticles(null, null, 24, 'gold');
      triggerScreenBounce();
    } else {
      playSound('success');
      if (isZone) {
        triggerParticles(null, null, 28, 'gold');
        triggerScreenBounce();
      } else {
        triggerParticles(null, null, 12, 'star');
      }
    }

    let flashTrait = null;
    if (isZone && !state.traits.includes('focus_mind') && Math.random() < 0.25) {
      state.traits.push('focus_mind');
      flashTrait = '集中力◯';
      rewardLines.push(`✨ 特能閃き！【${flashTrait}】を体得した！`);
    }

    enqueueModal(() => {
      showEventModal(
        isZone ? '⚡ ゾーン突入！大成功！' : '📖 勉強完了',
        isZone ? 'ものすごい集中力で理解が一気に深まった！経験値大幅UP！' : 'しっかり身についた！継続は力なりだ。',
        rewardLines,
        isZone ? '✨' : '📖',
        () => advanceTurn()
      );
    });

    if (isZone) {
      setDialog(state.playerName, '手応えがすごい！この調子で偏差値を伸ばしていこう！');
    } else {
      setDialog(state.playerName, 'しっかり身についた！継続は力なりだ。');
    }
  }

  renderUI();
}

function executeRest() {
  playSound('rest');
  let recovery = 45 + Math.floor(Math.random() * 10);
  if (state.traits.includes('morning_bird')) recovery += 10;
  if (state.traits.includes('insomnia')) recovery = Math.floor(recovery * 0.6);

  state.stamina = Math.min(state.maxStamina, state.stamina + recovery);
  state.stress = Math.max(0, state.stress - 25);

  showFloatingText(`体力 +${recovery}`, null, null, 'heal');
  triggerParticles(null, null, 16, 'heal');
  triggerScreenBounce();

  let motUp = false;
  if (state.motivation < 4 && Math.random() < 0.4) {
    state.motivation++;
    motUp = true;
  }

  enqueueModal(() => {
    showEventModal(
      '🛌 しっかり休養',
      state.traits.includes('insomnia')
        ? '不眠症のせいで浅い眠りだったが、体力を少し回復した。'
        : 'ゆっくりお風呂に入って熟睡した！心身ともにリフレッシュ！',
      [
        `体力 +${recovery} 回復`,
        'ストレス -25%',
        motUp ? `やる気アップ ⤴ (${MOTIVATIONS[state.motivation].label})` : '体調万全！'
      ],
      '🌿',
      () => advanceTurn()
    );
  });

  setDialog(state.playerName, 'よく寝たー！リフレッシュできたぞ！');
  renderUI();
}

function openPlayMenu() {
  playSound('click');
  const container = document.getElementById('play-options-container');
  container.innerHTML = '';

  const btnAlone = document.createElement('button');
  btnAlone.className = 'study-card-btn';
  btnAlone.onclick = () => executePlay('alone');
  btnAlone.innerHTML = `
    <span class="icon">🎮</span>
    <div class="info">
      <div class="name">ゲーム・マンガで息抜き</div>
      <div class="desc">ストレス-25 / やる気UP (費用: ¥0)</div>
    </div>
  `;
  container.appendChild(btnAlone);

  const btnAoi = document.createElement('button');
  if (state.friends.aoi.met) {
    btnAoi.className = 'study-card-btn';
    btnAoi.onclick = () => executePlay('aoi');
    btnAoi.innerHTML = `
      <span class="icon">👧</span>
      <div class="info">
        <div class="name">あおいとカフェで自習＆おしゃべり</div>
        <div class="desc">あおいの好感度UP / ストレス-35 (費用: ¥800)</div>
      </div>
    `;
  } else {
    btnAoi.className = 'study-card-btn locked';
    btnAoi.innerHTML = `
      <span class="icon">🔒</span>
      <div class="info">
        <div class="name">？？？ (未解放)</div>
        <div class="desc">まだ一緒に出かける相手と出会っていません</div>
      </div>
    `;
  }
  container.appendChild(btnAoi);

  const btnShindo = document.createElement('button');
  if (state.friends.shindo.met) {
    btnShindo.className = 'study-card-btn';
    btnShindo.onclick = () => executePlay('shindo');
    btnShindo.innerHTML = `
      <span class="icon">👦</span>
      <div class="info">
        <div class="name">神童くんとファミレスで受験戦略会議</div>
        <div class="desc">神童の友好度UP / 数学経験値ボーナス (費用: ¥1,000)</div>
      </div>
    `;
  } else {
    btnShindo.className = 'study-card-btn locked';
    btnShindo.innerHTML = `
      <span class="icon">🔒</span>
      <div class="info">
        <div class="name">？？？ (未解放)</div>
        <div class="desc">まだライバルと出会っていません</div>
      </div>
    `;
  }
  container.appendChild(btnShindo);

  document.getElementById('play-modal').classList.add('active');
}
function closePlayMenu() {
  document.getElementById('play-modal').classList.remove('active');
}

function executePlay(type) {
  closePlayMenu();

  if (type === 'alone') {
    playSound('click');
    showFloatingText('やる気 UP! ⤴', null, null, 'mood');
    triggerParticles(null, null, 16, 'mood');
    triggerScreenBounce();
    state.stress = Math.max(0, state.stress - 25);
    if (state.motivation < 4) state.motivation++;
    enqueueModal(() => {
      showEventModal(
        '🎮 ゲーム＆マンガで息抜き',
        '思いっきり遊んでストレスをしっかり発散した！',
        ['ストレス -25%', 'やる気アップ ⤴ (' + MOTIVATIONS[state.motivation].label + ')'],
        '🎮',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '楽しかった！これでまた勉強に集中できるぞ！');
  } else if (type === 'aoi') {
    if (state.money < 800) {
      playSound('fail');
      alert('お小遣いが足りません！');
      return;
    }
    playSound('success');
    state.money -= 800;
    state.stress = Math.max(0, state.stress - 35);
    state.friends.aoi.affection = Math.min(100, state.friends.aoi.affection + 15);
    if (state.motivation < 4) state.motivation++;

    let traitMsg = '';
    if (state.friends.aoi.affection >= 85 && !state.traits.includes('miracle_pass')) {
      state.traits.push('miracle_pass');
      traitMsg = '✨ 金特【逆転合格の奇跡】を習得した！';
    }

    enqueueModal(() => {
      showEventModal(
        '👧 あおいとカフェで自習＆おしゃべり',
        'お互いの志望校や将来の夢について語り合い、心の支えができた。',
        [
          `あおいの好感度 +15% (現在:${state.friends.aoi.affection}%)`,
          'ストレス -35%',
          'やる気アップ ⤴',
          'お小遣い -¥800',
          traitMsg
        ].filter(Boolean),
        '☕',
        () => advanceTurn()
      );
    });
    setDialog('あおい', '一緒に勉強できて嬉しい！絶対に志望校合格しようね！');
  } else if (type === 'shindo') {
    if (state.money < 1000) {
      playSound('fail');
      alert('お小遣いが足りません！');
      return;
    }
    playSound('success');
    state.money -= 1000;
    state.stress = Math.max(0, state.stress - 20);
    state.friends.shindo.affection = Math.min(100, state.friends.shindo.affection + 15);

    addExpToSubject('math', 20);
    addExpToSubject('eng', 15);

    let traitMsg = '';
    if (state.friends.shindo.affection >= 60 && !state.traits.includes('math_spark')) {
      state.traits.push('math_spark');
      traitMsg = '✨ 金特【数理の閃き】を伝授された！';
    }

    enqueueModal(() => {
      showEventModal(
        '👦 神童くんとファミレスで受験戦略会議',
        '神童くんから「難問の着眼点と別解」を徹底伝授された！',
        [
          `神童の友好度 +15% (現在:${state.friends.shindo.affection}%)`,
          '数学経験値 +20 pt / 英語経験値 +15 pt 獲得！',
          'ストレス -20%',
          'お小遣い -¥1,000',
          traitMsg
        ].filter(Boolean),
        '📐',
        () => advanceTurn()
      );
    });
    setDialog('神童くん', 'お前の理解スピード、なかなかやるな。本番はお互い全力を尽くそう！');
  }

  renderUI();
}

function openStatusModal() {
  playSound('click');
  renderStatusProgress();
  renderRedTraitsShop();
  document.getElementById('status-modal').classList.add('active');
}
function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('active');
}

function renderStatusProgress() {
  const container = document.getElementById('status-progress-rows');
  container.innerHTML = '';

  const subjs = [
    { key: 'eng', name: '英語' },
    { key: 'math', name: '数学' },
    { key: 'jp', name: '国語' },
    { key: 'sci', name: document.getElementById('subj-name-sci').textContent }
  ];

  subjs.forEach(s => {
    const data = state.subjects[s.key];
    const row = document.createElement('div');
    row.className = 'upgrade-row';
    row.innerHTML = `
      <span class="up-name"><b>${s.name}</b> 偏差値: ${data.score}</span>
      <span class="up-cost">進捗: ${data.exp} / ${data.nextExp} EXP (次まで あと${data.nextExp - data.exp}pt)</span>
    `;
    container.appendChild(row);
  });
}

function renderRedTraitsShop() {
  const redSection = document.getElementById('red-traits-section');
  const shopEl = document.getElementById('red-traits-shop');
  shopEl.innerHTML = '';

  const ownedRedTraits = state.traits.filter(tId => {
    const t = TRAITS_MASTER.find(m => m.id === tId);
    return t && t.type === 'red';
  });

  if (ownedRedTraits.length === 0) {
    redSection.style.display = 'none';
    return;
  }

  redSection.style.display = 'block';
  ownedRedTraits.forEach(tId => {
    const trait = TRAITS_MASTER.find(m => m.id === tId);
    const card = document.createElement('div');
    card.className = 'trait-detail-card red';
    card.style.marginBottom = '6px';

    card.innerHTML = `
      <div class="trait-detail-info">
        <div class="t-name">⚠️ ${trait.name}</div>
        <div class="t-desc">${trait.desc}</div>
      </div>
      <button class="btn-up-action cure" onclick="cureRedTrait('${trait.id}')">
        カウンセリング克服 (¥${trait.cureMoney.toLocaleString()})
      </button>
    `;
    shopEl.appendChild(card);
  });
}

function cureRedTrait(traitId) {
  const trait = TRAITS_MASTER.find(t => t.id === traitId);
  if (!trait) return;

  if (state.money < trait.cureMoney) {
    playSound('fail');
    alert(`お小遣いが足りません！(必要: ¥${trait.cureMoney.toLocaleString()})`);
    return;
  }

  state.money -= trait.cureMoney;
  state.traits = state.traits.filter(t => t !== traitId);
  playSound('success');
  enqueueModal(() => {
    showEventModal('✨ 弱点克服！', `カウンセリングと自己改善により、【赤特】${trait.name} を完全に克服・消去した！`, [], '🎉');
  });
  renderUI();
  renderRedTraitsShop();
}

// 定期カレンダーイベント判定
function checkScheduledEvents() {
  const y = state.year;
  const m = state.month;
  const w = state.week;

  if (y === 1 && m === 4 && w === 2 && state.club === '未定') {
    enqueueModal(() => triggerClubChoice());
    return;
  }

  if (y === 1 && m === 4 && w === 4 && !state.friends.aoi.met) {
    enqueueModal(() => triggerAoiEncounter());
    return;
  }

  if (y === 1 && m === 5 && w === 4 && !state.friends.shindo.met) {
    enqueueModal(() => triggerShindoEncounter());
    return;
  }

  if (y === 1 && m === 11 && w === 1 && state.course === '未定') {
    enqueueModal(() => triggerCourseChoice());
    return;
  }

  if (y === 3 && m === 4 && w === 1 && !state.targetUniv) {
    enqueueModal(() => triggerTargetUnivChoice());
    return;
  }

  if (y === 3 && m === 12 && w === 3 && !state.hasAmulet && state.friends.aoi.met && state.friends.aoi.affection >= 70) {
    enqueueModal(() => triggerAmuletEvent());
    return;
  }

  if (y === 3 && m === 1 && w === 3 && !state.kyotsuDone) {
    state.kyotsuDone = true;
    enqueueModal(() => startExamBattle('kyotsu'));
    return;
  }

  if (y === 3 && m === 2 && w === 4 && !state.secondaryDone) {
    state.secondaryDone = true;
    enqueueModal(() => startExamBattle('secondary'));
    return;
  }

  if (w === 3 && (m === 5 || m === 10)) {
    enqueueModal(() => runSchoolExam());
    return;
  }

  if (w === 2 && ((y === 2 && (m === 6 || m === 11)) || (y === 3 && (m === 8 || m === 11)))) {
    enqueueModal(() => runMockExam());
    return;
  }

  if (!state.daijobuAppeared && ((y === 2 && m >= 7) || (y === 3 && m <= 8))) {
    if (Math.random() < 0.015) {
      enqueueModal(() => triggerDaijobuDoctor());
      return;
    }
  }

  if (localStorage.getItem('juken_success_ob') && Math.random() < 0.1) {
    enqueueModal(() => triggerOBVisit());
    return;
  }

  if (Math.random() < 0.15) {
    enqueueModal(() => runRandomFlavorEvent());
  }
}

function triggerAoiEncounter() {
  playSound('success');
  state.friends.aoi.met = true;
  state.friends.aoi.affection = 30;
  showEventModal(
    '🌸 懐かしい再会',
    `「あれ…？もしかして${state.playerName}くん！？やっぱりそうだ！同じ高校だったんだね！」\n中学の時の幼馴染・あおいと偶然下校途中で再会した！\n【あおい】と「息抜き」で一緒に自習できるようになりました！`,
    ['あおい が交友関係に解放！', 'やる気アップ ⤴'],
    '👧'
  );
  if (state.motivation < 4) state.motivation++;
  setDialog('あおい', 'またよろしくね！高校生活、一緒に頑張ろう！');
  renderUI();
}

function triggerShindoEncounter() {
  playSound('success');
  state.friends.shindo.met = true;
  state.friends.shindo.affection = 25;
  addExpToSubject('math', 20);

  showEventModal(
    '📐 学年1位の秀才・神童くん現る',
    '定期テストの順位表の前で声をかけられた。\n「君、なかなか面白い解き方をするね。僕の名前は神童。良きライバルとしてよろしく」\n【神童くん】と「息抜き」で情報交換できるようになりました！',
    ['神童くん が交友関係に解放！', '数学経験値 +20 pt 獲得！'],
    '👦'
  );
  setDialog('神童くん', 'お互い高め合おう。次のテストも楽しみにしているよ。');
  renderUI();
}

function triggerClubChoice() {
  showChoiceModal(
    '🏃 どの部活に入部する？',
    '部活に入ることで今後の成長スタイルが変化するぞ！',
    [
      {
        title: '運動部（体力おばけ型）',
        subtext: '体力上限+20 / 勉強時の消費体力+3',
        action: () => {
          state.club = '運動部';
          state.maxStamina += 20;
          state.stamina = state.maxStamina;
          setDialog('体育教師', '体力を鍛え上げれば受験の粘り強さにも繋がるぞ！');
          renderUI();
        }
      },
      {
        title: '文化部（語学・論理型）',
        subtext: '英語・国語の学習獲得経験値 +20%',
        action: () => {
          state.club = '文化部';
          setDialog('文化部部長', '知的好奇心を刺激するぞ！言葉と論理の力は大学受験でも最強の武器だ！');
          renderUI();
        }
      },
      {
        title: '帰宅部（自習特化型）',
        subtext: '体力消費標準 / 自分のペースで自由に行動できる',
        action: () => {
          state.club = '帰宅部';
          setDialog(state.playerName, '放課後は全部自習と予習に充てよう！効率重視でいくぞ！');
          renderUI();
        }
      }
    ],
    '🏅'
  );
}

function triggerCourseChoice() {
  showChoiceModal(
    '⚖️ 文理選択の決断',
    '高1の秋。大学入試の基本方針を決める時期だ。',
    [
      {
        title: '文系コース（国語・英語・社会重視）',
        subtext: '国英偏差値+2。理社が「社会(歴史・公民)」に変化。',
        action: () => {
          state.course = '文系';
          state.subjects.jp.score += 2;
          state.subjects.eng.score += 2;
          setDialog('進路指導', '文系だな！現代文の論理力と英語・社会の記述を鍛えよう！');
          renderUI();
        }
      },
      {
        title: '理系コース（数学・英語・理科重視）',
        subtext: '数理偏差値+2。理社が「理科(物理・化学)」に変化。',
        action: () => {
          state.course = '理系';
          state.subjects.math.score += 2;
          state.subjects.sci.score += 2;
          setDialog('進路指導', '理系だな！数学の思考力と理科の論証力が鍵だ！');
          renderUI();
        }
      }
    ],
    '🧭'
  );
}

function triggerTargetUnivChoice() {
  const options = UNIV_LIST.map(u => ({
    title: `${u.name} (ボーダー: 偏差値${u.border})`,
    subtext: u.desc,
    action: () => {
      state.targetUniv = u;
      enqueueModal(() => {
        showEventModal(
          `🎯 第1志望校決定！`,
          `【${u.name}】を第一志望に設定した！\n目標ボーダーは偏差値【${u.border}】だ！`,
          [`第1志望: ${u.name}`],
          '🏫'
        );
      });
      setDialog('担任の先生', `よし、高い目標を掲げたな！合格を勝ち取るために全力で行くぞ！`);
      renderUI();
    }
  }));

  showChoiceModal('🎓 志望校を決定しよう！', '高校3年生の春。いよいよ受験する大学のターゲットを定める時が来た！', options, '🏫');
}

function triggerDaijobuDoctor() {
  state.daijobuAppeared = true;
  playSound('fail');

  showChoiceModal(
    '🕶️ 謎の受験コンサルタント Dr.ダイジョーブ現る！',
    '「フッフッフ…君、難関大を目指しているのかね？\n私が開発した最新の《脳内シナプス超活性施術》を受けてみないかね…？\n成功すれば奇跡の天才頭脳を手に入れられるが、失敗すれば…フフフ」\n（※このチャンスは高校生活で一度きりです）',
    [
      {
        title: '施術を受ける！（ハイリスク・ハイリターン）',
        subtext: '成功率40%: 全教科偏差値+7 & 金特獲得 / 失敗率60%: 体力0 & 絶不調 & 赤特付与',
        action: () => {
          const success = Math.random() < 0.4;
          if (success) {
            playSound('success');
            ['eng', 'math', 'jp', 'sci'].forEach(s => {
              state.subjects[s].score += 7;
            });
            state.motivation = 4;
            const goldTrait = state.course === '理系' ? 'math_spark' : 'miracle_pass';
            if (!state.traits.includes(goldTrait)) state.traits.push(goldTrait);

            enqueueModal(() => {
              showEventModal(
                '💉 大成功！！脳が覚醒した！！',
                'Dr.ダイジョーブの施術により、頭の中の霧が一気に晴れ渡った！全知全能の感覚が全身を駆け巡る！！',
                [
                  '全教科 偏差値 +7 UP！！',
                  `金特 【${TRAITS_MASTER.find(t=>t.id===goldTrait).name}】 習得！`,
                  'やる気 絶好調！！'
                ],
                '🧬'
              );
            });
            setDialog('Dr.ダイジョーブ', 'フハハハ！実験は大成功だ！世界を変える頭脳を存分に振るうがいい！');
          } else {
            playSound('fail');
            state.stamina = 0;
            state.motivation = 0;
            state.stress = 100;
            if (!state.traits.includes('insomnia')) state.traits.push('insomnia');
            if (!state.traits.includes('careless_mistake')) state.traits.push('careless_mistake');

            enqueueModal(() => {
              showEventModal(
                '💥 施術大失敗……！！',
                '「バチチチッ！…おや、電圧を間違えたかね？」\n激しい頭痛と眩暈が襲いかかり、立っていることもできない…！',
                [
                  '体力 0 に低下…',
                  'やる気 絶不調 に転落…',
                  'ストレス 100% (極限)',
                  '【赤特】不眠症 を獲得…',
                  '【赤特】ケアレスミス癖 を獲得…'
                ],
                '💀'
              );
            });
            setDialog('Dr.ダイジョーブ', 'し、失敬！少々副作用が出たようだ！サヨウナラ〜！(煙と共に消えた)');
          }
          renderUI();
        }
      },
      {
        title: '怪しすぎるので断る（無難にやり過ごす）',
        subtext: '何も起きない。自分の努力でコツコツ合格を目指す。',
        action: () => {
          enqueueModal(() => {
            showEventModal('🚶 勧誘を断った', '怪しい提案を断り、安全にその場を立ち去った。地道に頑張るのが一番だ。', [], '🛡️');
          });
          setDialog(state.playerName, 'あぶないあぶない…怪しい裏技に頼らず、自分の力で合格してみせるぞ！');
          renderUI();
        }
      }
    ],
    '🕶️'
  );
}

function triggerAmuletEvent() {
  playSound('success');
  state.hasAmulet = true;
  state.motivation = 4;
  showEventModal(
    '🌸 あおいからの贈り物',
    '「これ、学問の神様で有名な神社で並んで買ってきたの…！\nずっと頑張ってきたの見てたから。絶対に受かってね！」\n【合格祈願お守り】を受け取った！本番の試験でピンチを1度無効化してくれる！',
    ['【合格祈願お守り】獲得！', 'やる気 絶好調！！'],
    '🎁'
  );
  setDialog('あおい', '私の全部の運をあげる！絶対に合格して一緒に桜見ようね！');
  renderUI();
}

function triggerOBVisit() {
  playSound('success');
  const ob = JSON.parse(localStorage.getItem('juken_success_ob'));
  ['eng', 'math', 'jp', 'sci'].forEach(s => {
    addExpToSubject(s, 25);
  });
  if (state.motivation < 4) state.motivation++;

  showEventModal(
    `👨‍🎓 ${ob.name}先輩の激励訪問！`,
    `前周回で見事【${ob.univ}】に合格した伝説の先輩が来校！\n「後輩よ、合格の秘訣は日々の復習と本番のメンタルだ！」と大量の参考書とノウハウを差し入れてくれた！`,
    ['全教科 経験値 +25 pt 獲得！', 'やる気アップ ⤴'],
    '👑'
  );
  setDialog(`${ob.name}先輩`, '俺に続け！お前なら絶対に志望校へ行けるぞ！');
  renderUI();
}

function runSchoolExam() {
  playSound('success');
  let avg = Math.round((state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score) / 4);
  let rankStr = '';
  let rewardText = '';

  if (avg >= 60) {
    rankStr = '学年トップクラス（上位10%）！先生や親に褒められた！';
    if (state.motivation < 4) state.motivation++;
    state.money += 2000;
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, 15));
    rewardText = '臨時お小遣い +¥2,000 / 全教科経験値 +15pt';
  } else if (avg >= 45) {
    rankStr = '学年平均レベル。基礎はできている。';
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, 8));
    rewardText = '全教科経験値 +8pt';
  } else {
    rankStr = '赤点ギリギリ…補習の危機！';
    if (state.motivation > 0) state.motivation--;
    rewardText = 'やる気ダウン…';
  }

  state.history.unshift(`${state.year}年${state.month}月 定期考査: 平均偏差値 ${avg} (${rankStr})`);

  showEventModal(
    '📝 校内定期考査 結果発表！',
    `全教科のテストが返却された！\n4教科平均偏差値: ${avg}\n${rankStr}`,
    [`平均偏差値: ${avg}`, rewardText],
    '📋'
  );
  setDialog('担任の先生', `定期テストの結果が出たぞ。偏差値は${avg}だ！慢心せず次へ向けろ！`);
  renderUI();
}

function runMockExam() {
  playSound('success');
  let totalScore = state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score;
  if (state.traits.includes('strong_exam')) totalScore += 12;
  if (state.traits.includes('weak_exam')) totalScore -= 12;

  let avg = Math.round(totalScore / 4);

  let targetBorder = state.targetUniv ? state.targetUniv.border : 60;
  let diff = avg - targetBorder;
  let judge = 'E';
  if (diff >= 3) judge = 'A';
  else if (diff >= 0) judge = 'B';
  else if (diff >= -4) judge = 'C';
  else if (diff >= -8) judge = 'D';

  const univName = state.targetUniv ? state.targetUniv.name : '志望大学';
  state.history.unshift(`${state.year}年${state.month}月 全国模試: 【${judge}判定】 (偏差値 ${avg})`);

  let traitMsg = '';
  if ((judge === 'A' || judge === 'B') && !state.traits.includes('strong_exam') && Math.random() < 0.4) {
    state.traits.push('strong_exam');
    traitMsg = '✨ 特能閃き！大舞台での自信から【本番に強い】を体得した！';
  }

  if (state.traits.includes('review_master')) {
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, 20));
  }

  showEventModal(
    '📊 全校統一マーク模試 結果！',
    `志望校【${univName}】の判定が返却された！\n\n判定：【 ${judge} 判定 】 (総合偏差値: ${avg})`,
    [
      `判定: ${judge}判定 (目標ボーダー:${targetBorder})`,
      judge === 'A' || judge === 'B' ? 'やる気 絶好調！！' : 'ここからの追い上げが勝負！',
      traitMsg
    ].filter(Boolean),
    '🎯'
  );

  if (judge === 'A' || judge === 'B') state.motivation = 4;
  setDialog('予備校アドバイザー', `現在の志望校判定は【${judge}判定】です。模試の弱点分野を徹底的に復習しましょう！`);
  renderUI();
}

function runRandomFlavorEvent() {
  const events = [
    {
      title: '🌟 自習室の仲間と切磋琢磨',
      text: '放課後の自習室で最後まで残って勉強した。心地よい達成感がある。',
      rewards: ['全科目経験値 +10 pt', 'ストレス -10%'],
      action: () => {
        ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, 10));
        state.stress = Math.max(0, state.stress - 10);
      },
      icon: '🏫'
    },
    {
      title: '📖 話題の参考書を購入！',
      text: '「わかりやすい！」と評判の良書を本屋で見つけて即買いした！',
      rewards: ['英語経験値 +25 pt', 'お小遣い -¥1,200'],
      action: () => {
        addExpToSubject('eng', 25);
        state.money = Math.max(0, state.money - 1200);
      },
      icon: '📚'
    },
    {
      title: '☀️ 朝の散歩でリフレッシュ',
      text: '早起きして朝日を浴びながら散歩した。頭がスッキリ冴え渡る！',
      rewards: ['体力 +15', 'やる気アップ ⤴'],
      action: () => {
        state.stamina = Math.min(state.maxStamina, state.stamina + 15);
        if (state.motivation < 4) state.motivation++;
      },
      icon: '🌅'
    }
  ];

  const ev = events[Math.floor(Math.random() * events.length)];
  ev.action();
  showEventModal(ev.title, ev.text, ev.rewards, ev.icon);
  renderUI();
}

// ================= 試験バトル演出 =================

let battleState = {
  examType: 'kyotsu',
  step: 0,
  maxSteps: 5,
  score: 0
};

function startExamBattle(type) {
  battleState.examType = type;
  battleState.step = 0;
  battleState.score = 0;

  const isKyotsu = type === 'kyotsu';
  const title = isKyotsu ? '🔥 大学入学共通テスト 本番！' : '🎓 国公立二次試験 / 私大個別入試 本番！';
  document.getElementById('battle-exam-title').textContent = title;
  document.getElementById('battle-current-score').textContent = `獲得得点: 0 / 500`;

  const term = document.getElementById('exam-log-terminal');
  term.innerHTML = `<div class="log-line">=== ${title} ===</div><div class="log-line">試験会場の張り詰めた空気の中、試験開始のチャイムが鳴り響いた！</div>`;

  document.getElementById('btn-battle-next').textContent = '大問1に挑む ▶';
  document.getElementById('btn-battle-next').onclick = () => advanceExamBattle();

  document.getElementById('exam-battle-modal').classList.add('active');
}

function advanceExamBattle() {
  playSound('battle_hit');
  battleState.step++;
  const step = battleState.step;

  const questions = [
    { name: '第1問：長文読解（英語）', subj: 'eng' },
    { name: '第2問：微積・数列（数学）', subj: 'math' },
    { name: '第3問：評論文・古文（国語）', subj: 'jp' },
    { name: '第4問：実験・論述（理社）', subj: 'sci' },
    { name: '第5問：最難関・総合記述問題', subj: 'math' }
  ];

  const q = questions[step - 1];
  document.getElementById('battle-subject-name').textContent = q.name;
  document.getElementById('exam-progress-fill').style.width = `${(step / 5) * 100}%`;

  const term = document.getElementById('exam-log-terminal');
  const baseScore = state.subjects[q.subj].score;
  let gained = Math.round(baseScore * 1.2) + Math.floor(Math.random() * 15);

  if (state.traits.includes('strong_exam')) {
    gained += 10;
    term.innerHTML += `<div class="log-line trait">【青特】「本番に強い」が発動！プレッシャーを味方につけた！</div>`;
  }
  if (state.traits.includes('math_spark') && (q.subj === 'math' || q.subj === 'sci')) {
    gained += 25;
    term.innerHTML += `<div class="log-line trait">【金特】「数理の閃き」が発動！！難問の突破口を瞬時に閃いた！</div>`;
    triggerParticles(null, null, 20, 'gold');
    triggerScreenBounce();
  }
  if (state.traits.includes('lang_master') && (q.subj === 'eng' || q.subj === 'jp')) {
    gained += 20;
    term.innerHTML += `<div class="log-line trait">【金特】「言語の極意」が発動！！論理展開を完璧に掌握した！</div>`;
    triggerParticles(null, null, 20, 'gold');
    triggerScreenBounce();
  }

  if (state.traits.includes('careless_mistake') && Math.random() < 0.35) {
    if (state.hasAmulet) {
      state.hasAmulet = false;
      term.innerHTML += `<div class="log-line trait">🌸 あおいの「合格祈願お守り」が輝いた！計算ミスを寸前で自覚して書き直した！</div>`;
      triggerParticles(null, null, 16, 'star');
    } else {
      gained -= 25;
      term.innerHTML += `<div class="log-line fail">【赤特】「ケアレスミス癖」発動…！符号の書き間違いで部分点を落とした！</div>`;
      triggerScreenShake();
      showFloatingText('-25点 痛恨のミス！', null, null, 'damage');
    }
  }

  gained = Math.max(10, Math.min(100, gained));
  battleState.score += gained;
  document.getElementById('battle-current-score').textContent = `獲得得点: ${battleState.score} / 500`;
  triggerParticles(null, null, 12, 'star');

  term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;
  term.scrollTop = term.scrollHeight;

  if (step >= 5) {
    document.getElementById('btn-battle-next').textContent = '試験終了！結果を確認 ▶';
    document.getElementById('btn-battle-next').onclick = () => finishExamBattle();
  } else {
    document.getElementById('btn-battle-next').textContent = `第${step + 1}問へ挑む ▶`;
  }
}

function finishExamBattle() {
  document.getElementById('exam-battle-modal').classList.remove('active');
  isModalShowing = false;
  const isKyotsu = battleState.examType === 'kyotsu';

  if (isKyotsu) {
    enqueueModal(() => {
      showEventModal(
        '📝 共通テスト終了！自己採点結果',
        `2日間の共通テストを戦い抜いた！\n獲得得点: 【 ${battleState.score} / 500 点 】\n(得点率: ${Math.round((battleState.score / 500) * 100)}%)\n\nいよいよ来月、運命の二次試験・個別入試だ！`,
        [`共通テスト得点: ${battleState.score}点`],
        '🎯',
        () => advanceTurn()
      );
    });
    setDialog('担任の先生', `よく戦った！共通テストの持ち点を活かして、2月の二次試験へ突っ走れ！`);
  } else {
    enqueueModal(() => {
      showEventModal(
        '🎓 全試験日程 終了！！',
        `高校3年間のすべてをぶつけた二次試験が終了した！\nすべての解答用紙を提出し終え、静かな開放感と緊張が胸を満たす。\n\nあとは3月の合格発表を待つのみだ……！`,
        [`二次試験得点: ${battleState.score}点`],
        '🌸',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, 'やれるだけのことは全部やった…！あとは合格発表を待つのみだ！');
  }

  renderUI();
}

function triggerGameEnd() {
  playSound('success');
  let avg = (state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score) / 4;
  if (state.traits.includes('miracle_pass')) avg += 8;

  const target = state.targetUniv || UNIV_LIST[2];
  const isPassed = avg >= (target.border - 2);

  let resultUnivName = isPassed ? target.name : '中堅私立大学';
  if (!isPassed && avg < 42) resultUnivName = '浪人';

  let title = '';
  let desc = '';

  if (isPassed) {
    title = `🌸 祝！【${target.name}】 現役合格！！ 🌸`;
    desc = `掲示板に自分の受験番号を見つけた瞬間、涙があふれ出した！\n3年間の弛まぬ努力が最高の栄冠をもたらした！\n晴れて夢のキャンパスライフが始まる！`;

    const obData = {
      name: state.playerName,
      univ: target.name,
      year: new Date().getFullYear(),
      traitsCount: state.traits.length
    };
    localStorage.setItem('juken_success_ob', JSON.stringify(obData));
  } else if (resultUnivName === '浪人') {
    title = '🍂 不合格……浪人決定 🍂';
    desc = `悔しくも第1志望には届かなかった…だが君の挑戦は終わらない。\n予備校でもう1年牙を研ぎ、来年こそ栄冠を掴み取れ！`;
  } else {
    title = `🌸 【${resultUnivName}】 合格！ 🌸`;
    desc = `第1志望には一歩及ばなかったが、併願大学に見事合格！\n大学で何を学ぶかは自分次第だ。胸を張って新しいスタートを切ろう！`;
  }

  enqueueModal(() => {
    if (isPassed) {
      triggerParticles(null, null, 40, 'confetti');
      triggerScreenBounce();
    } else {
      triggerScreenShake();
    }
    const modalFooter = document.getElementById('event-modal-footer');
    modalFooter.innerHTML = `
      <button class="btn-confirm" onclick="returnToTitle()">タイトル画面に戻る</button>
    `;

    showEventModal(
      title,
      `${desc}\n\n【最終成績】\n受験生: ${state.playerName}\n平均偏差値: ${Math.round(avg)}\n習得特能数: ${state.traits.length}個\nあおい好感度: ${state.friends.aoi.affection}%`,
      [
        isPassed ? '★ クリアデータをOB名簿に保存しました！次周回で家庭教師として登場します！' : 'タイトル画面からもう一度挑戦できます！'
      ],
      isPassed ? '🎓' : '📚'
    );
  });

  setDialog('担任の先生', `3年間の高校生活、本当によく頑張ったな！君のこれからの人生に大いなる幸あれ！`);
}

// 汎用イベントモーダル
let currentModalCallback = null;

function showEventModal(title, text, rewards = [], icon = '🎉', onConfirm = null) {
  currentModalCallback = onConfirm;

  document.getElementById('event-modal-title').textContent = title;
  document.getElementById('event-modal-text').textContent = text;
  document.getElementById('event-modal-icon').textContent = icon;

  const rewardsEl = document.getElementById('event-modal-rewards');
  rewardsEl.innerHTML = '';
  rewards.forEach(r => {
    const item = document.createElement('div');
    item.textContent = `▶ ${r}`;
    rewardsEl.appendChild(item);
  });

  const modalFooter = document.getElementById('event-modal-footer');
  if (state.totalTurn <= state.maxTurns) {
    modalFooter.innerHTML = `<button class="btn-confirm" onclick="closeEventModal()">OK</button>`;
  }

  document.getElementById('event-modal').classList.add('active');
}

function closeEventModal() {
  playSound('click');
  document.getElementById('event-modal').classList.remove('active');
  const cb = currentModalCallback;
  currentModalCallback = null;

  if (cb) {
    cb();
  }
  showNextModal();
}

function showChoiceModal(title, text, options = [], icon = '🤔') {
  playSound('click');
  document.getElementById('choice-modal-title').textContent = title;
  document.getElementById('choice-modal-text').textContent = text;
  document.getElementById('choice-modal-icon').textContent = icon;

  const btnContainer = document.getElementById('choice-buttons-container');
  btnContainer.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `${opt.title}<span class="subtext">${opt.subtext || ''}</span>`;
    btn.onclick = () => {
      playSound('click');
      document.getElementById('choice-modal').classList.remove('active');
      opt.action();
      showNextModal();
    };
    btnContainer.appendChild(btn);
  });

  document.getElementById('choice-modal').classList.add('active');
}

function initInnateTraits() {
  const roll = Math.random();
  if (roll < 0.05) {
    state.traits.push('math_spark');
  } else if (roll < 0.35) {
    state.traits.push('focus_mind');
  } else if (roll < 0.60) {
    state.traits.push('speed_reading');
  } else if (roll < 0.85) {
    state.traits.push('night_owl');
  } else {
    state.traits.push('careless_mistake');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('title-screen').style.display = 'flex';
  document.getElementById('main-game-screen').style.display = 'none';
});
