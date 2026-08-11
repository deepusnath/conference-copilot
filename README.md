# Research Conference CoPilot

A single-file web app for PhD researchers to track conference calls-for-papers,
submission deadlines, and their publication pipeline — built around research on
Self-Determination Theory (SDT) and gamified learning ecosystems.

**Live app:** https://deepusnath.github.io/conference-copilot/

## Features

- **Dashboard** — deadline countdowns with urgency states, click-to-drill-down
  stat tiles (open / closing ≤21 days / submitted / accepted)
- **Pipeline** — 28 preloaded venues (EDAS export + global CFP research),
  status workflow (watching → shortlisted → drafting → submitted → under review
  → accepted → registered → presented), notes, filters, JSON/CSV export
- **Researcher profile** — thesis, workstreams, roadmap, and conference track record
- **Agent playbook** — a master prompt + step-by-step guide for running a
  scout / vet / writer / registrar agent crew (e.g., in Claude Code) with a
  human-in-the-loop submission gate

All state persists in the browser via localStorage. No backend, no build step —
one HTML file.

## Run locally

Open `index.html` in a browser. That's it.

## Roadmap

- **v1 (this repo):** static tracker + agent playbook + weekly CFP scout digest
- **v2:** shared backend, scheduled EDAS/WikiCFP scrapers, email/WhatsApp
  deadline nudges, calendar sync
- **v3:** multi-user platform for any researcher: profiles, venue-quality
  database with predatory-venue screening, abstract-fit scoring, supervisor
  views, and full PhD-journey tracking

## Disclaimer

Deadlines were researched in August 2026 and several are marked "verify" —
always confirm on the official conference site before planning submissions.
