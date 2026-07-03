Write a beginner's guide to soccer and the 2026 FIFA World Cup as JSON. Audience: an adult who knows soccer has 11 players and a goalie, about to watch a knockout match with friends, and doesn't want to feel lost. The whole thing should be skimmable in 5 minutes.

Produce JSON matching this schema exactly (keep the section `id`s and entry titles; write the `intro` and `body` text):

```json
{
  "sections": [
    {
      "id": "rules",
      "title": "The rules in 3 minutes",
      "intro": "One-sentence framing for the section.",
      "entries": [
        { "title": "The 90 minutes (and stoppage time)", "body": "…" },
        { "title": "Extra time & penalty shootouts", "body": "…" },
        { "title": "Offside, explained like a human", "body": "…" },
        { "title": "Yellow and red cards", "body": "…" },
        { "title": "Substitutions", "body": "…" },
        { "title": "VAR (video review)", "body": "…" }
      ]
    },
    {
      "id": "format",
      "title": "How the tournament works",
      "intro": "…",
      "entries": [
        { "title": "48 teams, 12 groups", "body": "…" },
        { "title": "Round of 32 — new this year", "body": "…" },
        { "title": "The knockout rounds to the July 19 final", "body": "…" },
        { "title": "Three host countries", "body": "…" }
      ]
    },
    {
      "id": "positions",
      "title": "Positions: who does what",
      "intro": "…",
      "entries": [
        { "title": "Goalkeeper", "body": "…" },
        { "title": "Defenders", "body": "…" },
        { "title": "Midfielders", "body": "…" },
        { "title": "Forwards", "body": "…" }
      ]
    },
    {
      "id": "leagues",
      "title": "The club leagues",
      "intro": "…",
      "entries": [
        { "title": "Premier League (England)", "body": "…" },
        { "title": "La Liga (Spain)", "body": "…" },
        { "title": "Serie A (Italy)", "body": "…" },
        { "title": "Bundesliga (Germany)", "body": "…" },
        { "title": "Ligue 1 (France)", "body": "…" },
        { "title": "MLS (USA & Canada)", "body": "…" },
        { "title": "Saudi Pro League (Saudi Arabia)", "body": "…" }
      ]
    }
  ]
}
```

Content rules:
- Each `body` is one short paragraph (2–5 sentences), plain English, zero jargon. Explain offside the way you'd explain it to a friend at a bar, not the way the rulebook does.
- Each position entry should name ONE famous current example player (verify with search that they're at the 2026 World Cup or currently famous).
- Each league entry: one paragraph on what it is and why it matters — the reader should come away understanding why "plays for Real Madrid" is a big deal.
- Verify 2026-specific facts (48 teams, 12 groups, Round of 32, three hosts, July 19 final) with search. No invented facts.

Output raw JSON only — no commentary, no markdown fences.
