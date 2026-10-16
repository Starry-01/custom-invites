/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 3.8: Template & feature packs
   ───────────────────────────────────────────────────────────────
   A template is a reusable design system + feature configuration,
   not a CSS skin. Invitation type chooses which packs are offered.
   Personalization (names, photos, a palette the guest picked) lives
   on the invitation config and is never stored inside a pack.
   Phase 4 can persist config.template plus this registry id; it
   should not duplicate the pack into the saved invitation.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /** What each Studio level is allowed to do. Looked up by id — never by template name. */
  const studioCaps = {
    full:    { move: true,  resize: true,  layers: true,  typography: 'full',  image: true,  decor: true,  shapes: true,  text: true },
    limited: { move: true,  resize: true,  layers: true,  typography: 'basic', image: false, decor: false, shapes: false, text: true },
    basic:   { move: true,  resize: true,  layers: true,  typography: 'basic', image: false, decor: false, shapes: false, text: true },
    none:    { move: false, resize: false, layers: false, typography: false,   image: false, decor: false, shapes: false, text: false },
  };

  /**
   * Recommended palettes. Semantic roles match the Phase 3.2 color system
   * so every template maps background / text / accent / border the same way.
   * Recommendations, not restrictions — Custom still works.
   */
  const palettes = {
    forest:      { label: 'Forest & Ivory',       background: '#F5F0E8', primaryText: '#292723', secondaryText: '#68665E', accent: '#B49A70', border: '#DED7CA' },
    sage:        { label: 'Sage & Cream',         background: '#F3F1E4', primaryText: '#2A3226', secondaryText: '#566050', accent: '#93A483', border: '#D6DAC4' },
    midnight:    { label: 'Midnight & Champagne', background: '#1B2338', primaryText: '#F3EBDD', secondaryText: '#B9B5AB', accent: '#D6BF94', border: '#3A4663' },
    ivory:       { label: 'Ivory & Gold',         background: '#F7F1E6', primaryText: '#2C2824', secondaryText: '#6E675C', accent: '#C4A46A', border: '#E4D8C4' },
    botanical:   { label: 'Botanical',            background: '#F4F6EF', primaryText: '#243028', secondaryText: '#5C6B5E', accent: '#6E8B6A', border: '#D5E0D2' },
    blush:       { label: 'Blush & Cream',        background: '#F8F1EE', primaryText: '#3A2E2C', secondaryText: '#7A6560', accent: '#C48984', border: '#E7D5D0' },
    sunset:      { label: 'Warm Sunset',          background: '#FBF3EA', primaryText: '#3B2A22', secondaryText: '#7A5E4E', accent: '#D4845A', border: '#EBD3C0' },
    celebration: { label: 'Bright Celebration',   background: '#FFF6EE', primaryText: '#2E2A32', secondaryText: '#6E6270', accent: '#E07A5F', border: '#F0D9C8' },
    champagne:   { label: 'Champagne',            background: '#F6F1E8', primaryText: '#2A2C33', secondaryText: '#6A6E78', accent: '#C6B08A', border: '#E3D9C8' },
  };

  const feature = (studio, mobileStudio, extra = {}) => ({
    gallery: true,
    music: true,
    ambientEffects: true,
    location: true,
    animation: true,
    colors: true,
    customColors: true,
    studio,
    mobileStudio,
    ...extra,
  });

  /**
   * Pack registry.
   * layout     → section order key already used by the invitation (LAYOUT_ORDER)
   * typography → type preset id (null on the invitation means "follow this")
   * gallery    → default presentation only; photos are never part of the pack
   * features   → what the editor may offer. Disabling a feature hides it; it does not delete stored data.
   */
  const templates = {
    classic: {
      id: 'classic', name: 'Classic', description: 'Elegant and timeless, with a framed portrait.',
      invitationTypes: ['wedding', 'anniversary', 'general'],
      family: 'classic', hero: 'framed', layout: 'classic',
      typography: 'classic', alignment: 'center', spacing: 'balanced',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'elegant-reveal', ambient: 'dust', palette: 'forest',
      colorPresets: ['forest', 'ivory', 'sage'],
      sectionDefaults: {},
      features: feature('full', 'basic'),
    },
    garden: {
      id: 'garden', name: 'Garden', description: 'Botanical frame, petals, and an outdoor ceremony feel.',
      invitationTypes: ['wedding'],
      family: 'botanical', hero: 'botanical', layout: 'classic',
      typography: 'classic', alignment: 'center', spacing: 'spacious',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'elegant-reveal', ambient: 'petals', palette: 'sage',
      colorPresets: ['sage', 'botanical', 'ivory'],
      sectionDefaults: { story: true, gallery: true },
      features: feature('full', 'basic'),
    },
    editorial: {
      id: 'editorial', name: 'Editorial', description: 'Typography-led, with a strong left-hand hierarchy.',
      invitationTypes: ['wedding', 'graduation', 'engagement', 'anniversary'],
      family: 'editorial', hero: 'square', layout: 'editorial',
      typography: 'editorial', alignment: 'left', spacing: 'balanced',
      gallery: { layout: 'grid', orientation: 'horizontal' },
      animation: 'fade', ambient: 'none', palette: 'midnight',
      colorPresets: ['midnight', 'forest', 'champagne'],
      sectionDefaults: {},
      features: feature('full', 'full'),
    },
    romantic: {
      id: 'romantic', name: 'Romantic', description: 'Soft italic type, a round portrait, and a quiet glow.',
      invitationTypes: ['wedding', 'engagement', 'anniversary'],
      family: 'romantic', hero: 'circle', layout: 'classic',
      typography: 'romantic', alignment: 'center', spacing: 'spacious',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'elegant-reveal', ambient: 'dust', palette: 'blush',
      colorPresets: ['blush', 'ivory', 'sage'],
      sectionDefaults: { story: true },
      features: feature('full', 'basic'),
    },
    modern: {
      id: 'modern', name: 'Modern', description: 'Clean geometry, little ornament, contemporary type.',
      invitationTypes: ['wedding', 'graduation', 'general'],
      family: 'modern', hero: 'square', layout: 'minimal',
      typography: 'modern', alignment: 'left', spacing: 'compact',
      gallery: { layout: 'slideshow', orientation: 'horizontal' },
      animation: 'zoom', ambient: 'none', palette: 'midnight',
      colorPresets: ['midnight', 'champagne', 'forest'],
      sectionDefaults: { story: false },
      features: feature('limited', 'basic'),
    },
    celebration: {
      id: 'celebration', name: 'Celebration', description: 'A festive photo-led party invitation.',
      invitationTypes: ['birthday'],
      family: 'photo', hero: 'bleed', layout: 'photo',
      typography: 'classic', alignment: 'center', spacing: 'balanced',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'slide-up', ambient: 'dust', palette: 'celebration',
      colorPresets: ['celebration', 'sunset', 'ivory'],
      sectionDefaults: { gallery: true, story: true },
      features: feature('full', 'basic'),
    },
    photo: {
      id: 'photo', name: 'Photo Focus', description: 'The photograph leads. Type stays quiet behind it.',
      invitationTypes: ['birthday', 'graduation'],
      family: 'photo', hero: 'bleed', layout: 'photo',
      typography: 'classic', alignment: 'center', spacing: 'balanced',
      gallery: { layout: 'cinematic', orientation: 'vertical' },
      animation: 'zoom', ambient: 'none', palette: 'sunset',
      colorPresets: ['sunset', 'forest', 'celebration'],
      sectionDefaults: { gallery: true },
      features: feature('limited', 'basic'),
    },
    minimal: {
      id: 'minimal', name: 'Minimal', description: 'Reduced decoration and generous space.',
      invitationTypes: ['birthday', 'engagement', 'baby', 'general'],
      family: 'minimal', hero: 'quiet', layout: 'minimal',
      typography: 'minimal', alignment: 'center', spacing: 'spacious',
      gallery: { layout: 'slideshow', orientation: 'horizontal' },
      animation: 'fade', ambient: 'none', palette: 'ivory',
      colorPresets: ['ivory', 'sage', 'champagne'],
      sectionDefaults: { story: false, highlight: false },
      features: feature('limited', 'basic'),
    },
    playful: {
      id: 'playful', name: 'Playful', description: 'Rounded, bright, and simple — made for a phone.',
      invitationTypes: ['birthday'],
      family: 'playful', hero: 'circle', layout: 'photo',
      typography: 'modern', alignment: 'center', spacing: 'balanced',
      gallery: { layout: 'grid', orientation: 'horizontal' },
      animation: 'slide-up', ambient: 'stars', palette: 'celebration',
      colorPresets: ['celebration', 'sunset', 'botanical'],
      sectionDefaults: { gallery: true, story: true },
      features: feature('none', 'none'),
    },
    academic: {
      id: 'academic', name: 'Academic', description: 'A formal announcement: rule, crest, and measured type.',
      invitationTypes: ['graduation'],
      family: 'editorial', hero: 'crest', layout: 'editorial',
      typography: 'editorial', alignment: 'center', spacing: 'balanced',
      gallery: { layout: 'grid', orientation: 'vertical' },
      animation: 'fade', ambient: 'none', palette: 'midnight',
      colorPresets: ['midnight', 'ivory', 'forest'],
      sectionDefaults: { story: true },
      features: feature('full', 'basic'),
    },
    soft: {
      id: 'soft', name: 'Soft', description: 'Gentle curves, airy type, and a quiet welcome.',
      invitationTypes: ['baby'],
      family: 'soft', hero: 'circle', layout: 'minimal',
      typography: 'romantic', alignment: 'center', spacing: 'spacious',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'fade', ambient: 'mist', palette: 'blush',
      colorPresets: ['blush', 'sage', 'ivory'],
      sectionDefaults: { story: true },
      features: feature('limited', 'basic'),
    },
    botanical: {
      id: 'botanical', name: 'Botanical', description: 'Leaves, a garden frame, and a soft green palette.',
      invitationTypes: ['baby'],
      family: 'botanical', hero: 'botanical', layout: 'classic',
      typography: 'classic', alignment: 'center', spacing: 'spacious',
      gallery: { layout: 'cinematic', orientation: 'horizontal' },
      animation: 'elegant-reveal', ambient: 'leaves', palette: 'botanical',
      colorPresets: ['botanical', 'sage', 'ivory'],
      sectionDefaults: { story: true, gallery: true },
      features: feature('full', 'basic'),
    },
  };

  /** Suggested pack when the guest has not picked a style themselves. */
  const typeDefault = {
    wedding: 'classic',
    birthday: 'celebration',
    graduation: 'editorial',
    engagement: 'editorial',
    anniversary: 'classic',
    baby: 'soft',
    general: 'classic',
  };

  window.CelesticatePacks = {
    version: 1,
    studioCaps,
    palettes,
    templates,
    typeDefault,
    pack(id) { return templates[id] || templates.classic; },
    forType(type) {
      return Object.values(templates).filter((pack) => pack.invitationTypes.includes(type));
    },
  };
})();
