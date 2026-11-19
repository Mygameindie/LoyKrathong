// The maker's side: choose what to do, draw or create the krathong, send the link.
(() => {
  'use strict';
  const K = window.Krathong, App = window.App;
  const $ = id => document.getElementById(id);
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- the maker's draft (kept on this device only) ----------
  const DRAFT_KEY = 'krathong-draft-v1';
  function loadDraft() {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (d) return K.normalize(d); } catch (e) {}
    return K.defaults();
  }
  let cfg = loadDraft();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(cfg)); } catch (e) {} }, 300);
  }
  function update() { App.setKrathong(cfg); save(); }

  // ---------- tabs ----------
  const opts = (table, extra) => Object.keys(table).map(v => Object.assign({ v, label: table[v].label, emoji: table[v].emoji }, extra ? extra(table[v]) : null));
  const WORDS = { id: 'words', label: '✍️ Words', groups: [{ special: 'words' }] };
  const TABS = {
    create: [
      { id: 'base', label: '🍌 Base', groups: [{ key: 'base', title: 'What it floats on', options: opts(K.BASES) }] },
      { id: 'leaves', label: '🍃 Leaves', groups: [
        { key: 'leaf', title: 'Folded leaves', options: opts(K.LEAVES) },
        { key: 'leafc', title: 'Leaf color', options: opts(K.LEAF_COLORS, c => ({ sw: `linear-gradient(90deg, ${c.a} 50%, ${c.b} 50%)` })) }
      ] },
      { id: 'flowers', label: '🌸 Flowers', groups: [
        { key: 'flowers', title: 'Pick as many as you like', multi: true, options: opts(K.FLOWERS) },
        { key: 'center', title: 'In the middle', options: opts(K.CENTERS) }
      ] },
      { id: 'candle', label: '🕯️ Candle', groups: [
        { key: 'candle', title: 'Candle color', options: opts(K.CANDLES, c => ({ sw: c.c })) },
        { key: 'incense', title: 'Incense sticks', options: [0, 1, 2, 3].map(n => ({ v: n, label: n ? String(n) : 'None', emoji: n ? '🥢' : '' })) }
      ] },
      WORDS
    ],
    draw: [
      { id: 'pad', label: '🖌️ Draw', groups: [{ special: 'pad' }] },
      WORDS
    ]
  };
  let tab = cfg.mode === 'draw' ? 'pad' : 'base';

  const tabsEl = $('bTabs'), bodyEl = $('bBody');
  function renderSwitch() {
    $('swDraw').setAttribute('aria-selected', cfg.mode === 'draw');
    $('swCreate').setAttribute('aria-selected', cfg.mode === 'create');
  }
  function renderTabs() {
    tabsEl.replaceChildren(...TABS[cfg.mode].map(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id;
      const [em, ...words] = t.label.split(' ');
      b.innerHTML = `<span class="em">${em}</span>${words.join(' ')}`;
      b.setAttribute('aria-selected', t.id === tab);
      return b;
    }));
  }
  tabsEl.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    tab = b.dataset.tab;
    renderTabs(); renderBody(); bodyEl.scrollTop = 0;
  });
  function setMode(m) {
    if (cfg.mode === m) return;
    cfg.mode = m;
    tab = m === 'draw' ? 'pad' : 'base';
    update(); renderSwitch(); renderTabs(); renderBody(); showGuide();
  }
  $('swDraw').addEventListener('click', () => setMode('draw'));
  $('swCreate').addEventListener('click', () => setMode('create'));

  // ---------- drawing tools ----------
  const tool = { kind: 'brush', ink: 4, w: 1, guide: true };
  try { Object.assign(tool, JSON.parse(localStorage.getItem('krathong-tool-v1')) || {}); } catch (e) {}
  const saveTool = () => { try { localStorage.setItem('krathong-tool-v1', JSON.stringify(tool)); } catch (e) {} };
  function showGuide() {
    $('kGuide').classList.toggle('hidden', !(tool.guide && cfg.mode === 'draw' && document.body.classList.contains('mode-build')));
  }

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const isOn = (key, v) => key === 'flowers' ? cfg.flowers.includes(v) : String(cfg[key]) === String(v);
  const chipHTML = (key, o) =>
    `<button type="button" class="chip${o.sw ? ' has-sw' : ''}" data-key="${key}" data-val="${esc(o.v)}" aria-pressed="${isOn(key, o.v)}">` +
    (o.sw ? `<span class="sw" style="background:${o.sw}"></span>` : o.emoji ? `<span class="em">${o.emoji}</span>` : '') + `${esc(o.label)}</button>`;

  function padHTML() {
    const inks = K.INKS.map((c, i) => `<button type="button" class="ink" data-ink="${i}" style="--ink:${c}" aria-label="Color ${i + 1}" aria-pressed="${tool.kind !== 'eraser' && tool.ink === i}"></button>`).join('');
    const sizes = K.WIDTHS.map((w, i) => `<button type="button" class="size" data-size="${i}" aria-label="Size ${i + 1}" aria-pressed="${tool.w === i}"><span style="width:${Math.min(26, 4 + w * 0.6)}px;height:${Math.min(26, 4 + w * 0.6)}px"></span></button>`).join('');
    const t = (k, em, label) => `<button type="button" class="chip" data-tool="${k}" aria-pressed="${tool.kind === k}"><span class="em">${em}</span>${label}</button>`;
    return `<div class="group"><h3>Tool</h3><div class="chips">${t('brush', '🖌️', 'Brush')}${t('eraser', '🧽', 'Eraser')}${t('flame', '🕯️', 'Candle')}</div>` +
      `<p class="note" id="toolNote">${toolNote()}</p></div>` +
      `<div class="group"><h3>Color</h3><div class="inks">${inks}</div></div>` +
      `<div class="group"><h3>Size</h3><div class="sizes">${sizes}</div></div>` +
      `<div class="group"><div class="chips">` +
      `<button type="button" class="chip" data-act="undo"><span class="em">↩️</span>Undo</button>` +
      `<button type="button" class="chip" data-act="clear"><span class="em">🗑️</span>Clear</button>` +
      `<button type="button" class="chip" data-act="guide" aria-pressed="${tool.guide}"><span class="em">📐</span>Guide</button></div>` +
      `<p class="note">Tip: draw leaves, flowers, a base… anything! Keep it above the water line.</p></div>`;
  }
  function toolNote() {
    if (tool.kind === 'flame') return `Tap the drawing where a candle flame should burn (up to ${K.MAX_FLAMES}). Tap a flame again to remove it.`;
    if (tool.kind === 'eraser') return 'Rub out parts of your drawing.';
    return 'Draw on the krathong area above with your finger or mouse.';
  }
  function wordsHTML() {
    return `<div class="group"><h3>From</h3><input class="text-in" id="bFrom" type="text" maxlength="${K.MAX_NAME}" placeholder="your name" value="${esc(cfg.from)}" autocomplete="off" enterkeyhint="done"></div>` +
      `<div class="group"><h3>A message for them</h3><input class="text-in" id="bMsg" type="text" maxlength="${K.MAX_MSG}" placeholder="e.g. Wishing you all the luck 🌕" value="${esc(cfg.msg)}" autocomplete="off" enterkeyhint="done">` +
      `<p class="note"><span id="bMsgCount">${cfg.msg.length}</span>/${K.MAX_MSG} · shown at the river</p>` +
      `<div class="chips">${['Happy Loy Krathong!', 'May all your wishes come true', 'Let the bad luck float away', 'Thinking of you 💛'].map(m => `<button type="button" class="chip" data-msg="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>`;
  }
  function renderBody() {
    const t = TABS[cfg.mode].find(x => x.id === tab) || TABS[cfg.mode][0];
    bodyEl.innerHTML = t.groups.map(g => {
      if (g.special === 'pad') return padHTML();
      if (g.special === 'words') return wordsHTML();
      return `<div class="group"><h3>${g.title}</h3><div class="chips">${g.options.map(o => chipHTML(g.key, o)).join('')}</div></div>`;
    }).join('');
  }

  bodyEl.addEventListener('click', e => {
    const chip = e.target.closest('[data-key]'), sample = e.target.closest('[data-msg]');
    const ink = e.target.closest('[data-ink]'), size = e.target.closest('[data-size]');
    const tl = e.target.closest('[data-tool]'), act = e.target.closest('[data-act]');
    if (chip) {
      const key = chip.dataset.key, v = chip.dataset.val;
      if (key === 'flowers') cfg.flowers = cfg.flowers.includes(v) ? cfg.flowers.filter(x => x !== v) : cfg.flowers.concat(v);
      else cfg[key] = key === 'incense' ? +v : v;
      update(); renderBody();
    } else if (sample) {
      cfg.msg = sample.dataset.msg; $('bMsg').value = cfg.msg; $('bMsgCount').textContent = cfg.msg.length; update();
    } else if (ink) {
      tool.ink = +ink.dataset.ink; if (tool.kind !== 'brush') tool.kind = 'brush'; saveTool(); renderBody();
    } else if (size) {
      tool.w = +size.dataset.size; if (tool.kind === 'flame') tool.kind = 'brush'; saveTool(); renderBody();
    } else if (tl) {
      tool.kind = tl.dataset.tool; saveTool(); renderBody();
    } else if (act) {
      const a = act.dataset.act;
      if (a === 'undo') { if (cfg.strokes.length) { cfg.strokes.pop(); update(); } else toast('Nothing to undo'); }
      else if (a === 'clear') {
        if (!cfg.strokes.length && !cfg.flames.length) return;
        if (confirm('Clear your whole drawing?')) { cfg.strokes = []; cfg.flames = []; update(); }
      } else if (a === 'guide') { tool.guide = !tool.guide; saveTool(); showGuide(); renderBody(); }
    }
  });
  bodyEl.addEventListener('input', e => {
    if (e.target.id === 'bFrom') { cfg.from = e.target.value; App.setKrathong(cfg); save(); }
    else if (e.target.id === 'bMsg') { cfg.msg = e.target.value.slice(0, K.MAX_MSG); $('bMsgCount').textContent = cfg.msg.length; App.setKrathong(cfg); save(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('#builder input')) e.target.blur(); });
  const nameIn = $('bName');
  nameIn.addEventListener('input', () => { cfg.name = nameIn.value; App.setKrathong(cfg); save(); });

  // ---------- drawing on the pad ----------
  const pad = App.pad, g = App.padG;
  let cur = null;
  const drawing = () => document.body.classList.contains('mode-build') && cfg.mode === 'draw';
  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) / r.width * K.PAD_W), Math.round((e.clientY - r.top) / r.height * K.PAD_H)];
  }
  pad.addEventListener('pointerdown', e => {
    if (!drawing() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const [x, y] = padPoint(e);
    if (tool.kind === 'flame') {
      const vx = x * K.VIEW_W / K.PAD_W, vy = y * K.VIEW_H / K.PAD_H;
      const near = cfg.flames.findIndex(f => Math.hypot(f[0] - vx, f[1] - vy) < 18);
      if (near >= 0) cfg.flames.splice(near, 1);
      else if (cfg.flames.length < K.MAX_FLAMES) cfg.flames.push([Math.round(vx), Math.round(vy)]);
      else { toast(`Up to ${K.MAX_FLAMES} flames. Tap one to remove it.`); return; }
      update();
      return;
    }
    cur = { id: e.pointerId, s: { i: tool.kind === 'eraser' ? K.ERASER : tool.ink, w: tool.w, p: [x, y] } };
    try { pad.setPointerCapture(e.pointerId); } catch (err) {}
    K.paintStroke(g, cur.s);
  });
  pad.addEventListener('pointermove', e => {
    if (!cur || e.pointerId !== cur.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const p = cur.s.p;
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = padPoint(ev);
      const lx = p[p.length - 2], ly = p[p.length - 1];
      if (Math.hypot(x - lx, y - ly) < 2) continue;
      p.push(Math.max(0, Math.min(K.PAD_W - 1, x)), Math.max(0, Math.min(K.PAD_H - 1, y)));
      K.paintStroke(g, { i: cur.s.i, w: cur.s.w, p: [lx, ly, x, y] });
    }
  });
  function endStroke() {
    if (!cur) return;
    const s = cur.s; cur = null;
    s.p = K.simplify(s.p, 1.3);
    cfg.strokes.push(s);
    update();
  }
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);
  pad.addEventListener('lostpointercapture', endStroke);

  // ---------- going between screens ----------
  function hideOverlays() { ['roles', 'howBox', 'shareBox', 'start'].forEach(id => $(id).classList.add('hidden')); }
  function enterBuild(mode) {
    hideOverlays();
    if (mode) { cfg.mode = mode; tab = mode === 'draw' ? 'pad' : 'base'; save(); }
    nameIn.value = cfg.name;
    App.setKrathong(cfg);
    App.enterBuild();
    renderSwitch(); renderTabs(); renderBody(); showGuide();
  }
  function floatNow(c, fromBuilder) {
    hideOverlays();
    App.setKrathong(c);
    App.enterFloat({ fromBuilder });
    showGuide();
  }
  function askHow() { hideOverlays(); $('howBox').classList.remove('hidden'); }
  $('roleMaker').addEventListener('click', askHow);
  $('roleFloat').addEventListener('click', () => floatNow(K.normalize({ mode: 'create', center: 'lotus', flowers: ['marigold', 'rose', 'jasmine'] }), false));
  $('howDraw').addEventListener('click', () => enterBuild('draw'));
  $('howCreate').addEventListener('click', () => enterBuild('create'));
  $('howBack').addEventListener('click', () => { hideOverlays(); $('roles').classList.remove('hidden'); });
  $('floatNowBtn').addEventListener('click', () => {
    if (cfg.mode === 'draw' && !cfg.strokes.length) { toast('Draw your krathong first ✏️'); return; }
    floatNow(cfg, true);
  });
  $('editBtn').addEventListener('click', () => enterBuild());
  $('backBtn').addEventListener('click', () => enterBuild());
  $('makeOwnBtn').addEventListener('click', () => { cfg = loadDraft(); askHow(); });

  // ---------- sending ----------
  const LINK_LIMIT = 3000;                   // longer drawings go to the cloud instead of the link
  let uploaded = { key: '', id: '' };
  async function drawingId(code) {
    if (uploaded.key === code) return uploaded.id;
    const cv = document.createElement('canvas');
    cv.width = K.PAD_W; cv.height = K.PAD_H;
    K.paintStrokes(cv.getContext('2d'), cfg.strokes);
    let blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if (!blob || blob.size > 290000) {            // very busy drawing: send it a bit smaller
      const small = document.createElement('canvas');
      small.width = 560; small.height = 420;
      small.getContext('2d').drawImage(cv, 0, 0, 560, 420);
      blob = await new Promise(res => small.toBlob(res, 'image/png'));
    }
    if (!blob) throw new Error('no image');
    const id = await K.uploadDrawing(blob);
    uploaded = { key: code, id };
    return id;
  }
  async function shareUrl() {
    const c = Object.assign({}, App.krathong, { drawId: '' });
    if (c.mode === 'draw') {
      const code = K.encodeStrokes(c.strokes);
      if (code.length > LINK_LIMIT) {
        try { c.drawId = await drawingId(code); }
        catch (e) { console.warn(e); toast('Couldn\'t upload the drawing, so it rides in a longer link.'); }
      }
    }
    const { query, hash } = K.toLink(c);
    return location.href.split(/[?#]/)[0] + '?' + query + hash;
  }
  function shareText() {
    const n = App.krathong.name;
    return n ? `🪷 I made you a krathong, ${n}! Light its candle, make a wish and float it on the river:` : '🪷 I made you a krathong! Light its candle, make a wish and float it on the river:';
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try { const inp = $('shareLink'); inp.focus(); inp.select(); inp.setSelectionRange(0, 99999); return document.execCommand('copy'); } catch (e) { return false; }
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  }
  const canShare = () => !!navigator.share && isTouch;

  const sendBtn = $('sendBtn');
  sendBtn.addEventListener('click', async () => {
    if (sendBtn.disabled) return;
    if (cfg.mode === 'draw' && !cfg.strokes.length) { toast('Draw your krathong first ✏️'); return; }
    const label = sendBtn.textContent;
    sendBtn.disabled = true; sendBtn.textContent = '📤 Getting it ready…';
    let url;
    try { url = await shareUrl(); } finally { sendBtn.disabled = false; sendBtn.textContent = label; }
    const n = App.krathong.name;
    $('shareLink').value = url;
    $('openLink').href = url;
    $('shareWarn').classList.toggle('hidden', /^https:/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname));
    $('nativeShareBtn').classList.toggle('hidden', !canShare());
    $('shareTitle').textContent = n ? `${n}'s krathong is ready! 🎁` : 'Your krathong is ready! 🎁';
    $('shareText').textContent = n ? `Send this link to ${n}:` : 'Send this link:';
    $('shareBox').classList.remove('hidden');
    if (canShare()) return;
    if (await copy(url)) $('shareText').textContent = n ? `Link copied! Paste it in a message to ${n}.` : 'Link copied! Paste it in a message.';
  });
  $('copyBtn').addEventListener('click', async () => { toast(await copy($('shareLink').value) ? '📋 Link copied!' : 'Press and hold the link to copy it'); });
  $('nativeShareBtn').addEventListener('click', async () => {
    try { await navigator.share({ title: 'A krathong for you!', text: shareText(), url: $('shareLink').value }); }
    catch (e) { if (e && e.name !== 'AbortError') toast('Couldn\'t open sharing. Copy the link instead.'); }
  });
  $('shareLink').addEventListener('focus', e => e.target.select());
  $('shareClose').addEventListener('click', () => $('shareBox').classList.add('hidden'));
  addEventListener('keydown', e => { if (e.key === 'Escape') $('shareBox').classList.add('hidden'); });

  // ---------- first screen ----------
  if (K.hasKrathong(new URLSearchParams(location.search), location.hash)) {
    floatNow(K.fromLocation(location), false);          // opened a krathong someone sent
  } else {
    App.setKrathong(cfg);
    $('roles').classList.remove('hidden');
  }
})();
