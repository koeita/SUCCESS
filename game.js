// ========================================================
// 受験サクセス 完全版ゲームエンジン（イベントキュー＆安定性強化版）
// ========================================================

// ========================================================
// 1. Web Audio API 音響エンジン & 各種設定システム
// ========================================================
const SAVE_KEY = 'juken_success_save';
const SETTINGS_KEY = 'juken_success_settings';

const defaultSettings = {
  isMuted: false,
  seVolume: 0.8,
  screenShake: true,
  particles: true
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  const legacyMuted = localStorage.getItem('juken_muted') === 'true';
  return { ...defaultSettings, isMuted: legacyMuted };
}

let settings = loadSettings();
let isMuted = settings.isMuted;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem('juken_muted', settings.isMuted);
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function toggleMute() {
  settings.isMuted = !settings.isMuted;
  isMuted = settings.isMuted;
  saveSettings();
  updateMuteUI();
  updateSettingsUI();
  if (!isMuted) {
    playSound('click');
  }
}

function updateMuteUI() {
  const icon = document.getElementById('mute-icon');
  const btn = document.getElementById('btn-mute-toggle');
  if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
  if (btn) btn.classList.toggle('muted', isMuted);
}

// ホバー音のスロットリング（高速移動時のノイズ化を防止）
let lastHoverSoundTime = 0;
function playHoverSound() {
  const now = performance.now();
  if (now - lastHoverSoundTime > 80) {
    lastHoverSoundTime = now;
    playSound('hover');
  }
}

function playSound(type) {
  if (isMuted || settings.seVolume <= 0) return;
  const vol = settings.seVolume;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    if (type === 'click') {
      // 軽快な打鍵クリック音（短く小気味よい）
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
      gain.gain.setValueAtTime(0.18 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);

    } else if (type === 'hover') {
      // 控えめで上質なUIフォーカス音（非常に短く耳障りにならない）
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(1300, now + 0.025);
      gain.gain.setValueAtTime(0.035 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.start(now);
      osc.stop(now + 0.025);

    } else if (type === 'start') {
      // ゲーム開始の上昇アルペジオ
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        const t = now + idx * 0.08;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });

    } else if (type === 'success') {
      // 爽快な和音上昇音（ド・ミ・ソ・ド）
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        const t = now + idx * 0.07;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });

    } else if (type === 'levelup') {
      // レベルアップ（劇的なファンファーレ和音）
      const chords = [
        [523.25, 659.25, 783.99],
        [587.33, 739.99, 880.00],
        [659.25, 830.61, 987.77],
        [1046.50, 1318.51, 1567.98]
      ];
      chords.forEach((chord, step) => {
        const t = now + step * 0.1;
        chord.forEach(freq => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime((step === 3 ? 0.22 : 0.12) * vol, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + (step === 3 ? 0.6 : 0.18));
          osc.start(t);
          osc.stop(t + (step === 3 ? 0.6 : 0.18));
        });
      });

    } else if (type === 'fail') {
      // ミス・下降ブザー音（低めの鋸波下降音）
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(240, now);
      osc1.frequency.exponentialRampToValueAtTime(75, now + 0.32);
      osc2.frequency.setValueAtTime(235, now);
      osc2.frequency.exponentialRampToValueAtTime(70, now + 0.32);

      gain.gain.setValueAtTime(0.22 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.32);
      osc2.stop(now + 0.32);

    } else if (type === 'fanfare') {
      // ハイスコア更新・第一志望現役合格ファンファーレ（堂々たるブラス風進行）
      const rhythm = [
        { freqs: [392.00], time: 0, dur: 0.1 },
        { freqs: [392.00], time: 0.12, dur: 0.1 },
        { freqs: [392.00], time: 0.24, dur: 0.1 },
        { freqs: [523.25], time: 0.36, dur: 0.2 },
        { freqs: [523.25, 659.25, 783.99, 1046.50], time: 0.58, dur: 1.2 }
      ];
      rhythm.forEach(item => {
        const t = now + item.time;
        item.freqs.forEach(freq => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.2 * vol, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + item.dur);
          osc.start(t);
          osc.stop(t + item.dur);
        });
      });

    } else if (type === 'rest') {
      // 穏やかな回復音（サイン波アルペジオ）
      const freqs = [329.63, 440.00, 554.37, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        const t = now + idx * 0.09;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.18 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });

    } else if (type === 'battle_hit') {
      // 解答・試験進行音
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

// ========================================================
// 1.5 Game Juice エフェクトエンジン
// （視覚演出・振動・パーティクル・カウントアップ）
// ========================================================
const previousValues = {};

function triggerScreenShake() {
  if (!settings.screenShake) return;
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
  if (!settings.particles) return;
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
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'state', {
    get: () => state,
    set: (v) => { state = v; },
    configurable: true
  });
}

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
    specialtySubjects: null, // 専門科目組み合わせ（例: { sub1: '物理', sub2: '化学', name: '物理・化学' }）
    subExtraScore: 35,       // 情報I・副教科（理系社会/文系理科基礎）の共テ対策度（0〜100）
    kyotsuPeriodActive: false, // 高3 11月以降の共通テスト直前対策期間フラグ
    targetUniv: null,
    subUniv: null,
    subUnivPassed: false,
    subUnivKyotsuPass: false,
    applicationsDone: false,
    subExamDone: false,
    kyotsuScore: 0,
    kyotsuRate: 0,
    kyotsuResearchRank: '',

    kokuritsuKouki: null,
    kokuritsuKoukiPassed: false,
    finalAppDone: false,
    koukiExamDone: false,
    firstChoicePassed: false,
    zenkiResultDone: false,

    daijobuAppeared: false,
    kyotsuDone: false,
    secondaryDone: false,

    stamina: 80,
    maxStamina: 100,
    stress: 10,
    motivation: 2,
    turnsAtMotivation: 0,
    lastMotivation: 2,
    money: 1000,

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
  // --- 難関国立（旧帝大・最難関） ---
  {
    id: 'todai_sci',
    name: '東京大学 理科一類（工・理学部）',
    shortName: '東大 理一',
    type: '国公立',
    course: '理系',
    border: 73,
    weights: { eng: 1.0, math: 1.6, jp: 0.8, sci: 1.7 },
    desc: '日本最高峰の理系。数学・理科の圧倒的論証力と総合力が必須。'
  },
  {
    id: 'todai_med',
    name: '東京大学 理科三類（医学部）',
    shortName: '東大 理三(医)',
    type: '国公立',
    course: '理系',
    border: 78,
    weights: { eng: 1.2, math: 1.5, jp: 1.0, sci: 1.5 },
    desc: '国内最高峰の超難関。全教科でミスが許されない極限の戦い。'
  },
  {
    id: 'todai_hum',
    name: '東京大学 文科一類・二類（法・経済）',
    shortName: '東大 文科(法経)',
    type: '国公立',
    course: '文系',
    border: 72,
    weights: { eng: 1.4, math: 1.0, jp: 1.4, sci: 1.2 },
    desc: '日本屈指の文系最高峰。英語・国語・社会の卓越した記述力が鍵。'
  },
  {
    id: 'kyodai_eng',
    name: '京都大学 工学部・理学部',
    shortName: '京大 工・理',
    type: '国公立',
    course: '理系',
    border: 71,
    weights: { eng: 1.0, math: 1.6, jp: 0.7, sci: 1.7 },
    desc: '自由の学風。超難問数学・物理化学を突破する深い思考力が求められる。'
  },
  {
    id: 'kyodai_law',
    name: '京都大学 法学部・経済学部',
    shortName: '京大 法・経',
    type: '国公立',
    course: '文系',
    border: 70,
    weights: { eng: 1.5, math: 0.8, jp: 1.5, sci: 1.2 },
    desc: '難解な長文読解と論述勝負。国語・英語の極めて高度な記述力が必要。'
  },

  // --- 最難関私大（早慶） ---
  {
    id: 'waseda_pol',
    name: '早稲田大学 政治経済学部',
    shortName: '早稲田 政経',
    type: '私立',
    course: '文系',
    border: 69,
    weights: { eng: 1.5, math: 0.0, jp: 1.4, sci: 1.4 },
    desc: '私大文系の最高峰。英国社3教科の超高度な読解力（数学不要）。'
  },
  {
    id: 'keio_econ',
    name: '慶應義塾大学 経済学部・法学部',
    shortName: '慶應 経・法',
    type: '私立',
    course: '文系',
    border: 68,
    weights: { eng: 1.6, math: 0.0, jp: 1.3, sci: 1.4 },
    desc: '私大屈指の名門。長文英語と社会・国語の完成度が問われる。'
  },
  {
    id: 'waseda_sci',
    name: '早稲田大学 先進・創造理工学部',
    shortName: '早稲田 理工',
    type: '私立',
    course: '理系',
    border: 67,
    weights: { eng: 1.0, math: 1.6, jp: 0.0, sci: 1.6 },
    desc: '私大理系トップ。数学・理科2科目の配点が高く、国語は不要。'
  },

  // --- 上位私大（MARCH・関関同立） ---
  {
    id: 'meiji_law',
    name: '明治大学 法学部・商学部',
    shortName: '明治 法・商',
    type: '私立',
    course: '文系',
    border: 62,
    weights: { eng: 1.5, math: 0.0, jp: 1.3, sci: 1.2 },
    desc: 'MARCHの筆頭人気学部。英国社3教科の安定した得点力が合格の要。'
  },
  {
    id: 'aoyama_lit',
    name: '青山学院大学 文学部・国際政経',
    shortName: '青学 文・国政',
    type: '私立',
    course: '文系',
    border: 61,
    weights: { eng: 1.7, math: 0.0, jp: 1.3, sci: 1.0 },
    desc: '英語の配点が非常に高い。圧倒的な英語力があれば逆転可能。'
  },
  {
    id: 'doshisha_sci',
    name: '同志社大学 理工学部',
    shortName: '同志社 理工',
    type: '私立',
    course: '理系',
    border: 60,
    weights: { eng: 1.0, math: 1.5, jp: 0.0, sci: 1.5 },
    desc: '関西私大理系の雄。数理重視の3教科で確実にボーダー越えを狙う。'
  },

  // --- 中堅国公立 ---
  {
    id: 'chiiki_eng',
    name: '地方国立大学 工学部（金沢・岡山・埼玉等）',
    shortName: '地方国立 工学',
    type: '国公立',
    course: '理系',
    border: 56,
    weights: { eng: 1.0, math: 1.4, jp: 0.8, sci: 1.4 },
    desc: '共通テスト5教科＋2次数理。手堅く理系就職・研究を目指す王道。'
  },
  {
    id: 'chiiki_hum',
    name: '地方国立大学 人文・経済学部',
    shortName: '地方国立 文・経',
    type: '国公立',
    course: '文系',
    border: 55,
    weights: { eng: 1.2, math: 0.8, jp: 1.3, sci: 1.2 },
    desc: '共通テストで全科目安定得点し、2次記述で国英を固めて合格を掴む。'
  },

  // --- 中堅私大（日東駒専・産近甲龍） ---
  {
    id: 'nichidai_hum',
    name: '日本大学・東洋大学 文系学部',
    shortName: '日東駒専 文系',
    type: '私立',
    course: '文系',
    border: 50,
    weights: { eng: 1.3, math: 0.0, jp: 1.3, sci: 1.0 },
    desc: '基礎力が試される3教科入試。着実な基礎固めで堅実な合格を狙える。'
  },
  {
    id: 'kindai_sci',
    name: '近畿大学・東洋大学 理工学部',
    shortName: '産近甲龍 理工',
    type: '私立',
    course: '理系',
    border: 50,
    weights: { eng: 1.0, math: 1.4, jp: 0.0, sci: 1.4 },
    desc: '標準問題中心の3教科試験。数学と理科の基本を確実に解き切れば合格圏。'
  },

  // --- 国公立大学 後期日程 ---
  {
    id: 'nankan_kouki_sci',
    name: '難関国公立大学 理系後期（東工大・千葉・神戸等）',
    shortName: '難関国立 後期(理)',
    type: '国公立後期',
    course: '理系',
    border: 66,
    weights: { eng: 1.0, math: 1.8, jp: 0.0, sci: 1.8 },
    desc: '募集人数が極少の狭き門。数理特化のハイレベル記述勝負！'
  },
  {
    id: 'chiiki_eng_kouki',
    name: '地方国立大学 理工学部後期日程',
    shortName: '地方国立 後期(工)',
    type: '国公立後期',
    course: '理系',
    border: 58,
    weights: { eng: 0.8, math: 1.6, jp: 0.0, sci: 1.6 },
    desc: '前期不合格者の受け皿となる激戦区。数学・理科の記述で逆転を狙う。'
  },
  {
    id: 'nankan_kouki_hum',
    name: '難関国公立大学 文系後期（一橋・神戸・横国等）',
    shortName: '難関国立 後期(文)',
    type: '国公立後期',
    course: '文系',
    border: 67,
    weights: { eng: 1.6, math: 0.0, jp: 1.6, sci: 1.0 },
    desc: '最難関の後期枠。圧倒的な英語力と論述小論文で逆転を狙う。'
  },
  {
    id: 'chiiki_hum_kouki',
    name: '地方国立大学 人文・社会学部後期日程',
    shortName: '地方国立 後期(文)',
    type: '国公立後期',
    course: '文系',
    border: 57,
    weights: { eng: 1.4, math: 0.0, jp: 1.5, sci: 1.0 },
    desc: '小論文と英語の記述勝負。前期のリベンジを期す受験生が集う。'
  }
];

const TRAITS_MASTER = [
  { id: 'strong_exam', name: '本番に強い', desc: '模試や本番試験で偏差値+5の補正ボーナス！', type: 'blue' },
  { id: 'speed_reading', name: '速読術', desc: '英語・国語の学習で獲得できる経験値+25%', type: 'blue' },
  { id: 'focus_mind', name: '集中力◯', desc: '勉強の失敗率が半減する', type: 'blue' },
  { id: 'night_owl', name: '夜型集中', desc: '勉強時の獲得経験値がすべて+15%', type: 'blue' },
  { id: 'morning_bird', name: '朝型習慣', desc: '体力の回復量が常に+10', type: 'blue' },
  { id: 'review_master', name: '復習上手', desc: '模試やテストを受けた後の全科目経験値ボーナスUP', type: 'blue' },

  { id: 'miracle_pass', name: '逆転合格の奇跡', desc: '【金特】入試本番でE判定でも驚異的な底力を発揮する', type: 'gold' },
  { id: 'math_spark', name: '数理の閃き', desc: '【金特】数理の学習経験値+25%！本番で学力比例の閃きクリティカル（得点×1.35倍）発動', type: 'gold' },
  { id: 'humanities_spark', name: '人文の閃き', desc: '【金特】文系科目の学習経験値+25%！本番で学力比例の閃きクリティカル（得点×1.35倍）発動', type: 'gold' },
  { id: 'lang_master', name: '言語の極意', desc: '【金特】英語・国語の長文読解で無類の安定感を誇る', type: 'gold' },

  { id: 'careless_mistake', name: 'ケアレスミス癖', desc: '【赤特】模試や本番で30%の確率で失点する', cureMoney: 2000, type: 'red' },
  { id: 'weak_exam', name: '本番に弱い', desc: '【赤特】模試や入試で緊張し偏差値-5補正', cureMoney: 2000, type: 'red' },
  { id: 'sns_addict', name: 'SNS中毒', desc: '【赤特】勉強時に15%の確率でサボりが発生する', cureMoney: 1500, type: 'red' },
  { id: 'insomnia', name: '不眠症', desc: '【赤特】休養コマンドの体力回復量が半減する', cureMoney: 1500, type: 'red' }
];

