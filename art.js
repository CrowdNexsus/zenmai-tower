// ゼンマイの塔: 見た目（ドット絵の描画）。物理の1pxを2pxで描く。
(function (root) {
  'use strict';

  const C = root.ZenmaiCore;
  const S = 2;
  const W = C.SCREEN_W * S, H = C.SCREEN_H * S, T = C.TILE * S;

  // ---------- 道具 ----------
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function hash(a, b, c) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((c || 0) | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rect(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  }
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 1画素ずつ色を決めて描く（輪郭がにじまない）
  function shape(w, h, fn) {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = fn(x, y);
        if (!col) continue;
        const [r, gg, b] = hexRgb(col);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = gg;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function sprite(rows, pal) {
    const w = rows[0].length;
    rows.forEach((r, i) => {
      if (r.length !== w) throw new Error(`絵の${i}行目の幅が${r.length}（${w}のはず）`);
    });
    return shape(w, rows.length, (x, y) => pal[rows[y][x]] || null);
  }
  function glow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---------- 階ごとの色 ----------
  const THEMES = {
    workshop: {
      bg: '#1a120e', brick: ['#271b14', '#2c1f17', '#231812'], mortar: '#120c09',
      wall: { mid: '#5e4838', light: '#7a604b', top: '#b39070', dark: '#36281e' },
      glow: '255,168,80', lights: [[70, 470, 150, 0.3], [400, 150, 130, 0.25], [250, 300, 120, 0.12]],
      plat: 'wood',
    },
    oil: {
      bg: '#0f1517', brick: ['#182124', '#1c2629', '#151d20'], mortar: '#0a0f10',
      wall: { mid: '#3f4b51', light: '#55646b', top: '#8a9ba3', dark: '#252e32' },
      glow: '170,140,255', lights: [[240, 330, 230, 0.18], [430, 90, 100, 0.2]],
      plat: 'iron',
    },
    gears: {
      bg: '#18120e', brick: ['#271d15', '#2c2118', '#231a13'], mortar: '#110c08',
      wall: { mid: '#5f4b3a', light: '#776049', top: '#b09070', dark: '#3a2d22' },
      glow: '255,190,90', lights: [[90, 160, 160, 0.22], [400, 520, 170, 0.2]],
      plat: 'brass',
    },
    beams: {
      bg: '#141117', brick: ['#201b24', '#241e29', '#1c1820'], mortar: '#0c0a0f',
      wall: { mid: '#544a59', light: '#6a5e70', top: '#a395aa', dark: '#332c37' },
      glow: '255,228,170', lights: [[240, 250, 230, 0.2]],
      plat: 'beam',
    },
    belfry: {
      bg: '#0f0d18', brick: ['#1c1929', '#201c2e', '#191624'], mortar: '#0a0911',
      wall: { mid: '#4b4562', light: '#5f587b', top: '#9d95bd', dark: '#2d293d' },
      glow: '170,190,255', lights: [[240, 150, 210, 0.18]],
      plat: 'stone',
    },
    winding: {
      bg: '#121817', brick: ['#1b2322', '#1f2827', '#181f1e'], mortar: '#0b100f',
      wall: { mid: '#4c5a55', light: '#62716b', top: '#a3b5ad', dark: '#2e3734' },
      glow: '255,200,120', lights: [[90, 540, 160, 0.25], [400, 150, 150, 0.22]],
      plat: 'brass',
    },
    pendulum: {
      bg: '#12111b', brick: ['#1c1a28', '#201e2d', '#191724'], mortar: '#0a0910',
      wall: { mid: '#4f4a63', light: '#655f7d', top: '#a9a2c4', dark: '#302c3e' },
      glow: '230,210,160', lights: [[240, 110, 220, 0.2], [240, 520, 160, 0.12]],
      plat: 'beam',
    },
    hive: {
      bg: '#120c05', brick: ['#20160a', '#23180b', '#1d1409'], mortar: '#0e0904',
      wall: { mid: '#6b4a1c', light: '#86602a', top: '#d9a54a', dark: '#3e2a0f' },
      glow: '255,180,60', lights: [[110, 210, 170, 0.14], [380, 470, 170, 0.14]],
      plat: 'comb', hex: true,
    },
    queen: {
      bg: '#120806', brick: ['#21100a', '#24120b', '#1d0e09'], mortar: '#0e0504',
      wall: { mid: '#6b3a1c', light: '#86502a', top: '#d98a4a', dark: '#3e1f0f' },
      glow: '255,120,60', lights: [[240, 300, 240, 0.14]],
      plat: 'comb', hex: true,
    },
    clock: {
      bg: '#0e111e', brick: ['#171b2c', '#1b1f32', '#151928'], mortar: '#090b14',
      wall: { mid: '#4a5070', light: '#5f668a', top: '#a0a8cc', dark: '#2c3046' },
      glow: '255,236,190', lights: [[240, 330, 260, 0.12]],
      plat: 'stone',
    },
    steam: {
      bg: '#12100e', brick: ['#1f1a16', '#231d18', '#1b1612'], mortar: '#0c0a08',
      wall: { mid: '#5a4a40', light: '#72604f', top: '#b39a80', dark: '#352b24' },
      glow: '255,170,110', lights: [[60, 560, 170, 0.22], [420, 90, 150, 0.2]],
      plat: 'iron',
    },
    reverse: {
      bg: '#130f18', brick: ['#1e1826', '#221b2b', '#1a1521'], mortar: '#0b0910',
      wall: { mid: '#544863', light: '#6a5c7d', top: '#a99bc4', dark: '#322a3d' },
      glow: '200,170,255', lights: [[240, 300, 230, 0.16]],
      plat: 'brass',
    },
    cuckoo: {
      bg: '#170f09', brick: ['#24170e', '#291a10', '#20140c'], mortar: '#100a05',
      wall: { mid: '#6a4a30', light: '#84603e', top: '#c09060', dark: '#3d2a1a' },
      glow: '255,190,110', lights: [[120, 200, 170, 0.2], [380, 470, 170, 0.2]],
      plat: 'wood',
    },
    dark: {
      bg: '#0b0c0f', brick: ['#15171c', '#181a20', '#121418'], mortar: '#07080a',
      wall: { mid: '#3e434d', light: '#525865', top: '#8a92a2', dark: '#24272e' },
      glow: '150,180,255', lights: [],
      plat: 'iron',
    },
    magnet: {
      bg: '#0e1116', brick: ['#181d24', '#1b2129', '#151a20'], mortar: '#090b0f',
      wall: { mid: '#46505e', light: '#5b6778', top: '#9aa8bc', dark: '#29303a' },
      glow: '120,200,255', lights: [[240, 200, 200, 0.14], [240, 520, 160, 0.12]],
      plat: 'iron',
    },
    rust: {
      bg: '#140e0b', brick: ['#20160f', '#241911', '#1c130d'], mortar: '#0e0906',
      wall: { mid: '#5e4636', light: '#775a45', top: '#b08a6a', dark: '#382a20' },
      glow: '255,160,90', lights: [[240, 250, 230, 0.16]],
      plat: 'beam',
    },
    outside: {
      bg: '#1b2a4a', brick: ['#1b2a4a', '#1b2a4a', '#1b2a4a'], mortar: '#1b2a4a',
      wall: { mid: '#5f5a72', light: '#77718c', top: '#b1aac8', dark: '#3a364a' },
      glow: '255,230,190', lights: [],
      plat: 'stone', sky: true,
    },
  };

  // ---------- ハチ ----------
  const BEE_PAL = { k: '#1b1424', y: '#f2c230', Y: '#c8901a', w: '#e8f4ff', W: '#a8c4dc', e: '#ffffff', s: '#5a3a12' };
  const BEE = [
    sprite([
      '....wW..wW......',
      '...wwW.wwW......',
      '...wWW.wWW......',
      '....kkkkkkk.....',
      '...kyykyykyk....',
      '..kyYkyYkyyek...',
      '..kyYkyYkyykk...',
      '...kyykyykyk....',
      '....kkkkkkk.....',
      '...s.......s....',
    ], BEE_PAL),
    sprite([
      '................',
      '................',
      '..wwWwwW........',
      '...WWkkkkkk.....',
      '...kyykyykyk....',
      '..kyYkyYkyyek...',
      '..kyYkyYkyykk...',
      '...kyykyykyk....',
      '....kkkkkkk.....',
      '...s.......s....',
    ], BEE_PAL),
  ];

  // ---------- 人形 ----------
  const DOLL_PAL = {
    k: '#1b1424', n: '#2e3d73', N: '#4a5fa3', y: '#e8b54a', Y: '#a8742a', s: '#f3d5ad', S: '#d6a77a',
    e: '#1b1424', c: '#e88a7a', r: '#c0392b', R: '#e45b4a', d: '#82241b', w: '#f4efe6', p: '#2a2433', P: '#3f3850', b: '#3b2416',
  };
  const DOLL_TOP = [
    '................',
    '.....kkkkkk.....',
    '....knnnnnNk....',
    '....knnnnnNk....',
    '....knnyynNk....',
    '....knnYYnNk....',
    '...kkkkkkkkkkk..',
    '....kssssssk....',
    '....kssssesk....',
    '....ksssscsk....',
    '....kSssssSk....',
    '.....kkkkkk.....',
    '....kdrrrrRk....',
    '...kdrrwrrRRk...',
    '...kdrrwyrRRk...',
    '...kdrrwrrRRk...',
    '...kdrrwyrRRk...',
    '...kkwwwwwwwk...',
    '....kdrrrrRk....',
  ];
  const LEGS = {
    idle: ['....kppkPPk.....', '....kppkPPk.....', '....kppkPPk.....', '....kbbkbbbk....', '....kkkkkkkk....'],
    a: ['....kppkPPk.....', '...kppk.kPPk....', '...kppk..kPPk...', '..kbbbk..kbbbk..', '..kkkkk..kkkkk..'],
    b: ['....kppkPPk.....', '...kPPk.kppk....', '...kPPk..kppk...', '..kbbbk..kbbbk..', '..kkkkk..kkkkk..'],
    tuck: ['....kppkPPk.....', '....kbbkbbbk....', '....kkkkkkkk....', '................', '................'],
  };
  const DOLL = {};
  for (const k of Object.keys(LEGS)) DOLL[k] = sprite(DOLL_TOP.concat(LEGS[k]), DOLL_PAL);

  // ---------- 鐘 ----------
  const BELL = (() => {
    // 幅は鐘の当たり判定（2マス=32px）とほぼ同じにする（触れていないのに重なって見えないように）
    const w = 36, h = 48;
    return shape(w, h, (x, y) => {
      const cx = w / 2 - 0.5;
      if (y < 6) {
        const d = Math.hypot(x - cx, (y - 6) * 1.2);
        if (d <= 5 && d >= 2.5) return y < 2 ? '#f0c860' : '#8a5a1c';
        return null;
      }
      const t = (y - 6) / (h - 10);
      const half = 6.5 + 9 * Math.pow(t, 1.8) + (y > h - 8 ? 1.5 : 0);
      if (y >= h - 4) {
        if (Math.abs(x - cx) <= 4 && y < h) return '#4a3010';
        return null;
      }
      const dx = x - cx;
      if (Math.abs(dx) > half) return null;
      if (Math.abs(dx) > half - 1.2) return '#4a3010';
      if (y > h - 9 && y < h - 6) return '#6e4a18';
      if (y > 14 && y < 17) return '#7a5320';
      const u = dx / half;
      if (u < -0.55 && u > -0.75) return '#fff0a8';
      if (u < -0.2) return '#e0a83c';
      if (u < 0.45) return '#b9822c';
      return '#8a5a1c';
    });
  })();

  // ---------- 鳩時計の鳩・磁石・幽霊 ----------
  const CUCKOO_BIRD = sprite([
    '................',
    '........kkkk....',
    '.......kbbbbk...',
    '.......kbbebkoo.',
    '..kkk..kbbbbkooo',
    '.kbbbkkbbbbbk...',
    'kbbbbbbbwwwbk...',
    'kbbbbbbwwwwbk...',
    '.kbbbbbwwwbk....',
    '..kkbbbbbbk.....',
    '....kkkkkk......',
    '......y..y......',
  ], { k: '#1b1424', b: '#8a5a2c', w: '#f2e6cc', e: '#fff6d8', o: '#f0a020', y: '#d08020' });
  const MAGNET = sprite([
    '..kkkkkkkkkk..',
    '.krrrrrrrrrrk.',
    'krrRRRRRRRRrrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'kssk......kssk',
    'kSSk......kSSk',
    'kkkk......kkkk',
  ], { k: '#1b1424', r: '#c0392b', R: '#e45b4a', s: '#e8eef6', S: '#9aa4b2' });
  const MAGNET_OFF = sprite([
    '..kkkkkkkkkk..',
    '.krrrrrrrrrrk.',
    'krrRRRRRRRRrrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'krRk......kRrk',
    'kssk......kssk',
    'kSSk......kSSk',
    'kkkk......kkkk',
  ], { k: '#1b1424', r: '#5a3a3a', R: '#6e4a4a', s: '#7a8090', S: '#5a606c' });
  // 幽霊（前の自分）は、同じ形を薄い青で
  const GHOST_PAL = {};
  for (const k of Object.keys(DOLL_PAL)) GHOST_PAL[k] = k === 'k' || k === 'e' ? '#4a6a9a' : '#bcd8ff';
  const GHOST = {};
  for (const k of Object.keys(LEGS)) GHOST[k] = sprite(DOLL_TOP.concat(LEGS[k]), GHOST_PAL);

  // ---------- 足場の並び ----------
  function runsOf(level, s) {
    const out = [];
    const y0 = s * C.ROWS;
    for (let r = 0; r < C.ROWS; r++) {
      const row = level.grid[y0 + r];
      let c = 0;
      while (c < C.COLS) {
        const ch = row[c];
        if (ch === '=' || ch === '>' || ch === '<') {
          const st = c;
          while (c < C.COLS && row[c] === ch) c++;
          out.push({ ch, r, c1: st, c2: c - 1 });
        } else c++;
      }
    }
    return out;
  }

  function Art(canvas, level, sim) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const statics = [];
    const runs = [];
    const particles = [];
    let keyAngle = 0;
    let shake = 0;
    let endT = null;
    let lastT = null;

    const themeOf = (s) => THEMES[level.themes[s]] || THEMES.belfry;
    const solid = (ty, tx) => {
      if (tx < 0 || tx >= C.COLS || ty < 0 || ty >= level.rows) return true;
      return !!C.SOLID[level.grid[ty][tx]];
    };

    // ---------- 奥の景色（動かない部分） ----------
    const DECOR = {
      workshop(g) {
        // 奥の棚とおもちゃの影
        const shelves = [[30, 140, 150], [300, 250, 150], [40, 380, 130], [280, 520, 170]];
        for (const [x, y, w] of shelves) {
          rect(g, x, y, w, 5, '#2e2119');
          rect(g, x, y + 5, w, 2, '#160f0b');
          rect(g, x + 6, y + 7, 3, 10, '#22180f');
          rect(g, x + w - 9, y + 7, 3, 10, '#22180f');
          let px = x + 8;
          while (px < x + w - 18) {
            const v = hash(px, y, 7);
            const kind = Math.floor(v * 4);
            const col = '#33251c';
            if (kind === 0) rect(g, px, y - 14, 12, 14, col);
            else if (kind === 1) {
              rect(g, px + 3, y - 18, 6, 6, col);
              rect(g, px + 1, y - 12, 10, 12, col);
            } else if (kind === 2) {
              rect(g, px, y - 8, 16, 8, col);
              rect(g, px + 2, y - 12, 4, 4, col);
            } else {
              rect(g, px + 4, y - 20, 4, 20, col);
              rect(g, px, y - 4, 12, 4, col);
            }
            px += 16 + Math.floor(v * 10);
          }
        }
        // 壁に掛けた予備のねじ
        for (let i = 0; i < 6; i++) {
          const x = 200 + i * 26, y = 60 + (i % 2) * 10;
          rect(g, x + 2, y - 4, 2, 4, '#3a2b20');
          rect(g, x, y, 6, 2, '#5a4a3c');
          rect(g, x + 2, y + 2, 2, 10, '#5a4a3c');
          rect(g, x - 2, y + 12, 10, 3, '#5a4a3c');
          rect(g, x - 2, y + 15, 2, 4, '#5a4a3c');
          rect(g, x + 6, y + 15, 2, 4, '#5a4a3c');
          rect(g, x - 2, y + 19, 10, 2, '#5a4a3c');
        }
        // 吊りランプ
        for (const [x, y] of [[70, 440], [400, 120]]) {
          rect(g, x - 1, y - 60, 2, 50, '#2a1f17');
          rect(g, x - 7, y - 12, 14, 3, '#5a3a1e');
          rect(g, x - 6, y - 9, 12, 14, '#ffd27a');
          rect(g, x - 6, y - 9, 2, 14, '#fff0b8');
          rect(g, x - 7, y + 5, 14, 3, '#5a3a1e');
        }
      },
      oil(g) {
        const pipe = (x1, y1, x2, y2) => {
          if (x1 === x2) {
            rect(g, x1 - 6, y1, 12, y2 - y1, '#26303a');
            rect(g, x1 - 4, y1, 3, y2 - y1, '#34414c');
            for (let y = y1 + 30; y < y2; y += 90) rect(g, x1 - 8, y, 16, 6, '#1d252c');
          } else {
            rect(g, x1, y1 - 6, x2 - x1, 12, '#26303a');
            rect(g, x1, y1 - 4, x2 - x1, 3, '#34414c');
            for (let x = x1 + 40; x < x2; x += 90) rect(g, x, y1 - 8, 6, 16, '#1d252c');
          }
        };
        pipe(70, 0, 70, H);
        pipe(410, 0, 410, H);
        pipe(70, 96, 410, 96);
        pipe(150, 440, 410, 440);
        pipe(150, 440, 150, H);
        // 弁の輪
        for (const [x, y] of [[240, 96], [300, 440]]) {
          g.strokeStyle = '#4a3a5e';
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x, y - 18, 10, 0, Math.PI * 2);
          g.moveTo(x - 10, y - 18);
          g.lineTo(x + 10, y - 18);
          g.moveTo(x, y - 28);
          g.lineTo(x, y - 8);
          g.stroke();
          rect(g, x - 2, y - 10, 4, 6, '#1d252c');
        }
        // 圧力計
        g.fillStyle = '#1d252c';
        g.beginPath();
        g.arc(330, 60, 18, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#c9c2a8';
        g.beginPath();
        g.arc(330, 60, 14, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (0.8 + i * 0.233);
          rect(g, Math.round(330 + Math.cos(a) * 11), Math.round(60 + Math.sin(a) * 11), 2, 2, '#3a3a3a');
        }
        rect(g, 326, 76, 8, 20, '#26303a');
        // 油の缶
        for (const [x, y] of [[100, 615], [126, 615], [360, 615]]) {
          rect(g, x, y - 22, 20, 22, '#2b2238');
          rect(g, x, y - 22, 20, 3, '#3d3150');
          rect(g, x + 13, y - 28, 4, 6, '#2b2238');
          rect(g, x + 4, y - 14, 12, 6, '#4a3566');
        }
      },
      gears(g) {
        // 奥の太い軸
        rect(g, 0, 300, W, 8, '#241a12');
        rect(g, 0, 300, W, 2, '#3a2b1c');
        rect(g, 236, 0, 8, H, '#21180f');
      },
      beams(g) {
        // 斜めの梁
        g.strokeStyle = '#2a1e16';
        g.lineWidth = 14;
        g.beginPath();
        g.moveTo(0, 520);
        g.lineTo(W, 120);
        g.moveTo(0, 100);
        g.lineTo(W, 560);
        g.stroke();
        g.strokeStyle = '#33251b';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(0, 514);
        g.lineTo(W, 114);
        g.moveTo(0, 94);
        g.lineTo(W, 554);
        g.stroke();
        // 文字盤の裏（外の灯りが透けている）
        const cx = 240, cy = 250, r = 140;
        g.fillStyle = '#2b2420';
        g.beginPath();
        g.arc(cx, cy, r + 10, 0, Math.PI * 2);
        g.fill();
        const gr = g.createRadialGradient(cx, cy, 10, cx, cy, r);
        gr.addColorStop(0, '#6e5e48');
        gr.addColorStop(0.7, '#4a4034');
        gr.addColorStop(1, '#2e2722');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          const len = i % 5 === 0 ? 14 : 5;
          const w = i % 5 === 0 ? 4 : 2;
          g.save();
          g.translate(cx, cy);
          g.rotate(a);
          rect(g, -w / 2, -r + 6, w, len, '#2a221c');
          g.restore();
        }
        // 文字盤を支える枠
        rect(g, cx - 4, cy - r - 10, 8, 2 * r + 20, '#2a1e16');
        rect(g, cx - r - 10, cy - 4, 2 * r + 20, 8, '#2a1e16');
      },
      belfry(g, s) {
        // アーチの窓の向こうの夜空と町
        const arches = [[36, 180, 120, 300], [180, 220, 120, 260], [324, 180, 120, 300]];
        for (const [x, y, w, h] of arches) {
          const rr = w / 2;
          g.save();
          g.beginPath();
          g.moveTo(x, y + rr);
          g.arc(x + rr, y + rr, rr, Math.PI, 0);
          g.lineTo(x + w, y + h);
          g.lineTo(x, y + h);
          g.closePath();
          g.clip();
          const sky = g.createLinearGradient(0, y, 0, y + h);
          sky.addColorStop(0, '#0a0d24');
          sky.addColorStop(0.7, '#1c2350');
          sky.addColorStop(1, '#3a3266');
          g.fillStyle = sky;
          g.fillRect(x, y, w, h);
          for (let i = 0; i < 18; i++) {
            const sx = x + Math.floor(hash(i, x, s) * w);
            const sy = y + Math.floor(hash(x, i, 3) * h * 0.65);
            rect(g, sx, sy, 2, 2, hash(i, sy, 9) > 0.7 ? '#fff6d8' : '#8f97c8');
          }
          // 町の屋根
          let hx = x - 4;
          while (hx < x + w) {
            const hw = 14 + Math.floor(hash(hx, y, 5) * 16);
            const hh = 16 + Math.floor(hash(y, hx, 6) * 24);
            const by = y + h - hh;
            rect(g, hx, by, hw, hh, '#0b0a14');
            g.fillStyle = '#0b0a14';
            g.beginPath();
            g.moveTo(hx - 2, by);
            g.lineTo(hx + hw / 2, by - 10);
            g.lineTo(hx + hw + 2, by);
            g.fill();
            hx += hw + 2;
          }
          g.restore();
          // 窓枠
          g.strokeStyle = '#6a6388';
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(x, y + h);
          g.lineTo(x, y + rr);
          g.arc(x + rr, y + rr, rr, Math.PI, 0);
          g.lineTo(x + w, y + h);
          g.stroke();
          // 下枠は乗れないので、足場と違う暗い色で奥に引っ込んで見せる
          rect(g, x - 3, y + h, w + 6, 6, '#26222f');
          rect(g, x - 3, y + h + 6, w + 6, 2, '#16131d');
        }
        // 月
        g.fillStyle = '#f4ecc8';
        g.beginPath();
        g.arc(250, 270, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1a1f48';
        g.beginPath();
        g.arc(258, 264, 14, 0, Math.PI * 2);
        g.fill();
        // 鐘を吊る梁
        rect(g, 150, 72, 180, 14, '#4a2e1c');
        rect(g, 150, 72, 180, 3, '#7d5230');
        rect(g, 150, 84, 180, 2, '#2a1a10');
        rect(g, 158, 16, 10, 56, '#3b2416');
        rect(g, 312, 16, 10, 56, '#3b2416');
        rect(g, 158, 16, 3, 56, '#5c3a22');
        rect(g, 312, 16, 3, 56, '#5c3a22');
      },
      winding(g) {
        // 壁の大きなねじと、ぜんまいのばね
        const bigKey = (x, y, sc) => {
          g.fillStyle = '#2c3633';
          g.fillRect(x - 4 * sc, y, 8 * sc, 50 * sc);
          for (const dy of [-1, 1]) {
            g.beginPath();
            g.ellipse(x + dy * 18 * sc, y - 8 * sc, 16 * sc, 12 * sc, 0, 0, Math.PI * 2);
            g.fill();
          }
          g.fillStyle = THEMES.winding.bg;
          for (const dy of [-1, 1]) {
            g.beginPath();
            g.ellipse(x + dy * 18 * sc, y - 8 * sc, 8 * sc, 5 * sc, 0, 0, Math.PI * 2);
            g.fill();
          }
        };
        bigKey(400, 300, 1.4);
        bigKey(90, 120, 1);
        g.strokeStyle = '#2c3633';
        g.lineWidth = 4;
        for (const [cx, cy, r] of [[110, 420, 46], [390, 560, 34]]) {
          g.beginPath();
          for (let a = 0; a < Math.PI * 10; a += 0.1) g.lineTo(cx + Math.cos(a) * (a / (Math.PI * 10)) * r, cy + Math.sin(a) * (a / (Math.PI * 10)) * r);
          g.stroke();
        }
      },
      pendulum(g) {
        // 奥の鎖と小さな歯車
        for (const x of [60, 200, 330, 430]) {
          for (let y = 0; y < H; y += 10) rect(g, x - 2, y, 4, 6, '#262333');
        }
        g.fillStyle = '#211e2c';
        for (const [x, y, r] of [[140, 560, 40], [380, 90, 30], [420, 470, 26]]) {
          g.beginPath();
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const rr = i % 4 < 2 ? r : r - 6;
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.fill();
        }
      },
      hive(g) {
        // 上から垂れる蜂蜜
        for (let i = 0; i < 9; i++) {
          const x = 30 + Math.floor(hash(i, 4, 4) * 420);
          const len = 20 + Math.floor(hash(i, 5, 5) * 60);
          rect(g, x, 0, 6, len, '#5a3a0e');
          g.fillStyle = '#5a3a0e';
          g.beginPath();
          g.arc(x + 3, len, 5, 0, Math.PI * 2);
          g.fill();
          rect(g, x + 1, 0, 2, len, '#7a5218');
        }
      },
      queen(g) {
        DECOR.hive(g);
        // 奥に大きな女王バチの影
        g.fillStyle = 'rgba(20,6,2,0.55)';
        g.beginPath();
        g.ellipse(240, 330, 70, 120, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(240, 190, 40, 36, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(60,20,8,0.5)';
        for (let i = 0; i < 4; i++) g.fillRect(176, 290 + i * 40, 128, 14);
        g.fillStyle = 'rgba(200,220,255,0.06)';
        for (const dx of [-1, 1]) {
          g.beginPath();
          g.ellipse(240 + dx * 110, 260, 90, 40, dx * 0.4, 0, Math.PI * 2);
          g.fill();
        }
      },
      clock(g, s) {
        // 回る足場の中心ごとに大きな文字盤
        for (const m of level.movers) {
          if (m.screen !== s) continue;
          const cx = m.cx * S, cy = (m.cy - s * C.SCREEN_H) * S, r = m.len * S + 16;
          g.fillStyle = '#2a2a38';
          g.beginPath();
          g.arc(cx, cy, r + 8, 0, Math.PI * 2);
          g.fill();
          const gr = g.createRadialGradient(cx, cy, 10, cx, cy, r);
          gr.addColorStop(0, '#5e5a4c');
          gr.addColorStop(1, '#3a382f');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.fill();
          for (let i = 0; i < 12; i++) {
            g.save();
            g.translate(cx, cy);
            g.rotate((i / 12) * Math.PI * 2);
            rect(g, -2, -r + 6, 4, i % 3 === 0 ? 14 : 8, '#1e1d26');
            g.restore();
          }
        }
      },
      steam(g) {
        // 銅の配管とボイラー
        const pipe = (x1, y1, x2, y2) => {
          if (x1 === x2) {
            rect(g, x1 - 7, y1, 14, y2 - y1, '#4a3022');
            rect(g, x1 - 5, y1, 3, y2 - y1, '#7a5034');
            for (let y = y1 + 40; y < y2; y += 100) rect(g, x1 - 9, y, 18, 7, '#2e1e15');
          } else {
            // 横の管は乗れる足場に見えないよう、暗く細く、上に明るい線を付けない
            rect(g, x1, y1 - 4, x2 - x1, 8, '#2e1e15');
            rect(g, x1, y1 + 2, x2 - x1, 2, '#3a2619');
            for (let x = x1 + 40; x < x2; x += 100) rect(g, x, y1 - 6, 5, 12, '#22160f');
          }
        };
        pipe(40, 0, 40, H);
        pipe(440, 0, 440, H);
        pipe(40, 130, 180, 130);
        pipe(300, 470, 440, 470);
        for (const [x, y, r] of [[70, 625, 34], [380, 610, 40]]) {
          g.fillStyle = '#2a1c14';
          g.beginPath();
          g.arc(x, y, r, Math.PI, 0);
          g.fill();
          rect(g, x - r, y, r * 2, H - y, '#2a1c14');
          for (let i = -r + 8; i < r; i += 14) rect(g, x + i, y - Math.sqrt(Math.max(0, r * r - i * i)) + 4, 3, 3, '#4a3022');
        }
        for (const [x, y] of [[120, 130], [370, 470]]) {
          g.fillStyle = '#1e1510';
          g.beginPath();
          g.arc(x, y - 30, 16, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#d9cfb0';
          g.beginPath();
          g.arc(x, y - 30, 12, 0, Math.PI * 2);
          g.fill();
          rect(g, x - 3, y - 14, 6, 8, '#4a3022');
        }
      },
      reverse(g) {
        // 逆回りの時計（数字の印が鏡写し）と、向きの入れ替わった矢印
        for (const [cx, cy, r] of [[110, 140, 46], [370, 300, 58], [140, 500, 40]]) {
          g.fillStyle = '#2a2236';
          g.beginPath();
          g.arc(cx, cy, r + 6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#3e3550';
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.fill();
          for (let i = 0; i < 12; i++) {
            g.save();
            g.translate(cx, cy);
            g.rotate(-(i / 12) * Math.PI * 2);
            rect(g, -2, -r + 5, 4, i % 3 === 0 ? 10 : 5, '#1c1626');
            g.restore();
          }
        }
        g.fillStyle = '#2a2236';
        for (const [x, y, dir] of [[300, 80, -1], [60, 330, 1], [330, 560, -1]]) {
          g.beginPath();
          g.moveTo(x + dir * 30, y);
          g.lineTo(x - dir * 4, y - 16);
          g.lineTo(x - dir * 4, y - 7);
          g.lineTo(x - dir * 34, y - 7);
          g.lineTo(x - dir * 34, y + 7);
          g.lineTo(x - dir * 4, y + 7);
          g.lineTo(x - dir * 4, y + 16);
          g.fill();
        }
      },
      cuckoo(g) {
        // 板張りの壁と、飾りの鳩時計
        for (let x = 0; x < W; x += 24) rect(g, x, 0, 1, H, '#120b06');
        const house = (x, y, sc) => {
          g.fillStyle = '#3a2414';
          g.beginPath();
          g.moveTo(x - 26 * sc, y);
          g.lineTo(x, y - 22 * sc);
          g.lineTo(x + 26 * sc, y);
          g.fill();
          rect(g, x - 20 * sc, y, 40 * sc, 44 * sc, '#2e1c10');
          g.fillStyle = '#4a3220';
          g.beginPath();
          g.arc(x, y + 22 * sc, 12 * sc, 0, Math.PI * 2);
          g.fill();
          rect(g, x - 5 * sc, y - 4 * sc, 10 * sc, 9 * sc, '#1a0f08');
          for (const dx of [-10, 10]) {
            rect(g, x + dx * sc - 1, y + 44 * sc, 2, 60 * sc, '#3a2a1a');
            rect(g, x + dx * sc - 4, y + 104 * sc, 8, 16 * sc, '#4a3018');
          }
        };
        house(240, 90, 1.2);
        house(110, 380, 0.9);
        house(380, 330, 1);
      },
      dark(g) {
        // 止まった機械の影（停電中なので、ほとんど見えない）
        g.fillStyle = '#14161b';
        for (const [x, y, w, h] of [[30, 60, 90, 120], [360, 40, 100, 90], [200, 260, 80, 140], [40, 420, 110, 160], [330, 470, 120, 140]]) {
          g.fillRect(x, y, w, h);
          rect(g, x + 6, y + 6, w - 12, 4, '#1c1f26');
          rect(g, x + 10, y + 18, 14, 14, '#101216');
        }
        for (const x of [160, 300]) rect(g, x, 0, 10, H, '#111318');
      },
      magnet(g) {
        // 銅線を巻いた筒（電磁石の機械）と、太い電線
        // 筒は足場から離して置き、ふたも暗くする（乗れる物に見えないように）
        const coil = (x, y, w, h) => {
          rect(g, x, y, w, h, '#221f1a');
          for (let yy = y + 4; yy < y + h - 4; yy += 6) rect(g, x + 3, yy, w - 6, 3, '#5e3a1a');
          rect(g, x - 3, y - 4, w + 6, 4, '#20242b');
          rect(g, x - 3, y + h, w + 6, 4, '#20242b');
        };
        coil(40, 250, 46, 160);
        coil(398, 420, 44, 150);
        g.strokeStyle = '#161920';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(63, 414);
        g.bezierCurveTo(70, 500, 300, 520, 420, 574);
        g.stroke();
      },
      rust(g) {
        // 奥の折れた梁と、錆のしみ
        g.strokeStyle = '#2a1a12';
        g.lineWidth = 12;
        g.beginPath();
        g.moveTo(0, 460);
        g.lineTo(200, 300);
        g.moveTo(480, 140);
        g.lineTo(300, 260);
        g.moveTo(60, 0);
        g.lineTo(150, 120);
        g.stroke();
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(hash(i, 2, 9) * W), y = Math.floor(hash(i, 3, 9) * H);
          g.fillStyle = 'rgba(120,50,20,0.18)';
          g.beginPath();
          g.ellipse(x, y, 6 + hash(i, 4, 9) * 14, 3 + hash(i, 5, 9) * 6, 0, 0, Math.PI * 2);
          g.fill();
          rect(g, x, y, 2, 10 + Math.floor(hash(i, 6, 9) * 30), 'rgba(120,50,20,0.15)');
        }
      },
      outside(g) {
        // 夜明け前の空・遠くの町・塔の外壁（真ん中）
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0d1430');
        sky.addColorStop(0.6, '#2a3566');
        sky.addColorStop(1, '#6a5a7a');
        g.fillStyle = sky;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) {
          const x = Math.floor(hash(i, 1, 31) * W), y = Math.floor(hash(i, 2, 31) * H * 0.6);
          rect(g, x, y, 2, 2, hash(i, 3, 31) > 0.7 ? '#fff6d8' : '#8f97c8');
        }
        // 遠くの町の灯り（下の方）
        for (let i = 0; i < 60; i++) {
          const x = Math.floor(hash(i, 4, 31) * W), y = H - 40 + Math.floor(hash(i, 5, 31) * 36);
          rect(g, x, y, 2, 2, hash(i, 6, 31) > 0.5 ? '#ffcf6a' : '#ff9a4a');
        }
        // 塔の外壁（石積み）
        const x1 = 70, x2 = 410;
        rect(g, x1, 0, x2 - x1, H, '#3a364a');
        for (let by = 0; by < H; by += 20) {
          const off = (by / 20) % 2 ? 20 : 0;
          for (let bx = x1 - off; bx < x2; bx += 40) {
            const v = hash(bx, by, 32);
            rect(g, Math.max(x1, bx + 1), by + 1, Math.min(38, x2 - Math.max(x1, bx + 1)), 18, v > 0.5 ? '#433e55' : '#3e394f');
          }
        }
        rect(g, x1, 0, 4, H, '#5a5470');
        rect(g, x2 - 4, 0, 4, H, '#26232f');
        // 灯りのもれる細い窓
        for (const [x, y] of [[150, 120], [320, 260], [180, 430]]) {
          rect(g, x - 9, y - 4, 18, 40, '#1d1a26');
          rect(g, x - 6, y, 12, 32, '#e8b54a');
          rect(g, x - 1, y, 2, 32, '#7a5a20');
          rect(g, x - 6, y + 15, 12, 2, '#7a5a20');
          glow(g, x, y + 16, 40, '255,200,110', 0.18);
        }
      },
    };

    // 町の窓（ゴールで灯りがともる）
    const townWindows = [];
    (function () {
      const arches = [[36, 180, 120, 300], [180, 220, 120, 260], [324, 180, 120, 300]];
      for (const [x, y, w, h] of arches) {
        for (let i = 0; i < 8; i++) {
          townWindows.push({ x: x + 6 + Math.floor(hash(i, x, 11) * (w - 12)), y: y + h - 6 - Math.floor(hash(x, i, 12) * 22), lit: hash(i, y, 13) > 0.75, d: hash(x, y + i, 14) });
        }
      }
    })();

    // ---------- 足場 ----------
    function drawWall(g, x, y, ty, tx, th) {
      const v = hash(tx, ty, 3);
      rect(g, x, y, T, T, th.wall.mid);
      rect(g, x, y, T, 1, th.wall.light);
      rect(g, x, y, 1, T, th.wall.light);
      rect(g, x, y + T - 1, T, 1, th.wall.dark);
      rect(g, x + T - 1, y, 1, T, th.wall.dark);
      if (v > 0.6) rect(g, x + 4, y + 5, 3, 2, th.wall.dark);
      if (v < 0.2) rect(g, x + 9, y + 9, 4, 2, th.wall.light);
      if (!solid(ty, tx + 1)) rect(g, x + T - 3, y, 3, T, th.wall.light);
      if (!solid(ty, tx - 1)) rect(g, x, y, 3, T, th.wall.light);
      if (!solid(ty + 1, tx)) rect(g, x, y + T - 3, T, 3, th.wall.dark);
      if (!solid(ty - 1, tx)) {
        rect(g, x, y, T, 3, th.wall.top);
        rect(g, x, y + 3, T, 1, th.wall.dark);
      }
    }

    function drawPlatform(g, x, y, ty, tx, th) {
      const left = !solid(ty, tx - 1), right = !solid(ty, tx + 1);
      const below = !solid(ty + 1, tx);
      const v = hash(tx, ty, 5);
      switch (th.plat) {
        case 'wood':
          rect(g, x, y, T, T, '#7d5230');
          rect(g, x, y, T, 3, '#c58c52');
          rect(g, x, y + 3, T, 1, '#5c3a22');
          rect(g, x, y + 8 + Math.floor(v * 4), T, 1, '#6a4428');
          rect(g, x, y + T - 2, T, 2, '#3b2416');
          if (v > 0.5) rect(g, x + 5, y + 6, 2, 2, '#3b2416');
          break;
        case 'iron':
          rect(g, x, y, T, T, '#4a535d');
          rect(g, x, y, T, 3, '#9aa6b2');
          rect(g, x, y + 3, T, 1, '#2b3138');
          rect(g, x + 3, y + 7, 2, 2, '#8a96a2');
          rect(g, x + 11, y + 7, 2, 2, '#8a96a2');
          rect(g, x, y + T - 2, T, 2, '#252b31');
          rect(g, x + T - 1, y + 4, 1, T - 6, '#353c44');
          break;
        case 'brass':
          rect(g, x, y, T, T, th.wall.mid);
          rect(g, x, y, T, 4, '#c48a2c');
          rect(g, x, y, T, 1, '#f0c860');
          rect(g, x, y + 4, T, 1, '#6e4a18');
          rect(g, x, y + T - 2, T, 2, th.wall.dark);
          if (v > 0.5) rect(g, x + 6, y + 9, 3, 2, th.wall.dark);
          break;
        case 'comb':
          rect(g, x, y, T, T, '#9a6a24');
          rect(g, x, y, T, 3, '#f0c060');
          rect(g, x, y + 3, T, 1, '#6a4510');
          rect(g, x + 2 + (tx % 2) * 6, y + 6, 6, 1, '#6a4510');
          rect(g, x + 1 + (tx % 2) * 6, y + 7, 1, 4, '#6a4510');
          rect(g, x + 8 + (tx % 2) * 6 - 6, y + 11, 6, 1, '#6a4510');
          rect(g, x, y + T - 2, T, 2, '#4a300c');
          break;
        case 'beam':
          rect(g, x, y, T, T, '#5a3820');
          rect(g, x, y, T, 3, '#9a6a3e');
          rect(g, x, y + 3, T, 1, '#3b2416');
          rect(g, x, y + 7, T, 1, '#4a2e1a');
          rect(g, x, y + 11, T, 1, '#4a2e1a');
          rect(g, x, y + T - 2, T, 2, '#2a1a10');
          break;
        default:
          rect(g, x, y, T, T, th.wall.mid);
          rect(g, x, y, T, 3, th.wall.top);
          rect(g, x, y + 3, T, 1, th.wall.dark);
          rect(g, x, y + T - 2, T, 2, th.wall.dark);
          rect(g, x + (tx % 2 ? 0 : 8), y + 4, 1, T - 6, th.wall.dark);
      }
      if (left) {
        rect(g, x, y + 1, 1, T - 1, '#140f12');
        rect(g, x, y, 1, 1, th.bg);
      }
      if (right) {
        rect(g, x + T - 1, y + 1, 1, T - 1, '#140f12');
        rect(g, x + T - 1, y, 1, 1, th.bg);
      }
      // 棚の金具
      if (th.plat === 'wood' && below && (left || right) && ty + 1 < level.rows) {
        const bx = left ? x + 3 : x + T - 7;
        for (let i = 0; i < 6; i++) rect(g, bx + (left ? 0 : 4 - Math.floor(i * 0.7)), y + T + i, Math.max(1, 4 - Math.floor(i * 0.7)), 1, '#2b2d33');
      }
    }

    function drawOil(g, x, y, ty, tx) {
      rect(g, x, y, T, T, '#3f3352');
      rect(g, x, y + T - 2, T, 2, '#21192e');
      rect(g, x, y, T, 4, '#8f5fd6');
      rect(g, x, y + 4, T, 1, '#5b3d8a');
      const v = hash(tx, ty, 8);
      rect(g, x + 2 + Math.floor(v * 8), y + 1, 4, 1, '#c49cf5');
      if (!solid(ty + 1, tx) && v > 0.6) {
        rect(g, x + 7, y + T, 2, 3, '#8f5fd6');
        rect(g, x + 7, y + T + 3, 2, 1, '#5b3d8a');
      }
      if (!solid(ty, tx - 1)) rect(g, x, y, 1, T, '#21192e');
      if (!solid(ty, tx + 1)) rect(g, x + T - 1, y, 1, T, '#21192e');
    }

    // ねじ巻き台: 金色の台に鍵穴
    function drawKey(g, x, y, ty, tx) {
      rect(g, x, y, T, T, '#8a5a1c');
      rect(g, x, y, T, 4, '#ffd860');
      rect(g, x, y, T, 1, '#fff4c0');
      rect(g, x, y + 4, T, 1, '#5a3a10');
      rect(g, x + 6, y + 6, 4, 4, '#3a2408');
      rect(g, x + 7, y + 10, 2, 3, '#3a2408');
      rect(g, x, y + T - 2, T, 2, '#4a300c');
      if (!solid(ty, tx - 1)) rect(g, x, y, 1, T, '#2a1a06');
      if (!solid(ty, tx + 1)) rect(g, x + T - 1, y, 1, T, '#2a1a06');
    }

    // 蜂蜜の床: こはく色でとろりと垂れる
    function drawHoney(g, x, y, ty, tx) {
      rect(g, x, y, T, T, '#7a4c10');
      rect(g, x, y, T, 5, '#e89a22');
      rect(g, x, y, T, 2, '#ffcc55');
      const v = hash(tx, ty, 21);
      rect(g, x + 2 + Math.floor(v * 9), y + 1, 3, 1, '#fff0b0');
      rect(g, x, y + 5, T, 1, '#5a3608');
      rect(g, x, y + T - 2, T, 2, '#3e2406');
      if (!solid(ty + 1, tx) && v > 0.4) {
        rect(g, x + 5, y + T, 4, 4 + Math.floor(v * 6), '#e89a22');
        rect(g, x + 6, y + T, 1, 3, '#ffcc55');
      }
      if (!solid(ty, tx - 1)) rect(g, x, y, 1, T, '#3e2406');
      if (!solid(ty, tx + 1)) rect(g, x + T - 1, y, 1, T, '#3e2406');
    }

    // 蒸気の噴き出し口: 鉄の格子
    function drawVentTile(g, x, y, ty, tx) {
      rect(g, x, y, T, T, '#3a3530');
      rect(g, x, y, T, 3, '#9a8a78');
      rect(g, x, y + 3, T, 1, '#1a1612');
      for (let i = 2; i < T; i += 4) rect(g, x + i, y + 5, 2, 7, '#0e0b09');
      rect(g, x, y + T - 2, T, 2, '#1a1612');
      if (!solid(ty, tx - 1)) rect(g, x, y, 1, T, '#140f12');
      if (!solid(ty, tx + 1)) rect(g, x + T - 1, y, 1, T, '#140f12');
    }

    function drawBeltBase(g, x, y) {
      rect(g, x, y, T, T, '#2b2d33');
      rect(g, x, y + 4, T, 1, '#1a1b20');
      rect(g, x, y + T - 3, T, 3, '#1a1b20');
      rect(g, x + 2, y + 8, 2, 2, '#4a4f59');
      rect(g, x + 10, y + 8, 2, 2, '#4a4f59');
    }

    // 奥（壁・飾り・灯り）と手前（足場）を別々に作り、その間に動く景色を描く
    function buildStatic(s) {
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      const fc = makeCanvas(W, H);
      const fg = fc.getContext('2d');
      const th = themeOf(s);
      rect(g, 0, 0, W, H, th.bg);
      if (th.hex) {
        // 蜂の巣の六角形
        const R = 14, hw = R * Math.sqrt(3);
        for (let row = -1, cy = 0; cy < H + R; row++, cy = row * R * 1.5) {
          for (let cx = (row % 2 ? hw / 2 : 0) - hw; cx < W + hw; cx += hw) {
            const v = hash(Math.round(cx), Math.round(cy), s);
            g.fillStyle = v > 0.82 ? th.mortar : th.brick[Math.floor(v * 3)];
            g.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = Math.PI / 6 + (i * Math.PI) / 3;
              g.lineTo(cx + Math.cos(a) * (R - 1.5), cy + Math.sin(a) * (R - 1.5));
            }
            g.closePath();
            g.fill();
            if (v > 0.93) {
              g.fillStyle = 'rgba(232,160,40,0.12)';
              g.fill();
            }
          }
        }
      } else if (!th.sky) {
        for (let by = 0; by < H; by += 16) {
          const off = (by / 16) % 2 ? 16 : 0;
          for (let bx = -off; bx < W; bx += 32) {
            const v = hash(bx, by, s);
            rect(g, bx + 1, by + 1, 30, 14, th.brick[Math.floor(v * 3)]);
            if (v > 0.88) rect(g, bx + 6, by + 5, 5, 2, th.mortar);
          }
        }
      }
      (DECOR[level.themes[s]] || (() => {}))(g, s);
      for (const [x, y, r, a] of th.lights) glow(g, x, y, r, th.glow, a);
      const y0 = s * C.ROWS;
      for (let r = 0; r < C.ROWS; r++) {
        for (let cc = 0; cc < C.COLS; cc++) {
          const ty = y0 + r;
          const ch = level.grid[ty][cc];
          const x = cc * T, y = r * T;
          const border = cc === 0 || cc === C.COLS - 1 || ty === 0 || ty === level.rows - 1;
          if (ch === '#') (border ? drawWall : drawPlatform)(fg, x, y, ty, cc, th);
          else if (ch === '=') drawOil(fg, x, y, ty, cc);
          else if (ch === 'K') drawKey(fg, x, y, ty, cc);
          else if (ch === 'h') drawHoney(fg, x, y, ty, cc);
          else if (ch === 'v') drawVentTile(fg, x, y, ty, cc);
          else if (ch === '>' || ch === '<') drawBeltBase(fg, x, y);
          // 錆びた梁（r）は崩れるので、毎回描く（drawRust）
        }
      }
      return { bg: c, fg: fc };
    }

    // 外側を暗くする
    const vignette = (() => {
      const c = makeCanvas(W, H);
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      return c;
    })();

    // ---------- 動く景色 ----------
    function gear(g, cx, cy, r, teeth, rot, body, edge) {
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.fillStyle = body;
      g.beginPath();
      for (let i = 0; i < teeth * 4; i++) {
        const a = (i / (teeth * 4)) * Math.PI * 2;
        const rr = i % 4 < 2 ? r : r - 8;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = edge;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, r - 13, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = edge;
      for (let i = 0; i < 5; i++) {
        g.rotate((Math.PI * 2) / 5);
        g.fillRect(-3, 0, 6, r - 14);
      }
      g.beginPath();
      g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#120d08';
      g.beginPath();
      g.arc(0, 0, r * 0.08, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    const GEARS = [
      { x: 92, y: 170, r: 78, teeth: 15, dir: 1 },
      { x: 92 + 78 + 44 - 6, y: 170 + 30, r: 44, teeth: 9, dir: -1 },
      { x: 390, y: 470, r: 96, teeth: 18, dir: -1 },
      { x: 390 - 96 - 40 + 8, y: 470 - 70, r: 40, teeth: 8, dir: 1 },
    ];

    const DYN = {
      workshop(g, t) {
        for (let i = 0; i < 14; i++) {
          const x = (hash(i, 1, 2) * W + t * (6 + hash(i, 2, 3) * 8)) % W;
          const y = (hash(i, 3, 4) * H - t * (4 + hash(i, 5, 6) * 5) + H * 4) % H;
          g.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + i);
          rect(g, Math.round(x), Math.round(y), 2, 2, '#ffd9a0');
        }
        g.globalAlpha = 1;
        for (const [x, y] of [[70, 440], [400, 120]]) {
          const f = 0.06 + 0.04 * Math.sin(t * 9 + x) * Math.sin(t * 5.3);
          glow(g, x, y, 60, '255,190,100', f);
        }
      },
      oil(g, t) {
        // 管のつなぎ目から垂れる油
        const drips = [[70, 120], [410, 210], [250, 102], [150, 470], [410, 390]];
        drips.forEach(([x, y0], i) => {
          const period = 2.2 + i * 0.37;
          const p = ((t + i * 0.9) % period) / period;
          if (p < 0.35) {
            const sz = Math.floor(p * 9);
            rect(g, x - 1, y0 + 6, 3, 1 + sz, '#8f5fd6');
          } else {
            const fall = (p - 0.35) * period;
            const y = y0 + 10 + 500 * fall * fall;
            if (y < H) rect(g, x - 1, Math.round(y), 3, 4, '#a77ae6');
          }
        });
        // 圧力計の針
        const a = Math.PI * 1.2 + 0.25 * Math.sin(t * 3) + 0.08 * Math.sin(t * 17);
        g.strokeStyle = '#b8322a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(330, 60);
        g.lineTo(330 + Math.cos(a) * 11, 60 + Math.sin(a) * 11);
        g.stroke();
      },
      gears(g, t) {
        const base = t * 0.35;
        GEARS.forEach((ge, i) => {
          const rot = (base * 15 / ge.teeth) * ge.dir + i * 0.2;
          gear(g, ge.x, ge.y, ge.r, ge.teeth, rot, i % 2 ? '#2f2416' : '#3a2c1a', '#4f3c22');
        });
      },
      beams(g, t) {
        // 本物の時刻の針（裏から見ているので逆回り）
        const now = new Date();
        const min = now.getMinutes() + now.getSeconds() / 60;
        const hr = (now.getHours() % 12) + min / 60;
        const cx = 240, cy = 250;
        const hand = (ang, len, w) => {
          g.save();
          g.translate(cx, cy);
          g.rotate(-ang);
          rect(g, -w / 2, -len, w, len + 8, '#1a1410');
          g.restore();
        };
        hand((hr / 12) * Math.PI * 2, 70, 8);
        hand((min / 60) * Math.PI * 2, 110, 5);
        rect(g, cx - 7, cy - 7, 14, 14, '#2a1e16');
        // 振り子
        const ang = 0.32 * Math.sin((t * Math.PI * 2) / 2.4);
        const px = 240, py = 410, len = 170;
        g.save();
        g.translate(px, py);
        g.rotate(ang);
        rect(g, -2, 0, 4, len, '#3a2c20');
        g.fillStyle = '#7a5a2a';
        g.beginPath();
        g.arc(0, len, 20, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#a07a3a';
        g.beginPath();
        g.arc(-5, len - 5, 8, 0, Math.PI * 2);
        g.fill();
        g.restore();
        rect(g, px - 6, py - 4, 12, 8, '#2a1e16');
      },
      belfry(g, t) {
        for (let i = 0; i < 10; i++) {
          if (Math.sin(t * (1.3 + i * 0.37) + i * 2) > 0.85) {
            const arch = [[36, 180, 120], [180, 220, 120], [324, 180, 120]][i % 3];
            const x = arch[0] + 6 + Math.floor(hash(i, 7, 1) * (arch[2] - 12));
            const y = arch[1] + 30 + Math.floor(hash(i, 8, 1) * 120);
            rect(g, x, y, 2, 2, '#ffffff');
            rect(g, x - 2, y, 6, 1, 'rgba(255,255,255,0.4)');
          }
        }
        const lit = endT === null ? 0 : Math.min(1, (t - endT) / 2.5);
        for (const w of townWindows) {
          if (w.lit || w.d < lit) rect(g, w.x, w.y, 3, 3, '#ffcf6a');
        }
      },
      winding(g, t) {
        // ばねの先の小さなねじが回る
        for (const [x, y] of [[110, 420], [390, 560]]) {
          const kw = Math.max(1, Math.round(Math.abs(Math.cos(t * 2 + x)) * 8));
          rect(g, x - kw, y - 6, kw * 2, 12, '#4a5852');
        }
      },
      pendulum(g, t) {
        for (const [x, y, r, sp] of [[140, 560, 40, 0.4], [380, 90, 30, -0.55], [420, 470, 26, 0.65]]) {
          g.save();
          g.translate(x, y);
          g.rotate(t * sp);
          rect(g, -2, -r + 8, 4, (r - 8) * 2, '#2b2839');
          rect(g, -r + 8, -2, (r - 8) * 2, 4, '#2b2839');
          g.restore();
        }
      },
      hive(g, t) {
        for (let i = 0; i < 16; i++) {
          const x = (hash(i, 9, 1) * W + Math.sin(t * 0.7 + i) * 20 + t * 8) % W;
          const y = (hash(i, 8, 2) * H + Math.cos(t * 0.5 + i) * 16) % H;
          g.globalAlpha = 0.35 + 0.3 * Math.sin(t * 3 + i);
          rect(g, Math.round(x), Math.round(y), 2, 2, '#ffe08a');
        }
        g.globalAlpha = 1;
      },
      queen(g, t) {
        DYN.hive(g, t);
        glow(g, 240, 300, 120, '255,90,40', 0.05 + 0.03 * Math.sin(t * 1.5));
      },
      clock(g, t) {
        // 秒針（本物の時刻で1秒ずつ動く）
        const sec = new Date().getSeconds();
        for (const m of level.movers) {
          if (m.kind !== 'orbit' || m.screen !== curScreen) continue;
          const cx = m.cx * S, cy = (m.cy - curScreen * C.SCREEN_H) * S;
          g.save();
          g.translate(cx, cy);
          g.rotate((sec / 60) * Math.PI * 2);
          rect(g, -1, -(m.len * S + 8), 2, m.len * S + 14, '#b8322a');
          g.restore();
        }
      },
      steam(g, t) {
        // 圧力計の針と、つなぎ目から漏れる湯気
        for (const [x, y, k] of [[120, 100, 0], [370, 440, 1]]) {
          const a = Math.PI * 1.2 + 0.3 * Math.sin(t * (2 + k)) + 0.1 * Math.sin(t * 13 + k);
          g.strokeStyle = '#b8322a';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
          g.stroke();
        }
        for (const [x, y, i] of [[40, 190, 0], [440, 290, 1], [160, 130, 2], [320, 470, 3]]) {
          for (let k = 0; k < 4; k++) {
            const f = (t * 0.6 + k / 4 + i * 0.3) % 1;
            g.globalAlpha = 0.18 * (1 - f);
            g.fillStyle = '#e8e2d8';
            g.beginPath();
            g.arc(x + Math.sin(t + k) * 4, y - f * 50, 4 + f * 10, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.globalAlpha = 1;
      },
      reverse(g, t) {
        // 針が逆に回る
        for (const [cx, cy, r, sp] of [[110, 140, 46, 1.2], [370, 300, 58, 0.7], [140, 500, 40, 1.6]]) {
          for (const [len, w, k] of [[r * 0.55, 5, 1 / 12], [r * 0.8, 3, 1]]) {
            g.save();
            g.translate(cx, cy);
            g.rotate(-t * sp * k);
            rect(g, -w / 2, -len, w, len + 4, '#1c1626');
            g.restore();
          }
          rect(g, cx - 3, cy - 3, 6, 6, '#8a7aa8');
        }
      },
      cuckoo(g, t) {
        // 飾りの鳩時計の振り子
        for (const [x, y, sc, k] of [[240, 90, 1.2, 0], [110, 380, 0.9, 1], [380, 330, 1, 2]]) {
          const a = 0.35 * Math.sin(t * 3 + k * 2);
          g.save();
          g.translate(x, y + 44 * sc);
          g.rotate(a);
          rect(g, -1, 0, 2, 40 * sc, '#5a4028');
          g.fillStyle = '#a07a3a';
          g.beginPath();
          g.arc(0, 40 * sc, 6 * sc, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
      },
      magnet(g, t) {
        // 筒のまわりの小さな火花
        for (const [x, y] of [[63, 250], [420, 420]]) {
          if (Math.sin(t * 7 + x) > 0.7) {
            rect(g, x + Math.round(Math.sin(t * 31 + y) * 20), y - 8, 2, 2, '#bfe6ff');
            rect(g, x + Math.round(Math.cos(t * 23 + x) * 20), y - 4, 2, 2, '#ffffff');
          }
        }
      },
      rust(g, t) {
        // 落ちてくる錆の粉
        for (let i = 0; i < 14; i++) {
          const x = (hash(i, 7, 7) * W + Math.sin(t * 0.8 + i) * 10) % W;
          const y = (hash(i, 8, 8) * H + t * (12 + hash(i, 9, 9) * 10)) % H;
          g.globalAlpha = 0.5;
          rect(g, Math.round(x), Math.round(y), 2, 2, '#8a4a22');
        }
        g.globalAlpha = 1;
      },
      outside(g, t) {
        // 流れる雲（風の向きに流れる）
        const w = level.winds[curScreen];
        const dir = w ? C.windAt(w, sim.clock) : 0;
        cloudX += (8 + dir * 40) * Math.min(0.1, t - (cloudT === null ? t : cloudT));
        cloudT = t;
        for (let i = 0; i < 7; i++) {
          const x = ((hash(i, 1, 41) * (W + 200) + cloudX * (0.6 + hash(i, 2, 41))) % (W + 200) + W + 200) % (W + 200) - 100;
          const y = 40 + hash(i, 3, 41) * 520;
          g.fillStyle = 'rgba(150,150,190,0.16)';
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.ellipse(x + k * 22, y + (k % 2) * 6, 26, 12, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      },
    };
    let cloudX = 0, cloudT = null;
    let curScreen = 0;

    // 動く足場（振り子の板・時計の針の先の板）
    function drawMovers(g, s) {
      sim.movers.forEach((m) => {
        if (m.screen !== s) return;
        const x = Math.round(m.x * S), y = Math.round((m.y - s * C.SCREEN_H) * S), w = Math.round(m.w * S);
        const cx = m.cx * S, cy = (m.cy - s * C.SCREEN_H) * S;
        const mx = x + w / 2;
        if (m.kind === 'pendulum') {
          g.strokeStyle = '#3a2c20';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(mx, y);
          g.stroke();
          g.fillStyle = '#6a5030';
          g.beginPath();
          g.arc(cx, cy, 6, 0, Math.PI * 2);
          g.fill();
          rect(g, cx - 2, cy - 2, 4, 4, '#2a1e12');
          g.fillStyle = '#a07a3a';
          g.beginPath();
          g.arc(mx, y + 14, 8, 0, Math.PI * 2);
          g.fill();
        } else {
          // 針
          const ang = Math.atan2(y - cy, mx - cx);
          const len = Math.hypot(mx - cx, y - cy);
          g.save();
          g.translate(cx, cy);
          g.rotate(ang);
          g.fillStyle = '#1a1820';
          g.beginPath();
          g.moveTo(-26, -4);
          g.lineTo(len, -2);
          g.lineTo(len, 2);
          g.lineTo(-26, 4);
          g.fill();
          g.fillStyle = '#2a2838';
          g.beginPath();
          g.arc(-24, 0, 7, 0, Math.PI * 2);
          g.fill();
          g.restore();
          g.fillStyle = '#c9a24a';
          g.beginPath();
          g.arc(cx, cy, 7, 0, Math.PI * 2);
          g.fill();
        }
        // 板（上面を明るくして、乗れることを見せる）
        rect(g, x, y, w, 8, '#a8742a');
        rect(g, x, y, w, 2, '#ffe08a');
        rect(g, x, y + 2, w, 1, '#e8b54a');
        rect(g, x, y + 6, w, 2, '#5a3a12');
        rect(g, x, y, 1, 8, '#3a2408');
        rect(g, x + w - 1, y, 1, 8, '#3a2408');
        for (let i = 6; i < w - 4; i += 12) rect(g, x + i, y + 4, 2, 2, '#5a3a12');
      });
    }

    // ハチ
    function drawBees(g, s, t) {
      for (const b of sim.bees) {
        if (b.screen !== s) continue;
        const x = Math.round(b.x * S), y = Math.round((b.y - s * C.SCREEN_H) * S);
        const face = b.vx < -1 ? -1 : b.vx > 1 ? 1 : b.face || 1;
        b.face = face;
        if (b.mode === 'dash') {
          g.globalAlpha = 0.25;
          for (let i = 1; i <= 3; i++) {
            g.save();
            g.translate(Math.round(x - b.vx * S * 0.025 * i), Math.round(y - b.vy * S * 0.025 * i));
            g.scale(face, 1);
            g.drawImage(BEE[0], -8, -6);
            g.restore();
          }
          g.globalAlpha = 1;
        }
        const shakeX = b.mode === 'aim' ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
        g.save();
        g.translate(x + shakeX, y + Math.round(Math.sin(t * 9 + b.hx) * 1.5));
        g.scale(face, 1);
        g.drawImage(BEE[Math.floor(t * 24) % 2], -8, -6);
        g.restore();
        if (b.mode === 'aim') {
          if (Math.floor(t * 12) % 2) {
            g.save();
            g.globalCompositeOperation = 'lighter';
            glow(g, x, y, 16, '255,40,20', 0.7);
            g.restore();
          }
          rect(g, x - 1, y - 18, 3, 7, '#ff4a3a');
          rect(g, x - 1, y - 9, 3, 2, '#ff4a3a');
        }
      }
    }

    // ---------- 仕掛け ----------
    const wrapT = (x, n) => ((x % n) + n) % n;

    // 蒸気: 予告は細い湯気、噴いている間は太い柱
    function drawVents(g, s, t) {
      for (const v of level.vents) {
        if (v.screen !== s) continue;
        const st = C.ventState(v, sim.clock);
        const p = wrapT(sim.clock + v.phase, v.period);
        const cx = ((v.c1 + v.c2 + 1) / 2) * T, top = (v.row - s * C.ROWS) * T;
        const width = (v.c2 - v.c1 + 1) * T;
        if (st === 'warn') {
          // 飾りの湯気と見分けられるように: 格子がだいだい色に光り、上に「！」が点滅する
          const blink = Math.floor(t * 8) % 2;
          g.globalAlpha = blink ? 0.85 : 0.45;
          rect(g, v.c1 * T, top - 2, width, 3, '#ff8a2a');
          if (blink) {
            g.globalAlpha = 1;
            rect(g, cx - 2, top - 46, 4, 10, '#ff8a2a');
            rect(g, cx - 2, top - 33, 4, 4, '#ff8a2a');
          }
          for (let k = 0; k < 6; k++) {
            const f = (t * 1.6 + k / 6) % 1;
            g.globalAlpha = 0.45 * (1 - f);
            g.fillStyle = '#f4efe6';
            g.beginPath();
            g.arc(cx + Math.sin(k * 3 + t * 4) * width * 0.3, top - f * 30, 3 + f * 5, 0, Math.PI * 2);
            g.fill();
          }
        } else if (st === 'on' || p < C.P.ventOn + 0.6) {
          const fade = st === 'on' ? 1 : 1 - (p - C.P.ventOn) / 0.6;
          const h = v.power * T * 0.9;
          for (let k = 0; k < 22; k++) {
            const f = (t * 2.6 + k / 22) % 1;
            g.globalAlpha = 0.6 * (1 - f) * fade;
            g.fillStyle = k % 3 ? '#f4efe6' : '#cfc8bc';
            g.beginPath();
            g.arc(cx + Math.sin(k * 7 + t * 3) * (4 + f * width * 0.6), top - f * h, 6 + f * 16, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.globalAlpha = 1;
      }
    }

    // 錆びた梁: 乗るときしんで揺れ、崩れると消える。戻る少し前に点滅して知らせる
    const rustWas = [];
    function drawRust(g, s, t) {
      level.rusts.forEach((r, i) => {
        const b = sim.rust[i];
        if (!b) return;
        const sy = Math.floor(r.ty / C.ROWS);
        const was = rustWas[i] || 0;
        rustWas[i] = b.down;
        if (sy !== s) return;
        const y = (r.ty - s * C.ROWS) * T;
        if (b.down > 0) {
          if (was === 0) {
            for (let c = r.c1; c <= r.c2; c++) {
              for (let k = 0; k < 3; k++) {
                particles.push({ x: c * T + 4 + k * 4, y: r.ty * T + 6, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 40, g: 500, life: 0, max: 0.9, col: k % 2 ? '#8a4a22' : '#5a2c14', size: 3 });
              }
            }
          }
          if (b.down < 1.2 && Math.floor(t * 8) % 2) {
            g.globalAlpha = 0.35;
            for (let c = r.c1; c <= r.c2; c++) rect(g, c * T, y, T, 3, '#d98a4a');
            g.globalAlpha = 1;
          }
          return;
        }
        const shake = b.t > 0 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
        const prog = b.t > 0 ? 1 - b.t / C.P.rustTime : 0;
        for (let c = r.c1; c <= r.c2; c++) {
          const x = c * T + shake;
          const v = hash(c, r.ty, 51);
          rect(g, x, y, T, T, '#6e3a1e');
          rect(g, x, y, T, 3, '#c06a32');
          rect(g, x, y + 3, T, 1, '#4a2410');
          rect(g, x + 2 + Math.floor(v * 8), y + 6, 4, 3, '#4a2410');
          if (v > 0.5) rect(g, x + 9, y + 10, 3, 2, '#8a4a22');
          rect(g, x, y + T - 2, T, 2, '#3a1c0c');
          if (c === r.c1) rect(g, x, y, 1, T, '#1a0c06');
          if (c === r.c2) rect(g, x + T - 1, y, 1, T, '#1a0c06');
          // ひび（崩れが近いほど増える）
          if (prog > 0.2) rect(g, x + 5, y + 3, 1, Math.min(T - 5, Math.round(prog * 14)), '#1a0c06');
          if (prog > 0.55) rect(g, x + 11, y + 4, 1, Math.min(T - 6, Math.round(prog * 10)), '#1a0c06');
        }
      });
    }

    // 磁石: 引いている間は青い波が人形の方へ寄っていく
    function drawMagnets(g, s, t) {
      for (const m of level.magnets) {
        if (m.screen !== s) continue;
        const on = C.magnetOn(m, sim.clock);
        const x = m.x * S, y = (m.y - s * C.SCREEN_H) * S;
        rect(g, x - 1, y - 60, 2, 44, '#2a2f38');
        if (on) {
          const R = C.P.magnetRange * S;
          for (let k = 0; k < 3; k++) {
            const f = 1 - ((t * 0.8 + k / 3) % 1);
            g.strokeStyle = `rgba(140,210,255,${0.22 * (1 - f)})`;
            g.lineWidth = 2;
            g.beginPath();
            g.arc(x, y, R * f, 0, Math.PI * 2);
            g.stroke();
          }
          glow(g, x, y + 6, 40, '120,200,255', 0.25);
        }
        g.drawImage(on ? MAGNET : MAGNET_OFF, x - 14, y - 12, 28, 20);
        // 切り替わる磁石は、あと少しで変わるときに印を点滅させる
        if (m.period) {
          const p = wrapT(sim.clock + m.phase, m.period), half = m.period / 2;
          const left = on ? half - p : m.period - p;
          const col = on ? '#7ad0ff' : '#5a606c';
          if (!(left < 0.7 && Math.floor(t * 10) % 2)) rect(g, x - 3, y - 18, 6, 4, col);
        }
      }
    }

    // 鳩時計: 予告で扉が揺れて音符が出る。飛び出すと、伸びる腕の先に鳩
    function drawCuckoos(g, s, t) {
      for (const k of level.cuckoos) {
        if (k.screen !== s) continue;
        const { ext, warn } = C.cuckooExt(k, sim.clock);
        const left = k.side === 'L';
        const y = (k.row - s * C.ROWS) * T;
        const wallX = left ? T : W - T;
        const dir = left ? 1 : -1;
        const jig = warn ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
        // 扉の枠と屋根
        const fx = left ? 0 : W - T - 6;
        rect(g, fx + jig, y - T - 6, T + 6, 2 * T + 8, '#3a2414');
        g.fillStyle = '#5a3a20';
        g.beginPath();
        g.moveTo(fx - 3 + jig, y - T - 6);
        g.lineTo(fx + (T + 6) / 2 + jig, y - T - 18);
        g.lineTo(fx + T + 9 + jig, y - T - 6);
        g.fill();
        rect(g, fx + 3 + jig, y - T - 2, T, 2 * T, ext > 0 ? '#0e0806' : '#6a4426');
        if (ext <= 0) rect(g, fx + 3 + T / 2 + jig, y - T - 2, 1, 2 * T, '#3a2414');
        if (warn) {
          const ny = y - T - 30 - ((t * 30) % 10);
          const nx = wallX + dir * 18;
          rect(g, nx, ny, 2, 10, '#ffe08a');
          rect(g, nx - 4, ny + 8, 5, 4, '#ffe08a');
          rect(g, nx + 2, ny, 5, 2, '#ffe08a');
        }
        if (ext > 0) {
          const len = C.TILE * (1 + k.reach * ext) * S;
          const tip = left ? len : W - len;
          // 伸びる腕（じゃばら）
          g.strokeStyle = '#8a6a3a';
          g.lineWidth = 2;
          g.beginPath();
          const n = 6;
          for (let i = 0; i <= n; i++) {
            const x = wallX + ((tip - wallX - dir * 16) * i) / n;
            g.lineTo(x, y + (i % 2 ? -6 : 6));
          }
          g.stroke();
          g.save();
          g.translate(Math.round(tip - dir * 16), y);
          g.scale(dir * 2, 2);
          g.drawImage(CUCKOO_BIRD, -8, -7);
          g.restore();
        }
      }
    }

    // 風見鶏と風の筋。向きが変わる1秒前から、風見鶏がくるくる回って知らせる
    function drawWind(g, s, t) {
      const w = level.winds[s];
      if (!w) return;
      const dir = C.windAt(w, sim.clock);
      const nx = C.windNext(w, sim.clock);
      if (dir) {
        g.strokeStyle = 'rgba(230,240,255,0.35)';
        g.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const y = 30 + hash(i, 1, 61) * (H - 60);
          const sp = 260 + hash(i, 2, 61) * 200;
          const x = wrapT(hash(i, 3, 61) * W + dir * t * sp, W + 120) - 60;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - dir * (30 + hash(i, 4, 61) * 40), y);
          g.stroke();
        }
      }
      // 風見鶏（右上）
      const vx = W - 64, vy = 54;
      rect(g, vx - 2, vy, 4, 44, '#2a2638');
      rect(g, vx - 14, vy + 22, 28, 3, '#2a2638');
      const spin = nx.in < 1 ? Math.sin(t * 30) : dir || Math.sin(t * 2) * 0.3;
      g.save();
      g.translate(vx, vy);
      g.scale(spin >= 0 ? 1 : -1, 1);
      g.fillStyle = '#e8b54a';
      g.beginPath();
      g.moveTo(22, 0);
      g.lineTo(10, -8);
      g.lineTo(10, -3);
      g.lineTo(-18, -3);
      g.lineTo(-22, -10);
      g.lineTo(-22, 10);
      g.lineTo(-18, 3);
      g.lineTo(10, 3);
      g.lineTo(10, 8);
      g.fill();
      rect(g, -6, -18, 10, 10, '#e8b54a');
      rect(g, -2, -24, 4, 6, '#c0392b');
      g.restore();
      // 文字でも知らせる
      g.font = '14px "DotGothic16", monospace';
      g.textAlign = 'center';
      g.fillStyle = nx.in < 1 ? '#ffe08a' : '#e8e2f8';
      const label = dir < 0 ? '← 風' : dir > 0 ? '風 →' : '風 なし';
      g.fillText(nx.in < 1 ? `${label}（もうすぐ${nx.dir < 0 ? '←' : nx.dir > 0 ? '→' : 'やむ'}）` : label, vx - 10, vy + 64);
    }

    // 停電: 人形のまわりだけ見え、稲光で一瞬全体が見える
    const darkCanvas = makeCanvas(W, H);
    const darkG = darkCanvas.getContext('2d');
    function drawDark(g, s, t) {
      if (!level.dark[s]) return;
      const flash = C.flashAt(sim.clock);
      const d = sim.d;
      const cx = (d.x + C.P.dollW / 2) * S, cy = (d.y + C.P.dollH / 2 - s * C.SCREEN_H) * S;
      darkG.globalCompositeOperation = 'source-over';
      darkG.clearRect(0, 0, W, H);
      // 0.9: 灯りの外の足場も、明るい所でスマホを見て輪郭が分かるくらいに残す
      darkG.fillStyle = `rgba(2,3,6,${0.9 * (1 - flash)})`;
      darkG.fillRect(0, 0, W, H);
      darkG.globalCompositeOperation = 'destination-out';
      const r = 120 + Math.sin(t * 9) * 3;
      const gr = darkG.createRadialGradient(cx, cy, 30, cx, cy, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      darkG.fillStyle = gr;
      darkG.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.drawImage(darkCanvas, 0, 0);
      if (flash > 0) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(150,180,255,${0.18 * flash})`;
        g.fillRect(0, 0, W, H);
        g.restore();
      }
      // 機械の小さな灯り（暗くても見える）
      for (const [x, y, c, k] of [[44, 74, '#ff4a3a', 0], [378, 54, '#4aff8a', 1], [214, 274, '#ff4a3a', 2], [56, 434, '#ffcf4a', 3], [346, 484, '#4aff8a', 4]]) {
        if (Math.sin(t * (1.5 + k * 0.4) + k) > -0.2) rect(g, x, y, 3, 3, c);
      }
    }

    // 幽霊（前の自分の動き）
    let ghost = null;
    function drawGhost(g, s, t) {
      if (!ghost) return;
      const d = ghost.d;
      if (ghost.screenIndex() !== s) return;
      const rx = Math.round(d.x * S), ry = Math.round((d.y - s * C.SCREEN_H) * S);
      const cx = rx + (C.P.dollW * S) / 2, feet = ry + C.P.dollH * S;
      g.save();
      g.globalAlpha = 0.42;
      g.translate(cx, feet);
      g.scale(d.facing, 1);
      if (d.state === 'down') {
        g.rotate(-Math.PI / 2);
        g.drawImage(GHOST.idle, -3, -12);
      } else {
        let frame = 'idle';
        if (d.state === 'walking' && d.grounded) frame = ['a', 'idle', 'b', 'idle'][Math.floor(t * 10) % 4];
        else if (!d.grounded && d.vy < 0) frame = 'tuck';
        g.drawImage(GHOST[frame], -8, -24);
      }
      g.restore();
    }

    function drawRuns(g, s, t) {
      for (const run of runs[s]) {
        const y = run.r * T;
        if (run.ch === '=') {
          const len = (run.c2 - run.c1 + 1) * T;
          const p = ((t * 40) % (len + 60)) - 30;
          const x = run.c1 * T + Math.round(p);
          if (x > run.c1 * T && x < (run.c2 + 1) * T - 6) rect(g, x, y + 1, 6, 1, '#f0e2ff');
          continue;
        }
        const dir = (run.ch === '>' ? 1 : -1) * (sim.beltFlip ? -1 : 1);
        const x1 = run.c1 * T, x2 = (run.c2 + 1) * T;
        rect(g, x1, y, x2 - x1, 4, '#3b3f47');
        const phase = (((t * C.P.conveyor * S * dir) % 8) + 8) % 8;
        for (let x = x1 - 8 + Math.floor(phase); x < x2; x += 8) {
          if (x < x1 || x + 3 > x2) continue;
          rect(g, x, y, 3, 1, '#d9a441');
          rect(g, x + (dir > 0 ? 1 : 0), y + 1, 2, 1, '#d9a441');
          rect(g, x, y + 2, 3, 1, '#a87a2a');
        }
        rect(g, x1, y + 3, x2 - x1, 1, '#15161a');
        // 両端の歯車
        for (const gx of [x1 + 6, x2 - 6]) {
          g.fillStyle = '#4a4f59';
          g.beginPath();
          g.arc(gx, y + 9, 5, 0, Math.PI * 2);
          g.fill();
          const a = t * dir * 7;
          rect(g, Math.round(gx + Math.cos(a) * 3) - 1, Math.round(y + 9 + Math.sin(a) * 3) - 1, 2, 2, '#c8ced8');
          rect(g, gx - 1, y + 8, 2, 2, '#1a1b20');
        }
      }
    }

    function drawBell(g, s, t) {
      const bs = level.bells.filter((b) => Math.floor(b.y / C.ROWS) === s);
      if (!bs.length) return;
      const minX = Math.min(...bs.map((b) => b.x)) * T;
      const maxX = (Math.max(...bs.map((b) => b.x)) + 1) * T;
      const minY = Math.min(...bs.map((b) => b.y)) * T - s * H;
      const cx = Math.round((minX + maxX) / 2);
      const top = minY - 6;
      const swing = endT === null ? Math.sin(t * 0.8) * 0.02 : Math.sin((t - endT) * 5) * 0.35 * Math.exp(-(t - endT) * 0.25);
      if (endT !== null) {
        const k = Math.min(1, (t - endT) / 0.6);
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + (t - endT) * 0.3;
          g.strokeStyle = `rgba(255,214,120,${0.12 * k})`;
          g.lineWidth = 10;
          g.beginPath();
          g.moveTo(cx, top + 30);
          g.lineTo(cx + Math.cos(a) * 300, top + 30 + Math.sin(a) * 300);
          g.stroke();
        }
        glow(g, cx, top + 30, 140, '255,210,120', 0.35 * k);
        g.restore();
      }
      g.save();
      g.translate(cx, top);
      g.rotate(swing);
      rect(g, -3, -10, 6, 12, '#3b2416');
      g.drawImage(BELL, -BELL.width / 2, 0);
      g.restore();
    }

    function drawDoll(g, s, t) {
      const d = sim.d;
      const rx = Math.round(d.x * S), ry = Math.round((d.y - s * C.SCREEN_H) * S);
      const cx = rx + (C.P.dollW * S) / 2;
      const feet = ry + C.P.dollH * S;
      g.save();
      if (d.state === 'down') {
        g.translate(cx, feet);
        g.scale(d.facing, 1);
        g.rotate(-Math.PI / 2);
        g.drawImage(DOLL.idle, -3, -12);
        g.restore();
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          rect(g, Math.round(cx - d.facing * 10 + Math.cos(a) * 8), Math.round(feet - 18 + Math.sin(a) * 3), 2, 2, '#ffe27a');
        }
        return;
      }
      const walking = d.state === 'walking' && d.grounded;
      let frame = 'idle';
      if (walking) frame = ['a', 'idle', 'b', 'idle'][Math.floor(t * 10) % 4];
      else if (!d.grounded && d.vy < 0) frame = 'tuck';
      const sx = d.state === 'winding' && shake > 0 ? (Math.floor(t * 60) % 2 ? 1 : -1) : 0;
      g.translate(cx + sx, feet);
      g.scale(d.facing, 1);
      g.drawImage(DOLL[frame], -8, -24);
      // 背中のねじ（回ると幅が変わって見える）
      const kw = Math.max(1, Math.round(Math.abs(Math.cos(keyAngle)) * 5));
      const kx = -8 - kw;
      rect(g, -8, -10, 3, 2, '#7b8290');
      rect(g, kx + Math.floor((kw - 1) / 2), -11, 1, 3, '#9aa0aa');
      for (const ly of [-17, -8]) {
        rect(g, kx, ly, kw, 6, '#c9ced6');
        rect(g, kx, ly, kw, 1, '#eef1f5');
        rect(g, kx, ly + 5, kw, 1, '#7b8290');
        if (kw >= 3) rect(g, kx + 1, ly + 2, kw - 2, 2, '#2a2433');
      }
      g.restore();
    }

    function drawGauge(g, s) {
      const d = sim.d;
      if (sim.ended || !(d.state === 'winding' || (d.wind > 0 && d.state !== 'down'))) return;
      const cx = Math.round((d.x + C.P.dollW / 2) * S);
      const y = Math.round((d.y - s * C.SCREEN_H) * S) - 18;
      const cap = d.cap || C.P.maxWind;
      const w = cap * 2;
      const x0 = Math.max(4, Math.min(W - w - 4, cx - w / 2));
      rect(g, x0 - 3, y - 3, w + 6, 9, '#2a1f12');
      rect(g, x0 - 2, y - 2, w + 4, 7, cap > C.P.maxWind ? '#ffd860' : '#a8742a');
      rect(g, x0 - 1, y - 1, w + 2, 5, '#1b1424');
      if (cap > C.P.maxWind) rect(g, x0 + C.P.maxWind * 2, y, (cap - C.P.maxWind) * 2, 3, '#3a2a10');
      const fill = Math.round(Math.max(0, Math.min(cap, d.wind)) * 2);
      rect(g, x0, y, Math.min(fill, C.P.maxWind * 2), 3, '#f4efe6');
      if (fill > C.P.maxWind * 2) rect(g, x0 + C.P.maxWind * 2, y, fill - C.P.maxWind * 2, 3, '#ffd860');
      for (let i = 4; i < cap; i += 4) rect(g, x0 + i * 2, y, 1, 3, 'rgba(27,20,36,0.7)');
    }

    // ---------- 粒 ----------
    function puff(x, y, n, col, spread, up) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * spread,
          vy: -Math.random() * up,
          g: 120,
          life: 0,
          max: 0.35 + Math.random() * 0.3,
          col,
          size: Math.random() > 0.5 ? 3 : 2,
        });
      }
    }

    function onEvent(e) {
      const d = sim.d;
      const fx = (d.x + C.P.dollW / 2) * S, fy = (d.y + C.P.dollH) * S;
      if (e === 'click') {
        keyAngle += Math.PI / 6;
        shake = 0.06;
        particles.push({ x: fx - d.facing * 18, y: fy - 22, vx: -d.facing * 20, vy: -30, g: 0, life: 0, max: 0.25, col: '#fff6c8', size: 2 });
      } else if (e === 'land') puff(fx, fy, 6, '#9a8a7a', 60, 30);
      else if (e === 'jump') puff(fx, fy, 4, '#9a8a7a', 40, 20);
      else if (e === 'step') puff(fx - d.facing * 4, fy, 1, '#7a6a5a', 20, 15);
      else if (e === 'splat') {
        puff(fx, fy, 14, '#a8988a', 140, 60);
        for (let i = 0; i < 3; i++) {
          particles.push({ x: fx, y: fy - 10, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80, g: 600, life: 0, max: 0.9, col: '#c9ced6', size: 3 });
        }
      } else if (e === 'bonk') {
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2;
          particles.push({ x: fx, y: fy - 10, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, g: 0, life: 0, max: 0.2, col: '#ffe27a', size: 2 });
        }
      } else if (e === 'sting') {
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          particles.push({ x: fx, y: fy - 10, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, g: 0, life: 0, max: 0.3, col: i % 2 ? '#ff5a3a' : '#ffe27a', size: 3 });
        }
      } else if (e === 'guard') {
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          particles.push({ x: fx, y: fy - 10, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, g: 0, life: 0, max: 0.25, col: i % 2 ? '#fff6c8' : '#ffd860', size: 2 });
        }
      } else if (e === 'bell') {
        endT = lastT;
      }
    }

    // ふつうの塔で巻いている間は、ハチを弾く金色の輪を出す（ハチのいる階だけ）
    function drawGuard(g, s, t) {
      const d = sim.d;
      if (sim.hard || d.state !== 'winding' || !sim.bees.some((b) => b.screen === s)) return;
      const cx = (d.x + C.P.dollW / 2) * S, cy = (d.y + C.P.dollH / 2 - s * C.SCREEN_H) * S;
      g.globalAlpha = 0.75 + 0.2 * Math.sin(t * 8);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + t * 2;
        rect(g, Math.round(cx + Math.cos(a) * 18) - 1, Math.round(cy + Math.sin(a) * 21) - 1, 3, 3, i % 2 ? '#ffd860' : '#fff6c8');
      }
      g.globalAlpha = 1;
    }

    function drawParticles(g, s, dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const ry = p.y - s * H;
        if (ry < -10 || ry > H + 10) continue;
        g.globalAlpha = 1 - p.life / p.max;
        rect(g, Math.round(p.x), Math.round(ry), p.size, p.size, p.col);
      }
      g.globalAlpha = 1;
    }

    for (let s = 0; s < level.screenCount; s++) runs.push(runsOf(level, s));

    function render(t) {
      const dt = lastT === null ? 0 : Math.min(0.1, t - lastT);
      lastT = t;
      if (shake > 0) shake -= dt;
      const d = sim.d;
      if (d.state === 'walking' && d.grounded) keyAngle -= dt * 6;
      if (sim.ended && endT === null) endT = t;
      if (!sim.ended) endT = null;
      const s = sim.screenIndex();
      if (!statics[s]) statics[s] = buildStatic(s);
      const theme = level.themes[s];
      curScreen = s;
      ctx.drawImage(statics[s].bg, 0, 0);
      if (DYN[theme]) DYN[theme](ctx, t);
      ctx.drawImage(statics[s].fg, 0, 0);
      drawRuns(ctx, s, t);
      drawRust(ctx, s, t);
      drawVents(ctx, s, t);
      drawMagnets(ctx, s, t);
      drawCuckoos(ctx, s, t);
      drawMovers(ctx, s);
      drawBell(ctx, s, t);
      drawGhost(ctx, s, t);
      if (!(d.hurtT > 0 && Math.floor(t * 16) % 2)) drawDoll(ctx, s, t);
      drawBees(ctx, s, t);
      drawParticles(ctx, s, dt);
      drawDark(ctx, s, t);
      drawGauge(ctx, s);
      ctx.drawImage(vignette, 0, 0);
      drawWind(ctx, s, t);
      // 金色の輪は周りを暗くする絵の上に描き、暗い階でも見えるようにする
      drawGuard(ctx, s, t);
    }

    function reset() {
      particles.length = 0;
      rustWas.length = 0;
      endT = null;
    }

    return { render, onEvent, reset, buildStatic, setGhost: (g) => (ghost = g) };
  }

  root.ZenmaiArt = { create: Art, SCALE: S, W, H, THEMES };
})(window);
