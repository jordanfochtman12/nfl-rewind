#!/usr/bin/env python3
"""
Every real player's portrait we can find, for data/history/headshots.ts.

  python3 scripts/build-headshots.py <dir>

<dir> holds:
  players.csv     nflverse's player table (league headshots back to the 1970s)
  roster_YYYY.csv nflverse rosters (more league headshots, newest wins)
  hashes.txt      "<key> <md5 of a 24px thumbnail>" for each league headshot key; the league's
                  stand-in helmet silhouette is one image, so its hash tells a missing photo
                  from a real one
  espn.txt        "<espn id> <http status>" for each player's ESPN studio headshot
  espn2.tsv       (optional) "<person id>\t<espn id>" for men nflverse never linked to ESPN,
                  matched in ESPN's own athlete directory by name and birth date, kept only where
                  ESPN lists a headshot
  wd.csv          Wikidata football players with a Commons photo (item, itemLabel, birth, image)
  wp.tsv          (optional) "<person id>\t<Commons file>": the freely licensed lead photo of his
                  English Wikipedia article (the API's pageimages, free licenses only), for men
                  whose Wikidata entry has no photo of its own
  nfl.tsv         (optional) "<person id>\t<nfl.com slug>\t<league image key>" from the league's own
                  retired-player pages, matched there by exact birth date (scripts' NFL.com pass)

ESPN's studio headshot (the broadcast portrait) wins; then the league's photo; then the
league's retired-player portrait (a cutout in his own uniform, cropped to the face); a freely
licensed Commons photo stands in where none of those has one.
People are matched to the record by name and birth date (the ingest's own key), so a namesake
never wears another man's face. Rows: person id : key : name letters : birth year, where key
is e + the ESPN id, u|p + the league key, w + the Commons file name, or x + a Wikipedia
file name.
"""
import csv
import glob
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "lib" / "game" / "data" / "history"
src = (ROOT / "scripts" / "ingest-history.py").read_text()
ing: dict = {"__file__": str(ROOT / "scripts" / "ingest-history.py")}
exec(compile(src.split("# ---------- rosters ----------")[0], "ingest-history.py", "exec"), ing)
norm = ing["norm"]

d = Path(sys.argv[1])
rows = (OUT / "people.ts").read_text().split("export const PEOPLE = `", 1)[1].split("`", 1)[0].split("\n")
key_of: dict[str, int] = {}
# A second, looser key (accents and Jr./Sr./II/III dropped) for sources that spell names their own way.
loose_of: dict[str, int | None] = {}


