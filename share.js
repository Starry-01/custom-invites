/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Sharing layer (QR Codes & Sharing)

     Invitation state  (window.celesticate.getConfig(), read-only)
           ↓
     Publishing / URL layer   ← the ONLY part a later phase replaces
           ↓
     Share layer              ← state + QR + copy + download + Web Share
           ↓
     Share card UI

   This file does not touch invitation content and holds no invitation
   data of its own. There is no backend yet, so the URL layer produces a
   clearly labelled DEVELOPMENT PREVIEW link, never a fake public URL.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── 1. Publishing / URL layer ─────────────────────────────────
     A publisher is any object with resolve(invitation) returning:
       { url, kind: 'dev-preview' | 'public', published: boolean, note: string }
     Later phases call CelesticateShare.setPublisher({ resolve }) with
     real public URLs; nothing below this section needs to change.   */
  const makeDraftId = () => `draft-${Math.random().toString(36).slice(2, 8)}`;
  let draftId = makeDraftId();

  const devPreviewPublisher = {
    resolve() {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('preview', draftId);
      return {
        url: url.href,
        kind: 'dev-preview',
        published: false,
        note: 'Development preview link. It opens a sample design only. Your edits are not saved or shared, and a real public link arrives with publishing.',
      };
    },
    reset() { draftId = makeDraftId(); },
  };
  let publisher = devPreviewPublisher;

  /* ── 2. QR component (wraps the qrcode-generator library; no custom QR maths) ── */
  const QUIET_MODULES = 4;   // QR spec quiet zone
  const QR_DARK = '#000';    // scanning needs maximum contrast, so QR colours are fixed on purpose
  const QR_LIGHT = '#fff';

  const QR = {
    available: () => typeof window.qrcode === 'function',
    encode(text) {
      const qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return { size: qr.getModuleCount(), isDark: (r, c) => qr.isDark(r, c) };
    },
    toSvg(matrix) {
      const total = matrix.size + QUIET_MODULES * 2;
      let d = '';
      for (let r = 0; r < matrix.size; r += 1) {
        for (let c = 0; c < matrix.size; c += 1) {
          if (matrix.isDark(r, c)) d += `M${c + QUIET_MODULES} ${r + QUIET_MODULES}h1v1h-1z`;
        }
      }
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'QR code for the invitation link. Scan it to open the invitation.');
      const bg = document.createElementNS(ns, 'rect');
      bg.setAttribute('width', String(total));
      bg.setAttribute('height', String(total));
      bg.setAttribute('fill', QR_LIGHT);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', QR_DARK);
      svg.append(bg, path);
      return svg;
    },
    /** Print-ready PNG: big white canvas, quiet zone, short label. No editor UI. */
    async toPngBlob(matrix, label) {
      try { if (document.fonts && document.fonts.load) await document.fonts.load('500 44px "DM Sans"'); } catch (e) { /* font optional */ }
      const total = matrix.size + QUIET_MODULES * 2;
      const cell = Math.max(2, Math.floor(1000 / total));
      const qrPx = cell * total;
      const pad = 60;
      const labelH = 130;
      const canvas = document.createElement('canvas');
      canvas.width = qrPx + pad * 2;
      canvas.height = qrPx + pad + labelH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.fillStyle = QR_LIGHT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = QR_DARK;
      for (let r = 0; r < matrix.size; r += 1) {
        for (let c = 0; c < matrix.size; c += 1) {
          if (matrix.isDark(r, c)) ctx.fillRect(pad + (c + QUIET_MODULES) * cell, pad + (r + QUIET_MODULES) * cell, cell, cell);
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '500 44px "DM Sans", system-ui, sans-serif';
      ctx.fillText(label, canvas.width / 2, pad + qrPx + labelH / 2 - 10);
      return new Promise((resolve, reject) => {
        if (!canvas.toBlob) { reject(new Error('toBlob unavailable')); return; }
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty blob'))), 'image/png');
      });
    },
  };

  /* ── 3. Share state (independent from invitation content) ── */
  const state = {
    info: null,                                   // result of the publisher
    qr: { status: 'idle', matrix: null },         // idle | ready | unavailable | error
    canNativeShare: typeof navigator.share === 'function',
    copy: 'idle',                                 // idle | copied | manual
    download: 'idle',                             // idle | working | done | failed
  };

  const getInvitation = () => (window.celesticate && window.celesticate.getConfig ? window.celesticate.getConfig() : {});
  const invitationName = () => String(getInvitation().names || '').trim();

  /* ── 4. UI binding ── */
  const els = {};
  let feedbackTimer = null;
  let copyTimer = null;

  function announce(message) {
    if (!els.feedback) return;
    els.feedback.textContent = message;
    clearTimeout(feedbackTimer);
    if (message) feedbackTimer = setTimeout(() => { els.feedback.textContent = ''; }, 6000);
  }

  function renderQr() {
    const box = els.qr;
    if (!box) return;
    box.replaceChildren();
    state.qr = { status: 'idle', matrix: null };
    if (!QR.available()) {
      state.qr.status = 'unavailable';
      box.dataset.status = 'unavailable';
      box.textContent = 'The QR code could not load. Check your connection. The link above still works.';
    } else {
      try {
        const matrix = QR.encode(state.info.url);
        state.qr = { status: 'ready', matrix };
        box.dataset.status = 'ready';
        box.append(QR.toSvg(matrix));
      } catch (err) {
        state.qr.status = 'error';
        box.dataset.status = 'error';
        box.textContent = 'This link is too long for a QR code.';
      }
    }
    if (els.download) els.download.disabled = state.qr.status !== 'ready';
  }

  /** Re-resolve the share URL through the publisher; redraw the QR only when it changed. */
  function refresh() {
    const info = publisher.resolve(getInvitation());
    const changed = !state.info || state.info.url !== info.url;
    state.info = info;
    if (els.url) els.url.value = info.url;
    if (els.note) els.note.textContent = info.note || '';
    if (changed) renderQr();
  }

  function setCopyLabel(text, copied) {
    if (!els.copy) return;
    const label = els.copy.querySelector('.share-copy-label');
    if (label) label.textContent = text;
    if (copied) els.copy.dataset.state = 'copied'; else els.copy.removeAttribute('data-state');
  }

  async function writeClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (err) { /* fall through to the legacy path */ }
    try {
      if (!els.url) return false;
      els.url.focus();
      els.url.select();
      els.url.setSelectionRange(0, text.length);
      return !!document.execCommand('copy');
    } catch (err) { return false; }
  }

  async function copyLink() {
    refresh();
    const ok = await writeClipboard(state.info.url);
    clearTimeout(copyTimer);
    if (ok) {
      state.copy = 'copied';
      setCopyLabel('Copied!', true);
      announce('Link copied.');
      copyTimer = setTimeout(() => { state.copy = 'idle'; setCopyLabel('Copy Link', false); }, 2000);
    } else {
      state.copy = 'manual';
      if (els.url) { els.url.focus(); els.url.select(); }
      announce('Copying is blocked here. The link is selected. Press Ctrl+C (or Cmd+C) to copy it.');
    }
    return ok;
  }

  async function shareInvitation() {
    refresh();
    const name = invitationName();
    const data = {
      title: name || 'Invitation',
      text: name ? `You are invited: ${name}` : 'You are invited',
      url: state.info.url,
    };
    const supported = state.canNativeShare && (!navigator.canShare || navigator.canShare(data));
    if (supported) {
      try {
        await navigator.share(data);
        announce('Invitation shared.');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;   // the person closed the share sheet; not an error
      }
    }
    const ok = await copyLink();
    if (ok) announce('Sharing is not available here, so the link was copied instead.');
  }

  async function downloadQr() {
    if (state.qr.status !== 'ready') return;
    state.download = 'working';
    if (els.download) els.download.disabled = true;
    try {
      const blob = await QR.toPngBlob(state.qr.matrix, 'Scan to open invitation');
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      if ('download' in a) {
        a.href = href;
        a.download = 'celesticate-invitation-qr.png';
        document.body.append(a);
        a.click();
        a.remove();
        announce('QR code downloaded.');
      } else {
        window.open(href, '_blank', 'noopener');
        announce('QR code opened in a new tab. Press and hold it to save.');
      }
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      state.download = 'done';
    } catch (err) {
      state.download = 'failed';
      announce('The QR code could not be downloaded in this browser. You can take a screenshot of it instead.');
    } finally {
      if (els.download) els.download.disabled = state.qr.status !== 'ready';
    }
  }

  function init() {
    ['url', 'note', 'copy', 'qr', 'download', 'native', 'feedback', 'open-preview'].forEach((key) => {
      els[key === 'open-preview' ? 'openPreview' : key] = document.getElementById(`share-${key}`);
    });
    if (!els.url) return;                                   // share card not on this page
    if (els.copy) els.copy.addEventListener('click', copyLink);
    if (els.native) els.native.addEventListener('click', shareInvitation);
    if (els.download) els.download.addEventListener('click', downloadQr);
    if (els.openPreview) els.openPreview.addEventListener('click', () => document.dispatchEvent(new CustomEvent('celesticate:guest-preview')));
    // Selecting the whole link on focus makes manual copying easy.
    els.url.addEventListener('focus', () => els.url.select());
    refresh();
  }

  /* ── 5. Public API ── */
  window.CelesticateShare = {
    init,
    refresh,
    /** Start a new draft identity (e.g. after "Reset to sample"). */
    newDraft() { if (typeof publisher.reset === 'function') publisher.reset(); refresh(); },
    /** Phase 4 hook: provide real public URLs here. */
    setPublisher(next) {
      if (!next || typeof next.resolve !== 'function') throw new TypeError('A publisher needs a resolve(invitation) function.');
      publisher = next;
      refresh();
    },
    getState: () => ({
      url: state.info ? state.info.url : '',
      kind: state.info ? state.info.kind : '',
      published: state.info ? !!state.info.published : false,
      qr: state.qr.status,
      canNativeShare: state.canNativeShare,
    }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();