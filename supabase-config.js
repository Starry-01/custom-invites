/* ═══════════════════════════════════════════════════════════════
   Celesticate Moments — Supabase connection (Phase 4.4)

   This file may contain ONLY public values. The project URL and the
   "anon" / publishable key are designed to be seen by every visitor;
   what protects the data is Row Level Security in the database
   (supabase/migrations). Never put the service_role key or any
   "secret" key here or anywhere else in the frontend. account.js
   refuses to start if it recognises one.

   Left empty, the site works exactly as before: guests can create,
   preview and download, and the Save / Sign in buttons explain that
   accounts are not connected yet. Nothing contacts Supabase until
   both values below are filled in.
   ═══════════════════════════════════════════════════════════════ */
window.CELESTICATE_SUPABASE = {
  url: 'https://jlflyufuzrouqclbgrih.supabase.co',          // e.g. 'https://abcdefghijklmnop.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZmx5dWZ1enJvdXFjbGJncmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0OTAyMTQsImV4cCI6MjEwNjA2NjIxNH0.Mjy6545muvXZdRFKM1E4Tv4puyz_YiVIN4tm2AQQecc',      // the public anon / publishable key from Project Settings → API
  // The Supabase client library, loaded only when the two values above are set.
  // Pinned to an exact version. Add the sha384 hash as sdkIntegrity (see docs/SUPABASE_SETUP.md).
  sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.js',
  sdkIntegrity: '',
};