Research the star players of the 16 Round-of-16 teams at the 2026 FIFA World Cup: 3–4 stars per team (~50 players total; star-heavy teams may have 5). Verify the actual Round-of-16 teams with search first.

For each player, produce a JSON object matching this schema exactly:

```json
{
  "players": [{
    "id": "mbappe",
    "team_id": "fra",
    "name": "Kylian Mbappé",
    "photo_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/…/256px-….jpg",
    "photo_credit": "Photographer Name, CC BY-SA 4.0, via Wikimedia Commons",
    "position": "Forward",
    "age": 27,
    "club": "Real Madrid",
    "league": "La Liga (Spain)",
    "journey": "2–3 sentences: where they came from, what defines them.",
    "watch_for": "One concrete on-field thing a newbie can spot.",
    "tournament_stats": {"goals": 0, "assists": 0, "note": "optional"},
    "as_of": "2026-07-03"
  }]
}
```

Field rules:
- `id`: lowercase-hyphenated surname (add first initial only if two players collide).
- `photo_url`: a **freely-licensed headshot from Wikimedia Commons only** — find the player's Commons page, pick a recent portrait-style photo, and use the direct `upload.wikimedia.org` thumbnail URL at ~256px width. Record the author + license in `photo_credit`. If no freely-licensed photo exists, set both to `null` — the site renders a clean initials avatar instead. Never use Getty, club, or news-agency images.
- `team_id`: lowercase 3-letter country code matching teams.json (`usa`, `fra`, `bra`, `eng`, `mex`, `can`, `mar`, `par`, `nor`, `bel`, …).
- `league` must use one of these exact names where applicable, so the site can link to its explainer: "Premier League (England)", "La Liga (Spain)", "Serie A (Italy)", "Bundesliga (Germany)", "Ligue 1 (France)", "MLS (USA & Canada)", "Saudi Pro League (Saudi Arabia)". Other leagues: "League Name (Country)".
- `tournament_stats` are THIS World Cup only, current as of `as_of`.
- `watch_for` is the money field: one thing a first-time viewer can literally see with their own eyes (a run, a position, a trick, a throw). Be concrete.

Audience is soccer beginners — plain English, no jargon. Verify every stat with search; include `as_of` dates; omit anything you can't verify. No invented quotes, no invented stats.

Output raw JSON only — no commentary, no markdown fences.
