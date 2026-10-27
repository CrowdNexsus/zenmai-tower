// ゼンマイの塔: 画面に描く・操作を受け取る・音を鳴らす・続きを保存する・記録と称号・幽霊・ランキング・ことば・引き継ぎ・投稿
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
  const LANG_KEY = 'zenmai-tower-lang';
  // 投稿の文に付けるリンク（人に遊んでもらう公開ページ）
  const PUBLIC_URL = 'https://crowdnexsus.github.io/zenmai-tower/';
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
  const hud = { area: el('hud-area'), wind: el('hud-wind'), time: el('hud-time'), winds: el('hud-winds'), jumps: el('hud-jumps'), hearts: el('hud-hearts') };
  const banner = el('banner');
  const toastEl = el('toast');
  const menu = el('menu');
  const devPanel = el('dev');
  const ending = el('ending');
  const overPanel = el('gameover');
  const rankPanel = el('rank');
  const recPanel = el('records');
  const trPanel = el('transfer');
  const map = { box: el('map'), top: el('map-top'), run: el('map-run'), me: el('map-me') };

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

  // ---------- ことば（日本語・英語） ----------
  // 選んだことばは端末ごとに覚える。初めては、ブラウザのことばが日本語なら日本語、それ以外は英語。URL の ?lang=ja|en でも選べる（覚えない）
  const STR = {
    ja: {
      title: 'ゼンマイの塔', sub: '試作版', game_aria: 'ゲーム画面',
      how1: '長押しで巻き（最大24回）、離すと歩き出す。止まれない',
      how2: '歩いている間に押すと跳ぶ。空中では動かせない',
      how4: '階ごとの仕掛けを見て登る。ハチは巻いている間は平気',
      how7: 'ハートは3つ。倒れると1つ減り、無くなると1階から',
      how6: '17階の鐘でゴール。毎正時の時報で10秒ベルトが逆回り',
      b_rank: 'ランキング', b_records: '記録と称号', b_transfer: '引き継ぎ', b_dev: '開発者', b_menu: 'メニュー', b_warp: '階えらび', back: 'もどる',
      rank_resend: '送れなかった記録を送り直す', h_records: '記録と称号',
      h_transfer: '記録の引き継ぎ',
      tr_note: 'パソコンとスマホで同じ記録を使うときに。書き出した文字（またはファイル）を、もう片方で読み込みます。ランキングでも同じ人として扱われます',
      tr_out_aria: '書き出した文字', tr_in_aria: '読み込む文字', toast_sep: ' ／ ',
      send_ng: '送れませんでした（{e}）',
      tr_export: 'この端末の記録を書き出す', tr_copy: 'コピー', tr_save: 'ファイルに保存', tr_in_ph: '書き出した文字をここに貼る', tr_file: 'ファイルから', tr_import: '読み込む',
      tr_made: '書き出した（{k}KB）。コピーするかファイルに保存して、もう片方の端末で読み込んでください',
      tr_copied: 'コピーした', tr_copy_fail: 'コピーできませんでした。文字を選んでコピーしてください',
      tr_empty: '読み込む文字を貼ってください', tr_bad: '読めない文字です（書き出した文字をそのまま貼ってください）',
      tr_confirm: 'もう一度押すと、この端末の記録を上書きして読み込みます', tr_done: '読み込みました。ページを読み直します',
      tr_fail: '保存できませんでした（この端末の空きが足りないかもしれません）', tr_big: 'ファイルが大きすぎます',
      h_dev: '開発者モード', dev_note: '押した階の入口へ移る（数字キー。11階より上は Shift と数字）。ふだんの記録は変わらない。倒れてもハートは減らない',
      dev_back: '遊びにもどる', dev_exit: '開発者モードをやめる',
      h_end: '鐘が鳴った！', d_mode: '塔', d_time: 'かかった時間', d_winds: '巻いた回数', d_jumps: '跳んだ回数', d_hearts: '残りのハート', d_drop: 'いちばん長い落下', d_top: 'いちばん高く登った所',
      end_note: 'むずかしい塔（巻いている間もハチに当たる）が、メニューから遊べるようになった',
      name_ph: '名前（10文字まで）', end_send: 'ランキングに送る', end_rank: 'ランキング', share: '結果を投稿', save_img: '画像を保存', again: 'もう一度登る',
      h_over: '力尽きた…', over_note: 'ハートが無くなった。1階からやり直し', retry: '1階からやり直す',
      pad_left: '左を向く', pad_right: '右を向く', pad_big: '巻く ／ 跳ぶ',
      keys: '← → で向きを決める ／ スペースを長押しで巻き、離すと歩く ／ 歩いている間にスペースで跳ぶ ／ Esc でメニュー',
      continue: 'つづきから', resume: 'もどる', start: 'はじめる', restart: '最初から', hard_start: 'むずかしい塔ではじめる', hard_restart: 'むずかしい塔で最初から',
      confirm: 'もう一度押すと記録を消して最初から',
      sound: '効果音 {v}', music: '音楽 {v}', ghost: '幽霊 {v}', on: 'あり', off: 'なし',
      g_off: 'なし', g_prev: '前回', g_best: 'ベスト', g_rank: '上位',
      ghost_rank_hint: 'ランキングの画面で「幽霊」を押した人の動きが出ます', ghost_none: 'まだ記録がありません（1回登ると出ます）',
      invincible: '無敵 {v}', tower: '塔 {v}', normal: 'ふつう', hard: 'むずかしい', dev_suffix: '（開発者モード）', dev_tag: '[開発] ',
      chime_toast: '時報 {h}時。10秒間、歯車のベルトが逆に回る', title_toast: '称号「{n}」を手に入れた', title_join: '」「',
      heart_toast: 'ハートが1つ減った（のこり {n}）',
      r_clears: '鐘を鳴らした', r_clears_v: '{n}回（むずかしい {h}回）', r_best_n: 'いちばん速い（ふつう）', r_best_h: 'いちばん速い（むずかしい）',
      r_falls: '倒れた回数', r_drop: '落ちた高さの合計', r_maxdrop: 'いちばん長い落下', r_maxdrop_v: '{m}（{f}階ぶん）', r_top: 'いちばん高く登った所', r_over: 'ゲームオーバー',
      times: '{n}回', not_yet: 'まだ', best_v: '{t} ／ 巻いた {w}回', rec_count: '称号 {n} / {m}', hidden_title: '？？？', none: 'なし',
      new_titles: '新しい称号: {n}', list_join: '、',
      server_status: 'サーバーの返事 {s}', verifying: 'サーバーで確かめています… {p}%',
      ranked: 'ランキングに載った！ はやさ {a} ／ ねじ巻き {b}', place: '{n}位',
      send_fail: '送れませんでした（{e}）。ランキングの画面から送り直せます', need_name: '名前を入れてください（10文字まで）',
      board_time: 'はやさ順', board_winds: 'ねじ巻きの少なさ順', rank_soon: 'ランキングは準備中です', loading: '読み込み中…',
      rank_me: 'あなたは {r}位（{t}人中）', rank_total: '{t}人が登録', rank_empty: 'まだだれもいません', ghost_btn: '幽霊',
      conn_fail: 'つながりませんでした（{e}）', ghost_ver: '今の塔と版が違う記録です',
      ghost_take: '{n} さんの幽霊と登ります（{m}の塔で出ます）', ghost_fail: '幽霊を読み込めませんでした（{e}）',
      resending: '送り直しています…', send_fail2: '送れませんでした（{e}）',
      floor: '{n}階', floor_sep: '　', wind_hud: 'ゼンマイ {a}/{b}', winds_hud: '巻いた {n}', jumps_hud: '跳んだ {n}',
      why_old_save: 'この挑戦は、記録の仕組みができる前の保存から続けたので送れません',
      why_version: 'ゲームが新しくなる前に始めた挑戦なので送れません',
      why_long: '3時間を超えた挑戦は送れません',
      why_tampered: 'この挑戦は、書きかえられた保存から続けたので送れません',
      why_dev: '開発者モードから戻って始めた挑戦は送れません（メニューの「はじめる」で始め直すと送れます）',
      why_none: 'この挑戦は送れません', rank_ready: '名前を入れて送ると、ランキングに載ります',
      share_clear: '{tag}ゼンマイの塔の鐘を鳴らした！ 時間 {t} ／ 巻いた {w}回 ／ 残りのハート {h}',
      share_over: '{tag}ゼンマイの塔を{f}階まで登って力尽きた…', share_tag_hard: '【むずかしい塔】', hashtag: '#ゼンマイの塔',
      copied: '投稿の文をコピーした（貼り付けて投稿できます）', img_saved: '画像を保存した', img_fail: '画像を作れませんでした',
    },
    en: {
      title: 'Clockwork Tower', sub: 'Prototype', game_aria: 'Game screen',
      how1: 'Hold to wind (max 24). Release to walk; you can\'t stop',
      how2: 'Press while walking to jump. No control in the air',
      how4: 'Read each floor\'s tricks. Bees can\'t hurt you while winding',
      how7: '3 hearts. Hard falls cost one; at zero, back to 1F',
      how6: 'Ring the bell on 17F. On the hour, belts reverse for 10 s',
      b_rank: 'Ranking', b_records: 'Records', b_transfer: 'Transfer', b_dev: 'Dev', b_menu: 'Menu', b_warp: 'Floors', back: 'Back',
      rank_resend: 'Resend the unsent run', h_records: 'Records & Titles',
      h_transfer: 'Transfer your save',
      tr_note: 'Use the same save on your PC and phone. Export it here, then import the text (or file) on the other device. The ranking treats both as the same player',
      tr_out_aria: 'Exported text', tr_in_aria: 'Text to import', toast_sep: ' / ',
      send_ng: 'Couldn\'t submit ({e})',
      tr_export: 'Export this device\'s save', tr_copy: 'Copy', tr_save: 'Save as file', tr_in_ph: 'Paste the exported text here', tr_file: 'From file', tr_import: 'Import',
      tr_made: 'Exported ({k} KB). Copy it or save it as a file, then import it on the other device',
      tr_copied: 'Copied', tr_copy_fail: 'Couldn\'t copy. Select the text and copy it yourself',
      tr_empty: 'Paste the text to import', tr_bad: 'Can\'t read this text (paste exactly what was exported)',
      tr_confirm: 'Press again to overwrite this device\'s save and import', tr_done: 'Imported. Reloading the page…',
      tr_fail: 'Couldn\'t save (this device may be out of space)', tr_big: 'The file is too large',
      h_dev: 'Developer mode', dev_note: 'Jump to a floor\'s entrance (number keys; Shift + number above the 10th floor). Your normal save is not changed, and falls cost no hearts',
      dev_back: 'Back to the game', dev_exit: 'Leave developer mode',
      h_end: 'The bell rang!', d_mode: 'Tower', d_time: 'Time', d_winds: 'Winds', d_jumps: 'Jumps', d_hearts: 'Hearts left', d_drop: 'Longest fall', d_top: 'Highest point',
      end_note: 'The Hard Tower (bees can hit you while winding) is now in the menu',
      name_ph: 'Name (up to 10 characters)', end_send: 'Submit', end_rank: 'Ranking', share: 'Share', save_img: 'Save image', again: 'Climb again',
      h_over: 'Out of hearts…', over_note: 'No hearts left. Back to the 1st floor', retry: 'Restart from the 1st floor',
      pad_left: 'Face left', pad_right: 'Face right', pad_big: 'Wind / Jump',
      keys: '← → face / Hold Space: wind, release: walk / Space while walking: jump / Esc: menu',
      continue: 'Continue', resume: 'Resume', start: 'Start', restart: 'Start over', hard_start: 'Start the Hard Tower', hard_restart: 'Start over in the Hard Tower',
      confirm: 'Press again to erase your progress and start over',
      sound: 'Sound {v}', music: 'Music {v}', ghost: 'Ghost: {v}', on: 'on', off: 'off',
      g_off: 'off', g_prev: 'last', g_best: 'best', g_rank: 'top',
      ghost_rank_hint: 'Press "Ghost" next to a name on the Ranking screen to climb with their ghost', ghost_none: 'No run yet (it appears after you climb once)',
      invincible: 'Invincible: {v}', tower: 'Tower: {v}', normal: 'Normal', hard: 'Hard', dev_suffix: ' (developer mode)', dev_tag: '[Dev] ',
      chime_toast: '{h} o\'clock chime: the gear belts run backward for 10 seconds', title_toast: 'New title: {n}', title_join: ', ',
      heart_toast: 'Lost a heart ({n} left)',
      r_clears: 'Bells rung', r_clears_v: '{n} (Hard: {h})', r_best_n: 'Fastest (Normal)', r_best_h: 'Fastest (Hard)',
      r_falls: 'Falls', r_drop: 'Total fall height', r_maxdrop: 'Longest fall', r_maxdrop_v: '{m} ({f} floors)', r_top: 'Highest point', r_over: 'Game overs',
      times: '{n}', not_yet: 'None yet', best_v: '{t} / {w} winds', rec_count: 'Titles {n} / {m}', hidden_title: '???', none: 'None',
      new_titles: 'New titles: {n}', list_join: ', ',
      server_status: 'Server replied {s}', verifying: 'Checking on the server… {p}%',
      ranked: 'You\'re on the board! Speed {a} / Winds {b}', place: '#{n}',
      send_fail: 'Couldn\'t submit ({e}). You can resend it from the Ranking screen', need_name: 'Enter a name (up to 10 characters)',
      board_time: 'Fastest', board_winds: 'Fewest winds', rank_soon: 'The ranking is coming soon', loading: 'Loading…',
      rank_me: 'You\'re #{r} of {t}', rank_total: '{t} players', rank_empty: 'No one yet', ghost_btn: 'Ghost',
      conn_fail: 'Couldn\'t connect ({e})', ghost_ver: 'That run is from a different version of the tower',
      ghost_take: 'Climbing with {n}\'s ghost (it appears in the {m} tower)', ghost_fail: 'Couldn\'t load the ghost ({e})',
      resending: 'Resending…', send_fail2: 'Couldn\'t submit ({e})',
      floor: '{n}F', floor_sep: '  ', wind_hud: 'Spring {a}/{b}', winds_hud: 'Winds {n}', jumps_hud: 'Jumps {n}',
      why_old_save: 'This run continued from a save made before runs were recorded, so it can\'t be submitted',
      why_version: 'This run started on an older version of the game, so it can\'t be submitted',
      why_long: 'Runs longer than 3 hours can\'t be submitted',
      why_tampered: 'This run continued from an edited save, so it can\'t be submitted',
      why_dev: 'This run started after leaving developer mode, so it can\'t be submitted (press "Start" in the menu to begin a new run)',
      why_none: 'This run can\'t be submitted', rank_ready: 'Enter a name and submit to join the ranking',
      share_clear: '{tag}I rang the bell of the Clockwork Tower! Time {t} / {w} winds / {h} hearts left',
      share_over: '{tag}I climbed the Clockwork Tower up to {f}F before running out of hearts…', share_tag_hard: '[Hard Tower] ', hashtag: '#ClockworkTower',
      copied: 'Copied the post text (paste it to post)', img_saved: 'Saved the image', img_fail: 'Couldn\'t make the image',
      // サーバーの断りの言葉（サーバーは日本語で返すので、記号から訳す）
      err_version: 'The game version is different. Reload the page and climb again',
      err_bad: 'The run data is broken', err_chime: 'The chime record looks wrong',
      err_busy: 'Too many submissions. Please wait about an hour', err_quota: 'Today\'s checking limit is used up. Please submit again tomorrow',
      err_gone: 'Not found (it disappears after an hour)', err_replay: 'Couldn\'t verify the run', err_nobell: 'Replaying the run didn\'t reach the bell',
      err_dup: 'A run with exactly the same time and winds is already listed under another name',
      err_hearts: 'This run ran out of hearts, so it can\'t be listed', err_server: 'The server failed',
    },
  };
  const FLOOR_EN = ['Belfry', 'Outer Wall', 'Narrow Beams', 'Rusted Beams', 'Great Clock', 'Magnet Hall', 'Blackout Engine Room', 'Queen\'s Chamber', 'Beehive',
    'Cuckoo Clock Hall', 'Pendulum Hall', 'Reverse-Wind Hall', 'Winding Hall', 'Gear Belts', 'Steam Pipes', 'Oil Floor', 'Spring Storage'];
  let lang = (() => {
    const u = new URLSearchParams(location.search).get('lang');
    if (u === 'ja' || u === 'en') return u;
    const s = store.get(LANG_KEY);
    if (s === 'ja' || s === 'en') return s;
    return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  })();
  function tr(k, v) {
    let s = STR[lang][k];
    if (s === undefined) s = STR.ja[k];
    if (s === undefined) return k;
    return v ? s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? String(v[n]) : m)) : s;
  }
  const floorName = (si) => (lang === 'en' && FLOOR_EN.length === level.screenCount ? FLOOR_EN[si] : level.names[si]);
  const floorLabel = (si, sep = ' ') => `${tr('floor', { n: level.screenCount - si })}${sep}${floorName(si)}`;
  // 高さ（人形の上端の y）が何階か
  const screenOfY = (y) => Math.max(0, Math.min(level.screenCount - 1, Math.floor((y + P.dollH / 2) / C.SCREEN_H)));
  const modeName = (hard) => tr(hard ? 'hard' : 'normal');
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = tr('title');
    document.querySelectorAll('[data-t]').forEach((e) => (e.textContent = tr(e.dataset.t)));
    document.querySelectorAll('[data-t-ph]').forEach((e) => (e.placeholder = tr(e.dataset.tPh)));
    document.querySelectorAll('[data-t-aria]').forEach((e) => e.setAttribute('aria-label', tr(e.dataset.tAria)));
    const lb = el('btn-lang');
    lb.textContent = lang === 'ja' ? 'English' : '日本語';
    lb.lang = lang === 'ja' ? 'en' : 'ja';
    art.setLang(lang);
    // 出ている階の名前の帯も、選んだことばで出し直す
    if (banner.classList.contains('show')) banner.textContent = floorLabel(sim.screenIndex(), tr('floor_sep'));
    fillDevFloors();
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
  // runLog が null のとき、ゴールの画面に出す送れない理由（ことばの記号。続けた時点で決める）
  let noLogWhy = 'why_old_save';
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
    toast(tr('chime_toast', { h }));
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
    heart: () => {
      tone('square', 660, 660, 0.08, 0.05, 0.35);
      tone('square', 440, 440, 0.08, 0.05, 0.45);
      tone('square', 330, 260, 0.2, 0.05, 0.55);
    },
    gameover: () => {
      [392, 370, 349, 330].forEach((f, i) => tone('triangle', f, f, 0.3, 0.08, 0.9 + i * 0.32));
      tone('triangle', 262, 196, 1.1, 0.09, 2.2);
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
    // 名前や引き継ぎの文字を打っている間は、ゲームの操作にしない
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = keyMap[e.code];
    if (e.code === 'Escape') {
      if (state === 'play') openMenu();
      else if ((state === 'menu' && started) || state === 'dev') closeMenu();
      else if (state === 'rank' || state === 'records' || state === 'transfer') backFromPanel();
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
  // topY: これまでにいちばん高く登った所（人形の上端の y。小さいほど高い） / gameovers: ハートが尽きた回数
  const rec = Object.assign({ clears: 0, clearsHard: 0, falls: 0, totalDrop: 0, maxDrop: 0, maxDropFloors: 0, fullDrop: 0, best: {}, titles: {}, topY: null, gameovers: 0 }, getJSON(REC_KEY) || {});
  const saveRec = () => store.set(REC_KEY, JSON.stringify(rec));
  let seenDrop = 0;
  // test(記録, 今の挑戦, 鐘を鳴らしたか)
  const TITLES = [
    { id: 'fall1', name: 'はじめての転落', desc: '倒れるほど高く落ちた', en: ['First Fall', 'Fell far enough to collapse'], test: (r) => r.falls >= 1 },
    { id: 'floor1', name: 'ひと階ぶんの転落', desc: '1回で1階ぶん以上落ちた', en: ['One-Floor Drop', 'Fell one floor or more in one go'], test: (r) => r.maxDropFloors >= 1 },
    { id: 'floor3', name: '三階ぶんの転落', desc: '1回で3階ぶん以上落ちた', en: ['Three-Floor Drop', 'Fell three floors or more in one go'], test: (r) => r.maxDropFloors >= 3 },
    { id: 'floor6', name: '奈落の人形', desc: '1回で6階ぶん以上落ちた', en: ['Into the Abyss', 'Fell six floors or more in one go'], test: (r) => r.maxDropFloors >= 6 },
    { id: 'full', name: '鐘楼から1階まで', desc: 'いちばん上の鐘楼から、1回で1階まで落ちた', en: ['Belfry to Ground', 'Fell from the belfry all the way to the 1st floor in one go'], test: (r) => r.fullDrop >= 1 },
    { id: 'm100', name: '百メートル落ちた人形', desc: '落ちた高さの合計が100m', en: ['100 m Faller', 'Fell 100 m in total'], test: (r) => r.totalDrop >= 100 * PX_PER_M },
    { id: 'km1', name: '一キロ落ちた人形', desc: '落ちた高さの合計が1km', en: ['1 km Faller', 'Fell 1 km in total'], test: (r) => r.totalDrop >= 1000 * PX_PER_M },
    { id: 'f100', name: '百転び', desc: '倒れた回数の合計が100回', en: ['A Hundred Tumbles', 'Collapsed 100 times in total'], test: (r) => r.falls >= 100 },
    { id: 'clear', name: '鐘を鳴らした', desc: '鐘楼の鐘を鳴らした', en: ['Bell Ringer', 'Rang the belfry bell'], test: (r) => r.clears >= 1 },
    { id: 'nofall', name: '一度も倒れず', desc: '一度も倒れずに鐘を鳴らした', en: ['Never Fell', 'Rang the bell without collapsing once'], test: (r, s, fin) => fin && s.falls === 0 },
    { id: 'nosting', name: '刺されなかった', desc: 'ハチに一度も刺されずに鐘を鳴らした', en: ['Unstung', 'Rang the bell without a single bee sting'], test: (r, s, fin) => fin && s.stings === 0 },
    { id: 'fast20', name: '早巻き', desc: '20分以内に鐘を鳴らした', en: ['Quick Winder', 'Rang the bell within 20 minutes'], test: (r, s, fin) => fin && s.steps <= 20 * 60 * 120 },
    { id: 'fast10', name: '疾風のゼンマイ', desc: '10分以内に鐘を鳴らした', en: ['Gale Spring', 'Rang the bell within 10 minutes'], test: (r, s, fin) => fin && s.steps <= 10 * 60 * 120 },
    { id: 'thrift', name: '倹約家', desc: 'ねじ巻き合計2500回以下で鐘を鳴らした', en: ['Thrifty', 'Rang the bell with 2,500 winds or fewer'], test: (r, s, fin) => fin && s.winds <= 2500 },
    { id: 'hard', name: 'むずかしい塔 制覇', desc: 'むずかしい塔の鐘を鳴らした', en: ['Hard Tower Conquered', 'Rang the bell of the Hard Tower'], test: (r) => r.clearsHard >= 1 },
  ];
  const titleName = (t) => (lang === 'en' ? t.en[0] : t.name);
  const titleDesc = (t) => (lang === 'en' ? t.en[1] : t.desc);
  function checkTitles(fin) {
    const got = [];
    for (const t of TITLES) {
      if (rec.titles[t.id] || !t.test(rec, sim.stats, fin)) continue;
      rec.titles[t.id] = Date.now();
      got.push(t);
    }
    if (got.length) {
      saveRec();
      toast(tr('title_toast', { n: got.map(titleName).join(tr('title_join')) }));
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
  // これまでの最高の高さを更新したら true
  function noteTop() {
    if (dev || !Number.isFinite(sim.stats.best)) return false;
    if (Number.isFinite(rec.topY) && rec.topY <= sim.stats.best) return false;
    rec.topY = sim.stats.best;
    return true;
  }
  function onHeart() {
    hud.hearts.classList.remove('hit');
    void hud.hearts.offsetWidth;
    hud.hearts.classList.add('hit');
    if (sim.stats.hearts <= 0) return;
    // 同じ落下で称号の知らせが出たばかりなら、消さずにつなげる
    const text = tr('heart_toast', { n: sim.stats.hearts });
    toast(Date.now() - toastAt < 200 ? `${toastEl.textContent}${tr('toast_sep')}${text}` : text);
  }
  const meters = (px) => `${(px / PX_PER_M).toFixed(1)}m`;

  let toastTimer = null;
  let toastAt = 0;
  function toast(text) {
    toastAt = Date.now();
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  // ---------- 幽霊（前の自分・自己ベスト・ランキングの人の動き） ----------
  const GHOST_MODES = ['off', 'prev', 'best', 'rank'];
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
    el('btn-continue').textContent = tr(started ? 'resume' : 'continue');
    el('btn-new').textContent = tr(going ? 'restart' : 'start');
    el('btn-new').hidden = dev;
    el('btn-hard').textContent = tr(going ? 'hard_restart' : 'hard_start');
    el('btn-hard').hidden = dev || !isCleared();
    el('btn-sound').textContent = tr('sound', { v: tr(soundOn ? 'on' : 'off') });
    el('btn-music').textContent = tr('music', { v: tr(musicOn ? 'on' : 'off') });
    el('btn-ghost').textContent = tr('ghost', { v: tr(`g_${ghostMode}`) });
    el('btn-warp').hidden = !dev;
    el('btn-dev').hidden = !devAllowed;
  }
  function hidePanels() {
    devPanel.hidden = true;
    rankPanel.hidden = true;
    recPanel.hidden = true;
    trPanel.hidden = true;
  }
  function openMenu() {
    state = 'menu';
    music.setLevel(0.45);
    confirmUntil = 0;
    input.left = input.right = input.button = false;
    writeSave();
    refreshMenu();
    hidePanels();
    overPanel.hidden = true;
    menu.hidden = false;
  }
  function closeMenu() {
    music.setLevel(1);
    confirmUntil = 0;
    menu.hidden = true;
    hidePanels();
    state = 'play';
    lastT = null;
    showBanner();
  }
  // 保存から続ける（新しいページで開き直したのと同じ扱い。記録には「置き直した」と、そのときのベルトの向きを残す）
  // 開き直しの印は保存した時点の手（save.at）に置き、次の手は止まる所まで進んだ後の手数から数える（Replayer と同じ）
  // ハート0の保存（最後のハートを失う落下の途中で閉じた）から続けると、すぐゲームオーバーになる
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
      noLogWhy = !lg || !Array.isArray(lg.ev) ? 'why_old_save'
        : lg.rules !== RULES ? 'why_version'
        : lg.over ? 'why_long'
        : 'why_tampered';
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
    overPanel.hidden = true;
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
      btn.textContent = tr('confirm');
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
  // 好きな階へ移って確かめるためのモード。ふだんの記録には書かず、やめると記録の場所に戻る。倒れてもハートは減らない
  function refreshDev() {
    el('dev-guard').textContent = tr('invincible', { v: tr(sim.invincible ? 'on' : 'off') });
    el('dev-hard').textContent = tr('tower', { v: modeName(sim.hard) });
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
      noLogWhy = 'why_dev';
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
  function fillDevFloors() {
    const box = el('dev-floors');
    box.innerHTML = '';
    level.names.forEach((name, si) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = floorLabel(si);
      b.addEventListener('click', () => warp(si));
      box.appendChild(b);
    });
  }
  el('btn-dev').addEventListener('click', () => {
    if (!dev) {
      writeSave();
      // ハートを減らさない設定は、保存を読む前に入れる（ハート0の保存を読んでも、ゲームオーバーにしない）
      sim.endless = true;
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
    sim.endless = false;
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
    if (ghostMode !== 'off' && !ghostLog()) toast(tr(ghostMode === 'rank' ? 'ghost_rank_hint' : 'ghost_none'));
  });
  el('btn-lang').addEventListener('click', () => {
    lang = lang === 'ja' ? 'en' : 'ja';
    store.set(LANG_KEY, lang);
    applyLang();
    refreshMenu();
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
      return b ? tr('best_v', { t: fmtSteps(b.steps), w: b.winds.toLocaleString() }) : tr('not_yet');
    };
    const rows = [
      [tr('r_clears'), tr('r_clears_v', { n: rec.clears, h: rec.clearsHard })],
      [tr('r_best_n'), best('normal')],
      [tr('r_best_h'), best('hard')],
      [tr('r_top'), Number.isFinite(rec.topY) ? floorLabel(screenOfY(rec.topY)) : tr('not_yet')],
      [tr('r_falls'), tr('times', { n: rec.falls.toLocaleString() })],
      [tr('r_over'), tr('times', { n: (rec.gameovers || 0).toLocaleString() })],
      [tr('r_drop'), meters(rec.totalDrop)],
      [tr('r_maxdrop'), tr('r_maxdrop_v', { m: meters(rec.maxDrop), f: rec.maxDropFloors })],
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
      b.textContent = got ? titleName(t) : tr('hidden_title');
      const span = document.createElement('span');
      span.textContent = titleDesc(t);
      li.append(b, span);
      ul.appendChild(li);
    }
    el('rec-count').textContent = tr('rec_count', { n, m: TITLES.length });
  }
  function backFromPanel() {
    rankPanel.hidden = true;
    recPanel.hidden = true;
    trPanel.hidden = true;
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
  // サーバーの断りの言葉は日本語なので、英語の画面では記号（code）から訳す
  function serverError(j, status) {
    if (!j.error) return tr('server_status', { s: status });
    if (lang === 'en' && j.code && STR.en[`err_${j.code}`]) return STR.en[`err_${j.code}`];
    return j.error;
  }
  async function api(path, body) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(RANK_API + path, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }
        : { signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) {
        const e = new Error(serverError(j, r.status));
        e.reason = !!j.error;
        e.code = j.code || '';
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
      const r = await submitRun(log, name, (p) => setEndRank(tr('verifying', { p: Math.round(p * 100) })));
      store.del(UNSENT_KEY);
      const t = r.ranks || {};
      const place = (n) => (n ? tr('place', { n }) : '—');
      setEndRank(tr('ranked', { a: place(t.time), b: place(t.winds) }));
      btn.hidden = true;
      el('end-name').hidden = true;
    } catch (e) {
      // 送り直して通りうる失敗（つながらない・混んでいる・今日の回数切れ・時間切れ）だけ、送り直せるよう残す
      if (canRetry(e)) {
        store.set(UNSENT_KEY, JSON.stringify({ log, name }));
        setEndRank(tr('send_fail', { e: e.message }));
        btn.disabled = false;
        el('end-name').disabled = false;
      } else setEndRank(tr('send_ng', { e: e.message }));
    }
  }
  // サーバーが中身を見て断った（ハートが尽きた・同じ記録がある・版が違う など）なら、送り直しても同じなので残さない
  const canRetry = (e) => !e.reason || ['busy', 'quota', 'gone', 'server'].includes(e.code);
  el('end-send').addEventListener('click', () => {
    const name = cleanName(el('end-name').value);
    if (!name) {
      setEndRank(tr('need_name'));
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
    el('rank-mode').textContent = tr('tower', { v: modeName(rankMode === 'hard') });
    el('rank-board').textContent = tr(rankBoard === 'time' ? 'board_time' : 'board_winds');
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
      status.textContent = tr('rank_soon');
      return;
    }
    status.textContent = tr('loading');
    const my = ++rankReq;
    try {
      const r = await api(`/api/top?mode=${rankMode}&board=${rankBoard}&pid=${pid}`);
      if (my !== rankReq) return;
      status.textContent = r.rows.length ? (r.me ? tr('rank_me', { r: r.me.rank, t: r.total }) : tr('rank_total', { t: r.total })) : tr('rank_empty');
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
        val.textContent = rankBoard === 'time' ? fmtSteps(row.steps) : tr('times', { n: row.winds.toLocaleString() });
        li.append(no, name, val);
        if (row.hasLog) {
          const g = document.createElement('button');
          g.type = 'button';
          g.textContent = tr('ghost_btn');
          g.addEventListener('click', () => takeGhost(row.id, row.name));
          li.appendChild(g);
        }
        list.appendChild(li);
      });
    } catch (e) {
      if (my === rankReq) status.textContent = tr('conn_fail', { e: e.message });
    }
  }
  async function takeGhost(id, name) {
    try {
      const r = await api(`/api/log?id=${encodeURIComponent(id)}`);
      if (!r.log || r.log.rules !== RULES) throw new Error(tr('ghost_ver'));
      store.set(GHOST_LOG + 'rank', JSON.stringify(r.log));
      ghostMode = 'rank';
      store.set(GHOST_KEY, ghostMode);
      if (started) setupGhost();
      toast(tr('ghost_take', { n: name, m: modeName(!!r.log.hard) }));
    } catch (e) {
      toast(tr('ghost_fail', { e: e.message }));
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
    el('rank-status').textContent = tr('resending');
    try {
      await submitRun(u.log, u.name, (p) => (el('rank-status').textContent = tr('verifying', { p: Math.round(p * 100) })));
      store.del(UNSENT_KEY);
    } catch (e) {
      if (!canRetry(e)) {
        store.del(UNSENT_KEY);
        refreshRankTabs();
      }
      el('rank-status').textContent = tr('send_fail2', { e: e.message });
      return;
    }
    loadRank();
  });

  // ---------- 結果の投稿と画像 ----------
  // lastResult: いちばん最近の結果（鐘を鳴らした・力尽きた）
  let lastResult = null;
  function shareText(r) {
    const tag = r.hard ? tr('share_tag_hard') : '';
    const body = r.kind === 'clear'
      ? tr('share_clear', { tag, t: fmtSteps(r.steps), w: r.winds.toLocaleString(), h: r.hearts })
      : tr('share_over', { tag, f: level.screenCount - screenOfY(r.top) });
    return `${body} ${tr('hashtag')}`;
  }
  // 1200×630 の結果の絵（左にゲームの画面、右に結果）
  function makeCard(r) {
    const W = 1200, H = 630;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0d0b12';
    g.fillRect(0, 0, W, H);
    const game = el('game');
    const gh = H - 60, gw = Math.round((gh * game.width) / game.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(game, 30, 30, gw, gh);
    g.strokeStyle = '#4a3a28';
    g.lineWidth = 3;
    g.strokeRect(30, 30, gw, gh);
    const x = 30 + gw + 50, maxW = W - x - 30;
    const font = (px) => `${px}px "DotGothic16", "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#e8b54a';
    g.font = font(60);
    g.fillText(tr('title'), x, 112, maxW);
    g.fillStyle = '#f1e6cf';
    g.font = font(44);
    g.fillText(tr(r.kind === 'clear' ? 'h_end' : 'h_over'), x, 190, maxW);
    const hearts = '♥'.repeat(r.hearts) + '♡'.repeat(Math.max(0, P.hearts - r.hearts));
    const lines = r.kind === 'clear'
      ? [[tr('d_mode'), modeName(r.hard)], [tr('d_time'), fmtSteps(r.steps)], [tr('d_winds'), tr('times', { n: r.winds.toLocaleString() })], [tr('d_hearts'), hearts]]
      : [[tr('d_mode'), modeName(r.hard)], [tr('d_top'), floorLabel(screenOfY(r.top))], [tr('d_time'), fmtSteps(r.steps)], [tr('d_jumps'), String(r.jumps)]];
    g.font = font(30);
    lines.forEach(([k, v], i) => {
      const y = 270 + i * 56;
      g.fillStyle = '#a8977e';
      g.fillText(k, x, y, maxW * 0.5);
      g.fillStyle = k === tr('d_hearts') ? '#e8394a' : '#f1e6cf';
      g.fillText(v, x + maxW * 0.5, y, maxW * 0.5);
    });
    g.fillStyle = '#a8977e';
    g.font = font(22);
    g.fillText(PUBLIC_URL.replace(/^https:\/\//, ''), x, H - 46, maxW);
    return new Promise((ok) => {
      try {
        c.toBlob((b) => ok(b), 'image/png');
      } catch (e) {
        ok(null);
      }
    });
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function copyText(s) {
    try {
      await navigator.clipboard.writeText(s);
      return true;
    } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = s;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }
  // スマホは共有の画面（画像つき）、パソコンは X の投稿画面を開く。どちらもだめなら文をコピーする
  async function shareResult() {
    if (!lastResult) return;
    const text = shareText(lastResult);
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        const blob = await makeCard(lastResult);
        const file = blob && typeof File === 'function' ? new File([blob], 'zenmai-tower.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ text: `${text} ${PUBLIC_URL}`, files: [file] });
        else await navigator.share({ text, url: PUBLIC_URL });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    let w = null;
    try {
      w = window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PUBLIC_URL)}`, '_blank');
    } catch (e) {}
    if (w) {
      try {
        w.opener = null;
      } catch (e) {}
      return;
    }
    if (await copyText(`${text} ${PUBLIC_URL}`)) toast(tr('copied'));
  }
  async function saveImage() {
    if (!lastResult) return;
    try {
      const blob = await makeCard(lastResult);
      if (!blob) throw new Error('no image');
      download(blob, 'zenmai-tower.png');
      toast(tr('img_saved'));
    } catch (e) {
      toast(tr('img_fail'));
    }
  }
  el('end-share').addEventListener('click', shareResult);
  el('over-share').addEventListener('click', shareResult);
  el('end-img').addEventListener('click', saveImage);
  el('over-img').addEventListener('click', saveImage);

  // ---------- 記録の引き継ぎ（パソコンとスマホで同じ記録を使う） ----------
  // 書き出すのは、続き・鐘を鳴らした印・記録と称号・名札（ランキングで同じ人になる）・名前・送れなかった記録・幽霊。
  // 音やことばの設定は端末ごとなので入れない。文字は「ZT1.」+ gzip の base64（gzip が使えないブラウザは「ZT0.」+ そのまま）
  const TRANSFER_KEYS = [SAVE_KEY, CLEAR_KEY, REC_KEY, PID_KEY, NAME_KEY, UNSENT_KEY, GHOST_LOG + 'prev', GHOST_LOG + 'best-0', GHOST_LOG + 'best-1', GHOST_LOG + 'rank'];
  const TRANSFER_MAX = 8_000_000;
  function b64enc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64dec(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const pipeBytes = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  async function packSave() {
    writeSave();
    const d = {};
    for (const k of TRANSFER_KEYS) {
      const v = store.get(k);
      if (v !== null) d[k] = v;
    }
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, d }));
    if (typeof CompressionStream === 'function') {
      try {
        return `ZT1.${b64enc(await pipeBytes(bytes, new CompressionStream('gzip')))}`;
      } catch (e) {}
    }
    return `ZT0.${b64enc(bytes)}`;
  }
  // 読めないときは null（形・キー・値の種類を確かめる。中身の正しさは、ゲームが読むときにいつもどおり確かめる）
  async function unpackSave(text) {
    const s = String(text || '').replace(/\s+/g, '');
    if (s.length > TRANSFER_MAX) return null;
    const m = /^ZT([01])\.([A-Za-z0-9+/]+=*)$/.exec(s);
    if (!m) return null;
    try {
      let bytes = b64dec(m[2]);
      if (m[1] === '1') bytes = await pipeBytes(bytes, new DecompressionStream('gzip'));
      const o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!o || o.v !== 1 || !o.d || typeof o.d !== 'object' || Array.isArray(o.d)) return null;
      const out = {};
      for (const [k, v] of Object.entries(o.d)) {
        if (!TRANSFER_KEYS.includes(k) || typeof v !== 'string') return null;
        out[k] = v;
      }
      return out;
    } catch (e) {
      return null;
    }
  }
  let trConfirmUntil = 0;
  let trConfirmText = '';
  function openTransfer() {
    state = 'transfer';
    menu.hidden = true;
    trPanel.hidden = false;
    el('tr-out').hidden = true;
    el('tr-out-row').hidden = true;
    el('tr-out').value = '';
    el('tr-status').textContent = '';
    trConfirmUntil = 0;
  }
  el('btn-transfer').addEventListener('click', openTransfer);
  el('tr-back').addEventListener('click', backFromPanel);
  el('tr-export').addEventListener('click', async () => {
    try {
      const code = await packSave();
      el('tr-out').value = code;
      el('tr-out').hidden = false;
      el('tr-out-row').hidden = false;
      el('tr-status').textContent = tr('tr_made', { k: Math.max(1, Math.round(code.length / 1024)) });
    } catch (e) {
      el('tr-status').textContent = tr('tr_fail');
    }
  });
  el('tr-copy').addEventListener('click', async () => {
    el('tr-status').textContent = tr((await copyText(el('tr-out').value)) ? 'tr_copied' : 'tr_copy_fail');
  });
  el('tr-save').addEventListener('click', () => download(new Blob([el('tr-out').value], { type: 'text/plain' }), 'zenmai-tower-save.txt'));
  el('tr-file').addEventListener('click', () => el('tr-file-in').click());
  el('tr-file-in').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > TRANSFER_MAX) {
      el('tr-status').textContent = tr('tr_big');
      return;
    }
    el('tr-in').value = await f.text();
    el('tr-status').textContent = '';
  });
  // 2回押しで上書きする。読み込んだらページを読み直す（いま遊んでいる続きで上書きしないよう、先に止める）
  async function importSave(text) {
    if (!String(text || '').trim()) return 'tr_empty';
    const data = await unpackSave(text);
    if (!data) return 'tr_bad';
    if (!(trConfirmText === text && Date.now() <= trConfirmUntil)) {
      trConfirmText = text;
      trConfirmUntil = Date.now() + 4000;
      return 'tr_confirm';
    }
    trConfirmUntil = 0;
    // 途中で書けなくなったら（端末の空きが足りないなど）、読み込む前の記録に全部戻す
    const old = {};
    for (const k of TRANSFER_KEYS) old[k] = store.get(k);
    const restore = () => {
      for (const k of TRANSFER_KEYS) store.del(k);
      for (const k of TRANSFER_KEYS) if (old[k] !== null) store.set(k, old[k]);
    };
    for (const k of TRANSFER_KEYS) {
      if (k in data) {
        if (!store.set(k, data[k])) {
          restore();
          return 'tr_fail';
        }
      } else store.del(k);
    }
    // 読み直すまでの間に、いま遊んでいる続きで上書きしないよう止める
    started = false;
    dev = false;
    return 'tr_done';
  }
  el('tr-import').addEventListener('click', async () => {
    const r = await importSave(el('tr-in').value);
    el('tr-status').textContent = tr(r);
    if (r === 'tr_done') setTimeout(() => location.reload(), 700);
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
  const heartsText = () => (dev ? '♥∞' : '♥'.repeat(sim.stats.hearts) + '♡'.repeat(Math.max(0, P.hearts - sim.stats.hearts)));
  let shownScreen = -1;
  let bannerTimer = null;
  function showBanner() {
    const s = sim.screenIndex();
    banner.textContent = floorLabel(s, tr('floor_sep'));
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 1600);
  }
  // 塔の地図と、いちばん高く登った所の旗
  const TOWER_H = level.screenCount * C.SCREEN_H;
  const pct = (y) => `${Math.max(0, Math.min(100, ((y + P.dollH) / TOWER_H) * 100)).toFixed(2)}%`;
  const marks = { run: null, top: null };
  art.setMarks(marks);
  function updateMap() {
    marks.run = dev ? null : sim.stats.best;
    marks.top = dev ? null : rec.topY;
    const show = started && state === 'play';
    if (map.box.hidden === show) map.box.hidden = !show;
    if (!show) return;
    map.me.style.top = pct(sim.d.y);
    map.run.hidden = dev;
    map.run.style.top = pct(sim.stats.best);
    const top = Number.isFinite(marks.top);
    map.top.hidden = !top;
    if (top) map.top.style.top = pct(marks.top);
  }
  function updateHud() {
    const s = sim.screenIndex();
    if (s !== shownScreen) {
      if (shownScreen !== -1 && state === 'play') showBanner();
      shownScreen = s;
    }
    const area = `${dev ? tr('dev_tag') : sim.hard ? '★ ' : ''}${floorLabel(s)}`;
    if (hud.area.textContent !== area) hud.area.textContent = area;
    const cap = sim.d.state === 'winding' || sim.d.wind > 0 ? sim.d.cap : sim.groundTile() === 'K' ? P.maxWindKey : P.maxWind;
    hud.wind.textContent = tr('wind_hud', { a: Math.ceil(sim.d.wind - 1e-9), b: cap });
    hud.time.textContent = fmtTime(sim.stats.time);
    hud.winds.textContent = tr('winds_hud', { n: sim.stats.winds });
    hud.jumps.textContent = tr('jumps_hud', { n: sim.stats.jumps });
    const h = heartsText();
    if (hud.hearts.textContent !== h) hud.hearts.textContent = h;
    updateMap();
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
          if (e === 'heart') onHeart();
          if (sounds[e]) sounds[e]();
        }
        sim.events.length = 0;
        if (sim.ended) {
          finish();
          break;
        }
        if (sim.over) {
          gameOver();
          break;
        }
      }
      stepGhost();
      if (landed && noteTop()) saveRec();
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
      : runLog.over ? 'why_long'
      : runLog.rules !== RULES ? 'why_version'
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
      noteTop();
      saveRec();
      got = checkTitles(true);
      if (runLog) {
        keepGhost('prev', runLog);
        if (newBest) keepGhost(`best-${sim.hard ? 1 : 0}`, runLog);
        if (rankable(runLog)) finishedLog = runLog;
      }
      runLog = null;
    }
    lastResult = { kind: 'clear', hard: sim.hard, steps: st.steps, winds: st.winds, jumps: st.jumps, hearts: st.hearts, top: st.best };
    el('end-mode').textContent = modeName(sim.hard) + (dev ? tr('dev_suffix') : '');
    el('end-time').textContent = fmtSteps(st.steps);
    el('end-winds').textContent = tr('times', { n: st.winds.toLocaleString() });
    el('end-jumps').textContent = st.jumps;
    el('end-hearts').textContent = heartsText();
    el('end-drop').textContent = st.maxDrop ? meters(st.maxDrop) : tr('none');
    el('end-note').hidden = !unlocked;
    el('end-titles').hidden = !got.length;
    el('end-titles').textContent = got.length ? tr('new_titles', { n: got.map(titleName).join(tr('list_join')) }) : '';
    const nameBox = el('end-name');
    nameBox.value = store.get(NAME_KEY) || '';
    const canSend = !!finishedLog && !!RANK_API;
    nameBox.hidden = el('end-send').hidden = !canSend;
    nameBox.disabled = el('end-send').disabled = false;
    el('end-rank').hidden = dev;
    setEndRank(dev ? '' : !RANK_API ? tr('rank_soon') : finishedLog ? tr('rank_ready') : tr(why || 'why_none'));
    setTimeout(() => {
      if (state === 'ending') ending.hidden = false;
    }, 2600);
  }

  // ハートが尽きた: 続きを消し、1階からやり直す画面を出す（開発者モードではハートが減らないので来ない）
  function gameOver() {
    state = 'gameover';
    music.setLevel(0.45);
    input.left = input.right = input.button = false;
    toastEl.classList.remove('show');
    const st = sim.stats;
    if (!dev) {
      clearSave();
      rec.gameovers = (rec.gameovers || 0) + 1;
      noteTop();
      saveRec();
      if (runLog && runLog.ev.length >= 8) keepGhost('prev', runLog);
      runLog = null;
    }
    started = false;
    lastResult = { kind: 'over', hard: sim.hard, steps: st.steps, winds: st.winds, jumps: st.jumps, hearts: 0, top: st.best };
    el('over-mode').textContent = modeName(sim.hard);
    el('over-top').textContent = floorLabel(screenOfY(st.best));
    el('over-time').textContent = fmtSteps(st.steps);
    el('over-jumps').textContent = st.jumps;
    el('over-drop').textContent = st.maxDrop ? meters(st.maxDrop) : tr('none');
    setTimeout(() => {
      if (state === 'gameover') overPanel.hidden = false;
    }, 1600);
  }
  el('over-retry').addEventListener('click', () => {
    startRun(sim.hard);
    music.setLevel(1);
    state = 'play';
    lastT = null;
    showBanner();
  });
  el('over-menu').addEventListener('click', () => {
    overPanel.hidden = true;
    openMenu();
  });

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
  applyLang();
  refreshMenu();
  menu.hidden = false;
  requestAnimationFrame(frame);

  // 試験用の入口（画面の自動試験から使う）
  window.__zenmai = {
    sim, input, level, music, rec, RULES, warp, tr, makeCard, packSave, unpackSave, importSave, shareText,
    state: () => state,
    dev: () => dev,
    lang: () => lang,
    runLog: () => runLog,
    noLogWhy: () => tr(noLogWhy),
    ghost: () => ghostRep,
    lastResult: () => lastResult,
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
