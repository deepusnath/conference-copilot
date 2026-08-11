# ADR 001: v2 stack — vanilla JS + GitHub Pages + Supabase

**Status:** accepted · 2026-08-11

## Context
v1 is a zero-build static app (Pages + a claude.ai artifact build). v2 needs
accounts, cross-device sync, and later scheduled scrapers/notifications. The
maintainer is a solo PhD researcher entering field season (Sep–Dec 2026):
maintenance budget is near zero, and the artifact build must keep working.

## Decision
1. **Stay vanilla JS, zero-build.** No Vite/React migration yet. The app is
   ~50KB across three files; a framework buys nothing at this size and costs a
   build pipeline. Revisit at Sprint 4 if multi-user UI complexity demands it.
2. **Stay on GitHub Pages.** The Supabase anon key is public by design (RLS is
   the security boundary), so no server-side env secrets are needed for the
   frontend. Vercel/Netlify deferred until server-rendered pages exist.
3. **Supabase as the backend** (Postgres + magic-link auth + RLS), loaded via
   `esm.sh` dynamic import **only when `config.js` provides credentials** —
   without config the app runs in today's localStorage-only mode. The artifact
   build pins config to null (its CSP blocks external hosts anyway).
4. **v2 data model: one row per user** (`user_pipelines.data` jsonb holding the
   whole pipeline array), last-write-wins. Per-entity tables (shared venues,
   drafts, quality DB) arrive with the Sprint 4 multi-user work, which needs
   them; migration path is a straightforward fan-out of the jsonb.

## Consequences
- No build step to break during field season; contributors need zero tooling.
- LWW sync can lose a concurrent edit across two devices — acceptable at
  single-user scale, revisited in Sprint 4.
- Scrapers/notifications (Sprint 3) run as scheduled jobs (GitHub Actions cron
  or Supabase Edge Functions) writing to Postgres — independent of this choice.
- Framework migration, if ever needed, is contained: logic already lives apart
  from content (`app.js` vs `seed-data.js`).
