Research the 16 teams in the Round of 16 at the 2026 FIFA World Cup (as of today's date — verify the actual qualified teams with search first; do not trust this prompt's memory of the bracket).

For each team, produce a JSON object matching this schema exactly:

```json
{
  "teams": [{
    "id": "usa",
    "name": "United States",
    "code": "USA",
    "flag": "🇺🇸",
    "color": "#1F2E5A",
    "tier": 1,
    "fifa_rank": 14,
    "group": "D",
    "group_summary": "1st in Group D (W2 D1)",
    "still_alive": true,
    "best_wc_finish": "Third place (1930)",
    "wc_history": "2–3 sentences, beginner-readable.",
    "storyline": "What this team is playing for THIS tournament. 2–4 sentences.",
    "style": "One sentence: how they play, in plain English.",
    "fun_facts": ["…", "…"],
    "star_player_ids": ["pulisic", "…"],
    "formation": "4-3-3",
    "lineup": [
      {"name": "Matt Turner", "position": "Goalkeeper", "player_id": null, "photo_url": null},
      {"name": "…", "position": "Right back", "player_id": null, "photo_url": null}
    ],
    "as_of": "2026-07-03"
  }]
}
```

Field rules:
- `id`: lowercase 3-letter country code (e.g. `usa`, `fra`, `bra`, `eng`, `mex`, `can`, `mar`, `par`, `nor`, `bel`). Keep these exact ids for teams already seeded in the repo.
- `color`: one hex color inspired by the team's primary kit (used as an accent stripe in the UI).
- `star_player_ids`: 3–4 lowercase-hyphenated player ids (e.g. `mbappe`, `bellingham`) — these must match the `id` values you (or a separate session) produce for players.json.
- `group_summary` should include their Round of 32 result too, e.g. "Won Group D, beat Chile 2–0 in the Ro32".
- `formation` + `lineup`: the team's typical starting XI at THIS tournament (their most-used lineup so far — verify with search; if genuinely unsettled, use the most recent match's XI). `lineup` is ordered goalkeeper first, then defenders right-to-left, then each further-forward line, matching the formation (e.g. 4-3-3 → 1 GK, 4 DEF, 3 MID, 3 FWD = 11 entries). `player_id` links a lineup entry to players.json when that player is one of the team's stars; otherwise null. `photo_url` for non-star lineup players is optional — **Wikimedia Commons freely-licensed images only** (direct upload.wikimedia.org thumb URL, ~256px); null if none exists.

Audience is soccer beginners — plain English, no jargon, no assumed knowledge. Verify every stat with search. Include `as_of` dates. If a fact can't be verified, omit it rather than guess. No invented quotes, no invented stats.

Output raw JSON only — no commentary, no markdown fences.
