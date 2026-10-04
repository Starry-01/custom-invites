/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 2.3: Section visibility & ordering
   ───────────────────────────────────────────────────────────────
   Architecture:
     1. Configuration  — single source of truth; no DOM access
     2. Rendering      — config → DOM via textContent / .hidden
     3. Controls       — DOM events → config mutation → render
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════
     1. CONFIGURATION
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Deep-freeze a plain object so the sample can never be mutated.
   */
  const deepFreeze = (o) => {
    Object.values(o).forEach((v) => {
      if (v && typeof v === 'object') deepFreeze(v);
    });
    return Object.freeze(o);
  };

  /**
   * Canonical sample invitation.
   * Fields marked "later phase" are stored in config but have no UI or renderer yet.
   */
  const SAMPLE = deepFreeze({
    eventType:    'wedding',
    names:        'Alex & Jamie',
    date:         '2027-06-12',   // ISO yyyy-mm-dd — matches <input type="date">
    time:         '',             // HH:MM or '' — matches <input type="time">; '' = hidden
    venue:        '',
    location:     'Bandung, Indonesia',
    heading:      'Together with their families',
    title:        '',
    message:      'We joyfully invite you to celebrate our wedding.',
    note:         '',
    palette:      'forest',       // forest | sage | midnight (tokens in style.css)
    headingFont:  'cormorant',    // cormorant | playfair | dmsans
    template:     'classic',      // classic | editorial | minimal | photo
    templateChosen: false,        // true after a manual style pick; event type will not override it
    /**
     * The ONE place sections are described. Display order = `order` (ascending);
     * visibility = `enabled`. The two are independent: hiding never changes order.
     *   status 'available'   → functional; can be shown/hidden (and moved unless `locked`)
     *   status 'coming-soon' → not implemented; never shown, toggle disabled
     *   locked               → always on and always first (Welcome)
     */
    sections: [
      { id: 'welcome',   label: 'Welcome',       enabled: true,  order: 1, status: 'available',   locked: true  },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 2, status: 'available',   locked: false },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 3, status: 'available',   locked: false },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 4, status: 'coming-soon', locked: false },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 5, status: 'available',   locked: false },
      { id: 'rsvp',      label: 'RSVP',          enabled: false, order: 6, status: 'coming-soon', locked: false },
    ],
    // ── Stored for later phases; no UI or renderer yet ────────────
    bodyFont:     'dmsans',
    colors:       { background: null, text: null, accent: null, primary: null },
    // Gallery images are local object URLs. `layout` is cinematic | slideshow | grid.
    // `orientation` is the Photo Grid arrangement and is independent of the image list.
    gallery:      { layout: 'cinematic', orientation: 'horizontal', images: [] },
    action:       { enabled: true, label: 'Kindly reply', url: '' },
    deviceMode:   'mobile',       // mobile | desktop
  });

  /** Fields whose values are freeform text (stored as strings, trimmed on commit). */
  const TEXT_FIELDS = ['names', 'date', 'time', 'venue', 'location', 'heading', 'title', 'message', 'note'];

  const EVENT_PRESETS = {
    wedding: {
      label: 'Wedding', namesLabel: 'Names of the couple', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. Together with their families',
      heading: 'Together with their families', title: '', names: 'Alex & Jamie',
      message: 'We joyfully invite you to celebrate our wedding.', template: 'classic',
    },
    birthday: {
      label: 'Birthday', namesLabel: "Celebrant's name", namesPlaceholder: 'e.g. Maya',
      headingLabel: 'Host or family names', headingPlaceholder: "e.g. You're invited by",
      heading: "You're invited by", title: 'A birthday celebration', names: 'Maya',
      message: 'Please join us to celebrate a birthday.', template: 'photo',
    },
    graduation: {
      label: 'Graduation', namesLabel: "Graduate's name", namesPlaceholder: 'e.g. Alex',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. With pride and gratitude',
      heading: 'With pride and gratitude', title: 'A graduation celebration', names: 'Alex',
      message: 'Please join us to celebrate a graduation.', template: 'editorial',
    },
    engagement: {
      label: 'Engagement', namesLabel: 'Names of the couple', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. Together with their families',
      heading: 'Together with their families', title: 'An engagement celebration', names: 'Alex & Jamie',
      message: 'Please join us to celebrate their engagement.', template: 'editorial',
    },
    anniversary: {
      label: 'Anniversary', namesLabel: 'Names of the celebrants', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. With love from',
      heading: 'With love from', title: 'An anniversary celebration', names: 'Alex & Jamie',
      message: 'Please join us to celebrate an anniversary.', template: 'classic',
    },
    baby: {
      label: 'Baby Shower', namesLabel: 'Parent or parents', namesPlaceholder: 'e.g. Jordan',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. Hosted with love by',
      heading: 'Hosted with love by', title: 'A baby shower', names: 'Jordan',
      message: 'Please join us for a baby shower.', template: 'minimal',
    },
    general: {
      label: 'General Event', namesLabel: 'Event title', namesPlaceholder: 'e.g. Our gathering',
      headingLabel: 'Host or family names', headingPlaceholder: "e.g. You're invited",
      heading: "You're invited", title: '', names: 'Our gathering',
      message: 'Please join us for this occasion.', template: 'classic',
    },
  };

  const PRESET_FIELDS = ['heading', 'title', 'names', 'message'];

  /** Shallow clone via JSON — safe for our plain config structure. */
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Live mutable configuration. Always a full clone of SAMPLE to start. */
  let config = clone(SAMPLE);

  /* ── Section selectors (pure functions of config; no DOM) ── */
  const sectionsSorted = () => [...config.sections].sort((a, b) => a.order - b.order);
  const getSection     = (id) => config.sections.find((x) => x.id === id);
  const isAvailable    = (x) => x.status === 'available';
  const isMovable      = (x) => isAvailable(x) && !x.locked;
  const isShown        = (x) => isAvailable(x) && (x.locked || x.enabled);

  /** Swap `order` with the neighbouring movable section. Returns true if anything moved. */
  function moveSection(id, dir) {
    const movable = sectionsSorted().filter(isMovable);
    const i = movable.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= movable.length) return false;
    const a = movable[i], b = movable[j];
    [a.order, b.order] = [b.order, a.order];
    return true;
  }

  /** Public read-only API for future phases (autosave, export, etc.). */
  window.celesticate = {
    getConfig: () => clone(config),
    getSample: () => clone(SAMPLE),
  };

  /* ── Gallery: local object URLs only (no cloud storage this phase) ── */
  const GALLERY_MAX = 20;
  const GALLERY_MAX_BYTES = 8 * 1024 * 1024;
  const GALLERY_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const GALLERY_EXT = /\.(jpe?g|png|webp)$/i;

  /** id → object URL. Kept beside config so revoke stays reliable after clone/reset. */
  const objectUrls = new Map();

  const photosSorted = () => [...config.gallery.images].sort((a, b) => a.order - b.order);

  function makeId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function fileFingerprint(file) {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  function isSupportedImage(file) {
    const type = (file.type || '').toLowerCase();
    return GALLERY_TYPES.has(type) || (!type && GALLERY_EXT.test(file.name));
  }

  function releaseUrl(id) {
    const url = objectUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }

  function releaseAllUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) releaseAllUrls();
  });

  /* ═══════════════════════════════════════════════════════════════
     2. RENDERING  (config → DOM only; never reads from inputs)
     ═══════════════════════════════════════════════════════════════ */

  /* ── Element references ── */
  const $ = (sel) => document.querySelector(sel);

  /**
   * Collect all [data-el] elements once into a plain object.
   * e.g. el.names → <h2 data-el="names">
   */
  const el = {};
  document.querySelectorAll('[data-el]').forEach((node) => {
    el[node.dataset.el] = node;
  });

  const invite      = $('#invite');
  const device      = $('#device');
  const modeButtons = document.querySelectorAll('.seg-btn[data-mode]');
  const liveStatus  = $('#live-status');

  /** Preview wrapper for each section, keyed by section id (collected once). */
  const sectionEls = {};
  document.querySelectorAll('[data-section-el]').forEach((node) => {
    sectionEls[node.dataset.sectionEl] = node;
  });

  /* ── Helpers ── */

  /** Guard: always return a string; never let undefined/null reach the DOM. */
  const safe = (v) => (v == null ? '' : String(v));

  /** Trim and safe-stringify — used before writing to textContent. */
  const clean = (v) => safe(v).trim();

  /**
   * Parse an ISO date string (yyyy-mm-dd) into a human-readable en-GB format.
   * Returns '' for any invalid or empty input; never throws.
   */
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe(iso));
    if (!m) return '';
    // Use setFullYear to avoid the two-digit-year (19xx) quirk in the Date constructor.
    const d = new Date(2000, 0, 1);
    d.setFullYear(+m[1], +m[2] - 1, +m[3]);
    // Confirm the date did not overflow (e.g. Feb 30).
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * Normalise a 24-hour time string to "HH:MM".
   * Returns '' for any invalid or empty input.
   */
  function formatTime(v) {
    const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(clean(v));
    if (!m || +m[1] > 23 || +m[2] > 59) return '';
    return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
  }

  /* ── Individual renderers ── */

  /**
   * Render the names headline.
   * Splits on the first '&' to place a styled <span class="amp"> in between.
   * Falls back to plain text when there's no '&', or the name is empty.
   */
  function renderNames() {
    const node = el.names;
    const v    = clean(config.names);
    node.classList.toggle('is-empty', !v);
    node.replaceChildren(); // clear previous children safely

    const ampIdx = v.indexOf('&');
    const left   = ampIdx > -1 ? v.slice(0, ampIdx).trim() : '';
    const right  = ampIdx > -1 ? v.slice(ampIdx + 1).trim() : '';

    if (left && right) {
      // Both sides present — render with styled ampersand.
      const ampSpan = document.createElement('span');
      ampSpan.className   = 'amp';
      ampSpan.textContent = '&';
      node.append(left + ' ', ampSpan, ' ' + right);
    } else {
      // Single name or no '&' — plain text. Empty names stay out of the invitation.
      node.textContent = v;
    }
    node.hidden = !v;
  }

  /** Render the date line; hide element when date is absent or invalid. */
  function renderDate() {
    const formatted = formatDate(config.date);
    el.date.textContent = formatted;
    el.date.hidden = !formatted;
  }

  /** Render the time line; hide when time is absent or invalid. */
  function renderTime() {
    const formatted = formatTime(config.time);
    el.time.textContent = formatted;
    el.time.hidden = !formatted;
  }

  /**
   * Render the welcome block (kicker heading + intro message + decorative sprig).
   * Welcome is always on, so only per-element emptiness is handled here.
   */
  function renderWelcome() {
    const heading = clean(config.heading);
    const message = clean(config.message);

    el.heading.textContent = heading;
    el.heading.hidden = !heading;

    el.message.textContent = message;
    el.message.hidden = !message;

    const note = clean(config.note);
    el.note.textContent = note;
    el.note.hidden = !note;

    // Sprig shows only when at least one of heading/message is visible.
    el.sprig.hidden = !heading && !message && !clean(config.title);
  }

  function renderTitle() {
    const title = clean(config.title);
    el.title.textContent = title;
    el.title.hidden = !title;
  }

  /** Render the venue and location lines (text only; section visibility is separate). */
  function renderVenue() {
    const venue = clean(config.venue);
    const place = clean(config.location);

    el.venue.textContent = venue;
    el.venue.hidden = !venue;

    el.location.textContent = place;
    el.location.hidden = !place;
  }

  /**
   * Render the invitation gallery in the selected presentation mode.
   * Photo order comes from config; the current photo id is view state only.
   */
  let galleryPhotoId = null;
  let cinematicTimer = null;
  let cinematicHold = false;
  const CINEMATIC_MS = 4500;

  function stopCinematic() {
    if (!cinematicTimer) return;
    clearInterval(cinematicTimer);
    cinematicTimer = null;
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cinematicCanPlay() {
    if (config.gallery.layout !== 'cinematic') return false;
    if (photosSorted().length < 2) return false;
    if (cinematicHold || document.hidden) return false;
    const section = getSection('gallery');
    if (!section || !isShown(section) || !hasContent('gallery')) return false;
    return !reducedMotion();
  }

  /** Start the single cinematic timer, or clear it when rotation should not run. */
  function syncCinematic() {
    if (!cinematicCanPlay()) { stopCinematic(); return; }
    if (cinematicTimer) return;
    cinematicTimer = setInterval(() => {
      if (!cinematicCanPlay()) { stopCinematic(); return; }
      const photos = photosSorted();
      const i = activeGalleryIndex(photos);
      showCinematicPhoto((i + 1) % photos.length, true);
    }, CINEMATIC_MS);
  }

  function setCinematicHold(on) {
    cinematicHold = !!on;
    syncCinematic();
    const pos = el.gallery && el.gallery.querySelector('.gallery-pos');
    if (pos && config.gallery.layout === 'cinematic') {
      const photos = photosSorted();
      if (photos.length > 1) pos.textContent = positionLabel(activeGalleryIndex(photos), photos.length);
    }
  }

  document.addEventListener('visibilitychange', syncCinematic);
  window.addEventListener('pagehide', stopCinematic);

  function activeGalleryIndex(photos) {
    const i = photos.findIndex((p) => p.id === galleryPhotoId);
    return i >= 0 ? i : 0;
  }

  function photoLabel(photo, i) {
    return clean(photo.filename) || `Photo ${i + 1}`;
  }

  function galleryNavButton(dir, disabled) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-nav-btn';
    btn.dataset.galleryNav = String(dir);
    btn.textContent = dir < 0 ? 'Previous' : 'Next';
    btn.setAttribute('aria-label', dir < 0 ? 'Previous photo' : 'Next photo');
    btn.disabled = disabled;
    return btn;
  }

  function positionLabel(i, total) {
    const base = `${i + 1} / ${total}`;
    if (config.gallery.layout !== 'cinematic' || total < 2) return base;
    if (reducedMotion()) return base;
    return cinematicHold || document.hidden ? `${base} · Paused` : `${base} · Playing`;
  }

  function makeStageImg(photo, i) {
    const img = document.createElement('img');
    img.className = 'gallery-stage-img';
    img.src = photo.previewUrl;
    img.alt = photoLabel(photo, i);
    img.decoding = 'async';
    return img;
  }

  function showCinematicPhoto(index, animate) {
    const photos = photosSorted();
    const photo = photos[index];
    const frame = el.gallery && el.gallery.querySelector('.gallery-stage.is-cinematic');
    if (!photo || !frame) return;
    galleryPhotoId = photo.id;
    const pos = el.gallery.querySelector('.gallery-pos');
    if (pos) pos.textContent = positionLabel(index, photos.length);
    const current = frame.querySelector('.gallery-stage-img.is-current');
    if (!animate || reducedMotion() || !current || current.alt === photoLabel(photo, index)) {
      const img = makeStageImg(photo, index);
      img.classList.add('is-current');
      frame.replaceChildren(img);
      return;
    }
    const img = makeStageImg(photo, index);
    frame.append(img);
    void img.offsetWidth;
    img.classList.add('is-current');
    current.classList.remove('is-current');
    window.setTimeout(() => {
      if (current.parentNode) current.remove();
    }, 900);
  }

  function renderStage(root, photos, mode) {
    const i = activeGalleryIndex(photos);
    const photo = photos[i];
    galleryPhotoId = photo.id;

    const frame = document.createElement('div');
    frame.className = mode === 'slideshow' ? 'gallery-stage is-slideshow' : 'gallery-stage is-cinematic';
    const img = makeStageImg(photo, i);
    img.classList.add('is-current');
    if (mode === 'cinematic' && photos.length < 2) img.classList.add('is-still');
    frame.append(img);

    const nav = document.createElement('div');
    nav.className = 'gallery-nav';
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', mode === 'slideshow' ? 'Slide photos' : 'Cinematic photos');
    const pos = document.createElement('p');
    pos.className = 'gallery-pos';
    pos.textContent = positionLabel(i, photos.length);
    const manualEnds = mode === 'slideshow';
    nav.append(
      galleryNavButton(-1, manualEnds ? i === 0 : photos.length < 2),
      pos,
      galleryNavButton(1, manualEnds ? i === photos.length - 1 : photos.length < 2)
    );
    root.append(frame, nav);
  }

  function renderGrid(root, photos) {
    const orientation = config.gallery.orientation === 'vertical' ? 'vertical' : 'horizontal';
    config.gallery.orientation = orientation;
    root.dataset.orientation = orientation;
    photos.forEach((photo, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-tile';
      btn.dataset.galleryOpen = String(i);
      btn.setAttribute('aria-label', `Open ${photoLabel(photo, i)}`);
      const img = document.createElement('img');
      img.src = photo.previewUrl;
      img.alt = photoLabel(photo, i);
      img.decoding = 'async';
      btn.append(img);
      root.append(btn);
    });
  }

  function renderGallery() {
    const root = el.gallery;
    if (!root) return;
    const mode = ['cinematic', 'slideshow', 'grid'].includes(config.gallery.layout)
      ? config.gallery.layout
      : 'cinematic';
    config.gallery.layout = mode;
    root.dataset.mode = mode;
    root.replaceChildren();
    const photos = photosSorted();
    if (!photos.length) { renderTemplate(); return; }
    if (mode === 'grid') renderGrid(root, photos);
    else renderStage(root, photos, mode);
    renderTemplate();
    syncCinematic();
  }

  /* ── Sections: order, visibility, and the matching sidebar state ── */

  /** Does this section have anything to show right now? */
  function hasContent(id) {
    if (id === 'details') return !!(formatDate(config.date) || formatTime(config.time));
    if (id === 'venue')   return !!(clean(config.venue) || clean(config.location));
    if (id === 'gallery') return config.gallery.images.length > 0;
    return true;
  }

  const EMPTY_HINTS = {
    details: 'Nothing to show yet. Add a date or time above.',
    venue:   'Nothing to show yet. Add a venue or location above.',
    gallery: 'Nothing to show yet. Add photos in the Photos panel.',
  };

  /** Move existing nodes into config order. Only nodes that are out of place are touched. */
  function reorderChildren(parent, nodes) {
    nodes.forEach((node, i) => {
      if (parent.children[i] !== node) parent.insertBefore(node, parent.children[i] || null);
    });
  }

  /** Put preview sections and sidebar rows in the configured order. */
  function renderSectionOrder() {
    const sorted = sectionsSorted();
    reorderChildren(invite, sorted.map((x) => sectionEls[x.id]));
    reorderChildren(sectionList, sorted.map((x) => sectionRows[x.id].li));
  }

  /**
   * Show/hide preview sections and sync every sidebar row (switch, hint, move buttons).
   * Hidden sections use [hidden] (display:none) so they leave no space; nothing is deleted.
   */
  function renderSectionState() {
    const sorted  = sectionsSorted();
    const movable = sorted.filter(isMovable);

    sorted.forEach((x) => {
      const shown = isShown(x);
      sectionEls[x.id].hidden = !shown || !hasContent(x.id);

      const row = sectionRows[x.id];
      row.input.checked  = shown;
      row.input.disabled = !isAvailable(x) || x.locked;

      const hint = shown && !hasContent(x.id) ? (EMPTY_HINTS[x.id] || '') : '';
      row.hint.textContent = hint;
      row.hint.hidden = !hint;

      if (row.up) {
        const i = movable.indexOf(x);
        row.up.disabled   = i <= 0;
        row.down.disabled = i < 0 || i >= movable.length - 1;
      }
    });
    syncCinematic();
  }

  /** Apply palette token by setting data-palette on the invite card. */
  function renderPalette() {
    invite.dataset.palette = config.palette;
  }

  /** Apply heading font by setting data-font on the invite card. */
  function renderHeadingFont() {
    invite.dataset.font = config.headingFont;
  }

  const TEMPLATES = { classic: 'Classic', editorial: 'Editorial', minimal: 'Minimal', photo: 'Photo Focus' };

  function renderTemplate() {
    invite.dataset.template = TEMPLATES[config.template] ? config.template : 'classic';
    const photos = photosSorted();
    invite.dataset.hasPhotos = photos.length ? 'true' : 'false';
    const hero = $('#hero-photo');
    if (!hero) return;
    const show = config.template === 'photo' && photos[0];
    hero.hidden = !show;
    if (show) {
      hero.src = photos[0].previewUrl;
      hero.alt = photoLabel(photos[0], 0);
    } else {
      hero.removeAttribute('src');
      hero.alt = '';
    }
  }

  /** Sync the device frame size and active button state. */
  function renderDeviceMode() {
    device.dataset.mode = config.deviceMode;
    modeButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === config.deviceMode));
    });
    const label = $('#preview-mode-label');
    if (label) label.textContent = config.deviceMode === 'desktop' ? 'Desktop preview' : 'Mobile preview';
  }

  /** Editor-only readiness list. Never rendered inside the invitation. */
  function renderChecklist() {
    const list = $('#preview-checklist');
    const count = $('#check-count');
    const summary = $('#check-summary');
    const toggle = $('#check-toggle');
    if (!list) return;
    const hasPlace = !!(clean(config.venue) || clean(config.location));
    const items = [
      { label: 'Names', ok: !!clean(config.names), target: 'f-names' },
      { label: 'Event date', ok: !!formatDate(config.date), target: 'f-date' },
      { label: 'Venue or location', ok: hasPlace, target: 'f-venue' },
      { label: 'Gallery photo', ok: config.gallery.images.length > 0, target: 'add-photos-btn' },
    ];
    const done = items.filter((item) => item.ok).length;
    list.replaceChildren();
    items.forEach((item) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'check-item';
      btn.dataset.checkTarget = item.target;
      const detail = item.ok ? 'Entered' : 'Needed';
      btn.setAttribute('aria-label', `${item.label}, ${detail}. Go to the editor control.`);
      const mark = document.createElement('span');
      mark.className = 'check-mark';
      mark.dataset.state = item.ok ? 'done' : 'needed';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = item.ok ? '✓' : '!';
      const name = document.createElement('span');
      name.className = 'check-label';
      name.textContent = item.label;
      const status = document.createElement('span');
      status.className = 'check-status';
      status.dataset.state = item.ok ? 'done' : 'needed';
      status.textContent = detail;
      btn.append(mark, name, status);
      li.append(btn);
      list.append(li);
    });
    if (count) count.textContent = `${done}/4`;
    if (summary) summary.textContent = `${done} of 4 complete`;
    if (toggle) toggle.setAttribute('aria-label', `Preview checklist, ${done} of 4 complete`);
  }

  function setChecklistOpen(open) {
    const toggle = $('#check-toggle');
    const panel = $('#preview-checklist-panel');
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  }

  /** Update the invitation's accessible label to reflect the event type. */
  function renderLabel() {
    const preset = EVENT_PRESETS[config.eventType];
    const type = preset ? preset.label.toLowerCase() : 'event';
    invite.setAttribute('aria-label', `Sample ${type} invitation`);
  }

  function updateCounters() {
    [['message', 160], ['note', 200]].forEach(([name, max]) => {
      const node = document.getElementById(`count-${name}`);
      const input = document.getElementById(name === 'message' ? 'f-message' : 'f-note');
      if (node && input) node.textContent = `${input.value.length} / ${max}`;
    });
  }

  function applyEventLabels(type) {
    const preset = EVENT_PRESETS[type] || EVENT_PRESETS.general;
    $('#label-names').textContent = preset.namesLabel;
    $('#f-names').placeholder = preset.namesPlaceholder;
    $('#label-heading').textContent = preset.headingLabel;
    $('#f-heading').placeholder = preset.headingPlaceholder;
  }

  function contentMatchesPreset(type) {
    const preset = EVENT_PRESETS[type];
    if (!preset) return false;
    return PRESET_FIELDS.every((field) => clean(config[field]) === clean(preset[field] || ''));
  }

  function presetFieldsBlank() {
    return PRESET_FIELDS.every((field) => !clean(config[field]));
  }

  /** Full render — call once on init and after a reset. */
  function renderAll() {
    renderNames();
    renderDate();
    renderTime();
    renderWelcome();
    renderTitle();
    renderVenue();
    renderGallery();
    renderSectionOrder();
    renderSectionState();
    renderPalette();
    renderHeadingFont();
    renderTemplate();
    renderDeviceMode();
    renderLabel();
    renderPhotoPanel();
    renderChecklist();
    applyEventLabels(config.eventType);
    updateCounters();
  }

  /**
   * Map from config field name → render function(s) to call on targeted updates.
   * Keeping this explicit prevents over-rendering on every keystroke.
   */
  const FIELD_RENDER = {
    names:       [renderNames],
    date:        [renderDate, renderSectionState],
    time:        [renderTime, renderSectionState],
    venue:       [renderVenue, renderSectionState],
    location:    [renderVenue, renderSectionState],
    heading:     [renderWelcome],
    title:       [renderTitle, renderWelcome],
    message:     [renderWelcome],
    note:        [renderWelcome],
    palette:     [renderPalette],
    headingFont: [renderHeadingFont],
    template:    [renderTemplate],
    deviceMode:  [renderDeviceMode],
  };

  /* ═══════════════════════════════════════════════════════════════
     3. CONTROLS  (DOM events → config → render)
     ═══════════════════════════════════════════════════════════════ */

  const sidebar      = $('.sidebar');
  const fieldInputs  = sidebar.querySelectorAll('[data-field]');

  /**
   * Write a value into the config and trigger the relevant renderer(s).
   * Text fields store the raw value; display is trimmed inside each renderer.
   */
  function setField(name, value) {
    if (TEXT_FIELDS.includes(name)) {
      config[name] = safe(value);
    } else {
      config[name] = value;
    }
    (FIELD_RENDER[name] || []).forEach((fn) => fn());
    renderChecklist();
  }

  /**
   * Sync all sidebar controls to the current config.
   * Called once on init (to reflect SAMPLE values) and after every reset.
   */
  function syncControls() {
    fieldInputs.forEach((control) => {
      const field = control.dataset.field;
      if (control.type === 'radio') {
        const current = field === 'galleryLayout' ? config.gallery.layout
          : field === 'galleryOrientation' ? (config.gallery.orientation || 'horizontal')
          : config[field];
        control.checked = control.value === current;
      } else {
        control.value = safe(config[field]);
      }
    });
    // Section switches are synced by renderSectionState().
  }

  /* ── Sections panel (rows are built once from config; later updates only change state) ── */
  const sectionList = $('#section-list');
  const sectionRows = {};   // id → { li, input, hint, up, down }

  function buildSectionList() {
    sectionsSorted().forEach((x) => {
      const li = document.createElement('li');
      li.className = 'section-row';
      li.dataset.sectionId = x.id;
      li.classList.toggle('is-locked', !!x.locked);
      li.classList.toggle('is-soon', !isAvailable(x));

      const label = document.createElement('label');
      const text  = document.createElement('span');
      text.className = 'toggle-text';
      const name = document.createElement('span');
      name.textContent = x.label;
      text.append(name);
      if (!isAvailable(x)) {
        const b = document.createElement('span');
        b.className = 'badge-soon';
        b.textContent = 'Coming soon';
        text.append(b);
      } else if (x.locked) {
        const b = document.createElement('span');
        b.className = 'badge-note';
        b.textContent = 'Always on · First';
        text.append(b);
      }

      const input = document.createElement('input');
      input.className = 'switch';
      input.type = 'checkbox';
      input.setAttribute('role', 'switch');
      input.dataset.section = x.id;
      input.id = `sec-${x.id}`;
      label.append(text, input);
      li.append(label);

      const hint = document.createElement('p');
      hint.className = 'section-hint';
      hint.id = `sec-hint-${x.id}`;
      hint.hidden = true;
      input.setAttribute('aria-describedby', hint.id);
      li.append(hint);

      const row = { li, input, hint, up: null, down: null };
      if (isMovable(x)) {
        const group = document.createElement('div');
        group.className = 'section-moves';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', `Reorder ${x.label}`);
        [['up', -1, '↑ Up'], ['down', 1, '↓ Down']].forEach(([dir, step, visible]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'move-btn';
          btn.dataset.move = String(step);
          btn.setAttribute('aria-label', `Move ${x.label} ${dir}`);
          btn.textContent = visible;
          group.append(btn);
          row[dir] = btn;
        });
        li.append(group);
      }
      sectionRows[x.id] = row;
      sectionList.append(li);
    });
  }

  /** Show/hide a section. Welcome and coming-soon sections can't be toggled. */
  function setSectionEnabled(id, on) {
    const x = getSection(id);
    if (!x || !isAvailable(x) || x.locked) { renderSectionState(); return; }
    x.enabled = !!on;
    renderSectionState();
    liveStatus.textContent = `${x.label} ${x.enabled ? 'shown in' : 'hidden from'} the invitation.`;
    renderChecklist();
  }

  /* One delegated listener for every Move up / Move down button */
  sectionList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn || btn.disabled) return;
    const id  = btn.closest('[data-section-id]').dataset.sectionId;
    const dir = Number(btn.dataset.move);
    if (!moveSection(id, dir)) return;

    renderSectionOrder();
    renderSectionState();

    // Moving a node drops focus; put it back on the same direction, or the other if now disabled.
    const row = sectionRows[id];
    const [first, second] = dir < 0 ? [row.up, row.down] : [row.down, row.up];
    (first.disabled ? second : first).focus();

    const pos = sectionsSorted().filter(isAvailable).findIndex((x) => x.id === id) + 1;
    const total = sectionsSorted().filter(isAvailable).length;
    liveStatus.textContent = `${getSection(id).label} moved ${dir < 0 ? 'up' : 'down'}. Position ${pos} of ${total}.`;
  });

  /* ── Text / date / time inputs: update on every keystroke / pick ── */
  sidebar.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (field && TEXT_FIELDS.includes(field)) {
      setField(field, e.target.value);
      if (field === 'message' || field === 'note') updateCounters();
    }
  });

  /* ── Committed values (blur / select change / radio pick) ── */
  sidebar.addEventListener('change', (e) => {
    const target = e.target;
    const field  = target.dataset.field;
    const section = target.dataset.section;

    if (field && TEXT_FIELDS.includes(field)) {
      // Trim once on commit; reflect trimmed value back into the input.
      const trimmed = target.value.trim();
      if (trimmed !== target.value) target.value = trimmed;
      setField(field, trimmed);
    } else if (field === 'palette' || field === 'headingFont') {
      setField(field, target.value);
    } else if (field === 'template') {
      if (!TEMPLATES[target.value]) return;
      config.template = target.value;
      config.templateChosen = true;
      renderTemplate();
      liveStatus.textContent = `${TEMPLATES[target.value]} invitation style applied.`;
    } else if (field === 'eventType') {
      requestEventType(target.value);
    } else if (field === 'galleryLayout') {
      setGalleryMode(target.value);
    } else if (field === 'galleryOrientation') {
      setGalleryOrientation(target.value);
    } else if (section) {
      setSectionEnabled(section, target.checked);
    }
  });

  /* ── Event type presets ── */
  const eventDialog = $('#event-dialog');
  let pendingEventType = null;

  function applyEventType(type) {
    const preset = EVENT_PRESETS[type];
    if (!preset) return;
    config.eventType = type;
    PRESET_FIELDS.forEach((field) => { config[field] = preset[field] || ''; });
    if (!config.templateChosen && TEMPLATES[preset.template]) config.template = preset.template;
    syncControls();
    applyEventLabels(type);
    renderAll();
    liveStatus.textContent = `${preset.label} preset applied. Date, place, photos, and appearance were kept.`;
  }

  function requestEventType(type) {
    if (!EVENT_PRESETS[type] || type === config.eventType) {
      $('#f-event').value = config.eventType;
      return;
    }
    if (contentMatchesPreset(config.eventType) || presetFieldsBlank()) {
      applyEventType(type);
      return;
    }
    pendingEventType = type;
    $('#event-dialog-copy').textContent = `Apply the ${EVENT_PRESETS[type].label} suggestions? This replaces the host line, heading, names, and introductory message. Date, place, photos, gallery, and appearance stay as they are.`;
    if (typeof eventDialog.showModal === 'function') {
      eventDialog.returnValue = '';
      eventDialog.showModal();
    } else if (window.confirm($('#event-dialog-copy').textContent)) {
      applyEventType(type);
    } else {
      $('#f-event').value = config.eventType;
      pendingEventType = null;
    }
  }

  eventDialog.addEventListener('close', () => {
    const next = pendingEventType;
    const apply = eventDialog.returnValue === 'confirm' && next;
    pendingEventType = null;
    if (apply) applyEventType(next);
    else $('#f-event').value = config.eventType;
  });

  /* ── Device mode toggle ── */
  $('.segmented').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) setField('deviceMode', btn.dataset.mode);
  });

  $('#check-toggle').addEventListener('click', () => {
    setChecklistOpen($('#check-toggle').getAttribute('aria-expanded') !== 'true');
  });

  document.addEventListener('click', (e) => {
    if (!$('#check-pop').contains(e.target)) setChecklistOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#check-toggle').getAttribute('aria-expanded') === 'true') {
      setChecklistOpen(false);
      $('#check-toggle').focus();
    }
  });

  $('#preview-checklist').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-check-target]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.checkTarget);
    if (!target) return;
    setChecklistOpen(false);
    target.scrollIntoView({ block: 'center' });
    target.focus();
  });

  /* ── Reset ── */
  const dialog     = $('#reset-dialog');
  const resetBtn   = $('#reset-btn');

  function applyReset() {
    lightboxOpener = null;
    if (lightbox.open) lightbox.close();
    galleryPhotoId = null;
    stopCinematic();
    releaseAllUrls();
    config = clone(SAMPLE);
    syncControls();
    renderAll();
    liveStatus.textContent = 'Invitation reset to the sample.';
  }

  resetBtn.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') {
      dialog.returnValue = '';   // clear any stale value from a previous open
      dialog.showModal();
    } else {
      // Fallback for browsers that don't support <dialog> natively.
      if (window.confirm('Reset to the sample invitation? Your edits will be lost.')) {
        applyReset();
      }
    }
  });

  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'confirm') applyReset();
  });

  /* ── Photo gallery editor (local object URLs only) ── */
  const photoInput    = $('#photo-input');
  const addPhotosBtn  = $('#add-photos-btn');
  const photoList     = $('#photo-list');
  const photoEmpty    = $('#photo-empty');
  const photoCount    = $('#photo-count');
  const photoFeedback = $('#photo-feedback');
  const lightbox      = $('#gallery-lightbox');
  let lightboxOpener  = null;

  const GALLERY_MODE_LABEL = {
    cinematic: 'Cinematic',
    slideshow: 'Slide',
    grid: 'Photo Grid',
  };

  function syncGridLayoutControl() {
    const field = $('#grid-layout-field');
    if (field) field.hidden = config.gallery.layout !== 'grid';
  }

  function setGalleryOrientation(orientation) {
    if (orientation !== 'horizontal' && orientation !== 'vertical') return;
    if (config.gallery.orientation === orientation) return;
    config.gallery.orientation = orientation;
    renderGallery();
    liveStatus.textContent = `Grid layout set to ${orientation}.`;
  }

  function setGalleryMode(mode) {
    if (!GALLERY_MODE_LABEL[mode] || config.gallery.layout === mode) return;
    config.gallery.layout = mode;
    if (mode !== 'grid' && lightbox.open) {
      lightboxOpener = null;
      lightbox.close();
    }
    syncGridLayoutControl();
    renderGallery();
    liveStatus.textContent = `Gallery style set to ${GALLERY_MODE_LABEL[mode]}.`;
  }

  function stepGallery(dir) {
    const photos = photosSorted();
    const i = activeGalleryIndex(photos);
    let j = i + dir;
    if (config.gallery.layout === 'cinematic' && photos.length > 1) {
      j = (j + photos.length) % photos.length;
    }
    if (!photos.length || j < 0 || j >= photos.length || j === i) return;
    galleryPhotoId = photos[j].id;
    if (config.gallery.layout === 'cinematic') showCinematicPhoto(j, true);
    else renderGallery();
    stopCinematic();
    syncCinematic();
    const same = el.gallery.querySelector(`[data-gallery-nav="${dir}"]`);
    const other = el.gallery.querySelector(`[data-gallery-nav="${-dir}"]`);
    ((same && !same.disabled) ? same : other)?.focus();
    liveStatus.textContent = `Photo ${j + 1} of ${photos.length}.`;
  }

  function renderLightbox() {
    const photos = photosSorted();
    const i = activeGalleryIndex(photos);
    const photo = photos[i];
    const img = $('#lightbox-img');
    const title = $('#lightbox-title');
    if (!photo) {
      if (lightbox.open) lightbox.close();
      return;
    }
    galleryPhotoId = photo.id;
    img.src = photo.previewUrl;
    img.alt = photoLabel(photo, i);
    title.textContent = `${i + 1} / ${photos.length}`;
    lightbox.querySelector('[data-lightbox-nav="-1"]').disabled = i === 0;
    lightbox.querySelector('[data-lightbox-nav="1"]').disabled = i === photos.length - 1;
  }

  function openLightbox(index, opener) {
    const photos = photosSorted();
    if (!photos[index]) return;
    galleryPhotoId = photos[index].id;
    lightboxOpener = opener || null;
    renderLightbox();
    if (typeof lightbox.showModal === 'function') lightbox.showModal();
    else lightbox.setAttribute('open', '');
    lightbox.querySelector('[data-lightbox-close]').focus();
  }

  function stepLightbox(dir) {
    const photos = photosSorted();
    const i = activeGalleryIndex(photos);
    const j = i + dir;
    if (!photos.length || j < 0 || j >= photos.length) return;
    galleryPhotoId = photos[j].id;
    renderLightbox();
    liveStatus.textContent = `Photo ${j + 1} of ${photos.length}.`;
  }

  const gallerySection = sectionEls.gallery;
  gallerySection.addEventListener('pointerenter', () => setCinematicHold(true));
  gallerySection.addEventListener('pointerleave', () => {
    if (!gallerySection.contains(document.activeElement)) setCinematicHold(false);
  });
  gallerySection.addEventListener('focusin', () => setCinematicHold(true));
  gallerySection.addEventListener('focusout', (e) => {
    if (!gallerySection.contains(e.relatedTarget)) setCinematicHold(false);
  });

  el.gallery.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-gallery-nav]');
    if (nav && !nav.disabled) {
      stepGallery(Number(nav.dataset.galleryNav));
      return;
    }
    const tile = e.target.closest('[data-gallery-open]');
    if (tile) openLightbox(Number(tile.dataset.galleryOpen), tile);
  });

  el.gallery.addEventListener('keydown', (e) => {
    if (config.gallery.layout === 'grid') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepGallery(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepGallery(1); }
  });

  lightbox.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-lightbox-nav]');
    if (nav && !nav.disabled) stepLightbox(Number(nav.dataset.lightboxNav));
    if (e.target.closest('[data-lightbox-close]')) lightbox.close();
  });

  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
  });

  lightbox.addEventListener('close', () => {
    const opener = lightboxOpener;
    lightboxOpener = null;
    if (opener && document.contains(opener)) opener.focus();
  });

  function showPhotoFeedback(summary, items, ok) {
    photoFeedback.replaceChildren();
    photoFeedback.classList.toggle('is-ok', !!ok);
    if (!summary && (!items || !items.length)) {
      photoFeedback.hidden = true;
      return;
    }
    if (summary) {
      const p = document.createElement('p');
      p.textContent = summary;
      photoFeedback.append(p);
    }
    if (items && items.length) {
      const ul = document.createElement('ul');
      items.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.append(li);
      });
      photoFeedback.append(ul);
    }
    photoFeedback.hidden = false;
  }

  /** Rebuild thumbnail cards from config. Focus is restored by the caller when needed. */
  function renderPhotoPanel() {
    const photos = photosSorted();
    const n = photos.length;

    photoCount.textContent = n === 0
      ? 'No photos yet'
      : `${n} photo${n === 1 ? '' : 's'} selected${n >= GALLERY_MAX ? ' · gallery full' : n > 10 ? ' · 5–10 recommended' : ''}`;

    photoEmpty.hidden = n > 0;
    const styleNote = $('#gallery-style-note');
    if (styleNote) styleNote.hidden = n > 0;
    syncGridLayoutControl();
    addPhotosBtn.disabled = n >= GALLERY_MAX;
    addPhotosBtn.title = n >= GALLERY_MAX ? 'Gallery is full. Remove a photo to add another.' : 'Add photos';

    photoList.replaceChildren();
    photos.forEach((photo, i) => {
      const li = document.createElement('li');
      li.className = 'photo-card';
      li.dataset.photoId = photo.id;

      const img = document.createElement('img');
      img.className = 'photo-thumb';
      img.src = photo.previewUrl;
      img.alt = '';
      img.decoding = 'async';

      const meta = document.createElement('div');
      meta.className = 'photo-meta';

      const name = document.createElement('p');
      name.className = 'photo-name';
      name.textContent = clean(photo.filename) || 'Untitled photo';

      const pos = document.createElement('span');
      pos.className = 'photo-pos';
      pos.textContent = `Photo ${i + 1} of ${n}`;

      const actions = document.createElement('div');
      actions.className = 'photo-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', `Actions for ${name.textContent}`);

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'move-btn';
      up.dataset.photoMove = '-1';
      up.textContent = '↑ Up';
      up.setAttribute('aria-label', `Move ${name.textContent} up`);
      up.disabled = i === 0;

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'move-btn';
      down.dataset.photoMove = '1';
      down.textContent = '↓ Down';
      down.setAttribute('aria-label', `Move ${name.textContent} down`);
      down.disabled = i === n - 1;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'move-btn';
      remove.dataset.photoRemove = photo.id;
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${name.textContent}`);

      actions.append(up, down, remove);
      meta.append(name, pos, actions);
      li.append(img, meta);
      photoList.append(li);
    });
    renderChecklist();
  }

  function movePhoto(id, dir) {
    const list = photosSorted();
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
    return true;
  }

  function removePhoto(id) {
    const photo = config.gallery.images.find((x) => x.id === id);
    if (!photo) return false;
    config.gallery.images = config.gallery.images.filter((x) => x.id !== id);
    releaseUrl(id);
    return photo;
  }

  /**
   * Accept valid files from a selection, reject the rest with reasons.
   * Existing photos are never discarded when the gallery is full.
   */
  function addPhotoFiles(fileList) {
    const files = Array.from(fileList || []);
    photoInput.value = '';

    if (!files.length) {
      showPhotoFeedback('No photos selected.', [], false);
      liveStatus.textContent = 'No photos selected.';
      return;
    }

    const existing = new Set(config.gallery.images.map((x) => x.fingerprint));
    const seenInBatch = new Set();
    const rejected = [];
    let added = 0;
    let room = GALLERY_MAX - config.gallery.images.length;

    files.forEach((file) => {
      const label = clean(file.name) || 'Unnamed file';
      if (!isSupportedImage(file)) {
        rejected.push(`${label} isn’t a supported format. Use JPEG, PNG, or WebP.`);
        return;
      }
      if (file.size > GALLERY_MAX_BYTES) {
        rejected.push(`${label} is larger than 8 MB.`);
        return;
      }
      const fp = fileFingerprint(file);
      if (existing.has(fp) || seenInBatch.has(fp)) {
        rejected.push(`${label} is already in the gallery.`);
        return;
      }
      if (room <= 0) {
        rejected.push(`${label} wasn’t added because the gallery is full (20 photos).`);
        return;
      }

      const id = makeId();
      const previewUrl = URL.createObjectURL(file);
      objectUrls.set(id, previewUrl);
      config.gallery.images.push({
        id,
        previewUrl,
        filename: file.name,
        order: config.gallery.images.reduce((m, x) => Math.max(m, x.order), 0) + 1,
        fingerprint: fp,
      });
      existing.add(fp);
      seenInBatch.add(fp);
      room -= 1;
      added += 1;
    });

    renderGallery();
    renderPhotoPanel();
    renderSectionState();

    if (added && !rejected.length) {
      const summary = added === 1 ? '1 photo added.' : `${added} photos added.`;
      showPhotoFeedback(summary, [], true);
      liveStatus.textContent = summary;
    } else if (added && rejected.length) {
      const summary = `${added} photo${added === 1 ? '' : 's'} added. ${rejected.length} not added.`;
      showPhotoFeedback(summary, rejected, false);
      liveStatus.textContent = summary;
    } else {
      showPhotoFeedback('No valid photos were added.', rejected, false);
      liveStatus.textContent = 'No valid photos were added.';
    }
  }

  addPhotosBtn.addEventListener('click', () => {
    if (addPhotosBtn.disabled) {
      showPhotoFeedback('The gallery is full (20 photos). Remove a photo to add another.', [], false);
      return;
    }
    photoInput.click();
  });

  photoInput.addEventListener('change', () => {
    addPhotoFiles(photoInput.files);
  });

  photoList.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('[data-photo-move]');
    const removeBtn = e.target.closest('[data-photo-remove]');
    if (moveBtn && !moveBtn.disabled) {
      const id = moveBtn.closest('[data-photo-id]').dataset.photoId;
      const dir = Number(moveBtn.dataset.photoMove);
      if (!movePhoto(id, dir)) return;
      renderGallery();
      renderPhotoPanel();
      const row = photoList.querySelector(`[data-photo-id="${CSS.escape(id)}"]`);
      const next = row && row.querySelector(`[data-photo-move="${dir}"]`);
      const fallback = row && row.querySelector(`[data-photo-move="${-dir}"]`);
      ((next && !next.disabled) ? next : fallback)?.focus();
      const pos = photosSorted().findIndex((x) => x.id === id) + 1;
      const photo = config.gallery.images.find((x) => x.id === id);
      liveStatus.textContent = `${clean(photo.filename) || 'Photo'} moved ${dir < 0 ? 'up' : 'down'}. Position ${pos} of ${photosSorted().length}.`;
      return;
    }
    if (removeBtn) {
      const id = removeBtn.dataset.photoRemove;
      const photo = removePhoto(id);
      if (!photo) return;
      renderGallery();
      renderPhotoPanel();
      renderSectionState();
      if (lightbox.open) renderLightbox();
      showPhotoFeedback(`${clean(photo.filename) || 'Photo'} removed.`, [], true);
      liveStatus.textContent = `${clean(photo.filename) || 'Photo'} removed from the gallery.`;
      (photoList.querySelector('.move-btn:not(:disabled)') || addPhotosBtn).focus();
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     Initialise
     ═══════════════════════════════════════════════════════════════ */
  buildSectionList();
  syncControls();
  renderAll();

})();