/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Phase 4.4: Optional account & invitation ownership

   Guests never need this file to do anything: creating, previewing and
   downloading a personal preview work with no account and no network.
   Sign-in is asked for only when someone chooses Save or Open last saved.

   What it does:   sign in · create account · sign out · save the current
                   invitation to the signed-in user's own record · open the
                   most recent record.
   What it does NOT do (later phases): autosave, a list of invitations,
                   photo storage, publishing, production requests.

   Security:       only the public project URL and anon key are used. Who may
                   read or write a row is decided by Row Level Security in
                   the database (supabase/migrations), never by this file.
                   If a service-role / secret key is found in the config this
                   module refuses to start.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const cfg = window.CELESTICATE_SUPABASE || {};
  const STASH_KEY = 'celesticate:pending-draft';
  const STASH_TTL_MS = 60 * 60 * 1000;
  const byId = (id) => document.getElementById(id);
  const invitations = () => window.celesticate;

  /* ── Is the connection configured, and is the key safe to have in a browser? ── */
  function looksPrivileged(key) {
    if (/^sb_secret_/i.test(key)) return true;
    const parts = key.split('.');
    if (parts.length === 3) {
      try { return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (err) { return false; }
    }
    return false;
  }
  const url = typeof cfg.url === 'string' ? cfg.url.trim() : '';
  const anonKey = typeof cfg.anonKey === 'string' ? cfg.anonKey.trim() : '';
  const unsafeKey = !!anonKey && looksPrivileged(anonKey);
  if (unsafeKey) console.error('Celesticate: supabase-config.js contains a privileged (service-role / secret) key. Account features are disabled. Remove it and rotate that key in Supabase now.');
  const configured = /^https:\/\//i.test(url) && !!anonKey && !unsafeKey;

  const state = { client: null, user: null, recordId: null, busy: false, pending: null, mode: 'signin', authBusy: false, loading: null };
  const els = {};

  /* ── Header message line ── */
  let noteTimer = null;
  function note(kind, message) {
    if (!els.note) return;
    clearTimeout(noteTimer);
    els.note.textContent = message || '';
    if (kind) els.note.dataset.kind = kind; else delete els.note.dataset.kind;
    if (kind === 'ok') noteTimer = setTimeout(() => { els.note.textContent = ''; }, 12000);
  }

  function render() {
    const on = !!state.user;
    els.account.hidden = on;
    els.signout.hidden = !on;
    els.open.hidden = !on;
    els.email.hidden = !on;
    els.email.textContent = on ? (state.user.email || 'Signed in') : '';
    els.save.title = on ? 'Save this invitation to your account' : 'Save this invitation to your account (an account is needed)';
  }

  function setBusy(on, button, busyLabel) {
    state.busy = on;
    [els.save, els.open, els.signout].forEach((b) => { if (b) { if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); } });
    if (!button) return;
    const label = button.querySelector('.dl-label') || button;
    if (on) { button.dataset.idleLabel = label.textContent; label.textContent = busyLabel; button.setAttribute('aria-busy', 'true'); }
    else { if (button.dataset.idleLabel) label.textContent = button.dataset.idleLabel; button.removeAttribute('aria-busy'); }
  }

  /* ── Client ── */
  function loadSdk() {
    if (window.supabase && typeof window.supabase.createClient === 'function') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = cfg.sdkUrl;
      if (cfg.sdkIntegrity) { script.integrity = cfg.sdkIntegrity; script.crossOrigin = 'anonymous'; }
      script.onload = resolve;
      script.onerror = () => reject(new Error('sdk'));
      document.head.append(script);
    });
  }

  function ensureClient() {
    if (state.client) return Promise.resolve(state.client);
    if (!state.loading) {
      state.loading = loadSdk().then(async () => {
        const client = window.supabase.createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
        client.auth.onAuthStateChange((event, session) => {
          // Never call the client from inside this callback; defer to the next tick.
          setTimeout(() => onAuthChange(event, session), 0);
        });
        const { data } = await client.auth.getSession();
        state.client = client;
        state.user = data && data.session ? data.session.user : null;
        render();
        cleanAuthParams();
        return client;
      }).catch((err) => { state.loading = null; throw err; });
    }
    return state.loading;
  }

  function cleanAuthParams() {
    const params = new URLSearchParams(window.location.search);
    if (!['code', 'error', 'error_code', 'error_description'].some((k) => params.has(k))) return;
    if (params.has('error_description')) note('error', 'That sign-in or confirmation link is invalid or has expired. Please try again.');
    ['code', 'error', 'error_code', 'error_description'].forEach((k) => params.delete(k));
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }

  function onAuthChange(event, session) {
    const previous = state.user && state.user.id;
    state.user = session ? session.user : null;
    if (!state.user || (previous && previous !== state.user.id)) state.recordId = null;
    render();
    if (event === 'SIGNED_IN' && state.user) {
      restoreStash();
      // A confirmation link opened in another tab signs this tab in too: carry on with what the person asked for.
      if (els.dialog.open || state.pending) continueAfterSignIn();
    }
  }

  /* ── Draft stash: only for the "confirm your email" round trip. Local to this browser, expires in an hour. ── */
  function stashDraft() {
    try { localStorage.setItem(STASH_KEY, JSON.stringify({ at: Date.now(), payload: invitations().serialize() })); } catch (err) { /* storage may be blocked; the draft stays in this tab */ }
  }
  function clearStash() { try { localStorage.removeItem(STASH_KEY); } catch (err) { /* ignore */ } }
  function restoreStash() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STASH_KEY) || 'null'); } catch (err) { saved = null; }
    if (!saved) return;
    clearStash();
    if (!saved.at || Date.now() - saved.at > STASH_TTL_MS) return;
    if (!invitations().isPristine()) return;                    // never overwrite work in progress
    const result = invitations().load(saved.payload);
    if (result.ok) {
      const photos = result.missing.length ? ` ${result.missing.length} photo or music file${result.missing.length === 1 ? '' : 's'} could not be kept and need adding again.` : '';
      note('ok', `Your unsaved invitation was restored.${photos}`);
    }
  }

  /* ── Auth dialog ── */
  function setMode(mode) {
    state.mode = mode;
    const signup = mode === 'signup';
    els.tabIn.setAttribute('aria-pressed', String(!signup));
    els.tabUp.setAttribute('aria-pressed', String(signup));
    els.submit.textContent = signup ? 'Create account' : 'Sign in';
    els.password.autocomplete = signup ? 'new-password' : 'current-password';
    els.hint.hidden = !signup;
    clearAuthMessages();
  }
  function clearAuthMessages() {
    els.error.hidden = true; els.error.textContent = '';
    els.info.hidden = true; els.info.textContent = '';
    els.email.removeAttribute('aria-invalid'); els.password.removeAttribute('aria-invalid');
  }
  function openAuth(mode, title) {
    if (!els.dialog || typeof els.dialog.showModal !== 'function') return;
    setMode(mode || 'signin');
    byId('auth-title').textContent = title || 'Sign in to save';
    if (!els.dialog.open) els.dialog.showModal();
    els.emailInput.focus();
  }
  function closeAuth() { if (els.dialog.open) els.dialog.close(); }
  function authError(message, field) {
    els.info.hidden = true;
    els.error.textContent = message;
    els.error.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function explainAuthError(err) {
    const text = `${(err && err.code) || ''} ${(err && err.message) || ''}`.toLowerCase();
    const status = err && err.status;
    if (err && (err.name === 'AuthRetryableFetchError' || err instanceof TypeError || /failed to fetch|networkerror|network request/.test(text) || status === 0)) return 'Could not reach the account service. Check your connection and try again.';
    if (status === 429 || /rate.?limit|too many/.test(text)) return 'Too many attempts. Please wait a moment and try again.';
    if (/email not confirmed|email_not_confirmed/.test(text)) return 'Please confirm your email first. Check your inbox for the confirmation link.';
    if (/invalid login|invalid_credentials/.test(text)) return 'That email and password do not match. Check them and try again.';
    if (/weak_password|password should|password is too/.test(text)) return 'Choose a stronger password with at least 8 characters.';
    if (/already registered|user_already_exists|already been registered/.test(text)) return 'An account with that email may already exist. Try signing in instead.';
    if (/signup.*disabled|signups not allowed/.test(text)) return 'Creating accounts is turned off right now.';
    return 'Something went wrong, so you were not signed in. Please try again.';
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (state.authBusy) return;
    clearAuthMessages();
    const email = els.emailInput.value.trim();
    const password = els.password.value;
    const signup = state.mode === 'signup';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError('Enter a valid email address.', els.emailInput);
    if (!password) return authError('Enter your password.', els.password);
    if (signup && password.length < 8) return authError('Use at least 8 characters for your password.', els.password);

    state.authBusy = true;
    els.submit.setAttribute('aria-busy', 'true');
    els.submit.setAttribute('aria-disabled', 'true');
    els.submit.textContent = signup ? 'Creating account…' : 'Signing in…';
    try {
      const client = await ensureClient();
      if (signup) {
        const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
        if (error) throw error;
        if (data && data.session) { state.user = data.session.user; render(); els.password.value = ''; continueAfterSignIn(); }
        else {
          stashDraft();
          els.password.value = '';
          els.info.textContent = 'Check your email to confirm your account. Your invitation is kept as it is. After you confirm, sign in here (or continue in this tab) and save.';
          els.info.hidden = false;
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data || !data.session) throw new Error('no session');
        state.user = data.session.user; render(); els.password.value = '';
        continueAfterSignIn();
      }
    } catch (err) {
      authError(err && err.message === 'sdk' ? 'The account service could not be loaded. Check your connection and try again.' : explainAuthError(err));
    } finally {
      state.authBusy = false;
      els.submit.removeAttribute('aria-busy');
      els.submit.removeAttribute('aria-disabled');
      els.submit.textContent = state.mode === 'signup' ? 'Create account' : 'Sign in';
    }
  }

  function continueAfterSignIn() {
    closeAuth();
    const action = state.pending;
    state.pending = null;
    clearStash();
    note('ok', `Signed in as ${state.user.email || 'your account'}.`);
    if (action === 'save') doSave();
    else if (action === 'open') openLast();
  }

  /* ── Save (create or update the user's own record) ── */
  const makeId = () => (window.crypto && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16); }));

  /** Plain-language reason. Only claims "nothing was saved" when the server definitely refused the write. */
  function explainSaveError(err, verb) {
    const code = String((err && err.code) || '');
    const text = `${code} ${(err && err.message) || ''}`.toLowerCase();
    const saving = verb !== 'open';
    if (err instanceof TypeError || /failed to fetch|networkerror|network request/.test(text)) {
      return saving
        ? 'Could not reach the account service, so the invitation may not have been saved. Press Save again; repeating it will not create a duplicate.'
        : 'Could not reach the account service. Nothing was changed.';
    }
    if (code === '23514') return 'This invitation was not saved because it is too large or has an invalid value.';
    if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|could not find the table/.test(text)) return 'Saving is not set up on the server yet (the invitations table is missing), so nothing was saved. See docs/SUPABASE_SETUP.md.';
    if (code === '42501' || /row-level security|permission denied/.test(text)) return 'Your account is not allowed to do that, so nothing was changed. Sign out, sign in again, and retry.';
    return saving ? 'The invitation could not be saved. Please try again.' : 'Your saved invitation could not be opened. Please try again.';
  }
  const isExpiredSession = (err) => !!err && (err.status === 401 || /jwt expired|invalid jwt|jwt/i.test(String(err.message || '')));

  async function save() {
    if (state.busy) return;
    if (!configured) {
      note('', unsafeKey
        ? 'Accounts are switched off because the site configuration contains a private key. Your invitation is unchanged.'
        : 'Cloud saving is not available yet: this site is not connected to an account service. Your invitation is unchanged, and you can still preview and download it.');
      return;
    }
    try { await ensureClient(); } catch (err) { note('error', 'The account service could not be loaded. Nothing was saved. Check your connection and try again.'); return; }
    if (!state.user) {
      state.pending = 'save';
      note('', 'Saving to your account needs you to sign in or create an account. Your invitation stays exactly as it is.');
      openAuth('signin', 'Sign in to save');
      return;
    }
    doSave();
  }

  async function doSave() {
    if (state.busy || !state.user) return;
    setBusy(true, els.save, 'Saving…');
    note('', 'Saving…');
    try {
      const payload = invitations().serialize();
      const c = payload.config;
      if (!state.recordId) state.recordId = makeId();   // stable id: a retried save updates, never duplicates
      const row = {
        id: state.recordId,
        title: String(c.names || '').slice(0, 200),
        event_type: c.eventType,
        template_id: c.template,
        schema_version: payload.schemaVersion,
        config: c,
      };
      const { data, error } = await state.client.from('invitations').upsert(row, { onConflict: 'id' }).select('id, updated_at').single();
      if (error) throw error;
      if (!data || !data.id) throw new Error('empty response');
      const time = new Date(data.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const hasFiles = c.gallery.images.length || c.cover || c.music.fileName;
      note('ok', `Saved to your account at ${time}.${hasFiles ? ' Photos and music files are not stored yet, so only their names are saved.' : ''}`);
    } catch (err) {
      if (isExpiredSession(err)) {
        state.pending = 'save';
        note('error', 'Your sign-in has expired, so the invitation was not saved. Please sign in again.');
        openAuth('signin', 'Sign in again to save');
      } else {
        note('error', explainSaveError(err, 'save'));
      }
    } finally {
      setBusy(false, els.save);
    }
  }

  /* ── Open the most recent saved invitation (basic round trip; the full list is Phase 4.7) ── */
  function confirmReplace() {
    const dialog = byId('open-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return Promise.resolve(true);
    return new Promise((resolve) => {
      dialog.returnValue = '';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
    });
  }

  async function openLast() {
    if (state.busy) return;
    if (!state.user || !state.client) { state.pending = 'open'; if (configured) openAuth('signin', 'Sign in to open your invitation'); return; }
    setBusy(true, els.open, 'Opening…');
    note('', 'Looking for your saved invitation…');
    try {
      const { data, error } = await state.client.from('invitations')
        .select('id, schema_version, config, updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) { note('', 'You have no saved invitations yet. Use Save to keep the one you are editing.'); return; }
      if (!invitations().isPristine()) {
        setBusy(false, els.open);
        if (!(await confirmReplace())) { note('', 'Kept what you were editing.'); return; }
        setBusy(true, els.open, 'Opening…');
      }
      const result = invitations().load({ schemaVersion: data.schema_version, config: data.config });
      if (!result.ok) { note('error', result.error); return; }
      state.recordId = data.id;                           // the next Save updates this record
      const files = result.missing.length ? ` ${result.missing.length} photo or music file${result.missing.length === 1 ? '' : 's'} used by this invitation are not stored yet, so add them again.` : '';
      note('ok', `Opened your saved invitation.${files}${result.notes.length ? ` ${result.notes.join(' ')}` : ''}`);
    } catch (err) {
      note('error', isExpiredSession(err) ? 'Your sign-in has expired. Please sign in again.' : explainSaveError(err, 'open'));
    } finally {
      setBusy(false, els.open);
    }
  }

  async function signOut() {
    if (state.busy || !state.client) return;
    setBusy(true, els.signout, 'Signing out…');
    let message = 'Signed out. The invitation you are editing here is unchanged.';
    try {
      const { error } = await state.client.auth.signOut();
      if (error) { await state.client.auth.signOut({ scope: 'local' }); message = 'Signed out on this device, but the account service could not be reached. The invitation you are editing is unchanged.'; }
    } catch (err) {
      try { await state.client.auth.signOut({ scope: 'local' }); } catch (e2) { /* nothing more to do */ }
      message = 'Signed out on this device, but the account service could not be reached. The invitation you are editing is unchanged.';
    } finally {
      state.user = null; state.recordId = null; state.pending = null;
      render();
      setBusy(false, els.signout);
      note('ok', message);
    }
  }

  /* ── Wiring ── */
  function init() {
    ['account-btn', 'signout-btn', 'open-saved-btn', 'save-btn', 'account-note', 'account-email', 'auth-dialog', 'auth-form', 'auth-email', 'auth-password', 'auth-password-hint', 'auth-error', 'auth-info', 'auth-submit', 'auth-tab-signin', 'auth-tab-signup', 'auth-cancel']
      .forEach((id) => { els[id] = byId(id); });
    if (!els['save-btn'] || !els['auth-dialog'] || !invitations()) return;
    Object.assign(els, {
      account: els['account-btn'], signout: els['signout-btn'], open: els['open-saved-btn'], save: els['save-btn'], note: els['account-note'],
      email: els['account-email'], dialog: els['auth-dialog'], form: els['auth-form'], emailInput: els['auth-email'], password: els['auth-password'],
      hint: els['auth-password-hint'], error: els['auth-error'], info: els['auth-info'], submit: els['auth-submit'], tabIn: els['auth-tab-signin'], tabUp: els['auth-tab-signup'], cancel: els['auth-cancel'],
    });
    render();

    els.save.addEventListener('click', save);
    els.open.addEventListener('click', openLast);
    els.signout.addEventListener('click', signOut);
    els.account.addEventListener('click', async () => {
      if (!configured) { save(); return; }
      try { await ensureClient(); } catch (err) { note('error', 'The account service could not be loaded. Check your connection and try again.'); return; }
      state.pending = null;
      openAuth('signin', 'Sign in');
    });
    els.tabIn.addEventListener('click', () => setMode('signin'));
    els.tabUp.addEventListener('click', () => setMode('signup'));
    els.form.addEventListener('submit', submitAuth);
    els.cancel.addEventListener('click', () => { state.pending = null; closeAuth(); note('', 'Continuing without an account. Your invitation is unchanged.'); });
    els.dialog.addEventListener('cancel', () => { state.pending = null; });   // Escape: same as "Continue without an account"
    document.addEventListener('celesticate:reset', () => { state.recordId = null; });   // a reset invitation is a new draft

    if (configured) ensureClient().catch(() => { /* reported when the person actually tries to use an account */ });
  }

  window.CelesticateAccount = {
    isConfigured: () => configured,
    getState: () => ({ configured, signedIn: !!state.user, email: state.user ? state.user.email : '', recordId: state.recordId }),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();