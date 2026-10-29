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
  isBgmMuted: false,
  bgmVolume: 0.5,
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

let settings = window.gameSettings = loadSettings();
let isMuted = settings.isMuted;
const audioCtx = window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
  BGM.updateVolume();
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


// ========================================================
// Web Audio API BGM 音響シンセサイザーエンジン（外部音源不要）
// ========================================================
const BGM = window.BGM = (() => {
  let masterGain = null;
  let currentTrackName = null;
  let pendingTrack = null;
  let isPlaying = false;
  let timerId = null;
  let currentStep = 0;
  let nextNoteTime = 0;

  const NOTE_FREQ = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50
  };

  function initNodes() {
    if (!masterGain && audioCtx) {
      try {
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
        updateVolume();
      } catch (e) {
        console.warn('initNodes failed:', e);
      }
    }
  }

  function updateVolume() {
    if (!masterGain || !audioCtx) return;
    try {
      const isMute = settings.isMuted || settings.isBgmMuted;
      const vol = isMute ? 0 : (settings.bgmVolume !== undefined ? settings.bgmVolume : 0.5);
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.linearRampToValueAtTime(vol * 0.28, now + 0.08);
    } catch (e) {}
  }

  const SEMITONES = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  function getNoteFreq(note) {
    if (!note) return 0;
    const match = note.match(/^([A-G][#b]?)([0-9])$/);
    if (!match) return 440;
    const name = match[1];
    const octave = parseInt(match[2], 10);
    const semitone = SEMITONES[name] !== undefined ? SEMITONES[name] : 0;
    const noteIndex = octave * 12 + semitone;
    return 440 * Math.pow(2, (noteIndex - 57) / 12);
  }

  function playSynth(freq, time, dur, type = 'triangle', vol = 0.22, filterFreq = 1600) {
    if (!freq || freq <= 0 || !masterGain || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(vol * 0.5, time + Math.min(0.12, dur * 0.5));
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(masterGain);

      osc.start(time);
      osc.stop(time + dur);
    } catch (e) {}
  }

  function playKick(time, vol = 0.25) {
    if (!masterGain || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(time);
      osc.stop(time + 0.1);
    } catch (e) {}
  }

  function playSnare(time, vol = 0.12) {
    if (!masterGain || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.07);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(time);
      osc.stop(time + 0.07);
    } catch (e) {}
  }

  const TRACKS = {
    title: {
      tempo: 114,
      steps: 32,
      bass: [
        'F3',null,'F3',null,'G3',null,'G3',null,'E3',null,'E3',null,'A3',null,'A3',null,
        'F3',null,'F3',null,'G3',null,'G3',null,'C4',null,'C4',null,'C4',null,null,null
      ],
      chords: [
        'A3','C4','E4',null,'B3','D4','G4',null,'G3','B3','E4',null,'C4','E4','A4',null,
        'A3','C4','F4',null,'B3','D4','G4',null,'C4','E4','G4',null,'C4','E4',null,null
      ],
      melody: [
        'C5',null,'D5','E5','G5',null,'E5',null,'D5',null,'C5',null,'A4',null,'C5',null,
        'D5',null,'E5','F5','E5',null,'D5',null,'C5',null,null,null,null,null,null,null
      ]
    },
    daily: {
      tempo: 82,
      steps: 32,
      bass: [
        'F3',null,'F3',null,'G3',null,'G3',null,'E3',null,'E3',null,'A3',null,'A3',null,
        'D3',null,'D3',null,'G3',null,'G3',null,'C3',null,'C3',null,'C3',null,null,null
      ],
      chords: [
        'A3','C4','E4',null,'B3','D4','F4',null,'G3','B3','D4',null,'C4','E4','G4',null,
        'F3','A3','C4',null,'B3','D4','F4',null,'E3','G3','C4',null,'E3','G3',null,null
      ],
      melody: [
        'E5',null,null,'G5','A5',null,'G5',null,'D5',null,'E5','F5','E5',null,null,null,
        'F5',null,'E5',null,'D5',null,'B4',null,'C5',null,null,null,null,null,null,null
      ]
    },
    exam: {
      tempo: 132,
      steps: 64,
      hasDrums: true,
      bass: [
        'A3','A3','C4','A3','F3','F3','A3','F3','G3','G3','B3','G3','E3','E3','G3','E3',
        'F3','F3','A3','F3','D3','D3','F3','D3','E3','E3','G#3','E3','E3','E3','B3','E3',
        'A3','A3','C4','A3','F3','F3','A3','F3','G3','G3','B3','G3','E3','E3','G3','E3',
        'F3','F3','A3','F3','G3','G3','B3','G3','A3','A3','E3','A3','A3',null,null,null
      ],
      chords: [
        'E4',null,'A4',null,'C4',null,'F4',null,'D4',null,'G4',null,'B3',null,'E4',null,
        'C4',null,'F4',null,'A3',null,'D4',null,'B3',null,'E4',null,'G#4',null,'B4',null,
        'E4',null,'A4',null,'C4',null,'F4',null,'D4',null,'G4',null,'B3',null,'E4',null,
        'C4',null,'F4',null,'D4',null,'G4',null,'C4',null,'E4',null,'A4',null,null,null
      ],
      melody: [
        'A5',null,'E5',null,'C5','D5','E5',null,'F5',null,'D5',null,'B4','C5','D5',null,
        'C5',null,'A4',null,'D5',null,'B4',null,'B4',null,'G#4',null,'E4',null,null,null,
        'A5',null,'B5',null,'C6',null,'B5',null,'G5',null,'A5',null,'E5',null,null,null,
        'F5','E5','D5','C5','D5','E5','F5','G5','A5',null,null,null,null,null,null,null
      ]
    }
  };

  function scheduleStep(track, step, time) {
    const stepDur = (60 / track.tempo) / 2;

    if (track.hasDrums) {
      if (step % 4 === 0) playKick(time, 0.22);
      if (step % 4 === 2) playSnare(time, 0.12);
    }

    if (track.bass && track.bass[step]) {
      const freq = getNoteFreq(track.bass[step]);
      playSynth(freq, time, stepDur * 0.95, 'triangle', 0.24, 600);
    }

    if (track.chords && track.chords[step]) {
      const freq = getNoteFreq(track.chords[step]);
      playSynth(freq, time, stepDur * 1.5, 'sine', 0.16, 1200);
    }

    if (track.melody && track.melody[step]) {
      const freq = getNoteFreq(track.melody[step]);
      playSynth(freq, time, stepDur * 1.2, 'triangle', 0.26, 1800);
    }
  }

  function tick() {
    if (!isPlaying || !currentTrackName || !audioCtx) return;
    // iOS / Android: suspended またはアンロック前の状態では絶対にスケジュールを進めない
    if (audioCtx.state !== 'running') return;

    const track = TRACKS[currentTrackName];
    if (!track) return;

    // 時間ズレ（スリープ復帰・バックグラウンド復帰時）のオシレーター同時発火を防ぐ
    if (nextNoteTime < audioCtx.currentTime) {
      nextNoteTime = audioCtx.currentTime + 0.05;
    }

    const stepDur = (60 / track.tempo) / 2;
    let scheduledCount = 0;
    while (nextNoteTime < audioCtx.currentTime + 0.25 && scheduledCount < 4) {
      scheduleStep(track, currentStep, nextNoteTime);
      nextNoteTime += stepDur;
      currentStep = (currentStep + 1) % track.steps;
      scheduledCount++;
    }
  }

  function play(trackName) {
    pendingTrack = trackName;
    initNodes();

    // オーディオコンテキストがまだ走っていない場合はアンロック待ち
    if (!audioCtx || audioCtx.state !== 'running') {
      return;
    }

    if (currentTrackName === trackName && isPlaying) return;

    currentTrackName = trackName;
    currentStep = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;

    if (!isPlaying) {
      isPlaying = true;
      if (timerId) clearInterval(timerId);
      timerId = setInterval(tick, 45);
    }
    updateVolume();
  }

  function onAudioUnlocked() {
    initNodes();
    updateVolume();
    if (pendingTrack) {
      play(pendingTrack);
    } else if (!isPlaying) {
      const isTitle = document.getElementById('title-screen') && document.getElementById('title-screen').style.display !== 'none';
      play(isTitle ? 'title' : 'daily');
    }
  }

  function stop() {
    if (!isPlaying) return;
    isPlaying = false;
    currentTrackName = null;
    pendingTrack = null;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  return {
    play,
    stop,
    updateVolume,
    onAudioUnlocked,
    getCurrentTrack: () => currentTrackName || pendingTrack,
    get currentTrack() { return currentTrackName || pendingTrack; },
    get isPlaying() { return isPlaying; },
    get ctx() { return audioCtx; },
    get masterGain() { return masterGain; }
  };
})();

function playSound(type) {
  if (isMuted || settings.seVolume <= 0) return;
  if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
    unlockAudio();
  }
  const vol = settings.seVolume;
  try {
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
    } else if (type === 'trophy') {
      // 実績解除・トロフィー獲得音（煌びやかな高音クリスタル・アルペジオ）
      const notes = [587.33, 739.99, 880.00, 1174.66, 1479.98];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        const t = now + idx * 0.065;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.22 * vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
      });
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
    confetti: ['🌸', '', '🎊', '✨']
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


// ========================================================
// 購買部・本屋 ＆ 所持品（アイテム）システム
// ========================================================
let curShopTab = 'buy';
let curShopCategory = 'all';

const ITEM_DATABASE = {
  // --- 参考書・問題集（永続パッシブ / 各教科経験値 +15%） ---
  book_eng: {
    id: 'book_eng',
    name: '『システム英単語』',
    icon: '📘',
    type: 'book',
    price: 2800,
    desc: '基礎から難関大レベルの必須英単語を網羅。英語の勉強経験値 +15%！',
    passiveText: '英語勉強経験値 +15%',
    effectTags: [
      { text: '英語経験値 +15%', type: 'exp' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  book_math: {
    id: 'book_math',
    name: '『青チャート数学』',
    icon: '📐',
    type: 'book',
    price: 3600,
    desc: '網羅系問題集の王道。難関大数学の土台を築く。数学の勉強経験値 +15%！',
    passiveText: '数学勉強経験値 +15%',
    effectTags: [
      { text: '数学経験値 +15%', type: 'exp' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  book_jp: {
    id: 'book_jp',
    name: '『現代文読解の開発講座』',
    icon: '📜',
    type: 'book',
    price: 2600,
    desc: '論理的読解力を養い、記述の土台を作る。国語の勉強経験値 +15%！',
    passiveText: '国語勉強経験値 +15%',
    effectTags: [
      { text: '国語経験値 +15%', type: 'exp' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  book_sci: {
    id: 'book_sci',
    name: '『理科・社会 集中講義』',
    icon: '🔬',
    type: 'book',
    price: 3200,
    reqYear: 2,
    desc: '高2以降の重要事項を凝縮した講義書。理社（専門科目）の勉強経験値 +15%！',
    passiveText: '理社勉強経験値 +15%',
    effectTags: [
      { text: '理社経験値 +15%', type: 'exp' },
      { text: '高2以降解放', type: 'mot' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  book_past: {
    id: 'book_past',
    name: '『志望校の赤本（過去問）』',
    icon: '📕',
    type: 'book',
    price: 4500,
    reqYear: 3,
    desc: '志望校の徹底研究。二次試験バトルでの獲得得点 +5%！',
    passiveText: '二次試験得点 +5%',
    effectTags: [
      { text: '二次試験得点 +5%', type: 'exp' },
      { text: '高3限定', type: 'mot' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },

  // --- 文房具・勉強ギア（永続パッシブ） ---
  gear_earplugs: {
    id: 'gear_earplugs',
    name: '耳栓',
    icon: '🎧',
    type: 'gear',
    price: 3000,
    desc: '周囲の雑音を遮断して全集中。勉強コマンド実行時のストレス増加量を 15% 軽減！',
    passiveText: '勉強ストレス 15%カット',
    effectTags: [
      { text: '勉強ストレス 15%軽減', type: 'heal' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  gear_pencil: {
    id: 'gear_pencil',
    name: 'マーク専用鉛筆',
    icon: '✏️',
    type: 'gear',
    price: 1500,
    desc: '濃く滑らかなマーク専用鉛筆。共通試験やマーク模試でのケアレスミス率を低減！',
    passiveText: 'マークミス低減',
    effectTags: [
      { text: 'マークミス大幅低減', type: 'exp' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  gear_timer: {
    id: 'gear_timer',
    name: '学習タイマー',
    icon: '⏱️',
    type: 'gear',
    price: 2400,
    desc: '時間を意識して机に向かう。勉強失敗時のやる気ダウンを完全に防止！',
    passiveText: '勉強失敗時のやる気低下防止',
    effectTags: [
      { text: 'やる気低下完全防止', type: 'mot' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },
  gear_cushion: {
    id: 'gear_cushion',
    name: '低反発クッション',
    icon: '🪑',
    type: 'gear',
    price: 2500,
    desc: '長時間の学習でも疲れにくい。勉強コマンド実行時の体力消費を 2pt 軽減！',
    passiveText: '勉強体力消費 -2pt',
    effectTags: [
      { text: '勉強体力消費 -2pt', type: 'heal' },
      { text: '永続パッシブ', type: 'heal' }
    ]
  },

  // --- 軽食・リフレッシュ（消費アイテム / 1週1回まで使用可） ---
  snack_choco: {
    id: 'snack_choco',
    name: 'ブドウ糖チョコ',
    icon: '🍫',
    type: 'consumable',
    price: 1000,
    desc: '脳の栄養補給。使うと即座に【やる気 +1】＆【ストレス -5%】！（※1週1回まで使用可）',
    passiveText: 'やる気+1 / ストレス-5%',
    effectTags: [
      { text: 'やる気 +1 ⤴', type: 'mot' },
      { text: 'ストレス -5%', type: 'heal' },
      { text: '1週1回使用', type: '' }
    ],
    use: (s) => {
      if (s.motivation < 4) s.motivation++;
      s.stress = Math.max(0, s.stress - 5);
      return '脳に糖分補給！やる気が1段階アップし、ストレスが少し回復した！';
    }
  },
  snack_energy: {
    id: 'snack_energy',
    name: '超集中エナジードリンク',
    icon: '⚡',
    type: 'consumable',
    price: 1500,
    desc: '気合いのドーピング飲料。使うと即座に【体力 +30 回復】（※反動でストレス+5%）！',
    passiveText: '体力+30 / ストレス+5%',
    effectTags: [
      { text: '体力 +30 回復', type: 'heal' },
      { text: 'ストレス +5%', type: 'cost' },
      { text: '1週1回使用', type: '' }
    ],
    use: (s) => {
      s.stamina = Math.min(100, s.stamina + 30);
      s.stress = Math.min(100, s.stress + 5);
      return 'グッと飲み干して覚醒！体力が30回復したが、カフェインの反動でストレスが5%増えた。';
    }
  },
  snack_coffee: {
    id: 'snack_coffee',
    name: 'カフェのドリップコーヒー',
    icon: '☕',
    type: 'consumable',
    price: 1200,
    desc: '芳醇な香りの本格コーヒー。使うと即座に【ストレス -20% 解消】！',
    passiveText: 'ストレス -20%',
    effectTags: [
      { text: 'ストレス -20% 解消', type: 'heal' },
      { text: '1週1回使用', type: '' }
    ],
    use: (s) => {
      s.stress = Math.max(0, s.stress - 20);
      return 'ホッと一息。深い香りに包まれてストレスが20%解消した！';
    }
  },
  snack_eyemask: {
    id: 'snack_eyemask',
    name: '蒸気ホットアイマスク',
    icon: '♨️',
    type: 'consumable',
    price: 1300,
    desc: '酷使した目を優しく温める。使うと【体力 +20 回復】＆【ストレス -12% 解消】！',
    passiveText: '体力+20 / ストレス-12%',
    effectTags: [
      { text: '体力 +20 回復', type: 'heal' },
      { text: 'ストレス -12%', type: 'heal' },
      { text: '1週1回使用', type: '' }
    ],
    use: (s) => {
      s.stamina = Math.min(100, s.stamina + 20);
      s.stress = Math.max(0, s.stress - 12);
      return '心地よい温かさに癒やされた...！体力が20回復、ストレスが12%解消！';
    }
  },

  // --- 本番・勝負アイテム ---
  exam_omamori: {
    id: 'exam_omamori',
    name: '太宰府の合格祈願お守り',
    icon: '⛩️',
    type: 'exam',
    price: 2200,
    desc: '学問の神様のご加護。共通試験・二次試験本番で各大問得点ボーナス！',
    passiveText: '本番各大問得点ボーナス',
    effectTags: [
      { text: '本番得点ボーナス', type: 'exp' },
      { text: '神頼み', type: 'mot' },
      { text: '所持で常時発動', type: 'heal' }
    ]
  },
  exam_katsu: {
    id: 'exam_katsu',
    name: '母の手作りカツ弁当',
    icon: '🥢',
    type: 'consumable',
    price: 2400,
    desc: '「勝つ！」の験担ぎ。ここぞの場面で【やる気 +1 ＆ 体力 +25 回復】！',
    passiveText: 'やる気+1 / 体力+25',
    effectTags: [
      { text: 'やる気 +1 ⤴', type: 'mot' },
      { text: '体力 +25 回復', type: 'heal' },
      { text: '勝負アイテム', type: 'mot' }
    ],
    use: (s) => {
      if (s.motivation < 4) s.motivation++;
      s.stamina = Math.min(100, s.stamina + 25);
      return '母の温かいカツ弁当を完食！愛情が染み渡り、やる気が1段階アップして体力が25回復！';
    }
  },
  exam_medicine: {
    id: 'exam_medicine',
    name: '常備薬',
    icon: '💊',
    type: 'exam',
    price: 1200,
    desc: '持っていれば安心の常備薬。模試や試験バトルでのプレッシャーや腹痛デバフを軽減。',
    passiveText: '試験時のデバフ・失点防護',
    effectTags: [
      { text: '試験デバフ防護', type: 'heal' },
      { text: '腹痛・緊張ケア', type: 'heal' },
      { text: '所持で常時発動', type: 'heal' }
    ]
  }
};

function hasItem(itemId) {
  if (!state || !state.inventory) return false;
  return (state.inventory[itemId] || 0) > 0;
}

function getItemCount(itemId) {
  if (!state || !state.inventory) return 0;
  return state.inventory[itemId] || 0;
}

function addItem(itemId, count = 1) {
  if (!state.inventory) state.inventory = {};
  state.inventory[itemId] = (state.inventory[itemId] || 0) + count;
}

function consumeItem(itemId) {
  if (!hasItem(itemId)) return false;
  state.inventory[itemId]--;
  if (state.inventory[itemId] <= 0) {
    delete state.inventory[itemId];
  }
  return true;
}

function openShopModal(defaultTab = 'buy') {
  playSound('click');
  curShopTab = defaultTab;
  switchShopTab(curShopTab);
  document.getElementById('shop-modal').classList.add('active');
}

function closeShopModal() {
  playSound('click');
  document.getElementById('shop-modal').classList.remove('active');
  renderUI();
}

function switchShopTab(tab) {
  playSound('click');
  curShopTab = tab;
  document.getElementById('shop-tab-buy').classList.toggle('active', tab === 'buy');
  document.getElementById('shop-tab-bag').classList.toggle('active', tab === 'bag');

  const buyView = document.getElementById('shop-view-buy');
  const bagView = document.getElementById('shop-view-bag');

  if (tab === 'buy') {
    buyView.classList.remove('hidden');
    buyView.style.display = 'flex';
    bagView.classList.add('hidden');
    bagView.style.display = 'none';
  } else {
    buyView.classList.add('hidden');
    buyView.style.display = 'none';
    bagView.classList.remove('hidden');
    bagView.style.display = 'flex';
  }

  renderShopUI();
}

function filterShopCategory(cat) {
  playSound('click');
  curShopCategory = cat;
  const filterBtns = document.querySelectorAll('.shop-filter-btn');
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.id === `filter-btn-${cat}`);
  });
  renderShopUI();
}

function renderShopUI() {
  const moneyBar = document.querySelector('.shop-money-bar');
  if (moneyBar) {
    if (curShopTab === 'buy') {
      moneyBar.innerHTML = `<span>現在の所持金: <b id="shop-current-money" style="color: #16a34a; font-size: 1.05rem;">¥${(state.money || 0).toLocaleString()}</b></span>`;
    } else {
      const ownedCount = Object.keys(state.inventory || {}).filter(k => (state.inventory[k] || 0) > 0).length;
      const usedText = (state.itemsUsedThisTurn || 0) >= 1 ? '<span style="color:#ef4444; font-weight:800;">今週使用済(1/1)</span>' : '<span style="color:#16a34a; font-weight:800;">今週使用可(0/1)</span>';
      moneyBar.innerHTML = `
        <span>🎒 <b>所持</b>: <b style="color:#2563eb;">${ownedCount}種</b> / 軽食: ${usedText}</span>
        <span style="font-size: 0.8rem; color: #166534; font-weight:700;">💰 ¥${(state.money || 0).toLocaleString()}</span>
      `;
    }
  }

  if (curShopTab === 'buy') {
    renderShopBuyList();
  } else {
    renderShopBagList();
  }
}

function renderShopBuyList() {
  const container = document.getElementById('shop-items-list');
  if (!container) return;
  container.innerHTML = '';

  const items = Object.values(ITEM_DATABASE).filter(item => {
    if (item.reqYear && state.year < item.reqYear) return false;
    if (curShopCategory !== 'all' && item.type !== curShopCategory) return false;
    return true;
  });

  items.forEach(item => {
    const isOwned = item.type !== 'consumable' && hasItem(item.id);
    const count = getItemCount(item.id);
    const canAfford = (state.money || 0) >= item.price;

    const card = document.createElement('div');
    card.className = `shop-item-card ${isOwned ? 'owned-card' : ''}`;

    let actionBtnHtml = '';
    if (isOwned) {
      actionBtnHtml = `<span class="owned-badge">✔ 購入済み</span>`;
    } else {
      actionBtnHtml = `
        <button class="btn-buy-item" ${!canAfford ? 'disabled' : ''} onclick="buyShopItem('${item.id}')">
          購入 (¥${item.price.toLocaleString()})
        </button>
      `;
    }

    let badgeHtml = '';
    if (item.type === 'book') badgeHtml = `<span class="item-badge" style="background:#e0f2fe; color:#0284c7;">参考書</span>`;
    else if (item.type === 'gear') badgeHtml = `<span class="item-badge" style="background:#fef3c7; color:#d97706;">勉強ギア</span>`;
    else if (item.type === 'consumable') badgeHtml = `<span class="item-badge" style="background:#dcfce7; color:#15803d;">消耗品 (所持: ${count}個)</span>`;
    else if (item.type === 'exam') badgeHtml = `<span class="item-badge" style="background:#fae8ff; color:#a21caf;">試験お守り</span>`;

    const effectTagsHtml = (item.effectTags || []).map(t => {
      const cls = t.type ? `play-tag ${t.type}` : 'play-tag';
      return `<span class="${cls}">${t.text}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-header-main">
          <div class="item-icon ${item.type}"><span class="item-type-text">${item.type.toUpperCase()}</span></div>
          <div class="item-title-info">
            <div class="item-name">${item.name}</div>
            <div class="item-badges-wrap">${badgeHtml}</div>
          </div>
        </div>
        <div class="item-action">
          ${actionBtnHtml}
        </div>
      </div>
      <div class="item-desc">${item.desc}</div>
      <div class="item-card-footer">
        <div class="play-effect-row">
          ${effectTagsHtml}
        </div>
        <div class="item-price">¥${item.price.toLocaleString()}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderShopBagList() {
  const container = document.getElementById('bag-items-list');
  if (!container) return;
  container.innerHTML = '';

  const ownedKeys = Object.keys(state.inventory || {}).filter(k => (state.inventory[k] || 0) > 0);

  if (ownedKeys.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 36px 12px; color: #64748b; font-size: 0.85rem; font-weight: 700; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #cbd5e1; margin: 8px 0;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">🎒</div>
        <div style="color: #334155; font-size: 0.95rem; font-weight: 800; margin-bottom: 4px;">マイバッグは空です</div>
        まだ何もアイテムを持っていません。<br>
        「購買」タブでお小遣いを使って参考書やグッズを購入してみましょう！
      </div>
    `;
    return;
  }

  const isUsedThisTurn = (state.itemsUsedThisTurn || 0) >= 1;

  ownedKeys.forEach(itemId => {
    const item = ITEM_DATABASE[itemId];
    if (!item) return;
    const count = getItemCount(itemId);

    const card = document.createElement('div');
    card.className = 'shop-item-card';

    let actionHtml = '';
    if (item.type === 'consumable') {
      if (isUsedThisTurn) {
        actionHtml = `
          <button class="btn-use-item" disabled style="background:#cbd5e1; color:#64748b; cursor:not-allowed;" title="軽食アイテムの使用は1週に1回までです">
            今週済
          </button>
        `;
      } else {
        actionHtml = `
          <button class="btn-use-item" onclick="useBagItem('${item.id}')">
            使う
          </button>
        `;
      }
    } else {
      actionHtml = `
        <span class="owned-badge" style="background:#e0f2fe; color:#0369a1; font-weight: 800;">
          常時発動中
        </span>
      `;
    }

    let typeBadge = '';
    if (item.type === 'book') typeBadge = `<span class="item-badge badge-book">参考書</span>`;
    else if (item.type === 'gear') typeBadge = `<span class="item-badge badge-gear">ギア</span>`;
    else if (item.type === 'consumable') typeBadge = `<span class="item-badge badge-consumable">消耗品</span>`;
    else if (item.type === 'exam') typeBadge = `<span class="item-badge badge-exam">お守り</span>`;

    const countLabel = item.type === 'consumable' ? ` <b style="color:#2563eb; font-weight:900;">×${count}個</b>` : '';

    const effectTagsHtml = (item.effectTags || []).map(t => {
      const cls = t.type ? `play-tag ${t.type}` : 'play-tag';
      return `<span class="${cls}">${t.text}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-header-main">
          <div class="item-icon ${item.type}"><span class="item-type-text">${item.type.toUpperCase()}</span></div>
          <div class="item-title-info">
            <div class="item-name">${item.name}${countLabel}</div>
            <div class="item-badges-wrap">${typeBadge}</div>
          </div>
        </div>
        <div class="item-action">
          ${actionHtml}
        </div>
      </div>
      <div class="item-desc">${item.desc}</div>
      <div class="item-card-footer">
        <div class="play-effect-row">
          ${effectTagsHtml}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function buyShopItem(itemId) {
  const item = ITEM_DATABASE[itemId];
  if (!item) return;

  const currentCount = getItemCount(itemId);

  // 永続パッシブ（参考書・ギア）は1回のみ購入可
  if (item.type !== 'consumable' && currentCount >= 1) {
    playSound('fail');
    alert('このアイテムはすでに購入済みです！');
    return;
  }

  if ((state.money || 0) < item.price) {
    playSound('fail');
    alert(`お小遣いが足りません！ (必要: ¥${item.price.toLocaleString()})`);
    return;
  }

  playSound('success');
  state.money -= item.price;
  addItem(itemId, 1);
  showFloatingText(`${item.name} を購入！`, null, null, 'item');
  triggerParticles(null, null, 15, 'gold');
  renderShopUI();
  renderUI();
}

function useBagItem(itemId) {
  const item = ITEM_DATABASE[itemId];
  if (!item || item.type !== 'consumable') return;

  // 1週1回制限チェック
  if ((state.itemsUsedThisTurn || 0) >= 1) {
    playSound('fail');
    alert('今週はすでに軽食・回復アイテムを使用しました！\n（※胃腸やカフェインの負担を考え、アイテム使用は1週に1回までです）');
    return;
  }

  if (!consumeItem(itemId)) return;

  state.itemsUsedThisTurn = (state.itemsUsedThisTurn || 0) + 1;
  playSound('success');
  triggerParticles(null, null, 20, 'gold');
  const msg = item.use ? item.use(state) : `${item.name} を使った！`;
  showFloatingText(msg, null, null, 'heal');
  setDialog(state.playerName, msg);
  renderShopUI();
  renderUI();
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
    kyotsuPeriodActive: false, // 高3 11月以降の共通試験直前対策期間フラグ
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
    money: 1500,
    itemsUsedThisTurn: 0,
    inventory: {},

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
    hadStudyFail: false,
    hadMaxStress: false,
    hadMockE: false,

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

const UNIV_LIST = window.UNIV_LIST = [
  // --- 難関国立（旧帝大・最難関） ---
  {
    id: 'todai_sci',
    name: '帝都大学 理科一類（工・理学部）',
    shortName: '帝大 理一',
    type: '国公立',
    course: '理系',
    border: 73,
    weights: { eng: 1.0, math: 1.6, jp: 0.8, sci: 1.7 },
    desc: '日本最高峰の理系。数学・理科の圧倒的論証力と総合力が必須。'
  },
  {
    id: 'todai_med',
    name: '帝都大学 理科三類（医学部）',
    shortName: '帝大 理三(医)',
    type: '国公立',
    course: '理系',
    border: 78,
    weights: { eng: 1.2, math: 1.5, jp: 1.0, sci: 1.5 },
    desc: '国内最高峰の超難関。全教科でミスが許されない極限の戦い。'
  },
  {
    id: 'todai_hum',
    name: '帝都大学 文科一類・二類（法・経済）',
    shortName: '帝大 文科(法経)',
    type: '国公立',
    course: '文系',
    border: 72,
    weights: { eng: 1.4, math: 1.0, jp: 1.4, sci: 1.2 },
    desc: '日本屈指の文系最高峰。英語・国語・社会の卓越した記述力が鍵。'
  },
  {
    id: 'kyodai_eng',
    name: '京洛大学 工学部・理学部',
    shortName: '京洛大 工・理',
    type: '国公立',
    course: '理系',
    border: 71,
    weights: { eng: 1.0, math: 1.6, jp: 0.7, sci: 1.7 },
    desc: '自由の学風。超難問数学・物理化学を突破する深い思考力が求められる。'
  },
  {
    id: 'kyodai_law',
    name: '京洛大学 法学部・経済学部',
    shortName: '京洛大 法・経',
    type: '国公立',
    course: '文系',
    border: 70,
    weights: { eng: 1.5, math: 0.8, jp: 1.5, sci: 1.2 },
    desc: '難解な長文読解と論述勝負。国語・英語の極めて高度な記述力が必要。'
  },

  // --- 最難関私大（早慶） ---
  {
    id: 'waseda_pol',
    name: '早稲谷大学 政治経済学部',
    shortName: '早稲谷 政経',
    type: '私立',
    course: '文系',
    border: 69,
    weights: { eng: 1.5, math: 0.0, jp: 1.4, sci: 1.4 },
    desc: '私大文系の最高峰。英国社3教科の超高度な読解力（数学不要）。'
  },
  {
    id: 'keio_econ',
    name: '慶明義塾大学 経済学部・法学部',
    shortName: '慶明 経・法',
    type: '私立',
    course: '文系',
    border: 68,
    weights: { eng: 1.6, math: 0.0, jp: 1.3, sci: 1.4 },
    desc: '私大屈指の名門。長文英語と社会・国語の完成度が問われる。'
  },
  {
    id: 'waseda_sci',
    name: '早稲谷大学 先進・創造理工学部',
    shortName: '早稲谷 理工',
    type: '私立',
    course: '理系',
    border: 67,
    weights: { eng: 1.0, math: 1.6, jp: 0.0, sci: 1.6 },
    desc: '私大理系トップ。数学・理科2科目の配点が高く、国語は不要。'
  },

  // --- 上位私大（MARCH・関関同立） ---
  {
    id: 'meiji_law',
    name: '明政大学 法学部・商学部',
    shortName: '明政 法・商',
    type: '私立',
    course: '文系',
    border: 62,
    weights: { eng: 1.5, math: 0.0, jp: 1.3, sci: 1.2 },
    desc: 'MARCHの筆頭人気学部。英国社3教科の安定した得点力が合格の要。'
  },
  {
    id: 'aoyama_lit',
    name: '青葉学院大学 文学部・国際政経',
    shortName: '青葉 文・国政',
    type: '私立',
    course: '文系',
    border: 61,
    weights: { eng: 1.7, math: 0.0, jp: 1.3, sci: 1.0 },
    desc: '英語の配点が非常に高い。圧倒的な英語力があれば逆転可能。'
  },
  {
    id: 'doshisha_sci',
    name: '同朋社大学 理工学部',
    shortName: '同朋社 理工',
    type: '私立',
    course: '理系',
    border: 60,
    weights: { eng: 1.0, math: 1.5, jp: 0.0, sci: 1.5 },
    desc: '関西私大理系の雄。数理重視の3教科で確実にボーダー越えを狙う。'
  },

  // --- 中堅国公立 ---
  {
    id: 'chiiki_eng',
    name: '地方拠点国立大学 工学部（加賀・吉備・武蔵等）',
    shortName: '拠点国立 工学',
    type: '国公立',
    course: '理系',
    border: 56,
    weights: { eng: 1.0, math: 1.4, jp: 0.8, sci: 1.4 },
    desc: '共通試験5教科＋2次数理。手堅く理系就職・研究を目指す王道。'
  },
  {
    id: 'chiiki_hum',
    name: '地方拠点国立大学 人文・経済学部',
    shortName: '拠点国立 文・経',
    type: '国公立',
    course: '文系',
    border: 55,
    weights: { eng: 1.2, math: 0.8, jp: 1.3, sci: 1.2 },
    desc: '共通試験で全科目安定得点し、2次記述で国英を固めて合格を掴む。'
  },

  // --- 中堅私大（日東駒専・産近甲龍） ---
  {
    id: 'nichidai_hum',
    name: '日東大学・東亜大学 文系学部',
    shortName: '日東東亜 文系',
    type: '私立',
    course: '文系',
    border: 50,
    weights: { eng: 1.3, math: 0.0, jp: 1.3, sci: 1.0 },
    desc: '基礎力が試される3教科入試。着実な基礎固めで堅実な合格を狙える。'
  },
  {
    id: 'kindai_sci',
    name: '浪速大学・東亜大学 理工学部',
    shortName: '浪速東亜 理工',
    type: '私立',
    course: '理系',
    border: 50,
    weights: { eng: 1.0, math: 1.4, jp: 0.0, sci: 1.4 },
    desc: '標準問題中心の3教科試験。数学と理科の基本を確実に解き切れば合格圏。'
  },

  // --- 国公立大学 後期日程 ---
  {
    id: 'nankan_kouki_sci',
    name: '難関国公立大学 理系後期（帝都科学大・房総大・港都大等）',
    shortName: '難関国立 後期(理)',
    type: '国公立後期',
    course: '理系',
    border: 66,
    weights: { eng: 1.0, math: 1.8, jp: 0.0, sci: 1.8 },
    desc: '募集人数が極少の狭き門。数理特化のハイレベル記述勝負！'
  },
  {
    id: 'chiiki_eng_kouki',
    name: '地方拠点国立大学 理工学部後期日程',
    shortName: '地方国立 後期(工)',
    type: '国公立後期',
    course: '理系',
    border: 58,
    weights: { eng: 0.8, math: 1.6, jp: 0.0, sci: 1.6 },
    desc: '前期不合格者の受け皿となる激戦区。数学・理科の記述で逆転を狙う。'
  },
  {
    id: 'nankan_kouki_hum',
    name: '難関国公立大学 文系後期（一ノ橋大・港都大・浜国大等）',
    shortName: '難関国立 後期(文)',
    type: '国公立後期',
    course: '文系',
    border: 67,
    weights: { eng: 1.6, math: 0.0, jp: 1.6, sci: 1.0 },
    desc: '最難関の後期枠。圧倒的な英語力と論述小論文で逆転を狙う。'
  },
  {
    id: 'chiiki_hum_kouki',
    name: '地方拠点国立大学 人文・社会学部後期日程',
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
  { id: 'math_spark', name: '数理の閃き', desc: '【金特】数理の学習経験値+15%！本番で確率閃きクリティカル発動！', type: 'gold' },
  { id: 'humanities_spark', name: '人文の閃き', desc: '【金特】文系科目の学習経験値+15%！本番で確率閃きクリティカル発動！', type: 'gold' },
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
  BGM.play('daily');

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
  BGM.play('daily');

  setDialog('担任の先生', `${state.playerName}、今日から高校生活が始まるぞ！3年後の志望校合格に向けて、毎日の積み重ねを大切にしよう！`);
  renderUI();
}

function returnToTitle() {
  playSound('click');
  document.getElementById('event-modal').classList.remove('active');
  document.getElementById('main-game-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
  BGM.play('title');
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
  if (typeof updateTitleAchievementBadge === 'function') {
    updateTitleAchievementBadge();
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
  BGM.play('title');
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


function toggleSettingBGM() {
  settings.isBgmMuted = !settings.isBgmMuted;
  saveSettings();
  updateSettingsUI();
  BGM.updateVolume();
  playSound('click');
}

function changeBGMVolume(val) {
  settings.bgmVolume = Math.max(0, Math.min(100, parseInt(val, 10))) / 100;
  saveSettings();
  const valEl = document.getElementById('setting-bgm-val');
  if (valEl) valEl.textContent = `${Math.round(settings.bgmVolume * 100)}%`;
  BGM.updateVolume();
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
  const bgmBtn = document.getElementById('setting-bgm-toggle');
  if (bgmBtn) {
    const isBgmMute = settings.isMuted || settings.isBgmMuted;
    bgmBtn.textContent = isBgmMute ? 'OFF' : 'ON';
    bgmBtn.classList.toggle('active', !isBgmMute);
  }
  const bgmSlider = document.getElementById('setting-bgm-slider');
  const bgmVal = document.getElementById('setting-bgm-val');
  const curBgmVol = settings.bgmVolume !== undefined ? settings.bgmVolume : 0.5;
  if (bgmSlider) bgmSlider.value = Math.round(curBgmVol * 100);
  if (bgmVal) bgmVal.textContent = `${Math.round(curBgmVol * 100)}%`;

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
  BGM.play('daily');
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
  BGM.play('title');
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

function getOBList() {
  try {
    const listStr = localStorage.getItem('juken_success_ob_list');
    if (listStr) {
      const list = JSON.parse(listStr);
      if (Array.isArray(list)) return list;
    }
    // 旧キーからの自動移行
    const oldStr = localStorage.getItem('juken_success_ob');
    if (oldStr) {
      const oldOb = JSON.parse(oldStr);
      if (oldOb && typeof oldOb === 'object') {
        const migratedList = [{
          id: Date.now() - 100000,
          generation: 1,
          dateStr: `${oldOb.year || new Date().getFullYear()}年合格`,
          ...oldOb
        }];
        localStorage.setItem('juken_success_ob_list', JSON.stringify(migratedList));
        return migratedList;
      }
    }
  } catch (e) {
    console.error('getOBList error:', e);
  }
  return [];
}

function clearOBListConfirm() {
  playSound('click');
  if (confirm('歴代OB名簿をすべて初期化しますか？\n（登録されたOB先輩データが消去されます）')) {
    localStorage.removeItem('juken_success_ob_list');
    localStorage.removeItem('juken_success_ob');
    openOBRosterModal();
    renderRelations();
  }
}

function openOBRosterModal() {
  playSound('click');
  const body = document.getElementById('ob-modal-body');
  body.innerHTML = '';

  const list = getOBList();
  if (list && list.length > 0) {
    let cardsHtml = '';
    list.forEach((ob, idx) => {
      const genNum = ob.generation || (list.length - idx);
      const bestName = ob.bestSubjectName || (ob.bestSubject ? getSubjectDisplayName(ob.bestSubject) : null);
      const bestRank = ob.bestScore ? getRank(ob.bestScore).rank : '';
      const bestInfoHtml = bestName ? `<div class="univ" style="color:#0284c7; font-size:0.82rem; font-weight:800; margin-top:2px;">🔥 得意科目: ${bestName} ${ob.bestScore ? `(${ob.bestScore}点・${bestRank}ランク)` : ''}</div>` : '';
      const dateText = ob.dateStr || (ob.year ? `${ob.year}年` : '');

      cardsHtml += `
        <div class="ob-history-card">
          <div class="avatar">👨‍</div>
          <div class="info">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="name">${ob.name} 先輩</span>
              <span class="ob-badge" style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid #bae6fd;">第${genNum}期生</span>
            </div>
            <div class="univ" style="margin-top:2px;">🌸 【${ob.univ}】 現役合格！</div>
            ${bestInfoHtml}
            <div class="date" style="margin-top:3px;">合格日: ${dateText} / 習得特能数: ${ob.traitsCount || 0}個</div>
          </div>
        </div>
      `;
    });

    body.innerHTML = `
      <div class="ob-list-summary" style="display:flex; justify-content:space-between; align-items:center; padding: 4px 6px; font-size:0.8rem; font-weight:800; color:#334155; border-bottom:1px solid #e2e8f0; margin-bottom:6px;">
        <span>歴代OB合格名簿: <span style="color:#2563eb;">${list.length}名 登録</span></span>
        <button class="btn-clear-ob" onclick="clearOBListConfirm()" style="font-size:0.7rem; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; padding:2px 8px; cursor:pointer; font-weight:700;">名簿初期化</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${cardsHtml}
      </div>
      <p style="font-size:0.75rem; color:#475569; margin-top:8px; line-height:1.45;">
        ※登録された歴代のOB先輩たちは、2周目以降の高校生活中に<strong>ランダム抽選で家庭教師・激励</strong>に現れ、それぞれの得意科目に応じた集中指導（+25pt）と基礎アドバイス（+6pt）をしてくれます！
      </p>
    `;
  } else {
    body.innerHTML = `
      <div style="text-align: center; padding: 24px 0; color: #64748b; font-size: 0.85rem; font-weight: 700;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;"></div>
        まだ合格実績データがありません。<br>
        大学に合格してゲームをクリアすると、<br>
        ここにあなたのキャラが栄光の歴代OBとして何人でも登録されます！
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
    univBadge.textContent = '志望校: 未設定';
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
  document.getElementById('subj-name-sci').textContent = sciLabel;
  const studySciLabel = document.getElementById('study-name-sci');
  if (studySciLabel) studySciLabel.textContent = sciSubtext ? `${sciLabel}（${state.specialtySubjects.name}）の集中学習` : `${sciLabel}の集中学習`;
  const studySciDesc = document.getElementById('study-desc-sci');
  if (studySciDesc) studySciDesc.textContent = sciSubtext ? `${state.specialtySubjects.name}の経験値を獲得 (体力-15 / ストレス+7)` : `${sciLabel}の経験値を獲得 (体力-15 / ストレス+7)`;
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
  if (state.stress >= 100) state.hadMaxStress = true;
  if (typeof checkAchievements === 'function') checkAchievements();

  // 共通試験直前対策期間（高3 11月〜1月2週）限定ボタン表示制御
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

  // 3. OB先輩（何人でも保存・名簿閲覧可能）
  const obList = getOBList();
  const obCard = document.createElement('div');
  if (obList && obList.length > 0) {
    const topOb = obList[0];
    obCard.className = 'relation-card';
    obCard.style.cursor = 'pointer';
    obCard.title = 'クリックして歴代OB名簿を見る';
    obCard.onclick = () => openOBRosterModal();
    obCard.innerHTML = `
      <div class="rel-avatar">👨‍</div>
      <div class="rel-info">
        <div class="rel-name" style="display:flex; justify-content:space-between; align-items:center;">
          <span>歴代OB先輩 (${obList.length}名登録中)</span>
          <span style="font-size:0.7rem; color:#2563eb; font-weight:700;">名簿を見る ▶</span>
        </div>
        <div class="rel-desc">直近: 第${topOb.generation || obList.length}期 ${topOb.name}先輩 (${topOb.univ}合格)<br>歴代先輩がランダムに家庭教師として来校指導してくれます！</div>
      </div>
    `;
  } else {
    obCard.className = 'relation-card unmet';
    obCard.innerHTML = `
      <div class="rel-avatar"></div>
      <div class="rel-info">
        <div class="rel-name">OBの先輩 (未登録)</div>
        <div class="rel-desc">大学に合格してゲームをクリアすると、歴代OBとして何人でも登録されます！</div>
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
  state.itemsUsedThisTurn = 0;
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

  // ターン開始時にアイテム使用回数をリセット
  state.itemsUsedThisTurn = 0;

  // 1. 月初めのお小遣い支給 ＆ お年玉（バランス調整版）
  if (state.week === 1) {
    let monthlyAllowance = 1500; // 高1: 毎月1,500円
    if (state.year === 2) monthlyAllowance = 2000; // 高2: 毎月2,000円
    if (state.year === 3) monthlyAllowance = 2500; // 高3: 毎月2,500円

    let otoshidama = 0;
    if (state.month === 1) {
      otoshidama = 4000; // 1月1週のお年玉ボーナス（4,000円）
    }

    const totalAllowance = monthlyAllowance + otoshidama;
    state.money = (state.money || 0) + totalAllowance;

    const noticeText = otoshidama > 0 
      ? `お小遣い&お年玉 +¥${totalAllowance.toLocaleString()}！` 
      : `今月のお小遣い +¥${monthlyAllowance.toLocaleString()}`;
    showFloatingText(noticeText, null, null, 'item');
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

function closeStudyMenu() {
  playSound('click');
  document.getElementById('study-modal').classList.remove('active');
}

function renderStudyMenu() {
  if (!state) return;

  const isBunkei = state.course === '文系';
  const sciLabel = state.course === '理系' ? '理科' : (isBunkei ? '社会' : '理社');
  const specName = state.specialtySubjects ? state.specialtySubjects.name : sciLabel;
  const sciIcon = isBunkei ? '📜' : '🔬';

  // 基本消費の計算（ギアや部活のパッシブ補正をリアルタイム反映）
  const hasCushion = hasItem('gear_cushion');
  const hasEarplugs = hasItem('gear_earplugs');
  const clubPenalty = state.club === '運動部' ? 3 : 0;

  function calcCosts(baseStam, baseStress) {
    let sCost = baseStam + clubPenalty;
    if (hasCushion) sCost = Math.max(6, sCost - 2);
    let stCost = baseStress;
    if (hasEarplugs) stCost = Math.max(3, Math.round(stCost * 0.85));
    return { sCost, stCost };
  }

  const costs = {
    eng: calcCosts(15, 7),
    math: calcCosts(18, 9),
    jp: calcCosts(12, 5),
    sci: calcCosts(15, 7),
    all: calcCosts(22, 10),
    extra: calcCosts(14, 6)
  };

  const container = document.querySelector('#study-modal .study-options');
  if (!container) return;

  const isKyotsuPeriod = state.year === 3 && (state.month === 11 || state.month === 12 || (state.month === 1 && state.week <= 2));
  const subName = isBunkei ? '理科基礎' : '社会';

  // パッシブ効果のタグ
  const engBookTag = hasItem('book_eng') ? '<span class="play-tag exp" style="background:#e0f2fe;color:#0284c7;border-color:#bae6fd;">単語帳 +15%</span>' : '';
  const mathBookTag = hasItem('book_math') ? '<span class="play-tag exp" style="background:#e0f2fe;color:#0284c7;border-color:#bae6fd;">青チャート +15%</span>' : '';
  const jpBookTag = hasItem('book_jp') ? '<span class="play-tag exp" style="background:#e0f2fe;color:#0284c7;border-color:#bae6fd;">現代文開発 +15%</span>' : '';
  const sciBookTag = hasItem('book_sci') ? '<span class="play-tag exp" style="background:#e0f2fe;color:#0284c7;border-color:#bae6fd;">集中講義 +15%</span>' : '';

  const gearCushionTag = hasCushion ? '<span class="play-tag heal" style="background:#dcfce7;color:#15803d;border-color:#bbf7d0;">クッション -2</span>' : '';
  const gearEarplugsTag = hasEarplugs ? '<span class="play-tag heal" style="background:#dcfce7;color:#15803d;border-color:#bbf7d0;">耳栓 15%軽減</span>' : '';

  container.innerHTML = `
    <button class="study-card-btn study-eng-btn" onclick="executeStudy('eng')">
      <div class="subject-pill pill-eng">英語</div>
      <div class="info">
        <div class="name">英語の集中学習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.eng.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.eng.stCost}%</span>
            <span class="play-tag exp">英語経験値 大</span>
            ${engBookTag}
            ${gearCushionTag}
            ${gearEarplugsTag}
          </div>
        </div>
      </div>
    </button>

    <button class="study-card-btn study-math-btn" onclick="executeStudy('math')">
      <div class="subject-pill pill-math">数学</div>
      <div class="info">
        <div class="name">数学の集中学習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.math.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.math.stCost}%</span>
            <span class="play-tag exp">数学経験値 大</span>
            ${mathBookTag}
            ${gearCushionTag}
            ${gearEarplugsTag}
          </div>
        </div>
      </div>
    </button>

    <button class="study-card-btn study-jp-btn" onclick="executeStudy('jp')">
      <div class="subject-pill pill-jp">国語</div>
      <div class="info">
        <div class="name">国語の集中学習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.jp.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.jp.stCost}%</span>
            <span class="play-tag exp">国語経験値 大</span>
            ${jpBookTag}
            ${gearCushionTag}
            ${gearEarplugsTag}
          </div>
        </div>
      </div>
    </button>

    <button class="study-card-btn study-sci-btn" onclick="executeStudy('sci')">
      <div class="subject-pill pill-sci">${sciLabel}</div>
      <div class="info">
        <div class="name">${sciLabel}（${specName}）の集中学習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.sci.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.sci.stCost}%</span>
            <span class="play-tag exp">${specName}経験値 大</span>
            ${sciBookTag}
            ${gearCushionTag}
            ${gearEarplugsTag}
          </div>
        </div>
      </div>
    </button>

    <button class="study-card-btn all-round study-all-btn" onclick="executeStudy('all')">
      <div class="subject-pill pill-all">総合</div>
      <div class="info">
        <div class="name">全科目 総合演習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.all.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.all.stCost}%</span>
            <span class="play-tag exp">全教科バランス底上げ</span>
            ${gearCushionTag}
            ${gearEarplugsTag}
          </div>
        </div>
      </div>
    </button>

    ${isKyotsuPeriod ? `
    <button class="study-card-btn kyotsu-extra study-extra-btn" style="border-color: #f59e0b; background: #fffbeb;" onclick="executeStudy('sub_extra')">
      <div class="subject-pill pill-extra">共試</div>
      <div class="info">
        <div class="name" style="color: #b45309; font-weight: 800;">情報I・${subName} 演習</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">体力 -${costs.extra.sCost}</span>
            <span class="play-tag cost">ストレス +${costs.extra.stCost}%</span>
            <span class="play-tag exp">共通試験200点枠 +14pt</span>
            <span class="play-tag mot">現在: ${Math.round(state.subExtraScore || 35)}点</span>
          </div>
        </div>
      </div>
    </button>
    ` : ''}
  `;
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
    state.hadStudyFail = true;
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

  // 勉強ギアパッシブ効果
  if (hasItem('gear_cushion')) {
    stamCost = Math.max(6, stamCost - 2); // 低反発クッション: 体力消費 -2pt
  }
  if (hasItem('gear_earplugs')) {
    stressCost = Math.max(3, Math.round(stressCost * 0.85)); // 耳栓: ストレス増加量 15%カット
  }

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
    state.hadStudyFail = true;
    showFloatingText('勉強失敗…！', null, null, 'damage');
    state.stamina = Math.max(0, state.stamina - Math.floor(stamCost * 1.2));
    state.stress = Math.min(100, state.stress + 10);

    let motDown = false;
    if (state.motivation > 0 && Math.random() < 0.5) {
      if (hasItem('gear_timer')) {
        motDown = false; // 学習タイマー所持時はやる気低下を防止
      } else {
        state.motivation--;
        motDown = true;
      }
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
        if (state.traits.includes('math_spark') && (s === 'math' || s === 'sci')) subjMult *= 1.15;
        if (state.traits.includes('humanities_spark') && (s === 'jp' || (isBunkei && s === 'sci') || s === 'eng')) subjMult *= 1.15;
        // 総合演習は4教科に分散するため各科38%（単科18ptに対し約7pt・4教科合計で約1.5倍の総経験点）
        let bookBonus = 1.0;
        if (s === 'eng' && hasItem('book_eng')) bookBonus = 1.15;
        if (s === 'math' && hasItem('book_math')) bookBonus = 1.15;
        if (s === 'jp' && hasItem('book_jp')) bookBonus = 1.15;
        if (s === 'sci' && hasItem('book_sci')) bookBonus = 1.15;

        const pts = Math.max(3, Math.round((baseExp * 0.38) * motMulti * zoneBonus * subjMult * bookBonus));
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
        rewardLines.push(` 【学力UP!】${leveledUpSubjs.join('・')}`);
      }
    } else {
      let mult = 1.0;
      if (state.traits.includes('speed_reading') && (subject === 'eng' || subject === 'jp')) mult *= 1.25;
      if (state.club === '文化部' && (subject === 'eng' || subject === 'jp')) mult *= 1.2;

      // 金特パッシブ: 該当教科の学習経験値 +15% UP（案A調整）
      if (state.traits.includes('math_spark') && (subject === 'math' || subject === 'sci')) {
        mult *= 1.15;
      }
      if (state.traits.includes('humanities_spark') && (subject === 'jp' || (isBunkei && subject === 'sci') || subject === 'eng')) {
        mult *= 1.15;
      }

      // 参考書パッシブボーナス (+15%)
      let bookBonus = 1.0;
      if (subject === 'eng' && hasItem('book_eng')) bookBonus = 1.15;
      if (subject === 'math' && hasItem('book_math')) bookBonus = 1.15;
      if (subject === 'jp' && hasItem('book_jp')) bookBonus = 1.15;
      if (subject === 'sci' && hasItem('book_sci')) bookBonus = 1.15;

      const gainedExp = Math.round(baseExp * motMulti * zoneBonus * mult * bookBonus);
      const levelUps = addExpToSubject(subject, gainedExp);

      const subjName = getSubjectDisplayName(subject);
      const gradeNotice = state.year > 1 ? `（${state.year}年生効率UP）` : '';
      rewardLines.push(`${subjName}経験値: +${gainedExp} pt 獲得！${gradeNotice}`);
      showFloatingText(`${subjName} +${gainedExp} pt`, null, null, 'exp');

      if (levelUps > 0) {
        anyLevelUp = true;
        rewardLines.push(` 【${subjName} 偏差値 UP! ➔ ${state.subjects[subject].score}】`);
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

  // 0. 購買部・本屋に行く（ターン消費なし）
  const btnShop = document.createElement('button');
  btnShop.className = 'study-card-btn';
  btnShop.style.borderColor = '#16a34a';
  btnShop.style.background = '#f0fdf4';
  btnShop.onclick = () => {
    closePlayMenu();
    openShopModal();
  };
  btnShop.innerHTML = `
    <span class="play-type-pill pill-shop">購買</span>
    <div class="info">
      <div class="name" style="color:#166534; font-weight:900;">購買部・本屋に行く</div>
      <div class="desc">
        <div class="play-effect-row">
          <span class="play-tag cost" style="background:#dcfce7;color:#15803d;border-color:#bbf7d0;">買い出し</span>
          <span class="play-tag">参考書・ギア・軽食購入</span>
          <span class="play-tag" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd;">※ターン消費なし</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(btnShop);

  // 1. 自宅の部屋
  const btnHome = document.createElement('button');
  btnHome.className = 'study-card-btn';
  btnHome.onclick = () => executePlay('home');
  btnHome.innerHTML = `
    <span class="play-type-pill pill-home">自宅</span>
    <div class="info">
      <div class="name">自宅の部屋でゲーム＆マンガ</div>
      <div class="desc">
        <div class="play-effect-row">
          <span class="play-tag cost">費用: ¥0</span>
          <span class="play-tag heal">ストレス -30%</span>
          <span class="play-tag heal">体力 +15</span>
          <span class="play-tag mot">やる気UP ⤴</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(btnHome);

  // 2. 学問神社（お参り・合格祈願・赤特浄化）
  const btnShrine = document.createElement('button');
  btnShrine.className = 'study-card-btn';
  btnShrine.onclick = () => executePlay('shrine');
  btnShrine.innerHTML = `
    <span class="play-type-pill pill-shrine">神社</span>
    <div class="info">
      <div class="name">学問神社でお参り＆合格祈願</div>
      <div class="desc">
        <div class="play-effect-row">
          <span class="play-tag cost">費用: ¥500</span>
          <span class="play-tag mot">やる気 絶好調</span>
          <span class="play-tag heal">ストレス -20%</span>
          <span class="play-tag">赤特お祓い浄化</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(btnShrine);

  // 3. 大型書店・自習カフェ
  const btnBookstore = document.createElement('button');
  btnBookstore.className = 'study-card-btn';
  btnBookstore.onclick = () => executePlay('bookstore');
  btnBookstore.innerHTML = `
    <span class="play-type-pill pill-book">書店</span>
    <div class="info">
      <div class="name">大型書店＆自習カフェ</div>
      <div class="desc">
        <div class="play-effect-row">
          <span class="play-tag cost">費用: ¥600</span>
          <span class="play-tag exp">全教科経験値 +8pt</span>
          <span class="play-tag heal">ストレス -20%</span>
          <span class="play-tag mot">やる気UP ⤴</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(btnBookstore);

  // 4. カラオケ・ゲーセン（ストレス完全発散）
  const btnKaraoke = document.createElement('button');
  btnKaraoke.className = 'study-card-btn';
  btnKaraoke.onclick = () => executePlay('karaoke');
  btnKaraoke.innerHTML = `
    <span class="play-type-pill pill-sing">熱唱</span>
    <div class="info">
      <div class="name">カラオケで熱唱！大発散</div>
      <div class="desc">
        <div class="play-effect-row">
          <span class="play-tag cost">費用: ¥1,200</span>
          <span class="play-tag heal">ストレス -50%</span>
          <span class="play-tag mot">やる気 絶好調</span>
          <span class="play-tag cost">体力 -5</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(btnKaraoke);

  // 5. あおいとカフェ（交友）
  const btnAoi = document.createElement('button');
  if (state.friends.aoi.met) {
    btnAoi.className = 'study-card-btn';
    btnAoi.onclick = () => executePlay('aoi');
    btnAoi.innerHTML = `
      <span class="play-type-pill pill-friend">交友</span>
      <div class="info">
        <div class="name">あおいとカフェで自習＆おしゃべり</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">費用: ¥800</span>
            <span class="play-tag heal">好感度 +15%</span>
            <span class="play-tag heal">ストレス -35%</span>
            <span class="play-tag heal">体力 +10</span>
            <span class="play-tag mot">やる気UP ⤴</span>
          </div>
        </div>
      </div>
    `;
  } else {
    btnAoi.className = 'study-card-btn locked';
    btnAoi.innerHTML = `
      <span class="play-type-pill pill-lock">未解放</span>
      <div class="info">
        <div class="name">幼馴染とお出かけ (未解放)</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag">高校生活が進むと出会えるかも…？</span>
          </div>
        </div>
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
    const subExpTag = isBunkeiMenu 
      ? '<span class="play-tag exp">国語 +20pt・社会 +15pt</span>' 
      : '<span class="play-tag exp">数学 +20pt・英語 +15pt</span>';
    btnShindo.innerHTML = `
      <span class="play-type-pill pill-rival">切磋</span>
      <div class="info">
        <div class="name">神童くんとファミレスで受験戦略会議</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag cost">費用: ¥900</span>
            <span class="play-tag heal">友好度 +15%</span>
            ${subExpTag}
            <span class="play-tag heal">ストレス -20%</span>
          </div>
        </div>
      </div>
    `;
  } else {
    btnShindo.className = 'study-card-btn locked';
    btnShindo.innerHTML = `
      <span class="play-type-pill pill-lock">未解放</span>
      <div class="info">
        <div class="name">ライバルとお出かけ (未解放)</div>
        <div class="desc">
          <div class="play-effect-row">
            <span class="play-tag">高1秋の文理選択後に現れるかも…？</span>
          </div>
        </div>
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
    showEventModal('✨ 弱点克服！', `カウンセリングと自己改善により、【赤特】${trait.name} を完全に克服・消去した！`, [], '');
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

  // 高3 1月4週：国公立前期・後期 最終出願決定（共通試験リサーチを受けた出願変更＆後期校決定）
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

  // 高3 11月1週：共通試験直前対策期間スタート告知
  if (y === 3 && m === 11 && w === 1 && !state.kyotsuPeriodActive) {
    state.kyotsuPeriodActive = true;
    enqueueModal(() => {
      showEventModal(
        '共通試験直前対策期間 スタート！',
        'いよいよ11月！全国統一共通試験本番まで残り2ヶ月半となった！\n\nここからは新課程共通試験の専用科目【情報I】と、副教科（理系社会 / 文系の理科基礎）の集中対策期間が解禁！\n勉強メニューの「情報I・副教科演習」を活用して、200点分の得点源をがっちり確保しよう！',
        ['勉強メニューに「情報I・副教科マーク演習」が解放！', '共テ200点枠を抜け目なく鍛えて足切りを突破せよ！'],
        '💻',
        () => renderUI()
      );
      setDialog('担任の先生', '11月からは共通試験対策のギアを一段上げよう！情報Iと副教科を抜かりなく仕上げておくことが安全圏への鍵だ！');
    });
    return;
  }

  // 模試エントリー判定（高1・高2: 年2〜3回、高3: 4月, 7月, 8月, 11月, 12月）
  const isMockWeek = (
    (y === 1 && w === 2 && (m === 6 || m === 11 || m === 1)) ||
    (y === 2 && w === 2 && (m === 6 || m === 11 || m === 2)) ||
    (y === 3 && w === 2 && (m === 4 || m === 7 || m === 8 || m === 11 || m === 12))
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

  if (getOBList().length > 0 && Math.random() < 0.04) {
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
          subtext: '帝大文系・京洛大文学部など、地歴2科目を課す難関二次試験専用の本格派！',
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

  showChoiceModal(' 志望校・学部を決定しよう！', '高校3年生の春。いよいよ受験する大学・学部のターゲットを定める時が来た！', options, '🏫');
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
      subtext: `傾斜偏差値: ${curDev} (${diffPrefix}) | 共通試験利用 ＆ 2月個別日程併願`,
      action: () => {
        state.subUniv = u;
        enqueueModal(() => {
          showEventModal(
            `私大併願校の出願完了！`,
            `【${u.name}】（ボーダー偏差値 ${u.border}）の出願手続きを完了した！\n\n1月の全国統一共通試験では「共通試験利用入試」にも同時出願！\n高得点を獲得できれば2月の個別試験前に合格を確定できるぞ！`,
            [
              `併願校: ${u.name}`,
              `目標ボーダー: 偏差値 ${u.border}`,
              `判定状況: ${judge}（傾斜偏差値 ${curDev}）`
            ],
            '📑'
          );
        });
        setDialog('担任の先生', `【${u.name}】の出願だな！共通試験利用と2月個別の2段構えでいこう！`);
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
    '高校3年 12月。いよいよ大学入試の出願シーズンが始まった！\n共通試験利用入試および2月個別日程で併願する私立大学（すべり止め・併願校）を決定しよう！',
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

  // すでに共通試験利用で合格済みの場合
  if (state.subUnivKyotsuPass) {
    playSound('success');
    state.motivation = Math.min(4, state.motivation + 1);
    state.stamina = state.maxStamina;
    state.stress = Math.max(0, state.stress - 20);
    showEventModal(
      ' 併願校合格確保済み！私大個別試験は免除！',
      `共通試験利用入試で見事【${state.subUniv.name}】の合格を確保しているため、2月の私大個別試験は受験不要！\n\nすべり止め校を確保した大きな精神的アドバンテージを得て、月末の第1志望本番に全集中できる！`,
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

  // 共通試験利用で受かっていない場合 ➔ 個別試験本番
  showEventModal(
    '⚔️ 私大個別日程入試 本番！',
    `併願校【${state.subUniv.name}】（ボーダー偏差値 ${state.subUniv.border}）の個別日程入試が始まった！\n得意教科を活かした3教科の勝負！合格を勝ち取って浪人を回避せよ！`,
    [`受験校: ${state.subUniv.name}`, `試験科目: 3教科記述`],
    '',
    () => startExamBattle('private_sub')
  );
}

function calcKyotsuResearchJudge(univ) {
  let borderRate = 60;
  if (univ.border >= 75) borderRate = 88;
  else if (univ.border >= 70) borderRate = 83;
  else if (univ.border >= 65) borderRate = 78;
  else if (univ.border >= 60) borderRate = 73;
  else if (univ.border >= 55) borderRate = 67;

  const diff = (state.kyotsuRate || 0) - borderRate;
  if (diff >= 5) return { rank: 'A', desc: '80%以上(安全圏)' };
  if (diff >= 2) return { rank: 'B', desc: '60%〜80%(良好)' };
  if (diff >= -2) return { rank: 'C', desc: '40%〜60%(ボーダー)' };
  if (diff >= -6) return { rank: 'D', desc: '20%〜40%(要二次逆転)' };
  return { rank: 'E', desc: '20%以下(大逆転必要)' };
}

function triggerFinalApplicationChoice() {
  const currentTarget = state.targetUniv || UNIV_LIST[0];
  const curJudge = calcKyotsuResearchJudge(currentTarget);
  state.kyotsuResearchRank = curJudge.rank;

  const options = [
    {
      title: `🔥 初志貫徹！現在の第1志望【${currentTarget.name}】に前期出願する！`,
      subtext: `共テ判定【${curJudge.rank}判定（${curJudge.desc}）】・目標ボーダー偏差値${currentTarget.border}。これまでの努力を信じて本命校に突撃！(やる気+1)`,
      action: () => {
        state.motivation = Math.min(4, state.motivation + 1);
        showEventModal(
          '🔥 初志貫徹の出願完了！',
          `第1志望【${currentTarget.name}】（ボーダー偏差値 ${currentTarget.border}）への前期日程出願を完了した！\n共テ判定は【${curJudge.rank}判定】だが、二次記述で逆転を狙う！`,
          [`出願先: ${currentTarget.name}（前期日程）`, '覚悟を決めてやる気+1！'],
          '🔥',
          () => {
            if (currentTarget.type === '国公立') {
              triggerKoukiSelect();
            } else {
              setDialog('担任の先生', `よし、覚悟は決まったな！本命【${currentTarget.name}】合格へ向けてラストスパートだ！`);
              renderUI();
            }
          }
        );
      }
    },
    {
      title: '🔄 志望校を全選択肢から選びなおす（出願先変更）',
      subtext: `共通試験自己採点【${state.kyotsuScore}点 (${state.kyotsuRate}%)】をもとに、全ての大学・学部から前期出願先を再選択する！`,
      action: () => {
        triggerReselectTargetUniv();
      }
    }
  ];

  showChoiceModal(
    '共通試験リサーチ返却！国公立 前期・最終出願戦略',
    `共通試験自己採点結果: 【 ${state.kyotsuScore}点 (${state.kyotsuRate}%) 】\n現在の第1志望【${currentTarget.name}】のリサーチ判定: 【 ${curJudge.rank}判定 (${curJudge.desc}) 】\n\nここが出願締め切り前の最終決定！前期日程の出願先を確定させよう！`,
    options,
    '📑'
  );
}

function triggerReselectTargetUniv() {
  const currentTarget = state.targetUniv || UNIV_LIST[0];

  // 国公立後期日程を除く全大学・学部リスト
  const availableList = UNIV_LIST.filter(u => u.type !== '国公立後期');
  // プレイヤーのコース（文系/理系/共通）に合致する大学を優先
  const primaryList = availableList.filter(u => u.course === state.course || u.course === '共通');
  const otherList = availableList.filter(u => u.course !== state.course && u.course !== '共通');
  const sortedList = [...primaryList, ...otherList];

  const options = sortedList.map(u => {
    const isCurrent = u.id === currentTarget.id;
    const curDev = calcTargetDev(u);
    const diff = (curDev - u.border).toFixed(1);
    const diffPrefix = diff >= 0 ? `+${diff}` : `${diff}`;
    const judge = calcKyotsuResearchJudge(u);

    const recTag = u.course === state.course ? ' ⭐' : '（文理外）';
    const curTag = isCurrent ? ' 【現在の志望校】' : '';

    const w = u.weights;
    let weightDesc = [];
    if (w.math >= 1.5 && w.sci >= 1.5) weightDesc.push('数理1.5倍');
    else if (w.math === 0.0) weightDesc.push('英国社3教科');
    else if (w.jp === 0.0) weightDesc.push('数理英3教科');
    else if (w.eng >= 1.4 && w.jp >= 1.4) weightDesc.push('国英重視');
    else weightDesc.push('全科目均等');

    return {
      title: `${u.name} (ボーダー: 偏差値${u.border})${recTag}${curTag}`,
      subtext: `共テ判定:【${judge.rank}判定】(${judge.desc}) | 傾斜偏差値: ${curDev} (${diffPrefix}) | 配点: ${weightDesc.join('・')}`,
      action: () => {
        const isChanged = u.id !== currentTarget.id;
        state.targetUniv = u;
        state.kyotsuResearchRank = judge.rank;

        let rewardText = '';
        if (isChanged) {
          state.stress = Math.max(0, state.stress - 15);
          rewardText = '状況を見極めた戦略的変更により ストレス-15！';
        } else {
          state.motivation = Math.min(4, state.motivation + 1);
          rewardText = '初志貫徹の強い決断！やる気+1！';
        }

        showEventModal(
          `前期出願校 決定！【${u.name}】`,
          `全国共通試験リサーチ結果【${judge.rank}判定】を踏まえ、前期日程の出願先を【${u.name}】（ボーダー偏差値 ${u.border}）に決定・出願した！\n\n二次試験本番に向けてラストスパートをかけよう！`,
          [
            `前期出願先: ${u.name}`,
            `目標ボーダー: 偏差値 ${u.border}`,
            `共通試験リサーチ判定: 【${judge.rank}判定】`,
            rewardText
          ],
          '🏫',
          () => {
            if (u.type === '国公立') {
              triggerKoukiSelect();
            } else {
              setDialog('担任の先生', `よし、前期出願校が決まったな！あとは本番に向けて全力を尽くすのみだ！`);
              renderUI();
            }
          }
        );
      }
    };
  });

  // 戻るボタン
  options.push({
    title: '↩️ 戻る（出願戦略メニューへ戻る）',
    subtext: '出願戦略の選択メニューへ戻ります。',
    action: () => {
      triggerFinalApplicationChoice();
    }
  });

  showChoiceModal(
    '🎯 前期出願先・志望校の再選択（全大学・学部）',
    `【共通試験自己採点: ${state.kyotsuScore}点 (${state.kyotsuRate}%)】\n各大学のリサーチ判定と傾斜偏差値を吟味して、前期日程の出願先を再決定しよう！`,
    options,
    '🏫'
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
          '国公立 後期日程 出願完了！',
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
  if (state.traits.includes('math_spark')) finalBonus += 1.5;
  if (state.traits.includes('humanities_spark')) finalBonus += 1.5;
  if (state.traits.includes('strong_exam')) finalBonus += 2.0;
  if (state.traits.includes('weak_exam')) finalBonus -= 2.0;

  let finalDev = calcTargetDev(target, finalBonus);
  const isPassed = finalDev >= (target.border - 1.2);
  state.firstChoicePassed = isPassed;
  if (finalDev >= 70.0 && typeof unlockAchievement === 'function') unlockAchievement('dev_70');
  if (isPassed && typeof unlockUnivAchievement === 'function') {
    unlockUnivAchievement(target.id);
    if (state.hadMockE) unlockAchievement('miracle_comeback');
  }

  if (isPassed) {
    playSound('fanfare');
    triggerParticles(null, null, 40, 'confetti');
    showEventModal(
      `祝！【${target.name}】 前期日程 合格発表！ 🌸`,
      `合格者受験番号一覧の中に、自分の番号が確かにあった！\n第1志望【${target.name}】（ボーダー偏差値 ${target.border}）に見事現役合格！！\n高校3年間のすべての努力が最高の形で報われた！`,
      [
        `前期日程合否: 【 合格 [合格] 】`,
        `最終傾斜偏差値: ${finalDev} (目標ボーダー: ${target.border})`,
        '堂々の第1志望合格！栄光の大学生活へ進もう！'
      ],
      '',
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
        `前期日程合否: 【 不合格 [不合格] 】`,
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
      [`前期日程合否: 【 不合格 [不合格] 】`],
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
    '',
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
  const list = getOBList();
  if (!list || list.length === 0) return;

  // 歴代登録OBの中からランダムに1人を抽選！
  const ob = list[Math.floor(Math.random() * list.length)];

  playSound('success');
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

  const genText = ob.generation ? `第${ob.generation}期生の` : '';

  showEventModal(
    `👨‍ ${ob.name}先輩（${ob.univ}合格）の家庭教師指導！`,
    `歴代OB名簿（全${list.length}名）の中から、見事【${ob.univ}】に合格した${genText}${ob.name}先輩が激励・家庭教師として駆けつけてくれた！\n\n「後輩のために、俺が得意だった【${bestSubjName}】の受験テクニックを直接伝授してやるぞ！」と熱血指導と参考書を差し入れてくれた！`,
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
  const totalStudents = 240; // 校内学年総生徒数
  if (avg >= 75) {
    schoolRank = `学年 5位 / ${totalStudents}人中 (上位2%・学年トップ層)`;
    rankStr = '学年トップクラス！全校に名前が轟く秀才！';
    if (state.motivation < 4) state.motivation++;
    state.money += 1000;
    examReviewExp = 35;
    rewardText = '特別お小遣い +¥1,000 / 考査復習: 全教科経験値 +35pt！';
  } else if (avg >= 60) {
    schoolRank = `学年 25位 / ${totalStudents}人中 (上位10%・選抜クラス水準)`;
    rankStr = '成績優秀！先生や親から大きく褒められた！';
    if (state.motivation < 4) state.motivation++;
    state.money += 500;
    examReviewExp = 26;
    rewardText = '臨時お小遣い +¥500 / 考査復習: 全教科経験値 +26pt！';
  } else if (avg >= 45) {
    schoolRank = `学年 95位 / ${totalStudents}人中 (平均レベル)`;
    rankStr = '学年平均レベル。基礎はしっかり定着している。';
    examReviewExp = 18;
    rewardText = '考査復習: 全教科経験値 +18pt！';
  } else {
    schoolRank = `学年 195位 / ${totalStudents}人中 (下位レベル・要注意)`;
    rankStr = '赤点ギリギリ…補習の危機！';
    if (state.motivation > 0) state.motivation--;
    examReviewExp = 12;
    rewardText = 'やる気ダウン… / 追試復習: 全教科経験値 +12pt';
  }
  ['eng', 'math', 'jp', 'sci'].forEach(s => addExpToSubject(s, examReviewExp));

  state.history.unshift(`${state.year}年生${state.month}月 定期考査: 【${schoolRank}】(学力平均 ${avg}・学内偏差値 ${dev})`);

  showEventModal(
    '📝 校内定期考査 結果発表！',
    `全教科のテストが返却された！\n4教科平均学力: ${avg} （${getRank(avg).rank}ランク）\n\n${rankStr}`,
    [`校内成績: 【 ${schoolRank} 】`, `学内換算偏差値: ${dev}`, rewardText],
    '📋'
  );
  setDialog('担任の先生', `定期テストの結果が出たぞ。校内成績は【${schoolRank}】だ！慢心せず次へ向けろ！`);
  renderUI();
}

function triggerMockEntry(y, m, w) {
  const targetUnivName = state.targetUniv ? state.targetUniv.name : '第1志望大学';
  let kanName = '難関大学 突破オープン模試';
  if (state.targetUniv) {
    if (state.targetUniv.id.includes('todai')) kanName = '帝大入試実戦模試';
    else if (state.targetUniv.id.includes('kyodai')) kanName = '京洛大入試オープン模試';
    else if (state.targetUniv.id.includes('waseda')) kanName = '早稲谷大入試プレ模試';
    else if (state.targetUniv.id.includes('keio')) kanName = '慶明大入試プレ模試';
    else if (state.targetUniv.type === '国公立') kanName = `${state.targetUniv.shortName || '難関国公立'} 突破オープン模試`;
    else kanName = `${state.targetUniv.shortName || '有名私大'} 突破プレ模試`;
  }

  const options = [];

  // 高3 8月・11月: 「志望校冠模試」（志望校設定済みの場合のみ受験可能）
  if (y === 3 && (m === 8 || m === 11) && state.targetUniv) {
    const kanSeason = m === 8 ? '夏の陣' : '秋の決戦';
    options.push({
      title: `【${kanName}（${kanSeason}）】を受験する！`,
      subtext: `志望校【${targetUnivName}】の出題形式・配点を完全模倣！A/B判定で特能【本番◯】や自信を獲得！（費用無料 / 体力-28）`,
      action: () => executeMockExam('kan', `${kanName}（${kanSeason}）`)
    });
  }

  // 共通試験型マーク模試（高3は 4月、7月、12月に開催。8月は冠模試に集中！）
  const isKyotsuMockMonth = (y === 3 && (m === 4 || m === 7 || m === 12)) || (y < 3);
  if (isKyotsuMockMonth) {
    let markName = '';
    if (y === 3) {
      if (m === 4) markName = '第1回 全国統一共通模試（春季）';
      else if (m === 7) markName = '第2回 全国統一共通模試（夏の共テ模試）';
      else markName = '全国統一共通プレ模試（直前ファイナル）';
    } else {
      markName = `第${m === 6 ? 1 : (m === 11 ? 2 : 3)}回 マーク模試`;
    }

    options.push({
      title: `📊 【${markName}】を受験する`,
      subtext: `新課程1000点満点換算！全教科の基礎バランス・共テ足切り判定を測定。（費用無料 / 体力-22）`,
      action: () => executeMockExam('mark', markName)
    });
  }

  // 記述模試（12月の直前プレ以外で受験可能）
  if (!(y === 3 && m === 12)) {
    const descName = y === 3 ? `全国統一記述模試（${m === 8 ? '夏期' : (m === 11 ? '秋期' : `${m}月`)}）` : `第${m === 6 ? 1 : 2}回 学力記述模試`;
    options.push({
      title: `【${descName}】を受験する`,
      subtext: `論述・記述形式の難問演習！二次試験の記述力を鍛え、主要教科の経験値特大。（費用無料 / 体力-25）`,
      action: () => executeMockExam('desc', descName)
    });
  }

  // 見送り選択肢
  options.push({
    title: '今回は模試を見送り、自習・休養に専念する',
    subtext: '体力と時間を温存し、自分のペースで苦手分野の勉強や体調管理を行います。（費用¥0 / 体力消費なし）',
    action: () => {
      playSound('click');
      showEventModal(
        '模試見送り・自習期間',
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
    `${y}年生 ${m}月 模試エントリー選択！`,
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

  let judge = 'E';
  let probText = '合格可能性 20%未満';
  if (state.targetUniv) {
    let diff = dev - targetBorder;
    if (diff >= 2.0) { judge = 'A'; probText = '合格可能性 80%以上 (安全圏)'; }
    else if (diff >= 0.0) { judge = 'B'; probText = '合格可能性 60%以上 (合格圏)'; }
    else if (diff >= -3.0) { judge = 'C'; probText = '合格可能性 40%以上 (ボーダーライン)'; }
    else if (diff >= -6.0) { judge = 'D'; probText = '合格可能性 20%以上 (努力圏)'; }
    if (judge === 'E') state.hadMockE = true;
  }

  // 大学群別の合格可能性判定（志望校未定時の到達度診断用）
  const getGroupJudge = (b) => {
    const d = generalDev - b;
    if (d >= 2.0) return 'A';
    if (d >= 0.0) return 'B';
    if (d >= -3.0) return 'C';
    if (d >= -6.0) return 'D';
    return 'E';
  };
  const judgeTop = getGroupJudge(72);   // 最難関（帝大・京洛大・国公立医進）
  const judgeHigh = getGroupJudge(64);  // 難関上位（早慶・旧帝大・上位国立）
  const judgeUpper = getGroupJudge(56); // 上位校（MARCH・関関同立・上位国公立）
  const judgeMid = getGroupJudge(48);   // 中堅校（日東駒専・産近甲龍・中堅国公立）
  if ((dev >= 70.0 || generalDev >= 70.0) && typeof unlockAchievement === 'function') unlockAchievement('dev_70');

  // 共通試験型マーク模試なら 1000点満点換算得点を算出
  let kyotsuScoreEst = Math.min(1000, Math.round((generalDev / 75) * 850 + (state.subExtraScore || 35) * 1.5 + (Math.random() - 0.5) * 20));
  let kyotsuRateEst = Math.round((kyotsuScoreEst / 1000) * 100);

  if (state.targetUniv) {
    state.history.unshift(`${state.year}年${state.month}月 ${mockTitle}: 【${judge}判定】 (傾斜偏差値 ${dev} / 総合 ${generalDev})`);
  } else {
    state.history.unshift(`${state.year}年${state.month}月 ${mockTitle}: 全国総合偏差値 ${generalDev} (上位大: ${judgeHigh}判定 / MARCH圏: ${judgeUpper}判定)`);
  }

  let traitMsg = '';
  const isHighResult = state.targetUniv ? (judge === 'A' || judge === 'B') : (judgeUpper === 'A' || judgeHigh === 'B');
  if (isHighResult && !state.traits.includes('strong_exam') && Math.random() < 0.5) {
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

  let modalDesc = '';
  let rewards = [];

  if (state.targetUniv) {
    modalDesc = `模試の成績表が返却された！\n第1志望【${state.targetUniv.name}】の判定結果は……【 ${judge} 判定 】！\n\n（体力 -${stamCost} / ストレス +8%）`;
    let rewardMoneyText = '';
    if (judge === 'A' || judge === 'B') {
      state.money = (state.money || 0) + 2000;
      rewardMoneyText = '親からの模試好成績ご褒美: +¥2,000！';
    }

    rewards = [
      `判定: 【 ${judge} 判定 】 (${probText})`,
      `志望学部 傾斜偏差値: ${dev} （目標ボーダー: ${targetBorder}）`,
      mockType === 'mark' ? `共テ1000点換算: 約 ${kyotsuScoreEst} 点 (${kyotsuRateEst}%)` : `全国総合偏差値: ${generalDev}`,
      reviewMsg,
      rewardMoneyText,
      judge === 'A' || judge === 'B' ? '好判定により やる気 絶好調！！' : 'ここからの弱点補強が合否を分ける！',
      traitMsg
    ].filter(Boolean);
  } else {
    modalDesc = `全国模試の成績表が返却された！\n志望校未定のため、全国総合偏差値と大学群別の合格到達度水準を診断！\n\n（体力 -${stamCost} / ストレス +8%）`;
    const gridHtml = `
      <div class="group-judge-grid">
        <div class="judge-badge-card">
          <div class="group-name">最難関 (帝大・京洛大・医進)</div>
          <div class="group-result">
            <span class="group-target">目標:72</span>
            <span class="rank-tag rank-${judgeTop}">${judgeTop} 判定</span>
          </div>
        </div>
        <div class="judge-badge-card">
          <div class="group-name">🏛️ 難関上位 (早慶・旧帝大)</div>
          <div class="group-result">
            <span class="group-target">目標:64</span>
            <span class="rank-tag rank-${judgeHigh}">${judgeHigh} 判定</span>
          </div>
        </div>
        <div class="judge-badge-card">
          <div class="group-name"> 上位校 (MARCH・関関同立)</div>
          <div class="group-result">
            <span class="group-target">目標:56</span>
            <span class="rank-tag rank-${judgeUpper}">${judgeUpper} 判定</span>
          </div>
        </div>
        <div class="judge-badge-card">
          <div class="group-name">🏫 中堅校 (日東駒専・中堅)</div>
          <div class="group-result">
            <span class="group-target">目標:48</span>
            <span class="rank-tag rank-${judgeMid}">${judgeMid} 判定</span>
          </div>
        </div>
      </div>
    `;
    rewards = [
      `全国総合偏差値: ${generalDev} (4教科平均学力: ${Math.round(avgAcademic)}・${getRank(avgAcademic).rank}ランク)`,
      mockType === 'mark' ? `共テ1000点換算: 約 ${kyotsuScoreEst} 点 (${kyotsuRateEst}%)` : null,
      gridHtml,
      reviewMsg,
      isHighResult ? '好成績により やる気 絶好調！！' : '日々の学習で上位大学群を目指そう！',
      traitMsg
    ].filter(Boolean);
  }

  if (isHighResult) state.motivation = 4;

  showEventModal(
    `📊 【${mockTitle}】 帳票返却！`,
    modalDesc,
    rewards,
    mockType === 'kan' ? '🏛️' : (mockType === 'desc' ? '📝' : '📊'),
    () => advanceTurn()
  );

  if (state.targetUniv) {
    setDialog('予備校アドバイザー', `現在の判定は【${judge}判定】(偏差値${dev})です。模試の復習を徹底して、目標の${state.targetUniv.name}(ボーダー${targetBorder})へ繋げましょう！`);
  } else {
    setDialog('予備校アドバイザー', `全国総合偏差値は【${generalDev}】です！難関上位大は【${judgeHigh}判定】、上位校・MARCH圏は【${judgeUpper}判定】と測定されました。この調子で基礎力を高めていきましょう！`);
  }
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
  
  let title = ' 国公立二次試験（前期日程）/ 第1志望本番！';
  let maxScore = 500;
  let maxSteps = 5;

  if (isKyotsu) {
    title = '🔥 全国統一共通試験 本番！（新課程1000点満点）';
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
  BGM.play('exam');
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
      { name: '第1問：外国語・英語（R 100点 ＋ L 100点）', subj: 'eng', max: 200, isEnglishTwo: true },
      { name: '第2問：数学（数I・A 100点 ＋ 数II・B・C 100点）', subj: 'math', max: 200, isMathTwo: true },
      { name: '第3問：国語（現代文 110点 ＋ 古文漢文 90点）', subj: 'jp', max: 200, isJpTwo: true },
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
    // 共通試験200点満点大問
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
  // 【アイテム効果】合格祈願お守り
  if (hasItem('exam_omamori')) {
    const omamoriBonus = qMax === 200 ? 4 : 2;
    gained += omamoriBonus;
    term.innerHTML += `<div class="log-line trait">⛩️【お守り】「太宰府の合格祈願お守り」のご加護！(+${omamoriBonus}点)</div>`;
  }
  // 【アイテム効果】志望校の赤本（二次試験・後期試験ボーナス +5%）
  if (!isKyotsuBattle && hasItem('book_past')) {
    const redBonus = Math.max(2, Math.round(gained * 0.05));
    gained += redBonus;
    term.innerHTML += `<div class="log-line trait">📕【赤本】「過去問の徹底研究」が的中！二次試験で加点！(+${redBonus}点)</div>`;
  }
  // 【アイテム効果】常備薬（高ストレス時の減点防護）
  if (hasItem('exam_medicine') && state.stress >= 50) {
    term.innerHTML += `<div class="log-line trait">💊【常備薬】持参した薬のおかげで緊張と腹痛を抑え、冷静さを保てた！</div>`;
  }
  // 金特「数理の閃き」「人文の閃き」: 確率クリティカル発動（基本45%・やる気連動、案A調整）
  const sparkTriggerRate = 0.45 + (state.motivation >= 4 ? 0.15 : (state.motivation === 3 ? 0.05 : (state.motivation === 1 ? -0.10 : (state.motivation === 0 ? -0.20 : 0))));

  if (state.traits.includes('math_spark') && (q.subj === 'math' || q.subj === 'sci')) {
    if (Math.random() < sparkTriggerRate) {
      const sparkBonus = Math.round(gained * 0.15) + (qMax === 200 ? 6 : 4);
      gained += sparkBonus;
      term.innerHTML += `<div class="log-line trait">✨【金特】「数理の閃き」クリティカル発動！！難問の解法を瞬時に見抜いた！(+${sparkBonus}点)</div>`;
      triggerParticles(null, null, 25, 'gold');
      triggerScreenBounce();
    }
  }
  if (state.traits.includes('humanities_spark') && (q.subj === 'jp' || q.subj === 'sci' || q.subj === 'eng')) {
    if (Math.random() < sparkTriggerRate) {
      const sparkBonus = Math.round(gained * 0.15) + (qMax === 200 ? 6 : 4);
      gained += sparkBonus;
      term.innerHTML += `<div class="log-line trait">✨【金特】「人文の閃き」クリティカル発動！！鋭い論理的直感が冴え渡った！(+${sparkBonus}点)</div>`;
      triggerParticles(null, null, 25, 'gold');
      triggerScreenBounce();
    }
  }
  if (state.traits.includes('lang_master') && (q.subj === 'eng' || q.subj === 'jp')) {
    const b = qMax === 200 ? 25 : 20;
    gained += b;
    term.innerHTML += `<div class="log-line trait">【金特】「言語の極意」が発動！！論理展開を完璧に掌握！(+${b}点)</div>`;
    triggerParticles(null, null, 20, 'gold');
    triggerScreenBounce();
  }

  const carelessRate = hasItem('gear_pencil') ? 0.15 : 0.35; // マーク専用鉛筆所持時はミス率激減
  if (state.traits.includes('careless_mistake') && Math.random() < carelessRate) {
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

  // 大問得点の2科目分割ヘルパー（絶対に各大問・科目の満点を超えないように制限）
  function splitExamScore(total, max1, max2, baseRatio = 0.5, maxDiff = 8) {
    const diff = Math.floor((Math.random() - 0.5) * 2 * maxDiff);
    let s1 = Math.round(total * baseRatio) + diff;
    const minS1 = Math.max(0, total - max2);
    const maxS1 = Math.min(max1, total);
    s1 = Math.max(minS1, Math.min(maxS1, s1));
    const s2 = total - s1;
    return [s1, s2];
  }

  term.innerHTML += `<div class="log-line great">${q.name} ▶ 【+${gained}点】獲得！（合計: ${battleState.score}点）</div>`;

  // 科目別・内訳ログ出力
  if (q.isEnglishTwo) {
    const [sR, sL] = splitExamScore(gained, 100, 100, 0.5, 6);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【リーディング】 ${sR}点 / 100点</div><div class="log-line sub-detail">　└ 【リスニング】 ${sL}点 / 100点</div>`;
  } else if (q.isMathTwo) {
    const [s1A, s2BC] = splitExamScore(gained, 100, 100, 0.5, 6);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【数学I・A】 ${s1A}点 / 100点</div><div class="log-line sub-detail">　└ 【数学II・B・C】 ${s2BC}点 / 100点</div>`;
  } else if (q.isJpTwo) {
    const [sGen, sKo] = splitExamScore(gained, 110, 90, 110 / 200, 6);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【現代文】 ${sGen}点 / 110点</div><div class="log-line sub-detail">　└ 【古文・漢文】 ${sKo}点 / 90点</div>`;
  } else if (q.isTwoSubjects) {
    const spec = state.specialtySubjects;
    const name1 = spec ? spec.sub1 : (isBunkeiBattle ? '社会第1解答科目' : '理科第1解答科目');
    const name2 = spec ? spec.sub2 : (isBunkeiBattle ? '社会第2解答科目' : '理科第2解答科目');
    const [s1, s2] = splitExamScore(gained, 100, 100, 0.5, 8);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【${name1}】 ${s1}点 / 100点</div><div class="log-line sub-detail">　└ 【${name2}】 ${s2}点 / 100点</div>`;
  } else if (q.isExtraTwo) {
    const fukuName = state.course === '文系' ? '理科基礎' : '社会';
    const [sInfo, sFuku] = splitExamScore(gained, 100, 100, 0.5, 8);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【情報I】 ${sInfo}点 / 100点</div><div class="log-line sub-detail">　└ 【${fukuName}】 ${sFuku}点 / 100点</div>`;
  } else if (q.isSecondaryTwo && state.specialtySubjects) {
    const spec = state.specialtySubjects;
    const [s1, s2] = splitExamScore(gained, 50, 50, 0.5, 4);
    term.innerHTML += `<div class="log-line sub-detail">　├ 【${spec.sub1}】 ${s1}点 / 50点</div><div class="log-line sub-detail">　└ 【${spec.sub2}】 ${s2}点 / 50点</div>`;
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
  BGM.play('daily');
  const isKyotsu = battleState.examType === 'kyotsu';
  const isSubExam = battleState.examType === 'private_sub';
  const isKouki = battleState.examType === 'kouki';

  if (isKyotsu) {
    state.kyotsuScore = battleState.score;
    state.kyotsuRate = Math.round((battleState.score / 1000) * 100);

    // 第1志望の全国共通試験リサーチ判定
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
    if (researchRank === 'E') state.hadMockE = true;
    if (state.kyotsuScore >= 900 && typeof unlockAchievement === 'function') unlockAchievement('kyotsu_900');

    // 併願校の「共通試験利用入試」判定
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
        if (typeof unlockUnivAchievement === 'function') unlockUnivAchievement(state.subUniv.id);
        subKyotsuMsg = `💮【共テ利用 合格！】${state.subUniv.name} のボーダー（${subBorderRate}%）を突破し合格確定！2月の私大個別試験は免除されます！`;
      } else {
        subKyotsuMsg = `⚠️【共テ利用 不合格】${state.subUniv.name} のボーダー（${subBorderRate}%）に及ばず。2月2週の個別入試で合格を狙おう！`;
      }
    } else {
      subKyotsuMsg = '私大併願校の出願なし（第1志望一本勝負）';
    }

    const targetLabel = target.shortName || target.name;
    const summaryRewards = [
      `共通試験得点: ${state.kyotsuScore}点 / 1000点 (得点率: ${state.kyotsuRate}%)`,
      `第1志望【${targetLabel}】: 【 ${researchRank} 判定 】(目標: ${targetBorderRate}%)`,
      `合格見込み: ${researchDesc}`,
      subKyotsuMsg
    ];

    showEventModal(
      '📝 全国統一共通試験 終了！自己採点＆利用入試結果',
      `2日間の全国統一共通試験（新課程1000点満点）を戦い抜いた！\n獲得得点: 【 ${battleState.score} / 1000 点 】(得点率: ${state.kyotsuRate}%)\n\n大手予備校の全国共通試験リサーチ結果と併願校の合否が判明した！`,
      summaryRewards,
      state.subUnivKyotsuPass ? '' : '🎯',
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
    if (passed && targetSub && typeof unlockUnivAchievement === 'function') unlockUnivAchievement(targetSub.id);

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
    if (passed && koukiUniv && typeof unlockUnivAchievement === 'function') unlockUnivAchievement(koukiUniv.id);

    if (passed) {
      playSound('fanfare');
      triggerParticles(null, null, 35, 'gold');
      showEventModal(
        `🌸 【${koukiUniv.name}】 後期日程 奇跡の逆転合格！！`,
        `掲示板の番号を見た瞬間、膝から崩れ落ちて号泣した！\n超高倍率の国公立後期日程【${koukiUniv.name}】（ボーダー偏差値 ${koukiUniv.border}）を見事に突破！\n\n獲得得点: 【 ${battleState.score} / 300 点 】\n前期不合格のどん底から不屈の闘志で奇跡の逆転合格を掴み取った！`,
        [
          `後期合否: 【 合格 [合格] 】`,
          `獲得得点: ${battleState.score}点 / 300点`,
          `算出偏差値: ${finalKoukiDev} (ボーダー: ${koukiUniv.border})`,
          '不屈の精神により 栄光の国公立進学決定！'
        ],
        '',
        () => triggerGameEnd()
      );
    } else {
      playSound('fail');
      triggerScreenShake();
      showEventModal(
        `🍂 【${koukiUniv.name}】 後期日程 不合格……`,
        `全力を尽くして解答用紙を埋めたが、超高倍率の後期日程の壁は破れなかった……。\n\n獲得得点: 【 ${battleState.score} / 300 点 】\nだが、最後の1秒まで逃げずに戦い抜いた君の勇姿は、何者にも代えがたい宝物だ！`,
        [
          `後期合否: 【 不合格 [不合格] 】`,
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
      ' 前期日程・本命入試 終了！！',
      `高校3年間のすべてをぶつけた二次試験・第1志望入試が終了した！\nすべての解答用紙を提出し終え、静かな開放感と緊張が胸を満たす。\n\n来週3月1週の運命の合格発表を待とう……！`,
      [`試験得点: ${battleState.score}点 / 500点`],
      '🌸',
      () => advanceTurn()
    );
    setDialog(state.playerName, 'やれるだけのことは全部やった…！あとは合格発表を待つのみだ！');
  }

  renderUI();
}

// クリアデータをOB名簿として保存（何人でも保存・歴代名簿へ追加）
function saveClearOB(univName) {
  try {
    const keys = ['eng', 'math', 'jp', 'sci'];
    let bestSubject = keys[0];
    keys.forEach(k => {
      if (state.subjects[k].score > state.subjects[bestSubject].score) bestSubject = k;
    });

    const list = getOBList();
    const newGen = list.length + 1;
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;

    const newOb = {
      id: Date.now(),
      generation: newGen,
      name: state.playerName || '名無しの受験生',
      univ: univName,
      year: now.getFullYear(),
      dateStr: dateStr,
      traitsCount: state.traits.length,
      traits: [...state.traits],
      bestSubject,
      bestSubjectName: getSubjectDisplayName(bestSubject),
      bestScore: state.subjects[bestSubject].score
    };

    // 最新のOBを先頭に追加（最大100人まで保存可能）
    list.unshift(newOb);
    if (list.length > 100) list.pop();

    localStorage.setItem('juken_success_ob_list', JSON.stringify(list));
    localStorage.setItem('juken_success_ob', JSON.stringify(newOb)); // 後方互換性
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
      title: ` 【${u.name}】 に進学する！`,
      subtext: `区分: ${u.type}・${u.course} | ボーダー偏差値: ${u.border}`,
      action: () => finalizeEnrollment(u, uniquePassed)
    }));

    playSound('fanfare');
    showChoiceModal(
      ' 歓喜の進路決定！進学先大学を選択しよう！',
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
  if (state.traits.includes('math_spark')) finalBonus += 1.5;
  if (state.traits.includes('humanities_spark')) finalBonus += 1.5;
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
    if (typeof onGraduateAchievementsCheck === 'function') onGraduateAchievementsCheck(enrolledUniv, allPassed, finalDev);

    if (enrolledUniv.id === target.id) {
      title = `祝！【${enrolledUniv.name}】 現役合格！！`;
      desc = `高校3年間のすべての努力が最高の結果となって結実した！\n難関【${enrolledUniv.name}】（ボーダー偏差値 ${enrolledUniv.border}）へ堂々進学決定！\n輝かしい未来のキャンパスライフが幕を開ける！`;
    } else {
      title = `🌸 【${enrolledUniv.name}】 進学決定！！`;
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

  let subStatusText = 'なし';
  if (state.subUniv) {
    if (state.subUnivKyotsuPass) {
      subStatusText = `${state.subUniv.name} (共テ利用合格 [合格])`;
    } else if (state.subUnivPassed) {
      subStatusText = `${state.subUniv.name} (一般合格 [合格])`;
    } else if (state.subExamDone) {
      subStatusText = `${state.subUniv.name} (不合格 [不合格])`;
    } else {
      subStatusText = `${state.subUniv.name} (未受験)`;
    }
  }

  let koukiStatusText = '出願なし';
  if (state.kokuritsuKouki) {
    if (state.firstChoicePassed) {
      koukiStatusText = `${state.kokuritsuKouki.name}（前期合格のため受験辞退）`;
    } else if (state.koukiExamDone) {
      koukiStatusText = `${state.kokuritsuKouki.name} (${state.kokuritsuKoukiPassed ? '合格 [合格]' : '不合格 [不合格]'})`;
    } else {
      koukiStatusText = `${state.kokuritsuKouki.name}（未受験）`;
    }
  }

  // ゲーム終了フラグ（以降はターン進行・行動を一切受け付けない）
  state.gameOver = true;
  modalQueue.length = 0;
  isModalShowing = false;
  currentModalCallback = null;

  const endText = `${desc}\n\n【最終戦績サマリー】\n受験生: ${state.playerName}\n最終進学先: ${enrolledUniv ? enrolledUniv.name : '浪人決定'}\n第1志望(前期): ${target.name} (${state.firstChoicePassed ? '合格 [合格]' : '不合格 [不合格]'})\n国公立後期: ${koukiStatusText}\n併願私大: ${subStatusText}\n共通試験得点: ${state.kyotsuScore > 0 ? `${state.kyotsuScore}点 (${state.kyotsuRate}%)` : '受験免除'}\n総合学力: ${Math.round(avgAcademic)} (${getRank(avgAcademic).rank}ランク)\n本番傾斜偏差値: ${finalDev}\n習得特能数: ${state.traits.length}個\nあおい好感度: ${state.friends.aoi.affection}%`;
  const endRewards = [
    isWin ? '★ クリアデータをOB名簿に保存しました！次周回で先輩として登場します！' : 'タイトル画面からもう一度挑戦できます！'
  ];
  state.endingData = { title, text: endText, rewards: endRewards, icon: isWin ? '' : '📚' };

  // 終了後にリロードして続きから再開されないようセーブを消去
  clearSavedGame();

  showEventModal(title, endText, endRewards, isWin ? '' : '📚');

  setDialog('担任の先生', `3年間の高校生活、本当によく頑張ったな！君のこれからの人生に大いなる幸あれ！`);
}

// 終了後に何らかの操作が行われた場合、エンディング画面を再表示する
function showGameOverAgain() {
  const d = state.endingData;
  if (d) {
    showEventModal(d.title, d.text, d.rewards, d.icon);
  } else {
    showEventModal(' 高校生活終了', '高校3年間の受験生活は終了しました。タイトル画面から新しい代を始めよう！', [], '');
  }
}

// 汎用イベントモーダル
let currentModalCallback = null;

function showEventModal(title, text, rewards = [], icon = '', onConfirm = null) {
  currentModalCallback = onConfirm;

  document.getElementById('event-modal-title').textContent = title;
  document.getElementById('event-modal-text').textContent = text;
  const eventIconEl = document.getElementById('event-modal-icon'); if (eventIconEl) eventIconEl.textContent = icon;

  const rewardsEl = document.getElementById('event-modal-rewards');
  rewardsEl.innerHTML = '';
  rewards.forEach(r => {
    const item = document.createElement('div');
    if (typeof r === 'string' && r.trim().startsWith('<')) {
      item.innerHTML = r;
    } else {
      item.textContent = `▶ ${r}`;
    }
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

function showChoiceModal(title, text, options = [], icon = '') {
  playSound('click');
  document.getElementById('choice-modal-title').textContent = title;
  document.getElementById('choice-modal-text').textContent = text;
  const choiceIconEl = document.getElementById('choice-modal-icon'); if (choiceIconEl) choiceIconEl.textContent = icon;

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

// ========================================================
// スマホ（iOS Safari / Android）対応: 堅牢なオーディオアンロック機構
// ========================================================
let isAudioUnlocked = false;

function unlockAudio() {
  if (!audioCtx) return;

  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    audioCtx.resume();
  }

  // iOS WebKit 必須: 1サンプルの無音バッファを再生してハードウェア出力をアンロック
  try {
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch (e) {}

  if (audioCtx.state === 'running') {
    isAudioUnlocked = true;
  }

  // BGMエンジンのアンロック通知（保留中のBGM開始）
  if (window.BGM && window.BGM.onAudioUnlocked) {
    window.BGM.onAudioUnlocked();
  }
}

// 画面タッチ・クリックなどあらゆる初期操作で即時アンロック
['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown', 'click'].forEach(evt => {
  window.addEventListener(evt, unlockAudio, { passive: true });
});

// スマホ画面スリープ・タブ復帰時の自動レジューム
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
      audioCtx.resume().then(() => {
        if (window.BGM && window.BGM.onAudioUnlocked) {
          window.BGM.onAudioUnlocked();
        }
      }).catch(() => {});
    }
  }
});
window.addEventListener('pageshow', () => {
  if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
    audioCtx.resume().then(() => {
      if (window.BGM && window.BGM.onAudioUnlocked) {
        window.BGM.onAudioUnlocked();
      }
    }).catch(() => {});
  }
});


// ========================================================
// 8. 実績・称号トロフィーシステム (Achievement System)
// ※ ゲーム内ボーナス・能力補正は一切行わない純粋なやりこみコレクション
// ========================================================
const ACHIEVEMENTS_KEY = 'juken_success_achievements';

const ACHIEVEMENTS_MASTER = window.ACHIEVEMENTS_MASTER = [
  // ---  大学合格実績 (16種) ---
  {
    id: 'pass_todai_med',
    name: '医学の頂',
    grade: 'platinum',
    icon: '👑',
    category: 'univ',
    desc: '帝都大学 理科三類（医学部）に現役合格する'
  },
  {
    id: 'pass_todai_sci',
    name: '赤門の覇者',
    grade: 'gold',
    icon: '🏛️',
    category: 'univ',
    desc: '帝都大学 理科一類（工・理学部）に現役合格する'
  },
  {
    id: 'pass_todai_hum',
    name: '日本の頭脳',
    grade: 'gold',
    icon: '⚖️',
    category: 'univ',
    desc: '帝都大学 文科一類・二類（法・経済）に現役合格する'
  },
  {
    id: 'pass_kyodai_eng',
    name: '自由の学風',
    grade: 'gold',
    icon: '🔬',
    category: 'univ',
    desc: '京洛大学 工学部・理学部に現役合格する'
  },
  {
    id: 'pass_kyodai_law',
    name: '知の深淵',
    grade: 'gold',
    icon: '📜',
    category: 'univ',
    desc: '京洛大学 法学部・経済学部に現役合格する'
  },
  {
    id: 'pass_waseda_pol',
    name: '雄飛の杜',
    grade: 'silver',
    icon: '🦅',
    category: 'univ',
    desc: '早稲谷大学 政治経済学部に現役合格する'
  },
  {
    id: 'pass_keio_econ',
    name: '福澤の志',
    grade: 'silver',
    icon: '🖊️',
    category: 'univ',
    desc: '慶明義塾大学 経済学部・法学部に現役合格する'
  },
  {
    id: 'pass_waseda_sci',
    name: '進取の理工',
    grade: 'silver',
    icon: '⚙️',
    category: 'univ',
    desc: '早稲谷大学 先進・創造理工学部に現役合格する'
  },
  {
    id: 'pass_meiji_law',
    name: '駿峰の砦',
    grade: 'silver',
    icon: '🏫',
    category: 'univ',
    desc: '明政大学 法学部・商学部に現役合格する'
  },
  {
    id: 'pass_aoyama_lit',
    name: '青山の風',
    grade: 'silver',
    icon: '🌿',
    category: 'univ',
    desc: '青葉学院大学 文学部・国際政経に現役合格する'
  },
  {
    id: 'pass_doshisha_sci',
    name: '同志の精神',
    grade: 'silver',
    icon: '🔔',
    category: 'univ',
    desc: '同朋社大学 理工学部に現役合格する'
  },
  {
    id: 'pass_chiiki_eng',
    name: '地域を拓く技術者',
    grade: 'bronze',
    icon: '🏗️',
    category: 'univ',
    desc: '地方拠点国立大学 工学部（加賀・吉備・武蔵等）に現役合格する'
  },
  {
    id: 'pass_chiiki_hum',
    name: '地域の支柱',
    grade: 'bronze',
    icon: '🏛️',
    category: 'univ',
    desc: '地方拠点国立大学 人文・経済学部に現役合格する'
  },
  {
    id: 'pass_nitto_kindai',
    name: '桜咲くスタート',
    grade: 'bronze',
    icon: '🌸',
    category: 'univ',
    desc: '日東大学・東亜大学 または 浪速大学・東亜大学に合格する'
  },
  {
    id: 'pass_nankan_kouki',
    name: '不屈のラストチャンス',
    grade: 'gold',
    icon: '🔥',
    category: 'univ',
    desc: '難関国公立大学 後期日程（帝都科学大・一ノ橋大・港都大等）に合格する'
  },
  {
    id: 'pass_chiiki_kouki',
    name: '粘りの栄冠',
    grade: 'silver',
    icon: '💮',
    category: 'univ',
    desc: '地方拠点国立大学 後期日程（理工・人文社会）に合格する'
  },

  // --- 📖 学力・試験実績 (7種) ---
  {
    id: 'dev_70',
    name: '神童の領域',
    grade: 'gold',
    icon: '⚡',
    category: 'study',
    desc: 'いずれかの教科・模試・最終成績で偏差値70.0以上を記録する'
  },
  {
    id: 'math_rank_s',
    name: '数学の魔術師',
    grade: 'silver',
    icon: '📐',
    category: 'study',
    desc: '数学の学力ランクS（スコア90以上）に到達する'
  },
  {
    id: 'eng_rank_s',
    name: 'マルチリンガル',
    grade: 'silver',
    icon: '🔤',
    category: 'study',
    desc: '英語の学力ランクS（スコア90以上）に到達する'
  },
  {
    id: 'all_rank_a',
    name: '全方位の秀才',
    grade: 'gold',
    icon: '🌟',
    category: 'study',
    desc: '主要4教科すべて学力ランクA（スコア80以上）に到達する'
  },
  {
    id: 'sub_extra_max',
    name: '新課程の申し子',
    grade: 'silver',
    icon: '💻',
    category: 'study',
    desc: '「情報I・副教科」共テ対策度を90点以上に高める'
  },
  {
    id: 'kyotsu_900',
    name: '共通試験マスター',
    grade: 'gold',
    icon: '🎯',
    category: 'study',
    desc: '全国統一共通試験本番（1000点満点）で900点以上を獲得する'
  },
  {
    id: 'miracle_comeback',
    name: '大逆転の奇跡',
    grade: 'gold',
    icon: '🌈',
    category: 'study',
    desc: '模試または共通試験リサーチでE判定だった第1志望大学に本番合格する'
  },

  // --- 🏫 生活・マネジメント・やりこみ実績 (7種) ---
  {
    id: 'no_fail_study',
    name: '皆勤・健康優良児',
    grade: 'silver',
    icon: '💪',
    category: 'life',
    desc: '3年間一度も勉強失敗（寝落ち・サボり）を起こさずに大学合格する'
  },
  {
    id: 'no_max_stress',
    name: '鉄の精神力',
    grade: 'silver',
    icon: '🛡️',
    category: 'life',
    desc: '3年間一度もストレス100%にならずに大学合格する'
  },
  {
    id: 'rich_student',
    name: 'マネーの達人',
    grade: 'bronze',
    icon: '💰',
    category: 'life',
    desc: 'お小遣いをやりくりし、所持金 ¥10,000 以上を達成する'
  },
  {
    id: 'all_books',
    name: '博覧強記の読書家',
    grade: 'silver',
    icon: '📚',
    category: 'life',
    desc: '購買部の「参考書」全5冊をコンプリート所持する'
  },
  {
    id: 'rival_bond',
    name: '青春の絆',
    grade: 'silver',
    icon: '🤝',
    category: 'life',
    desc: '幼馴染「あおい」またはライバル「神童くん」の好感度・友好度を100%にする'
  },
  {
    id: 'ob_10',
    name: '名門校の礎',
    grade: 'gold',
    icon: '👨‍',
    category: 'life',
    desc: '歴代OB名簿に合格者を累計10名以上登録する'
  },
  {
    id: 'complete_all',
    name: '完全無欠の受験生',
    grade: 'platinum',
    icon: '🏆',
    category: 'life',
    desc: 'すべての実績（全30種）を完全コンプリート解除する'
  }
];

const UNIV_TO_ACHIEVEMENT_MAP = {
  todai_med: 'pass_todai_med',
  todai_sci: 'pass_todai_sci',
  todai_hum: 'pass_todai_hum',
  kyodai_eng: 'pass_kyodai_eng',
  kyodai_law: 'pass_kyodai_law',
  waseda_pol: 'pass_waseda_pol',
  keio_econ: 'pass_keio_econ',
  waseda_sci: 'pass_waseda_sci',
  meiji_law: 'pass_meiji_law',
  aoyama_lit: 'pass_aoyama_lit',
  doshisha_sci: 'pass_doshisha_sci',
  chiiki_eng: 'pass_chiiki_eng',
  chiiki_hum: 'pass_chiiki_hum',
  nichidai_hum: 'pass_nitto_kindai',
  kindai_sci: 'pass_nitto_kindai',
  nankan_kouki_sci: 'pass_nankan_kouki',
  nankan_kouki_hum: 'pass_nankan_kouki',
  chiiki_eng_kouki: 'pass_chiiki_kouki',
  chiiki_hum_kouki: 'pass_chiiki_kouki'
};

const GRADE_META = {
  platinum: { label: 'PLATINUM', icon: '👑' },
  gold:     { label: 'GOLD', icon: '🥇' },
  silver:   { label: 'SILVER', icon: '🥈' },
  bronze:   { label: 'BRONZE', icon: '🥉' }
};

function getAchievementsData() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Failed to load achievements:', e);
  }
  return {};
}

function saveAchievementsData(data) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save achievements:', e);
  }
}

let currentAchFilter = 'all';
const achToastQueue = [];
let activeToastCount = 0;

function showAchievementToast(ach) {
  achToastQueue.push(ach);
  processAchievementToastQueue();
}

function processAchievementToastQueue() {
  if (activeToastCount >= 2 || achToastQueue.length === 0) return;
  const container = document.getElementById('achievement-toast-container');
  if (!container) return;

  const ach = achToastQueue.shift();
  activeToastCount++;

  playSound('trophy');
  triggerParticles(null, null, 20, 'gold');

  const gMeta = GRADE_META[ach.grade] || GRADE_META.bronze;
  const toast = document.createElement('div');
  toast.className = `achievement-toast grade-${ach.grade}`;
  toast.innerHTML = `
    <div class="ach-toast-icon">${ach.icon}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-label">実績解除！ [${gMeta.label}]</div>
      <div class="ach-toast-title">${ach.name}</div>
      <div class="ach-toast-desc">${ach.desc}</div>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      activeToastCount = Math.max(0, activeToastCount - 1);
      processAchievementToastQueue();
    }, 360);
  }, 3400);
}

function unlockAchievement(achId, silent = false) {
  const ach = ACHIEVEMENTS_MASTER.find(a => a.id === achId);
  if (!ach) return false;

  const data = getAchievementsData();
  if (data[achId]) return false; // すでに解除済み

  const now = new Date();
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  data[achId] = { unlockedAt: dateStr };
  saveAchievementsData(data);

  if (!silent) {
    showAchievementToast(ach);
  }

  // 全29種達成時のプラチナ実績「完全無欠の受験生」自動判定
  if (achId !== 'complete_all') {
    const nonPlatinumAll = ACHIEVEMENTS_MASTER.filter(a => a.id !== 'complete_all');
    const allUnlocked = nonPlatinumAll.every(a => !!data[a.id]);
    if (allUnlocked && !data['complete_all']) {
      unlockAchievement('complete_all', silent);
    }
  }

  updateTitleAchievementBadge();
  const modal = document.getElementById('achievements-modal');
  if (modal && modal.classList.contains('active')) {
    renderAchievementsModal();
  }
  return true;
}

function unlockUnivAchievement(univId, silent = false) {
  if (!univId) return;
  const achId = UNIV_TO_ACHIEVEMENT_MAP[univId];
  if (achId) {
    unlockAchievement(achId, silent);
  }
}

function checkAchievements() {
  if (!state) return;

  // 1. 学力・偏差値系
  if (state.subjects) {
    if (state.subjects.math && state.subjects.math.score >= 90) {
      unlockAchievement('math_rank_s');
    }
    if (state.subjects.eng && state.subjects.eng.score >= 90) {
      unlockAchievement('eng_rank_s');
    }
    const subKeys = ['eng', 'math', 'jp', 'sci'];
    if (subKeys.every(k => state.subjects[k] && state.subjects[k].score >= 80)) {
      unlockAchievement('all_rank_a');
    }
    if (subKeys.some(k => state.subjects[k] && calcDeviation(state.subjects[k].score) >= 70.0)) {
      unlockAchievement('dev_70');
    }
  }

  // 2. 情報I・副教科対策
  if ((state.subExtraScore || 35) >= 90) {
    unlockAchievement('sub_extra_max');
  }

  // 3. 共通試験900点
  if ((state.kyotsuScore || 0) >= 900) {
    unlockAchievement('kyotsu_900');
  }

  // 4. 所持金 ¥10,000
  if ((state.money || 0) >= 10000) {
    unlockAchievement('rich_student');
  }

  // 5. 参考書全5冊コンプリート
  const bookIds = ['book_eng', 'book_math', 'book_jp', 'book_sci', 'book_past'];
  if (bookIds.every(id => hasItem(id))) {
    unlockAchievement('all_books');
  }

  // 6. 交友度100%
  if (state.friends) {
    const aoiAff = state.friends.aoi ? state.friends.aoi.affection : 0;
    const shindoAff = state.friends.shindo ? state.friends.shindo.affection : 0;
    if (aoiAff >= 100 || shindoAff >= 100) {
      unlockAchievement('rival_bond');
    }
  }

  // 7. OB名簿10名
  const obList = getOBList();
  if (obList && obList.length >= 10) {
    unlockAchievement('ob_10');
  }
}

function onGraduateAchievementsCheck(enrolledUniv, allPassed, finalDev) {
  if (finalDev >= 70.0) {
    unlockAchievement('dev_70');
  }
  if (enrolledUniv) {
    unlockUnivAchievement(enrolledUniv.id);
    if (Array.isArray(allPassed)) {
      allPassed.forEach(u => {
        if (u && u.id) unlockUnivAchievement(u.id);
      });
    }
    if (!state.hadStudyFail) {
      unlockAchievement('no_fail_study');
    }
    if (!state.hadMaxStress) {
      unlockAchievement('no_max_stress');
    }
    if (state.hadMockE && state.firstChoicePassed) {
      unlockAchievement('miracle_comeback');
    }
  }
  checkAchievements();
}

const OLD_TO_NEW_UNIV_ID_MAP = {
  '東京大学 理科一類（工・理学部）': 'todai_sci',
  '東大 理一': 'todai_sci',
  '東京大学 理科三類（医学部）': 'todai_med',
  '東大 理三(医)': 'todai_med',
  '東京大学 文科一類・二類（法・経済）': 'todai_hum',
  '東大 文科(法経)': 'todai_hum',
  '京都大学 工学部・理学部': 'kyodai_eng',
  '京大 工・理': 'kyodai_eng',
  '京都大学 法学部・経済学部': 'kyodai_law',
  '京大 法・経': 'kyodai_law',
  '早稲田大学 政治経済学部': 'waseda_pol',
  '早稲田 政経': 'waseda_pol',
  '慶應義塾大学 経済学部・法学部': 'keio_econ',
  '慶應 経・法': 'keio_econ',
  '早稲田大学 先進・創造理工学部': 'waseda_sci',
  '早稲田 理工': 'waseda_sci',
  '明治大学 法学部・商学部': 'meiji_law',
  '明治 法・商': 'meiji_law',
  '青山学院大学 文学部・国際政経': 'aoyama_lit',
  '青学 文・国政': 'aoyama_lit',
  '同志社大学 理工学部': 'doshisha_sci',
  '同志社 理工': 'doshisha_sci',
  '地方国立大学 工学部（金沢・岡山・埼玉等）': 'chiiki_eng',
  '地方国立 工学': 'chiiki_eng',
  '地方国立大学 人文・経済学部': 'chiiki_hum',
  '地方国立 文・経': 'chiiki_hum',
  '日本大学・東洋大学 文系学部': 'nichidai_hum',
  '日東駒専 文系': 'nichidai_hum',
  '近畿大学・東洋大学 理工学部': 'kindai_sci',
  '産近甲龍 理工': 'kindai_sci'
};

function syncExistingOBToAchievements() {
  try {
    const obList = getOBList();
    if (!obList || obList.length === 0) return;
    obList.forEach(ob => {
      if (!ob.univ) return;
      const matched = UNIV_LIST.find(u => u.name === ob.univ || u.shortName === ob.univ);
      if (matched) {
        unlockUnivAchievement(matched.id, true);
      } else if (OLD_TO_NEW_UNIV_ID_MAP[ob.univ]) {
        unlockUnivAchievement(OLD_TO_NEW_UNIV_ID_MAP[ob.univ], true);
      }
    });
    if (obList.length >= 10) {
      unlockAchievement('ob_10', true);
    }
  } catch (e) {}
}

function updateTitleAchievementBadge() {
  const badge = document.getElementById('title-ach-badge');
  if (!badge) return;
  const data = getAchievementsData();
  const count = ACHIEVEMENTS_MASTER.filter(a => !!data[a.id]).length;
  badge.textContent = `${count}/${ACHIEVEMENTS_MASTER.length}`;
}

function openAchievementsModal() {
  playSound('click');
  syncExistingOBToAchievements();
  if (state && state.inGame) {
    checkAchievements();
  }
  renderAchievementsModal();
  const modal = document.getElementById('achievements-modal');
  if (modal) modal.classList.add('active');
}

function closeAchievementsModal() {
  playSound('click');
  const modal = document.getElementById('achievements-modal');
  if (modal) modal.classList.remove('active');
}

function filterAchievementsCategory(cat) {
  playSound('click');
  currentAchFilter = cat;
  ['all', 'univ', 'study', 'life'].forEach(c => {
    const btn = document.getElementById(`ach-filter-${c}`);
    if (btn) btn.classList.toggle('active', c === cat);
  });
  renderAchievementsModal();
}

function renderAchievementsModal() {
  const data = getAchievementsData();
  const total = ACHIEVEMENTS_MASTER.length;
  const unlockedList = ACHIEVEMENTS_MASTER.filter(a => !!data[a.id]);
  const unlockedCount = unlockedList.length;
  const percent = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const countTextEl = document.getElementById('ach-count-text');
  if (countTextEl) countTextEl.textContent = `${unlockedCount} / ${total} (${percent}%)`;

  const barEl = document.getElementById('ach-progress-bar');
  if (barEl) barEl.style.width = `${percent}%`;

  const grades = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  unlockedList.forEach(a => {
    if (grades[a.grade] !== undefined) grades[a.grade]++;
  });
  const gradeCountsEl = document.getElementById('ach-grade-counts');
  if (gradeCountsEl) {
    gradeCountsEl.innerHTML = `
      <span class="ach-pill grade-plat">PLATINUM ${grades.platinum}</span>
      <span class="ach-pill grade-gold">GOLD ${grades.gold}</span>
      <span class="ach-pill grade-silver">SILVER ${grades.silver}</span>
      <span class="ach-pill grade-bronze">BRONZE ${grades.bronze}</span>
    `;
  }

  const listEl = document.getElementById('achievements-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const filtered = currentAchFilter === 'all'
    ? ACHIEVEMENTS_MASTER
    : ACHIEVEMENTS_MASTER.filter(a => a.category === currentAchFilter);

  filtered.forEach(ach => {
    const unlockInfo = data[ach.id];
    const isUnlocked = !!unlockInfo;
    const gMeta = GRADE_META[ach.grade] || GRADE_META.bronze;

    const card = document.createElement('div');
    card.className = `ach-card ${isUnlocked ? 'unlocked' : 'locked'} grade-${ach.grade}`;
    card.innerHTML = `
      <div class="ach-icon-box ${ach.grade} ${isUnlocked ? 'unlocked' : 'locked'}">${isUnlocked ? ach.grade.toUpperCase().slice(0, 4) : 'LOCK'}</div>
      <div class="ach-info">
        <div class="ach-title-row">
          <div class="ach-title-left">
            <span class="ach-name">${ach.name}</span>
            <span class="ach-grade-badge ${ach.grade}">${gMeta.label}</span>
          </div>
          <span class="ach-status-tag ${isUnlocked ? 'unlocked' : 'locked'}">
            ${isUnlocked ? `✓ ${unlockInfo.unlockedAt}` : '未解除'}
          </span>
        </div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
    `;
    listEl.appendChild(card);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  syncExistingOBToAchievements();
  updateTitleAchievementBadge();
});
