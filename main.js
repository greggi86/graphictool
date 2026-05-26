import { state, setState, setViewport, setUI, dispatch, subscribe } from './state2.js';
import { renderText } from "./textEngine.js";

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gcan = document.getElementById('grid-overlay');
const gctx = gcan.getContext('2d');

function getSelected() {
  return state.document.items.find(i => i.id === state.selectionId) ?? null;
}

function renderToolbar()
{
    ['select','shape','text','layers'].forEach(x => {
    document.getElementById('tb-'+x)
    ?.classList.toggle('active', x === state.tool);
  })
}

function renderCanvasMode()
{
    document.getElementById('cw').className =
    'canvas-wrap mode-' + 
    (state.tool==='shape'
      ?'shape'
      :state.tool==='text'
      ?'text'
      :'select')
}

function renderPanels()
{
    const map = {                                               // seperator layout element
    shape: 'sec-shapes',
    text: 'sec-text',
    layers: 'sec-layers'
  };

  ['sec-shapes','sec-text','sec-layers'].forEach(id => {      // seperator layout element
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = (id === map[state.tool]) ? 'block' : 'none';
  });
}

function renderGridPanel()
{
  document.getElementById('sec-grid').style.display =
    state.ui.gridPanelOpen ? 'block' : 'none';
}

function renderUI()
{
  renderToolbar();
  renderPanels();
  renderCanvasMode();
  renderGridPanel();
  if(state.tool == "layers")
    renderLayers();
}
// ── TOOLS ──────────────────────────────────────────────────
function setTool(t) {
  dispatch({ type: "SET_TOOL", tool: t });
  renderUI();
}

function pickShape(s) {
  dispatch({ type: "SET_SELECTED_SHAPE", shape: s });
  document.querySelectorAll('.shape-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('sb-'+s)?.classList.add('active');
  ['star','cloud'].forEach(n => {
    document.getElementById('ex-'+n).style.display = n===s ? 'block' : 'none';
  });
  if (s === 'star') rerollStar();
  redrawPreview();
}

function sv(id, val) { document.getElementById(id).textContent = val; }

// ── STAR CHAOS ─────────────────────────────────────────────
function rerollStar() {
  const pts = parseInt(document.getElementById('star-pts').value) || 5;
  state.ui.starOffsets = Array.from({length: pts*2}, () => (Math.random()-0.5)*2);
}

// ── HOVER PREVIEW ──────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  if (state.tool !== 'shape' && state.tool !== 'text') return;
  const r = canvas.getBoundingClientRect();
  state.ui.previewPos = {
    x: (e.clientX - r.left) / state.viewport.zoom,
    y: (e.clientY - r.top) / state.viewport.zoom
  };
  redrawPreview();
});

