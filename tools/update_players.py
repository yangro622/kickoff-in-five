#!/usr/bin/env python3
"""One-shot player data updater: headshots + FOX top-100 world rankings.

Run from the repo root on a machine with open internet:

    python3 tools/update_players.py

It does two things to data/players.json:

1. HEADSHOTS — for every player, fetches their English Wikipedia article's
   lead image (hosted on Wikimedia Commons under a free license), saves a
   ~256px copy to assets/players/<id>.<ext>, records the author + license
   in assets/players/CREDITS.md, and fills photo_url / photo_credit.
   Players whose photo file already exists are skipped (delete the file to
   force a refresh); players without a usable image keep photo_url null and
   the site shows an initials avatar.

2. WORLD RANKINGS — fetches FOX Sports' "World Cup 2026: ranking best 100
   players" article and fills world_ranking for every player it can match
   by (accent-insensitive) name. Only exact-name matches are accepted; no
   guessing. If the article can't be fetched or parsed, this step is
   skipped with a warning — you can then use research/prompt-rankings.md
   to produce a rankings.json by hand; if a rankings.json file exists in
   the repo root, it is applied as the final step and wins over parsing.

Then commit the result:

    git add data/players.json assets/players
    git commit -m "data: player headshots + FOX top-100 rankings"
    git push
"""

import json
import pathlib
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAYERS_JSON = ROOT / "data" / "players.json"
OUT_DIR = ROOT / "assets" / "players"
CREDITS = OUT_DIR / "CREDITS.md"
RANKINGS_OVERRIDE = ROOT / "rankings.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) kickoff-in-five/0.1 (https://github.com/yangro622/kickoff-in-five)"}
FOX_URLS = [
    "https://amp.foxsports.com/stories/soccer/world-cup-2026-ranking-best-100-players",
    "https://www.foxsports.com/stories/soccer/world-cup-2026-ranking-best-100-players",
]

# Wikipedia article title overrides where the player's name is ambiguous.
TITLE_OVERRIDES = {
    "vitinha": "Vitinha (footballer, born February 2000)",
    "luis-diaz": "Luis Díaz (footballer, born 1997)",
    "gustavo-gomez": "Gustavo Gómez",
    "james": "James Rodríguez",
    "zizo": "Zizo (footballer)",
    "rodri": "Rodri (footballer, born 1996)",
    "enciso": "Julio Enciso (footballer, born 2004)",
}


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def get_json(url):
    return json.loads(get(url))


# ---------------- headshots ----------------

def wiki_summary(title):
    t = urllib.parse.quote(title.replace(" ", "_"))
    return get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{t}")


def lead_image_file(title):
    q = urllib.parse.urlencode({
        "action": "query", "prop": "pageimages", "piprop": "name",
        "titles": title, "format": "json", "formatversion": "2",
    })
    data = get_json(f"https://en.wikipedia.org/w/api.php?{q}")
    pages = data.get("query", {}).get("pages", [])
    return pages[0].get("pageimage") if pages else None


def image_credit(file_name):
    q = urllib.parse.urlencode({
        "action": "query", "prop": "imageinfo", "iiprop": "extmetadata",
        "titles": f"File:{file_name}", "format": "json", "formatversion": "2",
    })
    data = get_json(f"https://commons.wikimedia.org/w/api.php?{q}")
    try:
        meta = data["query"]["pages"][0]["imageinfo"][0]["extmetadata"]
    except (KeyError, IndexError):
        return None
    def clean(field):
        raw = meta.get(field, {}).get("value", "") or ""
        return re.sub(r"<[^>]+>", "", raw).strip()
    artist = clean("Artist") or "Unknown author"
    license_ = clean("LicenseShortName") or "see Commons"
    return f"{artist}, {license_}, via Wikimedia Commons"


