// ゼンマイの塔: 画面に描く・操作を受け取る・音を鳴らす・続きを保存する・記録と称号・幽霊・ランキング
(function () {
  'use strict';

  const C = window.ZenmaiCore;
  const { DT, P, TILE, LOG } = C;
  // 17階になって階の並びが変わったので、10階のころの保存（-v1）は読まない
  const SAVE_KEY = 'zenmai-tower-v2';
  const SOUND_KEY = 'zenmai-tower-sound';
  const MUSIC_KEY = 'zenmai-tower-music';
  const CLEAR_KEY = 'zenmai-tower-cleared';
  const GHOST_KEY = 'zenmai-tower-ghost';
  const GHOST_LOG = 'zenmai-tower-ghost-';
  const REC_KEY = 'zenmai-tower-records';
  const PID_KEY = 'zenmai-tower-pid';
  const NAME_KEY = 'zenmai-tower-name';
  const UNSENT_KEY = 'zenmai-tower-unsent';
  // ランキングのサーバー（Cloudflare Workers）の場所。公開したら RANK_SERVER に https://…workers.dev を書く。空のあいだは「準備中」と出す。
  // 試験用に URL の ?api= で差し替えられるのは、このパソコンの中のサーバー（127.0.0.1・localhost）だけ（よそのサーバーへ名前を送らせないため）
  const RANK_SERVER = '';
  const RANK_API = (() => {
    const a = new URLSearchParams(location.search).get('api') || '';
    return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(a) ? a : RANK_SERVER;
  })();

  const level = C.buildLevel(window.ZENMAI_LEVEL);
  const RULES = C.rulesId(window.ZENMAI_LEVEL);
  const sim = new C.Sim(level);

  const art = window.ZenmaiArt.create(document.getElementById('game'), level, sim);

  const el = (id) => document.getElementById(id);
  const hud = { area: el('hud-area'), wind: el('hud-wind'), time: el('hud-time'), winds: el('hud-winds'), jumps: el('hud-jumps'), falls: el('hud-falls') };
  const banner = el('banner');
  const toastEl = el('toast');
  const menu = el('menu');
  const devPanel = el('dev');
  const ending = el('ending');
  const rankPanel = el('rank');
  const recPanel = el('records');

  // ---------- 保存の道具（保存できないブラウザでも止まらない） ----------
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
        return true;
      } catch (e) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    },
  };
  function getJSON(k) {
    try {
      const s = store.get(k);
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- 保存 ----------
  // 読めない・置けない保存は「保存なし」として扱う
  function readSave() {
    const o = getJSON(SAVE_KEY);
    if (!o) return null;
    try {
      return new C.Sim(level).loadData(o) ? o : null;
    } catch (e) {
      return null;
    }
  }
  // 開発者モードの間は、ふだんの記録に書かない
  function writeSave() {
    if (!started || dev) return;
    try {
      const data = sim.restingData();
      if (!data) return;
      if (runLog) {
        data.log = runLog;
        data.logLast = logLast;
      }
      store.set(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function clearSave() {
    store.del(SAVE_KEY);
  }
  function isCleared() {
    return store.get(CLEAR_KEY) === '1';
  }

  // ---------- 挑戦の記録（ランキングの確かめと幽霊に使う） ----------
  // 1階から始めた挑戦だけを記録する。記録の無い古い保存から続けた挑戦は runLog = null（ランキングに送れない）
  let runLog = null;
  // runLog が null のとき、ゴールの画面に出す送れない理由（続けた時点で決める）
  let noLogWhy = 'この挑戦は、記録の仕組みができる前の保存から続けたので送れません';
  let logLast = 0;
  let logBits = 0;
  function newLog() {
    runLog = { rules: RULES, hard: sim.hard, flip: sim.beltFlip, ev: [] };
    logLast = 0;
    logBits = 0;
  }
  function logPush(code) {
    if (!runLog || dev || runLog.over) return;
    if (sim.stats.steps >= LOG.MAX_STEPS) {
      runLog.over = true;
      return;
    }
    runLog.ev.push(sim.stats.steps - logLast, code);
    logLast = sim.stats.steps;
  }
  function logInput() {
    const bits = (input.left ? 1 : 0) | (input.right ? 2 : 0) | (input.button ? 4 : 0);
    if (bits !== logBits) {
      logBits = bits;
      logPush(bits);
    }
  }
  const rankable = (lg) => !!lg && lg.rules === RULES && !lg.over && Array.isArray(lg.ev);

  // ---------- 本物の時報: 毎正時から10秒間、ベルトが逆に回る ----------
  // （1時間ずっと逆だと、ベルトの階が登れなくなるので、短い出来事にした。待てばやり過ごせる）
  const hourFlip = () => {
    const d = new Date();
    return d.getMinutes() === 0 && d.getSeconds() < 10;
  };
  function checkHour() {
    const f = hourFlip();
    if (f === sim.beltFlip) return;
    sim.beltFlip = f;
    logPush(f ? LOG.FLIP_ON : LOG.FLIP_OFF);
    if (!f) return;
    const h = new Date().getHours();
    chime(h % 12 || 12);
    toast(`時報 ${h}時。10秒間、歯車のベルトが逆に回る`);
  }

  // ---------- 音 ----------
  let soundOn = store.get(SOUND_KEY) !== 'off';
  let musicOn = store.get(MUSIC_KEY) !== 'off';
  let ac = null;
  function ctxGet() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    return ac;
  }
  function audio() {
    return soundOn ? ctxGet() : null;
  }
  const music = window.ZenmaiMusic.create(ctxGet);
  music.setEnabled(musicOn);
  window.addEventListener('pointerdown', () => ctxGet(), { passive: true });
  function tone(type, f1, f2, dur, vol, delay = 0) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, delay = 0, type = 'lowpass') {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(a.currentTime + delay);
  }
  function bell(delay = 0, vol = 1) {
    [1, 2, 2.76, 5.4].forEach((m, i) => tone('sine', 330 * m, 330 * m, 3.2 - i * 0.5, (0.18 * vol) / (i + 1), delay));
  }
  function chime(n) {
    for (let i = 0; i < n; i++) bell(i * 0.8, 0.5);
  }
  const sounds = {
    click: () => tone('square', 1500 + sim.d.wind * 40, 1500 + sim.d.wind * 40, 0.025, 0.05),
    release: () => tone('sawtooth', 220, 160, 0.08, 0.04),
    step: () => tone('triangle', 520, 420, 0.03, 0.06),
    jump: () => tone('square', 280, 760, 0.13, 0.06),
    land: () => noise(0.06, 0.25, 900),
    bonk: () => tone('square', 200, 150, 0.06, 0.06),
    turn: () => tone('square', 260, 200, 0.05, 0.04),
    stop: () => tone('triangle', 300, 200, 0.06, 0.05),
    unwind: () => tone('sawtooth', 900, 120, 0.4, 0.05),
    splat: () => {
      noise(0.3, 0.5, 500);
      tone('sine', 110, 50, 0.3, 0.25);
      tone('square', 1800, 1800, 0.03, 0.03, 0.12);
      tone('square', 1500, 1500, 0.03, 0.03, 0.2);
    },
    sting: () => {
      noise(0.15, 0.4, 1400);
      tone('sawtooth', 320, 110, 0.25, 0.07);
    },
    buzz: () => {
      for (let i = 0; i < 3; i++) tone('sawtooth', 240, 280, 0.08, 0.035, i * 0.12);
    },
    guard: () => {
      tone('square', 1900, 1900, 0.04, 0.04);
      tone('sine', 2600, 2200, 0.18, 0.06, 0.02);
    },
    hiss: () => noise(0.7, 0.12, 3000, 0, 'highpass'),
    steam: () => noise(0.5, 0.3, 1800, 0, 'bandpass'),
    launch: () => {
      noise(0.35, 0.35, 1200, 0, 'bandpass');
      tone('square', 300, 900, 0.2, 0.05);
    },
    creak: () => {
      tone('sawtooth', 140, 110, 0.35, 0.05);
      tone('sawtooth', 180, 130, 0.3, 0.03, 0.5);
      tone('sawtooth', 160, 100, 0.3, 0.04, 1.0);
    },
    crumble: () => {
      noise(0.5, 0.45, 600);
      tone('square', 120, 60, 0.3, 0.06);
    },
    cuckoo: () => {
      tone('sine', 784, 784, 0.22, 0.12);
      tone('sine', 659, 659, 0.3, 0.12, 0.28);
    },
    peck: () => {
      tone('square', 900, 600, 0.05, 0.06);
      noise(0.08, 0.3, 2000);
    },
    gust: () => noise(1.2, 0.12, 700, 0, 'bandpass'),
    thunder: () => {
      noise(1.6, 0.5, 300);
      noise(0.2, 0.3, 4000, 0, 'highpass');
    },
    bell,
  };

  // ---------- 操作 ----------
  const input = { left: false, right: false, button: false };
  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'button', ArrowUp: 'button', KeyW: 'button', KeyZ: 'button', KeyX: 'button',
  };
  window.addEventListener('keydown', (e) => {
    // 名前を打っている間は、ゲームの操作にしない
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = keyMap[e.code];
    if (e.code === 'Escape') {
      if (state === 'play') openMenu();
      else if ((state === 'menu' && started) || state === 'dev') closeMenu();
      else if (state === 'rank' || state === 'records') backFromPanel();
      return;
    }
    // 開発者モード: 数字キーでその階へ（1〜9、0 は10階。Shift を押しながら 1〜7 で11〜17階）
    const m = /^Digit(\d)$/.exec(e.code);
    if (m && dev && state === 'play') {
      const f = (m[1] === '0' ? 10 : Number(m[1])) + (e.shiftKey && m[1] !== '0' ? 10 : 0);
      if (f <= level.screenCount) warp(level.screenCount - f);
      return;
    }
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    ctxGet();
    input[k] = true;
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    input[k] = false;
  });
  window.addEventListener('blur', () => {
    input.left = input.right = input.button = false;
  });
  document.querySelectorAll('[data-pad]').forEach((b) => {
    const k = b.dataset.pad;
    const on = (e) => {
      e.preventDefault();
      ctxGet();
      input[k] = true;
      b.classList.add('on');
      if (b.setPointerCapture && e.pointerId !== undefined) b.setPointerCapture(e.pointerId);
    };
    const off = (e) => {
      e.preventDefault();
      input[k] = false;
      b.classList.remove('on');
    };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---------- 記録と称号 ----------
  // 1階ぶん（320px）を4mとして数える
  const PX_PER_M = 80;
  const rec = Object.assign({ clears: 0, clearsHard: 0, falls: 0, totalDrop: 0, maxDrop: 0, maxDropFloors: 0, fullDrop: 0, best: {}, titles: {} }, getJSON(REC_KEY) || {});
  const saveRec = () => store.set(REC_KEY, JSON.stringify(rec));
  let seenDrop = 0;
  // test(記録, 今の挑戦, 鐘を鳴らしたか)
  const TITLES = [
    { id: 'fall1', name: 'はじめての転落', desc: '倒れるほど高く落ちた', test: (r) => r.falls >= 1 },
    { id: 'floor1', name: 'ひと階ぶんの転落', desc: '1回で1階ぶん以上落ちた', test: (r) => r.maxDropFloors >= 1 },
    { id: 'floor3', name: '三階ぶんの転落', desc: '1回で3階ぶん以上落ちた', test: (r) => r.maxDropFloors >= 3 },
    { id: 'floor6', name: '奈落の人形', desc: '1回で6階ぶん以上落ちた', test: (r) => r.maxDropFloors >= 6 },
    { id: 'full', name: '鐘楼から1階まで', desc: 'いちばん上の鐘楼から、1回で1階まで落ちた', test: (r) => r.fullDrop >= 1 },
    { id: 'm100', name: '百メートル落ちた人形', desc: '落ちた高さの合計が100m', test: (r) => r.totalDrop >= 100 * PX_PER_M },
    { id: 'km1', name: '一キロ落ちた人形', desc: '落ちた高さの合計が1km', test: (r) => r.totalDrop >= 1000 * PX_PER_M },
    { id: 'f100', name: '百転び', desc: '倒れた回数の合計が100回', test: (r) => r.falls >= 100 },
    { id: 'clear', name: '鐘を鳴らした', desc: '鐘楼の鐘を鳴らした', test: (r) => r.clears >= 1 },
    { id: 'nofall', name: '一度も倒れず', desc: '一度も倒れずに鐘を鳴らした', test: (r, s, fin) => fin && s.falls === 0 },
    { id: 'nosting', name: '刺されなかった', desc: 'ハチに一度も刺されずに鐘を鳴らした', test: (r, s, fin) => fin && s.stings === 0 },
    { id: 'fast20', name: '早巻き', desc: '20分以内に鐘を鳴らした', test: (r, s, fin) => fin && s.steps <= 20 * 60 * 120 },
    { id: 'fast10', name: '疾風のゼンマイ', desc: '10分以内に鐘を鳴らした', test: (r, s, fin) => fin && s.steps <= 10 * 60 * 120 },
    { id: 'thrift', name: '倹約家', desc: 'ねじ巻き合計2500回以下で鐘を鳴らした', test: (r, s, fin) => fin && s.winds <= 2500 },
    { id: 'hard', name: 'むずかしい塔 制覇', desc: 'むずかしい塔の鐘を鳴らした', test: (r) => r.clearsHard >= 1 },
  ];
  function checkTitles(fin) {
    const got = [];
    for (const t of TITLES) {
      if (rec.titles[t.id] || !t.test(rec, sim.stats, fin)) continue;
      rec.titles[t.id] = Date.now();
      got.push(t);
    }
    if (got.length) {
      saveRec();
      toast(`称号「${got.map((t) => t.name).join('」「')}」を手に入れた`);
    }
    return got;
  }
  function onSplat() {
    if (dev) return;
    const st = sim.stats;
    rec.falls++;
    rec.totalDrop += Math.max(0, st.totalDrop - seenDrop);
    seenDrop = st.totalDrop;
    rec.maxDrop = Math.max(rec.maxDrop, st.maxDrop);
    rec.maxDropFloors = Math.max(rec.maxDropFloors, st.maxDropFloors);
    if (st.fullDrop) rec.fullDrop = 1;
    saveRec();
    checkTitles(false);
  }
  const meters = (px) => `${(px / PX_PER_M).toFixed(1)}m`;

  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // ---------- 幽霊（前の自分・自己ベスト・ランキングの人の動き） ----------
  const GHOST_MODES = ['off', 'prev', 'best', 'rank'];
  const GHOST_NAMES = { off: 'なし', prev: '前回', best: 'ベスト', rank: '上位' };
  let ghostMode = GHOST_MODES.includes(store.get(GHOST_KEY)) ? store.get(GHOST_KEY) : 'off';
  let ghostRep = null;
  function ghostLog() {
    if (ghostMode === 'off') return null;
    const key = ghostMode === 'best' ? `best-${sim.hard ? 1 : 0}` : ghostMode;
    const lg = getJSON(GHOST_LOG + key);
    return lg && lg.rules === RULES && !!lg.hard === sim.hard ? lg : null;
  }
  function setupGhost() {
    ghostRep = null;
    const lg = dev ? null : ghostLog();
    if (lg) {
      ghostRep = new C.Replayer(level, lg);
      ghostRep.run(Infinity, sim.stats.steps);
      if (ghostRep.error) ghostRep = null;
    }
    art.setGhost(ghostRep ? ghostRep.sim : null);
  }
  function stepGhost() {
    if (!ghostRep) return;
    ghostRep.run(Infinity, sim.stats.steps);
    if (ghostRep.error) {
      ghostRep = null;
      art.setGhost(null);
    }
  }
  function keepGhost(key, lg) {
    if (lg && lg.ev.length) store.set(GHOST_LOG + key, JSON.stringify(lg));
  }

  // ---------- メニュー ----------
  let state = 'menu';
  let started = false;
  let dev = false;
  // 人に遊んでもらう公開ページ（github.io）では、URL に ?dev を付けたときだけ開発者ボタンを出す
  const devAllowed = !/\.github\.io$/.test(location.hostname) || new URLSearchParams(location.search).has('dev');
  function refreshMenu() {
    const save = readSave();
    const going = started || !!save;
    el('btn-continue').hidden = !going;
    el('btn-continue').classList.toggle('primary', going);
    el('btn-new').classList.toggle('primary', !going);
    el('btn-continue').textContent = started ? 'もどる' : 'つづきから';
    el('btn-new').textContent = going ? '最初から' : 'はじめる';
    el('btn-new').hidden = dev;
    el('btn-hard').textContent = going ? 'むずかしい塔で最初から' : 'むずかしい塔ではじめる';
    el('btn-hard').hidden = dev || !isCleared();
    el('btn-sound').textContent = `効果音 ${soundOn ? 'あり' : 'なし'}`;
    el('btn-music').textContent = `音楽 ${musicOn ? 'あり' : 'なし'}`;
    el('btn-ghost').textContent = `幽霊 ${GHOST_NAMES[ghostMode]}`;
    el('btn-warp').hidden = !dev;
    el('btn-dev').hidden = !devAllowed;
  }
  function openMenu() {
    state = 'menu';
    music.setLevel(0.45);
    confirmUntil = 0;
    input.left = input.right = input.button = false;
    writeSave();
    refreshMenu();
    devPanel.hidden = true;
    rankPanel.hidden = true;
    recPanel.hidden = true;
    menu.hidden = false;
  }
  function closeMenu() {
    music.setLevel(1);
    confirmUntil = 0;
    menu.hidden = true;
    devPanel.hidden = true;
    rankPanel.hidden = true;
    recPanel.hidden = true;
    state = 'play';
    lastT = null;
    showBanner();
  }
  // 保存から続ける（新しいページで開き直したのと同じ扱い。記録には「置き直した」と、そのときのベルトの向きを残す）
  // 開き直しの印は保存した時点の手（save.at）に置き、次の手は止まる所まで進んだ後の手数から数える（Replayer と同じ）
  function resumeFrom(save) {
    sim.loadData(save);
    const lg = save.log;
    // 保存を書きかえてあって決まりの値で読んだときは、記録の再生と合わなくなるので、ゴールしてから断られる前に送れない扱いにする
    if (sim.loadExact && rankable(lg) && Number.isInteger(save.logLast) && Number.isInteger(save.at) && save.at >= save.logLast && lg.hard === sim.hard) {
      runLog = lg;
      logBits = 0;
      if (save.at >= LOG.MAX_STEPS) runLog.over = true;
      else runLog.ev.push(save.at - save.logLast, LOG.RESUME);
      logLast = sim.stats.steps;
    } else {
      runLog = null;
      noLogWhy = !lg || !Array.isArray(lg.ev) ? 'この挑戦は、記録の仕組みができる前の保存から続けたので送れません'
        : lg.rules !== RULES ? 'ゲームが新しくなる前に始めた挑戦なので送れません'
        : lg.over ? '3時間を超えた挑戦は送れません'
        : 'この挑戦は、書きかえられた保存から続けたので送れません';
    }
    sim.beltFlip = hourFlip();
    logPush(sim.beltFlip ? LOG.FLIP_ON : LOG.FLIP_OFF);
    seenDrop = sim.stats.totalDrop;
    setupGhost();
  }
  el('btn-continue').addEventListener('click', () => {
    if (!started) {
      const save = readSave();
      if (save) resumeFrom(save);
      started = true;
    }
    closeMenu();
  });
  function startRun(hard) {
    // やめた挑戦も「前回」の幽霊として残す
    if (runLog && !dev && runLog.ev.length >= 8) keepGhost('prev', runLog);
    clearSave();
    sim.hard = hard;
    sim.reset();
    sim.beltFlip = hourFlip();
    newLog();
    seenDrop = 0;
    art.reset();
    started = true;
    shownScreen = -1;
    setupGhost();
  }
  // 「最初から」は2回押しで確かめる（どちらのボタンを押したかも覚える）
  let confirmUntil = 0;
  let confirmBtn = null;
  let confirmTimer = null;
  function newGame(btn, hard) {
    if ((started || readSave()) && !(confirmBtn === btn && Date.now() <= confirmUntil)) {
      refreshMenu();
      confirmUntil = Date.now() + 3000;
      confirmBtn = btn;
      btn.textContent = 'もう一度押すと記録を消して最初から';
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => {
        confirmUntil = 0;
        refreshMenu();
      }, 3000);
      return;
    }
    confirmUntil = 0;
    startRun(hard);
    closeMenu();
  }
  el('btn-new').addEventListener('click', (e) => newGame(e.currentTarget, false));
  el('btn-hard').addEventListener('click', (e) => newGame(e.currentTarget, true));

  // ---------- 開発者モード ----------
  // 好きな階へ移って確かめるためのモード。ふだんの記録には書かず、やめると記録の場所に戻る
  function refreshDev() {
    el('dev-guard').textContent = `無敵 ${sim.invincible ? 'あり' : 'なし'}`;
    el('dev-hard').textContent = `塔 ${sim.hard ? 'むずかしい' : 'ふつう'}`;
  }
  function openDev() {
    state = 'dev';
    music.setLevel(0.45);
    input.left = input.right = input.button = false;
    refreshDev();
    menu.hidden = true;
    devPanel.hidden = false;
  }
  function backToRecord() {
    const save = readSave();
    if (save) resumeFrom(save);
    else {
      sim.hard = false;
      sim.reset();
      sim.beltFlip = hourFlip();
      runLog = null;
      noLogWhy = '開発者モードから戻って始めた挑戦は送れません（メニューの「はじめる」で始め直すと送れます）';
      setupGhost();
    }
    sim.ended = false;
    art.reset();
    shownScreen = -1;
  }
  function warp(si) {
    const sp = level.spawns[si];
    if (!sp) return false;
    sim.ended = false;
    ending.hidden = true;
    const flip = sim.beltFlip;
    const ok = sim.loadData({
      x: sp.x * TILE + (TILE - P.dollW) / 2,
      y: sp.y * TILE - P.dollH,
      facing: 1,
      clock: sim.clock,
      hard: sim.hard,
      stats: sim.stats,
    });
    sim.beltFlip = flip;
    art.reset();
    closeMenu();
    return ok;
  }
  level.names.forEach((name, si) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${level.screenCount - si}階 ${name}`;
    b.addEventListener('click', () => warp(si));
    el('dev-floors').appendChild(b);
  });
  el('btn-dev').addEventListener('click', () => {
    if (!dev) {
      writeSave();
      if (!started) backToRecord();
      dev = true;
      started = true;
      art.setGhost(null);
      refreshMenu();
    }
    openDev();
  });
  el('btn-warp').addEventListener('click', () => {
    if (state === 'play') openDev();
  });
  el('dev-guard').addEventListener('click', () => {
    sim.invincible = !sim.invincible;
    refreshDev();
  });
  el('dev-hard').addEventListener('click', () => {
    sim.hard = !sim.hard;
    refreshDev();
  });
  el('dev-back').addEventListener('click', closeMenu);
  el('dev-exit').addEventListener('click', () => {
    dev = false;
    sim.invincible = false;
    started = false;
    ending.hidden = true;
    backToRecord();
    openMenu();
  });
  el('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn ? 'on' : 'off');
    refreshMenu();
  });
  el('btn-music').addEventListener('click', () => {
    musicOn = !musicOn;
    store.set(MUSIC_KEY, musicOn ? 'on' : 'off');
    music.setEnabled(musicOn);
    refreshMenu();
  });
  el('btn-ghost').addEventListener('click', () => {
    ghostMode = GHOST_MODES[(GHOST_MODES.indexOf(ghostMode) + 1) % GHOST_MODES.length];
    store.set(GHOST_KEY, ghostMode);
    if (started) setupGhost();
    refreshMenu();
    if (ghostMode !== 'off' && !ghostLog()) toast(ghostMode === 'rank' ? 'ランキングの画面で「幽霊」を押した人の動きが出ます' : 'まだ記録がありません（1回登ると出ます）');
  });
  el('btn-menu').addEventListener('click', () => {
    if (state === 'play') openMenu();
  });
  el('btn-again').addEventListener('click', () => {
    if (dev) {
      sim.reset();
      sim.beltFlip = hourFlip();
      art.reset();
    } else startRun(sim.hard);
    ending.hidden = true;
    state = 'play';
    lastT = null;
    shownScreen = -1;
  });

  // ---------- 記録と称号の画面 ----------
  function openRecords() {
    state = 'records';
    menu.hidden = true;
    recPanel.hidden = false;
    const best = (k) => {
      const b = rec.best[k];
      return b ? `${fmtSteps(b.steps)} ／ 巻いた ${b.winds.toLocaleString()}回` : 'まだ';
    };
    const rows = [
      ['鐘を鳴らした', `${rec.clears}回（むずかしい ${rec.clearsHard}回）`],
      ['いちばん速い（ふつう）', best('normal')],
      ['いちばん速い（むずかしい）', best('hard')],
      ['倒れた回数', `${rec.falls.toLocaleString()}回`],
      ['落ちた高さの合計', meters(rec.totalDrop)],
      ['いちばん長い落下', `${meters(rec.maxDrop)}（${rec.maxDropFloors}階ぶん）`],
    ];
    el('rec-stats').innerHTML = '';
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      el('rec-stats').append(dt, dd);
    }
    const ul = el('rec-titles');
    ul.innerHTML = '';
    let n = 0;
    for (const t of TITLES) {
      const li = document.createElement('li');
      const got = !!rec.titles[t.id];
      if (got) n++;
      li.className = got ? 'got' : '';
      const b = document.createElement('b');
      b.textContent = got ? t.name : '？？？';
      const span = document.createElement('span');
      span.textContent = t.desc;
      li.append(b, span);
      ul.appendChild(li);
    }
    el('rec-count').textContent = `称号 ${n} / ${TITLES.length}`;
  }
  function backFromPanel() {
    rankPanel.hidden = true;
    recPanel.hidden = true;
    if (rankFromEnding) {
      rankFromEnding = false;
      state = 'ending';
      ending.hidden = false;
      return;
    }
    openMenu();
  }
  el('btn-records').addEventListener('click', openRecords);
  el('rec-back').addEventListener('click', backFromPanel);

  // ---------- ランキング ----------
  const pid = (() => {
    let p = store.get(PID_KEY);
    if (!p || !/^[0-9a-f]{16}$/.test(p)) {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      p = [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
      store.set(PID_KEY, p);
    }
    return p;
  })();
  async function api(path, body) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(RANK_API + path, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
        : { signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) {
        const e = new Error(j.error || `サーバーの返事 ${r.status}`);
        e.reason = !!j.error;
        throw e;
      }
      return j;
    } finally {
      clearTimeout(timer);
    }
  }
  // 記録を送り、サーバーが少しずつ再生して確かめ終わるまで待つ
  // 確かめの1回が重すぎて失敗したら（サーバーの計算の上限）、1回に進める手数を半分ずつ小さくして頼み直す
  async function submitRun(log, name, onProgress) {
    let r = await api('/api/submit', { pid, name, log });
    // 起動直後のサーバーは計算が遅いことがある。小さくしたら、3回続けて通るたびに倍に戻す
    let chunk = 4000, tries = 0, okRun = 0;
    while (!r.done) {
      onProgress(r.progress || 0);
      try {
        r = await api('/api/verify', { id: r.id, chunk });
        tries = 0;
        if (chunk < 4000 && ++okRun >= 3) {
          chunk = Math.min(4000, chunk * 2);
          okRun = 0;
        }
      } catch (e) {
        okRun = 0;
        // 理由つきの断り（回数の上限・記録が見つからない）は頼み直さない
        if (e.reason || chunk <= 500 || ++tries > 6) throw e;
        chunk = Math.max(500, chunk >> 1);
        await new Promise((ok) => setTimeout(ok, 500));
      }
    }
    return r;
  }
  const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 10);

  let finishedLog = null;
  let rankFromEnding = false;
  function setEndRank(text) {
    el('end-rank-status').textContent = text;
  }
  async function sendFinished(log, name) {
    const btn = el('end-send');
    btn.disabled = true;
    el('end-name').disabled = true;
    try {
      const r = await submitRun(log, name, (p) => setEndRank(`サーバーで確かめています… ${Math.round(p * 100)}%`));
      store.del(UNSENT_KEY);
      const t = r.ranks || {};
      setEndRank(`ランキングに載った！ はやさ ${t.time ? t.time + '位' : '—'} ／ ねじ巻き ${t.winds ? t.winds + '位' : '—'}`);
      btn.hidden = true;
      el('end-name').hidden = true;
    } catch (e) {
      store.set(UNSENT_KEY, JSON.stringify({ log, name }));
      setEndRank(`送れませんでした（${e.message}）。ランキングの画面から送り直せます`);
      btn.disabled = false;
      el('end-name').disabled = false;
    }
  }
  el('end-send').addEventListener('click', () => {
    const name = cleanName(el('end-name').value);
    if (!name) {
      setEndRank('名前を入れてください（10文字まで）');
      return;
    }
    store.set(NAME_KEY, name);
    if (finishedLog) sendFinished(finishedLog, name);
  });

  let rankMode = 'normal';
  let rankBoard = 'time';
  function openRank(fromEnding) {
    rankFromEnding = !!fromEnding;
    state = 'rank';
    menu.hidden = true;
    ending.hidden = true;
    rankPanel.hidden = false;
    loadRank();
  }
  function refreshRankTabs() {
    el('rank-mode').textContent = `塔 ${rankMode === 'hard' ? 'むずかしい' : 'ふつう'}`;
    el('rank-board').textContent = rankBoard === 'time' ? 'はやさ順' : 'ねじ巻きの少なさ順';
    const unsent = getJSON(UNSENT_KEY);
    el('rank-resend').hidden = !(unsent && RANK_API);
  }
  let rankReq = 0;
  async function loadRank() {
    refreshRankTabs();
    const list = el('rank-list');
    list.innerHTML = '';
    const status = el('rank-status');
    if (!RANK_API) {
      status.textContent = 'ランキングは準備中です';
      return;
    }
    status.textContent = '読み込み中…';
    const my = ++rankReq;
    try {
      const r = await api(`/api/top?mode=${rankMode}&board=${rankBoard}&pid=${pid}`);
      if (my !== rankReq) return;
      status.textContent = r.rows.length ? (r.me ? `あなたは ${r.me.rank}位（${r.total}人中）` : `${r.total}人が登録`) : 'まだだれもいません';
      r.rows.forEach((row, i) => {
        const li = document.createElement('li');
        if (r.me && r.me.id === row.id) li.className = 'me';
        const no = document.createElement('span');
        no.className = 'no';
        no.textContent = `${i + 1}`;
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = row.name;
        const val = document.createElement('span');
        val.className = 'val';
        val.textContent = rankBoard === 'time' ? fmtSteps(row.steps) : `${row.winds.toLocaleString()}回`;
        li.append(no, name, val);
        if (row.hasLog) {
          const g = document.createElement('button');
          g.type = 'button';
          g.textContent = '幽霊';
          g.addEventListener('click', () => takeGhost(row.id, row.name));
          li.appendChild(g);
        }
        list.appendChild(li);
      });
    } catch (e) {
      if (my === rankReq) status.textContent = `つながりませんでした（${e.message}）`;
    }
  }
  async function takeGhost(id, name) {
    try {
      const r = await api(`/api/log?id=${encodeURIComponent(id)}`);
      if (!r.log || r.log.rules !== RULES) throw new Error('今の塔と版が違う記録です');
      store.set(GHOST_LOG + 'rank', JSON.stringify(r.log));
      ghostMode = 'rank';
      store.set(GHOST_KEY, ghostMode);
      if (started) setupGhost();
      toast(`${name} さんの幽霊と登ります（${r.log.hard ? 'むずかしい' : 'ふつう'}の塔で出ます）`);
    } catch (e) {
      toast(`幽霊を読み込めませんでした（${e.message}）`);
    }
  }
  el('btn-rank').addEventListener('click', () => openRank(false));
  el('end-rank').addEventListener('click', () => openRank(true));
  el('rank-mode').addEventListener('click', () => {
    rankMode = rankMode === 'hard' ? 'normal' : 'hard';
    loadRank();
  });
  el('rank-board').addEventListener('click', () => {
    rankBoard = rankBoard === 'time' ? 'winds' : 'time';
    loadRank();
  });
  el('rank-back').addEventListener('click', backFromPanel);
  el('rank-resend').addEventListener('click', async () => {
    const u = getJSON(UNSENT_KEY);
    if (!u) return;
    el('rank-status').textContent = '送り直しています…';
    try {
      await submitRun(u.log, u.name, (p) => (el('rank-status').textContent = `サーバーで確かめています… ${Math.round(p * 100)}%`));
      store.del(UNSENT_KEY);
    } catch (e) {
      el('rank-status').textContent = `送れませんでした（${e.message}）`;
      return;
    }
    loadRank();
  });

  // ---------- 表示 ----------
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  // 手数（1/120秒）を「分:秒.百分の一秒」に
  function fmtSteps(n) {
    const cs = Math.round((n * 100) / 120);
    return `${Math.floor(cs / 6000)}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
  }
  let shownScreen = -1;
  let bannerTimer = null;
  function showBanner() {
    const s = sim.screenIndex();
    const n = level.screenCount - s;
    banner.textContent = `${n}階　${level.names[s]}`;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 1600);
  }
  function updateHud() {
    const s = sim.screenIndex();
    if (s !== shownScreen) {
      if (shownScreen !== -1 && state === 'play') showBanner();
      shownScreen = s;
    }
    const area = `${dev ? '[開発] ' : sim.hard ? '★ ' : ''}${level.screenCount - s}階 ${level.names[s]}`;
    if (hud.area.textContent !== area) hud.area.textContent = area;
    const cap = sim.d.state === 'winding' || sim.d.wind > 0 ? sim.d.cap : sim.groundTile() === 'K' ? P.maxWindKey : P.maxWind;
    hud.wind.textContent = `ゼンマイ ${Math.ceil(sim.d.wind - 1e-9)}/${cap}`;
    hud.time.textContent = fmtTime(sim.stats.time);
    hud.winds.textContent = `巻いた ${sim.stats.winds}`;
    hud.jumps.textContent = `跳んだ ${sim.stats.jumps}`;
    hud.falls.textContent = `落ちた ${sim.stats.falls}`;
  }

  // ---------- 進める ----------
  let lastT = null;
  let acc = 0;
  let saveTimer = 0;
  function frame(now) {
    const t = now / 1000;
    if (state === 'play') {
      if (lastT === null) lastT = t;
      const elapsed = Math.min(0.25, t - lastT);
      acc += elapsed;
      saveTimer += elapsed;
      lastT = t;
      checkHour();
      let landed = false;
      while (acc >= DT) {
        acc -= DT;
        logInput();
        sim.step(input);
        for (const e of sim.events) {
          art.onEvent(e);
          if (e === 'land' || e === 'splat') landed = true;
          if (e === 'splat') onSplat();
          if (sounds[e]) sounds[e]();
        }
        sim.events.length = 0;
        if (sim.ended) {
          finish();
          break;
        }
      }
      stepGhost();
      if (state === 'play' && (landed || saveTimer >= 1)) {
        saveTimer = 0;
        writeSave();
      }
    }
    updateHud();
    // 始める前は鳴らさない。鳴っている間は（開発者モードをやめた後のメニューでも）今いる階の曲に合わせる
    if ((started || music.current()) && state !== 'ending') music.play(level.themes[sim.screenIndex()]);
    art.render(t);
    requestAnimationFrame(frame);
  }

  function finish() {
    state = 'ending';
    music.fanfare();
    const st = sim.stats;
    let unlocked = false;
    let got = [];
    finishedLog = null;
    // 送れないときの理由
    const why = !runLog ? noLogWhy
      : runLog.over ? '3時間を超えた挑戦は送れません'
      : runLog.rules !== RULES ? 'ゲームが新しくなる前に始めた挑戦なので送れません'
      : '';
    if (!dev) {
      clearSave();
      unlocked = !isCleared();
      if (!store.set(CLEAR_KEY, '1')) unlocked = false;
      rec.clears++;
      if (sim.hard) rec.clearsHard++;
      const key = sim.hard ? 'hard' : 'normal';
      const b = rec.best[key];
      const newBest = !b || st.steps < b.steps;
      rec.best[key] = { steps: newBest ? st.steps : b.steps, winds: b ? Math.min(b.winds, st.winds) : st.winds };
      saveRec();
      got = checkTitles(true);
      if (runLog) {
        keepGhost('prev', runLog);
        if (newBest) keepGhost(`best-${sim.hard ? 1 : 0}`, runLog);
        if (rankable(runLog)) finishedLog = runLog;
      }
      runLog = null;
    }
    el('end-mode').textContent = (sim.hard ? 'むずかしい' : 'ふつう') + (dev ? '（開発者モード）' : '');
    el('end-time').textContent = fmtSteps(st.steps);
    el('end-winds').textContent = `${st.winds.toLocaleString()}回`;
    el('end-jumps').textContent = st.jumps;
    el('end-falls').textContent = st.falls;
    el('end-drop').textContent = st.maxDrop ? meters(st.maxDrop) : 'なし';
    el('end-note').hidden = !unlocked;
    el('end-titles').hidden = !got.length;
    el('end-titles').textContent = got.length ? `新しい称号: ${got.map((t) => t.name).join('、')}` : '';
    const nameBox = el('end-name');
    nameBox.value = store.get(NAME_KEY) || '';
    const canSend = !!finishedLog && !!RANK_API;
    nameBox.hidden = el('end-send').hidden = !canSend;
    nameBox.disabled = el('end-send').disabled = false;
    el('end-rank').hidden = dev;
    setEndRank(dev ? '' : !RANK_API ? 'ランキングは準備中です' : finishedLog ? '名前を入れて送ると、ランキングに載ります' : why || 'この挑戦は送れません');
    setTimeout(() => {
      if (state === 'ending') ending.hidden = false;
    }, 2600);
  }

  window.addEventListener('pagehide', writeSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      writeSave();
      input.left = input.right = input.button = false;
      if (ac && ac.state === 'running') ac.suspend();
    } else {
      lastT = null;
      if (ac && started) ac.resume();
    }
  });

  sim.beltFlip = hourFlip();
  refreshMenu();
  menu.hidden = false;
  requestAnimationFrame(frame);

  // 試験用の入口（画面の自動試験から使う）
  window.__zenmai = {
    sim, input, level, music, rec, RULES, warp,
    state: () => state,
    dev: () => dev,
    runLog: () => runLog,
    noLogWhy: () => noLogWhy,
    ghost: () => ghostRep,
    // 試験用: 登りきった記録を再生して、その終わりの場面にする（次のコマでゴールになる）
    loadRun(log) {
      const r = new C.Replayer(level, log);
      r.run(Infinity);
      if (!r.sim.ended) return false;
      sim.restore(r.sim.snapshot());
      runLog = log;
      return true;
    },
  };
})();
