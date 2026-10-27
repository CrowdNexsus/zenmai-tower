// ゼンマイの塔: 画面に依存しない中身（物理・操作・ステージの組み立て）
(function (root) {
  'use strict';

  const TILE = 8, COLS = 30, ROWS = 40;
  const SCREEN_W = COLS * TILE, SCREEN_H = ROWS * TILE;
  const DT = 1 / 120;
  // 物理の書き方を変えたら上げる（ランキングの記録は、同じ版どうしでしか確かめられない）
  // 3: 開き直したとき、止まるまでの時間も数える / 4: 開き直しても錆びた梁とハチの様子を引き継ぐ
  const CORE_REV = 4;

  // 三角関数と長さは、ブラウザごとに最後の桁が違うことがあるので、足し算・掛け算だけで計算する
  // （ランキングの記録をサーバーで再生したとき、遊んだ人の画面と1コマも違わないようにするため）
  const TAU = 2 * Math.PI;
  function dsin(x) {
    x -= TAU * Math.round(x / TAU);
    if (x > Math.PI / 2) x = Math.PI - x;
    else if (x < -Math.PI / 2) x = -Math.PI - x;
    const x2 = x * x;
    return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 +
      x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000 + x2 / 355687428096000))))))));
  }
  const dcos = (x) => dsin(x + Math.PI / 2);
  const dlen = (x, y) => Math.sqrt(x * x + y * y);
  // 0〜n の範囲に折り返す余り（負の数でも）
  const wrap = (x, n) => ((x % n) + n) % n;

  const P = {
    gravity: 900,
    maxFall: 420,
    walkSpeed: 60,
    maxWind: 24,
    maxWindKey: 36,
    windPerSec: 12,
    pxPerUnit: 8,
    oilFactor: 2,
    honeyFactor: 0.5,
    conveyor: 36,
    jumpVx: 90,
    jumpBase: 8,
    jumpPerUnit: 3.5,
    splatHeight: 136,
    downTime: 0.9,
    dollW: 6,
    dollH: 10,
    beeHover: 42,
    beeHome: 30,
    beeRange: 96,
    beeAim: 0.65,
    beeDash: 165,
    beeDashTime: 0.6,
    beeRest: 1.3,
    beeSize: 8,
    knockVx: 100,
    knockVy: 170,
    hurtTime: 1.2,
    // 蒸気: 噴き出す前の予告と、噴いている長さ（秒）。噴いている柱の高さ（マス）
    ventWarn: 0.8,
    ventOn: 0.45,
    ventReach: 3,
    // 錆びた梁: 乗ってから崩れるまで・崩れてから戻るまで（秒）
    rustTime: 1.5,
    rustDown: 4,
    // 磁石: 届く距離（px）といちばん近くでの引く強さ（px/秒²）
    magnetRange: 92,
    magnetPull: 720,
    airMaxVx: 160,
    // 鳩時計の鳩: 予告・飛び出す・止まる・戻る（秒）と、押し出す速さ
    cuckooWarn: 1.0,
    cuckooOut: 0.2,
    cuckooHold: 0.6,
    cuckooBack: 0.3,
    cuckooVx: 140,
    cuckooVy: 110,
    // 風: 空中で横に流される強さ（px/秒²）
    windAccel: 65,
  };

  // K: ねじ巻き台（36回まで巻ける） / h: 蜂蜜の床（半分しか歩けない）
  // v: 蒸気の噴き出し口 / r: 錆びた梁（乗ると崩れる）
  const SOLID = { '#': 1, '=': 1, '>': 1, '<': 1, K: 1, h: 1, v: 1, r: 1 };

  // 画面ごとの部品の一覧から、1文字1マスの地図を作る
  function buildLevel(def) {
    const n = def.screens.length;
    const grid = [];
    let start = null;
    const bells = [];
    const movers = [];
    const bees = [];
    const vents = [];
    const magnets = [];
    const cuckoos = [];
    def.screens.forEach((scr, si) => {
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        const row = new Array(COLS).fill('.');
        row[0] = '#';
        row[COLS - 1] = '#';
        rows.push(row);
      }
      if (si === 0) rows[0].fill('#');
      if (si === n - 1) rows[ROWS - 1].fill('#');
      for (const it of scr.items) {
        const [ch, r1, c1, c2, r2 = r1] = it;
        if (r1 < 0 || r2 >= ROWS || c1 < 0 || c2 >= COLS || r1 > r2 || c1 > c2) {
          throw new Error(`画面「${scr.name}」の部品 ${JSON.stringify(it)} が画面の外にはみ出しています`);
        }
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) rows[r][c] = ch;
      }
      // 蒸気の噴き出し口: at [行, 左の列, 右の列]、period 秒ごとに phase ずらして噴く、power マスの高さまで飛ばす
      for (const v of scr.vents || []) {
        const [r, c1, c2] = v.at;
        for (let c = c1; c <= c2; c++) rows[r][c] = 'v';
        vents.push({ screen: si, row: si * ROWS + r, c1, c2, period: v.period, phase: v.phase || 0, power: v.power });
      }
      for (const m of scr.magnets || []) {
        magnets.push({ screen: si, x: m.at[1] * TILE + TILE / 2, y: (si * ROWS + m.at[0]) * TILE + TILE / 2, period: m.period || 0, phase: m.phase || 0 });
      }
      // 鳩時計: row 行の左（L）か右（R）の壁から、reach マス飛び出す
      for (const k of scr.cuckoos || []) {
        cuckoos.push({ screen: si, row: si * ROWS + k.row, side: k.side === 'R' ? 'R' : 'L', period: k.period, phase: k.phase || 0, reach: k.reach });
      }
      rows.forEach((row, r) => {
        row.forEach((ch, c) => {
          if (ch === 'B') bells.push({ x: c, y: si * ROWS + r });
        });
        grid.push(row);
      });
      if (scr.start) start = { x: scr.start[1], y: si * ROWS + scr.start[0] };
      // 動く足場: 振り子（pivot から len マス下で揺れる）と、時計の針の先（center のまわりを回る）
      for (const m of scr.movers || []) {
        const at = m.kind === 'pendulum' ? m.pivot : m.center;
        movers.push({
          kind: m.kind,
          screen: si,
          cx: at[1] * TILE + TILE / 2,
          cy: (si * ROWS + at[0]) * TILE + TILE / 2,
          len: (m.len || m.radius) * TILE,
          amp: m.amp || 0,
          period: m.period,
          phase: m.phase || 0,
          dir: m.dir === -1 ? -1 : 1,
          w: m.width * TILE,
        });
      }
      for (const [r, c] of scr.bees || []) bees.push({ x: c * TILE + TILE / 2, y: (si * ROWS + r) * TILE + TILE / 2, screen: si });
    });
    if (!start) throw new Error('スタート位置がありません');
    if (!bells.length) throw new Error('鐘がありません');
    // 錆びた梁: 横につながった r を1本の梁として、まとめて崩れる
    const rusts = [];
    const rustIdx = new Int16Array(grid.length * COLS).fill(-1);
    grid.forEach((row, ty) => {
      for (let c = 0; c < COLS; c++) {
        if (row[c] !== 'r') continue;
        let e = c;
        while (e + 1 < COLS && row[e + 1] === 'r') e++;
        for (let k = c; k <= e; k++) rustIdx[ty * COLS + k] = rusts.length;
        rusts.push({ ty, c1: c, c2: e });
        c = e;
      }
    });
    // 開発者モードの階ワープの行き先: その画面でいちばん下の、運ばれない・崩れない足場（いちばん下の画面はスタート）
    const stand = (gr, c) => SOLID[grid[gr][c]] && !'><rv'.includes(grid[gr][c]) && grid[gr - 1][c] === '.' && grid[gr - 2][c] === '.';
    const spawns = def.screens.map((scr, si) => {
      if (si === n - 1) return { x: start.x, y: start.y + 1 };
      for (let r = ROWS - 1; r >= 2; r--) {
        const gr = si * ROWS + r;
        let best = null;
        for (let c = 1; c < COLS - 1; c++) {
          if (!stand(gr, c)) continue;
          let e = c;
          while (e + 1 < COLS - 1 && stand(gr, e + 1)) e++;
          if (!best || e - c > best.e - best.c) best = { c, e };
          c = e;
        }
        if (best) return { x: Math.floor((best.c + best.e) / 2), y: gr };
      }
      return null;
    });
    return {
      grid,
      rows: grid.length,
      cols: COLS,
      start,
      bells,
      movers,
      bees,
      vents,
      magnets,
      cuckoos,
      rusts,
      rustIdx,
      spawns,
      screenCount: n,
      names: def.screens.map((s) => s.name),
      themes: def.screens.map((s) => s.theme || 'belfry'),
      // wind: { seq: [[秒, 向き(-1 左・0 なし・1 右)], …], phase }。reverse: 巻くと後ろへ歩く。dark: 停電（見た目だけ）
      winds: def.screens.map((s) => (s.wind ? { seq: s.wind.seq, phase: s.wind.phase || 0, period: s.wind.seq.reduce((a, x) => a + x[0], 0) } : null)),
      reverse: def.screens.map((s) => !!s.reverse),
      dark: def.screens.map((s) => !!s.dark),
    };
  }

  // 同じステージ・同じ数値かを見分ける印（ランキングの記録と、確かめる側の版を合わせる）
  function rulesId(def) {
    const s = JSON.stringify(def) + JSON.stringify(P) + CORE_REV;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  // ---------- 時間で決まる仕掛け（物理と見た目と音で同じ式を使う） ----------
  // 蒸気: 0 = 静か、'warn' = 予告、'on' = 噴いている
  function ventState(v, clock) {
    const p = wrap(clock + v.phase, v.period);
    if (p < P.ventOn) return 'on';
    if (p >= v.period - P.ventWarn) return 'warn';
    return 0;
  }
  function magnetOn(m, clock) {
    return !m.period || wrap(clock + m.phase, m.period) < m.period / 2;
  }
  // 鳩の伸び具合 0〜1 と、予告中か
  function cuckooExt(k, clock) {
    const p = wrap(clock + k.phase, k.period);
    const a = P.cuckooOut, b = a + P.cuckooHold, c = b + P.cuckooBack;
    if (p < a) return { ext: p / a, warn: false };
    if (p < b) return { ext: 1, warn: false };
    if (p < c) return { ext: 1 - (p - b) / P.cuckooBack, warn: false };
    return { ext: 0, warn: p >= k.period - P.cuckooWarn };
  }
  function windAt(w, clock) {
    if (!w) return 0;
    let p = wrap(clock + w.phase, w.period);
    for (const [dur, dir] of w.seq) {
      if (p < dur) return dir;
      p -= dur;
    }
    return 0;
  }
  // 次に風が変わるまでの秒数（風見鶏が先に向きを変えて知らせる）
  function windNext(w, clock) {
    if (!w) return { dir: 0, in: Infinity };
    let p = wrap(clock + w.phase, w.period);
    for (let i = 0; i < w.seq.length; i++) {
      const [dur] = w.seq[i];
      if (p < dur) return { dir: w.seq[(i + 1) % w.seq.length][1], in: dur - p };
      p -= dur;
    }
    return { dir: 0, in: Infinity };
  }
  // 停電の稲光の明るさ 0〜1（6.5秒ごとに2回光る）
  function flashAt(clock) {
    const p = wrap(clock, 6.5);
    if (p < 0.08) return 1;
    if (p < 0.2) return 0.35;
    if (p < 0.28) return 0.9;
    if (p < 1.3) return 0.6 * (1 - (p - 0.28) / 1.02);
    return 0;
  }

  function levelToText(level) {
    return level.grid.map((r) => r.join('')).join('\n');
  }

  function moverPos(m, t) {
    if (m.kind === 'pendulum') {
      const a = m.amp * dsin((TAU * t) / m.period + m.phase);
      return { x: m.cx + m.len * dsin(a) - m.w / 2, y: m.cy + m.len * dcos(a), a };
    }
    const a = (m.dir * TAU * t) / m.period + m.phase;
    return { x: m.cx + m.len * dcos(a) - m.w / 2, y: m.cy + m.len * dsin(a), a };
  }

  class Sim {
    constructor(level) {
      this.level = level;
      this.events = [];
      this.movers = level.movers.map((m) => Object.assign({ x: 0, y: 0, px: 0, py: 0, a: 0 }, m));
      // hard: むずかしい塔（巻いている間もハチに当たる） / invincible: 開発者モードの「ハチに当たらない」
      this.hard = false;
      this.invincible = false;
      // beltFlip: 本物の時報（毎正時）でベルトの向きが逆になっている
      this.beltFlip = false;
      this.reset();
    }

    reset() {
      const s = this.level.start;
      this.d = {
        x: s.x * TILE + (TILE - P.dollW) / 2,
        y: (s.y + 1) * TILE - P.dollH,
        vx: 0,
        vy: 0,
        facing: 1,
        state: 'idle',
        wind: 0,
        windAcc: 0,
        cap: P.maxWind,
        grounded: true,
        mover: -1,
        hurtT: 0,
        downT: 0,
        peakY: 0,
        stepAcc: 0,
        rev: 1,
      };
      // steps: 進めた回数（ランキングの時間はこれ÷120） / winds: 巻いた回数の合計
      // maxDrop・totalDrop: 倒れた落下のいちばん長い・合計の高さ（px） / maxDropFloors: 1回で落ちた階の数 / fullDrop: 鐘楼から1階まで落ちた
      this.stats = { time: 0, steps: 0, jumps: 0, falls: 0, winds: 0, stings: 0, maxDrop: 0, maxDropFloors: 0, totalDrop: 0, fullDrop: 0, best: this.d.y };
      this.clock = 0;
      this.resetRust();
      this.resetBees();
      this.updateMovers(false);
      this.prevButton = false;
      this.ended = false;
      this.events.length = 0;
    }

    // t: 崩れるまでの残り秒（0 = 乗っていない） / down: 崩れてから戻るまでの残り秒
    resetRust() {
      this.rust = this.level.rusts.map(() => ({ t: 0, down: 0 }));
    }

    resetBees() {
      this.bees = this.level.bees.map((b) => ({ hx: b.x, hy: b.y, x: b.x, y: b.y, vx: 0, vy: 0, mode: 'hover', t: 0, cool: 1, tx: 0, ty: 0, screen: b.screen }));
    }

    updateMovers(keepPrev) {
      for (const m of this.movers) {
        const p = moverPos(m, this.clock);
        m.px = keepPrev ? m.x : p.x;
        m.py = keepPrev ? m.y : p.y;
        m.x = p.x;
        m.y = p.y;
        m.a = p.a;
      }
    }

    snapshot() {
      return {
        d: Object.assign({}, this.d),
        stats: Object.assign({}, this.stats),
        clock: this.clock,
        bees: this.bees.map((b) => Object.assign({}, b)),
        prevButton: this.prevButton,
        ended: this.ended,
        hard: this.hard,
        beltFlip: this.beltFlip,
        rust: this.rust.map((b) => Object.assign({}, b)),
      };
    }

    restore(s) {
      Object.assign(this.d, s.d);
      Object.assign(this.stats, s.stats);
      this.clock = s.clock || 0;
      this.bees = (s.bees || []).map((b) => Object.assign({}, b));
      if (this.bees.length !== this.level.bees.length) this.resetBees();
      this.rust = (s.rust || []).map((b) => Object.assign({}, b));
      if (this.rust.length !== this.level.rusts.length) this.resetRust();
      this.updateMovers(false);
      this.prevButton = s.prevButton;
      this.ended = s.ended;
      if (typeof s.hard === 'boolean') this.hard = s.hard;
      if (typeof s.beltFlip === 'boolean') this.beltFlip = s.beltFlip;
    }

    saveData() {
      const d = this.d;
      // 錆びた梁とハチの様子も残す（開き直しで、崩れた梁が戻る・追ってくるハチが巣に帰る、を起こさないため）
      return {
        x: d.x, y: d.y, facing: d.facing, clock: this.clock, hard: this.hard, stats: Object.assign({}, this.stats),
        rust: this.rust.map((b) => ({ t: b.t, down: b.down })),
        bees: this.bees.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, mode: b.mode, t: b.t, cool: b.cool, tx: b.tx, ty: b.ty })),
      };
    }

    // 保存する位置: 今から何も操作しなかったら止まる場所。
    // 空中や倒れている間に閉じても、落ちる前の場所には戻れない（空中は操作できないので行き先は決まっている）。
    restingData() {
      if (this.ended) return null;
      const probe = new Sim(this.level);
      probe.hard = this.hard;
      probe.invincible = this.invincible;
      probe.restore(this.snapshot());
      probe.prevButton = false;
      const none = { left: false, right: false, button: false };
      // 噴き出し口の上で真上に飛ばされ続けるなど、15秒で止まらないときは、最後に立っていた場所にする
      let fallback = null, settled = false;
      for (let i = 0; i < 15 / DT; i++) {
        const d = probe.d;
        const gt = d.grounded ? probe.groundTile() : null;
        // 動く板の上で止まっているなら、その場で保存してよい（板の位置は clock で決まる）
        // ベルト・崩れる梁・噴き出し口の上は止まり続けられないので、その先まで進める
        if (d.grounded && d.state === 'idle' && gt) {
          if (!'><rv'.includes(gt)) {
            settled = true;
            break;
          }
          fallback = probe.saveData();
        }
        probe.step(none);
        if (probe.ended) return null;
      }
      // 止まるまでに進めた時間もタイムに数える（開き直して落ちる時間・倒れている時間を消せないように）
      // at: 保存した時点の手数（記録の「開き直し」はこの手に置く）
      const out = settled || !fallback ? probe.saveData() : fallback;
      out.at = this.stats.steps;
      return out;
    }

    loadData(o) {
      if (!o || typeof o !== 'object' || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return false;
      const d = this.d;
      const keep = this.snapshot();
      d.x = o.x;
      d.y = o.y;
      d.facing = o.facing === -1 ? -1 : 1;
      d.state = 'idle';
      d.wind = 0;
      d.vx = d.vy = 0;
      d.grounded = true;
      d.mover = -1;
      d.hurtT = 0;
      d.rev = 1;
      // 開き直した新しいページと同じ状態にそろえる（記録を再生したとき同じ結果になるように）
      d.windAcc = 0;
      d.cap = P.maxWind;
      d.downT = 0;
      d.peakY = 0;
      d.stepAcc = 0;
      this.ended = false;
      this.prevButton = false;
      this.hard = o.hard === true;
      this.clock = Number.isFinite(o.clock) && o.clock >= 0 ? o.clock : 0;
      this.updateMovers(false);
      this.resetBees();
      this.resetRust();
      const num = (v) => Number.isFinite(v);
      // exact: 保存のどこも、決まりの値で置き換えずに読めた（false なら記録の再生と合わないので、挑戦の記録は送れない）
      let exact = (o.facing === 1 || o.facing === -1) && typeof o.hard === 'boolean' && num(o.clock) && o.clock >= 0;
      if (Array.isArray(o.rust) && o.rust.length === this.rust.length && o.rust.every((b) => b && num(b.t) && num(b.down) && b.t >= 0 && b.down >= 0)) {
        this.rust = o.rust.map((b) => ({ t: b.t, down: b.down }));
      } else exact = false;
      if (Array.isArray(o.bees) && o.bees.length === this.bees.length &&
        o.bees.every((b) => b && ['x', 'y', 'vx', 'vy', 't', 'cool', 'tx', 'ty'].every((k) => num(b[k])) && ['hover', 'aim', 'dash', 'rest'].includes(b.mode))) {
        this.bees.forEach((h, i) => {
          const b = o.bees[i];
          Object.assign(h, { x: b.x, y: b.y, vx: b.vx, vy: b.vy, mode: b.mode, t: b.t, cool: b.cool, tx: b.tx, ty: b.ty });
        });
      } else exact = false;
      if (o.stats && typeof o.stats === 'object') {
        for (const k of ['time', 'steps', 'jumps', 'falls', 'winds', 'stings', 'maxDrop', 'maxDropFloors', 'totalDrop', 'fullDrop']) {
          const v = o.stats[k];
          if (!(Number.isFinite(v) && v >= 0)) exact = false;
          this.stats[k] = Number.isFinite(v) && v >= 0 ? v : 0;
        }
      } else exact = false;
      this.loadExact = exact;
      const best = o.stats && o.stats.best;
      this.stats.best = Math.min(Number.isFinite(best) ? best : Infinity, d.y);
      if (!this.tileGround()) {
        d.mover = this.movers.findIndex((m, i) => this.onMoverAt(i));
      }
      if (this.overlapsSolid() || !this.groundTile()) {
        this.restore(keep);
        return false;
      }
      return true;
    }

    tileAt(tx, ty) {
      if (tx < 0 || tx >= COLS) return '#';
      if (ty < 0) return '.';
      if (ty >= this.level.rows) return '#';
      const ch = this.level.grid[ty][tx];
      // 崩れている梁は無い物として扱う
      if (ch === 'r' && this.rust[this.level.rustIdx[ty * COLS + tx]].down > 0) return '.';
      return ch;
    }

    solidAt(px, py) {
      return !!SOLID[this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE))];
    }

    overlapsSolid() {
      const d = this.d;
      for (const px of [d.x + 0.01, d.x + P.dollW - 0.01]) {
        for (const py of [d.y + 0.01, d.y + P.dollH / 2, d.y + P.dollH - 0.01]) {
          if (this.solidAt(px, py)) return true;
        }
      }
      return false;
    }

    onMoverAt(i) {
      const d = this.d;
      const m = this.movers[i];
      return d.x < m.x + m.w && d.x + P.dollW > m.x && Math.abs(d.y + P.dollH - m.y) < 0.6;
    }

    tileGround() {
      const d = this.d;
      const ty = Math.floor((d.y + P.dollH + 0.01) / TILE);
      const center = this.tileAt(Math.floor((d.x + P.dollW / 2) / TILE), ty);
      if (SOLID[center]) return center;
      for (const px of [d.x + 0.01, d.x + P.dollW - 0.01]) {
        const t = this.tileAt(Math.floor(px / TILE), ty);
        if (SOLID[t]) return t;
      }
      return null;
    }

    groundTile() {
      if (this.d.mover >= 0 && this.onMoverAt(this.d.mover)) return '#';
      return this.tileGround();
    }

    screenIndex() {
      return Math.max(0, Math.min(this.level.screenCount - 1, Math.floor((this.d.y + P.dollH / 2) / SCREEN_H)));
    }

    step(input) {
      if (this.ended) return;
      const d = this.d;
      const ev = this.events;
      const press = input.button && !this.prevButton;
      this.prevButton = input.button;
      const prevClock = this.clock;
      this.stats.time += DT;
      this.stats.steps++;
      this.clock += DT;
      if (d.hurtT > 0) d.hurtT -= DT;
      if (this.rust.length) this.updateRust();

      // 動く足場に乗っていたら一緒に運ばれる
      if (this.movers.length) {
        this.updateMovers(true);
        if (d.grounded && d.mover >= 0) {
          const m = this.movers[d.mover];
          const oy = d.y;
          this.moveX(m.x - m.px, true);
          d.y = m.y - P.dollH;
          if (this.overlapsSolid()) {
            d.y = oy;
            this.leaveGround();
          }
        }
      }

      const gt = d.grounded ? this.groundTile() : null;
      const conv = (gt === '>' ? P.conveyor : gt === '<' ? -P.conveyor : 0) * (this.beltFlip ? -1 : 1);
      const steer = () => {
        if (input.left && !input.right) d.facing = -1;
        else if (input.right && !input.left) d.facing = 1;
      };

      switch (d.state) {
        case 'down':
          d.downT -= DT;
          if (d.downT <= 0) d.state = 'idle';
          d.vx = conv;
          break;
        case 'idle':
          steer();
          if (press) {
            d.state = 'winding';
            d.wind = 0;
            d.windAcc = 0;
            d.cap = gt === 'K' ? P.maxWindKey : P.maxWind;
          }
          d.vx = conv;
          break;
        case 'winding': {
          steer();
          d.cap = gt === 'K' ? P.maxWindKey : P.maxWind;
          if (input.button) {
            if (d.wind < d.cap) {
              d.windAcc += DT * P.windPerSec;
              while (d.windAcc >= 1 && d.wind < d.cap) {
                d.windAcc -= 1;
                d.wind++;
                this.stats.winds++;
                ev.push('click');
              }
            }
          } else if (d.wind > 0) {
            d.state = 'walking';
            d.stepAcc = 0;
            // 逆巻きの間では、向いている方と反対へ歩く
            d.rev = this.level.reverse[this.screenIndex()] ? -1 : 1;
            ev.push('release');
          } else {
            d.state = 'idle';
          }
          d.vx = conv;
          break;
        }
        case 'walking':
          if (press) {
            const h = P.jumpBase + P.jumpPerUnit * d.wind;
            d.vy = -Math.sqrt(2 * P.gravity * h);
            d.vx = d.facing * d.rev * P.jumpVx;
            d.wind = 0;
            d.state = 'air';
            d.grounded = false;
            d.mover = -1;
            d.peakY = d.y;
            this.stats.jumps++;
            ev.push('jump');
          } else {
            d.vx = d.facing * d.rev * P.walkSpeed + conv;
          }
          break;
        default:
          break;
      }

      if (d.state === 'walking' && d.grounded) {
        const dist = P.walkSpeed * DT;
        const per = P.pxPerUnit * (gt === '=' ? P.oilFactor : gt === 'h' ? P.honeyFactor : 1);
        d.wind -= dist / per;
        d.stepAcc += dist;
        if (d.stepAcc >= TILE) {
          d.stepAcc -= TILE;
          ev.push('step');
        }
        if (d.wind <= 1e-9) {
          d.wind = 0;
          d.state = 'idle';
          d.vx = conv;
          ev.push('stop');
        }
      }

      if (!d.grounded) {
        this.airForces();
        d.vy = Math.min(d.vy + P.gravity * DT, P.maxFall);
      }

      this.moveX(d.vx * DT);
      this.moveY(d.vy * DT);

      if (this.level.vents.length) this.updateVents(prevClock);
      if (this.level.cuckoos.length) this.updateCuckoos(prevClock);
      if (this.bees.length) this.updateBees();

      if (d.grounded) {
        if (d.mover >= 0 && !this.onMoverAt(d.mover)) d.mover = -1;
        if (!this.groundTile()) {
          if (d.state === 'winding') ev.push('unwind');
          this.leaveGround();
        } else if (this.rust.length) {
          const i = this.rustUnder();
          if (i >= 0 && this.rust[i].t === 0) {
            this.rust[i].t = P.rustTime;
            ev.push('creak');
          }
        }
      }
      const si = this.screenIndex();
      if (this.level.dark[si] && flashAt(this.clock) === 1 && flashAt(prevClock) !== 1) ev.push('thunder');
      const w = this.level.winds[si];
      if (w && windAt(w, this.clock) !== windAt(w, prevClock)) ev.push('gust');
      if (!d.grounded) d.peakY = Math.min(d.peakY, d.y);
      if (d.y < this.stats.best) this.stats.best = d.y;

      if (this.touchesBell()) {
        this.ended = true;
        ev.push('bell');
      }
    }

    leaveGround() {
      const d = this.d;
      d.grounded = false;
      d.mover = -1;
      d.peakY = d.y;
      if (d.state !== 'walking') d.wind = 0;
      d.state = 'air';
    }

    // 空中で受ける力: 磁石に引かれる・風に流される
    airForces() {
      const d = this.d;
      const si = this.screenIndex();
      let ax = 0, ay = 0;
      if (this.level.magnets.length) {
        const cx = d.x + P.dollW / 2, cy = d.y + P.dollH / 2;
        for (const m of this.level.magnets) {
          if (m.screen !== si || !magnetOn(m, this.clock)) continue;
          const dx = m.x - cx, dy = m.y - cy;
          const dist = dlen(dx, dy);
          if (dist >= P.magnetRange || dist < 1) continue;
          const a = P.magnetPull * (1 - dist / P.magnetRange);
          ax += (dx / dist) * a;
          ay += (dy / dist) * a;
        }
      }
      ax += windAt(this.level.winds[si], this.clock) * P.windAccel;
      if (ax === 0 && ay === 0) return;
      d.vx = Math.max(-P.airMaxVx, Math.min(P.airMaxVx, d.vx + ax * DT));
      d.vy += ay * DT;
    }

    updateRust() {
      for (let i = 0; i < this.rust.length; i++) {
        const b = this.rust[i];
        if (b.t > 0) {
          b.t -= DT;
          if (b.t <= 1e-9) {
            b.t = 0;
            b.down = P.rustDown;
            this.events.push('crumble');
          }
        } else if (b.down > 0) {
          b.down -= DT;
          // 戻るとき人形が梁の場所にいたら、どくまで待つ
          if (b.down <= 1e-9) b.down = this.overlapsRust(i) ? DT : 0;
        }
      }
    }

    overlapsRust(i) {
      const d = this.d, r = this.level.rusts[i];
      return d.x < (r.c2 + 1) * TILE && d.x + P.dollW > r.c1 * TILE && d.y < (r.ty + 1) * TILE && d.y + P.dollH > r.ty * TILE;
    }

    // 足の下の崩れていない錆びた梁（無ければ -1）
    rustUnder() {
      const d = this.d;
      if (d.mover >= 0) return -1;
      const ty = Math.floor((d.y + P.dollH + 0.01) / TILE);
      for (const px of [d.x + P.dollW / 2, d.x + 0.01, d.x + P.dollW - 0.01]) {
        const tx = Math.floor(px / TILE);
        if (this.tileAt(tx, ty) === 'r') return this.level.rustIdx[ty * COLS + tx];
      }
      return -1;
    }

    // 蒸気: 噴いている柱に入ると真上へ飛ばされる（歩いていた勢いはそのまま）
    updateVents(prevClock) {
      const d = this.d;
      const si = this.screenIndex();
      for (const v of this.level.vents) {
        if (v.screen !== si) continue;
        const st = ventState(v, this.clock);
        const was = ventState(v, prevClock);
        if (st !== was) this.events.push(st === 'on' ? 'steam' : st === 'warn' ? 'hiss' : 'steamEnd');
        if (st !== 'on' || d.state === 'down') continue;
        const top = v.row * TILE;
        const feet = d.y + P.dollH;
        if (d.x >= (v.c2 + 1) * TILE || d.x + P.dollW <= v.c1 * TILE) continue;
        if (feet > top + 0.6 || feet < top - P.ventReach * TILE) continue;
        const vy = -Math.sqrt(2 * P.gravity * v.power * TILE);
        if (d.vy <= vy * 0.6) continue;
        if (d.state === 'winding') this.events.push('unwind');
        d.vy = vy;
        d.grounded = false;
        d.mover = -1;
        d.wind = 0;
        d.state = 'air';
        d.peakY = d.y;
        this.events.push('launch');
      }
    }

    // 鳩時計: 飛び出した鳩に触れると、壁と反対へ押し出される
    updateCuckoos(prevClock) {
      const d = this.d;
      const si = this.screenIndex();
      for (const k of this.level.cuckoos) {
        if (k.screen !== si) continue;
        const now = cuckooExt(k, this.clock), was = cuckooExt(k, prevClock);
        if (now.warn && !was.warn) this.events.push('cuckoo');
        if (now.ext <= 0 || d.hurtT > 0 || d.state === 'down' || this.invincible) continue;
        const len = TILE * (1 + k.reach * now.ext);
        const x1 = k.side === 'L' ? 0 : SCREEN_W - len, x2 = k.side === 'L' ? len : SCREEN_W;
        const y1 = (k.row - 1) * TILE, y2 = (k.row + 1) * TILE;
        if (d.x >= x2 || d.x + P.dollW <= x1 || d.y >= y2 || d.y + P.dollH <= y1) continue;
        const dir = k.side === 'L' ? 1 : -1;
        if (d.state === 'winding') this.events.push('unwind');
        d.vx = dir * P.cuckooVx;
        d.vy = -P.cuckooVy;
        d.facing = dir;
        d.state = 'air';
        d.grounded = false;
        d.mover = -1;
        d.wind = 0;
        d.peakY = d.y;
        d.hurtT = 0.5;
        this.events.push('peck');
      }
    }

    updateBees() {
      const d = this.d;
      const ds = this.screenIndex();
      const dcx = d.x + P.dollW / 2, dcy = d.y + P.dollH / 2;
      for (const b of this.bees) {
        const active = b.screen === ds;
        b.t -= DT;
        b.cool -= DT;
        if (b.mode === 'hover') {
          const tx = active ? dcx : b.hx;
          const ty = active ? dcy - 26 : b.hy;
          const sp = active ? P.beeHover : P.beeHome;
          const dx = tx - b.x, dy = ty - b.y;
          const dist = dlen(dx, dy);
          const k = Math.min(1, DT * 2.5);
          b.vx += ((dist > 1 ? (dx / dist) * sp : 0) - b.vx) * k;
          b.vy += ((dist > 1 ? (dy / dist) * sp : 0) - b.vy) * k;
          if (active && b.cool <= 0 && d.hurtT <= 0 && d.state !== 'down' && dlen(dcx - b.x, dcy - b.y) < P.beeRange) {
            b.mode = 'aim';
            b.t = P.beeAim;
            b.tx = dcx;
            b.ty = dcy;
            this.events.push('buzz');
          }
        } else if (b.mode === 'aim') {
          b.vx *= 0.85;
          b.vy *= 0.85;
          if (b.t <= 0) {
            const dx = b.tx - b.x, dy = b.ty - b.y;
            const dist = dlen(dx, dy) || 1;
            b.vx = (dx / dist) * P.beeDash;
            b.vy = (dy / dist) * P.beeDash;
            b.mode = 'dash';
            b.t = P.beeDashTime;
          }
        } else if (b.mode === 'dash') {
          if (b.t <= 0) {
            b.mode = 'rest';
            b.t = P.beeRest;
          }
        } else {
          b.vx *= 0.96;
          b.vy = b.vy * 0.96 - 0.3;
          if (b.t <= 0) {
            b.mode = 'hover';
            b.cool = 0.6;
          }
        }
        b.x = Math.max(TILE + 4, Math.min(SCREEN_W - TILE - 4, b.x + b.vx * DT));
        const top = b.screen * SCREEN_H + TILE * 2;
        b.y = Math.max(top, Math.min(top + SCREEN_H - TILE * 4, b.y + b.vy * DT));
        const half = P.beeSize / 2;
        if ((b.mode === 'dash' || b.mode === 'hover') && d.hurtT <= 0 && d.state !== 'down' && !this.invincible &&
            Math.abs(b.x - dcx) < P.dollW / 2 + half && Math.abs(b.y - dcy) < P.dollH / 2 + half) {
          const dir = Math.sign(dcx - b.x) || (b.vx >= 0 ? 1 : -1);
          // ふつうの塔では、巻いている間はハチを弾き返す（当たらない）
          if (!this.hard && d.state === 'winding') {
            if (b.mode === 'dash') {
              b.mode = 'rest';
              b.t = P.beeRest;
              b.vx = -dir * 70;
              b.vy = -50;
              this.events.push('guard');
            }
            continue;
          }
          d.vx = dir * P.knockVx;
          d.vy = -P.knockVy;
          d.state = 'air';
          d.grounded = false;
          d.mover = -1;
          d.wind = 0;
          d.peakY = d.y;
          d.hurtT = P.hurtTime;
          this.stats.stings++;
          b.mode = 'rest';
          b.t = P.beeRest;
          b.vx = -dir * 40;
          b.vy = -40;
          this.events.push('sting');
        }
      }
    }

    moveX(dx, carried) {
      if (dx === 0) return;
      const d = this.d;
      let nx = d.x + dx;
      const r1 = Math.floor((d.y + 0.01) / TILE);
      const r2 = Math.floor((d.y + P.dollH - 0.01) / TILE);
      let hit = false;
      if (dx > 0) {
        const tx = Math.floor((nx + P.dollW - 1e-6) / TILE);
        for (let r = r1; r <= r2; r++) {
          if (SOLID[this.tileAt(tx, r)]) {
            nx = tx * TILE - P.dollW;
            hit = true;
            break;
          }
        }
      } else {
        const tx = Math.floor(nx / TILE);
        for (let r = r1; r <= r2; r++) {
          if (SOLID[this.tileAt(tx, r)]) {
            nx = (tx + 1) * TILE;
            hit = true;
            break;
          }
        }
      }
      d.x = nx;
      if (!hit || carried) return;
      if (d.state === 'air') {
        d.vx = -d.vx;
        d.facing = -d.facing;
        this.events.push('bonk');
      } else if (d.state === 'walking') {
        d.facing = -d.facing;
        this.events.push('turn');
      }
    }

    moveY(dy) {
      if (dy === 0) return;
      const d = this.d;
      const c1 = Math.floor((d.x + 0.01) / TILE);
      const c2 = Math.floor((d.x + P.dollW - 0.01) / TILE);
      if (dy > 0) {
        let landY = null;
        let moverIdx = -1;
        const ty = Math.floor((d.y + dy + P.dollH - 1e-6) / TILE);
        for (let c = c1; c <= c2; c++) {
          if (SOLID[this.tileAt(c, ty)]) {
            landY = ty * TILE - P.dollH;
            break;
          }
        }
        const feet0 = d.y + P.dollH, feet1 = feet0 + dy;
        this.movers.forEach((m, i) => {
          if (d.x < m.x + m.w && d.x + P.dollW > m.x && feet0 <= Math.max(m.y, m.py) + 0.5 && feet1 >= m.y) {
            const y = m.y - P.dollH;
            if (landY === null || y < landY) {
              landY = y;
              moverIdx = i;
            }
          }
        });
        if (landY !== null) {
          d.y = landY;
          this.land();
          d.mover = moverIdx;
          return;
        }
        d.y += dy;
      } else {
        const ty = Math.floor((d.y + dy) / TILE);
        for (let c = c1; c <= c2; c++) {
          if (SOLID[this.tileAt(c, ty)]) {
            d.y = (ty + 1) * TILE;
            d.vy = 0;
            this.events.push('bonk');
            return;
          }
        }
        d.y += dy;
      }
    }

    land() {
      const d = this.d;
      const fall = d.y - d.peakY;
      d.vy = 0;
      d.grounded = true;
      d.mover = -1;
      if (fall > P.splatHeight) {
        d.state = 'down';
        d.downT = P.downTime;
        d.wind = 0;
        const st = this.stats;
        st.falls++;
        st.totalDrop += fall;
        st.maxDrop = Math.max(st.maxDrop, fall);
        const top = Math.floor((d.peakY + P.dollH / 2) / SCREEN_H), here = this.screenIndex();
        st.maxDropFloors = Math.max(st.maxDropFloors, here - top);
        if (top === 0 && here === this.level.screenCount - 1) st.fullDrop = 1;
        this.events.push('splat');
      } else {
        this.events.push('land');
        d.state = d.wind > 0 ? 'walking' : 'idle';
      }
    }

    touchesBell() {
      const d = this.d;
      for (const b of this.level.bells) {
        const bx = b.x * TILE, by = b.y * TILE;
        if (d.x < bx + TILE && d.x + P.dollW > bx && d.y < by + TILE && d.y + P.dollH > by) return true;
      }
      return false;
    }
  }

  // ---------- 挑戦の記録（ランキングの確かめと、幽霊の再生に使う） ----------
  // log = { rules, hard, flip, ev: [何手後, 中身, 何手後, 中身, …] }
  // 中身: 0〜7 = 入力（1 左・2 右・4 ボタン）、8 = 閉じて開き直した（止まる場所まで進めて置き直す。進めた手数も数え、次の手はそこから数える）、10・11 = ベルトの向き（11 が逆）
  const LOG = { RESUME: 8, FLIP_OFF: 10, FLIP_ON: 11, MAX_STEPS: 120 * 60 * 60 * 3 };

  class Replayer {
    constructor(level, log) {
      this.sim = new Sim(level);
      this.error = null;
      const ev = log && log.ev;
      if (!Array.isArray(ev) || ev.length % 2) {
        this.error = '記録の形が違う';
        this.ev = [];
      } else this.ev = ev;
      this.sim.hard = !!(log && log.hard);
      this.sim.beltFlip = !!(log && log.flip);
      this.i = 0;
      this.at = this.ev.length ? this.ev[0] : Infinity;
      this.tail = 0;
      this.bits = 0;
    }

    get done() {
      return this.sim.ended || !!this.error;
    }

    applyCode(code) {
      const sim = this.sim;
      if (Number.isInteger(code) && code >= 0 && code < 8) this.bits = code;
      else if (code === LOG.RESUME) {
        const data = sim.restingData();
        if (!data || !sim.loadData(data)) this.error = '置き直せない';
        sim.prevButton = false;
        this.bits = 0;
      } else if (code === LOG.FLIP_OFF || code === LOG.FLIP_ON) sim.beltFlip = code === LOG.FLIP_ON;
      else this.error = '知らない中身';
    }

    // limit 手まで、または終わるまで進める。進めた手数を返す。untilSteps を渡すとその手数で止める（幽霊用）
    run(limit, untilSteps = Infinity) {
      const sim = this.sim;
      const input = { left: false, right: false, button: false };
      let n = 0;
      while (n < limit && !this.done && sim.stats.steps < untilSteps) {
        while (this.at === sim.stats.steps && !this.error) {
          const code = this.ev[this.i + 1];
          this.applyCode(code);
          this.i += 2;
          const dt = this.ev[this.i];
          // 開き直しは止まる所まで手数が進むので、次の手はそこから数える
          const base = code === LOG.RESUME ? sim.stats.steps : this.at;
          this.at = this.i < this.ev.length ? (Number.isInteger(dt) && dt >= 0 ? base + dt : NaN) : Infinity;
          // tail: 最後の手を入れた手数（記録が尽きた後、いつまで待つかの目安）
          if (this.at === Infinity) this.tail = sim.stats.steps;
        }
        if (this.error) break;
        // 開き直しで手数が untilSteps を越えたら、そこで止める（幽霊・区切りの位置がずれないように）
        if (sim.stats.steps >= untilSteps) break;
        if (!(this.at > sim.stats.steps)) {
          this.error = '手の順番がおかしい';
          break;
        }
        if (sim.stats.steps >= LOG.MAX_STEPS) {
          this.error = '長すぎる';
          break;
        }
        input.left = !!(this.bits & 1);
        input.right = !!(this.bits & 2);
        input.button = !!(this.bits & 4);
        sim.step(input);
        sim.events.length = 0;
        n++;
      }
      return n;
    }

    // 途中で止めて、続きを別の時に進めるための写し（サーバーで少しずつ確かめる）
    save() {
      return { s: this.sim.snapshot(), i: this.i, at: this.at === Infinity ? -1 : this.at, bits: this.bits, tail: this.tail };
    }

    load(o) {
      this.sim.restore(o.s);
      this.i = o.i;
      this.at = o.at === -1 ? Infinity : o.at;
      this.bits = o.bits;
      this.tail = o.tail || 0;
    }
  }

  const api = {
    TILE, COLS, ROWS, SCREEN_W, SCREEN_H, DT, P, SOLID, LOG, CORE_REV,
    buildLevel, levelToText, rulesId, moverPos, ventState, magnetOn, cuckooExt, windAt, windNext, flashAt, dsin, dcos, Sim, Replayer,
  };
  root.ZenmaiCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
