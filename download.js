/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 4.3: Personal download for fun

   Saves ONE long PNG of the invitation for personal use. It is a
   picture, not a print-ready file, not a published invitation and
   not a production request.

   How it works (no library, no network beyond the page's own fonts):
     1. Snapshot a CLONE of #invite. Nothing in the live page changes,
        and editor controls, the device frame, the opening overlay,
        music button and the ambient particles are never part of it.
     2. Make the clone self-contained: photos become (downscaled) data
        URLs, the page's CSS and the web fonts it really uses are embedded.
        An SVG image can't see the page's blob: photos or loaded fonts.
     3. Render it with the browser's own engine through an SVG
        <foreignObject>, sized to the page's viewport so @media and vw
        rules resolve exactly as they do on screen, then crop.
     4. Draw onto a size-capped canvas, add a "Personal preview" strip
        underneath, and download the PNG.

   It reads the invitation only through the DOM; it keeps no state of
   its own beyond "an export is running".
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const FILENAME = 'celesticate-personal-preview.png';
  const MAX_SCALE = 2;            // 2× is crisp enough to read and share
  const MAX_AREA = 16e6;          // pixels; the practical canvas ceiling on iOS Safari is ~16.7M
  const MAX_SIDE = 16000;         // pixels; several browsers refuse anything taller
  const MIN_USABLE_SCALE = 0.5;   // below this the text would not be readable: refuse instead
  const PHOTO_MAX_PX = 2400;
  const FETCH_TIMEOUT = 8000;
  const RENDER_TIMEOUT = 30000;
  const XHTML = 'http://www.w3.org/1999/xhtml';
  const CAPTION_TITLE = 'Personal preview';
  const CAPTION_TEXT = 'Made with Celesticate Moments. Not a print-ready file or a published invitation.';
  const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  class ExportError extends Error {
    constructor(code, message) { super(message || code); this.code = code; }
  }

  const byId = (id) => document.getElementById(id);
  let busy = false;

  /* ── small helpers ── */
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

  function withTimeout(promise, ms, code) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new ExportError(code)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function fetchTimed(url, ms = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally { clearTimeout(timer); }
  }

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(blob);
  });

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  /** Output size plan: as sharp as 2×, never beyond what browsers can hold. */
  function planScale(width, height) {
    return Math.min(MAX_SCALE, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / Math.max(width, height));
  }

  /* ── 1. Page CSS, made portable ── */
  async function collectCss() {
    const parts = [];
    for (const sheet of Array.from(document.styleSheets)) {
      const href = sheet.href || '';
      if (href && /fonts\.googleapis\.com/.test(href)) continue;     // cross-origin by design; fonts are embedded separately
      try {
        parts.push(Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n'));
      } catch (err) {
        // Some environments (for example opening index.html straight from disk) hide stylesheet rules.
        try { parts.push(await (await fetchTimed(href)).text()); }
        catch (err2) { throw new ExportError('styles'); }
      }
    }
    if (!parts.length) throw new ExportError('styles');
    // The export wrapper plays the part of <html>/<body>, so their rules must land on it.
    return parts.join('\n')
      .replace(/:root\b/g, '.export-root')
      .replace(/(^|[\s,{}])(?:html|body)(?=\s*[{,[.:#])/g, '$1.export-root');
  }

  /* ── 2. Fonts: embed only the faces and characters the invitation really uses ── */
  const fontDataCache = new Map();   // url → data URL, kept for the page session

  function collectFontNeeds(root) {
    const needs = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue;
      const el = node.parentElement;
      if (!el || !text.trim() || el.closest('#ambient, .gallery-nav')) continue;
      const cs = getComputedStyle(el);
      const family = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      const style = cs.fontStyle === 'normal' ? 'normal' : 'italic';
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const key = `${family}|${style}|${weight}`;
      if (!needs.has(key)) needs.set(key, { family, style, weight, chars: new Set() });
      const shown = cs.textTransform === 'uppercase' ? text.toUpperCase() : cs.textTransform === 'lowercase' ? text.toLowerCase() : text;
      for (const ch of shown) needs.get(key).chars.add(ch.codePointAt(0));
    }
    return needs;
  }

  function parseFontFaces(cssText) {
    const faces = [];
    for (const match of cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = match[1];
      const get = (prop) => (body.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`)) || [])[1];
      const family = (get('font-family') || '').trim().replace(/^["']|["']$/g, '');
      const url = ((get('src') || '').match(/url\(([^)]+)\)/) || [])[1];
      if (!family || !url) continue;
      faces.push({
        family,
        style: (get('font-style') || 'normal').trim(),
        weight: (get('font-weight') || '400').trim(),
        range: (get('unicode-range') || '').trim(),
        url: url.trim().replace(/^["']|["']$/g, ''),
      });
    }
    return faces;
  }

  function rangeCovers(range, codePoints) {
    if (!range) return true;
    const spans = range.split(',').map((part) => {
      const value = part.trim().replace(/^U\+/i, '');
      if (value.includes('?')) return [parseInt(value.replace(/\?/g, '0'), 16), parseInt(value.replace(/\?/g, 'F'), 16)];
      const [a, b] = value.split('-');
      return [parseInt(a, 16), parseInt(b || a, 16)];
    });
    return codePoints.some((cp) => spans.some(([lo, hi]) => cp >= lo && cp <= hi));
  }

  const faceWeights = (face) => face.weight.split(/\s+/).map(Number).filter(Number.isFinite);
  const faceHasWeight = (face, weight) => { const w = faceWeights(face); return w.length > 1 ? weight >= w[0] && weight <= w[1] : w[0] === weight; };

  function chooseFaces(faces, needs) {
    const chosen = new Map();
    for (const need of needs.values()) {
      const family = faces.filter((f) => f.family === need.family && f.style === need.style);
      if (!family.length) continue;
      let pool = family.filter((f) => faceHasWeight(f, need.weight));
      if (!pool.length) {   // nearest available weight, as a browser would pick
        const all = [...new Set(family.map((f) => faceWeights(f)[0]))];
        const near = all.reduce((a, b) => (Math.abs(b - need.weight) < Math.abs(a - need.weight) ? b : a));
        pool = family.filter((f) => faceWeights(f)[0] === near);
      }
      const codePoints = [...need.chars];
      pool.filter((f) => rangeCovers(f.range, codePoints)).forEach((f) => chosen.set(f.url, f));
    }
    return [...chosen.values()];
  }

  /** Returns { css, failed }. A failure never stops the export; the caller tells the person. */
  async function buildFontCss(needs) {
    const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com/css"]');
    if (!link || !needs.size) return { css: '', failed: false };
    let failed = false;
    let faces = [];
    try { faces = chooseFaces(parseFontFaces(await (await fetchTimed(link.href)).text()), needs); }
    catch (err) { return { css: '', failed: true }; }
    const blocks = await Promise.all(faces.map(async (face) => {
      try {
        if (!fontDataCache.has(face.url)) {
          const type = /\.woff2(\?|$)/.test(face.url) ? 'font/woff2' : /\.woff(\?|$)/.test(face.url) ? 'font/woff' : 'font/ttf';
          fontDataCache.set(face.url, `data:${type};base64,${bufferToBase64(await (await fetchTimed(face.url)).arrayBuffer())}`);
        }
        const range = face.range ? `unicode-range:${face.range};` : '';
        return `@font-face{font-family:"${face.family}";font-style:${face.style};font-weight:${face.weight};${range}src:url(${fontDataCache.get(face.url)});}`;
      } catch (err) { failed = true; return ''; }
    }));
    return { css: blocks.join('\n'), failed };
  }

  /* ── 3. Photos: same-origin/blob → downscaled data URL ── */
  async function toDataUrlSized(src, targetPx) {
    const blob = await (await fetchTimed(src)).blob();
    const downscalable = /^image\/(jpeg|png|webp)$/.test(blob.type) && typeof createImageBitmap === 'function';
    if (downscalable) {
      const bitmap = await createImageBitmap(blob);
      try {
        const want = Math.min(PHOTO_MAX_PX, Math.max(64, targetPx || bitmap.width));
        if (bitmap.width > want) {
          const canvas = document.createElement('canvas');
          canvas.width = want;
          canvas.height = Math.max(1, Math.round(bitmap.height * (want / bitmap.width)));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const small = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, 0.86));
          canvas.width = canvas.height = 0;
          return blobToDataUrl(small);
        }
      } finally { if (bitmap.close) bitmap.close(); }
    }
    return blobToDataUrl(blob);
  }

  /** Returns how many pictures could not be included. */
  async function inlinePhotos(liveImgs, cloneImgs, cloneRoot, scale) {
    let failed = 0;
    await Promise.all(cloneImgs.map(async (img, i) => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      try {
        const width = liveImgs[i] ? liveImgs[i].getBoundingClientRect().width : 0;
        img.setAttribute('src', await toDataUrlSized(src, Math.ceil(width * scale)));
        img.removeAttribute('srcset');
        img.removeAttribute('loading');
      } catch (err) {
        failed += 1;
        img.setAttribute('src', BLANK_PIXEL);
      }
    }));
    // Pictures set as CSS backgrounds in inline styles (for example a Studio layer).
    for (const el of cloneRoot.querySelectorAll('[style*="blob:"]')) {
      const style = el.getAttribute('style');
      const urls = [...style.matchAll(/url\((['"]?)(blob:[^)'"]+)\1\)/g)];
      let next = style;
      for (const m of urls) {
        try { next = next.replace(m[2], await toDataUrlSized(m[2], 0)); }
        catch (err) { failed += 1; next = next.replace(m[0], 'none'); }
      }
      el.setAttribute('style', next);
    }
    return failed;
  }

  /* ── 4. The "Personal preview" strip under the invitation (drawn, never over content) ── */
  function layoutCaption(ctx, width) {
    const font = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.font = font;
    const maxWidth = Math.max(120, width - 32);
    const lines = [];
    let line = '';
    for (const word of CAPTION_TEXT.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return { lines, font, height: 14 + 16 + lines.length * 15 + 12 };
  }

  function drawCaption(ctx, caption, y, width) {
    ctx.fillStyle = '#F7F4EE';
    ctx.fillRect(0, y, width, caption.height);
    ctx.fillStyle = '#DED7CA';
    ctx.fillRect(0, y, width, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#292723';
    ctx.font = `600 12px ${caption.font.slice(5)}`;
    ctx.fillText(CAPTION_TITLE, width / 2, y + 12);
    ctx.fillStyle = '#68665E';
    ctx.font = caption.font;
    caption.lines.forEach((text, i) => ctx.fillText(text, width / 2, y + 30 + i * 15));
  }

  /* ── 5. Build, render, encode ── */
  async function buildBlob(report) {
    const invite = byId('invite');
    if (!invite) throw new ExportError('empty');

    // Wait for the page itself to settle so the measurements below are final.
    if (document.fonts && document.fonts.ready) await withTimeout(document.fonts.ready, 4000, 'fonts-timeout').catch(() => {});
    await Promise.all(Array.from(invite.querySelectorAll('img'), (img) => (img.decode ? img.decode().catch(() => {}) : null)));

    // ── Synchronous snapshot: whatever the gallery is showing right now is what is saved. ──
    const width = invite.offsetWidth;
    const height = invite.offsetHeight;
    if (!width || !height) throw new ExportError('empty');
    const measure = document.createElement('canvas').getContext('2d');
    const caption = layoutCaption(measure, width);
    const totalHeight = height + caption.height;
    const scale = planScale(width, totalHeight);
    if (scale < MIN_USABLE_SCALE) throw new ExportError('toolarge');
    if (scale < 1) report.notes.push('This invitation is very long, so the image was saved at a lower resolution.');

    const liveImgs = Array.from(invite.querySelectorAll('img'));
    const clone = invite.cloneNode(true);
    const cloneImgs = Array.from(clone.querySelectorAll('img'));
    clone.querySelectorAll('#ambient, .gallery-nav').forEach((node) => node.remove());   // moving effects and on-screen controls
    const needs = collectFontNeeds(invite);
    const device = byId('device');
    const bodyStyle = getComputedStyle(document.body);
    const viewportW = document.documentElement.clientWidth;
    const viewportH = Math.max(height, window.innerHeight);
    const background = getComputedStyle(invite).backgroundColor;

    // ── Asynchronous work on the snapshot only ──
    await nextFrame();
    const [css, fonts, photosFailed] = await Promise.all([
      collectCss(),
      buildFontCss(needs),
      inlinePhotos(liveImgs, cloneImgs, clone, scale),
    ]);
    if (photosFailed) report.notes.push(`${photosFailed} photo${photosFailed === 1 ? '' : 's'} could not be included.`);
    if (fonts.failed) report.notes.push('Some fonts could not be included, so similar fonts were used and spacing may differ slightly.');

    // Render at the page's own viewport size so @media / vw / vh rules match the screen, then crop.
    const wrapper = document.createElementNS(XHTML, 'div');
    wrapper.setAttribute('class', 'export-root');
    wrapper.setAttribute('style', `position:relative;width:${viewportW}px;height:${viewportH}px;margin:0;padding:0;overflow:hidden;`);
    // font-size and line-height come from the page's own body rule (rewritten onto .export-root).
    // Copying their COMPUTED values would turn a unitless line-height into pixels and shift the layout.
    wrapper.style.fontFamily = bodyStyle.fontFamily;
    wrapper.style.color = bodyStyle.color;
    const style = document.createElementNS(XHTML, 'style');
    style.textContent = `${fonts.css}\n${css}\n`
      + '*,*::before,*::after{animation:none!important;transition:none!important}\n'
      + `.export-root .device{max-width:none!important;width:${width}px!important;margin:0!important;padding:0!important;background:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;overflow:visible!important}\n`
      + '.export-root .device::before,.export-root .device::after{display:none!important}\n'
      + '.export-root .opening{overflow:visible!important;border-radius:0!important}\n'
      + '.export-root .invite{border-radius:0!important}';
    const frame = document.createElementNS(XHTML, 'div');
    frame.setAttribute('class', 'device');
    frame.setAttribute('data-mode', (device && device.dataset.mode) || 'mobile');
    const opening = document.createElementNS(XHTML, 'div');
    opening.setAttribute('class', 'opening');
    opening.setAttribute('data-opening', 'none');
    opening.setAttribute('data-playing', 'false');
    opening.append(clone);
    frame.append(opening);
    wrapper.append(style, frame);

    const markup = new XMLSerializer().serializeToString(wrapper);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewportW}" height="${viewportH}" viewBox="0 0 ${viewportW} ${viewportH}">`
      + `<foreignObject x="0" y="0" width="${viewportW}" height="${viewportH}">${markup}</foreignObject></svg>`;
    // A data: URL, not a blob: URL. Chromium marks the canvas as tainted for blob: SVGs.
    const dataUrl = await blobToDataUrl(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    await withTimeout(new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new ExportError('render'));
      image.src = dataUrl;
    }), RENDER_TIMEOUT, 'timeout');

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(totalHeight * scale);
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ExportError('memory');
      const contentH = Math.round(height * scale);
      ctx.fillStyle = /^rgba\(.*,\s*0\)$|transparent/.test(background) ? '#FFFFFF' : background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, width, height, 0, 0, canvas.width, contentH);
      ctx.save();
      ctx.translate(0, contentH);
      ctx.scale(scale, scale);
      drawCaption(ctx, caption, 0, width);
      ctx.restore();

      // Never hand back a blank picture as if it were the invitation.
      const probe = document.createElement('canvas');
      probe.width = 32; probe.height = 48;
      const pctx = probe.getContext('2d');
      pctx.drawImage(canvas, 0, 0, canvas.width, contentH, 0, 0, 32, 48);
      const px = pctx.getImageData(0, 0, 32, 48).data;
      let sum = 0; let sumSq = 0; const n = px.length / 4;
      for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += l; sumSq += l * l; }
      if (Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2)) < 0.8) throw new ExportError('blank');

      report.size = `${canvas.width}×${canvas.height}`;
      return await new Promise((resolve, reject) => {
        try { canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ExportError('encode'))), 'image/png'); }
        catch (err) { reject(err); }
      });
    } finally { canvas.width = canvas.height = 0; }
  }

  /* ── 6. Saving ── */
  function saveBlob(blob) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let how = 'saved';
    if ('download' in a) {
      a.href = href;
      a.download = FILENAME;
      document.body.append(a);
      a.click();
      a.remove();
    } else {
      window.open(href, '_blank', 'noopener');
      how = 'opened';
    }
    setTimeout(() => URL.revokeObjectURL(href), 20000);
    return how;
  }

  /* ── 7. UI: one export at a time, honest feedback ── */
  const buttons = () => ['guest-download', 'share-download-image'].map(byId).filter(Boolean);
  const statuses = () => Array.from(document.querySelectorAll('[data-download-status]'));
  let clearTimer = null;

  function say(message, kind) {
    clearTimeout(clearTimer);
    statuses().forEach((el) => { el.textContent = message; if (kind) el.dataset.kind = kind; else delete el.dataset.kind; });
    if (kind === 'ok') clearTimer = setTimeout(() => say('', ''), 12000);
  }

  function setBusy(on) {
    busy = on;
    buttons().forEach((btn) => {
      const label = btn.querySelector('.dl-label') || btn;
      if (on) { btn.dataset.idleLabel = label.textContent; label.textContent = 'Preparing…'; btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-disabled', 'true'); }
      else { if (btn.dataset.idleLabel) label.textContent = btn.dataset.idleLabel; btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-disabled'); }
    });
  }

  const SCREENSHOT_HINT = ' You can open the full preview and take a screenshot instead.';
  function explain(err) {
    switch (err && err.code) {
      case 'styles': return `The page's styles could not be read, so the image could not be created.${SCREENSHOT_HINT}`;
      case 'toolarge': return `This invitation is too tall to save as one readable image in this browser. Try fewer photos.${SCREENSHOT_HINT}`;
      case 'blank': return `The image came out blank, so nothing was saved.${SCREENSHOT_HINT}`;
      case 'timeout': return `Creating the image took too long, so nothing was saved. Try again, or try with fewer photos.${SCREENSHOT_HINT}`;
      case 'render': return `Your browser could not draw the invitation as an image.${SCREENSHOT_HINT}`;
      case 'memory': return `There was not enough memory to create the image. Try fewer photos.${SCREENSHOT_HINT}`;
      case 'empty': return 'There is no invitation to save yet.';
      default: break;
    }
    if (err && err.name === 'SecurityError') return `Your browser blocked saving this image.${SCREENSHOT_HINT}`;
    if (err instanceof RangeError) return `There was not enough memory to create the image. Try fewer photos.${SCREENSHOT_HINT}`;
    return `The image could not be created, so nothing was saved.${SCREENSHOT_HINT}`;
  }

  const last = { status: 'idle', notes: [], size: '', error: '' };

  async function run() {
    if (busy) return last;
    setBusy(true);
    say('Preparing your preview image. This can take a few seconds.', 'busy');
    const report = { notes: [], size: '' };
    last.status = 'working'; last.notes = []; last.size = ''; last.error = '';
    try {
      const blob = await buildBlob(report);
      const how = saveBlob(blob);
      const base = how === 'opened'
        ? 'The image opened in a new tab. Press and hold it to save it.'
        : `Saved as ${FILENAME}. It is a picture for personal use, not a print-ready file or a published invitation.`;
      say([base, ...report.notes].join(' '), 'ok');
      Object.assign(last, { status: 'done', notes: report.notes, size: report.size });
    } catch (err) {
      const message = explain(err);
      say(message, 'error');
      Object.assign(last, { status: 'failed', notes: report.notes, error: (err && (err.code || err.name)) || 'error' });
    } finally {
      setBusy(false);
    }
    return last;
  }

  function init() {
    buttons().forEach((btn) => btn.addEventListener('click', () => { if (!busy) run(); }));
  }

  window.CelesticateDownload = {
    run,
    filename: FILENAME,
    isBusy: () => busy,
    getLast: () => ({ ...last, notes: [...last.notes] }),
    planScale,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();