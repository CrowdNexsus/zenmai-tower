// ゼンマイの塔: 画面に描く・操作を受け取る・音を鳴らす・続きを保存する
(function () {
  'use strict';

  const C = window.ZenmaiCore;
  const { DT, P, TILE } = C;
  const SAVE_KEY = 'zenmai-tower-v1';
  const SOUND_KEY = 'zenmai-tower-sound';
  const MUSIC_KEY = 'zenmai-tower-music';
  const CLEAR_KEY = 'zenmai-tower-cleared';

  const level = C.buildLevel(window.ZENMAI_LEVEL);
  const sim = new C.Sim(level);

  const art = window.ZenmaiArt.create(document.getElementById('game'), level, sim);

  const el = (id) => document.getElementById(id);
  const hud = { area: el('hud-area'), wind: el('hud-wind'), time: el('hud-time'), jumps: el('hud-jumps'), falls: el('hud-falls') };
  const banner = el('banner');
  const menu = el('menu');
  const devPanel = el('dev');
  const ending = el('ending');

  // ---------- 保存 ----------
  // 読めない・置けない保存は「保存なし」として扱う
  function readSave() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const o = JSON.parse(s);
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
      if (data) localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }
  function isCleared() {
    try {
      return localStorage.getItem(CLEAR_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  // ---------- 音 ----------
  let soundOn = true;
  let musicOn = true;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
    musicOn = localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch (e) {}
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
  function noise(dur, vol, freq) {
    const a = audio();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }
  function bell() {
    [1, 2, 2.76, 5.4].forEach((m, i) => tone('sine', 330 * m, 330 * m, 3.2 - i * 0.5, 0.18 / (i + 1)));
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
    const k = keyMap[e.code];
    if (e.code === 'Escape') {
      if (state === 'play') openMenu();
      else if ((state === 'menu' && started) || state === 'dev') closeMenu();
      return;
    }
    // 開発者モード: 数字キーでその階へ（1〜9、0 は10階）
    const m = /^Digit(\d)$/.exec(e.code);
    if (m && dev && state === 'play') {
      const f = m[1] === '0' ? 10 : Number(m[1]);
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
    menu.hidden = false;
  }
  function closeMenu() {
    music.setLevel(1);
    confirmUntil = 0;
    menu.hidden = true;
    devPanel.hidden = true;
    state = 'play';
    lastT = null;
    showBanner();
  }
  el('btn-continue').addEventListener('click', () => {
    if (!started) {
      sim.loadData(readSave());
      started = true;
    }
    closeMenu();
  });
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
    clearSave();
    sim.hard = hard;
    sim.reset();
    art.reset();
    started = true;
    shownScreen = -1;
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
    if (save) sim.loadData(save);
    else {
      sim.hard = false;
      sim.reset();
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
    const ok = sim.loadData({
      x: sp.x * TILE + (TILE - P.dollW) / 2,
      y: sp.y * TILE - P.dollH,
      facing: 1,
      clock: sim.clock,
      hard: sim.hard,
      stats: sim.stats,
    });
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
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    } catch (e) {}
    refreshMenu();
  });
  el('btn-music').addEventListener('click', () => {
    musicOn = !musicOn;
    try {
      localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off');
    } catch (e) {}
    music.setEnabled(musicOn);
    refreshMenu();
  });
  el('btn-menu').addEventListener('click', () => {
    if (state === 'play') openMenu();
  });
  el('btn-again').addEventListener('click', () => {
    if (!dev) clearSave();
    sim.reset();
    art.reset();
    ending.hidden = true;
    state = 'play';
    lastT = null;
    shownScreen = -1;
  });

  // ---------- 表示 ----------
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
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
      let landed = false;
      while (acc >= DT) {
        acc -= DT;
        sim.step(input);
        for (const e of sim.events) {
          art.onEvent(e);
          if (e === 'land' || e === 'splat') landed = true;
          if (sounds[e]) sounds[e]();
        }
        sim.events.length = 0;
        if (sim.ended) {
          finish();
          break;
        }
      }
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
    let unlocked = false;
    if (!dev) {
      clearSave();
      unlocked = !isCleared();
      try {
        localStorage.setItem(CLEAR_KEY, '1');
      } catch (e) {
        unlocked = false;
      }
    }
    el('end-mode').textContent = (sim.hard ? 'むずかしい' : 'ふつう') + (dev ? '（開発者モード）' : '');
    el('end-time').textContent = fmtTime(sim.stats.time);
    el('end-jumps').textContent = sim.stats.jumps;
    el('end-falls').textContent = sim.stats.falls;
    el('end-note').hidden = !unlocked;
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

  refreshMenu();
  menu.hidden = false;
  requestAnimationFrame(frame);

  // 試験用の入口（画面の自動試験から使う）
  window.__zenmai = { sim, input, level, music, state: () => state, dev: () => dev, warp };
})();
