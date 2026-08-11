# Scout → App JSON contract (v1)

The weekly CFP scout ends its digest with a fenced ```json block. Paste that block
into a `.json` file and use **Import JSON** in the app — new venues merge in as
`watching`; changed deadlines update in place with a note. User statuses, notes,
and drafts are never touched.

```json
{
  "type": "copilot-scout-digest",
  "version": 1,
  "date": "YYYY-MM-DD",
  "venues": [
    {
      "id": "kebab-case-slug-year",
      "acr": "ACRO 2027",
      "name": "Full venue name",
      "city": "City, Country",
      "event": "YYYY-MM-DD | null",
      "dl": "YYYY-MM-DD | null",
      "approx": true,
      "tier": 2,
      "url": "https://official-site",
      "why": "one-sentence fit rationale",
      "fits": [2],
      "sub": "portal | verify",
      "subUrl": "https://submission-page-if-verified",
      "src": "scout digest YYYY-MM-DD"
    }
  ]
}
```

Field rules:
- `id` — stable kebab-case slug ending in the year; the merge key.
- `tier` — 1 SDT/motivation core · 2 education/EdTech/management · 3 EDAS/engineering-ed · 4 journal.
- `fits` — workstreams: 1 bibliometric review · 2 structured-autonomy RCT · 3 higher-ed policy (3C) · 4 µLearn case study.
- `approx` — true unless the deadline was confirmed on the official page.
- `sub` — `"verify"` unless the submission portal was confirmed. Emails, URLs, and dates are never guessed; unverified fields are null.
- Only venues that are **new or changed** appear; an empty `venues` array is valid.

A full pipeline export (a bare JSON array) is also importable — that path **replaces**
the pipeline after confirmation, for cross-device restore.
