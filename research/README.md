# Research kit — how content gets into the site

> **Status 2026-07-04:** a first full research pass is DONE and committed — 16 tier-1
> teams, ~47 star players, all 8 Ro16 matches with verified kickoff times, and the
> complete Learn section. Remaining TODO-RESEARCH slots: group letters/records,
> a few FIFA ranks (BEL/SUI/COL/NOR/EGY/PAR), a few current clubs (Enciso, James,
> Arias), formations/lineups, and QF venue assignment for the two July 11 games.
> Player photos: run `python3 tools/update_players.py` from the repo root on a
> machine with open internet — one script fetches FOX top-100 world rankings AND downloads ~256px Wikipedia lead images into
> `assets/players/`, records licenses in `assets/players/CREDITS.md`, and fills
> `photo_url`/`photo_credit` in players.json automatically.

The site renders **only** what's in `/data/*.json`. The renderer never invents facts:
anything still marked `"TODO-RESEARCH"` shows up on the site as an honest
"research pending" chip. That's the decoupling: **code lives in the repo root,
facts live in `/data/`, and these prompts are the bridge.**

## Workflow (run ~July 3, after the Round of 32 completes, and again as rounds finish)

1. Open a **fresh Claude session with web search enabled** — one session per prompt file below.
2. Paste the whole prompt file in.
3. Skim the JSON it returns. Fix anything that smells wrong. Spot-check 2–3 facts.
4. Replace the matching file in `/data/` (or merge the new objects in). Commit.
5. The site updates on the next page load. No build step.

| Prompt file | Fills | Notes |
|---|---|---|
| `prompt-teams.md` | `data/teams.json` | 16 Round-of-16 teams, full profiles |
| `prompt-players.md` | `data/players.json` | 3–4 stars per team (~50 players). Run after teams.json so IDs match |
| `prompt-matches.md` | `data/matches.json` | Verifies dates/venues/kickoff times; fills storylines, things to watch, H2H |
| `prompt-learn.md` | `data/learn.json` | Rules, format, positions, leagues |

## Accuracy rules (enforced in every prompt)

- Every object carries `as_of` (the date the facts were checked).
- No stat without date context. No invented quotes or stats.
- If a fact can't be verified by search, **omit it** — a shorter card beats a wrong one.

## Post-game updates (phone workflow)

Edit `data/matches.json` in the GitHub mobile web UI:

1. Set `"status": "final"`.
2. Set `"score": "2-1"` (and `"penalties": "4-3"` if it went to a shootout).
3. Write a one-line `"recap"`.
4. If a later-round `"tbd"` slot is now decided: replace `"team1_id": "tbd"` with the
   real team id and delete the `team1_tbd_note` line.
5. If a team is knocked out, flip its `"still_alive": false` in `data/teams.json`.

Commit. Done — the bracket, home page, and match cards all derive from this file.
