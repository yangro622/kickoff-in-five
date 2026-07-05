#!/usr/bin/env python3
"""Deterministic knockout-bracket logic — pure functions, no network.

Given the matches (each knockout match declares where its two teams come
from via `team1_from` / `team2_from` = the id of the feeding match) this
module resolves everything that used to be edited by hand after a game:

  * advancement  — fill a next-round slot with the winner of its feeder
  * tbd notes    — regenerate "Winner of A vs B" text for unresolved slots
  * still_alive  — a team is out the moment it loses a completed match
  * editorial    — inject the precomputed storyline/things_to_watch/h2h for
                   a matchup (from data/matchups.json) the moment both of a
                   match's teams are known, and derive its `stakes` from the
                   bracket. Fills only blank/TODO fields, so it is idempotent
                   and never clobbers a hand-written preview.

The GitHub Action calls `cascade()` after writing live scores into the
matches; it is equally safe to run by hand. Winners are read straight from
each final's `score` (and `penalties` for a shootout), so the only thing
that ever needs to arrive from outside is the raw scoreline.
"""

import json
import pathlib
import re

ROUND_LABEL = {"R16": "Round of 16", "QF": "QF", "SF": "SF", "F": "Final"}
MATCHUPS = pathlib.Path(__file__).resolve().parent.parent / "data" / "matchups.json"
_MONTHS = ["", "January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December"]


def _pair(s):
    """'3-1' / '3–1' / '4:2' -> (3, 1); anything unparseable -> None."""
    if not s:
        return None
    parts = re.split(r"[–\-:]", str(s))
    if len(parts) != 2:
        return None
    try:
        return int(parts[0].strip()), int(parts[1].strip())
    except ValueError:
        return None


def winner_side(match):
    """Return 1, 2, or None (not final / undecided) for a match."""
    if match.get("status") != "final":
        return None
    sc = _pair(match.get("score"))
    if not sc:
        return None
    a, b = sc
    if a != b:
        return 1 if a > b else 2
    pens = _pair(match.get("penalties"))          # knockouts can't draw
    if pens and pens[0] != pens[1]:
        return 1 if pens[0] > pens[1] else 2
    return None


def _side_team(match, side):
    return match.get(f"team{side}_id")


def winner_id(match):
    w = winner_side(match)
    return _side_team(match, w) if w else None


def loser_id(match):
    w = winner_side(match)
    return _side_team(match, 2 if w == 1 else 1) if w else None


def load_matchups(path=MATCHUPS):
    """Read the precomputed matchup library; {} if it is missing/unreadable."""
    try:
        return json.loads(pathlib.Path(path).read_text()).get("matchups", {})
    except (OSError, ValueError):
        return {}


def _is_todo(v):
    """True for a blank / unresearched editorial field."""
    if isinstance(v, list):
        return not v or all(_is_todo(x) for x in v)
    return v in (None, "", "TODO-RESEARCH")


def _fmt_date(d):
    try:
        y, mo, da = str(d).split("-")
        return f"{_MONTHS[int(mo)]} {int(da)}"
    except (ValueError, IndexError):
        return None


def _stakes(match, feeds):
    """Derive one line of stakes from where this match's winner goes next."""
    rnd = match.get("round")
    if rnd == "F":
        return "The winner is crowned champions of the world — soccer's ultimate prize."
    dest = feeds.get(match["id"])
    if not dest:
        return None
    where = dest.get("city") or dest.get("venue")
    when = _fmt_date(dest.get("date_local"))
    stage = "the semifinals" if rnd == "QF" else "the World Cup final"
    tail = (f" in {where}" if where else "") + (f" on {when}" if when else "")
    if rnd == "SF":
        return f"The winner reaches {stage}{tail} — one win from being champions of the world."
    return f"The winner reaches {stage}{tail}, one step from the final."


def apply_editorial(matches, matchups=None):
    """Fill storyline/things_to_watch/h2h/stakes for any match whose two
    teams are now known, pulling prose from the matchup library and stakes
    from the bracket. Only blank/TODO fields are touched. Returns True if
    anything changed."""
    if matchups is None:
        matchups = load_matchups()
    if not matchups:
        return False
    feeds = {}                                   # feeder match id -> the match it feeds
    for d in matches:
        for side in (1, 2):
            src = d.get(f"team{side}_from")
            if src:
                feeds[src] = d
    changed = False
    for m in matches:
        t1, t2 = m.get("team1_id"), m.get("team2_id")
        if t1 in (None, "", "tbd") or t2 in (None, "", "tbd"):
            continue
        entry = matchups.get("__".join(sorted([t1, t2])))
        if entry:
            for field in ("storyline", "things_to_watch", "h2h"):
                if field in entry and _is_todo(m.get(field)):
                    m[field] = entry[field]
                    changed = True
        if _is_todo(m.get("stakes")):
            s = _stakes(m, feeds)
            if s and m.get("stakes") != s:
                m["stakes"] = s
                changed = True
    return changed


def cascade(matches, teams, matchups=None):
    """Resolve advancement, tbd notes, still_alive and editorial in place.

    Returns True if anything changed (so callers can skip a no-op commit).
    """
    by_id = {m["id"]: m for m in matches}
    t_by_id = {t["id"]: t for t in teams}
    name = lambda tid: (t_by_id.get(tid) or {}).get("name")
    changed = False

    def is_open(tid):
        return tid in (None, "", "tbd")

    # Advancement. Loop to a fixpoint so R16 -> QF -> SF -> Final all chain
    # through in a single call regardless of match ordering.
    for _ in range(len(matches)):
        moved = False
        for m in matches:
            for side in (1, 2):
                src = m.get(f"team{side}_from")
                if not src or not is_open(_side_team(m, side)):
                    continue
                w = winner_id(by_id.get(src, {}))
                if w:
                    m[f"team{side}_id"] = w
                    m.pop(f"team{side}_tbd_note", None)
                    moved = changed = True
        if not moved:
            break

    # Refresh the human-readable placeholder for still-open slots.
    for m in matches:
        for side in (1, 2):
            if not is_open(_side_team(m, side)):
                continue
            src = by_id.get(m.get(f"team{side}_from"))
            if not src:
                continue
            a, b = name(_side_team(src, 1)), name(_side_team(src, 2))
            note = (f"Winner of {a} vs {b}" if a and b
                    else f"Winner of {ROUND_LABEL.get(src['round'], src['round'])} {src['bracket_slot']}")
            if m.get(f"team{side}_tbd_note") != note:
                m[f"team{side}_tbd_note"] = note
                changed = True

    # still_alive: everyone alive until they lose a completed match.
    alive = {t["id"]: True for t in teams}
    for m in matches:
        lost = loser_id(m)
        if lost in alive:
            alive[lost] = False
    for t in teams:
        if t.get("still_alive") != alive[t["id"]]:
            t["still_alive"] = alive[t["id"]]
            changed = True

    # Inject the precomputed preview for any matchup that is now fully known.
    if apply_editorial(matches, matchups):
        changed = True

    return changed
