#!/usr/bin/env python3
"""Pull finished knockout results from ESPN and update the data — no key.

The site is static, so nothing here runs in the browser. A GitHub Action
runs this on a schedule during the tournament (and you can run it by hand):

    python3 tools/live_update.py            # fetch, write, cascade
    python3 tools/live_update.py --dry-run  # show changes, write nothing

For every match that has kicked off but isn't final yet, it looks up that
day on ESPN's public World Cup scoreboard, matches the event by our two
teams, and — only once ESPN marks it completed — writes the final score
(and the shootout line for a penalty finish). Then bracket.cascade() fills
the next round, refreshes "Winner of ..." placeholders and flips still_alive.
The only fact that ever comes from outside is the raw scoreline.
"""

import argparse
import json
import pathlib
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone

import bracket  # same directory

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATCHES = ROOT / "data" / "matches.json"
TEAMS = ROOT / "data" / "teams.json"
SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates={ymd}"
UA = {"User-Agent": "kickoff-in-five/0.1 (+https://github.com/yangro622/kickoff-in-five)"}

# ESPN display name -> our team id, only where the two disagree. ESPN's World
# Cup names match ours for all 16 current teams, so this is just a safety net.
ALIASES = {"usa": "usa", "united states of america": "usa", "korea republic": "kor"}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


def fetch_day(ymd):
    url = SCOREBOARD.format(ymd=ymd)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace")).get("events", [])


def find_competition(events, want_ids, id_of):
    """The ESPN competition whose two teams are exactly our match's teams."""
    for e in events:
        comp = e.get("competitions", [{}])[0]
        got = {id_of(c["team"].get("displayName")) for c in comp.get("competitors", [])}
        if want_ids <= got:
            return comp
    return None


def result_from(comp, t1, t2, id_of):
    """Return {status, score, penalties?} once completed, else None."""
    st = comp.get("status", {}).get("type", {})
    if not st.get("completed"):
        return None
    by = {id_of(c["team"].get("displayName")): c for c in comp.get("competitors", [])}
    c1, c2 = by.get(t1), by.get(t2)
    if not c1 or not c2:
        return None

    def as_int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    g1, g2 = as_int(c1.get("score")), as_int(c2.get("score"))
    if g1 is None or g2 is None:
        return None
    out = {"status": "final", "score": f"{g1}-{g2}"}
    p1, p2 = as_int(c1.get("shootoutScore")), as_int(c2.get("shootoutScore"))
    if p1 is not None and p2 is not None and (p1 or p2):
        out["penalties"] = f"{p1}-{p2}"
    return out


def run(dry_run=False):
    data = json.loads(MATCHES.read_text())
    matches = data["matches"]
    teams_doc = json.loads(TEAMS.read_text())
    teams = teams_doc["teams"]

    id_of = {norm(t["name"]): t["id"] for t in teams}
    id_of.update(ALIASES)
    resolve = lambda name: id_of.get(norm(name))

    # Fill any slots already decided by earlier finals so QF+ teams are known.
    bracket.cascade(matches, teams)

    now = datetime.now(timezone.utc)
    day_cache = {}
    changed = False

    for m in matches:
        if m.get("status") == "final" or not m.get("datetime_utc"):
            continue
        kickoff = datetime.fromisoformat(m["datetime_utc"].replace("Z", "+00:00"))
        if kickoff > now:
            continue  # hasn't started
        t1, t2 = m.get("team1_id"), m.get("team2_id")
        if t1 in (None, "", "tbd") or t2 in (None, "", "tbd"):
            continue  # matchup not set yet (an earlier round is still open)

        ymd = kickoff.strftime("%Y%m%d")
        if ymd not in day_cache:
            try:
                day_cache[ymd] = fetch_day(ymd)
            except Exception as e:  # network/API hiccup: skip, try again next run
                print(f"fetch failed for {ymd}: {e}", file=sys.stderr)
                day_cache[ymd] = []
        comp = find_competition(day_cache[ymd], {t1, t2}, resolve)
        if not comp:
            continue
        res = result_from(comp, t1, t2, resolve)
        if not res:
            continue
        if any(m.get(k) != v for k, v in res.items()):
            m.update(res)
            changed = True
            line = f"{res['score']}" + (f" (pens {res['penalties']})" if res.get("penalties") else "")
            print(f"FINAL  {m['id']}: {t1} {line} {t2}")

    # Propagate the new finals through the bracket.
    if bracket.cascade(matches, teams):
        changed = True

    if not changed:
        print("no changes")
        return False
    if dry_run:
        print("[dry-run] would update data/matches.json + data/teams.json")
        return True
    MATCHES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    TEAMS.write_text(json.dumps(teams_doc, indent=2, ensure_ascii=False) + "\n")
    print("wrote data/matches.json + data/teams.json")
    return True


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    run(dry_run=args.dry_run)