// 学力パラメータ(0〜100)からリアルな全国偏差値(35〜75)を算出
function calcDeviation(academicScore, bonus = 0) {
  let dev = 50 + (academicScore - 50) * 0.52 + bonus;
  dev = Math.max(30.0, Math.min(80.0, dev));
  return Math.round(dev * 10) / 10;
}

// 志望大学学部の傾斜配点(weights)を考慮した傾斜偏差値を算出
function calcTargetDev(targetUniv, bonus = 0) {
  if (!targetUniv || !targetUniv.weights) {
    const avg = (state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score) / 4;
    return calcDeviation(avg, bonus);
  }
  const w = targetUniv.weights;
  let totalW = 0;
  let weightedScore = 0;
  ['eng', 'math', 'jp', 'sci'].forEach(s => {
    const weight = w[s] !== undefined ? w[s] : 1.0;
    if (weight > 0) {
      weightedScore += state.subjects[s].score * weight;
      totalW += weight;
    }
  });
  const avg = totalW > 0 ? (weightedScore / totalW) : 50;
  return calcDeviation(avg, bonus);
}


function getSubjectDisplayName(key) {
  if (key === 'eng') return '英語';
  if (key === 'math') return '数学';
  if (key === 'jp') return '国語';
  if (key === 'sci') {
    if (state.specialtySubjects) {
      return `${state.specialtySubjects.category}（${state.specialtySubjects.name}）`;
    }
    if (state.course === '文系') return '社会';
    if (state.course === '理系') return '理科';
    return '理社';
  }
  return key;
}

function getRank(score) {
  if (score >= 90) return { rank: 'S', class: 'rank-s' };
  if (score >= 80) return { rank: 'A', class: 'rank-a' };
  if (score >= 70) return { rank: 'B', class: 'rank-b' };
  if (score >= 60) return { rank: 'C', class: 'rank-c' };
  if (score >= 50) return { rank: 'D', class: 'rank-d' };
  if (score >= 40) return { rank: 'E', class: 'rank-e' };
  if (score >= 20) return { rank: 'F', class: 'rank-f' };
  return { rank: 'G', class: 'rank-g' };
}

// ================= モーダル＆イベントキューシステム =================
// 複数のモーダルやイベントが重なっても順番に1つずつ安全に表示する仕組み
const modalQueue = [];
let isModalShowing = false;

function isAnyModalActive() {
  const ev = document.getElementById('event-modal');
  const ch = document.getElementById('choice-modal');
  const ex = document.getElementById('exam-battle-modal');
  return (ev && ev.classList.contains('active')) ||
         (ch && ch.classList.contains('active')) ||
         (ex && ex.classList.contains('active'));
}

function enqueueModal(modalFn) {
  modalQueue.push(modalFn);
  if (!isAnyModalActive()) {
    showNextModal();
  }
}

function showNextModal() {
  if (isAnyModalActive()) {
    return;
  }
  if (modalQueue.length === 0) {
    isModalShowing = false;
    return;
  }
  isModalShowing = true;
  const nextFn = modalQueue.shift();
  if (nextFn) {
    nextFn();
  }
}

// ================= セーブ＆ロード・ポーズメニュー・スタート画面処理 =================

// オートセーブ
function autoSaveGame() {
  if (!state) return;
  if (state.gameOver) return; // 終了済みのデータは保存しない
  state.inGame = true;
  state.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to auto-save game:', e);
  }
}

function getSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.year && data.month && data.week && data.subjects) {
      return data;
    }
  } catch (e) {
    console.error('Failed to parse save data:', e);
  }
  return null;
}

function clearSavedGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('Failed to clear save data:', e);
  }
}

// つづきから再開
function resumeGame() {
  const saved = getSavedGame();
  if (!saved) {
    alert('セーブデータが見つかりませんでした。');
    return;
  }
  playSound('start');
  state = saved;
  state.inGame = true;
  autoSaveGame();

  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('main-game-screen').style.display = 'flex';

  renderUI();
  setDialog('担任の先生', `${state.playerName}、前回の続き（${state.year}年生 ${state.month}月 ${state.week}週）から再開するぞ！集中して合格を目指そう！`);

  // 旧バージョンで4年生に進んでしまったセーブ、または期間満了セーブは即エンディングへ
  if (state.gameOver || state.year > 3 || state.totalTurn > state.maxTurns) {
    state.gameOver = false;
    if (state.year > 3) { state.year = 3; state.month = 3; state.week = 4; }
    triggerGameEnd();
  }
}

// 「はじめからスタート」ボタン押下時（既存セーブの確認）
function handleStartNewClick() {
  const saved = getSavedGame();
  if (saved) {
    const univName = saved.targetUniv ? saved.targetUniv.name : '志望校未定';
    const msg = '前回のセーブデータがあります。上書きして最初から始めますか？';
    if (!confirm(msg)) {
      return;
    }
  }
  startGame();
}

// 新規ゲーム開始
function startGame() {
  playSound('start');
  const nameInput = document.getElementById('player-name-input');
  const playerName = (nameInput.value.trim()) || '合格太郎';

  state = createInitialState(playerName);
  initInnateTraits();
  state.inGame = true;
  autoSaveGame();

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
  clearSavedGame(); // クリア後は新しい代を始めるためセーブ消去
  updateTitleScreenUI();
}

function updateTitleScreenUI() {
  const saved = getSavedGame();
  const contSection = document.getElementById('continue-section');
  const contSub = document.getElementById('continue-info-sub');
  const startNewText = document.getElementById('start-new-text');
  const nameInput = document.getElementById('player-name-input');

  if (saved) {
    if (contSection) contSection.style.display = 'block';
    if (contSub) {
      const univName = saved.targetUniv ? saved.targetUniv.name : '志望校未定';
      contSub.textContent = `${saved.year}年生 ${saved.month}月 ${saved.week}週 • ${saved.playerName} (${univName})`;
    }
    if (startNewText) startNewText.textContent = 'はじめからスタート';
    if (nameInput && saved.playerName) nameInput.value = saved.playerName;
  } else {
    if (contSection) contSection.style.display = 'none';
    if (startNewText) startNewText.textContent = 'ゲームスタート！';
  }
}

// ポーズメニュー制御
let isPauseFromTitle = false;

function openPauseModal(fromTitle = false) {
  playSound('click');
  isPauseFromTitle = fromTitle;
  const modal = document.getElementById('pause-modal');
  if (!modal) return;

  const summaryCard = document.getElementById('pause-summary-card');
  const titleBtn = document.getElementById('btn-pause-title');
  const restartBtn = document.getElementById('btn-pause-restart');
  const resumeBtn = document.getElementById('btn-pause-resume');
  const closeSettingsBtn = document.getElementById('btn-pause-close-settings');
  const modalTitle = modal.querySelector('.modal-header h3');

  const saved = getSavedGame();
  const current = (state && state.inGame) ? state : saved;

  if (current && !fromTitle) {
    summaryCard.style.display = 'flex';
    document.getElementById('pause-summary-name').textContent = `${current.playerName} くん`;
    document.getElementById('pause-summary-date').textContent = `${current.year}年生 ${current.month}月 ${current.week}週 (残り ${current.maxTurns - current.totalTurn + 1} 週)`;
    let univSummary = `志望校: ${current.targetUniv ? current.targetUniv.name : '未決定 (高3決定)'}`;
    if (current.subUniv) {
      const passTag = current.subUnivPassed ? ' (💮合格)' : '';
      univSummary += ` / 併願: ${current.subUniv.name}${passTag}`;
    }
    document.getElementById('pause-summary-univ').textContent = univSummary;
  } else {
    summaryCard.style.display = 'none';
  }

  if (fromTitle) {
    if (modalTitle) modalTitle.textContent = '⚙️ ゲーム設定';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (titleBtn) titleBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
    if (closeSettingsBtn) closeSettingsBtn.style.display = 'flex';
  } else {
    if (modalTitle) modalTitle.textContent = '⚙️ ポーズ & 各種設定';
    if (resumeBtn) resumeBtn.style.display = 'flex';
    if (titleBtn) titleBtn.style.display = 'flex';
    if (restartBtn) restartBtn.style.display = 'flex';
    if (closeSettingsBtn) closeSettingsBtn.style.display = 'none';
  }

  updateSettingsUI();
  modal.classList.add('active');
}

function closePauseModal() {
  playSound('click');
  const modal = document.getElementById('pause-modal');
  if (modal) modal.classList.remove('active');
}

