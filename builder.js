// The maker's side: choose what to do, draw (in the studio) or create the krathong, release it.
(() => {
  'use strict';
  const K = window.Krathong, App = window.App;
  const $ = id => document.getElementById(id);

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
    draw: [WORDS]        // Draw mode uses the studio (paintUI) instead of tabs
  };
  let tab = 'base';

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
    tab = m === 'draw' ? 'words' : 'base';
    update(); renderSwitch(); renderTabs(); renderBody(); syncPaint();
  }
  $('swDraw').addEventListener('click', () => setMode('draw'));
  $('swCreate').addEventListener('click', () => setMode('create'));

  // ---------- drawing studio state ----------
  const tool = { kind: 'brush', color: '#3d9a45', size: 10, guide: true, recent: [] };
  try {
    const t = JSON.parse(localStorage.getItem('krathong-tool-v2')) || {};
    if (['brush', 'eraser', 'fill', 'flame'].includes(t.kind)) tool.kind = t.kind;
    if (/^#[0-9a-f]{6}$/.test(t.color)) tool.color = t.color;
    if (t.size >= K.MIN_W && t.size <= K.MAX_W) tool.size = Math.round(t.size);
    if (typeof t.guide === 'boolean') tool.guide = t.guide;
    if (Array.isArray(t.recent)) tool.recent = t.recent.filter(c => /^#[0-9a-f]{6}$/.test(c)).slice(0, 8);
  } catch (e) {}
  const saveTool = () => { try { localStorage.setItem('krathong-tool-v2', JSON.stringify(tool)); } catch (e) {} };
  let redo = [];
  const painting = () => document.body.classList.contains('mode-build') && cfg.mode === 'draw';
  function syncPaint() {
    const on = painting();
    document.body.classList.toggle('mode-paint', on);
    $('kGuide').classList.toggle('hidden', !(tool.guide && on));
    if (on) renderStudio();
    else { $('pPop').classList.add('hidden'); $('pSheet').classList.add('hidden'); }
  }
  const showGuide = syncPaint;

  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const isOn = (key, v) => key === 'flowers' ? cfg.flowers.includes(v) : String(cfg[key]) === String(v);
  const chipHTML = (key, o) =>
    `<button type="button" class="chip${o.sw ? ' has-sw' : ''}" data-key="${key}" data-val="${esc(o.v)}" aria-pressed="${isOn(key, o.v)}">` +
    (o.sw ? `<span class="sw" style="background:${o.sw}"></span>` : o.emoji ? `<span class="em">${o.emoji}</span>` : '') + `${esc(o.label)}</button>`;

  function wordsHTML() {
    return `<div class="group"><h3>Message on the river</h3><input class="text-in" id="bMsg" type="text" maxlength="${K.MAX_MSG}" placeholder="e.g. Wishing you all the luck 🌕" value="${esc(cfg.msg)}" autocomplete="off" enterkeyhint="done">` +
      `<p class="note"><span id="bMsgCount">${cfg.msg.length}</span>/${K.MAX_MSG} · everyone on the river can read it. Your wish stays secret.</p>` +
      `<div class="chips">${['Happy Loy Krathong!', 'May all our wishes come true', 'Let the bad luck float away', 'Peace and love 💛'].map(m => `<button type="button" class="chip" data-msg="${esc(m)}">${esc(m)}</button>`).join('')}</div></div>`;
  }
  function renderBody() {
    const t = TABS[cfg.mode].find(x => x.id === tab) || TABS[cfg.mode][0];
    bodyEl.innerHTML = t.groups.map(g => {
      if (g.special === 'words') return wordsHTML();
      return `<div class="group"><h3>${g.title}</h3><div class="chips">${g.options.map(o => chipHTML(g.key, o)).join('')}</div></div>`;
    }).join('');
  }

  bodyEl.addEventListener('click', e => {
    const chip = e.target.closest('[data-key]'), sample = e.target.closest('[data-msg]');
    if (chip) {
      const key = chip.dataset.key, v = chip.dataset.val;
      if (key === 'flowers') cfg.flowers = cfg.flowers.includes(v) ? cfg.flowers.filter(x => x !== v) : cfg.flowers.concat(v);
      else cfg[key] = key === 'incense' ? +v : v;
      update(); renderBody();
    } else if (sample) {
      cfg.msg = sample.dataset.msg; $('bMsg').value = cfg.msg; $('bMsgCount').textContent = cfg.msg.length; update();
    }
  });
  bodyEl.addEventListener('input', e => {
    if (e.target.id === 'bMsg') { cfg.msg = e.target.value.slice(0, K.MAX_MSG); $('bMsgCount').textContent = cfg.msg.length; App.setKrathong(cfg); save(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('#builder input')) e.target.blur(); });
  const nameIn = $('bName');
  nameIn.addEventListener('input', () => { cfg.name = nameIn.value; App.setKrathong(cfg); save(); });

  // ---------- the studio's controls ----------
  const pad = App.pad, g = App.padG;
  const studio = $('paintUI');
  const cursorEl = document.createElement('div');
  cursorEl.className = 'p-cursor';
  studio.appendChild(cursorEl);
  const TIPS = {
    brush: 'Brush: draw with your finger, pen or mouse',
    fill: 'Paint bucket: tap inside a closed shape to fill it',
    eraser: 'Eraser: rub out parts of your drawing',
    flame: `Candle: tap where a flame should burn (up to ${K.MAX_FLAMES}), tap it again to remove`
  };
  let tipTimer = 0;
  function tip(text) {
    const t = $('pTip'); t.textContent = text; t.classList.add('show');
    clearTimeout(tipTimer); tipTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function setTool(k, quiet) {
    tool.kind = k; saveTool(); renderStudio();
    if (!quiet) tip(TIPS[k]);
  }
  function setColor(c, keepTool) {
    tool.color = c;
    tool.recent = [c].concat(tool.recent.filter(x => x !== c)).slice(0, 8);
    if (!keepTool && (tool.kind === 'eraser' || tool.kind === 'flame')) tool.kind = 'brush';
    saveTool(); renderStudio();
  }
  function renderStudio() {
    studio.style.setProperty('--cur', tool.color);
    studio.querySelectorAll('.p-tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool.kind));
    $('pGuide').setAttribute('aria-pressed', tool.guide);
    $('pUndo').disabled = !cfg.strokes.length;
    $('pRedo').disabled = !redo.length;
    const sw = c => `<button type="button" class="p-sw" data-color="${c}" style="--sw:${c}" aria-label="${c}" aria-pressed="${c === tool.color}"></button>`;
    $('pSwatches').innerHTML = K.INKS.map(sw).join('');
    $('pRecent').innerHTML = tool.recent.map(sw).join('');
    $('pPick').value = tool.color;
    renderSize();
  }
  studio.querySelector('.p-tools').addEventListener('click', e => { const b = e.target.closest('.p-tool'); if (b) setTool(b.dataset.tool); });
  $('pColor').addEventListener('click', () => { $('pSheet').classList.add('hidden'); $('pPop').classList.toggle('hidden'); });
  $('pPop').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { setColor(b.dataset.color); $('pPop').classList.add('hidden'); } });
  $('pPick').addEventListener('input', e => setColor(e.target.value.toLowerCase()));
  // close pop-ups when drawing or tapping elsewhere
  addEventListener('pointerdown', e => {
    if (!painting()) return;
    if (!e.target.closest('#pPop, #pColor')) $('pPop').classList.add('hidden');
    if (!e.target.closest('#pSheet, #pWords')) $('pSheet').classList.add('hidden');
  }, true);

  // size slider (vertical on big screens, across on phones)
  const slider = $('pSize'), dot = $('pSizeDot');
  const sizeT = () => (tool.size - K.MIN_W) / (K.MAX_W - K.MIN_W);
  function renderSize() {
    const t = Math.sqrt(sizeT()), r = slider.getBoundingClientRect(), across = r.width > r.height;
    const fill = slider.firstElementChild, thumb = slider.lastElementChild;
    fill.style.height = across ? '' : (t * 100) + '%'; fill.style.width = across ? (t * 100) + '%' : '';
    thumb.style.top = across ? '' : ((1 - t) * 100) + '%'; thumb.style.left = across ? (t * 100) + '%' : '';
    slider.setAttribute('aria-valuenow', tool.size);
    const shown = tool.size * (pad.getBoundingClientRect().width / K.PAD_W || 0.5);
    dot.firstElementChild.style.width = dot.firstElementChild.style.height = Math.max(2, Math.min(100, shown)) + 'px';
    if (cursorEl) cursorEl.style.width = cursorEl.style.height = Math.max(4, shown) + 'px';
  }
  function sizeFrom(e) {
    const r = slider.getBoundingClientRect(), across = r.width > r.height;
    let t = across ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
    t = Math.max(0, Math.min(1, t));
    tool.size = Math.round(K.MIN_W + t * t * (K.MAX_W - K.MIN_W));
    if (tool.kind === 'flame' || tool.kind === 'fill') tool.kind = 'brush';
    renderStudio();
  }
  let sizing = false;
  slider.addEventListener('pointerdown', e => { sizing = true; slider.setPointerCapture(e.pointerId); dot.classList.add('show'); sizeFrom(e); });
  slider.addEventListener('pointermove', e => { if (sizing) sizeFrom(e); });
  ['pointerup', 'pointercancel'].forEach(t => slider.addEventListener(t, () => { if (sizing) { sizing = false; saveTool(); setTimeout(() => dot.classList.remove('show'), 500); } }));
  slider.addEventListener('keydown', e => {
    const d = { ArrowUp: 2, ArrowRight: 2, ArrowDown: -2, ArrowLeft: -2 }[e.key];
    if (d) { e.preventDefault(); tool.size = Math.max(K.MIN_W, Math.min(K.MAX_W, tool.size + d)); saveTool(); renderStudio(); }
  });

  function undo() {
    if (!cfg.strokes.length) return;
    redo.push(cfg.strokes.pop()); update(); renderStudio(); tip('↩︎ Undo');
  }
  function redoStep() {
    if (!redo.length) return;
    cfg.strokes.push(redo.pop()); update(); renderStudio(); tip('↪︎ Redo');
  }
  function commit(step) { cfg.strokes.push(step); redo = []; update(); renderStudio(); }
  $('pUndo').addEventListener('click', undo);
  $('pRedo').addEventListener('click', redoStep);
  $('pGuide').addEventListener('click', () => { tool.guide = !tool.guide; saveTool(); syncPaint(); });
  $('pClear').addEventListener('click', () => {
    if (!cfg.strokes.length && !cfg.flames.length) return;
    if (confirm('Clear the whole paper?')) { cfg.strokes = []; cfg.flames = []; redo = []; update(); renderStudio(); }
  });
  $('pToCreate').addEventListener('click', () => setMode('create'));
  $('pWords').addEventListener('click', () => {
    $('pPop').classList.add('hidden');
    $('pName').value = cfg.name; $('pMsg').value = cfg.msg;
    $('pSheet').classList.toggle('hidden');
  });
  $('pName').addEventListener('input', e => { cfg.name = e.target.value; nameIn.value = cfg.name; App.setKrathong(cfg); save(); });
  $('pMsg').addEventListener('input', e => { cfg.msg = e.target.value.slice(0, K.MAX_MSG); App.setKrathong(cfg); save(); });
  $('pSheetDone').addEventListener('click', () => $('pSheet').classList.add('hidden'));
  $('pSheet').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.target.id === 'pName') $('pMsg').focus(); else $('pSheet').classList.add('hidden');
  });
  // keyboard shortcuts on computers
  addEventListener('keydown', e => {
    if (!painting() || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redoStep() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redoStep(); }
    else if (!e.ctrlKey && !e.metaKey) {
      const t = { b: 'brush', g: 'fill', e: 'eraser', c: 'flame' }[k];
      if (t) setTool(t);
      else if (k === '[' || k === ']') { tool.size = Math.max(K.MIN_W, Math.min(K.MAX_W, tool.size + (k === ']' ? 3 : -3))); saveTool(); renderStudio(); }
    }
  });
  addEventListener('resize', () => { if (painting()) renderSize(); });

  // brush outline that follows the mouse
  pad.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { document.body.classList.add('mouse-cursor'); } });
  pad.addEventListener('pointerleave', () => cursorEl.classList.remove('on'));
  pad.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') { document.body.classList.remove('mouse-cursor'); return; }
    const showRing = tool.kind === 'brush' || tool.kind === 'eraser';
    cursorEl.classList.toggle('on', showRing);
    cursorEl.style.left = e.clientX + 'px'; cursorEl.style.top = e.clientY + 'px';
  });

  // ---------- drawing on the paper ----------
  // Two-finger tap = undo, three-finger tap = redo (like drawing apps). A second finger cancels the stroke.
  let cur = null;
  const touches = new Map();
  let gesture = null;          // { n, t, moved }
  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) / r.width * K.PAD_W), Math.round((e.clientY - r.top) / r.height * K.PAD_H)];
  }
  const inPad = ([x, y]) => x >= 0 && y >= 0 && x < K.PAD_W && y < K.PAD_H;
  pad.addEventListener('pointerdown', e => {
    if (!painting() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size >= 2) {
        if (cur) { cur = null; App.setKrathong(cfg); }     // throw away the stroke the first finger started
        if (!gesture || performance.now() - gesture.t < 300) gesture = { n: touches.size, t: gesture ? gesture.t : performance.now(), moved: false };
        return;
      }
      gesture = { n: 1, t: performance.now(), moved: false };
    }
    const q = padPoint(e);
    if (!inPad(q)) return;
    const [x, y] = q;
    if (tool.kind === 'flame') {
      const vx = x * K.VIEW_W / K.PAD_W, vy = y * K.VIEW_H / K.PAD_H;
      const near = cfg.flames.findIndex(f => Math.hypot(f[0] - vx, f[1] - vy) < 18);
      if (near >= 0) cfg.flames.splice(near, 1);
      else if (cfg.flames.length < K.MAX_FLAMES) cfg.flames.push([Math.round(vx), Math.round(vy)]);
      else { tip(`Up to ${K.MAX_FLAMES} flames. Tap one to remove it.`); return; }
      update();
      return;
    }
    if (tool.kind === 'fill') {
      // wait a moment: if a second finger lands, it's an undo gesture, not a fill
      const step = { t: 'f', c: tool.color, w: 10, p: [x, y] };
      const go = () => {
        if (gesture && gesture.n > 1) return;
        const probe = document.createElement('canvas'); probe.width = K.PAD_W; probe.height = K.PAD_H;
        const pg = probe.getContext('2d', { willReadFrequently: true });
        K.paintStrokes(pg, cfg.strokes);
        const filled = K.floodFill(pg, x, y, tool.color);
        if (!filled) return;
        commit(step);
        setColor(tool.color, true);
        if (filled > K.PAD_W * K.PAD_H * 0.55) tip('That colored the paper. It shows here, but only your krathong floats on the river.');
      };
      if (e.pointerType === 'touch') setTimeout(go, 120); else go();
      return;
    }
    cur = { id: e.pointerId, s: { t: tool.kind === 'eraser' ? 'e' : 's', c: tool.color, w: tool.size, p: [x, y] } };
    try { pad.setPointerCapture(e.pointerId); } catch (err) {}
    K.paintStroke(g, cur.s);
  });
  pad.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const [sx, sy] = touches.get(e.pointerId);
      if (gesture && gesture.n > 1 && Math.hypot(e.clientX - sx, e.clientY - sy) > 18) gesture.moved = true;
    }
    if (!cur || e.pointerId !== cur.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const p = cur.s.p;
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = padPoint(ev);
      const lx = p[p.length - 2], ly = p[p.length - 1];
      if (Math.hypot(x - lx, y - ly) < 1.5) continue;
      const cx = Math.max(0, Math.min(K.PAD_W - 1, x)), cy = Math.max(0, Math.min(K.PAD_H - 1, y));
      p.push(cx, cy);
      K.paintStroke(g, { t: cur.s.t, c: cur.s.c, w: cur.s.w, p: [lx, ly, cx, cy] });
    }
  });
  function endPointer(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.delete(e.pointerId);
      if (!touches.size && gesture && gesture.n > 1) {
        const quick = performance.now() - gesture.t < 450 && !gesture.moved;
        if (quick) { if (gesture.n === 2) undo(); else if (gesture.n >= 3) redoStep(); }
        gesture = null;
        return;
      }
    }
    if (!cur || (e.pointerId !== cur.id)) return;
    const s = cur.s; cur = null;
    s.p = K.simplify(s.p, 0.9);
    if (s.t === 's') setColor(s.c, true);
    commit(s);
  }
  pad.addEventListener('pointerup', endPointer);
  pad.addEventListener('pointercancel', endPointer);
  pad.addEventListener('lostpointercapture', e => { if (cur && e.pointerId === cur.id) endPointer(e); });

  $('pRiver').addEventListener('click', () => toRiver());
  $('pRelease').addEventListener('click', () => $('releaseBtn').click());

  // ---------- going between screens ----------
  function hideOverlays() { ['roles', 'howBox', 'start'].forEach(id => $(id).classList.add('hidden')); }
  function enterBuild(mode) {
    hideOverlays();
    if (mode) { cfg.mode = mode; tab = mode === 'draw' ? 'words' : 'base'; save(); }
    nameIn.value = cfg.name;
    App.setKrathong(cfg);
    App.enterBuild();
    renderSwitch(); renderTabs(); renderBody(); showGuide();
  }
  function floatNow(c, fromBuilder, release) {
    hideOverlays();
    App.setKrathong(c);
    App.enterFloat({ fromBuilder, release });
    showGuide();
  }
  function toRiver() { hideOverlays(); App.enterRiver(); showGuide(); }
  function askHow() { hideOverlays(); $('howBox').classList.remove('hidden'); }
  $('roleMaker').addEventListener('click', askHow);
  $('roleRiver').addEventListener('click', toRiver);
  $('riverMakeBtn').addEventListener('click', askHow);
  $('toRiverBtn').addEventListener('click', toRiver);
  $('howDraw').addEventListener('click', () => enterBuild('draw'));
  $('howCreate').addEventListener('click', () => enterBuild('create'));
  $('howBack').addEventListener('click', () => { hideOverlays(); $('roles').classList.remove('hidden'); });
  // Release: light it, make a wish, swipe it away, and it joins everyone on the shared river.
  $('releaseBtn').addEventListener('click', () => {
    if (cfg.mode === 'draw' && !cfg.strokes.length) { toast('Draw your krathong first ✏️'); return; }
    floatNow(Object.assign({}, cfg, { from: '' }), true, true);
  });
  $('editBtn').addEventListener('click', () => enterBuild());
  $('backBtn').addEventListener('click', () => enterBuild());
  $('makeOwnBtn').addEventListener('click', () => { cfg = loadDraft(); askHow(); });

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  App.toast = toast;

  // ---------- first screen ----------
  if (K.hasKrathong(new URLSearchParams(location.search), location.hash)) {
    floatNow(K.fromLocation(location), false);          // opened a krathong someone sent
  } else {
    App.enterRiver();                                    // everyone's krathongs behind the welcome
    $('roles').classList.remove('hidden');
  }
})();
