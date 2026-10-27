// ゼンマイの塔: 階ごとの音楽（WebAudio で合成。音のファイルは使わない）
// 譜面は「音階の何番目か」を空白区切りで並べる。. は休み、- は前の音を伸ばす。1文字が16分音符1つ。
(function (root) {
  'use strict';

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    penta: [0, 2, 4, 7, 9],
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function degree(rootNote, scale, d) {
    const s = SCALES[scale];
    const o = Math.floor(d / s.length);
    const i = ((d % s.length) + s.length) % s.length;
    return rootNote + o * 12 + s[i];
  }
  function parse(p) {
    return p.replace(/\|/g, ' ').trim().split(/\s+/).map((t) => (t === '.' ? null : t === '-' ? '-' : t === 'x' ? 'x' : Number(t)));
  }

  // ---------- 曲 ----------
  // beats: 1小節の拍数。tracks の inst は楽器、drum は打楽器、chord: true は三和音で鳴らす。oct は半音でずらす量。
  const SONGS = {
    // ゼンマイ置き場（おもちゃ工房）:オルゴールのワルツ
    workshop: {
      bpm: 100, beats: 3, root: 60, scale: 'major',
      tracks: [
        { inst: 'box', vel: 0.2, oct: 12, pat: '4 . . . 7 . . . 6 . 5 . | 5 . . . 3 . . . 7 . . . | 2 . . . 5 . . . 7 . 5 . | 6 . . . 4 . . . 1 . . .' },
        { inst: 'box', vel: 0.06, oct: 24, pat: '0 . 4 . 7 . . . . . . . | 3 . 5 . 7 . . . . . . . | 5 . 7 . 9 . . . . . . . | 4 . 6 . 8 . . . . . . .' },
        { inst: 'bass', vel: 0.2, oct: -12, pat: '0 . . . 4 . . . 4 . . . | 3 . . . 7 . . . 7 . . . | 5 . . . 9 . . . 9 . . . | 4 . . . 8 . . . 8 . . .' },
        { drum: 'tick', vel: 0.035, pat: 'x . . . x . . . x . . .' },
      ],
    },
    // 油の床（配管の機械室）:低くゆっくり、油のしずく
    oil: {
      bpm: 80, beats: 4, root: 57, scale: 'minor', delay: 0.25,
      tracks: [
        { inst: 'sqbass', vel: 0.16, oct: -12, pat: '0 . . 0 . . 0 . 3 . . 3 . . 2 . | 0 . . 0 . . 0 . -2 . . -2 . . -1 .' },
        { inst: 'pad', vel: 0.05, chord: true, pat: '0 - - - - - - - - - - - - - - - | -2 - - - - - - - - - - - - - - -' },
        { inst: 'pluck', vel: 0.09, oct: 12, pat: '. . . . 4 . . . . . . 2 . . . . | . . . . . . 6 . . . . . 4 . . .' },
        { drum: 'drip', vel: 0.05, pat: '. . . . . . . . . . . x . . . . | . . . x . . . . . . . . . . . .' },
        { drum: 'thump', vel: 0.12, pat: 'x . . . . . . . x . . . . . . .' },
        { drum: 'hat', vel: 0.02, pat: '. . x . . . x . . . x . . . x .' },
      ],
    },
    // 歯車のベルト:機械の刻み
    gears: {
      bpm: 112, beats: 4, root: 62, scale: 'dorian',
      tracks: [
        { inst: 'pluck', vel: 0.08, pat: '0 4 7 4 0 4 7 4 1 5 8 5 1 5 8 5 | -1 3 6 3 -1 3 6 3 0 4 7 4 2 4 7 9' },
        { inst: 'bass', vel: 0.2, oct: -12, pat: '0 . . . 0 . . . 1 . . . 1 . . . | -1 . . . -1 . . . 0 . . . 2 . . .' },
        { drum: 'thump', vel: 0.14, pat: 'x . . . x . . . x . . . x . . .' },
        { drum: 'clack', vel: 0.05, pat: '. . x . . . x . . . x . . . x .' },
        { drum: 'tick', vel: 0.025, pat: 'x . x . x . x . x . x . x . x .' },
      ],
    },
    // ねじ巻きの間:はずむ弦
    winding: {
      bpm: 120, beats: 4, root: 65, scale: 'major',
      tracks: [
        { inst: 'pluck', vel: 0.1, oct: 12, pat: '0 . 2 . 4 . 2 . 5 . 4 . 2 . 0 . | 1 . 3 . 5 . 3 . 6 . 5 . 4 . . . | 0 . 2 . 4 . 7 . 9 . 7 . 4 . 2 . | 3 . 1 . -1 . 1 . 0 . . . . . . .' },
        { inst: 'bass', vel: 0.2, oct: -12, pat: '0 . . . 4 . . . 1 . . . 4 . . . | 0 . . . 4 . . . -3 . . . -1 . . .' },
        { drum: 'clack', vel: 0.035, pat: 'x . x x x . x x x . x x x . x x' },
        { drum: 'thump', vel: 0.1, pat: 'x . . . . . . . x . . . . . . .' },
      ],
    },
    // 振り子の間:ゆっくりした3拍子とチクタク
    pendulum: {
      bpm: 72, beats: 3, root: 64, scale: 'minor', delay: 0.3,
      tracks: [
        { inst: 'box', vel: 0.16, pat: '7 . . . 6 . . . 4 . . . | 5 . . . 4 . . . 2 . . . | 3 . . . 2 . . . 0 . . . | 1 . . . . . . . -1 . . .' },
        { inst: 'pad', vel: 0.05, chord: true, oct: -12, pat: '0 - - - - - - - - - - - | 5 - - - - - - - - - - - | 3 - - - - - - - - - - - | 4 - - - - - - - - - - -' },
        { drum: 'tick', vel: 0.05, pat: 'x . . . . . . . x . . .' },
        { drum: 'tock', vel: 0.05, pat: '. . . . x . . . . . . .' },
      ],
    },
    // ハチの巣:羽音と細かい刻み
    hive: {
      bpm: 132, beats: 4, root: 57, scale: 'phrygian',
      tracks: [
        { inst: 'buzz', vel: 0.035, oct: -12, pat: '0 - - - - - - - - - - - - - - - | 1 - - - - - - - - - - - - - - -' },
        { inst: 'pluck', vel: 0.08, oct: 12, pat: '0 . 0 1 . 0 . 3 0 . 0 1 . 4 3 1 | 0 . 0 1 . 0 . 5 4 . 3 1 . 0 -1 .' },
        { drum: 'hat', vel: 0.018, pat: 'x x x x x x x x x x x x x x x x' },
        { drum: 'thump', vel: 0.11, pat: 'x . . . . . x . x . . . . . . .' },
      ],
    },
    // 女王の間:ハチの巣を速く重く
    queen: {
      bpm: 144, beats: 4, root: 57, scale: 'phrygian',
      tracks: [
        { inst: 'buzz', vel: 0.045, oct: -12, pat: '0 - - - - - - - 1 - - - - - - - | 0 - - - - - - - -1 - - - - - - -' },
        { inst: 'sqbass', vel: 0.13, oct: -12, pat: '0 . 0 . 0 . 1 . 0 . 0 . 0 . -1 . | 0 . 0 . 0 . 1 . 3 . 1 . 0 . -1 .' },
        { inst: 'pluck', vel: 0.08, oct: 12, pat: '4 . 3 . 1 . 0 . 1 . 3 . 4 . 5 . | 4 . 3 . 1 . 0 . 1 . 0 . -1 . . .' },
        { drum: 'hat', vel: 0.02, pat: 'x x x x x x x x x x x x x x x x' },
        { drum: 'thump', vel: 0.13, pat: 'x . . x . . x . x . . x . . x .' },
      ],
    },
    // 大時計:鐘のような旋律と時を刻む音
    clock: {
      bpm: 100, beats: 4, root: 55, scale: 'major', delay: 0.2,
      tracks: [
        { inst: 'bell', vel: 0.09, oct: 12, pat: '0 . . . 2 . . . 4 . . . 7 . . . | 6 . . . 4 . . . 5 . . . . . . . | 4 . . . 2 . . . 3 . . . 5 . . . | 4 . . . . . . . . . . . . . . .' },
        { inst: 'bass', vel: 0.18, oct: -12, pat: '0 . . . . . . . 0 . . . . . . . | 3 . . . . . . . 4 . . . . . . . | 5 . . . . . . . 3 . . . . . . . | 4 . . . . . . . 4 . . . . . . .' },
        { inst: 'pad', vel: 0.04, chord: true, pat: '0 - - - - - - - - - - - - - - - | 3 - - - - - - - 4 - - - - - - - | 5 - - - - - - - 3 - - - - - - - | 4 - - - - - - - - - - - - - - -' },
        { drum: 'tick', vel: 0.05, pat: 'x . . . x . . . x . . . x . . .' },
        { drum: 'tock', vel: 0.06, pat: 'x . . . . . . . . . . . . . . .' },
      ],
    },
    // せまい梁:夜の分散和音
    beams: {
      bpm: 84, beats: 4, root: 62, scale: 'minor', delay: 0.35,
      tracks: [
        { inst: 'box', vel: 0.11, pat: '0 2 4 7 4 2 0 2 -2 0 2 5 2 0 -2 0 | -3 -1 1 4 1 -1 -3 -1 -4 -2 0 3 0 -2 -1 1' },
        { inst: 'pad', vel: 0.045, chord: true, oct: -12, pat: '0 - - - - - - - -2 - - - - - - - | -3 - - - - - - - -4 - - - - - - -' },
        { drum: 'tick', vel: 0.03, pat: 'x . . . . . . . x . . . . . . .' },
      ],
    },
    // 鐘楼:星空と小さな鐘
    belfry: {
      bpm: 90, beats: 4, root: 67, scale: 'penta', delay: 0.4,
      tracks: [
        { inst: 'bell', vel: 0.08, pat: '4 . . . . . . . 2 . . . 7 . . . | . . . . 9 . . . 7 . . . . . . . | 5 . . . . . . . 4 . . . 2 . . . | . . . . 0 . . . . . . . . . . .' },
        { inst: 'pad', vel: 0.05, chord: true, oct: -12, pat: '0 - - - - - - - - - - - - - - - | 3 - - - - - - - - - - - - - - - | 1 - - - - - - - - - - - - - - - | 0 - - - - - - - - - - - - - - -' },
        { inst: 'box', vel: 0.04, oct: 12, pat: '. . 7 . . . 9 . . . 7 . . . 4 . | . . 9 . . . 11 . . . 9 . . . 7 .' },
      ],
    },
    // 蒸気の配管: 汽車のような刻みと、噴き出す息
    steam: {
      bpm: 96, beats: 4, root: 55, scale: 'minor', delay: 0.2,
      tracks: [
        { inst: 'sqbass', vel: 0.15, oct: -12, pat: '0 . 0 0 . 0 0 . 3 . 3 3 . 3 2 . | 0 . 0 0 . 0 0 . -2 . -2 -2 . -1 0 .' },
        { inst: 'pluck', vel: 0.09, oct: 12, pat: '4 . . 2 . . 4 . 5 . . 4 . . 2 . | 4 . . 2 . . 0 . -1 . . 0 . . . .' },
        { inst: 'pad', vel: 0.04, chord: true, pat: '0 - - - - - - - 3 - - - - - - - | 0 - - - - - - - -2 - - - - - - -' },
        { drum: 'hat', vel: 0.03, pat: '. x x . . x x . . x x . . x x .' },
        { drum: 'thump', vel: 0.12, pat: 'x . . . x . . . x . . . x . . .' },
      ],
    },
    // 逆巻きの間: 下りていく音形と、裏返った拍
    reverse: {
      bpm: 104, beats: 4, root: 64, scale: 'major', delay: 0.3,
      tracks: [
        { inst: 'box', vel: 0.12, pat: '. . 7 - . 5 . 4 . 2 . 0 - - . . | . . 6 - . 4 . 3 . 1 . -1 - - . .' },
        { inst: 'box', vel: 0.05, oct: 12, pat: '. 4 . 2 . 0 . -1 . 0 . 2 . 4 . . | . 3 . 1 . -1 . -2 . -1 . 1 . 3 . .' },
        { inst: 'bass', vel: 0.17, oct: -12, pat: '. . 0 . . . 0 . . . 3 . . . 4 . | . . -1 . . . -1 . . . 3 . . . 4 .' },
        { drum: 'tock', vel: 0.05, pat: '. . x . . . x . . . x . . . x .' },
        { drum: 'tick', vel: 0.03, pat: '. x . x . x . x . x . x . x . x' },
      ],
    },
    // 鳩時計の間: 「カッコー」の音程と木の時計の刻み
    cuckoo: {
      bpm: 116, beats: 3, root: 65, scale: 'major',
      tracks: [
        { inst: 'box', vel: 0.15, oct: 12, pat: '4 . 2 . . . 4 . 2 . . . | 5 . 4 . 2 . 0 . . . . . | 4 . 2 . . . 4 . 2 . . . | 3 . 1 . -1 . 0 . . . . .' },
        { inst: 'pluck', vel: 0.06, pat: '0 . 2 . 4 . 0 . 2 . 4 . | 3 . 5 . 7 . 3 . 5 . 7 . | 0 . 2 . 4 . 0 . 2 . 4 . | -1 . 1 . 4 . 0 . 2 . 4 .' },
        { inst: 'bass', vel: 0.18, oct: -12, pat: '0 . . . . . 4 . . . . . | 3 . . . . . 3 . . . . . | 0 . . . . . 4 . . . . . | 4 . . . . . 0 . . . . .' },
        { drum: 'tick', vel: 0.04, pat: 'x . . . x . . . x . . .' },
        { drum: 'clack', vel: 0.03, pat: '. . x . . . x . . . x .' },
      ],
    },
    // 停電の機械室: 暗い持続音と、遠くの雷
    dark: {
      bpm: 66, beats: 4, root: 52, scale: 'phrygian', delay: 0.45,
      tracks: [
        { inst: 'pad', vel: 0.06, chord: true, oct: -12, pat: '0 - - - - - - - - - - - - - - - | 1 - - - - - - - - - - - - - - -' },
        { inst: 'pluck', vel: 0.07, oct: 12, pat: '. . . . 4 . . . . . . . 3 . . . | . . . . . . 1 . . . . . 0 . . .' },
        { inst: 'bass', vel: 0.14, oct: -12, pat: '0 . . . . . . . . . . . . . . . | 1 . . . . . . . 0 . . . . . . .' },
        { drum: 'drip', vel: 0.04, pat: '. . . . . . . . . . x . . . . . | . . . x . . . . . . . . . . . .' },
        { drum: 'thump', vel: 0.07, pat: 'x . . . . . . . . . . . . . . . | . . . . . . . . x . . . . . . .' },
      ],
    },
    // 磁石の間: うなる電気と細かい分散和音
    magnet: {
      bpm: 108, beats: 4, root: 57, scale: 'dorian',
      tracks: [
        { inst: 'buzz', vel: 0.025, oct: -12, pat: '0 - - - - - - - - - - - - - - - | -2 - - - - - - - - - - - - - - -' },
        { inst: 'pluck', vel: 0.08, oct: 12, pat: '0 2 4 2 0 2 4 6 0 2 4 2 0 2 4 7 | -2 0 2 0 -2 0 2 4 -2 0 2 0 -1 1 3 5' },
        { inst: 'sqbass', vel: 0.12, oct: -12, pat: '0 . . . 0 . . . 0 . . 0 . . 0 . | -2 . . . -2 . . . -2 . . -2 . . -1 .' },
        { drum: 'clack', vel: 0.04, pat: '. . x . . . x . . . x . . x x .' },
        { drum: 'thump', vel: 0.11, pat: 'x . . . . . . . x . . . . . . .' },
      ],
    },
    // 錆びた梁: きしむ低い音と、ゆっくり下る旋律
    rust: {
      bpm: 84, beats: 4, root: 50, scale: 'minor', delay: 0.3,
      tracks: [
        { inst: 'pluck', vel: 0.09, oct: 12, pat: '7 . . 5 . . 4 . 3 . . 2 . . 0 . | 4 . . 3 . . 2 . 0 . . -1 . . 0 .' },
        { inst: 'pad', vel: 0.045, chord: true, pat: '0 - - - - - - - -2 - - - - - - - | -3 - - - - - - - -1 - - - - - - -' },
        { inst: 'bass', vel: 0.17, oct: -12, pat: '0 . . . . . . . -2 . . . . . . . | -3 . . . . . . . -1 . . . . . . .' },
        { drum: 'tock', vel: 0.05, pat: 'x . . . . . x . . . x . . . . .' },
        { drum: 'clack', vel: 0.02, pat: '. . . . . . . . . . . . . . x .' },
      ],
    },
    // 塔の外壁: 風の中のひらけた旋律
    outside: {
      bpm: 92, beats: 4, root: 62, scale: 'penta', delay: 0.35,
      tracks: [
        { inst: 'pluck', vel: 0.09, oct: 12, pat: '0 . 2 . 4 . . . 5 . 4 . 2 . . . | 3 . 4 . 2 . . . 0 . . . . . . .' },
        { inst: 'pad', vel: 0.05, chord: true, oct: -12, pat: '0 - - - - - - - - - - - - - - - | 3 - - - - - - - 4 - - - - - - -' },
        { inst: 'bell', vel: 0.04, oct: 12, pat: '. . . . . . . . . . . . 7 . . . | . . . . . . . . 9 . . . . . . .' },
        { drum: 'hat', vel: 0.02, pat: 'x . x . x . x . x . x . x . x .' },
      ],
    },
  };
  for (const s of Object.values(SONGS)) for (const t of s.tracks) t.notes = parse(t.pat);

  // ---------- 楽器 ----------
  let noiseBuf = null;
  function noise(ac) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }
  function env(ac, out, t, a, peak, dec, sustainUntil) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sustainUntil) g.gain.setValueAtTime(peak, sustainUntil);
    g.gain.exponentialRampToValueAtTime(0.0001, (sustainUntil || t + a) + dec);
    g.connect(out);
    return g;
  }
  function osc(ac, type, f, t, stop, dest, detune) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }
  const INST = {
    box(ac, out, t, f, dur, v) {
      [1, 2, 3].forEach((m, i) => {
        const g = env(ac, out, t, 0.004, v * [1, 0.3, 0.1][i], 1.4 / (i + 1));
        osc(ac, 'sine', f * m, t, t + 1.6, g);
      });
    },
    pluck(ac, out, t, f, dur, v) {
      const g = env(ac, out, t, 0.004, v, 0.28);
      osc(ac, 'triangle', f, t, t + 0.35, g);
    },
    bass(ac, out, t, f, dur, v) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      lp.connect(out);
      const g = env(ac, lp, t, 0.01, v, Math.max(0.2, dur * 0.9));
      osc(ac, 'triangle', f, t, t + dur + 0.3, g);
    },
    sqbass(ac, out, t, f, dur, v) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 650;
      lp.connect(out);
      const g = env(ac, lp, t, 0.01, v, Math.max(0.15, dur * 0.8));
      osc(ac, 'square', f, t, t + dur + 0.3, g);
    },
    pad(ac, out, t, f, dur, v) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1000;
      lp.connect(out);
      const g = env(ac, lp, t, Math.min(0.4, dur / 3), v, 0.5, t + Math.max(0.05, dur - 0.1));
      osc(ac, 'sawtooth', f, t, t + dur + 0.6, g, -7);
      osc(ac, 'sawtooth', f, t, t + dur + 0.6, g, 7);
    },
    bell(ac, out, t, f, dur, v) {
      [1, 2.76, 5.4, 8.9].forEach((m, i) => {
        const g = env(ac, out, t, 0.003, v / (i + 1), 2.6 / (i + 1));
        osc(ac, 'sine', f * m, t, t + 2.8, g);
      });
    },
    buzz(ac, out, t, f, dur, v) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.connect(out);
      const g = env(ac, lp, t, 0.2, v, 0.3, t + Math.max(0.05, dur - 0.1));
      const o = osc(ac, 'sawtooth', f, t, t + dur + 0.4, g);
      const lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = 7;
      lg.gain.value = f * 0.02;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.4);
    },
  };
  const DRUM = {
    tick(ac, out, t, v) {
      const s = noise(ac);
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      s.connect(hp).connect(env(ac, out, t, 0.001, v, 0.025));
      s.start(t, Math.random() * 0.5, 0.05);
    },
    hat(ac, out, t, v) {
      const s = noise(ac);
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 9000;
      s.connect(hp).connect(env(ac, out, t, 0.001, v, 0.04));
      s.start(t, Math.random() * 0.5, 0.06);
    },
    clack(ac, out, t, v) {
      const s = noise(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      s.connect(bp).connect(env(ac, out, t, 0.001, v * 3, 0.05));
      s.start(t, Math.random() * 0.5, 0.08);
    },
    tock(ac, out, t, v) {
      const g = env(ac, out, t, 0.002, v * 2, 0.06);
      const o = osc(ac, 'sine', 950, t, t + 0.1, g);
      o.frequency.exponentialRampToValueAtTime(650, t + 0.05);
    },
    thump(ac, out, t, v) {
      const g = env(ac, out, t, 0.003, v * 2, 0.18);
      const o = osc(ac, 'sine', 120, t, t + 0.25, g);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    },
    drip(ac, out, t, v) {
      const g = env(ac, out, t, 0.002, v * 2, 0.1);
      const o = osc(ac, 'sine', 1500 + Math.random() * 300, t, t + 0.15, g);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.09);
    },
  };

  // ---------- 鳴らす仕組み ----------
  function create(getAudio) {
    let ac = null, bus = null, delayIn = null;
    let enabled = true;
    let wanted = null;
    let voice = null;
    let level = 1;
    const VOLUME = 0.55;

    function ensure() {
      ac = getAudio();
      if (!ac) return false;
      if (!bus) {
        bus = ac.createGain();
        bus.gain.value = VOLUME;
        bus.connect(ac.destination);
        delayIn = ac.createGain();
        const dl = ac.createDelay(1);
        dl.delayTime.value = 0.33;
        const fb = ac.createGain();
        fb.gain.value = 0.35;
        delayIn.connect(dl);
        dl.connect(fb).connect(dl);
        dl.connect(bus);
      }
      return true;
    }

    function stopVoice(v, fade) {
      if (!v) return;
      v.stopped = true;
      const t = ac.currentTime;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => v.gain.disconnect(), (fade + 3) * 1000);
    }

    function startVoice(name) {
      const song = SONGS[name];
      if (!song || !ensure()) return null;
      const gain = ac.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(level, ac.currentTime + 0.8);
      gain.connect(bus);
      let send = null;
      if (song.delay) {
        send = ac.createGain();
        send.gain.value = song.delay;
        gain.connect(send).connect(delayIn);
      }
      return { name, song, gain, send, step: 0, time: ac.currentTime + 0.1, stopped: false };
    }

    function scheduleStep(v) {
      const s = v.song;
      const stepDur = 60 / s.bpm / 4;
      for (const tr of s.tracks) {
        const n = tr.notes;
        const i = v.step % n.length;
        const tok = n[i];
        if (tok === null || tok === '-') continue;
        if (tr.drum) {
          DRUM[tr.drum](ac, v.gain, v.time, tr.vel);
          continue;
        }
        let len = 1;
        while (len < n.length && n[(i + len) % n.length] === '-') len++;
        const dur = len * stepDur;
        const base = degree(s.root + (tr.oct || 0), s.scale, tok);
        const notes = tr.chord ? [base, degree(s.root + (tr.oct || 0), s.scale, tok + 2), degree(s.root + (tr.oct || 0), s.scale, tok + 4)] : [base];
        for (const m of notes) INST[tr.inst](ac, v.gain, v.time, mtof(m), dur, tr.vel / notes.length ** 0.5);
      }
      v.step++;
      v.time += stepDur;
    }

    setInterval(() => {
      if (!voice || voice.stopped || !ac) return;
      if (ac.state !== 'running') return;
      if (voice.time < ac.currentTime) voice.time = ac.currentTime + 0.05;
      while (voice.time < ac.currentTime + 0.2) scheduleStep(voice);
    }, 40);

    function play(name) {
      wanted = name;
      if (!enabled) return;
      if (voice && voice.name === name && !voice.stopped) return;
      if (!ensure()) return;
      stopVoice(voice, 0.8);
      voice = startVoice(name);
    }

    function fanfare() {
      if (!enabled || !ensure()) return;
      stopVoice(voice, 0.3);
      voice = null;
      const out = ac.createGain();
      out.gain.value = 1;
      out.connect(bus);
      const t = ac.currentTime + 0.1;
      [0, 4, 7, 12, 16, 19, 24].forEach((m, i) => INST.box(ac, out, t + i * 0.09, mtof(60 + m), 0.4, 0.14));
      [48, 55, 60, 64].forEach((m) => INST.bell(ac, out, t + 0.7, mtof(m), 3, 0.1));
      [60, 64, 67].forEach((m) => INST.pad(ac, out, t + 0.7, mtof(m), 3.5, 0.04));
      setTimeout(() => {
        if (wanted === '__ending') {
          wanted = 'belfry';
          play('belfry');
        }
      }, 5500);
      wanted = '__ending';
    }

    return {
      play,
      fanfare,
      setEnabled(on) {
        enabled = on;
        if (!on) {
          if (ac) stopVoice(voice, 0.4);
          voice = null;
        } else if (wanted && wanted !== '__ending') {
          const w = wanted;
          wanted = null;
          play(w);
        }
      },
      setLevel(x) {
        level = x;
        if (voice && ac) voice.gain.gain.setTargetAtTime(x, ac.currentTime, 0.2);
      },
      current: () => (voice && !voice.stopped ? voice.name : null),
    };
  }

  root.ZenmaiMusic = { create, SONGS };
})(window);