canvas.addEventListener('mouseleave', () => {
  state.ui.previewPos = null;
  redrawPreview();
});
function redrawPreview() {
  redraw();
  if (!state.ui.previewPos || (state.tool !== 'shape' && state.tool !== 'text')) return;
  const ghost = (state.tool === 'shape') ? mkShape(state.ui.previewPos.x, state.ui.previewPos.y) : mkTextPreview(state.ui.previewPos.x, state.ui.previewPos.y);
  if (!ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.45;
  // dashed outline to show it's a ghost
  ctx.setLineDash([4, 3]);
  paintItem(ghost);
  ctx.setLineDash([]);
  // crosshair dot
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(state.ui.previewPos.x, state.ui.previewPos.y, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

canvas.addEventListener('mousemove', e => {
  if (state.tool !== 'select' || state.selectionId === null || state.drag.active) return;
  const it = getSelected();
  if (!it) return;
  const r  = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) / state.viewport.zoom;
  const my = (e.clientY - r.top)  / state.viewport.zoom;

  const handle = getHandleHit(it, mx, my);
  const cursorMap = {
    tl: 'nwse-resize', tr: 'nesw-resize',
    bl: 'nesw-resize', br: 'nwse-resize',
    tm: 'ns-resize',   bm: 'ns-resize',
    ml: 'ew-resize',   mr: 'ew-resize',
    rot: 'crosshair',
  };
  canvas.style.cursor = handle ? cursorMap[handle] : 'default';
});


// ── CANVAS CLICK ───────────────────────────────────────────
canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / state.viewport.zoom;
  const y = (e.clientY - r.top) / state.viewport.zoom;

  if (state.tool === 'select') {
    let hit = -1;
    for (let i = state.document.items.length-1; i >= 0; i--) {
      const it = state.document.items[i];
      if (it.hidden) continue;
      const p = it.params;
      const reach = (p?.radius || p?.size || Math.max(p?.width||0,p?.height||0)/2 || 30) + 12;
      if (Math.hypot(x - it.x, y - it.y) < reach) { hit = i; break; }
    }
    if (hit >= 0 && state.document.items[hit].locked) return;
    dispatch({ type: "SET_SELECTION", id: state.document.items[hit]?.id ?? null });
    if (hit >= 0) pullProps(state.document.items[hit]);
    document.getElementById('sel-info').classList.toggle('on', hit >= 0);
    renderLayers(); redraw(); return;
  }

  if (state.tool === 'shape') {
    push();
    const item = mkShape(x, y);
    dispatch({ type: "ADD_ITEM", item });
    dispatch({ type: "SET_SELECTION", id: item.id });
    renderLayers(); redraw(); return;
  }

  if (state.tool === 'text') {
    const txt = document.getElementById('txt-inp').value.trim();
    if (!txt) return;
    push();
    const item = createTextItem(x, y, txt);
    dispatch({ type: "ADD_ITEM", item });
    dispatch({ type: "SET_SELECTION", id: item.id });
    renderLayers(); redraw();
  }
});

// ── TEXT STYLE SYNC ────────────────────────────────────────
function syncTextStyle() {
  dispatch({ type: "SET_EDITOR_TEXT", patch: {
    fontSize:      Number(document.getElementById('txt-sz').value) || 24,
    fontFamily:    document.getElementById('txt-font').value,
    fontWeight:    Number(document.getElementById('txt-wt').value) || 400,
    rotation:      Number(document.getElementById('txt-rot').value) || 0,
    lineHeight:    Number(document.getElementById('txt-hgt').value) || 28,
  }});
  dispatch({ type: "SET_EDITOR", patch: {
    fill: document.getElementById('col-fill').value
  }});
}

function mkTextPreview(x, y) {
  const txt = document.getElementById('txt-inp').value.trim();
  if (!txt) return null;
  syncTextStyle();
  return createTextItem(x, y, txt);
}

function createTextItem(x, y, text) {
  syncTextStyle();
  return {
    id: Math.random().toString(36).slice(2),
    type: 'text',
    x, y,
    params: {
      text,
      fontSize:      state.editor.textStyle.fontSize,
      fontFamily:    state.editor.textStyle.fontFamily,
      fontWeight:    state.editor.textStyle.fontWeight,
      rotation:      state.editor.textStyle.rotation,
      align:         state.editor.textStyle.align,
      lineHeight:    state.editor.textStyle.lineHeight,
      letterSpacing: state.editor.textStyle.letterSpacing,
      color:         state.editor.fill,
      opacity:       Number(state.editor.shapeStyle.opacity),
      locked: false,
        hidden: false,
    }
  };
}

