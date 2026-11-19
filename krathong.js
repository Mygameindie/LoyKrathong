// Krathong model, links, SVG drawing and the hand-drawn krathong codec.
// Shared by the river (river.js) and the maker (builder.js).
(() => {
  'use strict';

  // ---------- options for "Create your krathong" ----------
  const BASES = {
    banana:  { label: 'Banana trunk', emoji: '🍌' },
    bread:   { label: 'Bread',        emoji: '🍞' },
    coconut: { label: 'Coconut',      emoji: '🥥' },
    lotus:   { label: 'Lotus',        emoji: '🪷' }
  };
  const LEAVES = {
    pointed: { label: 'Folded points', emoji: '🔺' },
    round:   { label: 'Petals',        emoji: '🌸' },
    layered: { label: 'Two layers',    emoji: '👑' }
  };
  const LEAF_COLORS = {
    green: { label: 'Banana green', a: '#86c96f', b: '#3d8f3f', line: '#245e28' },
    lime:  { label: 'Young leaf',   a: '#d2eb98', b: '#86b84a', line: '#4f7a24' },
    gold:  { label: 'Gold',         a: '#ffe48f', b: '#d9a537', line: '#8f6214' },
    pink:  { label: 'Pink',         a: '#ffc9dd', b: '#ec80aa', line: '#a9416a' },
    white: { label: 'White',        a: '#ffffff', b: '#d5dde8', line: '#8d9aab' }
  };
  const FLOWERS = {
    marigold: { label: 'Marigold', emoji: '🌼' },
    rose:     { label: 'Rose',     emoji: '🌹' },
    orchid:   { label: 'Orchid',   emoji: '💜' },
    jasmine:  { label: 'Jasmine',  emoji: '🤍' }
  };
  const CENTERS = {
    lotus:   { label: 'Lotus bud',    emoji: '🪷' },
    cone:    { label: 'Flower cone',  emoji: '🔼' },
    bouquet: { label: 'Big marigold', emoji: '🌼' },
    none:    { label: 'Nothing',      emoji: '⭕' }
  };
  const CANDLES = {
    white: { label: 'White', c: '#fbf6ea' },
    gold:  { label: 'Gold',  c: '#ffd25e' },
    pink:  { label: 'Pink',  c: '#ff9cc2' },
    red:   { label: 'Red',   c: '#e8484f' },
    blue:  { label: 'Blue',  c: '#7cc4ff' }
  };
  const MODES = { create: 1, draw: 1 };

  // ---------- the drawing pad ----------
  // Drawings live on an 800×600 pad. The view of a krathong is 400×300; the water line is at WL.
  const PAD_W = 800, PAD_H = 600, VIEW_W = 400, VIEW_H = 300, WL = 252;
  const INKS = ['#ffffff', '#1d1a24', '#7a4a26', '#245e28', '#3d9a45', '#a6dc6a', '#ffe14d', '#ff9b1f',
    '#e8384b', '#ff8fbd', '#d24bd6', '#8c5cf0', '#3c7bf0', '#7fdcff', '#d4a537', '#f6e7c8'];
  const ERASER = 31;
  const WIDTHS = [5, 10, 20, 38];            // sizes of the first drawing format
  const MIN_W = 2, MAX_W = 65;                // brush sizes, in pad pixels

  const DEFAULTS = {
    mode: 'create', name: '', from: '', msg: '',
    base: 'banana', leaf: 'pointed', leafc: 'green', flowers: ['marigold', 'rose', 'jasmine'],
    center: 'lotus', candle: 'gold', incense: 3,
    strokes: [], drawId: '', flames: [], photo: null
  };
  const MAX_NAME = 30, MAX_MSG = 80, MAX_FLAMES = 3;
  const has = (t, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(t, k);
  const pick = (v, t, d) => has(t, v) ? v : d;
  const clean = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').slice(0, n);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // A drawing is a list of steps: { t: 's' brush | 'e' eraser | 'f' paint bucket, c: '#rrggbb', w: size, p: [x, y, ...] }
  const HEX = /^#[0-9a-f]{6}$/;
  function cleanStrokes(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const s of list.slice(0, 600)) {
      if (!s || !Array.isArray(s.p)) continue;
      let t = s.t, c = typeof s.c === 'string' ? s.c.toLowerCase() : '', w = +s.w;
      if (!t) {                                   // older format: palette index + size index
        t = s.i === ERASER ? 'e' : 's';
        c = INKS[clamp(s.i | 0, 0, INKS.length - 1)];
        w = WIDTHS[clamp(s.w | 0, 0, WIDTHS.length - 1)];
      }
      if (t !== 's' && t !== 'e' && t !== 'f') continue;
      if (!HEX.test(c)) c = '#000000';
      const p = [];
      const max = t === 'f' ? 2 : 16000;
      for (let k = 0; k + 1 < s.p.length && p.length < max; k += 2) p.push(clamp(Math.round(+s.p[k] || 0), 0, PAD_W - 1), clamp(Math.round(+s.p[k + 1] || 0), 0, PAD_H - 1));
      if (p.length) out.push({ t, c, w: clamp(Math.round(w) || 10, MIN_W, MAX_W), p });
    }
    return out;
  }
  function cleanFlames(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_FLAMES).filter(f => Array.isArray(f) && f.length === 2 && isFinite(f[0]) && isFinite(f[1]))
      .map(f => [clamp(Math.round(f[0]), 0, VIEW_W), clamp(Math.round(f[1]), 0, VIEW_H)]);
  }

  // ---------- your own photo, behind or in front of the krathong ----------
  // { src: local copy (maker's device only), id: cloud copy, x, y: center, w: width (view units),
  //   ar: height / width, layer: 'back' | 'front', shape }
  const PHOTO_SHAPES = {
    none:   { label: 'As it is', emoji: '🖼️' },
    round:  { label: 'Rounded',  emoji: '▢' },
    circle: { label: 'Circle',   emoji: '⚪' },
    heart:  { label: 'Heart',    emoji: '❤️' }
  };
  const PHOTO_LAYERS = {
    back:  { label: 'Behind the krathong',   emoji: '⬇️' },
    front: { label: 'In front of the krathong', emoji: '⬆️' }
  };
  const PHOTO_SRC_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/;
  const PHOTO_ID_RE = /^[A-Za-z0-9_-]{20,40}\.(jpg|png)$/;
  function cleanPhoto(p) {
    if (!p || typeof p !== 'object') return null;
    const src = typeof p.src === 'string' && p.src.length < 900000 && PHOTO_SRC_RE.test(p.src) ? p.src : '';
    const id = typeof p.id === 'string' && PHOTO_ID_RE.test(p.id) ? p.id : '';
    if (!src && !id) return null;
    const num = (v, d, a, b) => { v = +v; return isFinite(v) ? clamp(Math.round(v * 10) / 10, a, b) : d; };
    return {
      src, id,
      x: num(p.x, 200, -150, 550), y: num(p.y, 130, -150, 450), w: num(p.w, 150, 20, 600), ar: num(p.ar, 1, 0.2, 5),
      layer: p.layer === 'front' ? 'front' : 'back', shape: pick(p.shape, PHOTO_SHAPES, 'none')
    };
  }
  const squarePhoto = p => p.shape === 'circle' || p.shape === 'heart';
  const photoH = p => squarePhoto(p) ? p.w : p.w * p.ar;

  function normalize(o) {
    o = o && typeof o === 'object' ? o : {};
    const d = DEFAULTS, inc = parseInt(o.incense, 10);
    const flowers = Array.isArray(o.flowers) ? o.flowers.filter(f => has(FLOWERS, f)) : d.flowers;
    return {
      mode: pick(o.mode, MODES, d.mode),
      name: clean(o.name, MAX_NAME).trim(),
      from: clean(o.from, MAX_NAME).trim(),
      msg: clean(o.msg, MAX_MSG),
      base: pick(o.base, BASES, d.base),
      leaf: pick(o.leaf, LEAVES, d.leaf),
      leafc: pick(o.leafc, LEAF_COLORS, d.leafc),
      flowers: [...new Set(flowers)],
      center: pick(o.center, CENTERS, d.center),
      candle: pick(o.candle, CANDLES, d.candle),
      incense: inc >= 0 && inc <= 3 ? inc : d.incense,
      strokes: cleanStrokes(o.strokes),
      drawId: typeof o.drawId === 'string' && /^[A-Za-z0-9_-]{20,40}\.png$/.test(o.drawId) ? o.drawId : '',
      flames: cleanFlames(o.flames),
      photo: cleanPhoto(o.photo)
    };
  }
  const defaults = () => normalize(DEFAULTS);

  // ---------- drawing codec: steps <-> a short base64url text ----------
  // Version 2. Each step: type (2 bits: 0 brush, 1 eraser, 2 bucket), then
  //   brush:  color (24), size (6), point count (13), x (10) y (10) per point
  //   eraser: size (6), point count (13), points
  //   bucket: color (24), x (10), y (10)
  // Version 1 (older links): palette index (5), size index (2), count (13), points.
  function encodeStrokes(strokes) {
    const bytes = [];
    let acc = 0, bits = 0;
    const put = (v, n) => {
      for (let k = n - 1; k >= 0; k--) {
        acc = (acc << 1) | (Math.floor(v / Math.pow(2, k)) & 1); bits++;
        if (bits === 8) { bytes.push(acc); acc = 0; bits = 0; }
      }
    };
    put(2, 4);
    for (const s of strokes) {
      if (s.t === 'f') { put(2, 2); put(parseInt(s.c.slice(1), 16), 24); put(s.p[0], 10); put(s.p[1], 10); continue; }
      const n = Math.min(8191, s.p.length / 2);
      put(s.t === 'e' ? 1 : 0, 2);
      if (s.t === 's') put(parseInt(s.c.slice(1), 16), 24);
      put(s.w - MIN_W, 6); put(n, 13);
      for (let k = 0; k < n; k++) { put(s.p[2 * k], 10); put(s.p[2 * k + 1], 10); }
    }
    if (bits) put(0, 8 - bits);
    let bin = '';
    for (let k = 0; k < bytes.length; k += 4096) bin += String.fromCharCode.apply(null, bytes.slice(k, k + 4096));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeStrokes(text) {
    try {
      const b = text.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b + '='.repeat((4 - b.length % 4) % 4));
      let pos = 0;
      const total = bin.length * 8;
      const get = n => {
        let v = 0;
        for (let k = 0; k < n; k++) { const byte = bin.charCodeAt(pos >> 3); v = v * 2 + ((byte >> (7 - (pos & 7))) & 1); pos++; }
        return v;
      };
      const hex = v => '#' + v.toString(16).padStart(6, '0');
      const ver = get(4), out = [];
      if (ver === 1) {
        while (total - pos >= 20) {
          const i = get(5), w = get(2), n = get(13);
          if (!n || total - pos < n * 20) break;
          const p = [];
          for (let k = 0; k < n; k++) p.push(get(10), get(10));
          out.push({ i, w, p });
        }
      } else if (ver === 2) {
        while (total - pos >= 8) {
          const t = get(2);
          if (t === 2) {
            if (total - pos < 44) break;
            out.push({ t: 'f', c: hex(get(24)), w: 10, p: [get(10), get(10)] });
          } else if (t <= 1) {
            if (total - pos < (t ? 19 : 43)) break;
            const c = t ? '#000000' : hex(get(24)), w = get(6) + MIN_W, n = get(13);
            if (!n || total - pos < n * 20) break;
            const p = [];
            for (let k = 0; k < n; k++) p.push(get(10), get(10));
            out.push({ t: t ? 'e' : 's', c, w, p });
          } else break;
        }
      }
      return cleanStrokes(out);
    } catch (e) { return []; }
  }

  // Keep strokes small: drop points that sit on a nearly straight line (Ramer–Douglas–Peucker).
  function simplify(p, eps) {
    const n = p.length / 2;
    if (n <= 2) return p.slice();
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * b], by = p[2 * b + 1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      let best = -1, far = 0;
      for (let k = a + 1; k < b; k++) {
        // a closed loop starts and ends at the same spot: measure from that spot instead of a line
        const d = len < 1 ? Math.hypot(p[2 * k] - ax, p[2 * k + 1] - ay)
          : Math.abs(dy * p[2 * k] - dx * p[2 * k + 1] + bx * ay - by * ax) / len;
        if (d > far) { far = d; best = k; }
      }
      if (far > eps && best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    const out = [];
    for (let k = 0; k < n; k++) if (keep[k]) out.push(p[2 * k], p[2 * k + 1]);
    return out;
  }

  // Paint one brush or eraser stroke onto a 2D context (in pad pixels).
  function paintStroke(g, s) {
    if (s.t === 'f') return;
    const p = s.p;
    g.save();
    g.globalCompositeOperation = s.t === 'e' ? 'destination-out' : 'source-over';
    g.strokeStyle = g.fillStyle = s.t === 'e' ? '#000' : s.c;
    g.lineWidth = s.w; g.lineCap = 'round'; g.lineJoin = 'round';
    if (p.length <= 2) {
      g.beginPath(); g.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.moveTo(p[0], p[1]);
      for (let k = 2; k < p.length - 2; k += 2) {
        const mx = (p[k] + p[k + 2]) / 2, my = (p[k + 1] + p[k + 3]) / 2;
        g.quadraticCurveTo(p[k], p[k + 1], mx, my);
      }
      g.lineTo(p[p.length - 2], p[p.length - 1]);
      g.stroke();
    }
    g.restore();
  }

  // Paint bucket on a PAD_W×PAD_H context: fills the area of similar color around (x, y).
  // The edge is grown by 2px and painted *under* soft line edges, so no pale halo is left.
  // With skipPaper, a fill that reaches the edge of the paper (a background fill) is left out: returns -1.
  function floodFill(g, x, y, color, skipPaper) {
    const W = PAD_W, H = PAD_H, img = g.getImageData(0, 0, W, H), d = img.data;
    const n = parseInt(color.slice(1), 16), fr = n >> 16, fg = (n >> 8) & 255, fb = n & 255;
    const i0 = (y * W + x) * 4, sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2], sa = d[i0 + 3];
    if (sa > 250 && Math.abs(sr - fr) + Math.abs(sg - fg) + Math.abs(sb - fb) < 6) return 0;   // already that color
    const TOL = 70;
    const same = i => {
      const a = d[i + 3];
      if (sa < 20) return a < 90;                      // empty paper: spread over empty and very faint pixels
      return Math.abs(a - sa) + (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb)) * Math.min(1, a / 255) < TOL;
    };
    const mask = new Uint8Array(W * H), stack = [x, y];
    let count = 0, edge = false;
    while (stack.length) {
      const py = stack.pop(), px0 = stack.pop();
      let px = px0;
      while (px > 0 && !mask[py * W + px - 1] && same((py * W + px - 1) * 4)) px--;
      let up = false, down = false;
      for (; px < W && !mask[py * W + px] && same((py * W + px) * 4); px++) {
        mask[py * W + px] = 1; count++;
        if (px === 0 || px === W - 1 || py === 0 || py === H - 1) edge = true;
        if (py > 0) { const m = !mask[(py - 1) * W + px] && same(((py - 1) * W + px) * 4); if (m && !up) stack.push(px, py - 1); up = m; }
        if (py < H - 1) { const m = !mask[(py + 1) * W + px] && same(((py + 1) * W + px) * 4); if (m && !down) stack.push(px, py + 1); down = m; }
      }
    }
    if (skipPaper && edge) return -1;
    // grow the filled area by 2px
    let ring = mask;
    for (let step = 0; step < 2; step++) {
      const next = ring.slice();
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const k = py * W + px;
        if (ring[k]) continue;
        if ((px > 0 && ring[k - 1]) || (px < W - 1 && ring[k + 1]) || (py > 0 && ring[k - W]) || (py < H - 1 && ring[k + W])) next[k] = 2;
      }
      ring = next;
    }
    for (let k = 0; k < W * H; k++) {
      const i = k * 4;
      if (mask[k] === 1) { d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255; }
      else if (ring[k] === 2) {                         // paint underneath what's already there
        const a = d[i + 3] / 255;
        d[i] = Math.round(d[i] * a + fr * (1 - a)); d[i + 1] = Math.round(d[i + 1] * a + fg * (1 - a)); d[i + 2] = Math.round(d[i + 2] * a + fb * (1 - a)); d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return count;
  }

  // Paint a whole drawing. Works on any context, even a scaled one: bucket fills need real pixels,
  // so drawings with fills are painted on a full-size sheet first.
  // transparent: leave out the paper. Bucket fills that reach the paper's edge are background, so
  // they show while drawing but not on the river.
  let sheet = null;
  function paintStrokes(g, strokes, transparent) {
    g.clearRect(0, 0, PAD_W, PAD_H);
    const direct = !strokes.some(s => s.t === 'f') && g.getTransform && g.getTransform().isIdentity;
    if (direct) { for (const s of strokes) paintStroke(g, s); return; }
    if (!sheet) { sheet = document.createElement('canvas'); sheet.width = PAD_W; sheet.height = PAD_H; }
    const sg = sheet.getContext('2d', { willReadFrequently: true });
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, PAD_W, PAD_H);
    for (const s of strokes) { if (s.t === 'f') floodFill(sg, s.p[0], s.p[1], s.c, transparent); else paintStroke(sg, s); }
    g.drawImage(sheet, 0, 0, PAD_W, PAD_H);
  }
  // Where the drawing is (in view coordinates), to place a flame if the maker didn't.
  function strokesBox(strokes) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of strokes) {
      if (s.t !== 's') continue;
      const r = s.w / 2;
      for (let k = 0; k < s.p.length; k += 2) {
        x0 = Math.min(x0, s.p[k] - r); x1 = Math.max(x1, s.p[k] + r);
        y0 = Math.min(y0, s.p[k + 1] - r); y1 = Math.max(y1, s.p[k + 1] + r);
      }
    }
    if (x0 > x1) return null;
    const k = VIEW_W / PAD_W;
    return { x0: x0 * k, y0: y0 * k, x1: x1 * k, y1: y1 * k };
  }
  function flamesFor(c) {
    if (c.mode === 'create') return null;      // the SVG says where its candle is
    if (c.flames.length) return c.flames;
    const box = strokesBox(c.strokes);
    if (box) return [[Math.round((box.x0 + box.x1) / 2), Math.max(30, Math.round(box.y0 - 4))]];
    return c.drawId ? [[200, 190]] : [];          // blank paper: no flame yet
  }

  // ---------- cloud: hand drawings too big for the link go to Supabase Storage ----------
  const CLOUD = {
    url: 'https://dcluindkvsbualyexaoh.supabase.co',
    key: 'sb_publishable_x6wP17obaB3WaduaB4gDhA_HzFpE1dY',   // public key: can only add new files
    bucket: 'krathong-drawings'
  };
  const drawUrl = id => `${CLOUD.url}/storage/v1/object/public/${CLOUD.bucket}/${id}`;
  async function uploadFile(bucket, blob, ext, type) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_') + '.' + ext;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 25000);
    try {
      const res = await fetch(`${CLOUD.url}/storage/v1/object/${bucket}/${id}`, {
        method: 'POST',
        headers: { apikey: CLOUD.key, Authorization: 'Bearer ' + CLOUD.key, 'Content-Type': type, 'x-upsert': 'false', 'cache-control': '31536000' },
        body: blob, signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) throw new Error('upload failed: ' + res.status);
      return id;
    } finally { clearTimeout(timer); }
  }
  const uploadDrawing = blob => uploadFile(CLOUD.bucket, blob, 'png', 'image/png');
  const PHOTO_BUCKET = 'krathong-photos';
  const photoUrl = id => `${CLOUD.url}/storage/v1/object/public/${PHOTO_BUCKET}/${id}`;
  const photoSrc = p => p ? (p.src || (p.id ? photoUrl(p.id) : '')) : '';
  async function uploadPhoto(p) {
    const blob = await (await fetch(p.src)).blob();
    const png = p.src.startsWith('data:image/png');
    return uploadFile(PHOTO_BUCKET, blob, png ? 'png' : 'jpg', png ? 'image/png' : 'image/jpeg');
  }

  // ---------- links ----------
  // ?m=create&name=Mia&base=banana...      a created krathong
  // ?m=draw&name=Mia&fx=200.150#d=...       a drawing carried in the link
  // ?m=draw&did=xxxx.png&fx=...             a drawing stored in the cloud
  const LINK_KEYS = ['m', 'name', 'from', 'msg', 'base', 'leaf', 'leafc', 'fl', 'center', 'candle', 'inc', 'did', 'fx'];
  const hashDrawing = hash => { const m = /(?:^#|&)d=([A-Za-z0-9_-]+)/.exec(hash || ''); return m ? m[1] : ''; };
  const hasKrathong = (p, hash) => LINK_KEYS.some(k => p.has(k)) || !!hashDrawing(hash);
  function fromLocation(loc) {
    const p = new URLSearchParams(loc.search), o = {};
    for (const k of ['name', 'from', 'msg', 'base', 'leaf', 'leafc', 'center', 'candle']) if (p.has(k)) o[k] = p.get(k);
    o.mode = p.get('m') || (hashDrawing(loc.hash) || p.has('did') ? 'draw' : 'create');
    if (p.has('fl')) o.flowers = p.get('fl') === 'none' ? [] : p.get('fl').split(',');
    if (p.has('inc')) o.incense = p.get('inc');
    if (p.has('did')) o.drawId = p.get('did');
    if (p.has('fx')) o.flames = p.get('fx').split(',').map(s => s.split('.').map(Number));
    const d = hashDrawing(loc.hash);
    if (d) o.strokes = decodeStrokes(d);
    return normalize(o);
  }
  // Returns { query, hash } for a share link. Drawings: give drawId to leave strokes out.
  function toLink(c) {
    const p = new URLSearchParams();
    p.set('m', c.mode);
    if (c.name) p.set('name', c.name);
    if (c.from) p.set('from', c.from);
    if (c.msg.trim()) p.set('msg', c.msg.trim());
    let hash = '';
    if (c.mode === 'create') {
      p.set('base', c.base); p.set('leaf', c.leaf); p.set('leafc', c.leafc);
      p.set('fl', c.flowers.length ? c.flowers.join(',') : 'none');
      p.set('center', c.center); p.set('candle', c.candle); p.set('inc', c.incense);
    } else {
      if (c.flames.length) p.set('fx', c.flames.map(f => f.join('.')).join(','));
      if (c.drawId) p.set('did', c.drawId);
      else hash = '#d=' + encodeStrokes(c.strokes);
    }
    return { query: p.toString().replace(/%2C/g, ','), hash };
  }

  // ---------- SVG for a created krathong (view 400×300) ----------
  const CX = 200, CY = 180, RX = 130, RY = 48, H = 24;   // the base: an ellipse with a side band
  const rim = (t, k = 1) => [CX + RX * k * Math.cos(t), CY + RY * k * Math.sin(t)];
  const f1 = v => Math.round(v * 10) / 10;
  const pt = q => f1(q[0]) + ',' + f1(q[1]);

  function baseSVG(c) {
    const L = CX - RX, R = CX + RX, top = `M${L},${CY} A${RX},${RY} 0 0 0 ${R},${CY}`;
    const band = `${top} L${R},${CY + H} A${RX},${RY} 0 0 1 ${L},${CY + H} Z`;
    const topEl = (fill, stroke) => `<ellipse cx="${CX}" cy="${CY}" rx="${RX}" ry="${RY}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    let s = '';
    if (c.base === 'banana') {
      s += `<path d="${band}" fill="#dfe9bd" stroke="#7fa24c" stroke-width="2"/>`;
      for (let k = 1; k < 12; k++) { const x = L + (2 * RX) * k / 12, y = CY + RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RX) ** 2)); s += `<line x1="${f1(x)}" y1="${f1(y + 2)}" x2="${f1(x)}" y2="${f1(y + H - 2)}" stroke="#b6c98a" stroke-width="1.5"/>`; }
      s += topEl('#f1f5d8', '#9dbb62');
      for (const k of [0.78, 0.55, 0.32]) s += `<ellipse cx="${CX}" cy="${CY}" rx="${RX * k}" ry="${RY * k}" fill="none" stroke="#d3e0a8" stroke-width="2"/>`;
    } else if (c.base === 'bread') {
      s += `<path d="${band}" fill="#c27f37" stroke="#8d5420" stroke-width="2"/>`;
      s += topEl('#e7b061', '#a86a2a');
      for (let k = 0; k < 26; k++) { const t = k * 2.4, r = 0.25 + (k % 7) / 9; const q = rim(t, r); s += `<ellipse cx="${f1(q[0])}" cy="${f1(q[1])}" rx="2.4" ry="1.4" fill="#c98b3f" opacity=".7"/>`; }
    } else if (c.base === 'coconut') {
      s += `<path d="M${L},${CY} Q${L + 6},${CY + RY + H + 6} ${CX},${CY + RY + H} Q${R - 6},${CY + RY + H + 6} ${R},${CY} Z" fill="#6e4426" stroke="#43260f" stroke-width="2"/>`;
      for (let k = 0; k < 9; k++) { const x = L + 22 + k * 27; s += `<path d="M${x},${CY + 18} q4,14 -2,30" fill="none" stroke="#8b5a35" stroke-width="2" opacity=".7"/>`; }
      s += topEl('#f7f1e3', '#5a3418');
      s += `<ellipse cx="${CX}" cy="${CY + 3}" rx="${RX - 12}" ry="${RY - 7}" fill="#fffaf0"/>`;
    } else {
      s += `<path d="${band}" fill="#f59cbf" stroke="#c75285" stroke-width="2"/>`;
      for (let k = 0; k < 9; k++) {
        const x0 = L + (2 * RX) * k / 9, x1 = L + (2 * RX) * (k + 1) / 9, xm = (x0 + x1) / 2;
        const yb = CY + H + RY * Math.sqrt(Math.max(0, 1 - ((xm - CX) / RX) ** 2));
        s += `<path d="M${f1(x0)},${f1(yb - 8)} Q${f1(xm)},${f1(yb + 6)} ${f1(x1)},${f1(yb - 8)} Q${f1(xm)},${f1(yb - 34)} ${f1(x0)},${f1(yb - 8)}" fill="#ffc2d9" stroke="#d2669a" stroke-width="1.5"/>`;
      }
      s += topEl('#ffe0ec', '#d06a98');
    }
    return s;
  }

  // One folded leaf / petal standing on the rim at angle t.
  function leafSVG(t, w, lift, out, style, col) {
    const b1 = rim(t - w), b2 = rim(t + w), m = rim(t);
    const tipR = rim(t, out); const tip = [tipR[0], tipR[1] - lift];
    if (style === 'round') {
      const c1 = rim(t - w * 1.25, out * 0.97), c2 = rim(t + w * 1.25, out * 0.97);
      return `<path d="M${pt(b1)} C${pt([c1[0], c1[1] - lift * 0.9])} ${pt([tip[0] - 2, tip[1] - 4])} ${pt(tip)} C${pt([tip[0] + 2, tip[1] - 4])} ${pt([c2[0], c2[1] - lift * 0.9])} ${pt(b2)} Z" fill="${col.a}" stroke="${col.line}" stroke-width="1.5"/>` +
        `<path d="M${pt(m)} Q${pt([(m[0] + tip[0]) / 2, (m[1] + tip[1]) / 2 + 4])} ${pt(tip)}" fill="none" stroke="${col.b}" stroke-width="1.5"/>`;
    }
    // folded banana-leaf point: a light half and a shaded half
    return `<path d="M${pt(b1)} L${pt(tip)} L${pt(m)} Z" fill="${col.a}"/>` +
      `<path d="M${pt(m)} L${pt(tip)} L${pt(b2)} Z" fill="${col.b}"/>` +
      `<path d="M${pt(b1)} L${pt(tip)} L${pt(b2)}" fill="none" stroke="${col.line}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  function leafRing(c) {
    const col = LEAF_COLORS[c.leafc], items = [];
    const ring = (n, w, lift, out, shift, style) => {
      for (let k = 0; k < n; k++) {
        const t = (k + shift) / n * Math.PI * 2 - Math.PI / 2;
        items.push({ y: Math.sin(t), svg: leafSVG(t, w, lift, out, style, col) });
      }
    };
    if (c.leaf === 'layered') {
      ring(14, 0.26, 44, 1.3, 0, 'pointed');
      ring(14, 0.22, 26, 1.12, 0.5, 'pointed');
    } else if (c.leaf === 'round') {
      ring(12, 0.27, 34, 1.24, 0, 'round');
    } else {
      ring(16, 0.21, 36, 1.22, 0, 'pointed');
    }
    return items;
  }

  // Flowers drawn around (0,0), about 16 across.
  function flowerSVG(kind) {
    let s = '';
    if (kind === 'marigold') {
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; s += `<circle cx="${f1(Math.cos(a) * 9)}" cy="${f1(Math.sin(a) * 7)}" r="6" fill="#ef8d15"/>`; }
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + .3; s += `<circle cx="${f1(Math.cos(a) * 5)}" cy="${f1(Math.sin(a) * 4 - 2)}" r="5" fill="#ffb02e"/>`; }
      s += '<circle cx="0" cy="-3" r="4" fill="#ffd36a"/>';
    } else if (kind === 'rose') {
      s += '<ellipse cx="0" cy="0" rx="13" ry="11" fill="#d22f48"/><ellipse cx="0" cy="-2" rx="9" ry="7.5" fill="#e8475f"/>' +
        '<path d="M-8,-1 Q-6,-9 2,-7 Q8,-5 6,1 Q3,6 -2,3 Q-5,0 -1,-3 Q3,-4 2,0" fill="none" stroke="#9e1830" stroke-width="1.6" stroke-linecap="round"/>';
    } else if (kind === 'orchid') {
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - 1.57; s += `<ellipse cx="${f1(Math.cos(a) * 8)}" cy="${f1(Math.sin(a) * 6.5)}" rx="7" ry="5" transform="rotate(${f1(a * 57.3)} ${f1(Math.cos(a) * 8)} ${f1(Math.sin(a) * 6.5)})" fill="#b45fd8" stroke="#7d2fa3" stroke-width="1"/>`; }
      s += '<ellipse cx="0" cy="3" rx="5" ry="4" fill="#6f1f92"/><circle cx="0" cy="-1" r="3" fill="#ffe7ff"/>';
    } else {
      for (const [dx, dy] of [[-6, 2], [6, 2], [0, -5]]) {
        for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - 1.57; s += `<ellipse cx="${f1(dx + Math.cos(a) * 3.6)}" cy="${f1(dy + Math.sin(a) * 3)}" rx="3.4" ry="2.4" fill="#fffdf7" stroke="#cfd6c8" stroke-width=".8"/>`; }
        s += `<circle cx="${dx}" cy="${dy}" r="1.6" fill="#f2d66b"/>`;
      }
    }
    return s;
  }
  function centerSVG(kind) {
    const x = CX, y = CY + 2;
    if (kind === 'lotus') {
      return `<path d="M${x - 34},${y} Q${x - 46},${y - 26} ${x - 22},${y - 40} Q${x - 14},${y - 16} ${x - 4},${y}" fill="#f7a6c6" stroke="#c9508a" stroke-width="1.5"/>` +
        `<path d="M${x + 34},${y} Q${x + 46},${y - 26} ${x + 22},${y - 40} Q${x + 14},${y - 16} ${x + 4},${y}" fill="#f7a6c6" stroke="#c9508a" stroke-width="1.5"/>` +
        `<path d="M${x},${y + 2} C${x - 30},${y - 8} ${x - 22},${y - 58} ${x},${y - 86} C${x + 22},${y - 58} ${x + 30},${y - 8} ${x},${y + 2} Z" fill="#ffb9d3" stroke="#c9508a" stroke-width="2"/>` +
        `<path d="M${x},${y + 1} C${x - 12},${y - 20} ${x - 8},${y - 56} ${x},${y - 84}" fill="none" stroke="#e57aa6" stroke-width="2"/>` +
        `<path d="M${x},${y + 1} C${x + 14},${y - 18} ${x + 10},${y - 50} ${x + 2},${y - 80}" fill="#ff9fc3" opacity=".55"/>`;
    }
    if (kind === 'cone') {
      let s = `<path d="M${x - 30},${y} L${x},${y - 96} L${x + 30},${y} Q${x},${y + 10} ${x - 30},${y} Z" fill="#4f9a44" stroke="#245e28" stroke-width="2"/>`;
      for (let r = 0; r < 6; r++) {
        const yy = y - 10 - r * 14, half = 26 * (1 - (r * 14 + 10) / 96), n = Math.max(1, 4 - Math.floor(r / 2));
        for (let k = 0; k < n; k++) { const xx = x - half + (2 * half) * (k + 0.5) / n; s += `<circle cx="${f1(xx)}" cy="${yy}" r="3.6" fill="#fffdf4" stroke="#c9d2bd" stroke-width=".8"/>`; }
      }
      return s + `<g transform="translate(${x} ${y - 98}) scale(.7)">${flowerSVG('rose')}</g>`;
    }
    if (kind === 'bouquet') {
      return `<g transform="translate(${x - 20} ${y - 12}) scale(1.35)">${flowerSVG('marigold')}</g>` +
        `<g transform="translate(${x + 20} ${y - 12}) scale(1.35)">${flowerSVG('marigold')}</g>` +
        `<g transform="translate(${x} ${y - 34}) scale(1.6)">${flowerSVG('marigold')}</g>`;
    }
    return '';
  }
  const CANDLE_AT = [CX + 40, CY + 16], CANDLE_H = 46;
  function candleSVG(c) {
    const [x, y] = CANDLE_AT, col = CANDLES[c.candle].c;
    return `<rect x="${x - 6}" y="${y - CANDLE_H}" width="12" height="${CANDLE_H}" rx="3" fill="${col}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>` +
      `<rect x="${x - 4}" y="${y - CANDLE_H + 2}" width="3" height="${CANDLE_H - 6}" rx="1.5" fill="#fff" opacity=".45"/>` +
      `<ellipse cx="${x}" cy="${y - CANDLE_H}" rx="6" ry="2" fill="#fff" opacity=".5"/>` +
      `<line x1="${x}" y1="${y - CANDLE_H}" x2="${x}" y2="${y - CANDLE_H - 6}" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/>`;
  }
  function incenseSVG(c) {
    let s = '';
    for (let k = 0; k < c.incense; k++) {
      const bx = CX - 46 + k * 7, by = CY + 16, tx = bx - 10 + k * 7, ty = by - 74 + Math.abs(k - 1) * 4;
      s += `<line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="#8a4b2a" stroke-width="3" stroke-linecap="round"/>` +
        `<line x1="${f1(bx + (tx - bx) * .55)}" y1="${f1(by + (ty - by) * .55)}" x2="${tx}" y2="${ty}" stroke="#b5692f" stroke-width="3.4" stroke-linecap="round"/>` +
        `<circle class="inc-tip" cx="${tx}" cy="${ty}" r="2.6"/>` +
        `<path class="inc-smoke" d="M${tx},${ty - 3} q-6,-10 0,-20 q6,-10 0,-22" style="animation-delay:${k * .5}s"/>`;
    }
    return s;
  }

  // Draws a created krathong into an <svg viewBox="0 0 400 300">. Returns where the flame goes.
  function render(svg, c) {
    const leaves = leafRing(c);
    const back = leaves.filter(l => l.y < 0).sort((a, b) => a.y - b.y);
    const front = leaves.filter(l => l.y >= 0).sort((a, b) => a.y - b.y);
    const flowers = [];
    if (c.flowers.length) {
      const n = c.center === 'none' ? 9 : 8;
      for (let k = 0; k < n; k++) {
        const t = k / n * Math.PI * 2 + 0.2, q = rim(t, c.center === 'none' && k === n - 1 ? 0 : 0.7);
        const sc = 0.95 + 0.3 * (Math.sin(t) + 1) / 2;
        flowers.push({ y: q[1], svg: `<g transform="translate(${f1(q[0])} ${f1(q[1] - 4)}) scale(${f1(sc * 10) / 10})">${flowerSVG(c.flowers[k % c.flowers.length])}</g>` });
      }
    }
    const behind = flowers.filter(f => f.y < CY).sort((a, b) => a.y - b.y);
    const before = flowers.filter(f => f.y >= CY).sort((a, b) => a.y - b.y);
    svg.innerHTML = baseSVG(c) + back.map(l => l.svg).join('') + behind.map(f => f.svg).join('') +
      centerSVG(c.center) + incenseSVG(c) + candleSVG(c) + before.map(f => f.svg).join('') + front.map(l => l.svg).join('');
    return [[CANDLE_AT[0], CANDLE_AT[1] - CANDLE_H - 6]];
  }

  // ---------- the shared river: every released krathong is a row in Supabase ----------
  const LOOK_KEYS = ['base', 'leaf', 'leafc', 'flowers', 'center', 'candle', 'incense'];
  const MAX_CODE = 40000;                    // longer drawings are stored as a PNG instead
  async function api(path, opts = {}) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 15000);
    try {
      const res = await fetch(`${CLOUD.url}/rest/v1/${path}`, Object.assign({}, opts, {
        headers: Object.assign({ apikey: CLOUD.key, Authorization: 'Bearer ' + CLOUD.key }, opts.headers || {}),
        signal: ctrl ? ctrl.signal : undefined
      }));
      if (!res.ok) throw new Error('river: ' + res.status);
      return res;
    } finally { clearTimeout(timer); }
  }
  function fromRow(r) {
    const o = Object.assign({}, r.look || {}, { mode: r.mode, name: r.name, msg: r.msg, flames: r.flames, drawId: r.draw_id || '', photo: r.photo || null });
    if (r.strokes) o.strokes = decodeStrokes(r.strokes);
    return normalize(o);
  }
  const ROW_FIELDS = 'id,created_at,name,msg,mode,look,strokes,draw_id,flames,photo';
  // Newest krathongs (optionally only those after a given time), oldest first.
  async function fetchRiver(since, limit = 60) {
    const q = `krathongs?select=${ROW_FIELDS}&order=created_at.desc&limit=${limit}` + (since ? `&created_at=gt.${encodeURIComponent(since)}` : '');
    const rows = await (await api(q)).json();
    return rows.reverse();
  }
  async function countSince(iso) {
    const res = await api(`krathongs?select=id&created_at=gte.${encodeURIComponent(iso)}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    const m = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
    return m ? +m[1] : null;
  }
  // Puts a krathong on the shared river. Resolves to the stored row.
  async function release(c) {
    const row = { name: c.name, msg: c.msg.trim(), mode: c.mode, look: {}, flames: c.flames };
    if (c.mode === 'create') LOOK_KEYS.forEach(k => { row.look[k] = c[k]; });
    else {
      const code = encodeStrokes(c.strokes);
      if (code.length <= MAX_CODE) row.strokes = code;
      else {
        const cv = document.createElement('canvas');
        cv.width = 560; cv.height = 420;
        const g = cv.getContext('2d'); g.scale(560 / PAD_W, 420 / PAD_H);
        paintStrokes(g, c.strokes, true);
        const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
        row.draw_id = await uploadDrawing(blob);
      }
    }
    if (c.photo) {
      const p = c.photo, id = p.id || await uploadPhoto(p);
      row.photo = { id, x: p.x, y: p.y, w: p.w, ar: p.ar, layer: p.layer, shape: p.shape };
    }
    const res = await api('krathongs', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
    return (await res.json())[0];
  }

  function loadImg(src, cors) {
    return new Promise(res => {
      if (!src) return res(null);
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = src;
    });
  }
  function photoPath(g, shape, x, y, w, h) {
    g.beginPath();
    if (shape === 'circle') g.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
    else if (shape === 'heart') {
      g.moveTo(x + w / 2, y + h * 0.92);
      g.bezierCurveTo(x - w * 0.15, y + h * 0.5, x + w * 0.1, y - h * 0.08, x + w / 2, y + h * 0.26);
      g.bezierCurveTo(x + w * 0.9, y - h * 0.08, x + w * 1.15, y + h * 0.5, x + w / 2, y + h * 0.92);
    } else if (shape === 'round') {
      const r = Math.min(w, h) * 0.12;
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    } else g.rect(x, y, w, h);
    g.closePath();
  }
  // Draw the photo on a canvas whose size is k × the 400×300 view.
  function drawPhoto(g, img, p, k) {
    if (!img || !p) return;
    const w = p.w * k, h = photoH(p) * k, x = p.x * k - w / 2, y = p.y * k - h / 2;
    let sx = 0, sy = 0, sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    if (squarePhoto(p)) { const side = Math.min(sw, sh); sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side; }
    g.save(); photoPath(g, p.shape, x, y, w, h); g.clip();
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    g.restore();
  }

  // A small picture of any krathong (for drawing many of them on the river).
  const SPRITE_W = 240, SPRITE_H = 180;
  async function makeSprite(c) {
    const cv = document.createElement('canvas');
    cv.width = SPRITE_W; cv.height = SPRITE_H;
    const g = cv.getContext('2d'), k = SPRITE_W / VIEW_W;
    const photo = c.photo ? await loadImg(photoSrc(c.photo), !c.photo.src) : null;
    if (c.photo && c.photo.layer === 'back') drawPhoto(g, photo, c.photo, k);
    let flames;
    if (c.mode === 'create') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      flames = render(svg, c);
      const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${SPRITE_W}" height="${SPRITE_H}">` +
        `<style>.inc-tip{fill:#ff6a2a}.inc-smoke{display:none}</style>${svg.innerHTML}</svg>`;
      const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src));
      if (img) g.drawImage(img, 0, 0, SPRITE_W, SPRITE_H);
    } else {
      flames = flamesFor(c);
      if (c.strokes.length) {
        g.save(); g.scale(SPRITE_W / PAD_W, SPRITE_H / PAD_H); paintStrokes(g, c.strokes, true); g.restore();
      } else if (c.drawId) {
        const img = await loadImg(drawUrl(c.drawId), true);
        if (img) g.drawImage(img, 0, 0, SPRITE_W, SPRITE_H);
      }
    }
    if (c.photo && c.photo.layer === 'front') drawPhoto(g, photo, c.photo, k);
    return { canvas: cv, flames };
  }

  window.Krathong = {
    fromRow, fetchRiver, countSince, release, makeSprite, SPRITE_W, SPRITE_H,
    PHOTO_SHAPES, PHOTO_LAYERS, photoSrc, photoH, squarePhoto,
    BASES, LEAVES, LEAF_COLORS, FLOWERS, CENTERS, CANDLES, INKS, MIN_W, MAX_W, floodFill,
    PAD_W, PAD_H, VIEW_W, VIEW_H, WL, MAX_NAME, MAX_MSG, MAX_FLAMES,
    defaults, normalize, render, flamesFor, strokesBox,
    encodeStrokes, decodeStrokes, simplify, paintStroke, paintStrokes,
    hasKrathong, fromLocation, toLink, uploadDrawing, drawUrl
  };
})();
