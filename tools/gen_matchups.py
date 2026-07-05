#!/usr/bin/env python3
"""Generate data/matchups.json — a precomputed library of every possible
knockout matchup so the site can self-update as the bracket resolves.

Each still-undecided QF/SF/Final slot could become any of several pairings.
Rather than re-research a preview the moment two teams are drawn together,
we compute the storyline / things_to_watch / h2h for *every* pairing that
the remaining bracket can produce, keyed by the two team ids sorted and
joined with "__". tools/bracket.py then injects the matching entry into
data/matches.json automatically when a matchup locks in (stakes is derived
from the bracket at inject time, so it lives in the tooling, not here).

Storyline and things_to_watch are composed from each team's own identity
and signature threat (kept in sync with teams.json / players.json); the
head-to-head facts are curated and, for the marquee pairings, verified by
search. Re-run any time the set of alive teams changes:

    python3 tools/gen_matchups.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MATCHES = ROOT / "data" / "matches.json"
OUT = ROOT / "data" / "matchups.json"

# ---- team building blocks (identity + signature threat + style tag) --------
# name, trait (short apposition), star (marquee name for the duel line),
# watch (one concrete thing to see), tag (style word for the contrast line),
# conf (confederation, for the head-to-head fallback).
TEAM = {
 "mar": dict(name="Morocco", trait="Africa's history-makers", star="Achraf Hakimi",
   watch="Achraf Hakimi bombing forward from right-back like an extra winger",
   tag="counterattacking", conf="CAF"),
 "fra": dict(name="France", trait="the defending champions", star="Kylian Mbappé",
   watch="Kylian Mbappé's explosive acceleration cutting in from the left",
   tag="lightning counters", conf="UEFA"),
 "bra": dict(name="Brazil", trait="the five-time world champions", star="Vinícius Júnior",
   watch="Vinícius Júnior taking his marker on one-on-one down the left",
   tag="dazzling wing play", conf="CONMEBOL"),
 "nor": dict(name="Norway", trait="Erling Haaland's Norway", star="Erling Haaland",
   watch="Erling Haaland lurking on the last defender's shoulder to burst in behind",
   tag="direct, physical play", conf="UEFA"),
 "mex": dict(name="Mexico", trait="the tireless co-hosts", star="Raúl Jiménez",
   watch="Raúl Jiménez holding the ball up to bring Mexico's runners into play",
   tag="quick passing", conf="CONCACAF"),
 "eng": dict(name="England", trait="still chasing a first trophy since 1966", star="Harry Kane",
   watch="Harry Kane dropping deep to spray passes, then sprinting into the box",
   tag="controlled, structured play", conf="UEFA"),
 "usa": dict(name="the USA", trait="the high-energy co-hosts", star="Christian Pulisic",
   watch="Christian Pulisic driving at defenders with the home crowd behind him",
   tag="relentless pressing", conf="CONCACAF"),
 "bel": dict(name="Belgium", trait="a gifted, experienced generation", star="Kevin De Bruyne",
   watch="Kevin De Bruyne's pinpoint passes and whipped crosses",
   tag="patient possession", conf="UEFA"),
 "esp": dict(name="Spain", trait="the reigning European champions", star="Lamine Yamal",
   watch="Lamine Yamal cutting in from the right to curl shots at the far post",
   tag="possession game", conf="UEFA"),
 "por": dict(name="Portugal", trait="carrying the ageless Cristiano Ronaldo", star="Cristiano Ronaldo",
   watch="Cristiano Ronaldo hunting one more iconic moment, plus Portugal's set-piece threat",
   tag="technical midfield play", conf="UEFA"),
 "arg": dict(name="Argentina", trait="the reigning world champions", star="Lionel Messi",
   watch="Lionel Messi, likely in his final World Cup, orchestrating the attack",
   tag="street-smart game management", conf="CONMEBOL"),
 "egy": dict(name="Egypt", trait="built around Mohamed Salah", star="Mohamed Salah",
   watch="Mohamed Salah cutting in onto his deadly left foot",
   tag="fast counterattacking", conf="CAF"),
 "sui": dict(name="Switzerland", trait="disciplined and hard to break down", star="Granit Xhaka",
   watch="Granit Xhaka dictating from deep with his range of passing",
   tag="compact defending", conf="UEFA"),
 "col": dict(name="Colombia", trait="rhythmic and technical", star="Luis Díaz",
   watch="Luis Díaz's relentless one-on-one dribbling down the left",
   tag="technical, rhythmic play", conf="CONMEBOL"),
}

CONF_ADJ = {"UEFA": "European", "CONMEBOL": "South American",
            "CONCACAF": "CONCACAF", "CAF": "African"}

# ---- curated storyline hooks (override sentence 1 for marquee pairings) -----
HOOK = {
 "fra__mar": "A rematch of the emotional 2022 semifinal, where France ended Morocco's historic run.",
 "arg__bra": "The Superclásico — South America's fiercest rivalry, and the two biggest names in the game.",
 "bra__fra": "A renewal of a classic World Cup rivalry, from France's 1998 title to their 2006 upset of Brazil.",
 "eng__fra": "A repeat of the 2022 quarterfinal that France won in a nerve-shredding finish.",
 "arg__eng": "One of football's most charged rivalries, thick with World Cup history.",
 "mar__esp": "A rematch of the 2022 shootout in which Morocco knocked Spain out.",
 "mar__por": "A rematch of the 2022 quarterfinal where Morocco made history against Portugal.",
 "arg__por": "The dream stage for one last Messi versus Ronaldo meeting.",
 "arg__esp": "World champions against European champions — a true heavyweight collision.",
 "bel__bra": "A repeat of Belgium's stunning 2018 quarterfinal win over Brazil.",
 "arg__mex": "A familiar World Cup pairing that Argentina have always come through.",
 "esp__usa": "A chance for the USA to recreate their famous 2009 upset of Spain.",
 "bra__eng": "A rare meeting of two of the game's heavyweight names.",
 "arg__col": "A rematch of the fiery 2024 Copa América final.",
 "bra__mex": "A knockout pairing Brazil have long dominated on the World Cup stage.",
 "arg__usa": "The co-hosts against the world champions — a David-and-Goliath tie.",
}

# ---- curated head-to-head facts (verified where a scoreline is given) -------
H2H = {
 "fra__mar": ["France beat Morocco 2-0 in the 2022 World Cup semifinal — Théo Hernández scored inside five minutes and Randal Kolo Muani sealed it late."],
 "bra__mex": ["Brazil beat Mexico 2-0 in the 2018 Round of 16 through Neymar and Roberto Firmino.",
              "Brazil have never lost to Mexico at a World Cup."],
 "bra__eng": ["Rare opponents — Brazil won the most recent meeting 1-0, a March 2024 friendly at Wembley settled by teenager Endrick."],
 "eng__nor": ["England usually dominate, but Norway's 2-1 win in a 1981 qualifier produced the immortal 'your boys took a hell of a beating' commentary."],
 "esp__usa": ["The USA stunned Spain 2-0 in the 2009 Confederations Cup semifinal, ending a world-record 35-match unbeaten run."],
 "por__usa": ["They drew 2-2 at the 2014 World Cup, Portugal snatching a Ronaldo-assisted equalizer in the final seconds."],
 "bel__por": ["Belgium knocked the holders out of Euro 2020, winning 1-0 through a stunning Thorgan Hazard strike."],
 "arg__col": ["Fierce recent rivals — Argentina won the 2024 Copa América final 1-0, Lautaro Martínez scoring late in extra time."],
 "arg__sui": ["Argentina edged Switzerland 1-0 in the 2014 Round of 16, Ángel Di María scoring in the 118th minute."],
 "bra__fra": ["One of the World Cup's great rivalries: France won the 1998 final 3-0 (Zinedine Zidane twice) and the 2006 quarterfinal 1-0 (Thierry Henry)."],
 "eng__fra": ["France beat England 2-1 in the 2022 World Cup quarterfinal, Harry Kane missing a late penalty."],
 "arg__bra": ["Argentina beat Brazil 1-0 in the 2021 Copa América final at the Maracanã (Ángel Di María), Lionel Messi's first senior title.",
              "The great rivals have never met in a World Cup final."],
 "bel__bra": ["Belgium stunned Brazil 2-1 in the 2018 World Cup quarterfinal, one of their greatest results."],
 "arg__mex": ["Argentina have won every World Cup meeting — 2-1 in 2006, 3-1 in 2010, and 2-0 in the 2022 group stage, Messi scoring in the last of those."],
 "mar__esp": ["Morocco knocked Spain out of the 2022 World Cup, winning the Round-of-16 shootout 3-0 after a 0-0 draw — Achraf Hakimi buried the decisive penalty."],
 "mar__por": ["Morocco stunned Portugal 1-0 in the 2022 quarterfinal, Youssef En-Nesyri's towering header making them the first African team to reach a World Cup semifinal."],
 "arg__eng": ["Charged with history — England won 1-0 in 2002 (a Beckham penalty), but Argentina went through on penalties in 1998 after Beckham's red card, and Maradona's 1986 'Hand of God' still stings."],
 "arg__usa": ["Argentina thrashed the USA 4-0 in the 2016 Copa América semifinal, Messi scoring a stunning free kick."],
 "arg__por": ["They have never met in a competitive World Cup game — but the pull of Messi and Ronaldo sharing one last stage is irresistible."],
 "arg__esp": ["World champions against European champions: a rare, final-worthy heavyweight clash."],
 "esp__fra": ["Two European giants who have traded modern classics, including France's 2-1 win in the 2021 Nations League final."],
}


def _key(a, b):
    return "__".join(sorted([a, b]))


def _fallback_h2h(a, b):
    ca, cb = TEAM[a]["conf"], TEAM[b]["conf"]
    na, nb = TEAM[a]["name"], TEAM[b]["name"]
    if ca == cb:
        return [f"{na} and {nb} meet regularly in {CONF_ADJ[ca]} competition, so neither side holds many secrets from the other."]
    return [f"{na} and {nb} rarely cross paths, so there is little recent history between them — a genuine step into the unknown."]


def _round_flavor(rnd, a, b):
    sa, sb = TEAM[a]["star"], TEAM[b]["star"]
    duel = f"Watch for {sa} and {sb} to decide it."
    if rnd == "QF":
        return f"Win and you are into the semifinals; lose and the World Cup is over. {duel}"
    if rnd == "SF":
        return f"The winner goes to the World Cup final; the loser goes home one step short. {duel}"
    return f"One match, in the New York area, to be crowned champions of the world. {duel}"


def _storyline(rnd, a, b):
    k = _key(a, b)
    ta, tb = TEAM[a], TEAM[b]
    if k in HOOK:
        lead = HOOK[k]
    else:
        rw = {"QF": "A quarterfinal", "SF": "A semifinal", "F": "A World Cup final"}[rnd]
        lead = f"{rw} between {ta['name']}, {ta['trait']}, and {tb['name']}, {tb['trait']}."
    return f"{lead} {_round_flavor(rnd, a, b)}"


def _watch(a, b):
    ta, tb = TEAM[a], TEAM[b]
    return [ta["watch"], tb["watch"],
            f"Whether {ta['name']}'s {ta['tag']} can overcome {tb['name']}'s {tb['tag']}"]


def _possible(matches):
    """Every (round, pairing) the current bracket can still produce."""
    by_id = {m["id"]: m for m in matches}

    def is_open(tid):
        return tid in (None, "", "tbd")

    def side_teams(mid, side):
        m = by_id[mid]
        tid = m.get(f"team{side}_id")
        if not is_open(tid):
            return {tid}
        src = m.get(f"team{side}_from")
        if not src:
            return set()
        return side_teams(src, 1) | side_teams(src, 2)

    pairs = {}
    for m in matches:
        if m["round"] not in ("QF", "SF", "F"):
            continue
        for a in side_teams(m["id"], 1):
            for b in side_teams(m["id"], 2):
                if a != b:
                    pairs[_key(a, b)] = (m["round"], a, b)
    return pairs


def build():
    matches = json.loads(MATCHES.read_text())["matches"]
    pairs = _possible(matches)
    out = {}
    verified = 0
    for k, (rnd, a, b) in sorted(pairs.items()):
        h2h = H2H.get(k) or _fallback_h2h(a, b)
        if k in H2H:
            verified += 1
        out[k] = {
            "round": rnd,
            "storyline": _storyline(rnd, a, b),
            "things_to_watch": _watch(a, b),
            "h2h": h2h,
        }
    doc = {
        "_notes": [
            "Precomputed previews for every knockout pairing the remaining bracket can still produce, keyed by the two team ids sorted and joined with '__'. tools/bracket.py injects the matching entry into data/matches.json the moment a matchup is decided; 'stakes' is derived from the bracket at that point, so it is not stored here.",
            "storyline and things_to_watch are composed from each team's identity and signature threat (mirroring teams.json / players.json). head-to-head facts are curated; scorelines given are verified. Regenerate with tools/gen_matchups.py whenever the set of still-alive teams changes.",
        ],
        "matchups": out,
    }
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} pairings ({verified} with curated head-to-head, {len(out)-verified} composed)")


if __name__ == "__main__":
    build()