// ── SCRUBABLE INPUTS ──────────────────────────────────────
function makeScrubable(inputEl, speed = 1) {
  inputEl.addEventListener('mousedown', e => {
    const startVal = parseFloat(inputEl.value) || 0;
    const startX = e.clientX;
    let scrubbing = false;
    let accumulated = 0;

    const onMove = e => {
      if (!scrubbing) {
        if (Math.abs(e.clientX - startX) < 3) return;
        scrubbing = true;
        inputEl.requestPointerLock();
      }
      accumulated += e.movementX * speed;
      const min = inputEl.min !== '' ? parseFloat(inputEl.min) : -Infinity;
      const max = inputEl.max !== '' ? parseFloat(inputEl.max) : Infinity;
      inputEl.value = Math.min(max, Math.max(min, startVal + Math.round(accumulated)));
      inputEl.dispatchEvent(new Event('change'));
      inputEl.dispatchEvent(new Event('input'));
    };

    const onUp = () => {
      document.exitPointerLock();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── INIT SCRUBBING ─────────────────────────────────────────
function initScrubables() {
  document.querySelectorAll('.scrubable').forEach(el => {
    makeScrubable(el, parseFloat(el.dataset.speed) || 1);
  });
}

// ── BUILD SHAPE ────────────────────────────────────────────
function mkShape(x, y) {
  const w = parseInt(document.getElementById('pw').value) || 80;
  const h = parseInt(document.getElementById('ph').value) || 80;
  const fill = document.getElementById('col-fill').value;
  const stroke = document.getElementById('col-stroke').value;
  const sw = parseInt(document.getElementById('psw').value) || 0;
  const op = parseInt(document.getElementById('pop').value) / 100;
  const rot = parseInt(document.getElementById('prot').value) || 0;
  const base = { id: crypto.randomUUID(), type: state.selectedShape, x, y, locked: false, hidden: false,};
  if (state.selectedShape === 'circle') base.params = { radius: w/2, fill, stroke, sw, op, rot };
  else if (state.selectedShape === 'rectangle') base.params = { width: w, height: h, fill, stroke, sw, op, rot };
  else if (state.selectedShape === 'triangle') base.params = { size: w/2, fill, stroke, sw, op, rot };
  else if (state.selectedShape === 'star') base.params = {
    size: w/2, pts: parseInt(document.getElementById('star-pts').value),
    ir: parseInt(document.getElementById('star-ir').value),
    chaos: parseInt(document.getElementById('star-chaos').value)/100,
    offsets: [...state.ui.starOffsets],
    fill, stroke, sw, op, rot
  };
  else if (state.selectedShape === 'cloud') base.params = {
    size: w/2, bumps: parseInt(document.getElementById('cloud-b').value),
    fill, stroke, sw, op, rot
  };
  return base;
}

// ── DRAW ───────────────────────────────────────────────────
function redraw() {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  state.document.items.filter(it => !it.hidden).forEach((it, i) => {
    ctx.save();
    ctx.globalAlpha = it.params?.op ?? it.params?.opacity ?? 1;
    paintItem(it);
    ctx.restore();
    if (state.document.items[i]?.id === state.selectionId) paintSel(it);
  });
  if (state.selectionId !== null && getSelected()) {
    const it = getSelected();
    document.getElementById('sel-info').textContent = `${it.type} · ${Math.round(it.x)}, ${Math.round(it.y)}`;
  }
  // cursor bei handle-hover
if (state.tool === 'select' && state.selectionId !== null) {
  const it = getSelected();
  if (it) {
    const r = canvas.getBoundingClientRect();
    // wird im mousemove ohne drag gesetzt
  }
}
}

function paintItem(it) {
  const p = it.params;
  if (it.type === 'text') {
    renderText(ctx, it);
    return;
  }
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate((p.rot||0)*Math.PI/180);
  if (it.type === 'circle') {
    ctx.beginPath(); ctx.arc(0,0,p.radius,0,Math.PI*2);
    ctx.fillStyle = p.fill; ctx.fill();
    if (p.sw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.stroke(); }
  } else if (it.type === 'rectangle') {
    ctx.fillStyle = p.fill;
    ctx.fillRect(-p.width/2,-p.height/2,p.width,p.height);
    if (p.sw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.strokeRect(-p.width/2,-p.height/2,p.width,p.height); }
  } else if (it.type === 'triangle') {
    const s = p.size;
    ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s*.866,s*.5); ctx.lineTo(-s*.866,s*.5); ctx.closePath();
    ctx.fillStyle = p.fill; ctx.fill();
    if (p.sw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.stroke(); }
  } else if (it.type === 'star') {
    const inner = p.size*(p.ir/100);
    const chaos = p.chaos || 0;
    const offs = p.offsets || [];
    ctx.beginPath();
    for (let i=0; i<p.pts*2; i++) {
      const a = -Math.PI/2 + i*Math.PI/p.pts;
      const baseR = i%2===0 ? p.size : inner;
      const jitter = chaos * baseR * (offs[i] || 0) * 0.6;
      const r = Math.max(2, baseR + jitter);
      i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath(); ctx.fillStyle = p.fill; ctx.fill();
    if (p.sw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.stroke(); }
  } else if (it.type === 'cloud') {
    ctx.beginPath();
    const step = Math.PI*2/p.bumps;
    for (let i=0; i<p.bumps; i++) {
      const a = i*step;
      const cr = p.size*(0.65+0.25*Math.sin(i*2.4));
      ctx.arc(Math.cos(a)*p.size*.5, Math.sin(a)*p.size*.5, cr*.55, 0, Math.PI*2);
    }
    ctx.fillStyle = p.fill; ctx.fill();
    if (p.sw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw; ctx.stroke(); }
  }
  ctx.restore();
}

function paintSel(it) {
  const p = it.params;
  const rot = (p.rot ?? p.rotation ?? 0) * Math.PI / 180;

  let hw, hh; // half-width, half-height
if (p.radius   !== undefined) { hw = p.radius;   hh = p.radius;   }
else if (p.width !== undefined) { hw = p.width/2;  hh = p.height/2; }
else if (p.size  !== undefined) { hw = p.size/2;   hh = p.size/2;   }
hw += 4; hh += 4;

  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(rot);

  // bounding box
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(-hw, -hh, hw*2, hh*2);

  // scale handles — 8 stück
  const handles = [
    [-hw, -hh], [0, -hh], [hw, -hh],
    [hw,   0 ],
    [hw,  hh], [0,  hh], [-hw, hh],
    [-hw,  0 ],
  ];

  handles.forEach(([hx, hy]) => {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(hx-4, hy-4, 8, 8);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

// ── DRAG ───────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (state.selectionId === null) return;
  const it = getSelected();
  if (!it) return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) / state.viewport.zoom;
  const my = (e.clientY - r.top)  / state.viewport.zoom;

  const handle = state.tool === 'select' ? getHandleHit(it, mx, my) : null;
  const p = it.params;

  state.drag.startX    = mx;
  state.drag.startY    = my;
  state.drag.originX   = it.x;
  state.drag.originY   = it.y;
  state.drag.originRot = p.rot ?? p.rotation ?? 0;

  if (p.radius   !== undefined) { state.drag.originW = p.radius*2;  state.drag.originH = p.radius*2;  }
  else if (p.width !== undefined) { state.drag.originW = p.width;   state.drag.originH = p.height;    }
  else if (p.size  !== undefined) { state.drag.originW = p.size*2;  state.drag.originH = p.size*2;    }

  if (handle === 'rot') {
    state.drag.active = true;
    state.drag.mode   = 'rotate';
    state.drag.handle = 'rot';
  } else if (handle) {
    state.drag.active = true;
    state.drag.mode   = 'scale';
    state.drag.handle = handle;
  } else {
    state.drag.active = true;
    state.drag.mode   = 'move';
    state.drag.handle = null;
  }
});

canvas.addEventListener('mousemove', e => {
  if (!state.drag.active || state.selectionId === null) return;
  const it = getSelected();
  if (!it) return;
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) / state.viewport.zoom;
  const my = (e.clientY - r.top)  / state.viewport.zoom;
  const p  = it.params;

  if (state.drag.mode === 'move') {
    it.x = state.drag.originX + (mx - state.drag.startX);
    it.y = state.drag.originY + (my - state.drag.startY);
    document.getElementById('px').value = Math.round(it.x);
    document.getElementById('py').value = Math.round(it.y);

  } else if (state.drag.mode === 'rotate') {
    const angle = Math.atan2(my - it.y, mx - it.x) * 180 / Math.PI + 90;
    const rot   = ((angle % 360) + 360) % 360;
    if (p.rot      !== undefined) p.rot      = rot;
    if (p.rotation !== undefined) p.rotation = rot;
    document.getElementById('prot').value = Math.round(rot);

  } else if (state.drag.mode === 'scale') {
    const rot    = (p.rot ?? p.rotation ?? 0) * Math.PI / 180;
    const dx     = mx - state.drag.originX;
    const dy     = my - state.drag.originY;
    const cos    = Math.cos(-rot);
    const sin    = Math.sin(-rot);
    const lx     = dx * cos - dy * sin;
    const ly     = dx * sin + dy * cos;
    const handle = state.drag.handle;

    let newW = state.drag.originW;
    let newH = state.drag.originH;

if (handle === 'tm' || handle.includes('t')) newH = Math.max(10, state.drag.originH/2 - ly) * 2;
if (handle === 'bm' || handle.includes('b')) newH = Math.max(10, state.drag.originH/2 + ly) * 2;
if (handle === 'ml' || handle.includes('l')) newW = Math.max(10, state.drag.originW/2 - lx) * 2;
if (handle === 'mr' || handle.includes('r')) newW = Math.max(10, state.drag.originW/2 + lx) * 2;

    if (p.radius !== undefined) { p.radius = newW / 2; }
    else if (p.size !== undefined) { p.size = newW / 2; }
    else { p.width = newW; p.height = newH; }

    document.getElementById('pw').value = Math.round(newW);
    document.getElementById('ph').value = Math.round(newH);
  }

  redraw();
});

canvas.addEventListener('mouseup', () => {
  if (state.drag.active) { state.drag.active = false; push(); }
});

// ── PROPS ──────────────────────────────────────────────────
function pullProps(it) {
  const p = it.params;
  document.getElementById('px').value = Math.round(it.x);
  document.getElementById('py').value = Math.round(it.y);
  document.getElementById('pop').value = Math.round((p.op??p.opacity??1)*100);
  if (it.type !== 'text') {
    const sz = (p.radius||p.size||0)*2 || p.width||80;
    document.getElementById('pw').value = Math.round(sz);
    document.getElementById('ph').value = Math.round(p.height||sz);
    document.getElementById('col-fill').value = p.fill||'#2563eb';
    document.getElementById('hex-fill').value = p.fill||'#2563eb';
    document.getElementById('col-stroke').value = p.stroke||'#1d4ed8';
    document.getElementById('hex-stroke').value = p.stroke||'#1d4ed8';
    document.getElementById('psw').value = p.sw||0;
    document.getElementById('prot').value = p.rot||0;
    syncSwatch('fill'); syncSwatch('stroke');
  } else {
    document.getElementById('col-fill').value = p.color||'#1a1a1a';
    document.getElementById('hex-fill').value = p.color||'#1a1a1a';
    syncSwatch('fill');
  }
}

function applyProps() {
  if (state.selectionId === null) return;
  const it = getSelected();
  const w = parseInt(document.getElementById('pw').value) || 80;
  const h = parseInt(document.getElementById('ph').value) || 80;

  dispatch({ type: "UPDATE_ITEM", id: it.id, patch: {
    x: parseFloat(document.getElementById('px').value),
    y: parseFloat(document.getElementById('py').value),
  }});

  if (it.type !== 'text') {
    const paramPatch = {
      fill:   document.getElementById('col-fill').value,
      stroke: document.getElementById('col-stroke').value,
      sw:     parseInt(document.getElementById('psw').value) || 0,
      rot:    parseInt(document.getElementById('prot').value) || 0,
      op:     parseInt(document.getElementById('pop').value) / 100,
    };
    if (it.params.radius !== undefined) paramPatch.radius = w / 2;
    if (it.params.size   !== undefined) paramPatch.size   = w / 2;
    if (it.params.width  !== undefined) paramPatch.width  = w;
    if (it.params.height !== undefined) paramPatch.height = h;
    dispatch({ type: "UPDATE_ITEM_PARAMS", id: it.id, patch: paramPatch });
  } else {
    dispatch({ type: "UPDATE_ITEM_PARAMS", id: it.id, patch: {
      color:    document.getElementById('col-fill').value,
      fontSize: parseInt(document.getElementById('txt-sz').value),
      opacity:  parseInt(document.getElementById('pop').value) / 100,
    }});
  }
  redraw();
}

function syncSwatch(t) {
  const c = document.getElementById('col-'+t).value;
  document.getElementById('sw-'+t).style.background = c;
  document.getElementById('hex-'+t).value = c;
}

function syncHex(t) {
  const v = document.getElementById('hex-'+t).value;
  if (/^#[0-9a-f]{6}$/i.test(v)) {
    document.getElementById('col-'+t).value = v;
    syncSwatch(t); applyProps();
  }
}

// ── GRID ───────────────────────────────────────────────────
function toggleGridPanel() {
  dispatch({ type: "SET_GRID", patch: { gridPanelOpen: !state.ui.gridPanelOpen }});
  document.getElementById('grid-btn').classList.toggle('on', state.ui.gridPanelOpen);
}

function setGridVisible(v) {
  dispatch({ type: "SET_GRID", patch: { gridVisible: v }});
  if (v) renderGrid();
  else gctx.clearRect(0, 0, gcan.width, gcan.height);
}

function renderGrid() {
  if (!state.ui.gridVisible) return;
  const sz = parseInt(document.getElementById('g-sz').value)||40;
  const type = document.getElementById('g-type').value;
  const col = document.getElementById('g-col').value;
  const op = parseInt(document.getElementById('g-op').value)/100;
  gctx.clearRect(0,0,gcan.width,gcan.height);
  gctx.globalAlpha = op;
  if (type === 'dots') {
    gctx.fillStyle = col;
    for (let x=0; x<=gcan.width; x+=sz)
      for (let y=0; y<=gcan.height; y+=sz) {
        gctx.beginPath(); gctx.arc(x,y,1.5,0,Math.PI*2); gctx.fill();
      }
  } else if (type === 'lines') {
    gctx.strokeStyle = col; gctx.lineWidth = 0.5;
    for (let x=0; x<=gcan.width; x+=sz) { gctx.beginPath(); gctx.moveTo(x,0); gctx.lineTo(x,gcan.height); gctx.stroke(); }
    for (let y=0; y<=gcan.height; y+=sz) { gctx.beginPath(); gctx.moveTo(0,y); gctx.lineTo(gcan.width,y); gctx.stroke(); }
  } else {
    const cols = Math.floor(gcan.width/sz);
    for (let i=0; i<cols; i++) {
      gctx.fillStyle = i%2===0 ? col+'28' : 'transparent';
      gctx.fillRect(i*sz,0,sz,gcan.height);
    }
    gctx.strokeStyle = col; gctx.lineWidth = 0.5;
    for (let x=0; x<=gcan.width; x+=sz) { gctx.beginPath(); gctx.moveTo(x,0); gctx.lineTo(x,gcan.height); gctx.stroke(); }
  }
  gctx.globalAlpha = 1;
}

// ── LAYERS ────────────────────────────────────────────────
let dragLayerIndex = null;
let dragOverIndex = null;

function renderLayers() {
  const list = document.getElementById('lay-list');
  if (!state.document.items.length) {
    list.innerHTML = '<div class="empty-lay">Noch keine Elemente</div>';
    return;
  }

  list.innerHTML = '';
  const icons = { circle:'●', rectangle:'▬', triangle:'▲', star:'★', cloud:'☁', text:'T' };

  [...state.document.items].reverse().forEach((it, ri) => {
    const i = state.document.items.length - 1 - ri;
    const d = document.createElement('div');
    d.className = 'layer-item' + (it.id === state.selectionId ? ' sel' : '') + (it.hidden ? ' hidden-layer' : '');
    d.draggable = !it.locked;

    // drag reorder
    d.addEventListener('dragstart', e => {
      if (it.locked) { e.preventDefault(); return; }
      d.classList.add('dragging');
      dragLayerIndex = i;
    });
    d.addEventListener('dragover', e => {
      e.preventDefault();
      dragOverIndex = i;
      document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
      d.classList.add('drag-over');
    });
    d.addEventListener('drop', e => {
      e.preventDefault();
        if (dragLayerIndex === null || dragLayerIndex === i) return;
      push();
      const to = dragLayerIndex > i ? i : i - 1;
      dispatch({ type: "REORDER_ITEMS", from: dragLayerIndex, to: to + 1 });
      dragLayerIndex = null;
      dragOverIndex = null;
      renderLayers(); redraw();
      });
    d.addEventListener('dragend', () => {
      d.classList.remove('dragging');
      document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over'));
      dragLayerIndex = null;
    });

    // select on click
    d.addEventListener('click', e => {
      if (e.target.closest('.layer-actions')) return;
      if (it.locked) return;
      dispatch({ type: 'SET_SELECTION', id: it.id });
      pullProps(it);
      document.getElementById('sel-info').classList.add('on');
      renderLayers(); redraw();
    });

    const lbl = it.type === 'text'
      ? it.params.text.split('\n')[0].slice(0, 18)
      : it.type + ' ' + (i + 1);

    d.innerHTML = `
      <div class="layer-thumb" style="background:${it.params?.fill || it.params?.color || '#eee'};opacity:${it.hidden?0.4:1}">${icons[it.type] || '?'}</div>
      <span class="layer-nm" style="opacity:${it.hidden ? 0.4 : 1}">${lbl}</span>
      <div class="layer-actions">
        <button class="layer-act ${it.hidden ? 'act-on' : ''}" title="Ausblenden" onclick="toggleLayerHidden('${it.id}')">◑</button>
        <button class="layer-act ${it.locked ? 'act-on' : ''}" title="Sperren" onclick="toggleLayerLocked('${it.id}')">⬡</button>
        <button class="layer-x" onclick="delItem(${i})">×</button>
      </div>
    `;

    list.appendChild(d);
  });
}

function toggleLayerHidden(id) {
  const it = state.document.items.find(i => i.id === id);
  if (!it) return;
  dispatch({ type: "UPDATE_ITEM", id, patch: { hidden: !it.hidden }});
  renderLayers(); redraw();
}

function toggleLayerLocked(id) {
  const it = state.document.items.find(i => i.id === id);
  if (!it) return;
  dispatch({ type: "UPDATE_ITEM", id, patch: { locked: !it.locked }});
  if (!it.locked && state.selectionId === id) {
    dispatch({ type: "SET_SELECTION", id: null });
  }
  renderLayers(); redraw();
}

function delItem(i) {
  push();
  dispatch({ type: "DELETE_ITEM", index: i });
  const sel = state.document.items.find(it => it.id === state.selectionId);
  if (!sel) {
    dispatch({ type: "SET_SELECTION", id: null });
    document.getElementById('sel-info').classList.remove('on');
  }
  renderLayers(); redraw();
}

function clearAll() {
  if (!confirm('Alle Elemente löschen?')) return;
  push();
  dispatch({ type: "SET_ITEMS", items: [] });
  dispatch({ type: "SET_SELECTION", id: null });
  document.getElementById('sel-info').classList.remove('on');
  renderLayers(); redraw();
}

function getHandleHit(it, mx, my) {
  const p = it.params;
  const rot = (p.rot ?? p.rotation ?? 0) * Math.PI / 180;

  let hw, hh;
if (p.radius   !== undefined) { hw = p.radius;   hh = p.radius;   }
else if (p.width !== undefined) { hw = p.width/2;  hh = p.height/2; }
else if (p.size  !== undefined) { hw = p.size/2;   hh = p.size/2;   }
hw += 18; hh += 18;

  // maus in lokale koordinaten des objekts transformieren
  const dx = mx - it.x;
  const dy = my - it.y;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;

const handles = {
  tl: [-hw, -hh], tm: [0, -hh], tr: [hw, -hh],
  mr: [hw,    0],
  br: [hw,   hh], bm: [0,  hh], bl: [-hw, hh],
  ml: [-hw,   0],
};

// erst scale handles checken (kleiner radius)
for (const [name, [hx, hy]] of Object.entries(handles)) {
  if (Math.hypot(lx - hx, ly - hy) < 6) return name;
}

// dann rotation an ecken (größerer außenbereich)
const corners = { tl: [-hw, -hh], tr: [hw, -hh], br: [hw, hh], bl: [-hw, hh] };
for (const [name, [hx, hy]] of Object.entries(corners)) {
  if (Math.hypot(lx - hx, ly - hy) < 14) return 'rot';
}

return null;
}

// ── HISTORY ───────────────────────────────────────────────
function push() {
  state.history.push(JSON.stringify(state.document.items));
  if (state.history.length > 40) state.history.shift();
}

function undo() {
  if (!state.history.length) return;
  dispatch({ type: "SET_ITEMS", items: JSON.parse(state.history.pop()) });
  dispatch({ type: "SET_SELECTION", id: null });
  renderLayers(); redraw();
}

// ── ZOOM ──────────────────────────────────────────────────
function doZoom(d) {
  state.viewport.zoom = Math.min(3, Math.max(0.2, state.viewport.zoom+d));
  document.getElementById('cc').style.transform = `scale(${state.viewport.zoom})`;
  document.getElementById('zoom-lbl').textContent = Math.round(state.viewport.zoom*100)+'%';
}

// ── EXPORT / IMPORT ───────────────────────────────────────
function exportPNG() {
  const a = document.createElement('a');
  a.download='canvas-drawing.png'; a.href=canvas.toDataURL('image/png'); a.click();
}
function exportJSON() {
  const b = new Blob([JSON.stringify({state: state.document.items},null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.download='canvas-drawing.json'; a.href=URL.createObjectURL(b); a.click();
}

function importJSON(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      dispatch({ type: "SET_ITEMS", items: data.items || [] });
      dispatch({ type: "SET_SELECTION", id: null });
      renderLayers(); redraw();
    } catch { alert('Ungültige Datei.'); }
  };
  r.readAsText(file);
}

// ── KEYBOARD ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if ((e.key==='Backspace'||e.key==='Delete') && state.selectionId !== null && tag!=='INPUT' && tag!=='TEXTAREA') {
    const sel = getSelected();
    if (sel) 
        delItem(state.document.items.indexOf(sel));
    }     
  if (e.key==='Escape' ) { 
        dispatch({
            type: "SET_SELECTION",
            id: null
});
    document.getElementById('sel-info').classList.remove('on');
    renderLayers();
    redraw(); 
    }
  if ((e.metaKey||e.ctrlKey) && e.key==='z') {
    e.preventDefault();
    undo();
    }
  if (e.key==='v' && (e.metaKey||e.ctrlKey)) setTool('select');
  if (e.key==='s' && (e.metaKey||e.ctrlKey)) setTool('shape');
  if (e.key==='t' && (e.metaKey||e.ctrlKey)) setTool('text');
});

// ── INIT ──────────────────────────────────────────────────
syncSwatch('fill'); syncSwatch('stroke'); rerollStar(); redraw();
initScrubables();

subscribe(() => {
  renderUI();
  redraw();
  renderLayers();
});

// ── GLOBALS ──────────────────────────────────────────────
window.setTool = setTool;
window.pickShape = pickShape;
window.applyProps = applyProps;
window.syncSwatch = syncSwatch;
window.syncHex = syncHex;
window.toggleGridPanel = toggleGridPanel;
window.setGridVisible = setGridVisible;
window.renderGrid = renderGrid;
window.doZoom = doZoom;
window.exportPNG = exportPNG;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.undo = undo;
window.clearAll = clearAll;
window.delItem = delItem;
window.sv = sv;
window.rerollStar = rerollStar;
window.redrawPreview = redrawPreview;