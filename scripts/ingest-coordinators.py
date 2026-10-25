"""Each club's real offensive and defensive coordinators, season by season, from the staff boxes
on Wikipedia's team-season articles ("2006 Pittsburgh Steelers season": Offensive coordinator –
Bruce Arians). A league begun from the record seats them, and a club still on the record's path
takes on the next season's (eraStart.ts).

  python3 scripts/ingest-coordinators.py fetch TITLES.json CACHE_DIR
      TITLES.json: [[year, teamId, "Club Name"], ...] for every active club-season, from
        node --experimental-strip-types -e 'import {activeTeamIds,displayName} from "./src/lib/game/teams.ts";
          const o=[];for(let y=1966;y<=2025;y++)for(const id of activeTeamIds(y))o.push([y,id,displayName(y,id)]);
          console.log(JSON.stringify(o))'
      Fetches each article's wikitext once (40 to a request, honoring Retry-After) into CACHE_DIR.
  python3 scripts/ingest-coordinators.py build CACHE_DIR
      Writes src/lib/game/data/history/coordinators.ts.

A season whose article names no coordinator simply has none on record (the club's head coach
called it, or nobody wrote it down); the game hires as it always has.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "nfl-rewind-headshots/1.0 (offline data build)"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "src/lib/game/data/history/coordinators.ts")


def fetch(titles_path: str, cache: str) -> None:
    rows = json.load(open(titles_path))
    os.makedirs(cache, exist_ok=True)

    def title(y, name, alt):
        if alt and name == "St. Louis Cardinals":
            name = "St. Louis Cardinals (NFL)"
        return f"{y} {name} season"

    def get(titles):
        q = urllib.parse.urlencode({
            "action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
            "format": "json", "formatversion": "2", "redirects": "1", "titles": "|".join(titles),
        })
        wait = 5
        while True:
            req = urllib.request.Request("https://en.wikipedia.org/w/api.php?" + q, headers={"User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
                time.sleep(max(int(e.headers.get("retry-after") or wait), wait))
                wait = min(wait * 2, 300)

    for alt in (False, True):
        todo = [r for r in rows if not os.path.exists(f"{cache}/{r[0]}-{r[1]}.txt") and (not alt or r[2] == "St. Louis Cardinals")]
        for i in range(0, len(todo), 40):
            want = {title(y, n, alt): (y, t) for y, t, n in todo[i:i + 40]}
            d = get(list(want))["query"]
            norm = {x["from"]: x["to"] for x in d.get("normalized", [])}
            redir = {x["from"]: x["to"] for x in d.get("redirects", [])}
            pages = {p["title"]: p for p in d["pages"]}
            for t, (y, tid) in want.items():
                k = norm.get(t, t)
                p = pages.get(redir.get(k, k))
                if p and "revisions" in p:
                    open(f"{cache}/{y}-{tid}.txt", "w").write(p["revisions"][0]["slots"]["main"]["content"])
            time.sleep(3)


TITLE = re.compile(r"^\W*(?:assistant head coach\s*/\s*)?(offensive|defensive)\s+coordinator\b", re.I)
INFOBOX = re.compile(r"^\|\s*(off|def)_coach\s*=\s*(.*)$")
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
DASH = re.compile(r"\s+[–—-]\s+|\s*:\s+")


def clean_name(s: str) -> str:
    m = LINK.search(s)
    if m:
        s = m.group(2) or re.sub(r"\s*\(.*?\)\s*$", "", m.group(1))
    s = re.split(r"<br\s*/?>|,|;| and ", s)[0]
    s = re.sub(r"<[^>]+>|''+|\{\{[^}]*\}\}", "", s)
    s = re.sub(r"\s*\(.*?\)\s*", " ", s).strip(" *,;.")
    return re.sub(r"\s+", " ", s)


def looks_like_name(s: str) -> bool:
    return 2 <= len(s.split()) <= 4 and not re.search(r"coach|coordinator|line|backs|receivers|team|vacant|none|n/a", s, re.I)


def staff_of(text: str) -> dict:
    """The season's coordinators: the infobox's (off_coach / def_coach) first, else the staff box's
    first "Offensive coordinator – Name" (or "Name – Offensive coordinator") line."""
    out: dict = {}
    for raw in text.split("\n"):
        m = INFOBOX.match(raw.strip())
        if m:
            name = clean_name(m.group(2))
            if looks_like_name(name):
                out.setdefault("OC" if m.group(1) == "off" else "DC", name)
    for raw in text.split("\n"):
        line = raw.strip()
        if not line.startswith("*") or "coordinator" not in line.lower():
            continue
        parts = DASH.split(line.lstrip("* "), maxsplit=1)
        if len(parts) != 2:
            continue
        a, b = parts
        for title, who in ((a, b), (b, a)):
            m = TITLE.match(re.sub(r"''+", "", title))
            if not m or len(title.split()) > 8:
                continue
            role = "OC" if m.group(1).lower() == "offensive" else "DC"
            name = clean_name(who)
            if role not in out and looks_like_name(name):
                out[role] = name
    return out


def build(cache: str) -> None:
    by_year: dict = {}
    found = 0
    for f in sorted(os.listdir(cache)):
        m = re.match(r"(\d{4})-([a-z0-9]+)\.txt$", f)
        if not m:
            continue
        staff = staff_of(open(os.path.join(cache, f)).read())
        if not staff:
            continue
        found += 1
        y, tid = int(m.group(1)), m.group(2)
        by_year.setdefault(y, []).append(f"{tid}:{staff.get('OC', '')}/{staff.get('DC', '')}")
    with open(OUT, "w") as w:
        w.write("/** Auto-generated by scripts/ingest-coordinators.py from Wikipedia's team-season staff boxes. Do not hand-edit. */\n")
        w.write("/** Per season: team:Offensive Coordinator/Defensive Coordinator;... (either may be blank: none on record). */\n")
        w.write("export const COORDINATORS: Record<number, string> = {\n")
        for y in sorted(by_year):
            w.write(f"  {y}: {json.dumps(';'.join(sorted(by_year[y])), ensure_ascii=False)},\n")
        w.write("};\n")
    print(f"{found} club-seasons with a coordinator on record")


if __name__ == "__main__":
    if sys.argv[1] == "fetch":
        fetch(sys.argv[2], sys.argv[3])
    else:
        build(sys.argv[2])
