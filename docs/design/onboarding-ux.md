# Onboarding UX architecture — "5 questions to your CoPilot"

*Driven by beta feedback (Aug 2026): "confusing to see Deepu S. Nath's profile
and have to edit it." Design owner: maintainer. Status: accepted.*

## Diagnosis

The confusion is architectural, not cosmetic:

1. **Demo content and user content are the same object.** The founder's
   profile/pipeline IS the default state, so a new user's first act must be
   *deleting someone else's identity* — higher friction than a blank page,
   and it feels like trespassing.
2. **The seed venue list and the user's pipeline are the same list.** 38
   curated venues arrive pre-adopted into "my pipeline" instead of being a
   catalog to choose from.
3. **Onboarding lives in documentation** (BETA.md) instead of in the product.

## Design principles

- **Time-to-first-value under 3 minutes.** The "aha" is seeing *your*
  deadline dashboard with venues that match *your* research.
- **The catalog is the asset.** 38 screened venues + the twice-weekly scraped
  feed is the moat; onboarding = filtering that pool through five answers.
  Never make users build from nothing.
- **Progressive profiling.** Ask only what configuration needs now; every
  other field is editable later, in context. Every step has a working
  default; "Next" is never blocked.
- **Value before identity.** The wizard runs before sign-in; sign-in is
  offered at the reveal, when there is something worth keeping.
- **The founder's workspace becomes an explicit, labeled example** —
  entered only by choice, always wearing a banner, one click to leave.

## The flow

**Step 0 · Detection.** No local profile AND no cloud profile → wizard
(full-screen dialog). Two doors: **"Set up my CoPilot (2 min)"** (primary) /
"Explore the example workspace first" (secondary; adds persistent banner
"Example data — Start my CoPilot →").

**Step 1 · You.** Name · career stage (PhD candidate / postdoc / faculty /
independent) · institution · country (drives timezone display + travel-cost
hints).

**Step 2 · Your research.** Field picker (education / EdTech / psychology /
management / engineering / CS / other) · one-line topic · keyword chips
(pre-suggested per field, editable).

**Step 3 · Your papers.** "What are you working on?" 1–3 workstreams, each:
working title · stage (idea / design / data collected / results ready) ·
3–5 keywords. Stage powers feasibility logic: results-ready papers may
target near deadlines; ideas route to WIP-friendly venues.

**Step 4 · Constraints.** Budget ceiling · travel (home region / virtual-
first / anywhere) · what you value (indexing / feedback / community —
multi-select).

**Step 5 · The reveal.** "Here's your CoPilot": pipeline pre-populated from
the catalog via the existing keyword-matching engine — ranked by (keyword
hits × screening verdict × deadline feasibility for the paper's stage) —
top ~12 as *watching*, rest reachable via "Browse catalog". Then the sign-in
nudge: "Keep this on all your devices."

## Change-set (mapped to the codebase)

| # | Change | Where |
|---|--------|-------|
| 1 | Rename `DEFAULT_PROFILE` → `EXAMPLE_PROFILE`; new `EMPTY_PROFILE` scaffold; profile gains `meta:{field,stage,country,budget,travel,values[]}`; workstreams gain `stage` | seed-data.js |
| 2 | **Catalog/pipeline split:** SEED becomes the read-only catalog; a fresh pipeline starts empty and is *populated from* the catalog (wizard or "Add from catalog" browser). Existing users' pipelines untouched | app.js data load, new catalog view |
| 3 | First-run detection + 5-step wizard dialog (progress dots, back, skip, defaults, Enter-to-advance, full-screen under 640px) | app.js |
| 4 | Example-workspace mode: explicit entry, persistent banner, "Start my CoPilot" always visible; example edits never sync | app.js |
| 5 | Ranked matching for the reveal: extend `computeFits` with a score (hits × verdict weight × stage-feasibility) | app.js |
| 6 | Personalized empty states everywhere ("No venues yet — answer 5 questions" / "Nothing closing soon — the scout runs Monday") | renderers |
| 7 | "Restart setup" in profile tab; wizard re-entry maps to existing fields | app.js |
| 8 | Playbook tab master prompt generated from live profile (drop remaining founder hardcoding) | app.js |
| 9 | Beta metric: feedback template asks "how long until your dashboard felt yours?" | issue template |
| 10 | No migration needed: `profile.meta` rides the existing jsonb column; wizard only fires when no profile exists | — |

## Phasing

- **P1 (unblocks beta now):** #22 — detection, wizard steps 1–3 (name/field/
  keywords + 1 paper), reveal with current matcher, example-mode banner,
  empty pipeline start.
- **P2:** #23 — full catalog browser + constraints step + ranked scoring.
- **P3:** #24 — sign-in nudge placement, restart-setup, stage-aware
  deadline feasibility, calendar prompt post-reveal.
