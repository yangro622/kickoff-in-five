# kickoff-in-five ⚽

**Catch up on any 2026 World Cup match in five minutes before kickoff.**

A mobile-first static site for soccer newcomers: the storyline, the stars, and
exactly what to watch for in every knockout match. Not a stats site, not a news
site — a five-minute briefing.

## How it works

- **Pure static.** One `index.html`, one `app.js`, one `styles.css`. No build
  step, no framework, no dependencies.
- **All facts live in `/data/*.json`.** The renderer fetches them client-side
  and never invents content — anything still marked `"TODO-RESEARCH"` renders
  as a visible "research pending" chip.
- **Hash routing**, so everything is deep-linkable:
  `#/` home · `#/match/:id` · `#/team/:id` · `#/player/:id` · `#/bracket` · `#/learn`
- The bracket is **derived** from `matches.json` (`round` + `bracket_slot`) —
  there is no separate bracket file to keep in sync.

## The two workflows

### 1. Post-game update (from your phone)

Edit `data/matches.json` in the GitHub mobile web UI:

```jsonc
"status": "final",
"score": "2-1",            // + "penalties": "4-3" if it went to a shootout
"recap": "One line on how it ended."
```

If a later-round `"tbd"` slot is now decided, replace `"team1_id": "tbd"` with
the winner's team id and delete its `team1_tbd_note`. Flip the loser's
`"still_alive": false` in `data/teams.json`. Commit — the site updates on the
next page load.

### 2. Research drop (new rounds / new content)

Run the prompts in [`/research/`](research/README.md) in separate Claude
sessions with web search, skim the JSON they return, and commit it over the
files in `/data/`. One prompt per file; schemas are embedded in each prompt.
See `research/README.md` for the full pipeline and accuracy rules.

## Deploying

GitHub Pages, no build: repo **Settings → Pages → Deploy from a branch**, pick
the default branch, root folder. The site is served at
`https://<user>.github.io/kickoff-in-five/`.

## Local development

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Data caveats (seed state, as of 2026-07-03)

- Fixture dates/venues come from the PRD's directional table — **verify in the
  research pass** (kickoff times are deliberately `null` until verified).
- QF/SF pairings assume the standard bracket flow (R16 slots 1+2 → QF1, …);
  verify against the official bracket.
