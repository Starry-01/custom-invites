/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 3.8: Template & feature packs
   Phase 3.1 types stay. A template is a design system + feature pack
   (packs.js), not a skin. Personalization stays on this config.
   ───────────────────────────────────────────────────────────────
   Architecture:
     1. Configuration  — single source of truth; no DOM access
        eventType, template, theme (palette), typography, content,
        sections, gallery and photos stay independent.
     2. Rendering      — config → DOM via textContent / .hidden
     3. Controls       — DOM events → config mutation → render
   Event-type definitions describe defaults and capabilities.
   They do not become separate invitation implementations.
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
   * Shared section catalog. Event types only choose labels, order and
   * which sections start enabled. Users can still show, hide and reorder.
   *   status 'available'   → functional; can be shown/hidden (unless locked)
   *   status 'coming-soon' → not implemented; never shown, toggle disabled
   *   locked               → always on and always first (Hero)
   *   demo                 → visible, but not a real backend feature
   */
  const SECTION_META = {
    welcome:   { status: 'available',   locked: true,  demo: false },
    people:    { status: 'available',   locked: false, demo: false },
    highlight: { status: 'available',   locked: false, demo: false },
    details:   { status: 'available',   locked: false, demo: false },
    venue:     { status: 'available',   locked: false, demo: false },
    gallery:   { status: 'available',   locked: false, demo: false },
    story:     { status: 'available',   locked: false, demo: false },
    rsvp:      { status: 'available',   locked: false, demo: true  },
    countdown: { status: 'coming-soon', locked: false, demo: false },
  };

  /** Suggested section layout per event type. Data is never deleted by a switch. */
  const TYPE_SECTIONS = {
    wedding: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Couple',        enabled: true,  order: 2 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 3 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 4 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 5 },
      { id: 'story',     label: 'Love Story',    enabled: true,  order: 6 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 7 },
      { id: 'highlight', label: 'Highlight',     enabled: false, order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
    birthday: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Celebration',   enabled: true,  order: 2 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 3 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 4 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 5 },
      { id: 'story',     label: 'Wishes',        enabled: true,  order: 6 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 7 },
      { id: 'highlight', label: 'Highlight',     enabled: false, order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
    graduation: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Graduate',      enabled: true,  order: 2 },
      { id: 'story',     label: 'Achievement',   enabled: true,  order: 3 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 4 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 5 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 6 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 7 },
      { id: 'highlight', label: 'Highlight',     enabled: false, order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
    engagement: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Couple',        enabled: true,  order: 2 },
      { id: 'highlight', label: 'Celebration',   enabled: true,  order: 3 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 4 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 5 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 6 },
      { id: 'story',     label: 'Story',         enabled: true,  order: 7 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
    anniversary: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Celebrants',    enabled: true,  order: 2 },
      { id: 'story',     label: 'Milestone',     enabled: true,  order: 3 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 4 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 5 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 6 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 7 },
      { id: 'highlight', label: 'Highlight',     enabled: false, order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
    general: [
      { id: 'welcome',   label: 'Hero',          enabled: true,  order: 1 },
      { id: 'people',    label: 'Event',         enabled: true,  order: 2 },
      { id: 'details',   label: 'Event Details', enabled: true,  order: 3 },
      { id: 'venue',     label: 'Venue',         enabled: true,  order: 4 },
      { id: 'gallery',   label: 'Gallery',       enabled: true,  order: 5 },
      { id: 'story',     label: 'Message',       enabled: true,  order: 6 },
      { id: 'rsvp',      label: 'RSVP',          enabled: true,  order: 7 },
      { id: 'highlight', label: 'Highlight',     enabled: false, order: 8 },
      { id: 'countdown', label: 'Countdown',     enabled: false, order: 9 },
    ],
  };

  /**
   * Layout model (Phase 3.6)
   *   Template  → default section ORDER            (LAYOUT_ORDER)
   *   Event type → labels + default VISIBILITY     (TYPE_SECTIONS)
   *   User      → overrides, stored in config.layout:
   *                 order:      null (follow template) or a full array of section ids
   *                 visibility: { sectionId: boolean } — only ids the user changed
   * Nothing else is stored. The section list is always derived by resolveSections(),
   * so content is never touched and template / event-type changes keep the user's layout.
   */
  const LAYOUT_ORDER = {
    classic:   ['welcome', 'people', 'highlight', 'details', 'venue', 'gallery', 'story', 'rsvp', 'countdown'],
    editorial: ['welcome', 'people', 'story', 'details', 'venue', 'gallery', 'highlight', 'rsvp', 'countdown'],
    minimal:   ['welcome', 'people', 'details', 'venue', 'story', 'gallery', 'rsvp', 'highlight', 'countdown'],
    photo:     ['welcome', 'gallery', 'people', 'details', 'venue', 'story', 'highlight', 'rsvp', 'countdown'],
  };
  /** Event types whose story/achievement belongs right after the main person block. */
  const STORY_FIRST_TYPES = new Set(['graduation', 'anniversary']);
  /** At least one of these must stay visible so the invitation always carries core information. */
  const CORE_SECTIONS = ['people', 'details', 'venue'];

  function defaultOrder(type, template) {
    const pack = window.CelesticatePacks && window.CelesticatePacks.templates[template];
    const key = (pack && pack.layout) || template;
    const order = [...(LAYOUT_ORDER[key] || LAYOUT_ORDER.classic)];
    if (STORY_FIRST_TYPES.has(type)) {
      order.splice(order.indexOf('story'), 1);
      order.splice(order.indexOf('people') + 1, 0, 'story');
    }
    return order;
  }

  /** Saved order + defaults: unknown ids dropped, new ids slotted after their default predecessor. */
  function mergeOrder(saved, def) {
    const known = new Set(def);
    const out = [];
    saved.forEach((id) => { if (known.has(id) && !out.includes(id)) out.push(id); });
    def.forEach((id, i) => {
      if (out.includes(id)) return;
      let at = 0;
      for (let k = i - 1; k >= 0; k -= 1) {
        const p = out.indexOf(def[k]);
        if (p >= 0) { at = p + 1; break; }
      }
      out.splice(at, 0, id);
    });
    const w = out.indexOf('welcome');
    if (w > 0) { out.splice(w, 1); out.unshift('welcome'); }
    return out;
  }

  function typeVisibility(type) {
    const rows = TYPE_SECTIONS[type] || TYPE_SECTIONS.general;
    const vis = Object.fromEntries(rows.map((row) => [row.id, row.enabled]));
    const pack = window.CelesticatePacks && window.CelesticatePacks.templates[config.template];
    Object.entries((pack && pack.sectionDefaults) || {}).forEach(([id, on]) => {
      if (id in vis) vis[id] = !!on;
    });
    return vis;
  }

  /** Build the live section list from event type + template + user layout. */
  function resolveSections() {
    const type = config.eventType;
    const rows = TYPE_SECTIONS[type] || TYPE_SECTIONS.general;
    const defaults = typeVisibility(type);
    const layout = config.layout || { order: null, visibility: {} };
    const def = defaultOrder(type, config.template);
    const order = Array.isArray(layout.order) ? mergeOrder(layout.order, def) : def;
    return order.map((id, i) => {
      const row = rows.find((r) => r.id === id);
      const meta = SECTION_META[id];
      const override = layout.visibility && Object.prototype.hasOwnProperty.call(layout.visibility, id);
      return {
        id,
        label: row ? row.label : id,
        enabled: override ? !!layout.visibility[id] : !!defaults[id],
        order: i + 1,
        status: meta.status,
        locked: meta.locked,
        demo: meta.demo,
      };
    });
  }

  /** Drop overrides that equal the current defaults, so "customised" is always accurate. */
  function normalizeLayout() {
    const layout = config.layout;
    const def = defaultOrder(config.eventType, config.template);
    if (Array.isArray(layout.order)) {
      const merged = mergeOrder(layout.order, def);
      if (merged.every((id, i) => id === def[i])) layout.order = null;
      else layout.order = merged;
    }
    const defaults = typeVisibility(config.eventType);
    Object.keys(layout.visibility).forEach((id) => {
      if (!(id in defaults) || !!layout.visibility[id] === !!defaults[id]) delete layout.visibility[id];
    });
  }

  const layoutIsCustom = () => Array.isArray(config.layout.order) || Object.keys(config.layout.visibility).length > 0;

  /**
   * Canonical sample invitation.
   * Theme is `palette`. Typography is `typography` (preset, scale, alignment, spacing).
   * Template is independent of event type once the customer chooses one.
   */
  const SAMPLE = deepFreeze({
    eventType:    'wedding',
    names:        'Alex & Jamie',
    date:         '2027-06-12',   // ISO yyyy-mm-dd — matches <input type="date">
    time:         '',             // HH:MM or '' — matches <input type="time">; '' = hidden
    venue:        '',
    location:     'Bandung, Indonesia',
    locationNote: '',
    mapUrl:       '',
    heading:      'Together with their families',
    title:        '',
    message:      'We joyfully invite you to celebrate our wedding.',
    note:         '',
    ceremony:     'Ceremony in the garden',
    reception:    'Reception to follow',
    milestone:    '',
    school:       '',
    story:        'We met over coffee and have been writing our story ever since.',
    celebration:  '',
    palette:      'forest',       // forest | sage | midnight | custom
    customColors: {
      background: '#F5F0E8',
      primaryText: '#292723',
      secondaryText: '#68665E',
      accent: '#B49A70',
      border: '#DED7CA',
    },
    // Typography: preset/alignment null = follow the template default; anything else is a user choice.
    typography:   { preset: null, scale: 'balanced', alignment: null, spacing: 'normal' },
    template:     'classic',      // pack id from packs.js — design system, not a skin
    templateChosen: false,        // true after a manual style pick; event type will not override it
    paletteChosen: false,         // true after a manual palette or custom color; template will not override it
    galleryChosen: false,         // true after a manual gallery style; photos are never part of a pack
    openingChosen: false,         // true after a manual opening pick
    ambientChosen: false,         // true after a manual ambient pick
    layout: { order: null, visibility: {} },   // user layout overrides; null/empty = follow template + event type
    // Advanced design layer (edited only through the developer-access editor; see studio.js).
    // elements: custom items · sections: per-section overrides · order: one bottom→top layer list.
    studio: { version: 1, elements: [], sections: {}, order: [] },
    // ── Stored for later phases; no UI or renderer yet ────────────
    colors:       { background: null, text: null, accent: null, primary: null },
    // Gallery images are local object URLs. `layout` is cinematic | slideshow | grid.
    // `orientation` is the Photo Grid arrangement and is independent of the image list.
    gallery:      { layout: 'cinematic', orientation: 'horizontal', images: [] },
    coverPhotoId: null,           // DEPRECATED (Phase 4.4). The cover used to point into the gallery. Always null now.
    // Cover photo (Phase 4.4): its own upload, never part of gallery.images and never implied from the gallery.
    // { id, previewUrl, filename, fingerprint } — previewUrl is a runtime object URL and is never saved.
    cover:        null,
    action:       { enabled: true, label: 'Kindly reply', url: '' },
    deviceMode:   'mobile',       // mobile | desktop
    openingAnimation: 'none',     // none | fade | elegant-reveal | curtain | zoom | slide-up
    ambientEffect: 'none',        // none | dust | petals | leaves | mist | stars
    music: {
      enabled: false,
      sourceType: 'local',        // local now; storage later. The object URL is runtime-only.
      fileName: '',
      autoPlay: false,
      volume: 0.5,
    },
    futureFeatures: { rsvp: 'demo', music: false, publishing: false },
  });

  /** Fields whose values are freeform text (stored as strings, trimmed on commit). */
  const TEXT_FIELDS = ['names', 'date', 'time', 'venue', 'location', 'locationNote', 'mapUrl', 'heading', 'title', 'message', 'note', 'ceremony', 'reception', 'milestone', 'school', 'story', 'celebration'];

  const EVENT_PRESETS = {
    wedding: {
      label: 'Wedding', checklistLabel: 'Couple names', namesLabel: 'Names of the couple', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. Together with their families',
      titleLabel: 'Main invitation heading', storyLabel: 'Love story', storyPlaceholder: 'A short story for your guests',
      heading: 'Together with their families', title: '', names: 'Alex & Jamie',
      message: 'We joyfully invite you to celebrate our wedding.',
      ceremony: 'Ceremony in the garden', reception: 'Reception to follow',
      story: 'We met over coffee and have been writing our story ever since.',
      template: 'classic', tone: 'Elegant, romantic and refined',
    },
    birthday: {
      label: 'Birthday', checklistLabel: 'Celebrant', namesLabel: "Celebrant's name", namesPlaceholder: 'e.g. Maya',
      headingLabel: 'Host or family names', headingPlaceholder: "e.g. You're invited by",
      titleLabel: 'Celebration heading', storyLabel: 'Wishes', storyPlaceholder: 'A note guests can echo',
      milestoneLabel: 'Age or milestone', milestonePlaceholder: 'e.g. Turning 30',
      heading: "You're invited by", title: 'A birthday celebration', names: 'Maya',
      message: 'Please join us to celebrate a birthday.',
      milestone: 'A milestone birthday',
      story: 'Bring a wish, a toast, or a favourite memory.',
      template: 'celebration', tone: 'Joyful, expressive and celebratory',
    },
    graduation: {
      label: 'Graduation', checklistLabel: 'Graduate', namesLabel: "Graduate's name", namesPlaceholder: 'e.g. Alex',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. With pride and gratitude',
      titleLabel: 'Celebration heading', storyLabel: 'Achievement', storyPlaceholder: 'Degree, honour or achievement',
      schoolLabel: 'School or institution', schoolPlaceholder: 'e.g. Riverside University',
      heading: 'With pride and gratitude', title: 'A graduation celebration', names: 'Alex',
      message: 'Please join us to celebrate a graduation.',
      school: 'Riverside University',
      story: 'Bachelor of Arts, with distinction',
      template: 'editorial', tone: 'Proud, sophisticated and modern',
    },
    engagement: {
      label: 'Engagement', checklistLabel: 'Couple names', namesLabel: 'Names of the couple', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. Together with their families',
      titleLabel: 'Main invitation heading', storyLabel: 'Story', storyPlaceholder: 'How this chapter began',
      celebrationLabel: 'Engagement celebration', celebrationPlaceholder: 'How you would like to celebrate',
      heading: 'Together with their families', title: 'An engagement celebration', names: 'Alex & Jamie',
      message: 'Please join us to celebrate their engagement.',
      celebration: 'An evening to toast the newly engaged.',
      story: 'A new chapter, celebrated with the people they love.',
      template: 'editorial', tone: 'Romantic, intimate and elegant',
    },
    anniversary: {
      label: 'Anniversary', checklistLabel: 'Celebrants', namesLabel: 'Names of the celebrants', namesPlaceholder: 'e.g. Alex & Jamie',
      headingLabel: 'Host or family names', headingPlaceholder: 'e.g. With love from',
      titleLabel: 'Celebration heading', storyLabel: 'Milestone note', storyPlaceholder: 'What this anniversary marks',
      milestoneLabel: 'Anniversary milestone', milestonePlaceholder: 'e.g. 25 years',
      heading: 'With love from', title: 'An anniversary celebration', names: 'Alex & Jamie',
      message: 'Please join us to celebrate an anniversary.',
      milestone: '25 years',
      story: 'Twenty-five years of choosing each other.',
      template: 'classic', tone: 'Warm, timeless and sentimental',
    },
    general: {
      label: 'General Event', checklistLabel: 'Event title', namesLabel: 'Event title', namesPlaceholder: 'e.g. Our gathering',
      headingLabel: 'Host or family names', headingPlaceholder: "e.g. You're invited",
      titleLabel: 'Optional heading', storyLabel: 'Message', storyPlaceholder: 'Anything else guests should know',
      heading: "You're invited", title: '', names: 'Our gathering',
      message: 'Please join us for this occasion.',
      story: 'We would be glad to have you with us.',
      template: 'classic', tone: 'Flexible and adaptable',
    },
  };

  /**
   * Event types that are no longer offered. An old configuration that still names one loads as the
   * fallback type (General) instead of failing. The stored record itself is never rewritten here.
   */
  const LEGACY_EVENT_TYPES = { baby: 'general' };
  const normalizeEventType = (type) => {
    if (EVENT_PRESETS[type]) return type;
    const mapped = LEGACY_EVENT_TYPES[type];
    return EVENT_PRESETS[mapped] ? mapped : 'general';
  };

  const PRESET_FIELDS = ['heading', 'title', 'names', 'message'];
  const EXTRA_FIELDS = ['note', 'ceremony', 'reception', 'milestone', 'school', 'story', 'celebration'];

  /** Shallow clone via JSON — safe for our plain config structure. */
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Live mutable configuration. Always a full clone of SAMPLE to start. */
  let config = clone(SAMPLE);

  /* ── Section selectors (pure functions of config; no DOM) ── */
  const sectionsSorted = () => resolveSections();
  const getSection     = (id) => resolveSections().find((x) => x.id === id);
  const isAvailable    = (x) => x.status === 'available';
  const isMovable      = (x) => isAvailable(x) && !x.locked;
  const isShown        = (x) => isAvailable(x) && (x.locked || x.enabled);

  /** Swap with the neighbouring movable section and store the full order. Returns true if anything moved. */
  function moveSection(id, dir) {
    const sorted = sectionsSorted();
    const movable = sorted.filter(isMovable);
    const i = movable.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= movable.length) return false;
    const order = sorted.map((x) => x.id);
    const a = order.indexOf(movable[i].id), b = order.indexOf(movable[j].id);
    [order[a], order[b]] = [order[b], order[a]];
    config.layout.order = order;
    normalizeLayout();
    return true;
  }

  /** Public read-only API for future phases (autosave, export, etc.). */
  window.celesticate = {
    getConfig: () => {
      const snapshot = clone(config);
      snapshot.theme = {
        paletteId: snapshot.palette,
        customColors: snapshot.customColors,
      };
      const pack = window.CelesticatePacks && window.CelesticatePacks.pack(snapshot.template);
      snapshot.templateId = snapshot.template;
      snapshot.featurePack = pack ? { id: pack.id, features: pack.features } : null;
      snapshot.personalization = {
        templateChosen: !!snapshot.templateChosen,
        paletteChosen: !!snapshot.paletteChosen,
        galleryChosen: !!snapshot.galleryChosen,
        openingChosen: !!snapshot.openingChosen,
        ambientChosen: !!snapshot.ambientChosen,
      };
      snapshot.appearance = {
        openingAnimation: {
          id: snapshot.openingAnimation,
          enabled: snapshot.openingAnimation !== 'none',
        },
      };
      snapshot.music = {
        enabled: !!snapshot.music.enabled,
        sourceType: snapshot.music.sourceType || 'local',
        source: null,
        fileName: snapshot.music.fileName || '',
        autoPlay: !!snapshot.music.autoPlay,
        volume: snapshot.music.volume,
      };
      const resolvedType = resolveTypography();
      snapshot.typography = { ...snapshot.typography, effective: { preset: resolvedType.preset, alignment: resolvedType.alignment, roles: TYPE_PRESETS[resolvedType.preset] } };
      snapshot.place = {
        name: snapshot.venue,
        address: snapshot.location,
        description: snapshot.locationNote,
        mapUrl: safeMapUrl(snapshot.mapUrl),
      };
      snapshot.sections = resolveSections();
      snapshot.ambient = {
        id: snapshot.ambientEffect,
        enabled: snapshot.ambientEffect !== 'none',
      };
      return snapshot;
    },
    getSample: () => clone(SAMPLE),
    /** Phase 4.4: the editable configuration as a saveable object (no photo or music files). */
    serialize: () => serializeInvitation(),
    /** Phase 4.4: validate a saved object and open it in the editor. Returns { ok, notes, missing } or { ok:false, error }. */
    load: (saved) => loadInvitation(saved),
    /** True while the editor still holds an untouched sample invitation. */
    isPristine: () => !!initialSnapshot && JSON.stringify(serializeInvitation()) === initialSnapshot,
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
    if (!e.persisted) {
      releaseAllUrls();
      if (musicUrl) URL.revokeObjectURL(musicUrl);
    }
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

  /** Ask the advanced design layer (studio.js) to re-apply itself. No-op if it is not loaded. */
  function syncStudio() {
    if (window.CelesticateStudio) window.CelesticateStudio.apply();
  }

  /**
   * Narrow bridge for studio.js. It exposes the invitation's own state (config.studio,
   * sections, uploaded photos) so the design layer never needs a second source of truth.
   */
  window.CelesticateHost = {
    invite,
    getStudio: () => config.studio,
    setStudio: (next) => { config.studio = next; },
    sectionEl: (id) => sectionEls[id] || null,
    sections: () => resolveSections().filter(isAvailable).map((x) => ({
      id: x.id,
      label: x.label,
      shown: isShown(x) && hasContent(x.id),
    })),
    photos: () => photosSorted().map((p, i) => ({ id: p.id, previewUrl: p.previewUrl, label: photoLabel(p, i) })),
    announce: (message) => { liveStatus.textContent = message; },
    studioAccess: () => {
      const packs = window.CelesticatePacks;
      const pack = packs && packs.pack(config.template);
      const mobile = window.matchMedia('(max-width: 760px)').matches;
      const level = pack ? (mobile ? pack.features.mobileStudio : pack.features.studio) : 'none';
      const caps = (packs && packs.studioCaps[level]) || (packs && packs.studioCaps.none) || {};
      return { level: level || 'none', mobile, caps };
    },
  };

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

  function safeMapUrl(value) {
    try {
      const url = new URL(clean(value));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.href;
    } catch (err) {
      return '';
    }
  }

  const LOCATION_LABELS = {
    wedding: 'Venue',
    birthday: 'Celebration location',
    graduation: 'Venue',
    engagement: 'Venue',
    anniversary: 'Venue',
    general: 'Location',
  };

  /** Render the location card. The map URL is never shown as text. */
  function renderVenue() {
    const venue = clean(config.venue);
    const place = clean(config.location);
    const note = clean(config.locationNote);
    const mapUrl = safeMapUrl(config.mapUrl);
    const feedback = $('#map-feedback');
    if (el['venue-kicker']) el['venue-kicker'].textContent = LOCATION_LABELS[config.eventType] || 'Location';
    el.venue.textContent = venue;
    el.venue.hidden = !venue;
    el.location.textContent = place;
    el.location.hidden = !place;
    if (el['location-note']) {
      el['location-note'].textContent = note;
      el['location-note'].hidden = !note;
    }
    if (el['map-preview']) el['map-preview'].hidden = !mapUrl;
    if (el['map-link']) {
      el['map-link'].hidden = !mapUrl;
      if (mapUrl) el['map-link'].href = mapUrl;
      else el['map-link'].removeAttribute('href');
    }
    if (feedback) {
      feedback.textContent = clean(config.mapUrl) && !mapUrl ? 'That maps link is not a valid web address.' : '';
    }
  }

  function sectionLabel(id, fallback) {
    const section = getSection(id);
    return section ? section.label : fallback;
  }

  function renderPeople() {
    const milestone = clean(config.milestone);
    const school = clean(config.school);
    if (el['people-kicker']) el['people-kicker'].textContent = sectionLabel('people', 'Names');
    if (el.milestone) {
      el.milestone.textContent = milestone;
      el.milestone.hidden = !milestone;
    }
    if (el.school) {
      el.school.textContent = school;
      el.school.hidden = !school;
    }
    renderNames();
  }

  function renderStory() {
    const story = clean(config.story);
    const anniversaryMilestone = config.eventType === 'anniversary' ? clean(config.milestone) : '';
    if (el['story-kicker']) el['story-kicker'].textContent = sectionLabel('story', 'Story');
    if (el.story) {
      el.story.textContent = story || anniversaryMilestone;
      el.story.hidden = !(story || anniversaryMilestone);
    }
  }

  function renderHighlight() {
    const celebration = clean(config.celebration);
    if (el['highlight-kicker']) el['highlight-kicker'].textContent = sectionLabel('highlight', 'Celebration');
    if (el.celebration) {
      el.celebration.textContent = celebration;
      el.celebration.hidden = !celebration;
    }
  }

  function renderCeremony() {
    const ceremony = clean(config.ceremony);
    const reception = clean(config.reception);
    if (el.ceremony) {
      el.ceremony.textContent = ceremony ? `Ceremony: ${ceremony}` : '';
      el.ceremony.hidden = !ceremony;
    }
    if (el.reception) {
      el.reception.textContent = reception ? `Reception: ${reception}` : '';
      el.reception.hidden = !reception;
    }
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
    if (id === 'details') return !!(formatDate(config.date) || formatTime(config.time) || clean(config.ceremony) || clean(config.reception));
    if (id === 'venue')   return !!(clean(config.venue) || clean(config.location) || clean(config.locationNote) || safeMapUrl(config.mapUrl));
    if (id === 'gallery') return config.gallery.images.length > 0;
    if (id === 'people')  return !!(clean(config.names) || clean(config.milestone) || clean(config.school));
    if (id === 'story')   return !!clean(config.story) || (config.eventType === 'anniversary' && !!clean(config.milestone));
    if (id === 'highlight') return !!clean(config.celebration);
    if (id === 'welcome') return true;
    return true;
  }

  const EMPTY_HINTS = {
    details: 'Nothing to show yet. Add a date, time, or ceremony note above.',
    venue:   'Nothing to show yet. Add a venue or location above.',
    gallery: 'Nothing to show yet. Add photos in the Photos panel.',
    people:  'Nothing to show yet. Add a name above.',
    story:   'Nothing to show yet. Add the story or note above.',
    highlight: 'Nothing to show yet. Add a celebration note above.',
    welcome: 'Nothing to show yet. Add a host line or message above.',
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
      const packNow = window.CelesticatePacks && window.CelesticatePacks.pack(config.template);
      const blocked = !!(packNow && (
        (x.id === 'gallery' && packNow.features.gallery === false) ||
        (x.id === 'venue' && packNow.features.location === false)
      ));
      const shown = isShown(x) && !blocked;
      sectionEls[x.id].hidden = !shown || !hasContent(x.id);

      const row = sectionRows[x.id];
      if (row.name) row.name.textContent = x.label;
      row.input.checked  = shown;
      row.input.disabled = !isAvailable(x) || x.locked || blocked;
      if (isMovable(x)) row.input.setAttribute('aria-label', `${shown ? 'Hide' : 'Show'} ${x.label}`);
      row.li.classList.toggle('is-hidden', isMovable(x) && !shown);
      if (row.state) row.state.hidden = shown;

      const hint = blocked
        ? 'Not part of this style. Your content is kept.'
        : (shown && !hasContent(x.id) ? (EMPTY_HINTS[x.id] || '') : '');
      row.hint.textContent = hint;
      row.hint.hidden = !hint;

      if (row.up) {
        const i = movable.indexOf(x);
        row.up.disabled   = i <= 0;
        row.down.disabled = i < 0 || i >= movable.length - 1;
        row.up.setAttribute('aria-label', `Move ${x.label} up`);
        row.down.setAttribute('aria-label', `Move ${x.label} down`);
      }
    });
    syncLayoutControls();
    syncCinematic();
    syncStudio();
  }

  /** Apply palette token by setting data-palette on the invite card. */
  const PALETTE_DEFS = (window.CelesticatePacks && window.CelesticatePacks.palettes) || {
    forest: { label: 'Forest & Ivory', background: '#F5F0E8', primaryText: '#292723', secondaryText: '#68665E', accent: '#B49A70', border: '#DED7CA' },
  };
  const COLOR_ROLES = ['background', 'primaryText', 'secondaryText', 'accent', 'border'];
  const CUSTOM_VARS = ['--inv-bg', '--inv-ink', '--inv-muted', '--inv-accent', '--inv-accent-text', '--inv-primary', '--inv-frame', '--inv-line', '--inv-sky-1', '--inv-sky-2', '--inv-sky-3', '--inv-sun', '--inv-hill', '--inv-ground'];

  function normalizeHex(value) {
    const m = /^#?([0-9a-f]{6})$/i.exec(safe(value).trim());
    return m ? `#${m[1].toUpperCase()}` : '';
  }

  function channel(hex, i) {
    return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  }

  function luminance(hex) {
    const parts = [0, 1, 2].map((i) => {
      const c = channel(hex, i);
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  }

  function contrastRatio(a, b) {
    if (!normalizeHex(a) || !normalizeHex(b)) return 21;
    const hi = Math.max(luminance(a), luminance(b));
    const lo = Math.min(luminance(a), luminance(b));
    return (hi + 0.05) / (lo + 0.05);
  }

  function renderPalette() {
    if (!PALETTE_DEFS[config.palette] && config.palette !== 'custom') config.palette = 'forest';
    if (!config.customColors) config.customColors = { ...PALETTE_DEFS.forest };
    COLOR_ROLES.forEach((role) => {
      config.customColors[role] = normalizeHex(config.customColors[role]) || PALETTE_DEFS.forest[role];
    });
    invite.dataset.palette = config.palette;
    const opening = $('#opening');
    if (opening) opening.dataset.palette = config.palette;
    const surfaces = [invite, opening].filter(Boolean);
    if (config.palette === 'custom') {
      const c = config.customColors;
      surfaces.forEach((node) => {
        node.style.setProperty('--inv-bg', c.background);
        node.style.setProperty('--inv-ink', c.primaryText);
        node.style.setProperty('--inv-muted', c.secondaryText);
        node.style.setProperty('--inv-accent', c.accent);
        node.style.setProperty('--inv-accent-text', c.accent);
        node.style.setProperty('--inv-primary', c.accent);
        node.style.setProperty('--inv-frame', c.background);
        node.style.setProperty('--inv-line', c.border);
        node.style.setProperty('--inv-sky-1', c.background);
        node.style.setProperty('--inv-sky-2', c.border);
        node.style.setProperty('--inv-sky-3', c.secondaryText);
        node.style.setProperty('--inv-sun', c.background);
        node.style.setProperty('--inv-hill', c.accent);
        node.style.setProperty('--inv-ground', c.primaryText);
      });
    } else {
      surfaces.forEach((node) => CUSTOM_VARS.forEach((name) => node.style.removeProperty(name)));
    }
    const chip = $('#palette-custom');
    if (chip) {
      chip.style.setProperty('--inv-bg', config.customColors.background);
      chip.style.setProperty('--inv-accent', config.customColors.accent);
      chip.style.setProperty('--inv-primary', config.customColors.primaryText);
    }
    COLOR_ROLES.forEach((role) => {
      const input = document.querySelector(`[data-color="${role}"]`);
      const value = document.querySelector(`[data-color-value="${role}"]`);
      if (input) input.value = config.customColors[role];
      if (value) value.textContent = config.customColors[role];
    });
    const note = $('#contrast-note');
    if (note) {
      const c = config.customColors;
      const warnings = [];
      if (contrastRatio(c.background, c.primaryText) < 4.5) warnings.push('background and primary text');
      if (contrastRatio(c.background, c.secondaryText) < 4.5) warnings.push('background and secondary text');
      if (contrastRatio(c.background, c.accent) < 3) warnings.push('accent and background');
      const activeWarning = config.palette === 'custom' && warnings.length;
      note.hidden = !activeWarning;
      note.textContent = activeWarning
        ? `Custom palette: ${warnings.join(', ')} may be hard to read. The colors are still applied.`
        : '';
    }
  }

  function setCustomColor(role, value) {
    const hex = normalizeHex(value);
    if (!COLOR_ROLES.includes(role) || !hex) return;
    config.customColors[role] = hex;
    config.palette = 'custom';
    config.paletteChosen = true;
    const radio = document.querySelector('input[name="palette"][value="custom"]');
    if (radio) radio.checked = true;
    renderPalette();
    liveStatus.textContent = 'Custom palette applied.';
  }

  /* ═══════════════ Typography (Phase 3.7) ═══════════════
     One semantic system: a preset defines every ROLE (display, heading, subheading,
     body, label, button, caption). The user can override the preset, scale, alignment
     and letter spacing. Only the three brand fonts that are already loaded are used.
     Typography never touches template, layout, colours or content. */
  const FONT_STACKS = {
    cormorant: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
    playfair:  '"Playfair Display", Georgia, "Times New Roman", serif',
    dmsans:    '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  };
  const TYPE_PRESETS = {
    classic: {
      label: 'Classic', note: 'Elegant serif, clean sans', displayScale: 1, labelSize: 1, buttonSize: 1,
      display: { family: 'cormorant', weight: 500, style: 'normal', track: '-.01em' },
      heading: { family: 'cormorant', weight: 500, style: 'normal' },
      subheading: { family: 'cormorant', weight: 400, style: 'italic' },
      body: { family: 'dmsans', weight: 400 },
      label: { family: 'dmsans', weight: 400, style: 'normal', transform: 'uppercase', track: '.08em' },
      button: { family: 'dmsans', weight: 400, track: '.04em' },
      caption: { family: 'dmsans' },
      sample: { upper: false, line: 'Together with their families…' },
    },
    editorial: {
      label: 'Editorial', note: 'High-contrast, strong hierarchy', displayScale: .86, labelSize: 1, buttonSize: 1,
      display: { family: 'playfair', weight: 500, style: 'normal', track: '-.03em' },
      heading: { family: 'playfair', weight: 500, style: 'normal' },
      subheading: { family: 'playfair', weight: 400, style: 'italic' },
      body: { family: 'dmsans', weight: 400 },
      label: { family: 'dmsans', weight: 600, style: 'normal', transform: 'uppercase', track: '.18em' },
      button: { family: 'dmsans', weight: 600, track: '.08em' },
      caption: { family: 'dmsans' },
      sample: { upper: true, line: 'A celebration of…' },
    },
    minimal: {
      label: 'Minimal', note: 'Clean and restrained', displayScale: .8, labelSize: 1, buttonSize: 1,
      display: { family: 'dmsans', weight: 400, style: 'normal', track: '-.02em' },
      heading: { family: 'dmsans', weight: 500, style: 'normal' },
      subheading: { family: 'dmsans', weight: 400, style: 'normal' },
      body: { family: 'dmsans', weight: 400 },
      label: { family: 'dmsans', weight: 500, style: 'normal', transform: 'uppercase', track: '.1em' },
      button: { family: 'dmsans', weight: 500, track: '.04em' },
      caption: { family: 'dmsans' },
      sample: { upper: false, line: 'Wedding celebration' },
    },
    romantic: {
      label: 'Romantic', note: 'Soft italic serif', displayScale: 1.04, labelSize: 1.25, buttonSize: 1.15,
      display: { family: 'cormorant', weight: 500, style: 'italic', track: '0em' },
      heading: { family: 'cormorant', weight: 500, style: 'italic' },
      subheading: { family: 'cormorant', weight: 400, style: 'italic' },
      body: { family: 'dmsans', weight: 400 },
      label: { family: 'cormorant', weight: 500, style: 'italic', transform: 'none', track: '.02em' },
      button: { family: 'cormorant', weight: 500, track: '.02em' },
      caption: { family: 'dmsans' },
      sample: { upper: false, line: 'With love and joy…' },
    },
    modern: {
      label: 'Modern', note: 'Contemporary sans', displayScale: .82, labelSize: 1, buttonSize: 1,
      display: { family: 'dmsans', weight: 500, style: 'normal', track: '-.035em' },
      heading: { family: 'dmsans', weight: 600, style: 'normal' },
      subheading: { family: 'dmsans', weight: 400, style: 'normal' },
      body: { family: 'dmsans', weight: 400 },
      label: { family: 'dmsans', weight: 600, style: 'normal', transform: 'uppercase', track: '.12em' },
      button: { family: 'dmsans', weight: 600, track: '.06em' },
      caption: { family: 'dmsans' },
      sample: { upper: false, line: 'Join us to celebrate' },
    },
  };
  /** Friendly option → design value. Raw values never reach the UI. */
  const TYPE_SCALES  = { compact: { size: .92, display: .92 }, balanced: { size: 1, display: 1 }, spacious: { size: 1.1, display: 1.08 } };
  const TYPE_SPACING = { tight: { adj: '-.015em', body: '-.005em' }, normal: { adj: '0em', body: '0em' }, airy: { adj: '.035em', body: '.01em' } };
  const TEMPLATE_TYPE_DEFAULT  = { classic: 'classic', editorial: 'editorial', minimal: 'minimal', photo: 'classic' };
  const TEMPLATE_ALIGN_DEFAULT = { classic: 'center', editorial: 'left', minimal: 'center', photo: 'center' };

  const typographyIsCustom = () => {
    const t = config.typography;
    return t.preset !== null || t.alignment !== null || t.scale !== 'balanced' || t.spacing !== 'normal';
  };

  /** Effective typography = user choice if set, otherwise the current template's default. */
  function resolveTypography() {
    const t = config.typography || {};
    return {
      preset: TYPE_PRESETS[t.preset] ? t.preset : ((window.CelesticatePacks && window.CelesticatePacks.pack(config.template).typography) || TEMPLATE_TYPE_DEFAULT[config.template] || 'classic'),
      alignment: ['left', 'center', 'right'].includes(t.alignment) ? t.alignment : ((window.CelesticatePacks && window.CelesticatePacks.pack(config.template).alignment) || TEMPLATE_ALIGN_DEFAULT[config.template] || 'center'),
      scale: TYPE_SCALES[t.scale] ? t.scale : 'balanced',
      spacing: TYPE_SPACING[t.spacing] ? t.spacing : 'normal',
      userPreset: !!TYPE_PRESETS[t.preset],
    };
  }

  const typePresetList = $('#type-presets');
  const typeResetBtn = $('#type-reset');
  const typeState = $('#type-state');

  function buildTypePresets() {
    if (!typePresetList) return;
    Object.entries(TYPE_PRESETS).forEach(([id, p]) => {
      const label = document.createElement('label');
      label.className = 'style-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'typePreset';
      input.value = id;
      input.dataset.typo = 'preset';
      const chip = document.createElement('span');
      chip.className = 'style-chip type-chip';
      const head = document.createElement('span');
      head.className = 'type-chip-head';
      const name = document.createElement('strong');
      name.textContent = p.label;
      const note = document.createElement('span');
      note.className = 'type-chip-note';
      note.textContent = p.note;
      head.append(name, note);

      const sample = document.createElement('span');
      sample.className = 'type-sample';
      sample.setAttribute('aria-hidden', 'true');
      const t1 = document.createElement('span');
      t1.className = 't1';
      t1.textContent = p.sample.upper ? 'ALEX & JAMIE' : 'Alex & Jamie';
      Object.assign(t1.style, { fontFamily: FONT_STACKS[p.display.family], fontWeight: p.display.weight, fontStyle: p.display.style, letterSpacing: p.sample.upper ? '.06em' : p.display.track });
      const t2 = document.createElement('span');
      t2.className = 't2';
      t2.textContent = p.sample.upper ? '12 JUNE 2027' : '12 June 2027';
      Object.assign(t2.style, { fontFamily: FONT_STACKS[p.heading.family], fontWeight: p.heading.weight, fontStyle: p.heading.style, letterSpacing: p.sample.upper ? '.12em' : '0' });
      const t3 = document.createElement('span');
      t3.className = 't3';
      t3.textContent = p.sample.line;
      Object.assign(t3.style, { fontFamily: FONT_STACKS[p.subheading.family], fontWeight: p.subheading.weight, fontStyle: p.subheading.style });
      sample.append(t1, t2, t3);

      chip.append(head, sample);
      label.append(input, chip);
      typePresetList.append(label);
    });
  }

  function syncTypographyControls(t) {
    document.querySelectorAll('[data-typo]').forEach((input) => {
      const key = input.dataset.typo;
      input.checked = input.value === (key === 'preset' ? t.preset : key === 'alignment' ? t.alignment : key === 'scale' ? t.scale : t.spacing);
    });
    if (typeResetBtn) typeResetBtn.disabled = !typographyIsCustom();
    if (typeState) {
      const defId = (window.CelesticatePacks && window.CelesticatePacks.pack(config.template).typography) || TEMPLATE_TYPE_DEFAULT[config.template] || 'classic';
      const defName = (TYPE_PRESETS[defId] || TYPE_PRESETS.classic).label;
      typeState.textContent = t.userPreset
        ? `Your choice: ${TYPE_PRESETS[t.preset].label}. It stays when you change the template.`
        : `Following the ${defName} template default.`;
    }
  }

  /** Write the resolved typography onto the invitation as CSS variables. Only #invite is touched. */
  function renderTypography() {
    const t = resolveTypography();
    const p = TYPE_PRESETS[t.preset];
    const scale = TYPE_SCALES[t.scale];
    const spacing = TYPE_SPACING[t.spacing];
    const set = (name, value) => invite.style.setProperty(name, String(value));
    set('--ty-display-font', FONT_STACKS[p.display.family]);
    set('--ty-display-weight', p.display.weight);
    set('--ty-display-style', p.display.style);
    set('--ty-display-track', p.display.track);
    set('--ty-heading-font', FONT_STACKS[p.heading.family]);
    set('--ty-heading-weight', p.heading.weight);
    set('--ty-heading-style', p.heading.style);
    set('--ty-sub-font', FONT_STACKS[p.subheading.family]);
    set('--ty-sub-weight', p.subheading.weight);
    set('--ty-sub-style', p.subheading.style);
    set('--ty-body-font', FONT_STACKS[p.body.family]);
    set('--ty-label-font', FONT_STACKS[p.label.family]);
    set('--ty-label-weight', p.label.weight);
    set('--ty-label-style', p.label.style);
    set('--ty-label-transform', p.label.transform);
    set('--ty-label-track', p.label.track);
    set('--ty-label-size', p.labelSize);
    set('--ty-button-font', FONT_STACKS[p.button.family]);
    set('--ty-button-weight', p.button.weight);
    set('--ty-button-track', p.button.track);
    set('--ty-button-size', p.buttonSize);
    set('--ty-caption-font', FONT_STACKS[p.caption.family]);
    set('--ty-scale', scale.size);
    set('--ty-adj', spacing.adj);
    set('--ty-adj-body', spacing.body);
    set('--inv-heading', FONT_STACKS[p.heading.family]);
    set('--inv-names-scale', (p.displayScale * scale.display).toFixed(3));
    invite.dataset.type = t.preset;
    invite.dataset.align = t.alignment;
    syncTypographyControls(t);
  }

  function setTypography(key, value) {
    const valid = key === 'preset' ? TYPE_PRESETS[value]
      : key === 'alignment' ? ['left', 'center', 'right'].includes(value)
      : key === 'scale' ? TYPE_SCALES[value]
      : key === 'spacing' ? TYPE_SPACING[value] : false;
    if (!valid) return;
    config.typography[key] = value;
    renderTypography();
    const names = { preset: 'Typography', alignment: 'Text alignment', scale: 'Text size', spacing: 'Letter spacing' };
    liveStatus.textContent = `${names[key]} set to ${key === 'preset' ? TYPE_PRESETS[value].label : value}.`;
  }

  function resetTypography() {
    config.typography = { preset: null, scale: 'balanced', alignment: null, spacing: 'normal' };
    renderTypography();
    liveStatus.textContent = 'Typography reset to the template default.';
  }

  buildTypePresets();
  const typeCard = $('#typography-card');
  if (typeCard) {
    typeCard.addEventListener('change', (e) => {
      const input = e.target.closest('[data-typo]');
      if (input) setTypography(input.dataset.typo, input.value);
    });
  }
  if (typeResetBtn) typeResetBtn.addEventListener('click', () => { if (typographyIsCustom()) resetTypography(); });

  /** Labels for status text. The pack registry in packs.js is the source of truth. */
  const TEMPLATES = Object.fromEntries(Object.entries((window.CelesticatePacks && window.CelesticatePacks.templates) || {}).map(([id, def]) => [id, def.name]));
  if (!TEMPLATES.classic) TEMPLATES.classic = 'Classic';

  function coverPhoto() {
    return config.cover && config.cover.previewUrl ? config.cover : null;
  }

  const PACK_GAPS = { compact: '8px', balanced: '12px', spacious: '20px' };

  function renderTemplate() {
    const pack = (window.CelesticatePacks && window.CelesticatePacks.pack(config.template)) || { id: 'classic', family: 'classic', hero: 'framed', spacing: 'balanced' };
    if (!TEMPLATES[config.template]) config.template = 'classic';
    invite.dataset.template = config.template;
    invite.dataset.family = pack.family || pack.id;
    invite.dataset.hero = pack.hero || 'framed';
    invite.style.setProperty('--inv-gap', PACK_GAPS[pack.spacing] || PACK_GAPS.balanced);
    const hero = $('#hero-photo');
    const photo = coverPhoto();
    invite.dataset.hasCover = photo ? 'true' : 'false';
    if (!hero) return;
    hero.hidden = !photo;
    if (photo) {
      hero.src = photo.previewUrl;
      hero.alt = 'Cover photo';
    } else {
      hero.removeAttribute('src');
      hero.alt = '';
    }
  }

  const OPENING_STYLES = {
    none: 'None',
    fade: 'Fade In',
    'elegant-reveal': 'Elegant Reveal',
    curtain: 'Curtain',
    zoom: 'Zoom In',
    'slide-up': 'Slide Up',
  };
  let openingTimer = null;

  function effectiveOpening() {
    const pack = window.CelesticatePacks && window.CelesticatePacks.pack(config.template);
    if (pack && pack.features.animation === false) return 'none';
    return OPENING_STYLES[config.openingAnimation] ? config.openingAnimation : 'none';
  }

  function renderOpeningControl() {
    const id = effectiveOpening();
    if (OPENING_STYLES[config.openingAnimation]) { /* keep a stored choice even if this pack hides animation */ }
    else config.openingAnimation = 'none';
    const layer = $('#opening');
    if (layer && layer.dataset.playing !== 'true') layer.dataset.opening = id;
    const btn = $('#preview-opening');
    if (btn) {
      btn.disabled = id === 'none';
      btn.title = id === 'none' ? 'Choose an opening animation to preview it.' : 'Replay the opening animation';
    }
  }

  function stopOpening() {
    if (openingTimer) clearTimeout(openingTimer);
    openingTimer = null;
    const layer = $('#opening');
    const skip = $('#opening-skip');
    if (layer) {
      layer.dataset.playing = 'false';
      layer.dataset.opening = OPENING_STYLES[config.openingAnimation] ? config.openingAnimation : 'none';
    }
    if (skip) skip.hidden = true;
  }

  function playOpening() {
    const id = effectiveOpening();
    if (id === 'none') return;
    const layer = $('#opening');
    if (!layer) return;
    stopOpening();
    layer.dataset.opening = reducedMotion() ? 'fade' : id;
    layer.dataset.playing = 'false';
    void layer.offsetWidth;
    layer.dataset.playing = 'true';
    const skip = $('#opening-skip');
    if (skip) skip.hidden = false;
    openingTimer = setTimeout(stopOpening, reducedMotion() ? 180 : 1850);
    liveStatus.textContent = reducedMotion()
      ? 'Reduced motion is on, so the opening is a short fade.'
      : `${OPENING_STYLES[id]} opening preview.`;
  }
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
    const preset = EVENT_PRESETS[config.eventType] || EVENT_PRESETS.general;
    const hasPlace = !!(clean(config.venue) || clean(config.location) || clean(config.locationNote) || safeMapUrl(config.mapUrl));
    const shows = (id) => { const x = getSection(id); return !!x && isShown(x); };
    const items = [
      { label: preset.checklistLabel || 'Names', ok: !!clean(config.names), target: 'f-names' },
      // Hidden sections are optional, not "missing".
      shows('details') && { label: 'Event date', ok: !!formatDate(config.date), target: 'f-date' },
      shows('venue') && { label: 'Venue or location', ok: hasPlace, target: 'f-venue' },
      shows('gallery') && { label: 'Gallery photo', ok: config.gallery.images.length > 0, target: 'add-photos-btn' },
      { label: 'Opening style', ok: !!OPENING_STYLES[config.openingAnimation], target: 'f-opening' },
      { label: 'Music', ok: !config.music.enabled || !!config.music.fileName, target: 'music-enabled' },
      { label: 'Ambient effect', ok: !!AMBIENT_EFFECTS[config.ambientEffect], target: 'f-ambient' },
    ].filter(Boolean);
    const total = items.length;
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
    if (count) count.textContent = `${done}/${total}`;
    if (summary) summary.textContent = `${done} of ${total} complete`;
    if (toggle) toggle.setAttribute('aria-label', `Preview checklist, ${done} of ${total} complete`);
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
    invite.dataset.event = EVENT_PRESETS[config.eventType] ? config.eventType : 'general';
    invite.setAttribute('aria-label', `${preset ? preset.label : 'Event'} invitation preview`);
    if (el['rsvp-kicker']) el['rsvp-kicker'].textContent = sectionLabel('rsvp', 'RSVP');
  }

  function updateCounters() {
    [['message', 160], ['note', 200], ['story', 280]].forEach(([name, max]) => {
      const node = document.getElementById(`count-${name}`);
      const input = document.getElementById(`f-${name}`);
      if (node && input) node.textContent = `${input.value.length} / ${max}`;
    });
  }

  function applyEventLabels(type) {
    const preset = EVENT_PRESETS[type] || EVENT_PRESETS.general;
    $('#label-names').textContent = preset.namesLabel;
    $('#label-venue').textContent = LOCATION_LABELS[type] || 'Location';
    $('#f-names').placeholder = preset.namesPlaceholder;
    $('#label-heading').textContent = preset.headingLabel;
    $('#f-heading').placeholder = preset.headingPlaceholder;
    if ($('#label-title') && preset.titleLabel) $('#label-title').textContent = preset.titleLabel;
    if ($('#label-story')) {
      $('#label-story').textContent = preset.storyLabel || 'Story';
      $('#f-story').placeholder = preset.storyPlaceholder || 'A short note for your guests';
    }
    if ($('#label-milestone') && preset.milestoneLabel) {
      $('#label-milestone').textContent = preset.milestoneLabel;
      $('#f-milestone').placeholder = preset.milestonePlaceholder || '';
    }
    if ($('#label-school') && preset.schoolLabel) {
      $('#label-school').textContent = preset.schoolLabel;
      $('#f-school').placeholder = preset.schoolPlaceholder || '';
    }
    if ($('#label-celebration') && preset.celebrationLabel) {
      $('#label-celebration').textContent = preset.celebrationLabel;
      $('#f-celebration').placeholder = preset.celebrationPlaceholder || '';
    }
    const hint = $('#event-hint');
    const suggestedId = (window.CelesticatePacks && window.CelesticatePacks.typeDefault[type]) || preset.template;
    const templateName = TEMPLATES[suggestedId] || 'Classic';
    const current = window.CelesticatePacks && window.CelesticatePacks.pack(config.template);
    const fits = current && current.invitationTypes.includes(type);
    if (hint) {
      hint.textContent = config.templateChosen && !fits
        ? `${preset.tone}. ${current.name} is kept from another invitation type. Pick a ${preset.label.toLowerCase()} style to switch.`
        : config.templateChosen
          ? `${preset.tone}. Suggested style is ${templateName}; your chosen style stays.`
          : `${preset.tone}. Suggested style: ${templateName}.`;
    }
  }

  /** Hide irrelevant editor fields without deleting their stored values. */
  function renderFieldVisibility() {
    document.querySelectorAll('[data-events]').forEach((node) => {
      const types = node.dataset.events.split(/\s+/);
      let show = types.includes(config.eventType);
      const highlight = getSection('highlight');
      if (node.querySelector('#f-celebration') && highlight && highlight.enabled) show = true;
      node.hidden = !show;
    });
    const celebrationLabel = $('#label-celebration');
    if (celebrationLabel) {
      const preset = EVENT_PRESETS[config.eventType] || EVENT_PRESETS.general;
      celebrationLabel.textContent = config.eventType === 'engagement'
        ? (preset.celebrationLabel || 'Engagement celebration')
        : 'Highlight note';
    }
  }

  function contentMatchesPreset(type) {
    const preset = EVENT_PRESETS[type];
    if (!preset) return false;
    return PRESET_FIELDS.every((field) => clean(config[field]) === clean(preset[field] || ''));
  }

  function extraMatchesPreset(type) {
    const preset = EVENT_PRESETS[type];
    if (!preset) return false;
    return EXTRA_FIELDS.every((field) => clean(config[field]) === clean(preset[field] || ''));
  }

  /** True when the user has not arranged the layout themselves. */
  function sectionsMatchDefaults() {
    return !layoutIsCustom();
  }

  function presetFieldsBlank() {
    return PRESET_FIELDS.every((field) => !clean(config[field]))
      && EXTRA_FIELDS.every((field) => !clean(config[field]));
  }

  /** Event type / template changes keep the user's layout; only stale overrides are tidied. */
  function applySectionDefaults() {
    normalizeLayout();
  }

  /** Full render — call once on init and after a reset. */
  function renderAll() {
    renderNames();
    renderDate();
    renderTime();
    renderWelcome();
    renderTitle();
    renderVenue();
    renderPeople();
    renderStory();
    renderHighlight();
    renderCeremony();
    renderGallery();
    renderSectionOrder();
    renderSectionState();
    renderPalette();
    renderTemplate();
    renderTypography();
    renderDeviceMode();
    renderOpeningControl();
    renderMusic();
    renderAmbient();
    renderLabel();
    renderPhotoPanel();
    renderChecklist();
    applyEventLabels(config.eventType);
    renderFieldVisibility();
    renderPackControls();
    updateCounters();
  }

  /**
   * Map from config field name → render function(s) to call on targeted updates.
   * Keeping this explicit prevents over-rendering on every keystroke.
   */
  const FIELD_RENDER = {
    names:       [renderPeople, renderSectionState],
    date:        [renderDate, renderSectionState],
    time:        [renderTime, renderSectionState],
    venue:       [renderVenue, renderSectionState],
    location:    [renderVenue, renderSectionState],
    locationNote:[renderVenue, renderSectionState],
    mapUrl:      [renderVenue, renderSectionState],
    heading:     [renderWelcome, renderSectionState],
    title:       [renderTitle, renderWelcome, renderSectionState],
    message:     [renderWelcome, renderSectionState],
    note:        [renderWelcome, renderSectionState],
    ceremony:    [renderCeremony, renderSectionState],
    reception:   [renderCeremony, renderSectionState],
    milestone:   [renderPeople, renderStory, renderSectionState],
    school:      [renderPeople, renderSectionState],
    story:       [renderStory, renderSectionState],
    celebration: [renderHighlight, renderSectionState],
    palette:     [renderPalette],
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
    sidebar.querySelectorAll('[data-field]').forEach((control) => {
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
      name.className = 'section-name';
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
      } else if (x.demo) {
        const b = document.createElement('span');
        b.className = 'badge-demo';
        b.textContent = 'Demo';
        text.append(b);
      }

      let state = null;
      if (isMovable(x)) {
        state = document.createElement('span');
        state.className = 'badge-note badge-hidden';
        state.textContent = 'Hidden';
        state.hidden = true;
        text.append(state);
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

      const row = { li, input, hint, up: null, down: null, name, state };
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
    // Keep at least one core information section visible.
    if (!on && CORE_SECTIONS.includes(id)) {
      const otherCore = CORE_SECTIONS.some((cid) => cid !== id && isShown(getSection(cid)));
      if (!otherCore) {
        renderSectionState();
        showLayoutNote('Keep at least one of the main sections visible: Names, Event Details or Venue.');
        return;
      }
    }
    config.layout.visibility[id] = !!on;
    normalizeLayout();
    showLayoutNote('');
    renderSectionState();
    renderFieldVisibility();
    liveStatus.textContent = `${x.label} ${on ? 'shown in' : 'hidden from'} the invitation.`;
    renderChecklist();
  }

  /* Layout reset: two-step inline confirmation, layout only. Content, photos, music, colours stay. */
  const layoutResetBtn = $('#layout-reset');
  const layoutNote = $('#layout-note');
  let layoutResetTimer = null;

  function showLayoutNote(message) {
    if (!layoutNote) return;
    layoutNote.textContent = message;
    layoutNote.hidden = !message;
  }

  function disarmLayoutReset() {
    clearTimeout(layoutResetTimer);
    layoutResetTimer = null;
    if (!layoutResetBtn) return;
    layoutResetBtn.textContent = 'Reset layout';
    layoutResetBtn.removeAttribute('data-armed');
  }

  function syncLayoutControls() {
    if (!layoutResetBtn) return;
    const custom = layoutIsCustom();
    layoutResetBtn.disabled = !custom;
    if (!custom) disarmLayoutReset();
  }

  /** Re-render everything that depends on section order / visibility. */
  function renderLayout() {
    renderSectionOrder();
    renderSectionState();
    renderFieldVisibility();
    renderChecklist();
  }

  function resetLayout() {
    config.layout = { order: null, visibility: {} };
    disarmLayoutReset();
    showLayoutNote('');
    renderLayout();
    liveStatus.textContent = 'Layout reset to the template default.';
  }

  if (layoutResetBtn) {
    layoutResetBtn.addEventListener('click', () => {
      if (!layoutIsCustom()) return;
      if (layoutResetBtn.dataset.armed) { resetLayout(); return; }
      layoutResetBtn.dataset.armed = 'true';
      layoutResetBtn.textContent = 'Confirm reset';
      layoutResetTimer = setTimeout(disarmLayoutReset, 4000);
    });
    layoutResetBtn.addEventListener('blur', disarmLayoutReset);
  }

  /* One delegated listener for every Move up / Move down button */
  sectionList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn || btn.disabled) return;
    const id  = btn.closest('[data-section-id]').dataset.sectionId;
    const dir = Number(btn.dataset.move);
    if (!moveSection(id, dir)) return;

    showLayoutNote('');
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
    if (e.target.dataset.color) {
      setCustomColor(e.target.dataset.color, e.target.value);
      return;
    }
    const field = e.target.dataset.field;
    if (field && TEXT_FIELDS.includes(field)) {
      setField(field, e.target.value);
      if (field === 'message' || field === 'note' || field === 'story') updateCounters();
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
    } else if (field === 'palette') {
      config.paletteChosen = true;
      setField(field, target.value);
      renderPackControls();
    } else if (field === 'template') {
      if (!TEMPLATES[target.value]) return;
      selectTemplate(target.value);
    } else if (field === 'openingAnimation') {
      if (!OPENING_STYLES[target.value]) return;
      config.openingChosen = true;
      config.openingAnimation = target.value;
      stopOpening();
      renderOpeningControl();
      renderChecklist();
      liveStatus.textContent = `${OPENING_STYLES[target.value]} opening selected.`;
    } else if (field === 'ambientEffect') {
      if (!AMBIENT_EFFECTS[target.value]) return;
      config.ambientChosen = true;
      config.ambientEffect = target.value;
      renderAmbient();
      renderChecklist();
      liveStatus.textContent = `${AMBIENT_EFFECTS[target.value]} is showing in the preview.`;
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
    const previous = EVENT_PRESETS[config.eventType] || {};
    if (!preset) return;
    config.eventType = type;
    PRESET_FIELDS.forEach((field) => { config[field] = preset[field] || ''; });
    EXTRA_FIELDS.forEach((field) => {
      const current = clean(config[field]);
      const previousDefault = clean(previous[field] || '');
      if (!current || current === previousDefault) config[field] = preset[field] || '';
    });
    const suggested = (window.CelesticatePacks && window.CelesticatePacks.typeDefault[type]) || preset.template;
    if (!config.templateChosen && TEMPLATES[suggested]) config.template = suggested;
    applyTemplatePresentation();
    applySectionDefaults();
    syncControls();
    applyEventLabels(type);
    renderAll();
    liveStatus.textContent = `${preset.label} suggestions applied. Photos, a theme or style you chose, and your content were kept.`;
    if (window.CelesticateStudio && window.CelesticateStudio.syncAccess) window.CelesticateStudio.syncAccess();
  }

  function requestEventType(type) {
    if (!EVENT_PRESETS[type] || type === config.eventType) {
      $('#f-event').value = config.eventType;
      return;
    }
    const untouched = (contentMatchesPreset(config.eventType) && extraMatchesPreset(config.eventType) && sectionsMatchDefaults(config.eventType))
      || presetFieldsBlank();
    if (untouched) {
      applyEventType(type);
      return;
    }
    pendingEventType = type;
    $('#event-dialog-copy').textContent = `Some suggested content and sections may change to better fit a ${EVENT_PRESETS[type].label.toLowerCase()}. Your existing photos, theme, typography, gallery settings, and a style you chose yourself will remain.`;
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
    releaseMusic();
    config = clone(SAMPLE);
    syncControls();
    renderAll();
    if (window.CelesticateShare) window.CelesticateShare.newDraft();   // a reset invitation is a new draft
    liveStatus.textContent = 'Invitation reset to the sample.';
    // Phase 4.4: a reset invitation is a new draft, so it must not stay tied to a saved record.
    document.dispatchEvent(new CustomEvent('celesticate:reset'));
  }

  /* ── Phase 4.4: save / restore the structured invitation ──
     Only the editable configuration is saved. Photo files (gallery and cover) and the music file are
     runtime-only until photo storage exists, so they are saved as references and reported back as
     "missing" when an invitation is opened. Everything loaded is validated; nothing is trusted. */
  const SCHEMA_VERSION = 1;
  let initialSnapshot = '';
  const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function serializeInvitation() {
    const c = clone(config);
    c.gallery.images = c.gallery.images.map((p) => ({ id: p.id, filename: p.filename || '', order: p.order, fingerprint: p.fingerprint || '' }));
    c.cover = c.cover ? { id: c.cover.id, filename: c.cover.filename || '', fingerprint: c.cover.fingerprint || '' } : null;
    c.music = {
      enabled: !!config.music.enabled,
      sourceType: 'local',
      fileName: config.music.fileName || '',
      autoPlay: !!config.music.autoPlay,
      volume: config.music.volume,
    };
    return { schemaVersion: SCHEMA_VERSION, config: c };
  }

  function loadInvitation(saved) {
    if (!isPlain(saved) || !isPlain(saved.config)) return { ok: false, error: 'This saved invitation could not be read.' };
    if (Number(saved.schemaVersion) > SCHEMA_VERSION) return { ok: false, error: 'This invitation was saved by a newer version of the editor and cannot be opened here yet.' };
    const src = saved.config;
    const next = clone(SAMPLE);
    const notes = [];
    const missing = [];

    TEXT_FIELDS.forEach((field) => {
      if (typeof src[field] !== 'string') return;
      const control = sidebar.querySelector(`[data-field="${field}"]`);
      next[field] = src[field].slice(0, control && control.maxLength > 0 ? control.maxLength : 1000);
    });

    const rawType = typeof src.eventType === 'string' ? src.eventType : 'general';
    next.eventType = normalizeEventType(rawType);
    if (rawType !== next.eventType) {
      notes.push(rawType === 'baby'
        ? 'Baby shower invitations are no longer offered, so this one now uses the General event type.'
        : 'The event type was not recognised, so this invitation now uses General.');
    }

    const packs = window.CelesticatePacks;
    const offered = packs ? packs.forType(next.eventType).map((p) => p.id) : [];
    let template = typeof src.template === 'string' && TEMPLATES[src.template] ? src.template : null;
    if (template && offered.length && !offered.includes(template)) {
      notes.push('The saved style is no longer offered for this event type, so the default style was used.');
      template = null;
    }
    if (template) {
      next.template = template;
      next.templateChosen = !!src.templateChosen;
    } else {
      const fallback = (packs && packs.typeDefault[next.eventType]) || 'classic';
      next.template = TEMPLATES[fallback] ? fallback : 'classic';
      next.templateChosen = false;
    }

    next.palette = PALETTE_DEFS[src.palette] || src.palette === 'custom' ? src.palette : 'forest';
    if (isPlain(src.customColors)) COLOR_ROLES.forEach((role) => { const hex = normalizeHex(src.customColors[role]); if (hex) next.customColors[role] = hex; });
    next.paletteChosen = !!src.paletteChosen;
    next.galleryChosen = !!src.galleryChosen;
    next.openingChosen = !!src.openingChosen;
    next.ambientChosen = !!src.ambientChosen;

    const t = isPlain(src.typography) ? src.typography : {};
    next.typography = {
      preset: TYPE_PRESETS[t.preset] ? t.preset : null,
      scale: TYPE_SCALES[t.scale] ? t.scale : 'balanced',
      alignment: ['left', 'center', 'right'].includes(t.alignment) ? t.alignment : null,
      spacing: TYPE_SPACING[t.spacing] ? t.spacing : 'normal',
    };

    const known = Object.keys(SECTION_META);
    const layout = isPlain(src.layout) ? src.layout : {};
    next.layout = { order: Array.isArray(layout.order) ? [...new Set(layout.order.filter((id) => known.includes(id)))] : null, visibility: {} };
    if (isPlain(layout.visibility)) known.forEach((id) => { if (typeof layout.visibility[id] === 'boolean') next.layout.visibility[id] = layout.visibility[id]; });

    const g = isPlain(src.gallery) ? src.gallery : {};
    next.gallery = {
      layout: ['cinematic', 'slideshow', 'grid'].includes(g.layout) ? g.layout : 'cinematic',
      orientation: ['horizontal', 'vertical'].includes(g.orientation) ? g.orientation : 'horizontal',
      images: [],
    };
    (Array.isArray(g.images) ? g.images : []).slice(0, GALLERY_MAX).forEach((p) => {
      if (isPlain(p)) missing.push({ role: 'gallery', id: String(p.id || '').slice(0, 80), filename: String(p.filename || '').slice(0, 200) });
    });
    next.cover = null;
    if (isPlain(src.cover)) missing.push({ role: 'cover', id: String(src.cover.id || '').slice(0, 80), filename: String(src.cover.filename || '').slice(0, 200) });

    const a = isPlain(src.action) ? src.action : {};
    next.action = {
      enabled: typeof a.enabled === 'boolean' ? a.enabled : true,
      label: typeof a.label === 'string' ? a.label.slice(0, 40) : 'Kindly reply',
      url: typeof a.url === 'string' ? a.url.slice(0, 500) : '',
    };
    next.deviceMode = src.deviceMode === 'desktop' ? 'desktop' : 'mobile';
    next.openingAnimation = OPENING_STYLES[src.openingAnimation] ? src.openingAnimation : 'none';
    next.ambientEffect = AMBIENT_EFFECTS[src.ambientEffect] ? src.ambientEffect : 'none';

    const m = isPlain(src.music) ? src.music : {};
    next.music = {
      enabled: !!m.enabled,
      sourceType: 'local',
      fileName: '',
      autoPlay: !!m.autoPlay,
      volume: typeof m.volume === 'number' && m.volume >= 0 && m.volume <= 1 ? m.volume : 0.5,
    };
    if (m.fileName) missing.push({ role: 'music', id: '', filename: String(m.fileName).slice(0, 200) });

    const st = isPlain(src.studio) ? src.studio : {};
    next.studio = {
      version: 1,
      elements: (Array.isArray(st.elements) ? st.elements : [])
        .filter((e) => isPlain(e) && typeof e.id === 'string' && ['text', 'image', 'shape', 'decor'].includes(e.type)).slice(0, 100),
      sections: isPlain(st.sections) ? st.sections : {},
      order: Array.isArray(st.order) ? st.order.filter((id) => typeof id === 'string') : [],
    };

    lightboxOpener = null;
    if (lightbox.open) lightbox.close();
    galleryPhotoId = null;
    stopCinematic();
    releaseAllUrls();
    releaseMusic();
    config = next;
    normalizeLayout();
    applyTemplatePresentation();
    syncControls();
    renderAll();
    if (window.CelesticateStudio && window.CelesticateStudio.apply) window.CelesticateStudio.apply();
    if (window.CelesticateStudio && window.CelesticateStudio.syncAccess) window.CelesticateStudio.syncAccess();
    liveStatus.textContent = 'Saved invitation opened.';
    return { ok: true, notes, missing };
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

  const AMBIENT_EFFECTS = {
    none: 'None',
    dust: 'Golden Dust',
    petals: 'Falling Petals',
    leaves: 'Floating Leaves',
    mist: 'Mist / Haze',
    stars: 'Twinkling Stars',
  };
  // Counts stay small. Narrow invitations use a few fewer bits, never zero.
  const AMBIENT_COUNT = { dust: 24, petals: 14, leaves: 11, mist: 5, stars: 26 };
  const AMBIENT_ALIASES = { sparkles: 'dust', bubbles: 'dust', snow: 'mist' };
  const AMBIENT_SHAPES = {
    stars: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.2 13.4 9.2 21.6 12 13.4 14.8 12 22.8 10.6 14.8 2.4 12 10.6 9.2Z"/></svg>',
    leaves: '<svg viewBox="0 0 28 16" aria-hidden="true"><path d="M2 8c5-6 14-6 24 0-9 6-19 6-24 0Z"/><path d="M6 8h16" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    petals: '<svg viewBox="0 0 16 22" aria-hidden="true"><path d="M8 1c4 4 6 8 6 12a6 6 0 0 1-12 0c0-4 2-8 6-12Z"/></svg>',
  };
  const AMBIENT_MOVING = new Set(['ambient-wind', 'ambient-fall', 'ambient-dust', 'ambient-twinkle']);
  const MIST_PLACES = [
    { top: '-8%', left: '-18%', width: '78%', height: '36%' },
    { top: 'auto', bottom: '-10%', right: '-16%', left: 'auto', width: '72%', height: '34%' },
    { top: '18%', left: '-28%', width: '52%', height: '46%' },
    { top: 'auto', bottom: '6%', right: 'auto', left: '-8%', width: '64%', height: '30%' },
  ];
  let ambientCleanup = null;

  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.round(rand(min, max));

  /** Per-particle values. Distances use cqw/cqh so they scale with the invitation, not the screen. */
  function seedAmbientBit(bit, id, heightScale, fresh) {
    const s = bit.style;
    if (id === 'leaves') {
      // Gentle breeze: enters one side, crosses horizontally, small vertical drift + sway.
      const fromLeft = Math.random() < 0.5;
      s.setProperty('--x0', `${fromLeft ? -14 : 114}cqw`);
      s.setProperty('--x1', `${fromLeft ? 114 : -14}cqw`);
      s.setProperty('--dy', `${rand(-5, 8).toFixed(1)}cqh`);
      s.setProperty('--bob', `${rand(8, 18).toFixed(1)}px`);
      s.setProperty('--sway-dur', `${rand(2.4, 4.2).toFixed(2)}s`);
      s.setProperty('--rot-a', `${randInt(-28, 4)}deg`);
      s.setProperty('--rot-b', `${randInt(16, 44)}deg`);
      s.setProperty('--scale', rand(0.75, 1.2).toFixed(2));
      s.top = `${randInt(6, 86)}%`;
      s.left = '0';
      // Slightly larger leaves — more visible without being heavy
      s.setProperty('--size', `${randInt(20, 32)}px`);
      s.animationDuration = `${rand(7, 13).toFixed(2)}s`;
    } else if (id === 'petals') {
      // Gentle fall: top → bottom, small sideways drift, wobble on an inner element.
      s.setProperty('--drift', `${randInt(-7, 7)}cqw`);
      s.setProperty('--wob', `${rand(5, 10).toFixed(1)}px`);
      s.setProperty('--sway-dur', `${rand(4.5, 7.5).toFixed(2)}s`);
      s.setProperty('--rot-a', `${randInt(-22, -4)}deg`);
      s.setProperty('--rot-b', `${randInt(6, 24)}deg`);
      s.setProperty('--scale', rand(0.7, 1.15).toFixed(2));
      s.left = `${randInt(3, 94)}%`;
      s.top = '0';
      // Larger petals range — clearly visible petal shapes
      s.setProperty('--size', `${randInt(16, 24)}px`);
      s.animationDuration = `${(rand(8, 14) * heightScale).toFixed(2)}s`;
    } else if (id === 'dust') {
      s.left = `${randInt(4, 94)}%`;
      s.top = `${randInt(6, 92)}%`;
      s.setProperty('--dx', `${randInt(-20, 20)}px`);
      s.setProperty('--dy', `${randInt(-28, 6)}px`);
      // Slightly larger dust — noticeable warm motes rather than near-invisible specks
      s.setProperty('--size', `${rand(2.8, 5.5).toFixed(1)}px`);
      // Peak lifted: 0.62–0.84. Resting opacity (0%, 100% in keyframe) is now .38.
      s.setProperty('--peak', rand(0.62, 0.84).toFixed(2));
      s.animationDuration = `${rand(10, 16).toFixed(2)}s`;
      // ~15% of particles receive a subtle light-catch glint — not a sparkle
      if (Math.random() < 0.15) bit.dataset.glint = '1';
      else delete bit.dataset.glint;
    } else if (id === 'stars') {
      s.left = `${randInt(4, 94)}%`;
      s.top = `${randInt(5, 92)}%`;
      // Three tiers: a few larger/brighter anchor stars, most are mid-sized, a few are small
      const tier = Math.random();
      let size, peak, rest;
      if (tier < 0.15) {
        // Bright anchor star — clearly visible, still not distracting
        size = rand(5.5, 7.5);
        peak = rand(0.72, 0.88);
        rest = rand(0.40, 0.52);
      } else if (tier < 0.65) {
        // Mid-range — the majority of stars
        size = rand(3.2, 5.2);
        peak = rand(0.58, 0.76);
        rest = rand(0.36, 0.48);
      } else {
        // Small ambient point
        size = rand(2.0, 3.4);
        peak = rand(0.44, 0.62);
        rest = rand(0.30, 0.42);
      }
      s.setProperty('--size', `${size.toFixed(1)}px`);
      s.setProperty('--peak', peak.toFixed(2));
      s.setProperty('--rest', rest.toFixed(2));
      // Staggered durations: slow gentle twinkle, not a rapid blink
      s.animationDuration = `${rand(9, 18).toFixed(2)}s`;
    }
    if (fresh) s.animationDelay = `${(rand(0.2, 4)).toFixed(2)}s`;
    else if (id !== 'mist') s.animationDelay = `${-rand(0, parseFloat(s.animationDuration)).toFixed(2)}s`;
  }

  function renderAmbient() {
    const layer = $('#ambient');
    const note = $('#ambient-note');
    if (!layer) return;

    // 1. Fully tear down the previous effect (DOM, listener) before building the next.
    if (ambientCleanup) { ambientCleanup(); ambientCleanup = null; }
    layer.replaceChildren();

    let id = AMBIENT_EFFECTS[config.ambientEffect] ? config.ambientEffect : (AMBIENT_ALIASES[config.ambientEffect] || 'none');
    if (!AMBIENT_EFFECTS[config.ambientEffect] && !AMBIENT_ALIASES[config.ambientEffect]) config.ambientEffect = 'none';
    const packNow = window.CelesticatePacks && window.CelesticatePacks.pack(config.template);
    if (packNow && packNow.features.ambientEffects === false) id = 'none';
    const still = reducedMotion() && id !== 'none';
    layer.dataset.effect = id;
    layer.dataset.still = still ? 'true' : 'false';
    layer.setAttribute('aria-hidden', 'true');
    if (note) note.textContent = id === 'none'
      ? 'No effect is playing in the preview.'
      : `${AMBIENT_EFFECTS[id]} is playing over the preview. Buttons stay clickable.`;
    if (id === 'none') return;

    const heightScale = Math.min(1.35, Math.max(1, (layer.clientHeight || 720) / 720));
    const narrow = (invite.clientWidth || 380) < 430;
    const base = AMBIENT_COUNT[id] || 0;
    const count = still
      ? Math.min(id === 'mist' ? 4 : 8, base)
      : (narrow ? Math.max(id === 'mist' ? 3 : 8, Math.round(base * 0.78)) : base);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const bit = document.createElement('span');
      bit.className = 'ambient-bit';
      bit.setAttribute('aria-hidden', 'true');
      bit.dataset.slot = String(i % 4);
      if (id === 'mist') {
        const place = MIST_PLACES[i % MIST_PLACES.length];
        Object.assign(bit.style, {
          top: place.top,
          bottom: place.bottom || '',
          left: place.left,
          right: place.right || '',
          width: place.width,
          height: place.height,
          animationDelay: `${-(i * 6.5).toFixed(1)}s`,
          animationDuration: `${28 + i * 7}s`,
        });
      } else {
        seedAmbientBit(bit, id, heightScale, false);
        if (still && (id === 'leaves' || id === 'petals')) {
          // Static version keeps to the edges so nothing sits over the content.
          bit.style.left = i % 2 ? `${randInt(2, 9)}%` : `${randInt(90, 96)}%`;
          bit.style.top = `${randInt(10, 86)}%`;
        }
      }
      const shape = AMBIENT_SHAPES[id];
      if (shape) {
        const inner = document.createElement('i');
        inner.className = 'ambient-inner';
        inner.innerHTML = shape;
        bit.append(inner);
      }
      frag.append(bit);
    }
    layer.append(frag);

    if (still) return;

    // 2. When a leaf/petal finishes a pass, re-roll its side, height and speed so the flow never repeats exactly.
    if (id === 'leaves' || id === 'petals') {
      const onIteration = (event) => {
        const bit = event.target;
        if (!bit.classList || !bit.classList.contains('ambient-bit')) return;
        if (!AMBIENT_MOVING.has(event.animationName)) return;
        seedAmbientBit(bit, id, heightScale, true);
        bit.style.animationDelay = `${rand(0, 2.5).toFixed(2)}s`;
      };
      layer.addEventListener('animationiteration', onIteration);
      ambientCleanup = () => layer.removeEventListener('animationiteration', onIteration);
    }
  }

  /* ── Music: one local track, runtime audio kept out of config ── */
  const MUSIC_MAX_BYTES = 15 * 1024 * 1024;
  const MUSIC_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a']);
  const MUSIC_EXT = /\.(mp3|wav|ogg|m4a)$/i;
  let musicUrl = null;
  let musicAutoplayTried = false;
  let musicBlocked = false;
  const musicAudio = new Audio();
  musicAudio.preload = 'none';
  musicAudio.loop = true;

  function releaseMusic() {
    musicAudio.pause();
    musicAudio.removeAttribute('src');
    musicAudio.load();
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    musicUrl = null;
    musicAutoplayTried = false;
    musicBlocked = false;
  }

  function musicReady() {
    return !!(config.music.enabled && config.music.fileName && musicUrl);
  }

  function renderMusic() {
    const panel = $('#music-panel');
    const empty = $('#music-empty');
    const chosen = $('#music-chosen');
    const name = $('#music-name');
    const upload = $('#music-upload');
    const preview = $('#music-preview');
    const guest = $('#invite-music');
    const volume = $('#music-volume');
    const enabled = $('#music-enabled');
    const autoplay = $('#music-autoplay');
    if (enabled) enabled.checked = !!config.music.enabled;
    if (autoplay) autoplay.checked = !!config.music.autoPlay;
    if (panel) panel.hidden = !config.music.enabled;
    if (volume) {
      volume.value = String(config.music.volume);
      volume.setAttribute('aria-valuenow', String(config.music.volume));
    }
    musicAudio.volume = config.music.volume;
    const hasTrack = !!config.music.fileName && !!musicUrl;
    if (empty) empty.hidden = hasTrack;
    if (chosen) chosen.hidden = !hasTrack;
    if (upload) upload.hidden = hasTrack;
    if (name) name.textContent = config.music.fileName;
    if (preview) preview.textContent = musicAudio.paused ? 'Play' : 'Pause';
    if (guest) {
      const show = musicReady();
      guest.hidden = !show;
      const playing = show && !musicAudio.paused;
      guest.textContent = musicBlocked && musicAudio.paused ? 'Tap to play music' : (playing ? 'Pause music' : 'Play music');
      guest.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
      guest.setAttribute('aria-pressed', String(playing));
    }
  }

  function stopMusic() {
    musicAudio.pause();
    musicBlocked = false;
    renderMusic();
  }

  async function startMusic() {
    if (!musicReady()) return false;
    musicAudio.volume = config.music.volume;
    try {
      await musicAudio.play();
      musicBlocked = false;
      renderMusic();
      return true;
    } catch (err) {
      musicBlocked = true;
      renderMusic();
      return false;
    }
  }

  function tryMusicAutoplay() {
    if (!config.music.autoPlay || !musicReady() || musicAutoplayTried || !musicAudio.paused) return;
    musicAutoplayTried = true;
    startMusic();
  }

  function setMusicFile(file) {
    const feedback = $('#music-feedback');
    if (!file) return;
    const type = (file.type || '').toLowerCase();
    if (!MUSIC_TYPES.has(type) && !MUSIC_EXT.test(file.name)) {
      if (feedback) feedback.textContent = 'Use an MP3, WAV, OGG, or M4A file.';
      return;
    }
    if (file.size > MUSIC_MAX_BYTES) {
      if (feedback) feedback.textContent = 'That file is over 15 MB. Choose a shorter track.';
      return;
    }
    releaseMusic();
    musicUrl = URL.createObjectURL(file);
    musicAudio.src = musicUrl;
    musicAudio.load();
    config.music.fileName = file.name;
    config.music.sourceType = 'local';
    if (feedback) feedback.textContent = 'Track ready on this device. It is not uploaded.';
    renderMusic();
    renderChecklist();
    tryMusicAutoplay();
  }

  function removeMusic() {
    releaseMusic();
    config.music.fileName = '';
    const feedback = $('#music-feedback');
    if (feedback) feedback.textContent = 'Music removed.';
    renderMusic();
    renderChecklist();
  }

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
    config.galleryChosen = true;
    renderGallery();
    liveStatus.textContent = `Grid layout set to ${orientation}.`;
  }

  function setGalleryMode(mode) {
    if (!GALLERY_MODE_LABEL[mode] || config.gallery.layout === mode) return;
    config.gallery.layout = mode;
    config.galleryChosen = true;
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
    renderCoverPanel();
    renderChecklist();
    syncStudio();
  }

  /* Cover photo: its own upload. It is never added to the gallery, and gallery edits never touch it. */
  function showCoverFeedback(message, ok) {
    const box = $('#cover-feedback');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
    box.classList.toggle('is-ok', !!ok);
  }

  function renderCoverPanel() {
    const photo = coverPhoto();
    const empty = $('#cover-empty');
    const chosen = $('#cover-chosen');
    if (!empty || !chosen) return;
    empty.hidden = !!photo;
    chosen.hidden = !photo;
    if (photo) {
      const thumb = $('#cover-thumb');
      const name = $('#cover-name');
      if (thumb) { thumb.src = photo.previewUrl; thumb.alt = ''; }
      if (name) name.textContent = clean(photo.filename) || 'Cover photo';
    }
  }

  function setCoverFile(file) {
    if (!file) return;
    const label = clean(file.name) || 'That file';
    let problem = '';
    if (!isSupportedImage(file)) problem = `${label} isn’t a supported format. Use JPEG, PNG, or WebP.`;
    else if (file.size > GALLERY_MAX_BYTES) problem = `${label} is larger than 8 MB.`;
    if (problem) {
      showCoverFeedback(problem, false);
      liveStatus.textContent = problem;
      return;
    }
    const previous = config.cover;
    const id = makeId();
    const previewUrl = URL.createObjectURL(file);
    objectUrls.set(id, previewUrl);
    config.cover = { id, previewUrl, filename: file.name, fingerprint: fileFingerprint(file) };
    if (previous) releaseUrl(previous.id);
    renderTemplate();
    renderCoverPanel();
    showCoverFeedback(previous ? 'Cover photo replaced. The gallery is unchanged.' : 'Cover photo added. The gallery is unchanged.', true);
    liveStatus.textContent = 'Cover photo set. Gallery unchanged.';
  }

  function clearCoverPhoto() {
    if (!config.cover) return;
    releaseUrl(config.cover.id);
    config.cover = null;
    renderTemplate();
    renderCoverPanel();
    showCoverFeedback('Cover photo removed. Your gallery photos are unchanged.', true);
    liveStatus.textContent = 'Cover photo removed. The header uses the default artwork.';
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

  $('#preview-opening').addEventListener('click', playOpening);
  $('#opening-skip').addEventListener('click', () => {
    stopOpening();
    liveStatus.textContent = 'Opening animation skipped.';
    $('#preview-opening').focus();
  });

  $('#music-enabled').addEventListener('change', () => {
    config.music.enabled = $('#music-enabled').checked;
    if (!config.music.enabled) stopMusic();
    renderMusic();
    renderChecklist();
    if (config.music.enabled) tryMusicAutoplay();
    liveStatus.textContent = config.music.enabled ? 'Background music enabled.' : 'Background music hidden.';
  });
  $('#music-autoplay').addEventListener('change', () => {
    config.music.autoPlay = $('#music-autoplay').checked;
    musicAutoplayTried = false;
    tryMusicAutoplay();
    liveStatus.textContent = config.music.autoPlay
      ? 'Music will try to start when the invitation opens. A browser may still ask for a tap.'
      : 'Music waits for play.';
  });
  $('#music-volume').addEventListener('input', () => {
    const value = Math.min(1, Math.max(0, Number($('#music-volume').value) || 0));
    config.music.volume = value;
    musicAudio.volume = value;
    $('#music-volume').setAttribute('aria-valuenow', String(value));
  });
  $('#music-upload').addEventListener('click', () => $('#music-input').click());
  $('#music-change').addEventListener('click', () => $('#music-input').click());
  $('#music-input').addEventListener('change', () => {
    const file = $('#music-input').files && $('#music-input').files[0];
    setMusicFile(file);
    $('#music-input').value = '';
  });
  $('#music-preview').addEventListener('click', () => {
    if (musicAudio.paused) startMusic();
    else stopMusic();
  });
  $('#music-remove').addEventListener('click', removeMusic);
  $('#invite-music').addEventListener('click', () => {
    if (musicAudio.paused) startMusic();
    else stopMusic();
  });
  musicAudio.addEventListener('play', renderMusic);
  musicAudio.addEventListener('pause', renderMusic);
  musicAudio.addEventListener('error', () => {
    const feedback = $('#music-feedback');
    if (feedback) feedback.textContent = 'This browser could not play that file. The invitation is unchanged.';
    renderMusic();
  });

  const rsvpDemo = $('#rsvp-demo');
  if (rsvpDemo) {
    rsvpDemo.addEventListener('click', () => {
      liveStatus.textContent = 'RSVP is a preview only. Replies are not collected yet.';
    });
  }

  const coverInput = $('#cover-input');
  $('#cover-select').addEventListener('click', () => coverInput.click());
  $('#cover-change').addEventListener('click', () => coverInput.click());
  $('#cover-remove').addEventListener('click', clearCoverPhoto);
  coverInput.addEventListener('change', () => {
    const file = coverInput.files && coverInput.files[0];
    coverInput.value = '';
    setCoverFile(file);
  });

  /* ── Guest preview: the invitation alone, as a guest would see it ──
     Reuses the live invitation, so template, colours, cover, gallery, opening,
     music, ambient effect and location all behave exactly as in the editor. */
  const guestBar = $('#guest-bar');
  const guestOpenBtn = $('#guest-preview-btn');
  const isGuestView = () => document.body.dataset.view === 'guest';
  let previewFromLink = false;             // true only for a visitor who arrived through a ?preview link
  let editorScroll = { page: 0, sidebar: 0 };

  function setGuestView(on) {
    if (on === isGuestView()) return;
    if (on) editorScroll = { page: window.scrollY, sidebar: sidebar.scrollTop };
    document.body.dataset.view = on ? 'guest' : 'editor';
    if (guestBar) {
      guestBar.hidden = !on;
      guestBar.dataset.source = previewFromLink ? 'link' : 'own';
    }
    setChecklistOpen(false);
    if (on) {
      playOpening();                       // does nothing when the opening is "None"
      window.scrollTo({ top: 0, behavior: 'instant' });   // always start at the top of the invitation
      const exit = $('#guest-exit');
      if (exit) exit.focus({ preventScroll: true });
      liveStatus.textContent = 'Personal preview. Press Escape to return to the editor.';
    } else {
      previewFromLink = false;
      stopOpening();
      const url = new URL(window.location.href);
      if (url.searchParams.has('preview')) {
        url.searchParams.delete('preview');
        window.history.replaceState(null, '', url);
      }
      if (guestOpenBtn) guestOpenBtn.focus({ preventScroll: true });
      window.scrollTo({ top: editorScroll.page, behavior: 'instant' });   // return to where the person was editing
      sidebar.scrollTop = editorScroll.sidebar;
      liveStatus.textContent = 'Back in the editor.';
    }
  }

  if (guestOpenBtn) guestOpenBtn.addEventListener('click', () => setGuestView(true));
  $('#guest-exit').addEventListener('click', () => setGuestView(false));
  document.addEventListener('celesticate:guest-preview', () => setGuestView(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && isGuestView() && !document.querySelector('dialog[open]')) setGuestView(false);
  });

  /* ── Phase 3.8: pack presentation. Never deletes guest content. ── */
  function applyTemplatePresentation() {
    const pack = window.CelesticatePacks && window.CelesticatePacks.pack(config.template);
    if (!pack) return;
    if (!config.paletteChosen && PALETTE_DEFS[pack.palette]) config.palette = pack.palette;
    if (!config.galleryChosen && pack.gallery) {
      if (pack.gallery.layout) config.gallery.layout = pack.gallery.layout;
      if (pack.gallery.orientation) config.gallery.orientation = pack.gallery.orientation;
    }
    if (!config.openingChosen && pack.features.animation !== false && OPENING_STYLES[pack.animation]) {
      config.openingAnimation = pack.animation;
    }
    if (!config.ambientChosen && pack.features.ambientEffects !== false) {
      config.ambientEffect = pack.ambient || 'none';
    }
  }

  function selectTemplate(id) {
    const pack = window.CelesticatePacks && window.CelesticatePacks.templates[id];
    if (!pack) return;
    config.template = id;
    config.templateChosen = true;
    applyTemplatePresentation();
    normalizeLayout();
    stopOpening();
    renderTemplate();
    renderLayout();
    renderTypography();
    renderPalette();
    renderSectionState();
    renderOpeningControl();
    renderAmbient();
    renderGallery();
    renderPackControls();
    syncControls();
    renderChecklist();
    if (window.CelesticateStudio && window.CelesticateStudio.syncAccess) window.CelesticateStudio.syncAccess();
    liveStatus.textContent = `${pack.name} applied. Names, date, photos, music, and anything you chose yourself stay.`;
  }

  function renderPackControls() {
    const packs = window.CelesticatePacks;
    const pack = packs && packs.pack(config.template);
    const type = config.eventType;
    const templateHost = $('#template-options');
    const paletteHost = $('#palette-options');
    const templateHint = $('#template-hint');
    if (templateHost && packs) {
      const offered = packs.forType(type);
      const list = offered.some((item) => item.id === pack.id) ? offered : [pack, ...offered];
      templateHost.replaceChildren();
      list.forEach((item) => {
        const label = document.createElement('label');
        label.className = 'template-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'template';
        input.value = item.id;
        input.dataset.field = 'template';
        input.checked = item.id === config.template;
        const chip = document.createElement('span');
        chip.className = 'template-chip';
        const thumb = document.createElement('span');
        thumb.className = `template-thumb template-thumb-${item.id}`;
        thumb.setAttribute('aria-hidden', 'true');
        const copy = document.createElement('span');
        copy.className = 'template-copy';
        const name = document.createElement('strong');
        name.textContent = item.name;
        const desc = document.createElement('span');
        desc.textContent = item.description;
        copy.append(name, desc);
        if (!item.invitationTypes.includes(type)) {
          const kept = document.createElement('span');
          kept.className = 'template-kept';
          kept.textContent = 'Kept from another type';
          copy.append(kept);
        }
        chip.append(thumb, copy);
        label.append(input, chip);
        templateHost.append(label);
      });
    }
    if (templateHint && pack) {
      const typeLabel = (EVENT_PRESETS[type] || {}).label || 'this invitation';
      templateHint.textContent = pack.invitationTypes.includes(type)
        ? `Styles for a ${typeLabel.toLowerCase()}.`
        : `${pack.name} is not a suggested ${typeLabel.toLowerCase()} style. It still applies until you pick another.`;
    }
    if (paletteHost && pack) {
      const ids = [...(pack.colorPresets || [])];
      if (config.palette !== 'custom' && PALETTE_DEFS[config.palette] && !ids.includes(config.palette)) ids.unshift(config.palette);
      paletteHost.replaceChildren();
      ids.forEach((id) => {
        const def = PALETTE_DEFS[id];
        if (!def) return;
        const label = document.createElement('label');
        label.className = 'palette-option';
        label.dataset.palette = id;
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'palette';
        input.value = id;
        input.dataset.field = 'palette';
        input.checked = config.palette === id;
        const chip = document.createElement('span');
        chip.className = 'palette-chip';
        const dots = document.createElement('span');
        dots.className = 'palette-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
        chip.append(dots, document.createTextNode(def.label));
        if (config.palette === id && config.paletteChosen && !(pack.colorPresets || []).includes(id)) {
          chip.append(document.createTextNode(' · kept'));
        }
        label.append(input, chip);
        paletteHost.append(label);
      });
      if (pack.features.customColors !== false) {
        const label = document.createElement('label');
        label.className = 'palette-option';
        label.id = 'palette-custom';
        label.dataset.palette = 'custom';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'palette';
        input.value = 'custom';
        input.dataset.field = 'palette';
        input.checked = config.palette === 'custom';
        const chip = document.createElement('span');
        chip.className = 'palette-chip';
        const dots = document.createElement('span');
        dots.className = 'palette-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
        chip.append(dots, document.createTextNode('Custom'));
        label.append(input, chip);
        paletteHost.append(label);
      }
    }
    const features = (pack && pack.features) || {};
    const musicCard = document.querySelector('[aria-labelledby="g-music"]');
    const ambientCard = document.querySelector('[aria-labelledby="g-ambient"]');
    const photosCard = document.querySelector('[aria-labelledby="g-photos"]');
    const opening = $('#f-opening');
    const paletteField = $('#f-palette');
    const custom = $('#custom-palette');
    if (musicCard) musicCard.hidden = features.music === false;
    if (ambientCard) ambientCard.hidden = features.ambientEffects === false;
    if (photosCard) photosCard.hidden = features.gallery === false;
    if (opening) opening.hidden = features.animation === false;
    if (paletteField) paletteField.hidden = features.colors === false;
    if (custom) custom.hidden = features.customColors === false;
    const paletteHint = $('#palette-hint');
    if (paletteHint && pack) {
      paletteHint.textContent = config.paletteChosen
        ? 'Your palette stays when the style changes. Recommendations are listed above.'
        : 'Recommended for this style. Choosing one keeps it when you switch styles.';
    }
    const customChip = $('#palette-custom');
    if (customChip && config.customColors) {
      customChip.style.setProperty('--inv-bg', config.customColors.background);
      customChip.style.setProperty('--inv-accent', config.customColors.accent);
      customChip.style.setProperty('--inv-primary', config.customColors.primaryText);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     Initialise
     ═══════════════════════════════════════════════════════════════ */
  buildSectionList();
  applyTemplatePresentation();
  renderAll();
  syncControls();
  // Baseline for isPristine(). Taken at DOMContentLoaded, i.e. after every deferred script (including Studio's
  // own start-up normalisation) has run, and without depending on animation frames.
  const takeBaseline = () => { initialSnapshot = JSON.stringify(serializeInvitation()); };
  if (document.readyState === 'complete') takeBaseline(); else document.addEventListener('DOMContentLoaded', takeBaseline, { once: true });
  // A development preview link opens straight into the guest preview.
  if (new URLSearchParams(window.location.search).has('preview')) { previewFromLink = true; setGuestView(true); }

})();