def fetch_headshots(players):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits, changed, missing = [], 0, []
    for p in players:
        pid, name = p["id"], p["name"]
        if name == "TODO-RESEARCH" or list(OUT_DIR.glob(f"{pid}.*")):
            continue
        title = TITLE_OVERRIDES.get(pid, name)
        try:
            s = wiki_summary(title)
            src = (s.get("thumbnail") or {}).get("source")
            if not src:
                missing.append(name)
                continue
            # Use the summary API's thumbnail URL verbatim. Wikimedia now
            # rejects on-the-fly thumbnails at arbitrary widths (HTTP 400,
            # https://w.wiki/GHai); only sizes it has already generated —
            # like the ~330px one the summary hands back — are served.
            url = src
            ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
            if ext not in ("jpg", "jpeg", "png"):
                ext = "jpg"
            dest = OUT_DIR / f"{pid}.{ext}"
            dest.write_bytes(get(url, binary=True))
            file_name = lead_image_file(s.get("title", title))
            credit = image_credit(file_name) if file_name else None
            p["photo_url"] = f"assets/players/{dest.name}"
            p["photo_credit"] = credit
            credits.append(f"- **{name}** (`{dest.name}`): {credit or 'credit lookup failed - fill manually'}")
            changed += 1
            print(f"photo ok   {name} -> {dest.name}")
            time.sleep(0.3)  # be polite to the API
        except Exception as e:
            missing.append(name)
            print(f"photo FAIL {name}: {e}", file=sys.stderr)
    if credits:
        header = "# Player photo credits\n\nAll headshots are Wikipedia lead images hosted on Wikimedia Commons under free licenses.\n\n"
        existing_md = CREDITS.read_text() if CREDITS.exists() else header
        CREDITS.write_text(existing_md + "\n".join(credits) + "\n")
    print(f"headshots: {changed} downloaded, {len(missing)} without images"
          + (f" ({', '.join(missing)})" if missing else ""))
    return changed


# ---------------- rankings ----------------

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


def parse_fox_rankings(html, players):
    """Find 'N. Player Name' fragments and match them to our players by name."""
    text = re.sub(r"<[^>]+>", "\n", html)
    text = re.sub(r"&#8217;|&rsquo;", "'", text)
    by_norm = {norm(p["name"]): p for p in players if p["name"] != "TODO-RESEARCH"}
    found = {}
    for m in re.finditer(r"\b(\d{1,3})\.\s*([^\n\d(,]{3,45})", text):
        rank = int(m.group(1))
        if not 1 <= rank <= 100:
            continue
        cand = norm(m.group(2))
        for n, p in by_norm.items():
            if cand == n or cand.startswith(n + " ") or n == cand.rstrip():
                if p["id"] in found and found[p["id"]] != rank:
                    print(f"rank CONFLICT for {p['name']}: {found[p['id']]} vs {rank} — keeping first", file=sys.stderr)
                else:
                    found[p["id"]] = rank
                break
    return found


def fetch_rankings(players):
    html = None
    for url in FOX_URLS:
        try:
            html = get(url)
            print(f"rankings: fetched {url}")
            break
        except Exception as e:
            print(f"rankings: could not fetch {url}: {e}", file=sys.stderr)
    ranks = parse_fox_rankings(html, players) if html else {}
    # manual override file wins (see research/prompt-rankings.md)
    if RANKINGS_OVERRIDE.exists():
        manual = json.loads(RANKINGS_OVERRIDE.read_text()).get("rankings", {})
        print(f"rankings: applying {len(manual)} entries from rankings.json (override)")
        ranks.update({k: v for k, v in manual.items() if isinstance(v, int) and 1 <= v <= 100})
    if not ranks:
        print("rankings: nothing to apply — article unreachable/unparseable and no rankings.json. "
              "Use research/prompt-rankings.md to build one.", file=sys.stderr)
        return 0
    by_id = {p["id"]: p for p in players}
    applied = 0
    for pid, rank in ranks.items():
        if pid in by_id:
            by_id[pid]["world_ranking"] = rank
            applied += 1
    print(f"rankings: applied {applied} of {len(ranks)} matched entries")
    return applied


# ---------------- main ----------------

def main():
    data = json.loads(PLAYERS_JSON.read_text())
    players = data["players"]
    photo_changes = fetch_headshots(players)
    rank_changes = fetch_rankings(players)
    if photo_changes or rank_changes:
        PLAYERS_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print("\ndata/players.json updated. Now commit:\n"
              "  git add data/players.json assets/players\n"
              '  git commit -m "data: player headshots + FOX top-100 rankings"\n'
              "  git push")
    else:
        print("\nnothing changed")


if __name__ == "__main__":
    main()
