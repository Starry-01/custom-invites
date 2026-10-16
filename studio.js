/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 3.7: Advanced / Hidden Studio
   ───────────────────────────────────────────────────────────────
   Simple mode = choose. Studio mode = design.

   DEVELOPER ACCESS (this is a discoverability feature, NOT security):
     • Keyboard:  Ctrl + Shift + Alt + S   (Mac: Control/Cmd + Shift + Option + S)
                  — press again to leave Studio.
     • URL:       add  ?studio  to the page address (handy on laptops without a free shortcut).
     • Console:   CelesticateStudio.open()  /  CelesticateStudio.close()
   Change or remove all of this in STUDIO_ACCESS below. Setting `enabled: false`
   removes every way in; any saved Studio design still renders.
   Nothing here is a password or a permission check: anyone who reads the
   source can open it. The aim is only that normal customers never see it.

   Architecture
     • State lives in the invitation config at config.studio (script.js owns config):
         elements  custom text / image / shape / decor items
         sections  per-section overrides for the existing invitation sections
         order     one bottom→top layer list covering both
     • Positions are proportional: x and w are % of the invitation width, y is % of its
       height, sizes/fonts use "units" (1 unit = 1% of the invitation width, CSS --st-u).
       The invitation therefore scales together on mobile and desktop.
     • Studio only decorates the existing invitation: sections keep their own renderer.
     • All Studio UI (bar, panels, selection box, handles) is created on activation
       and removed on exit. It is never part of the guest/public view.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ═══════════════ 0. ACCESS — the only place that decides how Studio opens ═══════════════ */
  const STUDIO_ACCESS = {
    enabled: true,
    shortcut: { code: 'KeyS', ctrlOrMeta: true, shift: true, alt: true },
    queryParam: 'studio',   // null disables the URL route
    consoleApi: true,       // false hides CelesticateStudio.open()/close()
  };

  const host = window.CelesticateHost;
  if (!host) return;

  /* ═══════════════ 1. Constants & small helpers ═══════════════ */
  const Z_BASE = 2;   // the single layer scale: z-index = Z_BASE + position in studio.order
  const FONTS = {
    cormorant: { label: 'Cormorant Garamond', stack: '"Cormorant Garamond", Georgia, "Times New Roman", serif' },
    playfair:  { label: 'Playfair Display',   stack: '"Playfair Display", Georgia, "Times New Roman", serif' },
    dmsans:    { label: 'DM Sans',            stack: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif' },
  };
  const WEIGHTS = [400, 500, 600];
  const ALIGNS = ['left', 'center', 'right'];
  const TOKEN_VAR = { ink: '--inv-ink', muted: '--inv-muted', accent: '--inv-accent', primary: '--inv-primary', bg: '--inv-bg', line: '--inv-line' };
  const TOKEN_LABEL = { ink: 'Primary text', muted: 'Secondary text', accent: 'Accent', primary: 'Primary', bg: 'Background', line: 'Border' };
  const HEX = /^#[0-9a-f]{6}$/i;
  const SEC_DEFAULT = { dx: 0, dy: 0, scale: 1, mt: 0, mb: 0, hidden: false };
  const TYPE_LABEL = { text: 'Text', image: 'Image', shape: 'Shape', decor: 'Decor' };
  const SHAPE_LABEL = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line' };
  const DECOR = {
    sprig:    { label: 'Sprig',    vb: '0 0 64 28',  ratio: 0.44, mode: 'stroke', d: 'M4 14h56M32 14c-3-5-3-9 0-12 3 3 3 7 0 12ZM32 14c-3 5-3 9 0 12 3-3 3-7 0-12ZM20 14c-4-3-6-6-6-9 4 1 6 4 6 9ZM44 14c4-3 6-6 6-9-4 1-6 4-6 9ZM20 14c-4 3-6 6-6 9 4-1 6-4 6-9ZM44 14c4 3 6 6 6 9-4-1-6-4-6-9Z' },
    leaf:     { label: 'Leaf',     vb: '0 0 28 16',  ratio: 0.57, mode: 'fill',   d: 'M2 8c5-6 14-6 24 0-9 6-19 6-24 0Z' },
    star:     { label: 'Star',     vb: '0 0 24 24',  ratio: 1,    mode: 'fill',   d: 'M12 1.2 13.4 9.2 21.6 12 13.4 14.8 12 22.8 10.6 14.8 2.4 12 10.6 9.2Z' },
    diamond:  { label: 'Divider',  vb: '0 0 100 16', ratio: 0.16, mode: 'stroke', d: 'M2 8h38M60 8h38M50 2l6 6-6 6-6-6Z' },
    flourish: { label: 'Flourish', vb: '0 0 100 20', ratio: 0.2,  mode: 'stroke', d: 'M2 10c10-10 20 10 30 0s20-10 30 0 20 10 36 0' },
  };

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;
  const num = (v, d) => (v !== '' && v != null && Number.isFinite(+v) ? +v : d);
  const uid = () => `st-${Math.random().toString(36).slice(2, 9)}`;
  const $ = (sel, root = document) => root.querySelector(sel);

  function colorCss(v, fallback) {
    if (TOKEN_VAR[v]) return `var(${TOKEN_VAR[v]})`;
    if (typeof v === 'string' && HEX.test(v)) return v;
    return fallback || 'var(--inv-ink)';
  }

  /** Tiny DOM builder. Text is always set as text, never as HTML. */
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => { if (c != null && c !== false) n.append(c); });
    return n;
  }

  /* ═══════════════ 2. State access ═══════════════ */
  const invite = host.invite;
  const stage = $('.stage');
  const workspace = $('.workspace');

  const S = () => host.getStudio();
  const blankStudio = () => ({ version: 1, elements: [], sections: {}, order: [] });
  const isSecId = (id) => host.sections().some((x) => x.id === id);
  const findEl = (id) => S().elements.find((e) => e.id === id);
  const labelOf = (id) => {
    const sec = host.sections().find((x) => x.id === id);
    if (sec) return sec.label;
    const el = findEl(id);
    return el ? el.name : 'Element';
  };
  const customized = () => { const s = S(); return s.elements.length > 0 || Object.keys(s.sections).length > 0; };

  /** Make the stored state well-formed. Safe to run on every apply. */
  function normalize(s) {
    if (!Array.isArray(s.elements)) s.elements = [];
    if (!s.sections || typeof s.sections !== 'object') s.sections = {};
    if (!Array.isArray(s.order)) s.order = [];
    const secIds = host.sections().map((x) => x.id);
    Object.keys(s.sections).forEach((id) => {
      if (!secIds.includes(id) || !Object.keys(s.sections[id] || {}).length) delete s.sections[id];
    });
    const valid = new Set([...secIds, ...s.elements.map((e) => e.id)]);
    const seen = new Set();
    s.order = s.order.filter((id) => valid.has(id) && !seen.has(id) && seen.add(id));
    secIds.slice().reverse().forEach((id) => { if (!seen.has(id)) { s.order.unshift(id); seen.add(id); } });
    s.elements.forEach((e) => { if (!seen.has(e.id)) { s.order.push(e.id); seen.add(e.id); } });
  }

  let lastRef = null;       // identity of config.studio; changes on Reset to sample
  let active = false;
  let selId = null;
  let ui = null;            // Studio UI nodes, only while active
  let ctls = [];            // inspector controls that can refresh their own value
  let ctlSeq = 0;
  let gesture = null;
  let gid = 0;

  function target() {
    if (!selId) return null;
    if (isSecId(selId)) return { kind: 'sec', id: selId };
    const e = findEl(selId);
    return e ? { kind: 'el', id: selId, e } : null;
  }
  const nodeOf = (id) => (isSecId(id) ? host.sectionEl(id) : nodes.get(id));

  /* ═══════════════ 3. History (lightweight undo / redo of config.studio) ═══════════════ */
  const history = { undo: [], redo: [], t: 0, key: null };

  /** Call BEFORE mutating. Same key within 0.9s is coalesced (typing, nudging). */
  function checkpoint(key) {
    const now = Date.now();
    if (key && key === history.key && now - history.t < 900) { history.t = now; return; }
    history.undo.push(JSON.stringify(S()));
    if (history.undo.length > 60) history.undo.shift();
    history.redo.length = 0;
    history.key = key || null;
    history.t = now;
    updateHistoryButtons();
  }

  function replaceStudio(next) {
    host.setStudio(next);
    lastRef = next;
  }

  function undo() {
    const prev = history.undo.pop();
    if (prev == null) return;
    history.redo.push(JSON.stringify(S()));
    replaceStudio(JSON.parse(prev));
    history.key = null;
    applyNow({ mode: 'full' });
    host.announce('Undone.');
  }

  function redo() {
    const next = history.redo.pop();
    if (next == null) return;
    history.undo.push(JSON.stringify(S()));
    replaceStudio(JSON.parse(next));
    history.key = null;
    applyNow({ mode: 'full' });
    host.announce('Redone.');
  }

  function updateHistoryButtons() {
    if (!ui) return;
    ui.undo.disabled = !history.undo.length;
    ui.redo.disabled = !history.redo.length;
  }

  /* ═══════════════ 4. Rendering (state → DOM). Runs in normal mode too, so a saved design shows. ═══════════════ */
  const nodes = new Map();    // element id → DOM node
  let layer = null;

  function setUnit() {
    const w = invite.clientWidth;
    if (w > 0) invite.style.setProperty('--st-u', `${w / 100}px`);
  }

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = h('div', { class: 'studio-layer' });
    invite.append(layer);          // after the ambient layer; section reordering only touches the first children
    return layer;
  }

  function paintSection(node, o, z) {
    if (!node) return;
    const st = node.style;
    st.zIndex = z == null ? '' : String(z);
    const flags = ['stFont', 'stWeight', 'stAlign', 'stLetter', 'stLine', 'stColor', 'stHidden', 'stXf'];
    const vars = ['--st-font', '--st-weight', '--st-letter', '--st-line', '--st-color'];
    if (!o) {
      st.transform = '';
      st.marginTop = '';
      st.marginBottom = '';
      vars.forEach((p) => st.removeProperty(p));
      flags.forEach((k) => { delete node.dataset[k]; });
      return;
    }
    const dx = num(o.dx, 0), dy = num(o.dy, 0), sc = num(o.scale, 1);
    if (dx || dy || sc !== 1) {
      st.transform = `translate(calc(var(--st-u) * ${dx}), calc(var(--st-u) * ${dy})) scale(${sc})`;
      node.dataset.stXf = '1';
    } else {
      st.transform = '';
      delete node.dataset.stXf;
    }
    st.marginTop = o.mt ? `calc(var(--st-u) * ${num(o.mt, 0)})` : '';
    st.marginBottom = o.mb ? `calc(var(--st-u) * ${num(o.mb, 0)})` : '';
    if (o.hidden) node.dataset.stHidden = '1'; else delete node.dataset.stHidden;
    if (FONTS[o.fontFamily]) { node.dataset.stFont = '1'; st.setProperty('--st-font', FONTS[o.fontFamily].stack); }
    else { delete node.dataset.stFont; st.removeProperty('--st-font'); }
    if (WEIGHTS.includes(+o.weight)) { node.dataset.stWeight = '1'; st.setProperty('--st-weight', String(+o.weight)); }
    else { delete node.dataset.stWeight; st.removeProperty('--st-weight'); }
    if (ALIGNS.includes(o.align)) node.dataset.stAlign = o.align; else delete node.dataset.stAlign;
    if (o.letter != null) { node.dataset.stLetter = '1'; st.setProperty('--st-letter', `${num(o.letter, 0)}em`); }
    else { delete node.dataset.stLetter; st.removeProperty('--st-letter'); }
    if (o.line != null) { node.dataset.stLine = '1'; st.setProperty('--st-line', String(num(o.line, 1.4))); }
    else { delete node.dataset.stLine; st.removeProperty('--st-line'); }
    if (o.color) { node.dataset.stColor = '1'; st.setProperty('--st-color', colorCss(o.color)); }
    else { delete node.dataset.stColor; st.removeProperty('--st-color'); }
  }

  function buildInner(n, e) {
    if (e.type === 'text') n.append(h('div', { class: 'st-text' }));
    else if (e.type === 'image') n.append(h('div', { class: 'st-image' }, h('img', { alt: '', decoding: 'async' })));
    else if (e.type === 'shape') n.append(h('div', { class: 'st-shape' }));
    else if (e.type === 'decor') n.append(h('div', { class: 'st-decor', 'aria-hidden': 'true' }));
  }

  function paintElement(n, e, z) {
    n.dataset.stType = e.type;
    if (e.visible === false) n.dataset.hidden = '1'; else delete n.dataset.hidden;
    n.style.left = `${round(num(e.x, 0))}%`;
    n.style.top = `${round(num(e.y, 0))}%`;
    n.style.width = `calc(var(--st-u) * ${round(num(e.w, 20))})`;
    n.style.height = e.type === 'text' ? 'auto' : `calc(var(--st-u) * ${round(num(e.h, 10))})`;
    n.style.opacity = String(clamp(num(e.opacity, 100), 0, 100) / 100);
    n.style.zIndex = String(z);
    const inner = n.firstChild;
    if (e.type === 'text') {
      const st = e.style || {};
      inner.textContent = e.content || '';
      Object.assign(inner.style, {
        fontFamily: (FONTS[st.fontFamily] || FONTS.cormorant).stack,
        fontSize: `calc(var(--st-u) * ${num(st.fontSize, 6)})`,
        fontWeight: String(num(st.weight, 500)),
        fontStyle: st.italic ? 'italic' : 'normal',
        textAlign: ALIGNS.includes(st.align) ? st.align : 'center',
        letterSpacing: `${num(st.letter, 0)}em`,
        lineHeight: String(num(st.line, 1.2)),
        color: colorCss(st.color, 'var(--inv-ink)'),
        textTransform: st.upper ? 'uppercase' : 'none',
      });
    } else if (e.type === 'image') {
      const photo = host.photos().find((p) => p.id === e.photoId);
      const img = inner.firstChild;
      const ox = clamp(num(e.objX, 50), 0, 100), oy = clamp(num(e.objY, 50), 0, 100);
      if (photo) {
        if (img.getAttribute('src') !== photo.previewUrl) img.src = photo.previewUrl;
        img.alt = photo.label;
        delete n.dataset.empty;
      } else {
        img.removeAttribute('src');
        img.alt = '';
        n.dataset.empty = '1';
      }
      img.style.objectPosition = `${ox}% ${oy}%`;
      img.style.transformOrigin = `${ox}% ${oy}%`;
      img.style.transform = `scale(${clamp(num(e.zoom, 1), 1, 4)})`;
      inner.style.borderRadius = `calc(var(--st-u) * ${num(e.radius, 0)})`;
    } else if (e.type === 'shape') {
      inner.style.background = e.fill && e.fill !== 'none' ? colorCss(e.fill, 'var(--inv-accent)') : 'transparent';
      inner.style.border = e.stroke ? `calc(var(--st-u) * ${num(e.strokeW, 0.3)}) solid ${colorCss(e.stroke)}` : '0 none';
      inner.style.borderRadius = e.shape === 'ellipse' ? '50%' : e.shape === 'line' ? '999px' : `calc(var(--st-u) * ${num(e.radius, 0)})`;
    } else if (e.type === 'decor') {
      const d = DECOR[e.decor] || DECOR.sprig;
      const key = e.decor in DECOR ? e.decor : 'sprig';
      if (inner.dataset.decor !== key) {
        inner.dataset.decor = key;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', d.vb);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d.d);
        if (d.mode === 'stroke') {
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', 'currentColor');
          path.setAttribute('stroke-width', '1.1');
          path.setAttribute('stroke-linecap', 'round');
        } else {
          path.setAttribute('fill', 'currentColor');
        }
        svg.append(path);
        inner.replaceChildren(svg);
      }
      n.style.color = colorCss(e.color, 'var(--inv-accent)');
    }
  }

  function renderElements(s) {
    if (!s.elements.length) {
      if (layer) { layer.remove(); layer = null; }
      nodes.clear();
      return;
    }
    const L = ensureLayer();
    const ids = new Set(s.elements.map((e) => e.id));
    nodes.forEach((n, id) => { if (!ids.has(id)) { n.remove(); nodes.delete(id); } });
    s.elements.forEach((e) => {
      let n = nodes.get(e.id);
      if (!n) {
        n = h('div', { class: 'st-el', dataset: { stId: e.id } });
        buildInner(n, e);
        nodes.set(e.id, n);
        L.append(n);
      }
      paintElement(n, e, Z_BASE + s.order.indexOf(e.id));
    });
  }

  /** mode: 'drag' (cheap, during a gesture) · 'values' (default) · 'full' (rebuild inspector too) */
  function applyNow(opts) {
    const s = S();
    if (!s) return;
    const mode = (opts && opts.mode) || 'values';
    if (s !== lastRef) {          // the invitation was reset: Studio history belongs to the old invitation
      lastRef = s;
      history.undo.length = 0;
      history.redo.length = 0;
      selId = null;
    }
    normalize(s);
    setUnit();
    const custom = customized();
    host.sections().forEach((x) => {
      paintSection(host.sectionEl(x.id), s.sections[x.id], custom ? Z_BASE + s.order.indexOf(x.id) : null);
    });
    const ambient = $('.ambient', invite);
    if (ambient) ambient.style.zIndex = custom ? String(Z_BASE + s.order.length) : '';
    renderElements(s);

    if (!active || !ui) return;
    if (selId && !target()) selId = null;
    if (mode !== 'drag') renderLayers();
    if (mode === 'full') renderInspector();
    else refreshCtls();
    updateAddState();
    updateHistoryButtons();
    placeSelection();
  }

  let rafId = 0;
  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; applyNow(); });
  }

  /* ═══════════════ 5. Editing operations ═══════════════ */
  function writeRaw(t, k, v, scope) {
    if (t.kind === 'sec') {
      const s = S();
      let o = s.sections[t.id];
      if (v === undefined || v === null || v === SEC_DEFAULT[k]) {
        if (o) { delete o[k]; if (!Object.keys(o).length) delete s.sections[t.id]; }
        return;
      }
      if (!o) o = s.sections[t.id] = {};
      o[k] = v;
    } else if (scope === 'style') {
      if (!t.e.style) t.e.style = {};
      if (v === undefined) delete t.e.style[k]; else t.e.style[k] = v;
    } else if (v === undefined) {
      delete t.e[k];
    } else {
      t.e[k] = v;
    }
  }

  function read(k, scope) {
    const t = target();
    if (!t) return undefined;
    if (t.kind === 'sec') { const o = S().sections[t.id]; return o ? o[k] : undefined; }
    return scope === 'style' ? (t.e.style || {})[k] : t.e[k];
  }

  function commitProp(k, v, scope, key) {
    const t = target();
    if (!t) return;
    checkpoint(key || `p:${t.id}:${k}`);
    writeRaw(t, k, v, scope);
    applyNow();
  }

  function select(id) {
    if (selId === id) return;
    selId = id;
    applyNow({ mode: 'full' });
    if (studioAccess().mobile) setSheet('edit');
    if (target()) host.announce(`${labelOf(id)} selected.`);
  }

  function deselect() {
    if (!selId) return;
    selId = null;
    applyNow({ mode: 'full' });
  }

  function makeElement(type, variant) {
    const count = S().elements.filter((e) => e.type === type).length + 1;
    const base = { id: uid(), type, visible: true, opacity: 100 };
    if (type === 'text') {
      return { ...base, name: `Text ${count}`, x: 15, y: 40, w: 70, h: 0, content: 'Your text here',
        style: { fontFamily: 'cormorant', fontSize: 6, weight: 500, italic: false, align: 'center', letter: 0, line: 1.2, color: 'ink', upper: false } };
    }
    if (type === 'image') {
      const p = host.photos()[0];
      return { ...base, name: `Image ${count}`, x: 25, y: 30, w: 50, h: 60, photoId: p ? p.id : null, objX: 50, objY: 50, zoom: 1, radius: 0 };
    }
    if (type === 'shape') {
      const v = SHAPE_LABEL[variant] ? variant : 'rect';
      const geo = v === 'line' ? { x: 30, y: 50, w: 40, h: 0.3 } : v === 'ellipse' ? { x: 35, y: 40, w: 30, h: 30 } : { x: 30, y: 45, w: 40, h: 16 };
      return { ...base, name: `${SHAPE_LABEL[v]} ${count}`, shape: v, ...geo, fill: 'accent', stroke: null, strokeW: 0.3, radius: 0 };
    }
    const key = DECOR[variant] ? variant : 'sprig';
    const w = key === 'star' ? 10 : 50;
    return { ...base, name: `${DECOR[key].label} ${count}`, decor: key, x: (100 - w) / 2, y: 45, w, h: round(w * DECOR[key].ratio), color: 'accent' };
  }

  function addElement(type, variant) {
    const caps = studioAccess().caps;
    if (type === 'text' && !caps.text) return;
    if (type === 'image' && (!caps.image || !host.photos().length)) return;
    if (type === 'shape' && !caps.shapes) return;
    if (type === 'decor' && !caps.decor) return;
    checkpoint();
    const e = makeElement(type, variant);
    S().elements.push(e);
    S().order.push(e.id);
    selId = e.id;
    applyNow({ mode: 'full' });
    host.announce(`${e.name} added.`);
  }

  function duplicateSelected() {
    const t = target();
    if (!t || t.kind !== 'el') return;
    checkpoint();
    const copy = JSON.parse(JSON.stringify(t.e));
    copy.id = uid();
    copy.name = `${t.e.name} copy`;
    copy.x = round(num(copy.x, 0) + 3);
    copy.y = round(num(copy.y, 0) + 3);
    S().elements.push(copy);
    S().order.push(copy.id);
    selId = copy.id;
    applyNow({ mode: 'full' });
    host.announce(`${t.e.name} duplicated.`);
  }

  function deleteSelected() {
    const t = target();
    if (!t || t.kind !== 'el') return;
    checkpoint();
    const s = S();
    s.elements = s.elements.filter((e) => e.id !== t.id);
    selId = null;
    applyNow({ mode: 'full' });
    host.announce(`${t.e.name} deleted.`);
  }

  function resetSection() {
    const t = target();
    if (!t || t.kind !== 'sec') return;
    checkpoint();
    delete S().sections[t.id];
    applyNow({ mode: 'full' });
    host.announce(`${labelOf(t.id)} reset.`);
  }

  function toggleVisible(id) {
    checkpoint();
    if (isSecId(id)) {
      const o = S().sections[id];
      writeRaw({ kind: 'sec', id }, 'hidden', o && o.hidden ? undefined : true);
    } else {
      const e = findEl(id);
      if (e) e.visible = e.visible === false;
    }
    applyNow({ mode: 'full' });
  }

  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  /** Layer ordering. Forward/backward jump past the next layer that actually overlaps, so a click always does something visible. */
  function moveLayer(how) {
    const id = selId;
    const o = S().order;
    const i = o.indexOf(id);
    if (i < 0) return;
    let j;
    if (how === 'front') j = o.length - 1;
    else if (how === 'back') j = 0;
    else {
      const dir = how === 'forward' ? 1 : -1;
      const mine = nodeOf(id);
      const r = mine && mine.getClientRects().length ? mine.getBoundingClientRect() : null;
      j = clamp(i + dir, 0, o.length - 1);
      for (let k = i + dir; k >= 0 && k < o.length; k += dir) {
        const other = nodeOf(o[k]);
        if (r && other && other.getClientRects().length && overlaps(r, other.getBoundingClientRect())) { j = k; break; }
      }
    }
    if (j === i) return;
    checkpoint();
    o.splice(i, 1);
    o.splice(j, 0, id);
    applyNow({ mode: 'full' });
    host.announce(`${labelOf(id)} moved to layer ${o.length - j} of ${o.length}.`);
  }

  function nudge(dx, dy, big) {
    const t = target();
    if (!t) return;
    const step = big ? 2 : 0.5;
    checkpoint(`nudge:${t.id}`);
    if (t.kind === 'sec') {
      const o = S().sections[t.id] || {};
      const nx = round(num(o.dx, 0) + dx * step), ny = round(num(o.dy, 0) + dy * step);
      writeRaw(t, 'dx', nx);
      writeRaw(t, 'dy', ny);
    } else {
      t.e.x = round(num(t.e.x, 0) + dx * step);
      t.e.y = round(num(t.e.y, 0) + dy * step);
    }
    applyNow();
  }

  /* ═══════════════ 6. Pointer gestures: move & resize ═══════════════ */
  const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function snapshotOf(t) {
    if (t.kind === 'sec') {
      const o = S().sections[t.id] || {};
      return { dx: num(o.dx, 0), dy: num(o.dy, 0), scale: num(o.scale, 1) };
    }
    const e = t.e;
    return { x: num(e.x, 0), y: num(e.y, 0), w: num(e.w, 10), h: num(e.h, 10), fs: num(e.style && e.style.fontSize, 6) };
  }

  function beginGesture(type, e, extra) {
    const t = target();
    if (!t) return;
    const r = invite.getBoundingClientRect();
    const node = nodeOf(t.id);
    const nr = node ? node.getBoundingClientRect() : r;
    const cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
    gesture = {
      type, id: t.id, sx: e.clientX, sy: e.clientY, W: r.width || 1, H: r.height || 1, u: (r.width || 100) / 100,
      started: false, key: `g${++gid}`, t0: snapshotOf(t), cx, cy,
      d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, ...extra,
    };
    document.addEventListener('pointermove', onGestureMove);
    document.addEventListener('pointerup', endGesture);
    document.addEventListener('pointercancel', endGesture);
    document.body.classList.add('studio-dragging');
  }

  function showGuide(on) {
    if (!ui) return;
    ui.guide.hidden = !on;
    if (!on) return;
    const ir = invite.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    ui.guide.style.left = `${ir.left - sr.left - stage.clientLeft + ir.width / 2}px`;
    ui.guide.style.top = `${ir.top - sr.top - stage.clientTop}px`;
    ui.guide.style.height = `${ir.height}px`;
  }

  function onGestureMove(e) {
    const g = gesture;
    if (!g) return;
    const t = target();
    if (!t || t.id !== g.id) return;
    const dxPx = e.clientX - g.sx, dyPx = e.clientY - g.sy;
    if (!g.started) {
      if (Math.hypot(dxPx, dyPx) < 3) return;
      g.started = true;
      checkpoint(g.key);
    }
    const a = g.t0;
    if (g.type === 'move') {
      if (t.kind === 'sec') {
        writeRaw(t, 'dx', round(clamp(a.dx + dxPx / g.u, -150, 150)));
        writeRaw(t, 'dy', round(clamp(a.dy + dyPx / g.u, -150, 150)));
      } else {
        let x = a.x + (dxPx / g.W) * 100;
        const y = a.y + (dyPx / g.H) * 100;
        let snapped = false;
        if (!e.altKey && Math.abs(x + a.w / 2 - 50) < 1.5) { x = 50 - a.w / 2; snapped = true; }
        t.e.x = round(clamp(x, -(a.w - 6), 94));
        t.e.y = round(clamp(y, -4, 98));
        showGuide(snapped);
      }
    } else if (t.kind === 'sec') {
      const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      writeRaw(t, 'scale', round(clamp(a.scale * (dist / g.d0), 0.3, 3)));
    } else {
      resizeElement(t.e, g, e, dxPx, dyPx);
    }
    applyNow({ mode: 'drag' });
  }

  function resizeElement(el, g, e, dxPx, dyPx) {
    const a = g.t0, dir = g.dir, dxU = dxPx / g.u, dyU = dyPx / g.u;
    const isText = el.type === 'text';
    const minW = 2, minH = el.shape === 'line' ? 0.1 : 2;
    let { x, y, w, h } = a;
    if (dir.includes('e')) w = Math.max(minW, a.w + dxU);
    if (dir.includes('w')) { w = Math.max(minW, a.w - dxU); x = a.x + (a.w - w); }
    if (!isText) {
      if (dir.includes('s')) h = Math.max(minH, a.h + dyU);
      if (dir.includes('n')) { h = Math.max(minH, a.h - dyU); y = a.y + ((a.h - h) * g.u / g.H) * 100; }
      if (e.shiftKey && dir.length === 2 && a.w > 0 && a.h > 0) {
        h = Math.max(minH, w * (a.h / a.w));
        if (dir.includes('n')) y = a.y + ((a.h - h) * g.u / g.H) * 100;
      }
      el.h = round(h);
    }
    el.x = round(x);
    el.y = round(y);
    el.w = round(w);
    if (isText && dir.length === 2) {
      if (!el.style) el.style = {};
      el.style.fontSize = round(clamp(a.fs * (w / a.w), 1, 30));
    }
  }

  function endGesture() {
    const g = gesture;
    if (!g) return;
    gesture = null;
    document.removeEventListener('pointermove', onGestureMove);
    document.removeEventListener('pointerup', endGesture);
    document.removeEventListener('pointercancel', endGesture);
    document.body.classList.remove('studio-dragging');
    showGuide(false);
    if (g.started) {
      applyNow({ mode: 'full' });
      host.announce(`${labelOf(g.id)} ${g.type === 'move' ? 'moved' : 'resized'}.`);
    }
  }

  /* Stage listeners — all of them ignore events unless Studio is open and not in guest view. */
  const isGuest = () => document.body.dataset.view === 'guest';
  const uiActive = () => active && !!ui && !isGuest();

  function onStagePointerDown(e) {
    if (!uiActive() || e.button !== 0) return;
    const handle = e.target.closest('.studio-handle');
    if (handle) {
      e.preventDefault();
      beginGesture('resize', e, { dir: handle.dataset.dir });
      return;
    }
    const elNode = e.target.closest('.st-el');
    const secNode = e.target.closest('[data-section-el]');
    if (elNode && invite.contains(elNode)) {
      e.preventDefault();
      if (selId !== elNode.dataset.stId) select(elNode.dataset.stId);
      beginGesture('move', e);
    } else if (secNode && invite.contains(secNode)) {
      e.preventDefault();
      if (selId !== secNode.dataset.sectionEl) select(secNode.dataset.sectionEl);
      beginGesture('move', e);
    } else if (!e.target.closest('button, a, input, select, textarea') && !e.target.closest('.studio-overlay')) {
      deselect();
    }
  }

  /** Inside the invitation, clicks only select. Links, gallery buttons and the like stay inert while designing. */
  function onStageClick(e) {
    if (!uiActive() || !invite.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onStageDblClick(e) {
    if (!uiActive()) return;
    const n = e.target.closest('.st-el[data-st-type="text"]');
    if (!n) return;
    const area = ui.inspector.querySelector('textarea');
    if (area) { area.focus(); area.select(); }
  }

  function onKeyDown(e) {
    if (!uiActive()) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select');
    const mod = e.ctrlKey || e.metaKey;
    if (typing) return;
    if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
    if (mod && e.code === 'KeyD') { e.preventDefault(); duplicateSelected(); return; }
    if (!selId) return;
    if (e.key === 'Escape') { deselect(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && !e.target.closest('button')) { e.preventDefault(); nudge(arrows[e.key][0], arrows[e.key][1], e.shiftKey); }
  }

  /* ═══════════════ 7. Selection overlay (lives in the editor stage, never in the invitation) ═══════════════ */
  function placeSelection() {
    if (!ui) return;
    const box = ui.sel;
    const t = uiActive() ? target() : null;
    const n = t ? nodeOf(t.id) : null;
    if (!t || !n || !n.isConnected || !n.getClientRects().length) { box.hidden = true; return; }
    const r = n.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    Object.assign(box.style, {
      left: `${r.left - sr.left - stage.clientLeft}px`,
      top: `${r.top - sr.top - stage.clientTop}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    let allowed = HANDLE_DIRS;
    if (t.kind === 'sec') allowed = ['nw', 'ne', 'sw', 'se'];
    else if (t.e.type === 'text') allowed = ['nw', 'ne', 'sw', 'se', 'e', 'w'];
    else if (t.e.shape === 'line') allowed = ['e', 'w'];
    if (studioAccess().mobile) allowed = allowed.filter((d) => ['nw', 'ne', 'sw', 'se'].includes(d));
    box.querySelectorAll('.studio-handle').forEach((hd) => { hd.hidden = !allowed.includes(hd.dataset.dir); });
    ui.tag.textContent = labelOf(t.id);
    box.hidden = false;
  }

  function studioAccess() {
    if (host.studioAccess) return host.studioAccess();
    return { level: 'full', mobile: window.matchMedia('(max-width: 760px)').matches, caps: { move: true, resize: true, layers: true, typography: 'full', image: true, decor: true, shapes: true, text: true } };
  }

  function setSheet(which) {
    if (!ui) return;
    const layersOn = which !== 'edit';
    ui.panel.dataset.sheet = layersOn ? 'on' : 'off';
    ui.inspector.dataset.sheet = layersOn ? 'off' : 'on';
    if (ui.layersTab) ui.layersTab.setAttribute('aria-pressed', String(layersOn));
    if (ui.editTab) ui.editTab.setAttribute('aria-pressed', String(!layersOn));
  }

  function applyCaps() {
    const access = studioAccess();
    document.body.dataset.studioMode = access.mobile ? 'mobile' : 'desktop';
    document.body.dataset.studioLevel = access.level || 'none';
    if (!ui) return;
    ui.panel.querySelectorAll('[data-cap]').forEach((node) => {
      node.hidden = !access.caps[node.dataset.cap];
    });
    if (ui.tabs) ui.tabs.hidden = !access.mobile;
    if (access.mobile) setSheet(selId ? 'edit' : 'layers');
    else {
      ui.panel.dataset.sheet = 'on';
      ui.inspector.dataset.sheet = 'on';
    }
  }

  /* ═══════════════ 8. Studio UI ═══════════════ */
  function buildUI() {
    const undoBtn = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Undo', title: 'Undo (Ctrl/Cmd+Z)', onclick: undo });
    const redoBtn = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Redo', title: 'Redo (Ctrl/Cmd+Shift+Z)', onclick: redo });
    const previewBtn = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Guest preview', onclick: () => { const b = $('#guest-preview-btn'); if (b) b.click(); } });
    const exitBtn = h('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Exit Studio', onclick: close });
    const layersTab = h('button', { class: 'studio-tab', type: 'button', text: 'Layers', 'aria-pressed': 'true', onclick: () => setSheet('layers') });
    const editTab = h('button', { class: 'studio-tab', type: 'button', text: 'Edit', 'aria-pressed': 'false', onclick: () => setSheet('edit') });
    const tabs = h('div', { class: 'studio-tabs', role: 'tablist', 'aria-label': 'Studio panels' }, layersTab, editTab);
    const bar = h('div', { class: 'studio-bar', role: 'toolbar', 'aria-label': 'Studio' },
      h('div', { class: 'studio-bar-left' }, h('span', { class: 'studio-bar-brand', text: 'Celesticate Moments' }), h('span', { class: 'studio-pill', text: 'Studio' })),
      tabs,
      h('div', { class: 'studio-bar-group' }, undoBtn, redoBtn),
      h('div', { class: 'studio-bar-group' }, previewBtn, exitBtn));

    // Left panel: add + layers
    const addGroups = [
      ['Content', [['Text', () => addElement('text')]], 'text'],
      ['Image', [['Image', () => addElement('image'), true]], 'image'],
      ['Shapes', [['Rectangle', () => addElement('shape', 'rect')], ['Ellipse', () => addElement('shape', 'ellipse')], ['Line', () => addElement('shape', 'line')]], 'shapes'],
      ['Decorative', Object.entries(DECOR).map(([k, d]) => [d.label, () => addElement('decor', k)]), 'decor'],
    ];
    const addButtons = [];
    const addCard = h('section', { class: 'card studio-card', 'aria-labelledby': 'st-add' },
      h('div', { class: 'card-header' }, h('h2', { class: 'card-title', id: 'st-add', text: 'Add' })),
      h('div', { class: 'card-body' }, addGroups.map(([title, items, cap]) => h('div', { class: 'studio-add-group', dataset: { cap } },
        h('p', { class: 'label', text: title }),
        h('div', { class: 'studio-add' }, items.map(([label, run, needsPhoto]) => {
          const b = h('button', { class: 'move-btn', type: 'button', text: label, onclick: run });
          if (needsPhoto) addButtons.push(b);
          return b;
        }))))));
    const layers = h('ul', { class: 'studio-layers', 'aria-label': 'Layers, top first' });
    const layersCard = h('section', { class: 'card studio-card', 'aria-labelledby': 'st-layers' },
      h('div', { class: 'card-header' }, h('h2', { class: 'card-title', id: 'st-layers', text: 'Layers' }), h('p', { class: 'card-note', text: 'Top of the list is in front.' })),
      h('div', { class: 'card-body' }, layers));

    const clearBtn = h('button', { class: 'btn-link', type: 'button', text: 'Clear all Studio edits' });
    let armedTimer = null;
    const disarm = () => { clearTimeout(armedTimer); clearBtn.removeAttribute('data-armed'); clearBtn.textContent = 'Clear all Studio edits'; };
    clearBtn.addEventListener('click', () => {
      if (clearBtn.dataset.armed) {
        disarm();
        checkpoint();
        replaceStudio(blankStudio());
        selId = null;
        applyNow({ mode: 'full' });
        host.announce('All Studio edits cleared.');
        return;
      }
      clearBtn.dataset.armed = '1';
      clearBtn.textContent = 'Confirm: clear everything';
      armedTimer = setTimeout(disarm, 4000);
    });
    clearBtn.addEventListener('blur', disarm);

    const panel = h('aside', { class: 'studio-panel', 'aria-label': 'Studio tools' },
      h('div', { class: 'studio-panel-head' },
        h('h1', { class: 'studio-title', text: 'Design' }),
        h('p', { class: 'studio-sub', text: 'Click an element to move or resize it. Arrow keys nudge, Delete removes.' })),
      addCard, layersCard,
      h('div', { class: 'studio-foot' }, clearBtn));

    const inspector = h('aside', { class: 'studio-inspector', 'aria-label': 'Studio inspector' });

    const tag = h('span', { class: 'studio-sel-tag' });
    const sel = h('div', { class: 'studio-sel', hidden: true }, tag, HANDLE_DIRS.map((d) => h('span', { class: 'studio-handle', dataset: { dir: d } })));
    const guide = h('div', { class: 'studio-guide', hidden: true });
    const overlay = h('div', { class: 'studio-overlay', 'aria-hidden': 'true' }, sel, guide);

    document.body.insertBefore(bar, workspace);
    workspace.append(panel, inspector);
    stage.append(overlay);
    ui = { bar, panel, inspector, overlay, sel, tag, guide, layers, undo: undoBtn, redo: redoBtn, exit: exitBtn, addButtons, tabs, layersTab, editTab };
  }

  function destroyUI() {
    if (!ui) return;
    [ui.bar, ui.panel, ui.inspector, ui.overlay].forEach((n) => n.remove());
    ui = null;
    ctls = [];
  }

  function updateAddState() {
    const has = host.photos().length > 0;
    ui.addButtons.forEach((b) => {
      b.disabled = !has;
      b.title = has ? '' : 'Upload photos in the normal editor first. Studio reuses them.';
    });
  }

  function renderLayers() {
    const s = S(), secs = host.sections();
    ui.layers.replaceChildren();
    [...s.order].reverse().forEach((id) => {
      const sec = secs.find((x) => x.id === id);
      const el = sec ? null : findEl(id);
      if (!sec && !el) return;
      const label = sec ? sec.label : el.name;
      const visible = sec ? !(s.sections[id] && s.sections[id].hidden) : el.visible !== false;
      const typeText = sec ? (sec.shown ? 'Section' : 'Section · not shown') : TYPE_LABEL[el.type];
      const pick = h('button', { class: 'studio-layer-pick', type: 'button', 'aria-pressed': String(id === selId), onclick: () => select(id) },
        h('span', { class: 'studio-layer-name', text: label }),
        h('span', { class: 'studio-layer-type', text: typeText }));
      const eye = h('button', { class: 'move-btn studio-eye', type: 'button', 'aria-pressed': String(visible), 'aria-label': `${visible ? 'Hide' : 'Show'} ${label}`, text: visible ? 'Hide' : 'Show', onclick: () => toggleVisible(id) });
      ui.layers.append(h('li', { class: `studio-layer-row${id === selId ? ' is-selected' : ''}${visible ? '' : ' is-off'}` }, pick, eye));
    });
  }

  /* ── Inspector controls ── */
  const refreshCtls = () => ctls.forEach((c) => c.refresh());

  function field(label, control, id) {
    return h('div', { class: 'studio-field' }, h('label', { class: 'studio-label', for: id, text: label }), control);
  }
  const group = (title, ...kids) => h('section', { class: 'studio-group' }, h('h3', { class: 'studio-group-title', text: title }), ...kids);
  const nextId = () => `st-f-${++ctlSeq}`;

  function numberCtl(label, k, o = {}) {
    const id = nextId();
    const input = h('input', { class: 'input studio-input', id, type: 'number', step: String(o.step || 0.5), inputmode: 'decimal' });
    if (o.min != null) input.min = String(o.min);
    if (o.max != null) input.max = String(o.max);
    const refresh = () => {
      if (document.activeElement === input) return;
      const v = read(k, o.scope);
      input.value = v == null || v === '' ? String(o.def ?? '') : String(round(v));
    };
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v)) return;
      commitProp(k, clamp(v, o.min ?? -1e4, o.max ?? 1e4), o.scope, `in:${selId}:${k}`);
    });
    ctls.push({ refresh });
    refresh();
    return field(label, input, id);
  }

  function rangeCtl(label, k, o = {}) {
    const id = nextId();
    const input = h('input', { class: 'studio-range', id, type: 'range', min: String(o.min), max: String(o.max), step: String(o.step || 1) });
    const out = h('span', { class: 'studio-out' });
    const reset = o.clearable ? h('button', { class: 'btn-link studio-reset', type: 'button', text: 'Default', onclick: () => commitProp(k, undefined, o.scope) }) : null;
    const refresh = () => {
      const v = read(k, o.scope);
      const shown = v == null ? o.def : v;
      input.value = String(shown);
      out.textContent = v == null && o.clearable ? 'Default' : `${round(shown)}${o.unit || ''}`;
      if (reset) reset.hidden = v == null;
    };
    input.addEventListener('input', () => commitProp(k, parseFloat(input.value), o.scope, `in:${selId}:${k}`));
    ctls.push({ refresh });
    refresh();
    return field(label, h('div', { class: 'studio-range-row' }, input, out, reset), id);
  }

  function selectCtl(label, k, options, o = {}) {
    const id = nextId();
    const input = h('select', { class: 'input input-select studio-input', id }, options.map((op) => h('option', { value: String(op.value), text: op.label })));
    const refresh = () => {
      const v = read(k, o.scope);
      input.value = v == null ? '' : String(v);
      if (input.value !== (v == null ? '' : String(v))) input.value = '';
    };
    input.addEventListener('change', () => {
      const raw = input.value;
      commitProp(k, raw === '' ? undefined : (o.numeric ? parseFloat(raw) : raw), o.scope);
    });
    ctls.push({ refresh });
    refresh();
    return field(label, input, id);
  }

  function segCtl(label, k, options, o = {}) {
    const btns = options.map((op) => h('button', { class: 'move-btn studio-seg', type: 'button', text: op.label, 'aria-pressed': 'false', onclick: () => {
      const cur = read(k, o.scope);
      commitProp(k, o.clearable && cur === op.value ? undefined : op.value, o.scope);
    } }));
    const refresh = () => { const v = read(k, o.scope); btns.forEach((b, i) => b.setAttribute('aria-pressed', String(v === options[i].value))); };
    ctls.push({ refresh });
    refresh();
    return h('div', { class: 'studio-field' }, h('span', { class: 'studio-label', text: label }), h('div', { class: 'studio-segs', role: 'group', 'aria-label': label }, btns));
  }

  function checkCtl(label, k, o = {}) {
    const id = nextId();
    const input = h('input', { type: 'checkbox', id });
    const refresh = () => {
      const v = read(k, o.scope);
      input.checked = o.invert ? !v : (v == null ? !!o.def : !!v);
    };
    input.addEventListener('change', () => {
      const val = o.invert ? (input.checked ? undefined : true) : input.checked;
      commitProp(k, val, o.scope);
    });
    ctls.push({ refresh });
    refresh();
    return h('label', { class: 'studio-check', for: id }, input, h('span', { text: label }));
  }

  function textCtl(label, k, o = {}) {
    const id = nextId();
    const input = o.area
      ? h('textarea', { class: 'input input-area studio-input', id, rows: '3', maxlength: String(o.max || 280) })
      : h('input', { class: 'input studio-input', id, type: 'text', maxlength: String(o.max || 60), autocomplete: 'off' });
    const refresh = () => { if (document.activeElement !== input) input.value = String(read(k, o.scope) ?? ''); };
    input.addEventListener('input', () => commitProp(k, input.value, o.scope, `in:${selId}:${k}`));
    ctls.push({ refresh });
    refresh();
    return field(label, input, id);
  }

  function resolvedToken(token) {
    const v = getComputedStyle(invite).getPropertyValue(TOKEN_VAR[token]).trim();
    return HEX.test(v) ? v : '#888888';
  }

  function colorCtl(label, k, o = {}) {
    const swatches = Object.keys(TOKEN_VAR).map((token) => h('button', { class: 'studio-swatch', type: 'button', 'aria-label': `${label}: ${TOKEN_LABEL[token]}`, title: TOKEN_LABEL[token], 'aria-pressed': 'false', onclick: () => commitProp(k, token, o.scope) }));
    const custom = h('input', { class: 'studio-color', type: 'color', 'aria-label': `${label}: custom color` });
    custom.addEventListener('input', () => commitProp(k, custom.value.toUpperCase(), o.scope, `in:${selId}:${k}`));
    const none = o.allowNone || o.clearable
      ? h('button', { class: 'btn-link studio-reset', type: 'button', text: o.allowNone ? 'None' : 'Default', onclick: () => commitProp(k, o.allowNone ? null : undefined, o.scope) })
      : null;
    const refresh = () => {
      const v = read(k, o.scope);
      Object.keys(TOKEN_VAR).forEach((token, i) => {
        swatches[i].style.background = resolvedToken(token);
        swatches[i].setAttribute('aria-pressed', String(v === token));
      });
      custom.value = HEX.test(v || '') ? v.toLowerCase() : (TOKEN_VAR[v] ? resolvedToken(v).toLowerCase() : '#000000');
    };
    ctls.push({ refresh });
    refresh();
    return h('div', { class: 'studio-field' }, h('span', { class: 'studio-label', text: label }), h('div', { class: 'studio-swatches', role: 'group', 'aria-label': label }, swatches, custom, none));
  }

  function arrangeCtl() {
    const mk = (text, how) => h('button', { class: 'move-btn', type: 'button', text, onclick: () => moveLayer(how) });
    const front = mk('To front', 'front'), fwd = mk('Forward', 'forward'), back = mk('Backward', 'backward'), toBack = mk('To back', 'back');
    const info = h('p', { class: 'studio-hint' });
    const refresh = () => {
      const o = S().order, i = o.indexOf(selId);
      front.disabled = fwd.disabled = i === o.length - 1;
      back.disabled = toBack.disabled = i <= 0;
      info.textContent = i < 0 ? '' : `Layer ${o.length - i} of ${o.length} from the front`;
    };
    ctls.push({ refresh });
    refresh();
    return h('div', { class: 'studio-field' }, h('div', { class: 'studio-segs studio-segs-4' }, front, fwd, back, toBack), info);
  }

  function typographyGroup(t) {
    const isEl = t.kind === 'el';
    const sc = isEl ? 'style' : undefined;
    const access = studioAccess();
    const advanced = access.caps.typography === 'full' && !access.mobile;
    const fontOpts = Object.entries(FONTS).map(([v, f]) => ({ value: v, label: f.label }));
    const kids = [
      selectCtl('Font', 'fontFamily', [...(isEl ? [] : [{ value: '', label: 'Template default' }]), ...fontOpts], { scope: sc }),
    ];
    if (isEl) kids.push(rangeCtl('Size', 'fontSize', { scope: sc, min: 1, max: 30, step: 0.25, def: 6, unit: ' u' }));
    kids.push(
      selectCtl('Weight', 'weight', [...(isEl ? [] : [{ value: '', label: 'Default' }]), { value: 400, label: 'Regular' }, { value: 500, label: 'Medium' }, { value: 600, label: 'Semibold' }], { scope: sc, numeric: true }),
      segCtl('Alignment', 'align', ALIGNS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })), { scope: sc, clearable: !isEl }),
    );
    if (advanced) {
      kids.push(
        rangeCtl('Letter spacing', 'letter', { scope: sc, min: -0.05, max: 0.4, step: 0.005, def: 0, unit: ' em', clearable: !isEl }),
        rangeCtl('Line height', 'line', { scope: sc, min: 0.9, max: 2.4, step: 0.05, def: isEl ? 1.2 : 1.4, clearable: !isEl }),
      );
      if (isEl) kids.push(checkCtl('Italic', 'italic', { scope: sc }), checkCtl('Uppercase', 'upper', { scope: sc }));
    }
    kids.push(colorCtl('Text color', 'color', { scope: sc, clearable: !isEl }));
    return group(isEl ? 'Typography' : 'Text style (this section)', ...kids);
  }

  function renderInspector() {
    const box = ui.inspector;
    ctls = [];
    box.replaceChildren();
    const t = target();
    box.append(h('div', { class: 'studio-panel-head' }, h('h2', { class: 'studio-title', text: 'Inspector' })));
    if (!t) {
      box.append(h('p', { class: 'studio-empty', text: 'Select an element on the invitation, or pick one from Layers.' }));
      return;
    }
    const access = studioAccess();
    if (t.kind === 'sec') {
      const secParts = [
        h('div', { class: 'studio-selected' }, h('strong', { text: labelOf(t.id) }), h('span', { class: 'studio-layer-type', text: 'Existing section' }),
          h('button', { class: 'btn-link', type: 'button', text: 'Reset this section', onclick: resetSection })),
      ];
      if (access.caps.layers) secParts.push(group('Layer', arrangeCtl()));
      secParts.push(
        group('Position & spacing',
          numberCtl('Offset X', 'dx', { step: 0.5, def: 0 }),
          numberCtl('Offset Y', 'dy', { step: 0.5, def: 0 }),
          numberCtl('Scale', 'scale', { step: 0.05, min: 0.3, max: 3, def: 1 }),
          numberCtl('Space above', 'mt', { step: 0.5, min: -30, max: 60, def: 0 }),
          numberCtl('Space below', 'mb', { step: 0.5, min: -30, max: 60, def: 0 })),
        typographyGroup(t),
        group('Visibility', checkCtl('Show in invitation', 'hidden', { invert: true })));
      box.append(...secParts);
      return;
    }
    const e = t.e;
    const geo = [numberCtl('X (% of width)', 'x', { step: 0.5, def: 0 }), numberCtl('Y (% of height)', 'y', { step: 0.5, def: 0 }), numberCtl('Width', 'w', { step: 0.5, min: 1, def: 10 })];
    if (e.type !== 'text') geo.push(numberCtl('Height', 'h', { step: 0.5, min: 0.1, def: 10 }));
    const parts = [
      h('div', { class: 'studio-selected' }, h('strong', { text: e.name }), h('span', { class: 'studio-layer-type', text: TYPE_LABEL[e.type] }),
        h('div', { class: 'studio-selected-actions' },
          h('button', { class: 'move-btn', type: 'button', text: 'Duplicate', onclick: duplicateSelected }),
          h('button', { class: 'move-btn', type: 'button', text: 'Delete', onclick: deleteSelected }))),
      textCtl('Name', 'name', { max: 40 }),
    ];
    if (access.caps.layers) parts.push(group('Layer', arrangeCtl()));
    parts.push(group('Position & size', ...geo));
    if (e.type === 'text') {
      parts.push(group('Content', textCtl('Text', 'content', { area: true, max: 280 })), typographyGroup(t));
    } else if (e.type === 'image') {
      const photos = host.photos();
      const opts = [{ value: '', label: photos.length ? 'Choose a photo' : 'No uploaded photos' }, ...photos.map((p) => ({ value: p.id, label: p.label }))];
      if (e.photoId && !photos.some((p) => p.id === e.photoId)) opts.push({ value: e.photoId, label: 'Photo was removed' });
      const photoKids = [selectCtl('From uploaded photos', 'photoId', opts)];
      if (access.caps.image && !access.mobile) {
        photoKids.push(
          rangeCtl('Focus X', 'objX', { min: 0, max: 100, step: 1, def: 50, unit: '%' }),
          rangeCtl('Focus Y', 'objY', { min: 0, max: 100, step: 1, def: 50, unit: '%' }),
          rangeCtl('Zoom', 'zoom', { min: 1, max: 4, step: 0.05, def: 1, unit: '×' }),
          rangeCtl('Corner radius', 'radius', { min: 0, max: 30, step: 0.5, def: 0, unit: ' u' }),
        );
      }
      parts.push(group('Photo', ...photoKids));
    } else if (e.type === 'shape') {
      const kids = [colorCtl('Fill', 'fill', { allowNone: true }), colorCtl('Outline', 'stroke', { allowNone: true }), rangeCtl('Outline width', 'strokeW', { min: 0.1, max: 3, step: 0.1, def: 0.3, unit: ' u' })];
      if (e.shape === 'rect') kids.push(rangeCtl('Corner radius', 'radius', { min: 0, max: 30, step: 0.5, def: 0, unit: ' u' }));
      parts.push(group('Style', ...kids));
    } else if (e.type === 'decor') {
      parts.push(group('Style', colorCtl('Color', 'color')));
    }
    parts.push(group('Appearance', rangeCtl('Opacity', 'opacity', { min: 5, max: 100, step: 1, def: 100, unit: '%' }), checkCtl('Visible', 'visible', { def: true })));
    box.append(...parts);
  }

  /* ═══════════════ 9. Open / close & access ═══════════════ */
  function syncGuestState() {
    if (!ui) return;
    ui.overlay.hidden = isGuest();
    if (isGuest()) endGesture(); else placeSelection();
  }

  function open() {
    if (!STUDIO_ACCESS.enabled || active || isGuest()) return false;
    const access = studioAccess();
    if (!access || access.level === 'none') {
      host.announce('Studio is not part of this template.');
      return false;
    }
    buildUI();
    active = true;
    document.body.dataset.studio = 'on';
    applyCaps();
    applyNow({ mode: 'full' });
    host.announce(access.mobile ? 'Mobile Studio opened. Tap an element to edit it.' : 'Studio opened. Click an element to edit it.');
    ui.exit.focus();
    return true;
  }

  function close() {
    if (!active) return false;
    endGesture();
    active = false;
    selId = null;
    destroyUI();
    delete document.body.dataset.studio;
    delete document.body.dataset.studioMode;
    delete document.body.dataset.studioLevel;
    host.announce('Studio closed.');
    return true;
  }

  function syncAccess() {
    if (!active) return;
    const access = studioAccess();
    if (!access || access.level === 'none') {
      close();
      host.announce('Studio closed. This template does not include Studio.');
      return;
    }
    applyCaps();
    applyNow({ mode: 'full' });
  }

  stage.addEventListener('pointerdown', onStagePointerDown, true);
  stage.addEventListener('click', onStageClick, true);
  stage.addEventListener('dblclick', onStageDblClick, true);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => { placeSelection(); if (active) applyCaps(); });
  invite.addEventListener('transitionend', placeSelection);
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { setUnit(); placeSelection(); });
    ro.observe(invite);
    ro.observe(stage);
  }
  new MutationObserver(syncGuestState).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  // The access shortcut. Capture phase so it works wherever focus is.
  document.addEventListener('keydown', (e) => {
    const k = STUDIO_ACCESS.shortcut;
    if (!STUDIO_ACCESS.enabled || !k || e.repeat) return;
    const mod = k.ctrlOrMeta ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
    if (e.code === k.code && mod && e.shiftKey === !!k.shift && e.altKey === !!k.alt) {
      e.preventDefault();
      if (active) close(); else open();
    }
  }, true);

  window.CelesticateStudio = {
    apply: schedule,          // used by script.js so a saved design always renders
    syncAccess,
    ...(STUDIO_ACCESS.enabled && STUDIO_ACCESS.consoleApi ? { open, close, isOpen: () => active } : {}),
  };

  /* ═══════════════ Initialise ═══════════════ */
  applyNow();
  if (STUDIO_ACCESS.enabled && STUDIO_ACCESS.queryParam
      && new URLSearchParams(window.location.search).has(STUDIO_ACCESS.queryParam)) open();
})();