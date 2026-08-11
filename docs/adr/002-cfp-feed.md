# ADR 002: scraped CFP data lives in repo files, not the database

**Status:** accepted · 2026-08-12

## Context
Sprint 3 needs scheduled CFP discovery. EDAS's listing is login-gated (verified:
404/login stub without a session) and automating a personal login is out of
bounds — credentials stay with the human. WikiCFP is public and parseable.

## Decision
- **WikiCFP is the automated source** (categories: education, psychology,
  e-learning, educational technology), scraped Tue/Fri by GitHub Actions into
  `data/cfp-feed.json` + `data/changes.json`, committed to the repo.
- **Repo files, not Supabase**, for shared scraped data: zero secrets in CI,
  full audit history via git, same-origin fetch from Pages, and the app's
  review queue keeps a human between scraped data and the pipeline. Migrating
  the feed into a shared `venues` table is Sprint 4 work, when multi-user needs it.
- **EDAS coverage stays human-in-the-loop**: the weekly Claude scout watches
  public conference pages, and the owner can import their logged-in EDAS
  listing manually. Scraped WikiCFP entries are always marked `unvetted` —
  WikiCFP hosts many predatory series, so the vet checklist stands between
  the queue and the pipeline.

## Consequences
- Scraper commits appear as bot commits; feed history is diffable.
- If WikiCFP changes markup, the scraper degrades to zero results and leaves
  the previous feed intact (never commits an empty feed).
- Email nudges (#13) are decoupled: v1 ships as calendar alarms in the .ics
  export; server-side email needs an owner-provided sender (Resend/SMTP).
