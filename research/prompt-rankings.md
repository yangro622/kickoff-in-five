Open FOX Sports' article "World Cup 2026: ranking best 100 players"
(https://www.foxsports.com/stories/soccer/world-cup-2026-ranking-best-100-players)
— either give this prompt to a Claude session with web access, or paste the
article text below it yourself.

Below is the repo's current player list as `id: name (country)` lines.
For every player who appears in FOX's top-100 list, note their rank.
Players not on the list are simply omitted.

Output raw JSON only, in exactly this shape:

```json
{
  "source": "FOX Sports — World Cup 2026: ranking best 100 players",
  "as_of": "YYYY-MM-DD",
  "rankings": {
    "player-id": 12,
    "another-player-id": 47
  }
}
```

Accuracy rules: only include a rank you can literally see in the article for
that exact player. Do not guess, interpolate, or fill from memory. If two
players share a name, match on country.

Save the output as `rankings.json` in the repo root, then run:

    python3 tools/update_players.py

The script applies rankings.json as an override (it also tries to fetch and
parse the FOX article itself, so the manual file is only needed if that fails).

Player list to match against (regenerate with:
`python3 -c "import json; [print(f\"{p['id']}: {p['name']} ({p['team_id']})\") for p in json.load(open('data/players.json'))['players']]"`):

davies: Alphonso Davies (CAN)
david: Jonathan David (CAN)
eustaquio: Stephen Eustáquio (CAN)
larin: Cyle Larin (CAN)
hakimi: Achraf Hakimi (MAR)
en-nesyri: Youssef En-Nesyri (MAR)
amrabat: Sofyan Amrabat (MAR)
brahim: Brahim Díaz (MAR)
almiron: Miguel Almirón (PAR)
sanabria: Antonio Sanabria (PAR)
enciso: Julio Enciso (PAR)
gustavo-gomez: Gustavo Gómez (PAR)
mbappe: Kylian Mbappé (FRA)
dembele: Ousmane Dembélé (FRA)
tchouameni: Aurélien Tchouaméni (FRA)
saliba: William Saliba (FRA)
vinicius: Vinícius Júnior (BRA)
raphinha: Raphinha (BRA)
rodrygo: Rodrygo (BRA)
marquinhos: Marquinhos (BRA)
haaland: Erling Haaland (NOR)
odegaard: Martin Ødegaard (NOR)
sorloth: Alexander Sørloth (NOR)
nusa: Antonio Nusa (NOR)
gimenez: Santiago Giménez (MEX)
edson-alvarez: Edson Álvarez (MEX)
lozano: Hirving Lozano (MEX)
raul-jimenez: Raúl Jiménez (MEX)
kane: Harry Kane (ENG)
bellingham: Jude Bellingham (ENG)
saka: Bukayo Saka (ENG)
foden: Phil Foden (ENG)
pulisic: Christian Pulisic (USA)
mckennie: Weston McKennie (USA)
adams: Tyler Adams (USA)
balogun: Folarin Balogun (USA)
debruyne: Kevin De Bruyne (BEL)
lukaku: Romelu Lukaku (BEL)
doku: Jérémy Doku (BEL)
tielemans: Youri Tielemans (BEL)
yamal: Lamine Yamal (ESP)
pedri: Pedri (ESP)
rodri: Rodri (ESP)
nico-williams: Nico Williams (ESP)
oyarzabal: Mikel Oyarzabal (ESP)
ronaldo: Cristiano Ronaldo (POR)
bruno-fernandes: Bruno Fernandes (POR)
vitinha: Vitinha (POR)
ruben-dias: Rúben Dias (POR)
messi: Lionel Messi (ARG)
julian-alvarez: Julián Álvarez (ARG)
lautaro: Lautaro Martínez (ARG)
emi-martinez: Emiliano Martínez (ARG)
salah: Mohamed Salah (EGY)
marmoush: Omar Marmoush (EGY)
zizo: Zizo (EGY)
xhaka: Granit Xhaka (SUI)
akanji: Manuel Akanji (SUI)
embolo: Breel Embolo (SUI)
ndoye: Dan Ndoye (SUI)
james: James Rodríguez (COL)
luis-diaz: Luis Díaz (COL)
duran: Jhon Durán (COL)
richard-rios: Richard Ríos (COL)
