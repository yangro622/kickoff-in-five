#!/usr/bin/env python3
"""Fetch freely-licensed player headshots from Wikipedia/Wikimedia Commons.

For every player in data/players.json:
  1. Look up their (English) Wikipedia article's lead image via the REST summary API.
  2. Download a ~256px thumbnail into assets/players/<player-id>.<ext>.
  3. Pull the image's author + license from Commons and record it.
  4. Write photo_url + photo_credit back into data/players.json,
     and append every credit to assets/players/CREDITS.md.

Run from the repo root:  python3 tools/fetch_headshots.py
Re-runs are safe: players whose photo file already exists are skipped
(delete the file to force a refresh). Players whose article has no usable
image keep photo_url: null — the site shows an initials avatar instead.

Requires network access to en.wikipedia.org and upload.wikimedia.org.
Only Wikipedia lead images are used; they are hosted on Wikimedia Commons
under free licenses (recorded per-image in CREDITS.md).
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLAYERS_JSON = ROOT / "data" / "players.json"
OUT_DIR = ROOT / "assets" / "players"
CREDITS = OUT_DIR / "CREDITS.md"
UA = {"User-Agent": "kickoff-in-five/0.1 (https://github.com/yangro622/kickoff-in-five)"}
THUMB_WIDTH = 256

# Wikipedia article title overrides where the player's name is ambiguous.
TITLE_OVERRIDES = {
    "vitinha": "Vitinha (footballer, born February 2000)",
    "diaz": "Luis Díaz (footballer, born 1997)",
    "gomez": "Gustavo Gómez",
}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def summary(title):
    t = urllib.parse.quote(title.replace(" ", "_"))
    return get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{t}")


def lead_image_file(title):
    """Return the Commons file name of the article's lead image, or None."""
    q = urllib.parse.urlencode({
        "action": "query", "prop": "pageimages", "piprop": "name",
        "titles": title, "format": "json", "formatversion": "2",
    })
    data = get_json(f"https://en.wikipedia.org/w/api.php?{q}")
    pages = data.get("query", {}).get("pages", [])
    return pages[0].get("pageimage") if pages else None


def image_credit(file_name):
    """Author + license for a Commons file, e.g. 'Jane Doe, CC BY-SA 4.0, via Wikimedia Commons'."""
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
        import re
        raw = meta.get(field, {}).get("value", "") or ""
        return re.sub(r"<[^>]+>", "", raw).strip()
    artist = clean("Artist") or "Unknown author"
    license_ = clean("LicenseShortName") or "see Commons"
    return f"{artist}, {license_}, via Wikimedia Commons"


def thumb_url(summary_data):
    src = (summary_data.get("thumbnail") or {}).get("source")
    if not src:
        return None
    # Wikipedia thumb URLs embed the width — normalize it to THUMB_WIDTH.
    import re
    return re.sub(r"/(\d+)px-", f"/{THUMB_WIDTH}px-", src)


def main():
    players = json.loads(PLAYERS_JSON.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits, changed, skipped, missing = [], 0, 0, []

    for p in players["players"]:
        pid, name = p["id"], p["name"]
        if name == "TODO-RESEARCH":
            continue
        existing = list(OUT_DIR.glob(f"{pid}.*"))
        if existing:
            skipped += 1
            continue
        title = TITLE_OVERRIDES.get(pid, name)
        try:
            s = summary(title)
            url = thumb_url(s)
            if not url:
                missing.append(name)
                continue
            ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
            if ext not in ("jpg", "jpeg", "png"):
                ext = "jpg"
            dest = OUT_DIR / f"{pid}.{ext}"
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                dest.write_bytes(r.read())
            file_name = lead_image_file(s.get("title", title))
            credit = image_credit(file_name) if file_name else None
            p["photo_url"] = f"assets/players/{dest.name}"
            p["photo_credit"] = credit
            credits.append(f"- **{name}** (`{dest.name}`): {credit or 'credit lookup failed - fill manually'}")
            changed += 1
            print(f"ok   {name} -> {dest.name}")
            time.sleep(0.3)  # be polite to the API
        except Exception as e:
            missing.append(name)
            print(f"FAIL {name}: {e}", file=sys.stderr)

    if changed:
        PLAYERS_JSON.write_text(json.dumps(players, indent=2, ensure_ascii=False) + "\n")
        header = "# Player photo credits\n\nAll headshots are Wikipedia lead images hosted on Wikimedia Commons under free licenses.\n\n"
        existing_md = CREDITS.read_text() if CREDITS.exists() else header
        CREDITS.write_text(existing_md + "\n".join(credits) + "\n")

    print(f"\ndone: {changed} downloaded, {skipped} already present, {len(missing)} without images")
    if missing:
        print("no image found for:", ", ".join(missing))


if __name__ == "__main__":
    main()
