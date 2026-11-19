// The river: night sky, full moon, water, lanterns, and floating the krathong away.
(() => {
  'use strict';
  const K = window.Krathong;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let cfg = K.fromLocation(location);
  let mode = 'idle';        // 'build' (making it) or 'float' (at the river)
  let step = 'light';       // float steps: 'light' -> 'wish' -> 'away' -> 'gone'

  const wrap = $('kview'), body = $('kBody'), svg = $('kSvg'), svgR = $('kSvgR');
  const pad = $('kPad'), padR = $('kPadR'), flamesEl = $('flames');
  const padG = pad.getContext('2d'), padRG = padR.getContext('2d');
  const titleEl = $('title'), statusEl = $('status');

  function setStatus(t) { if (statusEl.textContent !== t) statusEl.textContent = t; }
  function applyTitle() {
    const t = cfg.name ? `Happy Loy Krathong, ${cfg.name}!` : 'Happy Loy Krathong!';
    if (titleEl.textContent !== t) titleEl.textContent = t;
    document.title = cfg.name ? `A krathong for ${cfg.name}` : 'Loy Krathong';
  }

  // ---------- the krathong itself ----------
  let flames = [];             // { el, lit }
  let cloudImg = null, cloudFor = '';
  function paintPad() {
    if (cfg.mode !== 'draw') return;
    if (cfg.strokes.length || !cfg.drawId) { K.paintStrokes(padG, cfg.strokes); return; }
    padG.clearRect(0, 0, K.PAD_W, K.PAD_H);
    if (cloudImg && cloudFor === cfg.drawId) { padG.drawImage(cloudImg, 0, 0, K.PAD_W, K.PAD_H); return; }
    const img = new Image(), id = cfg.drawId;
    img.crossOrigin = 'anonymous';
    img.onload = () => { cloudImg = img; cloudFor = id; if (cfg.drawId === id) { paintPad(); copyReflection(); } };
    img.onerror = () => setStatus('Couldn\'t load the drawing. Check your connection and reload.');
    img.src = K.drawUrl(id);
  }
  function copyReflection() {
    if (cfg.mode === 'draw') { padRG.clearRect(0, 0, K.PAD_W, K.PAD_H); padRG.drawImage(pad, 0, 0); }
    else svgR.innerHTML = svg.innerHTML;
  }
  function buildFlames(spots) {
    const wasLit = mode === 'build';
    flames = spots.map(([x, y]) => {
      const el = document.createElement('div');
      el.className = 'fl' + (cfg.mode === 'draw' ? ' wax' : '') + (wasLit ? ' lit' : '');
      el.style.left = (x / K.VIEW_W * 100) + '%';
      el.style.top = (y / K.VIEW_H * 100) + '%';
      el.innerHTML = '<div class="flame"><b></b><i></i></div><span class="spark"></span>';
      return { el, lit: wasLit, x, y };
    });
    flamesEl.replaceChildren(...flames.map(f => f.el));
    wrap.classList.toggle('lit', wasLit);
  }
  function render() {
    const draw = cfg.mode === 'draw';
    wrap.classList.toggle('is-draw', draw);
    let spots;
    if (draw) { paintPad(); spots = K.flamesFor(cfg); }
    else spots = K.render(svg, cfg);
    if (mode === 'float') copyReflection();
    buildFlames(spots);
    applyTitle();
  }
  // Only the flames (the drawing pad repaints itself while drawing).
  function refreshFlames() { buildFlames(K.flamesFor(cfg) || K.render(svg, cfg)); }

  // ---------- sound: small chimes made on the fly ----------
  let actx = null;
  function ctx() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
    if (actx.state !== 'running') actx.resume().catch(() => {});
    return actx;
  }
  addEventListener('pointerdown', () => { if (actx && actx.state !== 'running') actx.resume().catch(() => {}); }, { passive: true });
  function chime(freq, when = 0, vol = 0.18, len = 1.8) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + when;
    for (const [mult, v] of [[1, 1], [2.76, 0.18], [5.4, 0.06]]) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len / mult);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + len);
    }
  }
  function splash() {
    const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * 0.6), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.22;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  // a calm phrase on a five-note scale
  function farewell() {
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 783.99, 1046.5];
    notes.forEach((f, k) => chime(f, 0.2 + k * 0.42, 0.14, 2.4));
  }

  // ---------- scene drawing ----------
  const cv = $('river'), g = cv.getContext('2d');
  let vw = innerWidth, vh = innerHeight, dpr = 1;
  let horizon = vh * 0.45, wlY = vh * 0.7, kx = vw / 2, kw = 300, headBottom = 0;
  const stars = [], lights = [], lanterns = [], ripples = [], rockets = [], sparks = [], wishes = [];
  function layout() {
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    const r = wrap.getBoundingClientRect();
    kw = r.width || 300;
    kx = r.left + r.width / 2;
    wlY = r.top + r.height * K.WL / K.VIEW_H;
    headBottom = document.querySelector('.head').getBoundingClientRect().bottom;
    horizon = Math.max(vh * 0.2, Math.min(vh * 0.5, wlY - r.height * 0.75));
    if (!stars.length) for (let k = 0; k < 140; k++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.3, s: 0.5 + Math.random() * 2 });
    if (!lights.length) for (let k = 0; k < 14; k++) lights.push(newLight(Math.random()));
  }
  // distant krathongs already on the water; d = 0 (near horizon) .. 1 (closer)
  function newLight(d, x) { return { x: x == null ? Math.random() : x, d: d * 0.55, v: 0.004 + Math.random() * 0.006, p: Math.random() * 6.3, drift: (Math.random() - 0.5) * 0.004 }; }
  function spawnLantern(x) {
    lanterns.push({ x: x == null ? Math.random() * vw : x, y: horizon - 4, s: 0.6 + Math.random() * 0.7, vy: 10 + Math.random() * 14, p: Math.random() * 6.3, a: 0 });
  }
  function firework() {
    rockets.push({ x: vw * (0.15 + Math.random() * 0.7), y: horizon, ty: vh * (0.08 + Math.random() * 0.22), vy: -vh * 0.75, hue: [42, 330, 190, 280, 20][Math.floor(Math.random() * 5)] });
  }
  addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 80); });

  let lastT = performance.now(), lanternClock = 0, time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; time += dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // sky
    let gr = g.createLinearGradient(0, 0, 0, horizon);
    gr.addColorStop(0, '#050a1f'); gr.addColorStop(0.7, '#111d4a'); gr.addColorStop(1, '#2a2f66');
    g.fillStyle = gr; g.fillRect(0, 0, vw, horizon + 1);
    for (const s of stars) {
      const y = s.y * horizon * 0.95;
      g.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(s.p + time * s.s));
      g.fillStyle = '#fff'; g.fillRect(s.x * vw, y, s.r, s.r);
    }
    g.globalAlpha = 1;

    // full moon
    const mr = Math.max(22, Math.min(vw, vh) * 0.065), mx = vw * 0.78;
    const wide = vw > 820 && vw / vh > 1.25 && mode !== 'build';   // on wide screens the moon fits beside the title
    const my = wide ? Math.max(mr * 2, horizon * 0.36) : Math.min(horizon - mr * 1.8, Math.max(headBottom + mr * 1.6, horizon * 0.36));
    gr = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
    gr.addColorStop(0, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    gr = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    gr.addColorStop(0, '#fffbea'); gr.addColorStop(1, '#f3dfa6');
    g.fillStyle = gr; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(200,170,110,.25)';
    for (const [dx, dy, r] of [[-.3, -.2, .18], [.25, .1, .22], [-.05, .38, .12]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.283); g.fill(); }

    // fireworks
    for (let k = rockets.length - 1; k >= 0; k--) {
      const r = rockets[k];
      r.y += r.vy * dt; r.vy *= 0.985;
      g.fillStyle = `hsla(${r.hue},100%,80%,.9)`; g.fillRect(r.x - 1, r.y, 2, 6);
      if (r.y <= r.ty) {
        rockets.splice(k, 1);
        const n = reduced ? 24 : 60;
        for (let j = 0; j < n; j++) { const a = j / n * 6.283, sp = 60 + Math.random() * 90; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.6 + Math.random() * 0.6, t: 0, hue: r.hue + Math.random() * 30 }); }
      }
    }
    for (let k = sparks.length - 1; k >= 0; k--) {
      const s = sparks[k];
      s.t += dt; if (s.t > s.life) { sparks.splice(k, 1); continue; }
      s.vy += 40 * dt; s.vx *= 0.985; s.vy *= 0.985; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y > horizon) continue;
      g.globalAlpha = 1 - s.t / s.life;
      g.fillStyle = `hsl(${s.hue},100%,72%)`; g.fillRect(s.x - 1.2, s.y - 1.2, 2.4, 2.4);
    }
    g.globalAlpha = 1;

    // sky lanterns
    lanternClock -= dt;
    if (lanternClock <= 0) { spawnLantern(); lanternClock = 2.5 + Math.random() * 4; }
    for (let k = lanterns.length - 1; k >= 0; k--) {
      const L = lanterns[k];
      L.y -= L.vy * dt * L.s; L.p += dt; L.a = Math.min(1, L.a + dt * 0.6);
      const x = L.x + Math.sin(L.p * 0.7) * 8, w = 7 * L.s, h = 9 * L.s;
      if (L.y < -20) { lanterns.splice(k, 1); continue; }
      g.globalAlpha = L.a * Math.min(1, (L.y + 20) / 80);
      gr = g.createRadialGradient(x, L.y, 0, x, L.y, w * 3.2);
      gr.addColorStop(0, 'rgba(255,170,70,.5)'); gr.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gr; g.fillRect(x - w * 3.2, L.y - w * 3.2, w * 6.4, w * 6.4);
      g.fillStyle = '#ffb45a';
      g.beginPath(); g.moveTo(x - w * 0.55, L.y - h / 2); g.lineTo(x + w * 0.55, L.y - h / 2); g.lineTo(x + w * 0.4, L.y + h / 2); g.lineTo(x - w * 0.4, L.y + h / 2); g.fill();
      g.fillStyle = '#fff1c2'; g.fillRect(x - w * 0.22, L.y + h * 0.15, w * 0.44, h * 0.3);
    }
    g.globalAlpha = 1;

    // water
    gr = g.createLinearGradient(0, horizon, 0, vh);
    gr.addColorStop(0, '#24306a'); gr.addColorStop(0.25, '#16204d'); gr.addColorStop(1, '#060b20');
    g.fillStyle = gr; g.fillRect(0, horizon, vw, vh - horizon);
    // far bank with trees and a temple roof
    g.fillStyle = '#070c24';
    g.beginPath(); g.moveTo(0, horizon);
    for (let x = 0; x <= vw; x += 14) g.lineTo(x, horizon - 5 - 5 * Math.abs(Math.sin(x * 0.037)) - 3 * Math.sin(x * 0.11));
    g.lineTo(vw, horizon); g.fill();
    const tx = vw * 0.2, ts = Math.max(18, vw * 0.035);
    g.beginPath(); g.moveTo(tx - ts, horizon - 6); g.lineTo(tx, horizon - 6 - ts * 1.1); g.lineTo(tx + ts, horizon - 6); g.fill();
    g.fillRect(tx - 1.5, horizon - 6 - ts * 1.9, 3, ts);
    // moon path on the water
    gr = g.createLinearGradient(mx - mr * 2, 0, mx + mr * 2, 0);
    gr.addColorStop(0, 'rgba(255,230,170,0)'); gr.addColorStop(0.5, 'rgba(255,230,170,.12)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = gr; g.fillRect(mx - mr * 2, horizon, mr * 4, vh - horizon);
    for (let k = 0; k < 26; k++) {
      const y = horizon + 3 + k * k * (vh - horizon) / 900;
      if (y > vh) break;
      const w = (mr * 0.5 + k * mr * 0.12) * (0.6 + 0.4 * Math.sin(time * 1.7 + k * 1.3));
      g.fillStyle = `rgba(255,236,180,${0.22 - k * 0.007})`;
      g.beginPath(); g.ellipse(mx + Math.sin(time + k) * 4, y, w / 2, 1 + k * 0.1, 0, 0, 6.283); g.fill();
    }
    // ripple lines
    g.strokeStyle = 'rgba(160,190,255,.08)'; g.lineWidth = 1;
    for (let k = 0; k < 9; k++) {
      const y = horizon + (vh - horizon) * (k + 1) / 10 + Math.sin(time * 0.8 + k) * 2;
      g.beginPath();
      for (let x = 0; x <= vw; x += 24) g.lineTo(x, y + Math.sin(x * 0.02 + time * 1.3 + k) * 2);
      g.stroke();
    }
    // distant krathongs: warm dots slowly drifting toward the horizon
    for (const L of lights) {
      L.d -= L.v * dt; L.x += L.drift * dt; L.p += dt * 6;
      if (L.d <= 0) Object.assign(L, newLight(0.45 + Math.random() * 0.55));
      const y = horizon + 4 + L.d * L.d * (wlY - horizon) * 1.4, sz = 1 + L.d * 4.5, x = L.x * vw;
      const fl = 0.75 + 0.25 * Math.sin(L.p) * Math.sin(L.p * 1.7);
      gr = g.createRadialGradient(x, y, 0, x, y, sz * 5);
      gr.addColorStop(0, `rgba(255,190,90,${0.45 * fl})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.fillRect(x - sz * 5, y - sz * 5, sz * 10, sz * 10);
      g.fillStyle = `rgba(255,236,170,${fl})`; g.beginPath(); g.arc(x, y, sz * 0.55, 0, 6.283); g.fill();
      g.fillStyle = `rgba(255,190,90,${0.25 * fl})`; g.fillRect(x - sz * 0.4, y + sz, sz * 0.8, sz * 3);
      g.fillStyle = 'rgba(60,110,60,.7)'; g.fillRect(x - sz * 1.6, y + sz * 0.4, sz * 3.2, sz * 0.7);
    }
    // ripples around our krathong
    for (let k = ripples.length - 1; k >= 0; k--) {
      const r = ripples[k]; r.t += dt;
      if (r.t > 2.4) { ripples.splice(k, 1); continue; }
      g.strokeStyle = `rgba(200,220,255,${0.35 * (1 - r.t / 2.4)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(r.x, r.y, r.w * (0.5 + r.t * 0.5), r.w * 0.12 * (0.5 + r.t * 0.5), 0, 0, 6.283); g.stroke();
    }

    animateKrathong(dt);

    // wishes rising like sparkles
    for (let k = wishes.length - 1; k >= 0; k--) {
      const w = wishes[k]; w.t += dt;
      if (w.t > 6) { wishes.splice(k, 1); continue; }
      g.globalAlpha = Math.min(1, w.t) * Math.max(0, 1 - (w.t - 3) / 3);
      g.fillStyle = '#ffe9b0'; g.font = `800 ${Math.round(16 + 4 * (1 - w.t / 6))}px Nunito, sans-serif`; g.textAlign = 'center';
      g.shadowColor = 'rgba(255,190,90,.9)'; g.shadowBlur = 12;
      g.fillText(w.text, w.x + Math.sin(w.t * 1.2) * 10, w.y - w.t * 26);
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
  }

  // ---------- our krathong on the water ----------
  let away = null;          // { t, dx } while floating away
  function animateKrathong(dt) {
    const still = reduced || (mode === 'build' && cfg.mode === 'draw');   // hold still while drawing
    const bob = still ? 0 : Math.sin(time * 1.4) * 3, tilt = still ? 0 : Math.sin(time * 0.9) * 1.4;
    let x = kx, y = wlY, s = 1, alpha = 1;
    if (mode === 'float' && away) {
      away.t += dt;
      const p = Math.min(1, away.t / 11), e = 1 - Math.pow(1 - p, 2.2);
      const target = horizon + 6;
      y = wlY + (target - wlY) * e;
      s = Math.max(0.04, (y - horizon) / (wlY - horizon));
      x = kx + away.dx * e;
      alpha = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
      if (p >= 1 && step === 'away') finishFloat(x);
    }
    if (mode === 'float' || mode === 'build') {
      body.style.transform = `translate(${(x - kx).toFixed(1)}px, ${(y - wlY + bob * s).toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
      body.style.opacity = alpha.toFixed(2);
    }
    // candle light on the water
    const lit = flames.some(f => f.lit) && alpha > 0.01;
    if (lit && mode !== 'idle') {
      const w = kw * 0.55 * s, fl = 0.85 + 0.15 * Math.sin(time * 9) * Math.sin(time * 5.3);
      const gr = g.createRadialGradient(x, y + 6 * s, 0, x, y + 6 * s, w);
      gr.addColorStop(0, `rgba(255,170,70,${0.38 * fl * alpha})`); gr.addColorStop(1, 'rgba(255,170,70,0)');
      g.save(); g.translate(x, y + 6 * s); g.scale(1, 0.35); g.translate(-x, -(y + 6 * s));
      g.fillStyle = gr; g.fillRect(x - w, y + 6 * s - w, w * 2, w * 2);
      g.restore();
    }
  }

  // ---------- float steps ----------
  const hintEm = $('hintEm'), hintText = $('hintText'), wishIn = $('wishIn');
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function setStep(s) {
    step = s;
    const fromBuilder = setStep.fromBuilder;
    show('lightBtn', s === 'light');
    show('floatBtn', s === 'wish');
    show('wishIn', s === 'wish');
    show('hint', s === 'light' || s === 'wish');
    show('againBtn', s === 'gone');
    show('makeOwnBtn', s === 'gone' && !fromBuilder);
    show('editBtn', s === 'gone' && fromBuilder);
    if (s === 'light') {
      hintEm.textContent = '🕯️'; hintText.textContent = flames.length > 1 ? 'Tap the candles to light them' : 'Tap the candle to light it';
      setStatus('Light the candle, make a wish…');
    } else if (s === 'wish') {
      hintEm.textContent = '🙏'; hintText.textContent = 'Make a wish, then swipe the krathong up (or tap “Let it float”)';
      setStatus('Make a wish… 🌕');
    } else if (s === 'away') {
      setStatus('There it goes… 🌊');
    } else if (s === 'gone') {
      setStatus(cfg.name ? `May your wish come true, ${cfg.name}, and your bad luck float away 🌕` : 'May your wish come true, and your bad luck float away 🌕');
    }
  }
  function lightFlame(f) {
    if (!f || f.lit || mode !== 'float' || step !== 'light') return;
    f.lit = true; f.el.classList.add('lit'); wrap.classList.add('lit');
    chime(660 + flames.indexOf(f) * 110);
    try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
    if (flames.every(x => x.lit)) setTimeout(() => { if (step === 'light') setStep('wish'); }, 450);
  }
  function lightNext() { lightFlame(flames.find(f => !f.lit)); }
  $('lightBtn').addEventListener('click', () => { flames.filter(f => !f.lit).forEach((f, k) => setTimeout(() => lightFlame(f), k * 220)); });

  function floatAway() {
    if (mode !== 'float' || step !== 'wish') return;
    const w = wishIn.value.trim();
    wishIn.blur();
    layout();
    away = { t: 0, dx: (Math.random() - 0.5) * vw * 0.25 };
    ripples.push({ x: kx, y: wlY, w: kw * 0.6, t: 0 }, { x: kx, y: wlY, w: kw * 0.4, t: -0.5 });
    if (w) wishes.push({ text: w.length > 40 ? w.slice(0, 40) + '…' : w, x: kx, y: wlY - kw * 0.5, t: 0 });
    splash(); farewell();
    setStep('away');
  }
  function finishFloat(x) {
    lights.push(newLight(0.03, x / vw));      // ours joins the others near the horizon
    for (let k = 0; k < 6; k++) setTimeout(() => spawnLantern(vw * (0.2 + Math.random() * 0.6)), k * 500);
    for (let k = 0; k < 4; k++) setTimeout(firework, 300 + k * 700);
    setStep('gone');
  }
  $('floatBtn').addEventListener('click', floatAway);
  wishIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); floatAway(); } });

  // tap the krathong to light; swipe it up to float
  let drag = null;
  wrap.addEventListener('pointerdown', e => {
    if (mode !== 'float') return;
    ctx();
    if (step === 'light') {
      const r = body.getBoundingClientRect();
      const vx = (e.clientX - r.left) / r.width * K.VIEW_W, vy = (e.clientY - r.top) / r.height * K.VIEW_H;
      const unlit = flames.filter(f => !f.lit).sort((a, b) => Math.hypot(a.x - vx, a.y - vy) - Math.hypot(b.x - vx, b.y - vy));
      lightFlame(unlit[0]);
      return;
    }
    if (step === 'wish') { drag = { y: e.clientY, id: e.pointerId }; try { wrap.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  wrap.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id && drag.y - e.clientY > 40) { drag = null; floatAway(); } });
  ['pointerup', 'pointercancel'].forEach(t => wrap.addEventListener(t, () => { drag = null; }));

  $('againBtn').addEventListener('click', () => App.enterFloat({ fromBuilder: setStep.fromBuilder, keepOverlay: true }));

  // ---------- stop iOS zoom / bounce ----------
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => {
    if (e.target.type === 'range' || (e.target.closest && e.target.closest('.scroll-ok'))) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', e => { if (e.target.closest('.k-wrap')) e.preventDefault(); });

  // ---------- modes ----------
  function showLetter() {
    const el = $('letter'), parts = [];
    if (cfg.from) parts.push(`💌 From ${cfg.from}`);
    if (cfg.msg.trim()) parts.push(`“${cfg.msg.trim()}”`);
    el.textContent = parts.join(': ');
    el.classList.toggle('hidden', !parts.length || mode !== 'float');
  }

  window.App = {
    get krathong() { return cfg; },
    pad, padG,
    setKrathong(c) { cfg = K.normalize(c); render(); showLetter(); },
    refreshFlames,
    relayout() { requestAnimationFrame(layout); },
    ctx,
    enterBuild() {
      mode = 'build'; away = null;
      document.body.classList.add('mode-build');
      document.body.classList.remove('mode-float');
      $('start').classList.add('hidden');
      render(); showLetter();
      setStatus('Your krathong, live 👀');
      requestAnimationFrame(layout);
    },
    enterFloat(opts) {
      opts = opts || {};
      mode = 'float'; away = null; wishes.length = 0;
      setStep.fromBuilder = !!opts.fromBuilder;
      document.body.classList.remove('mode-build');
      document.body.classList.add('mode-float');
      wishIn.value = '';
      render(); showLetter();
      setStep('light');
      $('backBtn').classList.toggle('hidden', !opts.fromBuilder);
      if (!opts.keepOverlay) {
        $('startTitle').textContent = cfg.name ? `A krathong for ${cfg.name}!` : 'A krathong for you!';
        const from = $('startFrom');
        from.textContent = cfg.from ? `Made with love by ${cfg.from} 💌` : '';
        from.classList.toggle('hidden', !cfg.from);
        $('start').classList.remove('hidden');
      }
      requestAnimationFrame(() => { layout(); ripples.push({ x: kx, y: wlY, w: kw * 0.5, t: 0 }); });
    }
  };
  $('startBtn').addEventListener('click', () => { ctx(); chime(523.25, 0, 0.1); $('start').classList.add('hidden'); });

  layout();
  render();
  requestAnimationFrame(frame);
})();
