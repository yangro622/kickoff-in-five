Research the head-to-head history for a set of possible 2026 World Cup knockout
matchups. The goal is a *precomputed* preview for every pairing the remaining
bracket can still produce, so the site can drop it in automatically the moment
two teams are drawn together — no last-minute scramble.

You will be given a list of team-pairs (e.g. `bra__mex`, `arg__esp`). For each,
produce a JSON object matching this schema exactly:

```json
{
  "matchups": {
    "bra__mex": {
      "round": "QF",
      "storyline": "Why this matchup is juicy. 2 sentences.",
      "things_to_watch": ["exactly", "three", "items"],
      "h2h": ["Brazil beat Mexico 2-0 in the 2018 Round of 16 …", "…"]
    }
  }
}
```

Field rules:
- Key each entry `"<idA>__<idB>"` with the two team ids **sorted alphabetically**
  (`bra__mex`, not `mex__bra`), using the ids from `data/teams.json`.
- `round`: the round this pairing would occur in (`QF`, `SF`, `F`). A given pair
  can only ever meet in one round, because the two halves of the bracket are
  disjoint.
- `things_to_watch`: exactly three concrete things a beginner can watch for —
  one signature threat from each team, plus one contrast of styles.
- `h2h`: real head-to-head facts only. **Verify every scoreline with search.**
  If two teams rarely meet, say exactly that instead of inventing a result.
- Do **not** write `stakes` — the site derives it from the bracket (which venue
  and date the winner advances to), so it must not be hard-coded here.

Audience is soccer beginners — plain English, no jargon. No invented quotes,
scores, or stats. Output raw JSON only.

## Faster path (no session needed)

`tools/gen_matchups.py` already builds `data/matchups.json` for all 85 current
pairings, composing the prose from `teams.json` / `players.json` and carrying a
curated, search-verified head-to-head table for the marquee ties. To refresh
after results change the set of alive teams, or after editing the curated facts
and identities inside the generator, just run:

    python3 tools/gen_matchups.py

Use this prompt only when you want a human/LLM pass to enrich the head-to-head
facts beyond what the generator ships with.
