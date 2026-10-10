# Tube Brief data

Written by the daily Tube Brief automation (6am). Plain JSON, no database.

## `bank.json` — the knowledge bank

Everything I've been shown, keyed by concept slug. The automation reads it before choosing anything, so gaps drive selection.

```
concepts.<slug> = {
  name, what, aliases[],
  familiarity: 0-10 | null,          // my rating
  status: unrated | gap (0-3) | learning (4-7) | known (8-10),
  rated_at, times_seen, first_seen, last_seen,
  channels[], origins[], last_article
}
```

Hand-edit a `familiarity` + `rated_at` here to rate something. The automation never lowers a newer `rated_at`.

## `briefs/YYYY-MM-DD.json` — one brief per day

```
{ date, through_line, sections[{key,title,sub}],
  items[{ id, section, concept_label, title, url, summary, also[{title,url}],
          provenance, read_time, published, undated, concepts[] }],
  bank_summary, source_ledger, source_ledger_text }
```

Sections, in order: `learn` (topics from the Learn box on my Notion home — always first), `work`, `shipping`, `reading`, `foundations`. Concepts that came from the Learn box carry `learn_request: true` and origin `learn` in the bank.

`id` is stable per URL; an item that already has a rating is never shown again.
