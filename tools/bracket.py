#!/usr/bin/env python3
"""Deterministic knockout-bracket logic — pure functions, no network.

Given the matches (each knockout match declares where its two teams come
from via `team1_from` / `team2_from` = the id of the feeding match) this
module resolves everything that used to be edited by hand after a game:

  * advancement  — fill a next-round slot with the winner of its feeder
  * tbd notes    — regenerate "Winner of A vs B" text for unresolved slots
  * still_alive  — a team is out the moment it loses a completed match

The GitHub Action calls `cascade()` after writing live scores into the
matches; it is equally safe to run by hand. Winners are read straight from
each final's `score` (and `penalties` for a shootout), so the only thing
that ever needs to arrive from outside is the raw scoreline.
"""

import re

ROUND_LABEL = {"R16": "Round of 16", "QF": "QF", "SF": "SF", "F": "Final"}


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


def cascade(matches, teams):
    """Resolve advancement, tbd notes and still_alive in place.

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

    return changed
