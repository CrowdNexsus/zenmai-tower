// ゼンマイの塔: 画面に依存しない中身（物理・操作・ステージの組み立て）
(function (root) {
  'use strict';

  const TILE = 8, COLS = 30, ROWS = 40;
  const SCREEN_W = COLS * TILE, SCREEN_H = ROWS * TILE;
  const DT = 1 / 120;

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
  };

  // K: ねじ巻き台（36回まで巻ける） / h: 蜂蜜の床（半分しか歩けない）
  const SOLID = { '#': 1, '=': 1, '>': 1, '<': 1, K: 1, h: 1 };

  // 画面ごとの部品の一覧から、1文字1マスの地図を作る
  function buildLevel(def) {
    const n = def.screens.length;
    const grid = [];
    let start = null;
    const bells = [];
    const movers = [];
    const bees = [];
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
    // 開発者モードの階ワープの行き先: その画面でいちばん下の、運ばれない足場（いちばん下の画面はスタート）
    const stand = (gr, c) => SOLID[grid[gr][c]] && grid[gr][c] !== '>' && grid[gr][c] !== '<' && grid[gr - 1][c] === '.' && grid[gr - 2][c] === '.';
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
      spawns,
      screenCount: n,
      names: def.screens.map((s) => s.name),
      themes: def.screens.map((s) => s.theme || 'belfry'),
    };
  }

  function levelToText(level) {
    return level.grid.map((r) => r.join('')).join('\n');
  }

  function moverPos(m, t) {
    if (m.kind === 'pendulum') {
      const a = m.amp * Math.sin((2 * Math.PI * t) / m.period + m.phase);
      return { x: m.cx + m.len * Math.sin(a) - m.w / 2, y: m.cy + m.len * Math.cos(a), a };
    }
    const a = (m.dir * 2 * Math.PI * t) / m.period + m.phase;
    return { x: m.cx + m.len * Math.cos(a) - m.w / 2, y: m.cy + m.len * Math.sin(a), a };
  }

  class Sim {
    constructor(level) {
      this.level = level;
      this.events = [];
      this.movers = level.movers.map((m) => Object.assign({ x: 0, y: 0, px: 0, py: 0, a: 0 }, m));
      // hard: むずかしい塔（巻いている間もハチに当たる） / invincible: 開発者モードの「ハチに当たらない」
      this.hard = false;
      this.invincible = false;
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
      };
      this.stats = { time: 0, jumps: 0, falls: 0, best: this.d.y };
      this.clock = 0;
      this.resetBees();
      this.updateMovers(false);
      this.prevButton = false;
      this.ended = false;
      this.events.length = 0;
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
      };
    }

    restore(s) {
      Object.assign(this.d, s.d);
      Object.assign(this.stats, s.stats);
      this.clock = s.clock || 0;
      this.bees = (s.bees || []).map((b) => Object.assign({}, b));
      if (this.bees.length !== this.level.bees.length) this.resetBees();
      this.updateMovers(false);
      this.prevButton = s.prevButton;
      this.ended = s.ended;
      if (typeof s.hard === 'boolean') this.hard = s.hard;
    }

    saveData() {
      const d = this.d;
      return { x: d.x, y: d.y, facing: d.facing, clock: this.clock, hard: this.hard, stats: Object.assign({}, this.stats) };
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
      for (let i = 0; i < 15 / DT; i++) {
        const d = probe.d;
        const gt = d.grounded ? probe.groundTile() : null;
        // 動く板の上で止まっているなら、その場で保存してよい（板の位置は clock で決まる）
        if (d.grounded && d.state === 'idle' && gt !== '>' && gt !== '<') break;
        probe.step(none);
        if (probe.ended) return null;
      }
      const out = probe.saveData();
      out.stats.time = this.stats.time;
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
      this.hard = o.hard === true;
      this.clock = Number.isFinite(o.clock) && o.clock >= 0 ? o.clock : 0;
      this.updateMovers(false);
      this.resetBees();
      if (o.stats && typeof o.stats === 'object') {
        for (const k of ['time', 'jumps', 'falls']) {
          const v = o.stats[k];
          this.stats[k] = Number.isFinite(v) && v >= 0 ? v : 0;
        }
      }
      this.stats.best = Math.min(this.stats.best, d.y);
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
      return this.level.grid[ty][tx];
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
      this.stats.time += DT;
      this.clock += DT;
      if (d.hurtT > 0) d.hurtT -= DT;

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
      const conv = gt === '>' ? P.conveyor : gt === '<' ? -P.conveyor : 0;
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
                ev.push('click');
              }
            }
          } else if (d.wind > 0) {
            d.state = 'walking';
            d.stepAcc = 0;
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
            d.vx = d.facing * P.jumpVx;
            d.wind = 0;
            d.state = 'air';
            d.grounded = false;
            d.mover = -1;
            d.peakY = d.y;
            this.stats.jumps++;
            ev.push('jump');
          } else {
            d.vx = d.facing * P.walkSpeed + conv;
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

      if (!d.grounded) d.vy = Math.min(d.vy + P.gravity * DT, P.maxFall);

      this.moveX(d.vx * DT);
      this.moveY(d.vy * DT);

      if (this.bees.length) this.updateBees();

      if (d.grounded) {
        if (d.mover >= 0 && !this.onMoverAt(d.mover)) d.mover = -1;
        if (!this.groundTile()) {
          if (d.state === 'winding') ev.push('unwind');
          this.leaveGround();
        }
      }
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
          const dist = Math.hypot(dx, dy);
          const k = Math.min(1, DT * 2.5);
          b.vx += ((dist > 1 ? (dx / dist) * sp : 0) - b.vx) * k;
          b.vy += ((dist > 1 ? (dy / dist) * sp : 0) - b.vy) * k;
          if (active && b.cool <= 0 && d.hurtT <= 0 && d.state !== 'down' && Math.hypot(dcx - b.x, dcy - b.y) < P.beeRange) {
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
            const dist = Math.hypot(dx, dy) || 1;
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
        this.stats.falls++;
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

  const api = { TILE, COLS, ROWS, SCREEN_W, SCREEN_H, DT, P, SOLID, buildLevel, levelToText, moverPos, Sim };
  root.ZenmaiCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
