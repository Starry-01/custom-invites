/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 4.1: Guided start & question flow

   A presentation layer over the existing builder. It does not own any
   invitation data and does not move, clone or re-create controls:
   every existing field keeps its id, its listeners and its place in
   the DOM. Steps only show or hide those controls, so answers survive
   Back / Next because script.js's config is still the single source of
   truth. "Show all settings" returns the full editor unchanged.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const body = document.body;
  const sidebar = document.querySelector('.sidebar');
  const startEl = byId('guided-start');
  const bar = byId('guided-bar');
  const nav = byId('guided-nav');
  const eventSelect = byId('f-event');

  // If the markup is missing, leave the full editor exactly as it was.
  if (!sidebar || !startEl || !bar || !nav || !eventSelect) { body.dataset.guided = 'off'; return; }

  const countEl = byId('guided-count');
  const fillEl = byId('guided-fill');
  const stepsEl = byId('guided-steps');
  const titleEl = byId('guided-title');
  const hintEl = byId('guided-hint');
  const allBtn = byId('guided-all');
  const backBtn = byId('guided-back');
  const nextBtn = byId('guided-next');
  const typesEl = byId('gs-types');

  /* ── 1. The steps. Each one lists the EXISTING controls it shows. ──
     fields   → ids of inputs inside the Event details card (their .field wrapper is shown)
     cards    → existing cards, by the id of their heading (aria-labelledby)
     required → ids that must be filled before moving forward                          */
  const STEPS = [
    {
      id: 'basics', title: 'The basics',
      hint: 'Choose the occasion and tell guests who it is for. Only the names are required.',
      fields: ['f-event', 'f-heading', 'f-title', 'f-names', 'f-milestone', 'f-school', 'f-message'],
      required: ['f-names'],
    },
    {
      id: 'place', title: 'Date and place',
      hint: 'When and where. Skip anything you do not know yet. You can add it later.',
      fields: ['f-date', 'f-time', 'f-venue', 'f-place', 'f-location-note', 'f-map', 'f-ceremony', 'f-reception'],
    },
    {
      id: 'words', title: 'Your words',
      hint: 'A short story or a personal note. Leave these blank if you prefer.',
      fields: ['f-celebration', 'f-story', 'f-note'],
    },
    {
      id: 'style', title: 'Look and feel',
      hint: 'Choose a style, colors and how the invitation opens.',
      cards: ['g-appearance', 'g-typography'],
    },
    {
      id: 'extras', title: 'Photos and extras',
      hint: 'Add photos, music or a gentle effect, and choose which sections guests see.',
      cards: ['g-photos', 'g-music', 'g-ambient', 'g-sections'],
    },
    {
      id: 'review', title: 'Review and share',
      hint: 'Look over the preview, then open the full preview. It is a personal draft for trying out your design.',
      cards: ['g-share'],
    },
  ];
  const LAST = STEPS.length - 1;

  // Only the step 5 cards need a different order than the page has (Photos first).
  const CARD_ORDER = { 'g-photos': 1, 'g-music': 2, 'g-ambient': 3, 'g-sections': 4 };

  /* ── 2. Tag existing elements with the step(s) they belong to ── */
  const managed = [];   // { el, steps:Set, order }
  const tag = (el, stepId, order) => {
    if (!el) return;
    let item = managed.find((m) => m.el === el);
    if (!item) { item = { el, steps: new Set(), order: order || 0 }; managed.push(item); }
    item.steps.add(stepId);
  };
  STEPS.forEach((step) => {
    (step.fields || []).forEach((id) => {
      const input = byId(id);
      const field = input && input.closest('.field');
      tag(field, step.id);
      tag(field && field.closest('.card'), step.id);   // Event details appears on steps 1–3
    });
    (step.cards || []).forEach((labelId) => {
      tag(sidebar.querySelector(`[aria-labelledby="${labelId}"]`), step.id, CARD_ORDER[labelId]);
    });
  });

  /* ── 3. State ── */
  const params = new URLSearchParams(window.location.search);
  const direct = params.has('preview') || params.has('studio')
    || body.dataset.view === 'guest' || body.dataset.studio === 'on';
  let mode = direct ? 'off' : 'start';   // start | on | off
  let current = 0;
  let reached = 0;
  const narrow = () => window.matchMedia('(max-width: 720px)').matches;

  /* ── 4. Entry screen: tiles are built from the existing event-type select ── */
  [...eventSelect.options].forEach((option, i) => {
    const label = document.createElement('label');
    label.className = 'gs-type';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'gs-type';
    input.value = option.value;
    input.className = 'visually-hidden';
    input.id = `gs-type-${i}`;
    const chip = document.createElement('span');
    chip.className = 'gs-type-chip';
    chip.textContent = option.textContent;
    label.append(input, chip);
    typesEl.append(label);
  });
  function syncTiles() {
    const match = typesEl.querySelector(`input[value="${eventSelect.value}"]`);
    if (match) match.checked = true;
  }

  /* ── 5. Required-field feedback ── */
  const requiredIds = new Set(STEPS.flatMap((s) => s.required || []));

  function clearError(input) {
    const msg = byId(`guided-err-${input.id}`);
    if (msg) msg.remove();
    input.removeAttribute('aria-invalid');
    const rest = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter((x) => x && x !== `guided-err-${input.id}`);
    if (rest.length) input.setAttribute('aria-describedby', rest.join(' ')); else input.removeAttribute('aria-describedby');
  }

  function showError(input) {
    clearError(input);   // re-create so screen readers announce it again
    const field = input.closest('.field');
    const labelNode = document.querySelector(`label[for="${input.id}"]`);
    const label = labelNode ? labelNode.textContent.trim() : 'This field';
    const msg = document.createElement('p');
    msg.className = 'field-error';
    msg.id = `guided-err-${input.id}`;
    msg.setAttribute('role', 'alert');
    msg.textContent = `Please fill in \u201C${label}\u201D to continue.`;
    field.append(msg);
    input.setAttribute('aria-invalid', 'true');
    const described = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    described.push(msg.id);
    input.setAttribute('aria-describedby', described.join(' '));
    input.focus();
  }

  function firstInvalid(stepIndex) {
    const ids = STEPS[stepIndex].required || [];
    for (const id of ids) {
      const input = byId(id);
      if (input && !input.value.trim()) return input;
    }
    return null;
  }

  sidebar.addEventListener('input', (e) => {
    if (requiredIds.has(e.target.id) && e.target.value.trim()) clearError(e.target);
  });

  /* ── 6. Rendering ── */
  const stepButtons = STEPS.map((step, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guided-step-btn';
    btn.textContent = String(i + 1);
    btn.title = step.title;
    btn.setAttribute('aria-label', `Step ${i + 1} of ${STEPS.length}: ${step.title}`);
    btn.addEventListener('click', () => tryGo(i));
    li.append(btn);
    stepsEl.append(li);
    return btn;
  });

  function render() {
    const step = STEPS[current];
    body.dataset.guided = mode;
    startEl.hidden = mode !== 'start';
    bar.hidden = mode === 'start';
    nav.hidden = mode !== 'on';

    managed.forEach(({ el, steps, order }) => {
      el.toggleAttribute('data-wizard-off', mode === 'on' && !steps.has(step.id));
      el.style.order = mode === 'on' && order ? String(order) : '';
    });

    countEl.textContent = mode === 'on' ? `Step ${current + 1} of ${STEPS.length}` : 'All settings shown';
    allBtn.textContent = mode === 'on' ? 'Show all settings' : 'Use guided steps';
    fillEl.style.width = `${((current + 1) / STEPS.length) * 100}%`;
    titleEl.textContent = step.title;
    hintEl.textContent = step.hint;
    stepButtons.forEach((btn, i) => {
      if (i === current) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      btn.toggleAttribute('data-visited', i <= reached && i !== current);
    });
    nextBtn.textContent = current === LAST ? 'Preview invitation' : 'Next';
  }

  function go(index) {
    current = Math.max(0, Math.min(LAST, index));
    reached = Math.max(reached, current);
    render();
    titleEl.focus({ preventScroll: true });
    if (narrow()) bar.scrollIntoView({ block: 'start' }); else sidebar.scrollTop = 0;
  }

  /** Moving forward is allowed only when every step being left is complete. */
  function tryGo(target) {
    for (let i = current; i < target; i += 1) {
      const bad = firstInvalid(i);
      if (bad) {
        if (i !== current) go(i);
        showError(bad);
        return false;
      }
    }
    if (target !== current) go(target);
    return true;
  }

  /* ── 7. Wiring ── */
  function begin() {
    const chosen = typesEl.querySelector('input:checked');
    if (chosen && chosen.value !== eventSelect.value) {
      eventSelect.value = chosen.value;
      // script.js listens on the sidebar and applies its own "suggestions / keep my edits" rules.
      eventSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    mode = 'on';
    go(current);
  }

  byId('gs-begin').addEventListener('click', () => { current = 0; reached = 0; begin(); });
  byId('gs-full').addEventListener('click', () => {
    mode = 'off';
    render();
    const first = sidebar.querySelector('#f-event');
    if (first) first.focus({ preventScroll: true });
  });

  allBtn.addEventListener('click', () => {
    mode = mode === 'on' ? 'off' : 'on';
    render();
  });

  backBtn.addEventListener('click', () => {
    if (current === 0) {            // Back from the first step returns to the occasion choice
      mode = 'start';
      syncTiles();
      render();
      byId('gs-begin').focus();
      return;
    }
    go(current - 1);
  });

  nextBtn.addEventListener('click', () => {
    if (current < LAST) { tryGo(current + 1); return; }
    for (let i = 0; i < LAST; i += 1) {
      const bad = firstInvalid(i);
      if (bad) { go(i); showError(bad); return; }
    }
    // Reuse the existing guest preview (script.js listens for this event).
    document.dispatchEvent(new CustomEvent('celesticate:guest-preview'));
  });

  // The Preview Checklist jumps to a control; make sure its step is showing first.
  // (Capture phase, so this runs before script.js scrolls and focuses the target.)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-check-target]');
    if (!btn || mode !== 'on') return;
    const target = byId(btn.dataset.checkTarget);
    if (!target) return;
    const owners = managed.filter((m) => m.el.contains(target));
    if (!owners.length || owners.every((m) => !m.el.hasAttribute('data-wizard-off'))) return;   // already visible
    const innermost = owners.reduce((a, b) => (a.el.contains(b.el) ? b : a));
    const index = STEPS.findIndex((step) => innermost.steps.has(step.id));
    if (index !== -1) { current = index; reached = Math.max(reached, index); render(); }
  }, true);

  /* ── 8. Initial state ── */
  syncTiles();
  render();
})();