def loose(s: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", s))
# Matt or Matthew, Mike or Michael: surname and birth date settle it when only one man has both.
by_last: dict[str, int | None] = {}
for i, line in enumerate(rows):
    f = line.split("|")
    if len(f) >= 4 and f[3]:
        key_of.setdefault(f"{norm(f[0] + f[1])}|{f[3]}", i)
        lk = f"{loose(f[0] + ' ' + f[1])}|{f[3]}"
        loose_of[lk] = None if lk in loose_of else i
        k = f"{norm(f[1])}|{f[3]}"
        by_last[k] = None if k in by_last else i

hashes = dict(l.split() for l in open(d / "hashes.txt") if len(l.split()) == 2)
silhouette = Counter(hashes.values()).most_common(1)[0][0]
real = {k for k, h in hashes.items() if h != silhouette}
print(f"league keys {len(hashes)}, real photos {len(real)}, stand-ins {len(hashes) - len(real)}")

pat = re.compile(r"https://static\.www\.nfl\.com/image/(upload|private)/[^/]+/league/([a-z0-9]+)$")
shot: dict[int, str] = {}


def league(url: str) -> str | None:
    m = pat.match((url or "").strip())
    if not m:
        return None
    k = ("u" if m.group(1) == "upload" else "p") + m.group(2)
    return k if k in real else None


def person(first: str, last: str, birth: str, display: str = "") -> int | None:
    if not birth:
        return None
    i = key_of.get(f"{norm(first + last)}|{birth}")
    if i is None and display:
        i = key_of.get(f"{norm(display)}|{birth}")
    if i is None and last:
        i = by_last.get(f"{norm(last)}|{birth}")
    if i is None:
        i = loose_of.get(f"{loose(display or (first + ' ' + last))}|{birth}")
    return i


for r in csv.DictReader(open(d / "players.csv", encoding="utf-8")):
    k = league(r["headshot"])
    i = person(r["first_name"] or "", r["last_name"] or "", (r["birth_date"] or "").replace("-", ""), r["display_name"] or "")
    if k and i is not None:
        shot[i] = k
for f in sorted(glob.glob(str(d / "roster_*.csv"))):
    for r in csv.DictReader(open(f, encoding="utf-8")):
        k = league(r.get("headshot_url") or "")
        i = person(r["first_name"] or "", r["last_name"] or "", (r["birth_date"] or "").replace("-", ""), r.get("full_name") or "")
        if k and i is not None:
            shot[i] = k
espn_ok = {l.split()[0] for l in open(d / "espn.txt") if l.split()[1:] == ["200"]}
n_espn = 0
for r in csv.DictReader(open(d / "players.csv", encoding="utf-8")):
    e = (r["espn_id"] or "").strip()
    i = person(r["first_name"] or "", r["last_name"] or "", (r["birth_date"] or "").replace("-", ""), r["display_name"] or "")
    if e in espn_ok and i is not None:
        n_espn += i not in shot or not shot[i].startswith("e")
        shot[i] = "e" + e
if (d / "espn2.tsv").exists():
    for line in open(d / "espn2.tsv"):
        f = line.split()
        if len(f) == 2 and f[0].isdigit() and int(f[0]) not in shot:
            n_espn += 1
            shot[int(f[0])] = "e" + f[1]
n_league = len(shot)
# The league's retired-player pages: a key that turns up for more than one man is a stand-in.
nfl_rows = [l.rstrip("\n").split("\t") for l in open(d / "nfl.tsv")] if (d / "nfl.tsv").exists() else []
nfl_count = Counter(r[2] for r in nfl_rows if len(r) == 3)
for r in nfl_rows:
    if len(r) != 3 or not re.fullmatch(r"[a-z0-9]{12,}", r[2]) or nfl_count[r[2]] > 1:
        continue
    i = int(r[0])
    if i not in shot:
        shot[i] = "n" + r[2]
n_nfl = len(shot) - n_league
for r in csv.DictReader(open(d / "wd.csv", encoding="utf-8")):
    i = person(r["itemLabel"] or "", "", (r["birth"] or "")[:10].replace("-", ""))
    if i is None or i in shot:
        continue
    name = unquote(r["image"].rsplit("/Special:FilePath/", 1)[-1])
    shot[i] = "w" + quote(name, safe="")
# His Wikipedia article's free lead photo, where Wikidata had none. Some live on Wikipedia
# itself rather than Commons, so these resolve through Wikipedia's file path (x), which serves both.
if (d / "wp.tsv").exists():
    for line in open(d / "wp.tsv", encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if len(f) == 2 and f[0].isdigit() and int(f[0]) not in shot:
            shot[int(f[0])] = "x" + quote(f[1], safe="")
print(f"record people {len(rows)}; portraits {len(shot)} ({n_espn} ESPN studio, {n_league - n_espn} league, {n_nfl} league retired, {len(shot) - n_league - n_nfl} Commons or Wikipedia)")


def b36(n: int) -> str:
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
        if not n:
            return s


out = []
for i, k in sorted(shot.items()):
    f = rows[i].split("|")
    out.append(f"{b36(i)}:{k}:{norm(f[0] + f[1])}:{f[3][:4] if len(f) > 3 else ''}")
(OUT / "headshots.ts").write_text(
    "/** Auto-generated by scripts/build-headshots.py. Do not hand-edit. */\n"
    "/** person id (base 36) : e + ESPN id, u|p + league headshot key, n + league retired portrait, w + Commons file, or x + Wikipedia file : name letters : birth year; ';' separated. */\n"
    'export const HEADSHOTS = "' + ";".join(out) + '";\n'
)
