Research the knockout-stage matches of the 2026 FIFA World Cup, Round of 16 through the final (July 19). First verify with search: the confirmed Round-of-16 matchups, and the exact date, kickoff time (in UTC), stadium name, and city for every match.

For each match, produce a JSON object matching this schema exactly:

```json
{
  "matches": [{
    "id": "r16-usa-bel",
    "round": "R16",
    "bracket_slot": 5,
    "datetime_utc": "2026-07-07T00:00:00Z",
    "date_local": "2026-07-06",
    "venue": "Seattle Stadium",
    "city": "Seattle, USA",
    "team1_id": "usa",
    "team2_id": "bel",
    "status": "upcoming",
    "score": null,
    "penalties": null,
    "recap": null,
    "storyline": "Why this matchup is juicy. 2–4 sentences.",
    "things_to_watch": ["exactly", "three", "items"],
    "h2h": ["Belgium beat the USA in extra time in the 2014 Round of 16.", "…"],
    "stakes": "One sentence: winner gets X, history on the line is Y.",
    "watch_link": "https://www.foxsports.com/live"
  }]
}
```

Field rules:
- `round`: one of `R16`, `QF`, `SF`, `F`. `bracket_slot`: 1–8 for R16, 1–4 for QF, 1–2 for SF, 1 for F, matching the official bracket order.
- Keep the existing match `id`s from the repo's seed file where the matchup is the same (`r16-can-mar`, `r16-par-fra`, `r16-bra-nor`, `r16-mex-eng`, `r16-usa-bel`, `r16-slot6`, `r16-slot7`, `r16-slot8`, `qf-1`…`qf-4`, `sf-1`, `sf-2`, `final`).
- `datetime_utc`: verified kickoff instant in UTC. `date_local`: the calendar date at the venue. If the kickoff time is not yet officially confirmed, set `datetime_utc` to null and keep `date_local`.
- Undetermined sides: `"team1_id": "tbd"` plus `"team1_tbd_note": "Winner of Spain vs Austria"` (same for team2).
- `things_to_watch`: exactly three items, each one concrete thing a beginner can watch for on the field in THIS match.
- For matches whose teams are still TBD, leave `storyline`/`things_to_watch`/`h2h`/`stakes` as `"TODO-RESEARCH"`.
- `watch_link`: the official US broadcaster's live page for the match if you can verify it; otherwise a general "where to watch" page.

Audience is soccer beginners — plain English, no jargon. Verify everything with search. No invented quotes, no invented stats, no guessed kickoff times. If a fact can't be verified, omit it or mark it `"TODO-RESEARCH"`.

Output raw JSON only — no commentary, no markdown fences.