function pauseReturnToTitle() {
  playSound('click');
  if (state) {
    state.inGame = false;
    autoSaveGame();
  }
  closePauseModal();
  document.getElementById('main-game-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
  updateTitleScreenUI();
}

function confirmRestartGame() {
  playSound('click');
  if (confirm('現在の高校生活データをすべて破棄して、1年生4月1週から最初からやり直しますか？')) {
    clearSavedGame();
    closePauseModal();
    startGame();
  }
}

function toggleSettingSE() {
  settings.isMuted = !settings.isMuted;
  isMuted = settings.isMuted;
  saveSettings();
  updateSettingsUI();
  updateMuteUI();
  if (!settings.isMuted) {
    playSound('click');
  }
}

function changeSEVolume(val) {
  settings.seVolume = Math.max(0, Math.min(100, parseInt(val, 10))) / 100;
  saveSettings();
  const valEl = document.getElementById('setting-se-val');
  if (valEl) valEl.textContent = `${Math.round(settings.seVolume * 100)}%`;
  playSound('hover');
}

function toggleSettingShake() {
  settings.screenShake = !settings.screenShake;
  saveSettings();
  updateSettingsUI();
  playSound('click');
  if (settings.screenShake) {
    triggerScreenShake();
  }
}

function toggleSettingParticle() {
  settings.particles = !settings.particles;
  saveSettings();
  updateSettingsUI();
  playSound('click');
}

function updateSettingsUI() {
  const seBtn = document.getElementById('setting-se-toggle');
  if (seBtn) {
    seBtn.textContent = settings.isMuted ? 'OFF' : 'ON';
    seBtn.classList.toggle('active', !settings.isMuted);
  }
  const slider = document.getElementById('setting-se-slider');
  const sliderVal = document.getElementById('setting-se-val');
  if (slider) slider.value = Math.round(settings.seVolume * 100);
  if (sliderVal) sliderVal.textContent = `${Math.round(settings.seVolume * 100)}%`;

  const shakeBtn = document.getElementById('setting-shake-toggle');
  if (shakeBtn) {
    shakeBtn.textContent = settings.screenShake ? 'ON' : 'OFF';
    shakeBtn.classList.toggle('active', settings.screenShake);
  }

  const particleBtn = document.getElementById('setting-particle-toggle');
  if (particleBtn) {
    particleBtn.textContent = settings.particles ? 'ON' : 'OFF';
    particleBtn.classList.toggle('active', settings.particles);
  }

  updateMuteUI();
}

// リロード時の自動復元チェック
function checkAutoResumeOnLoad() {
  const saved = getSavedGame();
  if (saved && saved.inGame) {
    // プレイ中（inGame: true）にリロードされた場合、自動的にメイン画面を表示して再開
    state = saved;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('main-game-screen').style.display = 'flex';
    renderUI();
    setDialog('担任の先生', `${state.playerName}、おかえり！前回の続き（${state.year}年生 ${state.month}月 ${state.week}週）から高校生活を再開するぞ！`);
    // 旧バージョンで4年生に進んでしまったセーブ等は即エンディングへ
    if (state.year > 3 || state.totalTurn > state.maxTurns) {
      state.gameOver = false;
      if (state.year > 3) { state.year = 3; state.month = 3; state.week = 4; }
      triggerGameEnd();
    }
  } else {
    // タイトル画面を表示
    document.getElementById('title-screen').style.display = 'flex';
    document.getElementById('main-game-screen').style.display = 'none';
    updateTitleScreenUI();
  }
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
      const bestName = ob.bestSubjectName || (ob.bestSubject ? getSubjectDisplayName(ob.bestSubject) : null);
      const bestRank = ob.bestScore ? getRank(ob.bestScore).rank : '';
      const bestInfoHtml = bestName ? `<div class="univ" style="color:#0284c7; font-size:0.85rem; font-weight:800;">🔥 得意科目: ${bestName} ${ob.bestScore ? `(学力 ${ob.bestScore}・${bestRank}ランク)` : ''}</div>` : '';

      body.innerHTML = `
        <div class="ob-history-card">
          <div class="avatar">👨‍🎓</div>
          <div class="info">
            <div class="name">${ob.name} 先輩</div>
            <div class="univ">🌸 【${ob.univ}】 現役合格！</div>
            ${bestInfoHtml}
            <div class="date">合格年: ${ob.year}年 / 習得特能数: ${ob.traitsCount}個</div>
          </div>
        </div>
        <p style="font-size:0.75rem; color:#475569; margin-top:8px;">
          ※登録された先輩は、2周目以降の高校生活で激励に現れ、得意科目【${bestName || '主要科目'}】の集中指導（+25pt）と他科目の基礎アドバイス（+6pt）をしてくれます！
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
  document.getElementById('turn-year').textContent = `${state.year}年生`;
  document.getElementById('turn-month-week').textContent = `${state.month}月 ${state.week}週`;
  const remaining = state.maxTurns - state.totalTurn + 1;
  document.getElementById('turn-count').textContent = `残り ${remaining} 週`;

  const univBadge = document.getElementById('target-univ-badge');
  if (state.targetUniv) {
    const shortLabel = state.targetUniv.shortName || state.targetUniv.name;
    let badgeText = `本命: ${shortLabel} (${state.targetUniv.border})`;
    if (state.subUniv) {
      const subLabel = state.subUniv.shortName || state.subUniv.name;
      const statusIcon = state.subUnivPassed ? '💮' : (state.subExamDone ? '❌' : '📑');
      badgeText += ` | 私大: ${statusIcon}${subLabel}`;
    }
    if (state.kokuritsuKouki) {
      const koukiLabel = state.kokuritsuKouki.shortName || state.kokuritsuKouki.name;
      const statusIcon = state.kokuritsuKoukiPassed ? '💮' : (state.koukiExamDone ? '❌' : '📑');
      badgeText += ` | 後期: ${statusIcon}${koukiLabel}`;
    }
    univBadge.textContent = badgeText;
  } else {
    univBadge.textContent = '志望校: 未決定 (高3春)';
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

  // 文理コースに応じた「数理の閃き」⇔「人文の閃き」自動同期
  if (state.course === '文系') {
    if (state.traits.includes('math_spark')) {
      state.traits = state.traits.map(t => t === 'math_spark' ? 'humanities_spark' : t);
    }
  } else if (state.course === '理系') {
    if (state.traits.includes('humanities_spark')) {
      state.traits = state.traits.map(t => t === 'humanities_spark' ? 'math_spark' : t);
    }
  }

  let sciLabel = state.course === '理系' ? '理科' : (state.course === '文系' ? '社会' : '理社');
  let sciSubtext = '';
  if (state.specialtySubjects) {
    sciSubtext = `(${state.specialtySubjects.name})`;
  }
  document.getElementById('subj-name-sci').textContent = sciSubtext ? `${sciLabel} ${sciSubtext}` : sciLabel;
  const studySciLabel = document.getElementById('study-name-sci');
  if (studySciLabel) studySciLabel.textContent = sciSubtext ? `${sciLabel}（${state.specialtySubjects.name}）の集中学習` : `${sciLabel}の集中学習`;
  const studySciDesc = document.getElementById('study-desc-sci');
  if (studySciDesc) studySciDesc.textContent = sciSubtext ? `${state.specialtySubjects.name}の経験値大量獲得 (体力-15 / ストレス+7)` : `${sciLabel}の経験値大量獲得 (体力-15 / ストレス+7)`;
  const studySciIcon = document.getElementById('study-icon-sci');
  if (studySciIcon) studySciIcon.textContent = state.course === '文系' ? '📜' : '🔬';

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

  // 共通テスト直前対策期間（高3 11月〜1月2週）限定ボタン表示制御
  const isKyotsuPeriod = state.year === 3 && (state.month === 11 || state.month === 12 || (state.month === 1 && state.week <= 2));
  const extraBtn = document.getElementById('study-btn-kyotsu-extra');
  if (extraBtn) {
    if (isKyotsuPeriod) {
      extraBtn.style.display = 'flex';
      const isBunkei = state.course === '文系';
      const subName = isBunkei ? '理科基礎' : '社会';
      const nameEl = document.getElementById('study-name-kyotsu-extra');
      const descEl = document.getElementById('study-desc-kyotsu-extra');
      if (nameEl) nameEl.textContent = `💻 情報I・${subName} マーク演習 (現在: ${Math.round(state.subExtraScore || 35)}点)`;
      if (descEl) descEl.textContent = `共テ200点枠（情報I＋${subName}）を集中的に詰め込む (体力-14 / ストレス+6)`;
    } else {
      extraBtn.style.display = 'none';
    }
  }

  autoSaveGame();
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
        const typeClass = trait.type || 'blue';
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
  // 進学先確定（ゲーム終了）後はターンを一切進めない
  if (state.gameOver) {
    showGameOverAgain();
    return;
  }
  // 高校3年3月4週を終えたら学年を進めずにエンディングへ
  if (state.year >= 3 && state.month === 3 && state.week >= 4) {
    triggerGameEnd();
    return;
  }
  state.totalTurn++;
  state.week++;
  if (state.week > 4) {
    state.week = 1;
    state.month++;
    if (state.month > 12) {
      state.month = 1; // 12月の次は1月（同じ学年）
    } else if (state.month === 4) {
      if (state.year >= 3) {
        // 高校3年3月4週終了。4年生には進まず、直ちに卒業・ゲーム終了へ！
        triggerGameEnd();
        return;
      }
      state.year++; // 3月4週の次（4月1週）に学年が上がる！
    }
  }

  // 1. 月初めのお小遣い（学年に応じた支給）
  if (state.week === 1) {
    let monthlyAllowance = 1000;
    if (state.year === 2) monthlyAllowance = 1500;
    if (state.year === 3) monthlyAllowance = 2000;
    state.money += monthlyAllowance;
    showFloatingText(`お小遣い +¥${monthlyAllowance.toLocaleString()}`, null, null, 'heal');
  }

  // 2. 時間経過によるやる気の自然低下（中だるみ・気の緩み）
  if (state.lastMotivation === undefined) state.lastMotivation = state.motivation;
  if (state.motivation !== state.lastMotivation) {
    state.turnsAtMotivation = 0;
    state.lastMotivation = state.motivation;
  } else {
    state.turnsAtMotivation = (state.turnsAtMotivation || 0) + 1;
  }

  let motDropMsg = null;
  // 絶好調(4): 2ターン以上維持していると時間経過で落ち着く
  if (state.motivation === 4) {
    const decayChance = state.turnsAtMotivation >= 3 ? 0.45 : 0.25;
    if (state.turnsAtMotivation >= 2 && Math.random() < decayChance) {
      state.motivation = 3;
      state.lastMotivation = 3;
      state.turnsAtMotivation = 0;
      motDropMsg = '少し気の緩みが出て、やる気が【絶好調】から【好調】に落ち着いた…';
    }
  } else if (state.motivation === 3) {
    // 好調(3): 3ターン以上維持していると、日々のマンネリで普通に落ち着く
    const decayChance = state.turnsAtMotivation >= 4 ? 0.35 : 0.20;
    if (state.turnsAtMotivation >= 3 && Math.random() < decayChance) {
      state.motivation = 2;
      state.lastMotivation = 2;
      state.turnsAtMotivation = 0;
      motDropMsg = '日々の勉強のマンネリで、やる気が【普通】に戻ってしまった…';
    }
  }

  // 高ストレス（70%以上）による追加のやる気低下判定
  if (!motDropMsg && state.stress >= 70 && state.motivation > 0 && Math.random() < 0.30) {
    state.motivation--;
    state.lastMotivation = state.motivation;
    state.turnsAtMotivation = 0;
    motDropMsg = '蓄積したストレスの重圧で、やる気が下がってしまった…！';
  }

  if (motDropMsg) {
    showFloatingText('やる気ダウン⤵', null, null, 'damage');
    setDialog(state.playerName, motDropMsg);
  }

  renderUI();

  if (state.totalTurn > state.maxTurns || state.year > 3) {
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
  renderStudyMenu();
  document.getElementById('study-modal').classList.add('active');
}

function renderStudyMenu() {
  if (!state) return;
  const isKyotsuPeriod = state.year === 3 && (state.month === 11 || state.month === 12 || (state.month === 1 && state.week <= 2));
  const extraBtn = document.getElementById('study-btn-kyotsu-extra');
  if (extraBtn) {
    if (isKyotsuPeriod) {
      extraBtn.style.display = 'flex';
      const isBunkei = state.course === '文系';
      const subName = isBunkei ? '理科基礎' : '社会';
      const nameEl = document.getElementById('study-name-kyotsu-extra');
      const descEl = document.getElementById('study-desc-kyotsu-extra');
      if (nameEl) nameEl.textContent = `💻 情報I・${subName} マーク演習 (現在: ${Math.round(state.subExtraScore || 35)}点)`;
      if (descEl) descEl.textContent = `共テ200点枠（情報I＋${subName}）を集中的に詰め込む (体力-14 / ストレス+6)`;
    } else {
      extraBtn.style.display = 'none';
    }
  }
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
  let stressCost = 7;
  if (subject === 'math') { stamCost = 18; stressCost = 9; }
  if (subject === 'jp') { stamCost = 12; stressCost = 5; }
  if (subject === 'all') { stamCost = 22; stressCost = 10; }
  if (subject === 'sub_extra') { stamCost = 14; stressCost = 6; }

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

    // 学年進行ボーナス（高1: 1.0倍 基礎固め / 高2: 1.3倍 応用期 / 高3: 1.6倍 実戦演習・ラストスパート期）
    let gradeBonus = 1.0;
    if (state.year === 2) gradeBonus = 1.3;
    if (state.year === 3) gradeBonus = 1.6;
    baseExp *= gradeBonus;

    const isZone = Math.random() < 0.12;
    const zoneBonus = isZone ? 1.6 : 1.0;

    let rewardLines = [`体力 -${stamCost} / ストレス +${stressCost}%`];
    let anyLevelUp = false;
    const isBunkei = state.course === '文系';

    if (subject === 'sub_extra') {
      const isBunkeiSub = state.course === '文系';
      const extraName = isBunkeiSub ? '情報I・理科基礎' : '情報I・社会';
      const gained = Math.round(14 * motMulti * zoneBonus);
      state.subExtraScore = Math.min(100, (state.subExtraScore || 35) + gained);
      rewardLines.push(`共テ副教科対策値: +${gained} pt 獲得！（現在: ${Math.round(state.subExtraScore)} / 100）`);
      showFloatingText(`${extraName} +${gained} pt`, null, null, 'exp');
      setDialog('担任の先生', `よし！${extraName}のマーク演習を着実にこなしたな！この調子で本番200点満点を狙おう！`);
    } else if (subject === 'all') {
      const subjs = ['eng', 'math', 'jp', 'sci'];
      const leveledUpSubjs = [];
      subjs.forEach(s => {
        let subjMult = 1.0;
        if (state.traits.includes('math_spark') && (s === 'math' || s === 'sci')) subjMult *= 1.25;
        if (state.traits.includes('humanities_spark') && (s === 'jp' || (isBunkei && s === 'sci') || s === 'eng')) subjMult *= 1.25;
        // 総合演習は4教科に分散するため各科38%（単科18ptに対し約7pt・4教科合計で約1.5倍の総経験点）
        const pts = Math.max(3, Math.round((baseExp * 0.38) * motMulti * zoneBonus * subjMult));
        const up = addExpToSubject(s, pts);
        if (up > 0) {
          anyLevelUp = true;
          leveledUpSubjs.push(`${getSubjectDisplayName(s)}(${state.subjects[s].score})`);
        }
      });
      const avgPts = Math.max(3, Math.round((baseExp * 0.38) * motMulti * zoneBonus));
      const gradeNotice = state.year > 1 ? `（${state.year}年生効率UP）` : '';
      rewardLines.push(`全科目経験値: 各 +${avgPts} pt 獲得！${gradeNotice}`);
      showFloatingText(`全科目 +${avgPts} pt`, null, null, 'exp');
      if (leveledUpSubjs.length > 0) {
        rewardLines.push(`🎉 【学力UP!】${leveledUpSubjs.join('・')}`);
      }
    } else {
      let mult = 1.0;
      if (state.traits.includes('speed_reading') && (subject === 'eng' || subject === 'jp')) mult *= 1.25;
      if (state.club === '文化部' && (subject === 'eng' || subject === 'jp')) mult *= 1.2;

      // 金特パッシブ: 該当教科の学習経験値 +25% UP
      if (state.traits.includes('math_spark') && (subject === 'math' || subject === 'sci')) {
        mult *= 1.25;
      }
      if (state.traits.includes('humanities_spark') && (subject === 'jp' || (isBunkei && subject === 'sci') || subject === 'eng')) {
        mult *= 1.25;
      }

      const gainedExp = Math.round(baseExp * motMulti * zoneBonus * mult);
      const levelUps = addExpToSubject(subject, gainedExp);

      const subjName = getSubjectDisplayName(subject);
      const gradeNotice = state.year > 1 ? `（${state.year}年生効率UP）` : '';
      rewardLines.push(`${subjName}経験値: +${gainedExp} pt 獲得！${gradeNotice}`);
      showFloatingText(`${subjName} +${gainedExp} pt`, null, null, 'exp');

      if (levelUps > 0) {
        anyLevelUp = true;
        rewardLines.push(`🎉 【${subjName} 偏差値 UP! ➔ ${state.subjects[subject].score}】`);
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
  state.stress = Math.max(0, state.stress - 12);

  showFloatingText(`体力 +${recovery}`, null, null, 'heal');
  triggerParticles(null, null, 16, 'heal');
  triggerScreenBounce();

  let motUp = false;
  if (state.motivation < 2 && Math.random() < 0.35) {
    state.motivation++;
    motUp = true;
  } else if (state.motivation < 3 && Math.random() < 0.10) {
    state.motivation++;
    motUp = true;
  }

  enqueueModal(() => {
    showEventModal(
      '🛌 しっかり休養',
      state.traits.includes('insomnia')
        ? '不眠症のせいで浅い眠りだったが、体力を少し回復した。'
        : 'ゆっくりお風呂に入って熟睡した！心身の疲れがしっかり回復！',
      [
        `体力 +${recovery} 回復`,
        'ストレス -12%',
        motUp ? `やる気アップ ⤴ (${MOTIVATIONS[state.motivation].label})` : '体調リフレッシュ！'
      ],
      '🌿',
      () => advanceTurn()
    );
  });

  setDialog(state.playerName, 'よく寝たー！体力が回復して頭もすっきりしたぞ！');
  renderUI();
}

function openPlayMenu() {
  playSound('click');
  const container = document.getElementById('play-options-container');
  container.innerHTML = '';

  // 1. 自宅の部屋
  const btnHome = document.createElement('button');
  btnHome.className = 'study-card-btn';
  btnHome.onclick = () => executePlay('home');
  btnHome.innerHTML = `
    <span class="icon">🎮</span>
    <div class="info">
      <div class="name">自宅の部屋でゲーム＆マンガ</div>
      <div class="desc">費用: ¥0 • ストレス-30% / 体力+15 / やる気確定UP</div>
    </div>
  `;
  container.appendChild(btnHome);

  // 2. 学問神社（お参り・合格祈願・赤特浄化）
  const btnShrine = document.createElement('button');
  btnShrine.className = 'study-card-btn';
  btnShrine.onclick = () => executePlay('shrine');
  btnShrine.innerHTML = `
    <span class="icon">⛩️</span>
    <div class="info">
      <div class="name">学問神社でお参り＆合格祈願</div>
      <div class="desc">費用: ¥500 • やる気絶好調確定 / ストレス-20% / 悪癖・赤特の低確率お祓い浄化(15%)</div>
    </div>
  `;
  container.appendChild(btnShrine);

  // 3. 大型書店・自習カフェ
  const btnBookstore = document.createElement('button');
  btnBookstore.className = 'study-card-btn';
  btnBookstore.onclick = () => executePlay('bookstore');
  btnBookstore.innerHTML = `
    <span class="icon">📚</span>
    <div class="info">
      <div class="name">大型書店＆自習カフェ</div>
      <div class="desc">費用: ¥600 • 全教科経験値+8pt / ストレス-20% / やる気UP</div>
    </div>
  `;
  container.appendChild(btnBookstore);

  // 4. カラオケ・ゲーセン（ストレス完全発散）
  const btnKaraoke = document.createElement('button');
  btnKaraoke.className = 'study-card-btn';
  btnKaraoke.onclick = () => executePlay('karaoke');
  btnKaraoke.innerHTML = `
    <span class="icon">🎤</span>
    <div class="info">
      <div class="name">カラオケで熱唱！大発散</div>
      <div class="desc">費用: ¥1,200 • ストレス-50%大解消 / やる気絶好調確定 / 体力-5</div>
    </div>
  `;
  container.appendChild(btnKaraoke);

  // 5. あおいとカフェ（交友）
  const btnAoi = document.createElement('button');
  if (state.friends.aoi.met) {
    btnAoi.className = 'study-card-btn';
    btnAoi.onclick = () => executePlay('aoi');
    btnAoi.innerHTML = `
      <span class="icon">👧</span>
      <div class="info">
        <div class="name">あおいとカフェで自習＆おしゃべり</div>
        <div class="desc">費用: ¥800 • 好感度+15% / ストレス-35% / 体力+10 / やる気UP</div>
      </div>
    `;
  } else {
    btnAoi.className = 'study-card-btn locked';
    btnAoi.innerHTML = `
      <span class="icon">🔒</span>
      <div class="info">
        <div class="name">幼馴染とお出かけ (未解放)</div>
        <div class="desc">高校生活が進むと出会えるかも…？</div>
      </div>
    `;
  }
  container.appendChild(btnAoi);

  // 6. 神童くんとファミレス（ライバル）
  const btnShindo = document.createElement('button');
  if (state.friends.shindo.met) {
    btnShindo.className = 'study-card-btn';
    btnShindo.onclick = () => executePlay('shindo');
    const isBunkeiMenu = state.course === '文系';
    const shindoDesc = isBunkeiMenu
      ? '費用: ¥900 • 友好度+15% / 国語+20pt・社会+15pt / ストレス-20%'
      : '費用: ¥900 • 友好度+15% / 数学+20pt・英語+15pt / ストレス-20%';
    btnShindo.innerHTML = `
      <span class="icon">👦</span>
      <div class="info">
        <div class="name">神童くんとファミレスで受験戦略会議</div>
        <div class="desc">${shindoDesc}</div>
      </div>
    `;
  } else {
    btnShindo.className = 'study-card-btn locked';
    btnShindo.innerHTML = `
      <span class="icon">🔒</span>
      <div class="info">
        <div class="name">ライバルとお出かけ (未解放)</div>
        <div class="desc">高1秋の文理選択後に現れるかも…？</div>
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

  if (type === 'home' || type === 'alone') {
    playSound('click');
    showFloatingText('リフレッシュ！', null, null, 'heal');
    triggerParticles(null, null, 16, 'mood');
    triggerScreenBounce();
    state.stress = Math.max(0, state.stress - 30);
    state.stamina = Math.min(state.maxStamina, state.stamina + 15);
    if (state.motivation < 4) state.motivation++;
    enqueueModal(() => {
      showEventModal(
        '🎮 自宅の部屋で息抜き',
        '自室で大好きなゲームとマンガに没頭した！程よくリラックスしてやる気が回復！',
        [
          'ストレス -30% 解消',
          '体力 +15 回復',
          'やる気アップ ⤴ (' + MOTIVATIONS[state.motivation].label + ')'
        ],
        '🎮',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '楽しかった！心がすっきりして勉強へのやる気も戻ってきたぞ！');
  } else if (type === 'shrine') {
    if (state.money < 500) {
      playSound('fail');
      alert('お賽銭（¥500）が足りません！');
      return;
    }
    playSound('success');
    state.money -= 500;
    state.stress = Math.max(0, state.stress - 20);
    state.motivation = 4; // 絶好調確定！
    triggerParticles(null, null, 24, 'star');
    triggerScreenBounce();

    // 赤特の浄化祈祷判定（赤特があれば50%で1つ治癒）
    let curedTraitName = '';
    const redTraits = state.traits.filter(tid => {
      const t = TRAITS_MASTER.find(m => m.id === tid);
      return t && t.type === 'red';
    });
    if (redTraits.length > 0 && Math.random() < 0.15) {
      const removeId = redTraits[Math.floor(Math.random() * redTraits.length)];
      state.traits = state.traits.filter(t => t !== removeId);
      const master = TRAITS_MASTER.find(m => m.id === removeId);
      curedTraitName = `✨ 奇跡のお祓い！悪癖【${master.name}】が綺麗に浄化された！`;
    }

    // お守りチャンス（お守り未所持なら15%で獲得）
    let amuletMsg = '';
    if (!state.hasAmulet && Math.random() < 0.15) {
      state.hasAmulet = true;
      amuletMsg = '🎁 奇跡！宮司さんから【合格祈願お守り】を授かった！';
    }

    enqueueModal(() => {
      showEventModal(
        '⛩️ 学問神社でお参り＆祈祷',
        '二礼二拍手一礼…厳かな境内で志望校合格を祈願した。澄んだ空気とお守りの力で心が研ぎ澄まされ、やる気が極限までみなぎる！',
        [
          'やる気 絶好調！！ ⤴⤴',
          'ストレス -20% 解消',
          'お賽銭 -¥500',
          curedTraitName,
          amuletMsg
        ].filter(Boolean),
        '⛩️',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '神様、絶対に第一志望に合格します！不思議と力が湧いてきたぞ！');
  } else if (type === 'bookstore') {
    if (state.money < 600) {
      playSound('fail');
      alert('お小遣い（¥600）が足りません！');
      return;
    }
    playSound('success');
    state.money -= 600;
    state.stress = Math.max(0, state.stress - 25);
    if (state.motivation < 4) state.motivation++;
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, 8));
    triggerParticles(null, null, 16, 'star');

    enqueueModal(() => {
      showEventModal(
        '📚 大型書店＆自習カフェ',
        '最新の大学別赤本や合格体験記を読みあさり、カフェスペースで読書した。効果的な勉強法とモチベーションを同時に手に入れた！',
        [
          '全教科 経験値 +8 pt 獲得！',
          'ストレス -20% 解消',
          'やる気アップ ⤴ (' + MOTIVATIONS[state.motivation].label + ')',
          'お小遣い -¥600'
        ],
        '📚',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '面白い解法や勉強法がたくさん載っていた！これなら偏差値も伸ばせそうだ！');
  } else if (type === 'karaoke') {
    if (state.money < 1200) {
      playSound('fail');
      alert('カラオケ代（¥1,200）が足りません！');
      return;
    }
    playSound('fanfare');
    state.money -= 1200;
    state.stress = Math.max(0, state.stress - 50); // 大解消！
    state.stamina = Math.max(10, state.stamina - 5);
    state.motivation = 4; // 絶好調確定！
    triggerParticles(null, null, 30, 'confetti');
    triggerScreenBounce();

    enqueueModal(() => {
      showEventModal(
        '🎤 カラオケで大熱唱！完全発散！',
        '個室で大好きなアニソンや応援歌を大熱唱！溜まっていた受験のストレスとモヤモヤが完全に吹き飛んだ！',
        [
          'ストレス -50% 大解消！',
          'やる気 絶好調！！ ⤴⤴',
          '体力 -5 (熱唱疲れ)',
          'カラオケ代 -¥1,200'
        ],
        '🎤',
        () => advanceTurn()
      );
    });
    setDialog(state.playerName, '最高にスッキリしたーーー！！もう怖いものはない、全力で勉強するぞ！');
  } else if (type === 'aoi') {
    if (state.money < 800) {
      playSound('fail');
      alert('お小遣い（¥800）が足りません！');
      return;
    }
    playSound('success');
    state.money -= 800;
    state.stress = Math.max(0, state.stress - 35);
    state.stamina = Math.min(state.maxStamina, state.stamina + 10);
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
        'お互いの志望校や将来の夢について語り合い、心の支えができた。甘いスイーツで疲れも癒やされた！',
        [
          `あおいの好感度 +15% (現在:${state.friends.aoi.affection}%)`,
          'ストレス -35% 解消',
          '体力 +10 回復',
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
    if (state.money < 900) {
      playSound('fail');
      alert('お小遣い（¥900）が足りません！');
      return;
    }
    playSound('success');
    state.money -= 900;
    state.stress = Math.max(0, state.stress - 25);
    state.friends.shindo.affection = Math.min(100, state.friends.shindo.affection + 15);
    if (state.motivation < 4) state.motivation++;

    const isBunkeiPlay = state.course === '文系';
    if (isBunkeiPlay) {
      addExpToSubject('jp', 20);
      addExpToSubject('sci', 15);
    } else {
      addExpToSubject('math', 20);
      addExpToSubject('eng', 15);
    }

    let traitMsg = '';
    const targetGold = isBunkeiPlay ? 'humanities_spark' : 'math_spark';
    const goldName = isBunkeiPlay ? '人文の閃き' : '数理の閃き';
    if (state.friends.shindo.affection >= 60 && !state.traits.includes(targetGold)) {
      state.traits.push(targetGold);
      traitMsg = `✨ 金特【${goldName}】を伝授された！`;
    }

    const expText1 = isBunkeiPlay ? '国語 経験値 +20 pt' : '数学 経験値 +20 pt';
    const expText2 = isBunkeiPlay ? '社会 経験値 +15 pt' : '英語 経験値 +15 pt';

    enqueueModal(() => {
      showEventModal(
        '👦 神童くんとファミレスで受験戦略会議',
        '難問の解法テクニックや効率的な学習プランについて熱い議論を交わした！',
        [
          `神童の友好度 +15% (現在:${state.friends.shindo.affection}%)`,
          expText1,
          expText2,
          'ストレス -20% 解消',
          'やる気アップ ⤴',
          'お小遣い -¥900',
          traitMsg
        ].filter(Boolean),
        '📝',
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

  // 文理選択（高1 11月1週）の後に神童くんが登場（高1 11月2週〜）
  if (((y === 1 && m === 11 && w >= 2) || (y === 1 && m > 11) || y > 1) && state.course !== '未定' && !state.friends.shindo.met) {
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

  // 高3 12月2週：私大併願・すべり止め出願戦略
  if (y === 3 && m === 12 && w === 2 && !state.applicationsDone) {
    state.applicationsDone = true;
    enqueueModal(() => triggerApplicationChoice());
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

  // 高3 1月4週：国公立前期・後期 最終出願決定（共テリサーチを受けた出願変更＆後期校決定）
  if (y === 3 && m === 1 && w === 4 && !state.finalAppDone) {
    state.finalAppDone = true;
    enqueueModal(() => triggerFinalApplicationChoice());
    return;
  }

  // 高3 2月2週：私立大学個別日程入試（共テ利用合格時は免除）
  if (y === 3 && m === 2 && w === 2 && !state.subExamDone) {
    state.subExamDone = true;
    enqueueModal(() => triggerSubExamEvent());
    return;
  }

  // 高3 2月4週：国公立前期日程 / 二次試験本番
  if (y === 3 && m === 2 && w === 4 && !state.secondaryDone) {
    state.secondaryDone = true;
    enqueueModal(() => startExamBattle('secondary'));
    return;
  }

  // 高3 3月1週：国公立前期日程 合否発表
  if (y === 3 && m === 3 && w === 1 && !state.zenkiResultDone) {
    state.zenkiResultDone = true;
    enqueueModal(() => triggerZenkiResultEvent());
    return;
  }

  // 高3 3月2週：国公立後期日程 本番（前期不合格かつ後期出願者）
  if (y === 3 && m === 3 && w === 2 && state.kokuritsuKouki && !state.koukiExamDone && !state.firstChoicePassed) {
    state.koukiExamDone = true;
    enqueueModal(() => triggerKoukiExamEvent());
    return;
  }

  if (w === 3 && (m === 5 || m === 10)) {
    enqueueModal(() => runSchoolExam());
    return;
  }

  // 高3 11月1週：共通テスト直前対策期間スタート告知
  if (y === 3 && m === 11 && w === 1 && !state.kyotsuPeriodActive) {
    state.kyotsuPeriodActive = true;
    enqueueModal(() => {
      showEventModal(
        '🔥 共通テスト直前対策期間 スタート！',
        'いよいよ11月！大学入学共通テスト本番まで残り2ヶ月半となった！\n\nここからは新課程共通テストの専用科目【情報I】と、副教科（理系社会 / 文系の理科基礎）の集中対策期間が解禁！\n勉強メニューの「💻 情報I・副教科マーク演習」を活用して、200点分の得点源をがっちり確保しよう！',
        ['勉強メニューに「情報I・副教科マーク演習」が解放！', '共テ200点枠を抜け目なく鍛えて足切りを突破せよ！'],
        '💻',
        () => renderUI()
      );
      setDialog('担任の先生', '11月からは共通テスト対策のギアを一段上げよう！情報Iと副教科を抜かりなく仕上げておくことが安全圏への鍵だ！');
    });
    return;
  }

  // 模試エントリー判定（高1・高2: 年2〜3回、高3: 4月, 8月, 11月, 12月）
  const isMockWeek = (
    (y === 1 && w === 2 && (m === 6 || m === 11 || m === 1)) ||
    (y === 2 && w === 2 && (m === 6 || m === 11 || m === 2)) ||
    (y === 3 && w === 2 && (m === 4 || m === 8 || m === 11 || m === 12))
  );

  const mockKey = `mock_done_${y}_${m}_${w}`;
  if (isMockWeek && !state[mockKey]) {
    state[mockKey] = true;
    enqueueModal(() => triggerMockEntry(y, m, w));
    return;
  }

  if (!state.daijobuAppeared && ((y === 2 && m >= 7) || (y === 3 && m <= 8))) {
    if (Math.random() < 0.015) {
      enqueueModal(() => triggerDaijobuDoctor());
      return;
    }
  }

  if (localStorage.getItem('juken_success_ob') && Math.random() < 0.04) {
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

  const isBunkei = state.course === '文系';
  const expSubj = isBunkei ? 'jp' : 'math';
  const expName = isBunkei ? '国語' : '数学';
  addExpToSubject(expSubj, 20);

  const flavorText = isBunkei
    ? '文理選択を終えた後、廊下で声をかけられた。\n「文系を選んだんだね。君の論理的思考や文章力、なかなか面白いよ。僕の名前は神童。良きライバルとしてよろしく」\n【神童くん】と「出かける」で切磋琢磨できるようになりました！'
    : '文理選択を終えた後、廊下で声をかけられた。\n「理系を選んだんだね。君の数学の解法アプローチ、なかなか面白いよ。僕の名前は神童。良きライバルとしてよろしく」\n【神童くん】と「出かける」で切磋琢磨できるようになりました！';

  showEventModal(
    '📐 学年1位の秀才・神童くん現る',
    flavorText,
    ['神童くん が交友関係に解放！', `${expName}経験値 +20 pt 獲得！`],
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
    '高1の秋。大学入試の基本方針を決める時期だ。文理を選択後、学習する専門科目の組み合わせを決定します。',
    [
      {
        title: '文系コース（国語・英語・社会重視）',
        subtext: '国英偏差値+2。科目が「社会」へ変化し、金特が「人文の閃き」になります。',
        action: () => {
          state.course = '文系';
          state.subjects.jp.score += 2;
          state.subjects.eng.score += 2;
          if (state.traits.includes('math_spark')) {
            state.traits = state.traits.map(t => t === 'math_spark' ? 'humanities_spark' : t);
            showFloatingText('金特が【人文の閃き】へ変化！', null, null, 'heal');
          }
          triggerSpecialtySubjectChoice('文系');
        }
      },
      {
        title: '理系コース（数学・英語・理科重視）',
        subtext: '数理偏差値+2。科目が「理科」へ変化し、金特が「数理の閃き」になります。',
        action: () => {
          state.course = '理系';
          state.subjects.math.score += 2;
          state.subjects.sci.score += 2;
          if (state.traits.includes('humanities_spark')) {
            state.traits = state.traits.map(t => t === 'humanities_spark' ? 'math_spark' : t);
            showFloatingText('金特が【数理の閃き】へ変化！', null, null, 'heal');
          }
          triggerSpecialtySubjectChoice('理系');
        }
      }
    ],
    '🧭'
  );
}

function triggerSpecialtySubjectChoice(course) {
  if (course === '理系') {
    showChoiceModal(
      '🔬 理科 専門科目の組み合わせ選択',
      '高校で履修・受験する理科の専門科目を選択しよう！\n（普段の学習は「理科」としてまとめて行い、入試や模試で各科目の実力が発揮されます）',
      [
        {
          title: '🔬 物理 ＋ 化学 （理工・工学・医進 王道型）',
          subtext: '難関国公立理系・早慶理工の標準型。数理的論理思考力を最大限に活かせる！',
          action: () => setSpecialtySubjects('理科', '物理', '化学', '物理・化学')
        },
        {
          title: '🧪 化学 ＋ 生物 （農・薬・バイオ・医療系型）',
          subtext: '生命科学・薬学部志望に最適。実験観察と有機化学の深い理解を深める！',
          action: () => setSpecialtySubjects('理科', '化学', '生物', '化学・生物')
        },
        {
          title: '🔭 物理 ＋ 生物 （先端科学・学際総合型）',
          subtext: '物理の数理モデルと生物のシステム論を横断するユニークな組み合わせ！',
          action: () => setSpecialtySubjects('理科', '物理', '生物', '物理・生物')
        }
      ],
      '🔬'
    );
  } else {
    showChoiceModal(
      '📜 地歴・公民 専門科目の組み合わせ選択',
      '高校で履修・受験する地歴・公民の科目を選択しよう！\n（普段の学習は「社会」としてまとめて行い、入試や模試で各科目の実力が発揮されます）',
      [
        {
          title: '📜 日本史 ＋ 政治経済 （私大難関・国公立標準型）',
          subtext: '早慶・MARCH文系から国公立まで幅広く対応する鉄板の組み合わせ！',
          action: () => setSpecialtySubjects('社会', '日本史', '政治経済', '日本史・政経')
        },
        {
          title: '🌍 世界史 ＋ 地理 （国際・法・グローバル型）',
          subtext: '地球規模の歴史展開と地誌・空間認知を結びつける国際志向の選択！',
          action: () => setSpecialtySubjects('社会', '世界史', '地理', '世界史・地理')
        },
        {
          title: '📖 日本史 ＋ 世界史 （最難関国公立文系 二次特化型）',
          subtext: '東大文系・京大文学部など、地歴2科目を課す難関二次試験専用の本格派！',
          action: () => setSpecialtySubjects('社会', '日本史', '世界史', '日本史・世界史')
        }
      ],
      '📜'
    );
  }
}

function setSpecialtySubjects(category, sub1, sub2, name) {
  state.specialtySubjects = { category, sub1, sub2, name };
  playSound('success');
  setDialog('進路指導', `よし、【${state.course}】の専門科目は【${name}】に決定したな！日々の勉強で実力を磨いていこう！`);
  renderUI();
}

function triggerTargetUnivChoice() {
  const isBunkei = state.course === '文系';
  // プレイヤーの文理コースに合致する大学学部を優先表示（国公立後期日程は除く）
  const availableList = UNIV_LIST.filter(u => u.type !== '国公立後期');
  const primaryList = availableList.filter(u => u.course === state.course || u.course === '共通');
  const otherList = availableList.filter(u => u.course !== state.course && u.course !== '共通');
  const sortedList = [...primaryList, ...otherList];

  const options = sortedList.map(u => {
    const w = u.weights;
    let weightDesc = [];
    if (w.math >= 1.5 && w.sci >= 1.5) weightDesc.push('数理1.5倍');
    else if (w.math === 0.0) weightDesc.push('英国社3教科(数学なし)');
    else if (w.jp === 0.0) weightDesc.push('数理英3教科(国語なし)');
    else if (w.eng >= 1.4 && w.jp >= 1.4) weightDesc.push('国英重視');
    else weightDesc.push('全科目均等');

    const recTag = u.course === state.course ? ' ⭐' : '（文理外）';
    return {
      title: `${u.name} (ボーダー: 偏差値${u.border})${recTag}`,
      subtext: `【${u.type}・${u.course}】配点: ${weightDesc.join('・')} / ${u.desc}`,
      action: () => {
        state.targetUniv = u;
        enqueueModal(() => {
          showEventModal(
            `🎯 第1志望校・学部決定！`,
            `【${u.name}】を第一志望に設定した！\n目標ボーダーは偏差値【${u.border}】だ！\n（${u.desc}）`,
            [
              `第1志望: ${u.name}`,
              `目標ボーダー: 偏差値 ${u.border}`,
              `入試方式: ${u.type}・${u.course}（配点: ${weightDesc.join('・')}）`
            ],
            '🏫'
          );
        });
        setDialog('担任の先生', `よし、高い目標を掲げたな！合格を勝ち取るために全力で行くぞ！`);
        renderUI();
      }
    };
  });

  showChoiceModal('🎓 志望校・学部を決定しよう！', '高校3年生の春。いよいよ受験する大学・学部のターゲットを定める時が来た！', options, '🏫');
}

function triggerApplicationChoice() {
  const isBunkei = state.course === '文系';
  const targetId = state.targetUniv ? state.targetUniv.id : '';
  
  // プレイヤーの文理コースに合致する私立大学（第1志望と同じものは除く）
  let subCandidates = UNIV_LIST.filter(u => 
    u.type === '私立' && 
    (u.course === state.course || u.course === '共通') &&
    u.id !== targetId
  );

  // もし該当がなければ全私大から
  if (subCandidates.length === 0) {
    subCandidates = UNIV_LIST.filter(u => u.type === '私立' && u.id !== targetId);
  }

  // ボーダー降順（難関から中堅・安全校へ）
  subCandidates.sort((a, b) => b.border - a.border);

  const options = subCandidates.map(u => {
    const curDev = calcTargetDev(u);
    const diff = (curDev - u.border).toFixed(1);
    const diffPrefix = diff >= 0 ? `+${diff}` : `${diff}`;
    let judge = 'C判定';
    if (diff >= 3) judge = 'A判定 (安全圏)';
    else if (diff >= 0) judge = 'B判定 (実力相応)';
    else if (diff >= -4) judge = 'C判定 (ボーダー付近)';
    else judge = 'D〜E判定 (チャレンジ)';

    return {
      title: `${u.name} (偏差値${u.border} / 現在${judge})`,
      subtext: `傾斜偏差値: ${curDev} (${diffPrefix}) | 共通テスト利用 ＆ 2月個別日程併願`,
      action: () => {
        state.subUniv = u;
        enqueueModal(() => {
          showEventModal(
            `📑 私大併願校の出願完了！`,
            `【${u.name}】（ボーダー偏差値 ${u.border}）の出願手続きを完了した！\n\n1月の大学入学共通テストでは「共通テスト利用入試」にも同時出願！\n高得点を獲得できれば2月の個別試験前に合格を確定できるぞ！`,
            [
              `併願校: ${u.name}`,
              `目標ボーダー: 偏差値 ${u.border}`,
              `判定状況: ${judge}（傾斜偏差値 ${curDev}）`
            ],
            '📑'
          );
        });
        setDialog('担任の先生', `【${u.name}】の出願だな！共通テスト利用と2月個別の2段構えでいこう！`);
        renderUI();
      }
    };
  });

  // 背水の陣オプション
  options.push({
    title: '🔥 併願なし（第1志望一本勝負・背水の陣）',
    subtext: '私大の併願は行わず、第1志望校のみに出願する。後戻りできない覚悟でやる気UP！',
    action: () => {
      state.subUniv = null;
      state.motivation = Math.min(4, state.motivation + 1);
      enqueueModal(() => {
        showEventModal(
          `🔥 背水の陣！第1志望一本勝負！`,
          `私立大学の併願は一切行わず、第1志望【${state.targetUniv ? state.targetUniv.name : '志望校'}】のみに出願することを決断した！\n\n退路を断ったことで凄まじい集中力が湧き上がってきた！（やる気UP！）`,
          [
            '併願校: なし（出願せず）',
            '背水の陣ボーナス: やる気+1'
          ],
          '🔥'
        );
      });
      setDialog('担任の先生', `一本勝負か…！覚悟はいいな。その気迫で合格を勝ち取れ！`);
      renderUI();
    }
  });

  showChoiceModal(
    '🎯 冬の出願戦略会議（私大併願校の決定）',
    '高校3年 12月。いよいよ大学入試の出願シーズンが始まった！\n共通テスト利用入試および2月個別日程で併願する私立大学（すべり止め・併願校）を決定しよう！',
    options,
    '📑'
  );
}

function triggerSubExamEvent() {
  if (!state.subUniv) {
    // 併願校なしの場合
    showEventModal(
      '📖 二次試験直前・総仕上げ期間',
      '私大併願校の受験はなく、2月下旬の第1志望・二次試験本番に向けて最後の総復習に専念した！',
      ['体力を維持しつつ、最終確認を完了！'],
      '📖'
    );
    setDialog(state.playerName, 'いよいよ次は第1志望の二次試験本番だ…！');
    renderUI();
    return;
  }

  // すでに共通テスト利用で合格済みの場合
  if (state.subUnivKyotsuPass) {
    playSound('success');
    state.motivation = Math.min(4, state.motivation + 1);
    state.stamina = state.maxStamina;
    state.stress = Math.max(0, state.stress - 20);
    showEventModal(
      '🎉 併願校合格確保済み！私大個別試験は免除！',
      `共通テスト利用入試で見事【${state.subUniv.name}】の合格を確保しているため、2月の私大個別試験は受験不要！\n\nすべり止め校を確保した大きな精神的アドバンテージを得て、月末の第1志望本番に全集中できる！`,
      [
        `合格確保済み: ${state.subUniv.name}`,
        '私大個別日程: 受験免除',
        '安心感により やる気UP & 体力全快 & ストレス-20！'
      ],
      '👑'
    );
    setDialog('担任の先生', `すでに合格を1つ持っているのは大きな強みだ！この勢いで第1志望を突破しよう！`);
    renderUI();
    return;
  }

  // 共通テスト利用で受かっていない場合 ➔ 個別試験本番
  showEventModal(
    '⚔️ 私大個別日程入試 本番！',
    `併願校【${state.subUniv.name}】（ボーダー偏差値 ${state.subUniv.border}）の個別日程入試が始まった！\n得意教科を活かした3教科の勝負！合格を勝ち取って浪人を回避せよ！`,
    [`受験校: ${state.subUniv.name}`, `試験科目: 3教科記述`],
    '🎓',
    () => startExamBattle('private_sub')
  );
}

function triggerFinalApplicationChoice() {
  const target = state.targetUniv || UNIV_LIST[0];
  const isTargetKokuritsu = target.type === '国公立';

  const options = [];

  // 選択肢1: 初志貫徹！このまま出願
  options.push({
    title: `🔥 初志貫徹！第1志望【${target.name}】に前期出願する！`,
    subtext: `共テ判定【${state.kyotsuResearchRank || '判定'}】。これまでの努力を信じて本命校に突撃！(やる気+1)`,
    action: () => {
      state.motivation = Math.min(4, state.motivation + 1);
      showEventModal(
        '🔥 初志貫徹の出願完了！',
        `第1志望【${target.name}】（ボーダー偏差値 ${target.border}）への前期日程出願を完了した！\n共テ判定は【${state.kyotsuResearchRank || 'C'}判定】だが、二次記述で逆転を狙う！`,
        [`出願先: ${target.name}（前期日程）`, '覚悟を決めてやる気+1！'],
        '🔥',
        () => {
          if (isTargetKokuritsu) {
            triggerKoukiSelect();
          } else {
            renderUI();
          }
        }
      );
    }
  });

  // 選択肢2: 国公立志望の場合、中堅・安全校への出願変更オプション
  if (isTargetKokuritsu && target.border > 60) {
    const saferUniv = UNIV_LIST.find(u => u.type === '国公立' && u.course === state.course && u.border <= 60);
    if (saferUniv) {
      options.push({
        title: `🛡️ 志望校変更！手堅い国公立【${saferUniv.name}】へ変更する`,
        subtext: `目標ボーダー偏差値 ${saferUniv.border}。手堅く現役合格を狙う現実的選択！(ストレス-15)`,
        action: () => {
          state.targetUniv = saferUniv;
          state.stress = Math.max(0, state.stress - 15);
          showEventModal(
            '🛡️ 前期出願校の変更完了！',
            `共通テストリサーチ結果を受け、前期日程の出願先を【${saferUniv.name}】（ボーダー偏差値 ${saferUniv.border}）へ変更した！\n合格の勝算が大幅にアップ！`,
            [`変更後の第1志望: ${saferUniv.name}`, '精神的負担が和らぎ ストレス-15！'],
            '🏫',
            () => triggerKoukiSelect()
          );
        }
      });
    }
  }

  showChoiceModal(
    '📑 共テリサーチ返却！国公立 前期・後期 最終出願戦略',
    `共通テスト自己採点結果: 【 ${state.kyotsuScore}点 (${state.kyotsuRate}%) 】\n第1志望【${target.name}】のリサーチ判定: 【 ${state.kyotsuResearchRank || '判定'} 】\n\n前期日程の出願先を確定させよう！`,
    options,
    '📑'
  );
}

function triggerKoukiSelect() {
  const isBunkei = state.course === '文系';
  const koukiCandidates = UNIV_LIST.filter(u => u.type === '国公立後期' && (u.course === state.course || u.course === '共通'));
  koukiCandidates.sort((a, b) => b.border - a.border);

  const options = koukiCandidates.map(u => {
    const curDev = calcTargetDev(u);
    const diff = (curDev - u.border).toFixed(1);
    const diffPrefix = diff >= 0 ? `+${diff}` : `${diff}`;
    return {
      title: `${u.name} (ボーダー偏差値 ${u.border})`,
      subtext: `傾斜偏差値: ${curDev} (${diffPrefix}) | 前期不合格時のラストチャンス`,
      action: () => {
        state.kokuritsuKouki = u;
        showEventModal(
          '📑 国公立 後期日程 出願完了！',
          `【${u.name}】（ボーダー偏差値 ${u.border}）への後期日程出願を完了した！\nもし2月下旬の前期日程で涙を呑むことになっても、3月中旬にこの後期日程で最後の逆転を狙える！`,
          [`後期出願校: ${u.name}`, `ボーダー偏差値: ${u.border}`],
          '📑'
        );
        setDialog('担任の先生', `よし、これで前期・後期の2段構えが完成したな！本命の前期突破を目指して全力を尽くせ！`);
        renderUI();
      }
    };
  });

  options.push({
    title: '⚠️ 国公立後期は出願しない（前期一本勝負）',
    subtext: '後期日程の出願は行わず、前期および私大併願のみで勝負する。',
    action: () => {
      state.kokuritsuKouki = null;
      renderUI();
    }
  });

  showChoiceModal(
    '🏛️ 国公立 後期日程の出願先決定',
    '国公立大学の後期日程（3月中旬実施）は、前期不合格者が挑む最後の逆転枠だ！\n出願する後期日程大学を1校決定しよう！',
    options,
    '🏛️'
  );
}

function triggerZenkiResultEvent() {
  const target = state.targetUniv || UNIV_LIST[0];
  let finalBonus = 0;
  if (state.traits.includes('miracle_pass')) finalBonus += 4.5;
  if (state.traits.includes('math_spark')) finalBonus += 3.0;
  if (state.traits.includes('humanities_spark')) finalBonus += 3.0;
  if (state.traits.includes('strong_exam')) finalBonus += 2.0;
  if (state.traits.includes('weak_exam')) finalBonus -= 2.0;

  let finalDev = calcTargetDev(target, finalBonus);
  const isPassed = finalDev >= (target.border - 1.2);
  state.firstChoicePassed = isPassed;

  if (isPassed) {
    playSound('fanfare');
    triggerParticles(null, null, 40, 'confetti');
    showEventModal(
      `🌸 祝！【${target.name}】 前期日程 合格発表！ 🌸`,
      `合格者受験番号一覧の中に、自分の番号が確かにあった！\n第1志望【${target.name}】（ボーダー偏差値 ${target.border}）に見事現役合格！！\n高校3年間のすべての努力が最高の形で報われた！`,
      [
        `前期日程合否: 【 合格 💮 】`,
        `最終傾斜偏差値: ${finalDev} (目標ボーダー: ${target.border})`,
        '堂々の第1志望合格！栄光の大学生活へ進もう！'
      ],
      '🎓',
      () => triggerGameEnd()
    );
    setDialog('担任の先生', `受かったぞ！！本当によく頑張った！おめでとう！！`);
    renderUI();
    return;
  }

  // 前期不合格の場合
  playSound('fail');
  triggerScreenShake();

  const hasSubPass = state.subUniv && state.subUnivPassed;
  const hasKouki = state.kokuritsuKouki !== null;

  if (hasSubPass && hasKouki) {
    const options = [
      {
        title: `⚔️ 諦めない！国公立後期【${state.kokuritsuKouki.name}】にすべてを賭ける！`,
        subtext: `私立の合格権利を保持したまま、3月2週の国公立後期日程にラストチャンスで挑む！(やる気UP)`,
        action: () => {
          state.motivation = Math.min(4, state.motivation + 1);
          showEventModal(
            '🔥 背水の陣！後期日程への挑戦！',
            `私立合格の安心感を胸に、3月2週の国公立後期日程【${state.kokuritsuKouki.name}】へ挑むことを決断した！\n最後の最後まで粘り強く栄冠を掴み取れ！`,
            [`受験校: ${state.kokuritsuKouki.name}`, 'ラストチャンスへ向け やる気UP！'],
            '⚔️',
            () => advanceTurn()
          );
          setDialog(state.playerName, 'まだ終わりじゃない！後期日程で絶対に合格を掴み取ってやる！');
          renderUI();
        }
      },
      {
        title: `🌸 私立併願校【${state.subUniv.name}】への進学を決定する`,
        subtext: `これ以上無理はせず、合格を確保した名門私大への進学を確定して受験を終える。`,
        action: () => {
          showEventModal(
            `🌸 【${state.subUniv.name}】 進学確定！`,
            `実力で勝ち取った併願校【${state.subUniv.name}】への進学を決定し、受験生活を晴れやかに終了した！`,
            [`進学先: ${state.subUniv.name}`, '浪人回避・新たなスタート！'],
            '🌸',
            () => triggerGameEnd()
          );
        }
      }
    ];

    showChoiceModal(
      `🍂 【${target.name}】 前期不合格……進路の決断`,
      `無情にも第1志望【${target.name}】（ボーダー偏差値 ${target.border}）の合格者一覧に番号はなかった……。\nしかし、私立併願校【${state.subUniv.name}】の合格は確保している！\n\n後期日程に挑戦するか、私立への進学を決めるか選択しよう！`,
      options,
      '⚖️'
    );

  } else if (hasKouki) {
    showEventModal(
      `🍂 【${target.name}】 前期日程 不合格……`,
      `第1志望【${target.name}】の壁は厚く、涙を呑む結果となった……。\nだがまだチャンスはある！3月2週の国公立後期日程【${state.kokuritsuKouki.name}】が君を待っている！\n涙を拭いて、最後の栄光を掴み取れ！`,
      [
        `前期日程合否: 【 不合格 ❌ 】`,
        `残された道: 国公立後期日程【${state.kokuritsuKouki.name}】へ突入！`
      ],
      '⚔️',
      () => advanceTurn()
    );
    setDialog('担任の先生', `まだだ！後期日程が残っている！ここで諦めたら終わりだぞ、立ち上がれ！`);

  } else {
    showEventModal(
      `🍂 【${target.name}】 不合格……全日程終了`,
      `全力を尽くしたが、第1志望の合格通知には届かなかった……。すべての入試日程が終了した。`,
      [`前期日程合否: 【 不合格 ❌ 】`],
      '🍂',
      () => triggerGameEnd()
    );
  }

  renderUI();
}

function triggerKoukiExamEvent() {
  const koukiUniv = state.kokuritsuKouki;
  showEventModal(
    '🔥 国公立大学 後期日程 本番！',
    `泣いても笑ってもこれが高校3年間のラストバトル！\n後期日程【${koukiUniv.name}】（ボーダー偏差値 ${koukiUniv.border}）の試験開始ベルが鳴り響いた！\n残されたすべての情熱を解答用紙にぶつけろ！`,
    [`受験校: ${koukiUniv.name}`, `試験科目: 総合論述・専門記述（300点満点）`],
    '🎓',
    () => startExamBattle('kouki')
  );
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
            const goldTrait = state.course === '文系' ? 'humanities_spark' : (state.course === '理系' ? 'math_spark' : 'miracle_pass');
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
  let ob;
  try {
    ob = JSON.parse(localStorage.getItem('juken_success_ob'));
  } catch(e) {}
  if (!ob) return;

  const bestSubj = ob.bestSubject || 'eng';
  const bestSubjName = ob.bestSubjectName || getSubjectDisplayName(bestSubj);

  // 得意科目に特化（+25 pt）、他科目は基礎アドバイス（+6 pt）
  ['eng', 'math', 'jp', 'sci'].forEach(s => {
    if (s === bestSubj) {
      addExpToSubject(s, 25);
    } else {
      addExpToSubject(s, 6);
    }
  });
  if (state.motivation < 4) state.motivation++;

  showEventModal(
    `👨‍🎓 ${ob.name}先輩の激励訪問！`,
    `前周回で見事【${ob.univ}】に合格した伝説の先輩が来校！\n「特に俺が得意だった【${bestSubjName}】の受験テクニックを伝授してやるぞ！」と熱血指導と参考書を差し入れてくれた！`,
    [
      `得意科目【${bestSubjName}】経験値 +25 pt！`,
      `他全教科 経験値 +6 pt！`,
      `やる気アップ ⤴`
    ],
    '👑'
  );
  setDialog(`${ob.name}先輩`, `俺の得意な${bestSubjName}なら何でも聞いてくれ！お前なら絶対に志望校へ行けるぞ！`);
  renderUI();
}

function runSchoolExam() {
  playSound('success');
  let avg = Math.round((state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score) / 4);
  let dev = calcDeviation(avg);
  let rankStr = '';
  let rewardText = '';
  let schoolRank = '';

  let examReviewExp = 18;
  if (avg >= 75) {
    schoolRank = '学年 5位以内 (上位 2%)';
    rankStr = '学年トップクラス！全校に名前が轟く秀才！';
    if (state.motivation < 4) state.motivation++;
    state.money += 1000;
    examReviewExp = 35;
    rewardText = '特別お小遣い +¥1,000 / 考査徹底復習: 全教科経験値 +35pt！';
  } else if (avg >= 60) {
    schoolRank = '学年 25位 (上位 12%)';
    rankStr = '成績優秀！先生や親から大きく褒められた！';
    if (state.motivation < 4) state.motivation++;
    state.money += 500;
    examReviewExp = 26;
    rewardText = '臨時お小遣い +¥500 / 考査復習: 全教科経験値 +26pt！';
  } else if (avg >= 45) {
    schoolRank = '学年 95位 (平均レベル)';
    rankStr = '学年平均レベル。基礎はしっかり定着している。';
    examReviewExp = 18;
    rewardText = '考査復習: 全教科経験値 +18pt！';
  } else {
    schoolRank = '学年 178位 (下位 10%)';
    rankStr = '赤点ギリギリ…補習の危機！';
    if (state.motivation > 0) state.motivation--;
    examReviewExp = 12;
    rewardText = 'やる気ダウン… / 追試復習: 全教科経験値 +12pt';
  }
  ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, examReviewExp));

  state.history.unshift(`${state.year}年生${state.month}月 定期考査: 【${schoolRank}】(学力平均 ${avg}・学内偏差値 ${dev})`);

  showEventModal(
    '📝 校内定期考査 結果発表！',
    `全教科のテストが返却された！\n4教科平均学力: ${avg} （${getRank(avg).rank}ランク）\n校内成績: 【${schoolRank}】\n\n${rankStr}`,
    [`校内順位: ${schoolRank}`, `学内換算偏差値: ${dev}`, rewardText],
    '📋'
  );
  setDialog('担任の先生', `定期テストの結果が出たぞ。校内成績は【${schoolRank}】だ！慢心せず次へ向けろ！`);
  renderUI();
}

function triggerMockEntry(y, m, w) {
  const targetUnivName = state.targetUniv ? state.targetUniv.name : '第1志望大学';
  let kanName = '難関大学 突破オープン模試';
  if (state.targetUniv) {
    if (state.targetUniv.id.includes('todai')) kanName = '東大入試実戦模試';
    else if (state.targetUniv.id.includes('kyodai')) kanName = '京大入試オープン模試';
    else if (state.targetUniv.id.includes('waseda')) kanName = '早大入試プレ模試';
    else if (state.targetUniv.id.includes('keio')) kanName = '慶大入試プレ模試';
    else if (state.targetUniv.type === '国公立') kanName = `${state.targetUniv.shortName || '難関国公立'} 突破オープン模試`;
    else kanName = `${state.targetUniv.shortName || '有名私大'} 突破プレ模試`;
  }

  const options = [];

  // 高3の8月・11月は「志望校冠模試」が主役！
  if (y === 3 && (m === 8 || m === 11)) {
    options.push({
      title: `🏛️ 【${kanName}】を受験する！`,
      subtext: `志望校【${targetUnivName}】の出題形式・配点を完全模倣！A/B判定で特能【本番◯】や自信を獲得！（費用無料 / 体力-28）`,
      action: () => executeMockExam('kan', kanName)
    });
  }

  // 共通テスト型マーク模試
  const markName = y === 3 && m === 12 ? '全統共通テストプレ模試（直前ファイナル）' : (y === 3 ? '全統共通テスト模試' : `第${m === 6 ? 1 : (m === 11 ? 2 : 3)}回 マーク模試`);
  options.push({
    title: `📊 【${markName}】を受験する`,
    subtext: `新課程1000点満点換算！全教科の基礎バランス・共テ足切り判定を測定。（費用無料 / 体力-22）`,
    action: () => executeMockExam('mark', markName)
  });

  // 記述模試（高1〜高3）
  if (!(y === 3 && m === 12)) {
    const descName = y === 3 ? '全統記述模試（二次・私大実戦）' : `第${m === 6 ? 1 : 2}回 学力記述模試`;
    options.push({
      title: `📝 【${descName}】を受験する`,
      subtext: `論述・記述形式の難問演習！二次試験の記述力を鍛え、主要教科の経験値特大。（費用無料 / 体力-25）`,
      action: () => executeMockExam('desc', descName)
    });
  }

  // 見送り選択肢
  options.push({
    title: '📖 今回は模試を見送り、自習・休養に専念する',
    subtext: '体力と時間を温存し、自分のペースで苦手分野の勉強や体調管理を行います。（費用¥0 / 体力消費なし）',
    action: () => {
      playSound('click');
      showEventModal(
        '📖 模試見送り・自習期間',
        '今回は模試の受験を見送り、自分の課題に合わせた弱点克服学習と体調管理に専念した！',
        ['体力消費なし', 'この週の通常行動（勉強・休養・お出かけ）を行えます'],
        '📖'
      );
      setDialog(state.playerName, '模試の時期だけど、今は基礎の穴埋めを優先しよう！自分のペースを大切にするぞ。');
      renderUI();
    }
  });

  playSound('click');
  showChoiceModal(
    `📑 ${y}年生 ${m}月 模試エントリー選択！`,
    `大手予備校の模試シーズンがやってきた！\n自分の志望校戦略に合わせて、受験する模試を選択しよう！（学校一括申込のため受験料は無料です）`,
    options,
    '📊'
  );
}

function executeMockExam(mockType, mockTitle) {
  playSound('success');
  let stamCost = mockType === 'kan' ? 28 : (mockType === 'desc' ? 25 : 22);
  state.stamina = Math.max(0, state.stamina - stamCost);
  state.stress = Math.min(100, state.stress + 8);

  let totalScore = state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score;
  let avgAcademic = totalScore / 4;

  // やる気補正
  const motBonusTable = { 4: 1.5, 3: 0.8, 2: 0.0, 1: -1.0, 0: -2.0 };
  let motBonus = motBonusTable[state.motivation] || 0;

  // 特能補正
  let traitBonus = 0;
  if (state.traits.includes('strong_exam')) traitBonus += 3.0;
  if (state.traits.includes('weak_exam')) traitBonus -= 3.0;

  // 当日のブレ
  let randomJitter = (Math.random() - 0.5) * 1.6;
  const totalBonus = motBonus + traitBonus + randomJitter;

  let generalDev = calcDeviation(avgAcademic, totalBonus);
  let dev = state.targetUniv ? calcTargetDev(state.targetUniv, totalBonus) : generalDev;
  let targetBorder = state.targetUniv ? state.targetUniv.border : 58;

  let diff = dev - targetBorder;
  let judge = 'E';
  let probText = '合格可能性 20%未満';
  if (diff >= 2.0) { judge = 'A'; probText = '合格可能性 80%以上 (安全圏)'; }
  else if (diff >= 0.0) { judge = 'B'; probText = '合格可能性 60%以上 (合格圏)'; }
  else if (diff >= -3.0) { judge = 'C'; probText = '合格可能性 40%以上 (ボーダーライン)'; }
  else if (diff >= -6.0) { judge = 'D'; probText = '合格可能性 20%以上 (努力圏)'; }

  // 共通テスト型マーク模試なら 1000点満点換算得点を算出
  let kyotsuScoreEst = Math.min(1000, Math.round((generalDev / 75) * 850 + (state.subExtraScore || 35) * 1.5 + (Math.random() - 0.5) * 20));
  let kyotsuRateEst = Math.round((kyotsuScoreEst / 1000) * 100);

  const targetUnivName = state.targetUniv ? state.targetUniv.name : '志望大学';
  state.history.unshift(`${state.year}年${state.month}月 ${mockTitle}: 【${judge}判定】 (傾斜偏差値 ${dev} / 総合 ${generalDev})`);

  let traitMsg = '';
  if ((judge === 'A' || judge === 'B') && !state.traits.includes('strong_exam') && Math.random() < 0.5) {
    state.traits.push('strong_exam');
    traitMsg = '✨ 特能閃き！大舞台での好結果から【本番に強い】を体得した！';
  }

  // 模試ごとの復習ボーナス
  const isMaster = state.traits.includes('review_master');
  let reviewMsg = '';
  if (mockType === 'desc') {
    // 記述模試: 主要教科（理系なら数理、文系なら英国社）に特大ボーナス
    const pts = isMaster ? 45 : 30;
    if (state.course === '理系') {
      addExpToSubject('math', pts);
      addExpToSubject('sci', pts);
      addExpToSubject('eng', Math.round(pts * 0.6));
      addExpToSubject('jp', Math.round(pts * 0.4));
    } else {
      addExpToSubject('eng', pts);
      addExpToSubject('jp', pts);
      addExpToSubject('sci', pts);
      addExpToSubject('math', Math.round(pts * 0.4));
    }
    reviewMsg = `記述模試徹底復習！二次主要教科 経験値 +${pts} pt 獲得！`;
  } else if (mockType === 'kan') {
    // 冠模試: 全教科 + 志望校対策特大ボーナス
    const pts = isMaster ? 45 : 32;
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, pts));
    reviewMsg = `冠模試解き直し完了！全教科 経験値 +${pts} pt ＆ 志望校適性大幅UP！`;
  } else {
    // マーク模試: 全教科均等
    const pts = isMaster ? 35 : 20;
    ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, pts));
    reviewMsg = `マーク模試解き直し完了！全教科 経験値 +${pts} pt 獲得！`;
  }

  let rewards = [
    `判定: 【 ${judge} 判定 】 (${probText})`,
    `志望学部 傾斜偏差値: ${dev} （目標ボーダー: ${targetBorder}）`,
    mockType === 'mark' ? `共テ1000点換算: 約 ${kyotsuScoreEst} 点 (${kyotsuRateEst}%)` : `全国総合偏差値: ${generalDev}`,
    reviewMsg,
    judge === 'A' || judge === 'B' ? '好判定により やる気 絶好調！！' : 'ここからの弱点補強が合否を分ける！',
    traitMsg
  ].filter(Boolean);

  if (judge === 'A' || judge === 'B') state.motivation = 4;

  showEventModal(
    `📊 【${mockTitle}】 帳票返却！`,
    `模試の成績表が返却された！\n第1志望【${targetUnivName}】の判定結果は……【 ${judge} 判定 】！\n\n（体力 -${stamCost} / ストレス +8%）`,
    rewards,
    mockType === 'kan' ? '🏛️' : (mockType === 'desc' ? '📝' : '📊'),
    () => advanceTurn()
  );

  setDialog('予備校アドバイザー', `現在の判定は【${judge}判定】(偏差値${dev})です。模試の復習を徹底して、次のステップへ繋げましょう！`);
  renderUI();
}

function runMockExam() {
  triggerMockEntry(state.year, state.month, state.week);
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
  maxScore: 500,
  score: 0
};

function startExamBattle(type) {
  battleState.examType = type;
  battleState.step = 0;
  battleState.score = 0;

  const isKyotsu = type === 'kyotsu';
  const isSubExam = type === 'private_sub';
  const isKouki = type === 'kouki';
  
  let title = '🎓 国公立二次試験（前期日程）/ 第1志望本番！';
  let maxScore = 500;
  let maxSteps = 5;

  if (isKyotsu) {
    title = '🔥 大学入学共通テスト 本番！（新課程1000点満点）';
    maxScore = 1000;
    maxSteps = 5;
  } else if (isSubExam) {
    const subName = state.subUniv ? state.subUniv.name : '私立併願大学';
    title = `⚔️ 私立大学個別入試 【${subName}】 本番！`;
    maxScore = 300;
    maxSteps = 3;
  } else if (isKouki) {
    const koukiName = state.kokuritsuKouki ? state.kokuritsuKouki.name : '国公立後期大学';
    title = `🔥 国公立大学 後期日程 【${koukiName}】 本番！`;
    maxScore = 300;
    maxSteps = 3;
  }

  battleState.maxScore = maxScore;
  battleState.maxSteps = maxSteps;

  document.getElementById('battle-exam-title').textContent = title;
  document.getElementById('battle-current-score').textContent = `獲得得点: 0 / ${maxScore}`;

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
  const maxSteps = battleState.maxSteps || 5;
  const maxScore = battleState.maxScore || 500;

  const isBunkeiBattle = state.course === '文系';
  const isRikeiBattle = state.course === '理系';
  const isSubExam = battleState.examType === 'private_sub';
  const isKouki = battleState.examType === 'kouki';

  let questions = [];
  if (isSubExam) {
    if (isBunkeiBattle) {
      questions = [
        { name: '第1問：長文総合読解・要約（英語）', subj: 'eng', max: 100 },
        { name: '第2問：現代文・古文・論述（国語）', subj: 'jp', max: 100 },
        { name: '第3問：歴史・公民・史料考察（社会）', subj: 'sci', max: 100 }
      ];
    } else {
      questions = [
        { name: '第1問：科学技術英語・読解（英語）', subj: 'eng', max: 100 },
        { name: '第2問：微分積分・数列ベクトル（数学）', subj: 'math', max: 100 },
        { name: '第3問：物理／化学・総合考察（理科）', subj: 'sci', max: 100 }
      ];
    }
  } else if (isKouki) {
    if (isBunkeiBattle) {
      questions = [
        { name: '第1問：超長文読解・英文論述（英語）', subj: 'eng', max: 100 },
        { name: '第2問：多角的読解・総合小論文（国語）', subj: 'jp', max: 100 },
        { name: '第3問：歴史的思索・課題解決論述（社会）', subj: 'sci', max: 100 }
      ];
    } else {
      questions = [
        { name: '第1問：先端科学英語・専門読解（英語）', subj: 'eng', max: 100 },
        { name: '第2問：難関微積・証明総合問題（数学）', subj: 'math', max: 100 },
        { name: '第3問：物理／化学・考察実験総合（理科）', subj: 'sci', max: 100 }
      ];
    }
  } else if (battleState.examType === 'kyotsu') {
    const spec = state.specialtySubjects;
    const sciLabel = spec ? spec.name : (isBunkeiBattle ? '社会2科目' : '理科2科目');
    const fukuLabel = isBunkeiBattle ? '理科基礎' : '社会';
    questions = [
      { name: '第1問：外国語・英語（R 100点 ＋ L 100点）', subj: 'eng', max: 200 },
      { name: '第2問：数学（数I・A 100点 ＋ 数II・B・C 100点）', subj: 'math', max: 200 },
      { name: '第3問：国語（現代文 110点 ＋ 古文漢文 90点）', subj: 'jp', max: 200 },
      { name: `第4問：専門選択2科目【${sciLabel}】（各100点）`, subj: 'sci', max: 200, isTwoSubjects: true },
      { name: `第5問：新課程！【情報I 100点 ＋ ${fukuLabel} 100点】`, subj: 'sub_extra', max: 200, isExtraTwo: true }
    ];
  } else {
    // 国公立二次試験（前期日程）/ 第1志望本番
    const spec = state.specialtySubjects;
    const sciName = spec ? `専門【${spec.name}】（2科目別採点）` : (isBunkeiBattle ? '史料読解・論述（社会）' : '実験考察・計算（理科）');
    const q5Subj = isBunkeiBattle ? 'jp' : 'math';
    const q5Name = isBunkeiBattle ? '第5問：最難関・総合論述問題（国語）' : '第5問：最難関・総合記述問題（数学）';

    questions = [
      { name: '第1問：長文読解・英文和訳（英語）', subj: 'eng', max: 100 },
      { name: '第2問：微積・数列ベクトル（数学）', subj: 'math', max: 100 },
      { name: '第3問：現代文・古文漢文論述（国語）', subj: 'jp', max: 100 },
      { name: `第4問：${sciName}`, subj: 'sci', max: 100, isSecondaryTwo: !!spec },
      { name: q5Name, subj: q5Subj, max: 100 }
    ];
  }

  const q = questions[step - 1];
  document.getElementById('battle-subject-name').textContent = q.name;
  document.getElementById('exam-progress-fill').style.width = `${(step / maxSteps) * 100}%`;

  const term = document.getElementById('exam-log-terminal');
  const isKyotsuBattle = battleState.examType === 'kyotsu';
  const qMax = q.max || 100;

  let baseScore = 50;
  if (q.subj === 'sub_extra') {
    baseScore = state.subExtraScore || 35;
  } else if (state.subjects[q.subj]) {
    baseScore = state.subjects[q.subj].score;
  }

  let gained = 0;
  if (qMax === 200) {
    // 共通テスト200点満点大問
    gained = Math.round(baseScore * 2.1) + Math.floor(Math.random() * 20);
  } else {
    // 二次試験・個別試験100点満点大問
    gained = Math.round(baseScore * 1.2) + Math.floor(Math.random() * 15);
  }

  if (state.traits.includes('strong_exam')) {
    const b = qMax === 200 ? 15 : 10;
    gained += b;
    term.innerHTML += `<div class="log-line trait">【青特】「本番に強い」が発動！プレッシャーを味方につけた！(+${b}点)</div>`;
  }
  if (state.traits.includes('math_spark') && (q.subj === 'math' || q.subj === 'sci')) {
    const sparkBonus = Math.round(gained * 0.35) + (qMax === 200 ? 12 : 8);
    gained += sparkBonus;
    term.innerHTML += `<div class="log-line trait">【金特】「数理の閃き」クリティカル発動！！難問を完全掌握！(+${sparkBonus}点)</div>`;
    triggerParticles(null, null, 25, 'gold');
    triggerScreenBounce();
  }
  if (state.traits.includes('humanities_spark') && (q.subj === 'jp' || q.subj === 'sci' || q.subj === 'eng')) {
    const sparkBonus = Math.round(gained * 0.35) + (qMax === 200 ? 12 : 8);
    gained += sparkBonus;
    term.innerHTML += `<div class="log-line trait">【金特】「人文の閃き」クリティカル発動！！深い論理と思考力！(+${sparkBonus}点)</div>`;
    triggerParticles(null, null, 25, 'gold');
    triggerScreenBounce();
  }
  if (state.traits.includes('lang_master') && (q.subj === 'eng' || q.subj === 'jp')) {
    const b = qMax === 200 ? 25 : 20;
    gained += b;
    term.innerHTML += `<div class="log-line trait">【金特】「言語の極意」が発動！！論理展開を完璧に掌握！(+${b}点)</div>`;
    triggerParticles(null, null, 20, 'gold');
    triggerScreenBounce();
  }

  if (state.traits.includes('careless_mistake') && Math.random() < 0.35) {
    if (state.hasAmulet) {
      state.hasAmulet = false;
      term.innerHTML += `<div class="log-line trait">🌸 あおいの「合格祈願お守り」が輝いた！計算ミスを寸前で自覚して書き直した！</div>`;
      triggerParticles(null, null, 16, 'star');
    } else {
      const p = qMax === 200 ? 35 : 25;
      gained -= p;
      term.innerHTML += `<div class="log-line fail">【赤特】「ケアレスミス癖」発動…！符号の書き間違いで部分点を落とした！(-${p}点)</div>`;
      triggerScreenShake();
      showFloatingText(`-${p}点 痛恨のミス！`, null, null, 'damage');
    }
  }

  gained = Math.max(Math.round(qMax * 0.15), Math.min(qMax, gained));
  battleState.score += gained;
  document.getElementById('battle-current-score').textContent = `獲得得点: ${battleState.score} / ${maxScore}`;
  triggerParticles(null, null, 12, 'star');

  // 専門2科目の個別採点ログ出力
  if (q.isTwoSubjects && state.specialtySubjects) {
    const spec = state.specialtySubjects;
    const diff = Math.floor((Math.random() - 0.5) * 8);
    const s1 = Math.max(15, Math.min(100, Math.round(gained * 0.5) + diff));
    const s2 = gained - s1;
    term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;
    term.innerHTML += `<div class="log-line sub-detail">　├ 【${spec.sub1}】 ${s1}点 / 100点</div><div class="log-line sub-detail">　└ 【${spec.sub2}】 ${s2}点 / 100点</div>`;
  } else if (q.isExtraTwo) {
    const fukuName = state.course === '文系' ? '理科基礎' : '社会';
    const diff = Math.floor((Math.random() - 0.5) * 8);
    const sInfo = Math.max(15, Math.min(100, Math.round(gained * 0.5) + diff));
    const sFuku = gained - sInfo;
    term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;
    term.innerHTML += `<div class="log-line sub-detail">　├ 【情報I】 ${sInfo}点 / 100点</div><div class="log-line sub-detail">　└ 【${fukuName}】 ${sFuku}点 / 100点</div>`;
  } else if (q.isSecondaryTwo && state.specialtySubjects) {
    const spec = state.specialtySubjects;
    const diff = Math.floor((Math.random() - 0.5) * 4);
    const s1 = Math.max(5, Math.min(50, Math.round(gained * 0.5) + diff));
    const s2 = gained - s1;
    term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;
    term.innerHTML += `<div class="log-line sub-detail">　├ 【${spec.sub1}】 ${s1}点 / 50点</div><div class="log-line sub-detail">　└ 【${spec.sub2}】 ${s2}点 / 50点</div>`;
  } else {
    term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;
  }

  term.scrollTop = term.scrollHeight;

  if (step >= maxSteps) {
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
  const isSubExam = battleState.examType === 'private_sub';
  const isKouki = battleState.examType === 'kouki';

  if (isKyotsu) {
    state.kyotsuScore = battleState.score;
    state.kyotsuRate = Math.round((battleState.score / 1000) * 100);

    // 第1志望の共通テストリサーチ判定
    const target = state.targetUniv || UNIV_LIST[0];
    let targetBorderRate = 70;
    if (target.border >= 75) targetBorderRate = 88;
    else if (target.border >= 70) targetBorderRate = 83;
    else if (target.border >= 65) targetBorderRate = 78;
    else if (target.border >= 60) targetBorderRate = 73;
    else if (target.border >= 55) targetBorderRate = 67;
    else targetBorderRate = 60;

    const diff = state.kyotsuRate - targetBorderRate;
    let researchRank = 'C';
    let researchDesc = '合格可能性 40%〜60%（五分五分）';
    if (diff >= 5) { researchRank = 'A'; researchDesc = '合格可能性 80%以上（安全圏）'; }
    else if (diff >= 2) { researchRank = 'B'; researchDesc = '合格可能性 60%〜80%（良好）'; }
    else if (diff >= -2) { researchRank = 'C'; researchDesc = '合格可能性 40%〜60%（ボーダーライン）'; }
    else if (diff >= -6) { researchRank = 'D'; researchDesc = '合格可能性 20%〜40%（要二次逆転）'; }
    else { researchRank = 'E'; researchDesc = '合格可能性 20%以下（大逆転が必要）'; }
    state.kyotsuResearchRank = researchRank;

    // 併願校の「共通テスト利用入試」判定
    let subKyotsuMsg = '';
    if (state.subUniv) {
      let subBorderRate = 68;
      if (state.subUniv.border >= 65) subBorderRate = 86;
      else if (state.subUniv.border >= 58) subBorderRate = 78;
      else subBorderRate = 68;

      const passed = state.kyotsuRate >= subBorderRate;
      state.subUnivKyotsuPass = passed;
      if (passed) {
        state.subUnivPassed = true;
        subKyotsuMsg = `💮【共テ利用 合格！】${state.subUniv.name} のボーダー（${subBorderRate}%）を突破し合格確定！2月の私大個別試験は免除されます！`;
      } else {
        subKyotsuMsg = `⚠️【共テ利用 不合格】${state.subUniv.name} のボーダー（${subBorderRate}%）に及ばず。2月2週の個別入試で合格を狙おう！`;
      }
    } else {
      subKyotsuMsg = '📑 私大併願校の出願なし（第1志望一本勝負）';
    }

    const summaryRewards = [
      `共通テスト得点: ${state.kyotsuScore}点 / 1000点（得点率: ${state.kyotsuRate}%）`,
      `第1志望【${target.name}】共テリサーチ判定: 【 ${researchRank}判定 】（${researchDesc}）`,
      subKyotsuMsg
    ];

    showEventModal(
      '📝 共通テスト終了！自己採点＆共テ利用結果',
      `2日間の共通テスト（新課程1000点満点）を戦い抜いた！\n獲得得点: 【 ${battleState.score} / 1000 点 】(得点率: ${state.kyotsuRate}%)\n\n大手予備校の共通テストリサーチ結果と併願校の合否が判明した！`,
      summaryRewards,
      state.subUnivKyotsuPass ? '🎉' : '🎯',
      () => advanceTurn()
    );

    setDialog('担任の先生', `自己採点結果が出たぞ！${state.subUnivKyotsuPass ? '併願校を1つ確保できたのは大きいぞ！' : ''}第1志望は【${researchRank}判定】だ。2月の本番へ向けて全力で仕上げよう！`);

  } else if (isSubExam) {
    // 2月私大個別日程入試の結果
    const targetSub = state.subUniv;
    let baseDev = calcTargetDev(targetSub);
    const scoreBonus = parseFloat(((battleState.score - 180) / 20).toFixed(1));
    let finalSubDev = parseFloat((baseDev + scoreBonus).toFixed(1));
    const passed = finalSubDev >= (targetSub.border - 1.0);
    state.subUnivPassed = passed;

    if (passed) {
      playSound('success');
      triggerParticles(null, null, 25, 'gold');
      showEventModal(
        `🌸 【${targetSub.name}】 個別入試 合格発表！`,
        `私大個別日程の合格発表掲示板に、自分の番号があった！\n【${targetSub.name}】（ボーダー偏差値 ${targetSub.border}）に見事正規合格！！\n\n獲得得点: 【 ${battleState.score} / 300 点 】\nこれで浪人は回避し、進学先をがっちり確保した！\n肩の荷が下り、月末の第1志望二次試験に恐れず立ち向かえる！`,
        [
          `合否結果: 【 合格 】`,
          `試験得点: ${battleState.score}点 / 300点`,
          `算出偏差値: ${finalSubDev} (ボーダー: ${targetSub.border})`,
          `心の余裕により ストレス -20 ＆ やる気UP！`
        ],
        '💮',
        () => advanceTurn()
      );
      state.stress = Math.max(0, state.stress - 20);
      state.motivation = Math.min(4, state.motivation + 1);
    } else {
      playSound('fail');
      triggerScreenShake();
      showEventModal(
        `🍂 【${targetSub.name}】 個別入試 合格発表`,
        `残念ながら【${targetSub.name}】（ボーダー偏差値 ${targetSub.border}）の合格者一覧に番号はなかった……。\n\n獲得得点: 【 ${battleState.score} / 300 点 】\n私大個別日程の狭き門に弾かれてしまったが、君の高校生活の集大成はここではない！\n月末の第1志望・二次試験本番で必ず雪辱を果たせ！`,
        [
          `合否結果: 【 不合格 】`,
          `試験得点: ${battleState.score}点 / 300点`,
          `算出偏差値: ${finalSubDev} (ボーダー: ${targetSub.border})`
        ],
        '🍂',
        () => advanceTurn()
      );
    }

    setDialog(state.playerName, passed ? 'やった、受かった！これで思い切り第1志望に突撃できる！' : 'くそっ、落ちたか…！でも本命はこれからだ、絶対に受かってやる！');

  } else if (isKouki) {
    // 3月2週 国公立後期日程の結果
    const koukiUniv = state.kokuritsuKouki;
    let baseDev = calcTargetDev(koukiUniv);
    const scoreBonus = parseFloat(((battleState.score - 180) / 20).toFixed(1));
    let finalKoukiDev = parseFloat((baseDev + scoreBonus).toFixed(1));
    const passed = finalKoukiDev >= (koukiUniv.border - 1.0);
    state.kokuritsuKoukiPassed = passed;

    if (passed) {
      playSound('fanfare');
      triggerParticles(null, null, 35, 'gold');
      showEventModal(
        `🌸 【${koukiUniv.name}】 後期日程 奇跡の逆転合格！！ 🌸`,
        `掲示板の番号を見た瞬間、膝から崩れ落ちて号泣した！\n超高倍率の国公立後期日程【${koukiUniv.name}】（ボーダー偏差値 ${koukiUniv.border}）を見事に突破！\n\n獲得得点: 【 ${battleState.score} / 300 点 】\n前期不合格のどん底から不屈の闘志で奇跡の逆転合格を掴み取った！`,
        [
          `後期合否: 【 合格 💮 】`,
          `獲得得点: ${battleState.score}点 / 300点`,
          `算出偏差値: ${finalKoukiDev} (ボーダー: ${koukiUniv.border})`,
          '不屈の精神により 栄光の国公立進学決定！'
        ],
        '🎓',
        () => triggerGameEnd()
      );
    } else {
      playSound('fail');
      triggerScreenShake();
      showEventModal(
        `🍂 【${koukiUniv.name}】 後期日程 不合格……`,
        `全力を尽くして解答用紙を埋めたが、超高倍率の後期日程の壁は破れなかった……。\n\n獲得得点: 【 ${battleState.score} / 300 点 】\nだが、最後の1秒まで逃げずに戦い抜いた君の勇姿は、何者にも代えがたい宝物だ！`,
        [
          `後期合否: 【 不合格 ❌ 】`,
          `獲得得点: ${battleState.score}点 / 300点`,
          `算出偏差値: ${finalKoukiDev} (ボーダー: ${koukiUniv.border})`
        ],
        '🍂',
        () => triggerGameEnd()
      );
    }

    setDialog(state.playerName, passed ? 'やった…！後期で受かった…！奇跡を起こしたんだ…！' : 'やり切った……。悔いはない、すべてを出し切ったんだ。');

  } else {
    // 2月4週 国公立前期 / 第1志望本番
    showEventModal(
      '🎓 前期日程・本命入試 終了！！',
      `高校3年間のすべてをぶつけた二次試験・第1志望入試が終了した！\nすべての解答用紙を提出し終え、静かな開放感と緊張が胸を満たす。\n\n来週3月1週の運命の合格発表を待とう……！`,
      [`試験得点: ${battleState.score}点 / 500点`],
      '🌸',
      () => advanceTurn()
    );
    setDialog(state.playerName, 'やれるだけのことは全部やった…！あとは合格発表を待つのみだ！');
  }

  renderUI();
}

// クリアデータをOB名簿として保存（次周回で先輩として登場）
function saveClearOB(univName) {
  try {
    const keys = ['eng', 'math', 'jp', 'sci'];
    let bestSubject = keys[0];
    keys.forEach(k => {
      if (state.subjects[k].score > state.subjects[bestSubject].score) bestSubject = k;
    });
    const ob = {
      name: state.playerName,
      univ: univName,
      year: new Date().getFullYear(),
      traitsCount: state.traits.length,
      bestSubject,
      bestSubjectName: getSubjectDisplayName(bestSubject),
      bestScore: state.subjects[bestSubject].score
    };
    localStorage.setItem('juken_success_ob', JSON.stringify(ob));
  } catch (e) {
    console.error('Failed to save OB data:', e);
  }
}

function triggerGameEnd() {
  if (state.gameOver) {
    showGameOverAgain();
    return;
  }
  // 合格した大学リストを収集
  const passedList = [];
  if (state.firstChoicePassed && state.targetUniv) passedList.push(state.targetUniv);
  if (state.kokuritsuKoukiPassed && state.kokuritsuKouki) passedList.push(state.kokuritsuKouki);
  if (state.subUnivPassed && state.subUniv) passedList.push(state.subUniv);

  // 重複除去
  const uniquePassed = [];
  const ids = new Set();
  passedList.forEach(u => {
    if (!ids.has(u.id)) {
      ids.add(u.id);
      uniquePassed.push(u);
    }
  });

  if (uniquePassed.length > 1) {
    // 複数合格！進学先選択画面
    const options = uniquePassed.map(u => ({
      title: `🎓 【${u.name}】 に進学する！`,
      subtext: `区分: ${u.type}・${u.course} | ボーダー偏差値: ${u.border}`,
      action: () => finalizeEnrollment(u, uniquePassed)
    }));

    playSound('fanfare');
    showChoiceModal(
      '🎓 歓喜の進路決定！進学先大学を選択しよう！',
      `おめでとうございます！君の努力が実を結び、複数の大学から合格通知を勝ち取りました！\nこれから4年間を過ごす運命のキャンパスを選択してください！`,
      options,
      '🌸'
    );
    return;
  }

  // 1校のみ、または0校（浪人）
  const singleUniv = uniquePassed.length === 1 ? uniquePassed[0] : null;
  finalizeEnrollment(singleUniv, uniquePassed);
}

function finalizeEnrollment(enrolledUniv, allPassed) {
  let avgAcademic = (state.subjects.eng.score + state.subjects.math.score + state.subjects.jp.score + state.subjects.sci.score) / 4;
  let finalBonus = 0;
  if (state.traits.includes('miracle_pass')) finalBonus += 4.5;
  if (state.traits.includes('math_spark')) finalBonus += 3.0;
  if (state.traits.includes('humanities_spark')) finalBonus += 3.0;
  if (state.traits.includes('strong_exam')) finalBonus += 2.0;
  if (state.traits.includes('weak_exam')) finalBonus -= 2.0;

  const target = state.targetUniv || UNIV_LIST[0];
  let finalDev = calcTargetDev(target, finalBonus);

  let title = '';
  let desc = '';
  let isWin = enrolledUniv !== null;

  if (enrolledUniv) {
    state.finalEnrolledUniv = enrolledUniv;
    saveClearOB(enrolledUniv.name);

    if (enrolledUniv.id === target.id) {
      title = `🌸 祝！【${enrolledUniv.name}】 現役合格！！ 🌸`;
      desc = `高校3年間のすべての努力が最高の結果となって結実した！\n難関【${enrolledUniv.name}】（ボーダー偏差値 ${enrolledUniv.border}）へ堂々進学決定！\n輝かしい未来のキャンパスライフが幕を開ける！`;
    } else {
      title = `🌸 【${enrolledUniv.name}】 進学決定！！ 🌸`;
      desc = `熾烈を極めた受験戦争を戦い抜き、実力で勝ち取った【${enrolledUniv.name}】（ボーダー偏差値 ${enrolledUniv.border}）への進学が決定！\n大学で何を学び、どう成長するかは自分次第だ。胸を張って新しいスタートを切ろう！`;
    }
  } else {
    title = '🍂 届かなかった春……浪人決定 🍂';
    desc = `全力を尽くして挑んだ受験戦線だったが、無情にも合格通知は届かなかった……。\nだが高校3年間積み重ねた努力は決して消え去りはしない。\n「来年こそは必ず憧れのキャンパスをくぐる！」\n悔し涙を拭い、予備校の門を叩いて新たな一年が始まる！`;
  }

  if (isWin) {
    playSound('fanfare');
    triggerParticles(null, null, 40, 'confetti');
    triggerScreenBounce();
  } else {
    playSound('fail');
    triggerScreenShake();
  }

  const modalFooter = document.getElementById('event-modal-footer');
  modalFooter.innerHTML = `
    <button class="btn-confirm" onclick="returnToTitle()">タイトル画面に戻る</button>
  `;

  const subStatusText = state.subUniv ? `${state.subUniv.name} (${state.subUnivPassed ? '合格 💮' : '不合格 ❌'})` : 'なし';
  const koukiStatusText = state.kokuritsuKouki ? `${state.kokuritsuKouki.name} (${state.kokuritsuKoukiPassed ? '合格 💮' : '不合格 ❌'})` : '出願なし';

  // ゲーム終了フラグ（以降はターン進行・行動を一切受け付けない）
  state.gameOver = true;
  modalQueue.length = 0;
  isModalShowing = false;
  currentModalCallback = null;

  const endText = `${desc}\n\n【最終戦績サマリー】\n受験生: ${state.playerName}\n最終進学先: ${enrolledUniv ? enrolledUniv.name : '浪人決定'}\n第1志望(前期): ${target.name} (${state.firstChoicePassed ? '合格 💮' : '不合格 ❌'})\n国公立後期: ${koukiStatusText}\n併願私大: ${subStatusText}\n共通テスト得点: ${state.kyotsuScore > 0 ? `${state.kyotsuScore}点 (${state.kyotsuRate}%)` : '受験免除'}\n総合学力: ${Math.round(avgAcademic)} (${getRank(avgAcademic).rank}ランク)\n本番傾斜偏差値: ${finalDev}\n習得特能数: ${state.traits.length}個\nあおい好感度: ${state.friends.aoi.affection}%`;
  const endRewards = [
    isWin ? '★ クリアデータをOB名簿に保存しました！次周回で先輩として登場します！' : 'タイトル画面からもう一度挑戦できます！'
  ];
  state.endingData = { title, text: endText, rewards: endRewards, icon: isWin ? '🎓' : '📚' };

  // 終了後にリロードして続きから再開されないようセーブを消去
  clearSavedGame();

  showEventModal(title, endText, endRewards, isWin ? '🎓' : '📚');

  setDialog('担任の先生', `3年間の高校生活、本当によく頑張ったな！君のこれからの人生に大いなる幸あれ！`);
}

// 終了後に何らかの操作が行われた場合、エンディング画面を再表示する
function showGameOverAgain() {
  const d = state.endingData;
  if (d) {
    showEventModal(d.title, d.text, d.rewards, d.icon);
  } else {
    showEventModal('🎓 高校生活終了', '高校3年間の受験生活は終了しました。タイトル画面から新しい代を始めよう！', [], '🎓');
  }
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
  if (state && state.gameOver) {
    // ゲーム終了後はタイトルへ戻るボタンのみ（OKで閉じて続行できないようにする）
    modalFooter.innerHTML = `<button class="btn-confirm" onclick="returnToTitle()">タイトル画面に戻る</button>`;
  } else {
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
  updateMuteUI();
  updateSettingsUI();
  checkAutoResumeOnLoad();

  // 全ボタン・対話要素への心地よいホバー効果音自動登録
  document.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('button, .tab-btn, .choice-btn, .study-card-btn, .btn-confirm, .btn-close');
    if (btn) {
      playHoverSound();
    }
  });
});
