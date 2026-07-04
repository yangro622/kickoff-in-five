#!/usr/bin/env python3
"""Merge a rankings.json file (see research/prompt-rankings.md) into data/players.json.

Usage: python3 tools/apply_rankings.py rankings.json

Only touches the world_ranking field of players named in the rankings map;
unknown player ids are reported, everything else is left untouched.
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAYERS_JSON = ROOT / "data" / "players.json"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    incoming = json.loads(pathlib.Path(sys.argv[1]).read_text())
    rankings = incoming.get("rankings", {})
    if not rankings:
        sys.exit("no 'rankings' map found in input")

    data = json.loads(PLAYERS_JSON.read_text())
    by_id = {p["id"]: p for p in data["players"]}
    applied, unknown = 0, []
    for pid, rank in rankings.items():
        if pid in by_id and isinstance(rank, int) and 1 <= rank <= 100:
            by_id[pid]["world_ranking"] = rank
            applied += 1
        else:
            unknown.append(pid)

    PLAYERS_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"applied {applied} rankings")
    if unknown:
        print("skipped (unknown id or invalid rank):", ", ".join(unknown))


if __name__ == "__main__":
    main()
