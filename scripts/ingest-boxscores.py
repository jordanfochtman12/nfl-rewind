#!/usr/bin/env python3
"""Build History mode's box scores: every real game, 1966-2025, from Pro Football Archives.

Reads the pages scripts/fetch-pfa-box.py cached (data/history/pfa_box/) and the History
tables scripts/ingest-history.py wrote (people and rosters, to tie each line to the real
player), and writes one module per season: src/lib/game/data/history/box/YYYY.ts.

Per game: date, the two clubs, venue, city, attendance, weather, the score by quarter,
every scoring play, the starting lineups, team stats and every player's line. A player the
rosters can't place keeps his name and no link. Nothing here is estimated: a number the
page doesn't have is left out.

Re-run: python3 scripts/ingest-boxscores.py [first_year] [last_year]
"""
from __future__ import annotations

import gzip
import html as htmllib
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "history" / "pfa_box"
HIST = ROOT / "src" / "lib" / "game" / "data" / "history"
OUT = HIST / "box"

MONTHS = {m: i + 1 for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"])}

# Pro Football Archives club codes (as in a box score's score line) to franchise ids.
CODE = {
    "ATL": "atl", "BUF": "buf", "CHIB": "chi", "CHI": "chi", "CIN": "cin", "CLE": "cle", "DAL": "dal",
    "DEN": "den", "DET": "det", "GB": "gnb", "HOU": "oti", "TEN": "oti", "KC": "kan", "LARM": "ram",
    "STLR": "ram", "LAR": "ram", "MIA": "mia", "MIN": "min", "NO": "nor", "NYG": "nyg", "NYJ": "nyj",
    "OAK": "rai", "LARD": "rai", "LARA": "rai", "LV": "rai", "LVR": "rai", "PHI": "phi", "PIT": "pit",
    "SD": "sdg", "LAC": "sdg", "SF": "sfo", "STLC": "crd", "PHO": "crd", "PHX": "crd", "ARI": "crd",
    "WAS": "was", "SEA": "sea", "TB": "tam", "CAR": "car", "JAC": "jax", "JAX": "jax", "BOS": "nwe",
    "NE": "nwe", "IND": "clt", "LARI": "rai", "HOUT": "htx", "HST": "htx", "BLT": "rav", "RAV": "rav",
}


def club(code: str, year: int) -> str | None:
    c = code.upper()
    if c == "BAL":
        return "clt" if year <= 1983 else "rav"
    if c == "STL":
        return "crd" if year <= 1987 else "ram"
    if c == "HOU":
        return "oti" if year <= 1996 else "htx"
    if c == "LA":
        return "ram"
    return CODE.get(c)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", s.lower())
    return re.sub(r"[^a-z]", "", s)


# ---------- the History tables (people, rosters) ----------


def load_people() -> list[tuple[str, str]]:
    text = (HIST / "people.ts").read_text(encoding="utf-8")
    body = text.split("export const PEOPLE = `", 1)[1].split("`", 1)[0]
    return [tuple(line.split("|")[:2]) for line in body.split("\n")]  # type: ignore[misc]


def load_rosters() -> dict[int, dict[str, list[int]]]:
    text = (HIST / "rosters.ts").read_text(encoding="utf-8")
    out: dict[int, dict[str, list[int]]] = {}
    for y, body in re.findall(r'\s(\d{4}): "([^"]*)"', text):
        teams: dict[str, list[int]] = {}
        for part in body.split(";"):
            if ":" not in part:
                continue
            t, ids = part.split(":", 1)
            teams[t] = [int(x.split(".")[0], 36) for x in ids.split(",") if x]
        out[int(y)] = teams
    return out


PEOPLE: list[tuple[str, str]] = []
ROSTERS: dict[int, dict[str, list[int]]] = {}


class Matcher:
    """A season's players by name, club by club, to tie a box-score line to a person."""

    def __init__(self, year: int):
        self.full: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
        self.last: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
        self.league: dict[str, list[int]] = defaultdict(list)
        for y in (year, year - 1, year + 1):
            for t, ids in ROSTERS.get(y, {}).items():
                for i in ids:
                    first, last = PEOPLE[i]
                    if y == year:
                        self.full[t][norm(first + last)].append(i)
                        self.last[t][norm(last) + norm(first)[:1]].append(i)
                    if i not in self.league[norm(first + last)]:
                        self.league[norm(first + last)].append(i)

    def find(self, name: str, team: str) -> int | None:
        n = norm(re.sub(r"\s+(Jr\.?|Sr\.?|II|III|IV)$", "", name.strip()))
        hit = list(dict.fromkeys(self.full[team].get(n, [])))
        if len(hit) == 1:
            return hit[0]
        parts = name.replace(".", " ").split()
        if len(parts) >= 2 and not hit:
            k = norm(parts[-1]) + norm(parts[0])[:1]
            hit = list(dict.fromkeys(self.last[team].get(k, [])))
            if len(hit) == 1:
                return hit[0]
        lg = self.league.get(n, [])
        return lg[0] if len(lg) == 1 else None


# ---------- one page ----------


def cells(row: str) -> list[str]:
    out = []
    for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, flags=re.S):
        c = re.sub(r"<br\s*/?>", " ", c)
        c = re.sub(r"<[^>]+>", "", c)
        out.append(htmllib.unescape(c).replace("\xa0", " ").strip())
    return out


def num(s: str) -> float | None:
    s = s.strip().rstrip("t")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


# Section name -> (key, {column: field}) for each player line.
SECTIONS = {
    "RUSHING": {"ATT": "ra", "YDS": "ry", "TD": "rt", "LG": "rl"},
    "PASSING": {"ATT": "pa", "COM": "pc", "YDS": "py", "TD": "pt", "INT": "pi", "TS": "sk", "YL": "sy", "LG": "pl"},
    "RECEIVING": {"NO": "re", "REC": "re", "YDS": "ey", "TD": "et", "LG": "el", "TGT": "tg", "TAR": "tg"},
    "INTERCEPTIONS": {"NO": "in", "YDS": "iy", "TD": "it"},
    "PUNTING": {"NO": "pn", "YDS": "pny"},
    "PUNT RETURNS": {"NO": "pr", "YDS": "pry", "TD": "prt"},
    "KICKOFF RETURNS": {"NO": "kr", "YDS": "kry", "TD": "krt"},
    "SACKS": {"NO": "sa"},
    "TACKLES": {"TOT": "tk", "SOLO": "ts", "AST": "ta", "TFL": "tl"},
    "DEFENSE": {"TOT": "tk", "TKL": "tk", "SOLO": "ts", "AST": "ta", "TFL": "tl", "SK": "sa", "PD": "pd", "QBH": "qh", "QH": "qh", "FF": "ff"},
    "FUMBLES": {"FF": "ff", "OPP": "fr", "REC": "fr"},
    "FIELD GOALS": {"MADE": "fm", "ATT": "fa", "FGM": "fm", "FGA": "fa"},
    "KICKING": {"FGM": "fm", "FGA": "fa", "XPM": "xm", "XPA": "xa"},
}


def parse(raw: str, year: int, match: Matcher) -> dict | None:
    # "September 21, 1975 - Away at Home - ...", with a round name before the clubs for playoff
    # games ("January 5, 1991 - NFC Wild Card Playoff - Away at Home - ...").
    title = re.search(r"<title>([^<]*?\d{4}) - (?:[^<]*? - )?([^<]*?) (at|vs\.?) ([^<]*?) - Pro Football Archives</title>", raw)
    if not title:
        return None
    date = re.match(r"(\w+)\s+(\d+)\s*,\s*(\d{4})", title.group(1))
    if not date:
        return None
    # The archive has the odd typo in a month ("Janaury"): match on the first three letters.
    month = next((n for m, n in MONTHS.items() if m[:3] == date.group(1)[:3]), None)
    if month is None:
        return None
    g: dict = {"d": f"{month:02d}{int(date.group(2)):02d}"}
    if title.group(3) != "at":
        g["n"] = 1
    for key, label in (("v", "Venue"), ("c", "Location"), ("at", "Attendance"), ("w", "Weather")):
        m = re.search(r"<b>" + label + r":\s*</b>\s*([^<]*)", raw)
        val = re.sub(r"\s+", " ", htmllib.unescape(m.group(1))).strip() if m else ""
        if key == "at":
            val = re.sub(r"[^0-9]", "", val)
            if val and int(val) > 0:
                g[key] = int(val)
        elif key == "w":
            if val:
                g[key] = weather(val)
        elif val:
            g[key] = val
    rows = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", raw, flags=re.S)]
    # Score by quarters: away first, then home.
    sides: list[str] = []
    names: list[str] = []
    q: list[list[int]] = []
    i = 0
    while i < len(rows):
        if rows[i] and rows[i][0] == "Score By Quarters":
            head = rows[i]
            for r in rows[i + 1 : i + 3]:
                m = re.match(r"(.*?)([A-Z]{2,4})$", r[0])
                if not m:
                    return None
                t = club(m.group(2), year)
                if not t:
                    print(f"  unknown club code {m.group(2)} ({year})")
                    return None
                sides.append(t)
                names.append(m.group(1).strip())
                q.append([int(x) if x.strip().lstrip("-").isdigit() else 0 for x in r[1 : len(head) - 1]])
            break
        i += 1
    if len(sides) != 2:
        return None
    g["a"], g["h"] = sides
    g["q"] = q
    g["f"] = [int(rows[i + 1][-1] or 0), int(rows[i + 2][-1] or 0)]
    side_of = {names[0]: 0, names[1]: 1}

    def which(cell: str) -> int:
        for nm, k in side_of.items():
            if cell.startswith(nm):
                return k
        m = re.search(r"([A-Z]{2,4})$", cell)
        if m and club(m.group(1), year) in sides:
            return sides.index(club(m.group(1), year))  # type: ignore[arg-type]
        return -1

    plays = []
    lineups: list[list] = [[], []]
    teamstats: list[dict] = [{}, {}]
    lines: list[dict[str, dict]] = [{}, {}]
    section = ""
    head: list[str] = []
    side = -1
    lineup_side = -1
    for r in rows[i + 3 :]:
        if not r or not any(r):
            continue
        c0 = r[0]
        if len(r) >= 3 and c0 == "Qtr" and "Scoring Plays" in r:
            section, head = "SCORING", r
            continue
        if c0 == "LINEUPS":
            section = "LINEUPS"
            continue
        if c0 == "TEAM STATS":
            section, head = "TEAM", r
            continue
        if c0 in SECTIONS or (c0.isupper() and len(r) > 1 and c0.replace(" ", "").isalpha() and r[1].isupper()):
            section, head, side = c0, r, -1
            continue
        if section == "SCORING" and len(r) >= 5:
            k = which(r[1])
            if k >= 0:
                score = [int(x) if x.strip().lstrip("-").isdigit() else None for x in r[3:5]]
                plays.append([int(r[0]) if r[0].isdigit() else 5, k, r[2]] + ([score[0], score[1]] if None not in score else []))
            continue
        if section == "LINEUPS":
            if len(r) == 1:
                k = which(r[0])
                if k >= 0:
                    lineup_side = k
                continue
            if len(r) >= 3 and lineup_side >= 0:
                p = match.find(r[2], sides[lineup_side])
                lineups[lineup_side].append([r[1], p if p is not None else r[2]])
            continue
        if section == "TEAM" and len(r) == len(head):
            t = club(c0, year)
            k = sides.index(t) if t in sides else -1
            if k >= 0:
                teamstats[k] = {h: v for h, v in zip(head[1:], r[1:]) if v and v != "/"}
            continue
        if section in SECTIONS or section:
            if len(r) == 1 or (len(r) == 2 and not r[1]):
                k = which(r[0])
                if k >= 0:
                    side = k
                continue
            if side < 0:
                continue
            fields = SECTIONS.get(section)
            if c0 == "Team Totals":
                if fields:
                    tt = teamstats[side].setdefault("_", {})
                    for h, v in zip(head[1:], r[1:]):
                        f = fields.get(h)
                        n = num(v)
                        if f and n is not None:
                            tt[section[:2] + f] = n
                continue
            if not fields:
                continue
            ln = lines[side].setdefault(c0, {})
            for h, v in zip(head[1:], r[1:]):
                f = fields.get(h)
                n = num(v)
                if f and n is not None and (n or f in ("ry", "py", "ey")):
                    if f in ("rl", "pl", "el"):
                        ln[f] = int(n) if not ln.get(f) or n > ln[f] else ln[f]
                        if v.endswith("t"):
                            ln[f + "t"] = 1
                    else:
                        ln[f] = ln.get(f, 0) + (n if f == "sa" else int(n))
    if not plays and not any(lines):
        return None
    g["s"] = plays
    if any(lineups):
        g["l"] = lineups
    g["t"] = [compact_team(ts) for ts in teamstats]
    g["p"] = []
    for k in (0, 1):
        for name, ln in lines[k].items():
            if not ln:
                continue
            p = match.find(name, sides[k])
            g["p"].append([k, p if p is not None else name] + [ln])
    return g


def weather(raw: str) -> str:
    """'Drizzle Temp: 74 F Humidty: 66% Wind: 14 mph' -> 'Drizzle, 74°F, humidity 66%, wind 14 mph'."""
    parts = []
    m = re.match(r"(.*?)\s*(Temp:|Humid|Wind:|$)", raw)
    if m and m.group(1).strip():
        parts.append(m.group(1).strip())
    t = re.search(r"Temp:\s*(-?\d+)\s*F", raw)
    if t:
        parts.append(f"{t.group(1)}\u00b0F")
    h = re.search(r"Humid\w*:\s*(\d+)%", raw)
    if h:
        parts.append(f"humidity {h.group(1)}%")
    w = re.search(r"Wind:\s*(\d+)\s*mph", raw)
    if w:
        parts.append(f"wind {w.group(1)} mph")
    return ", ".join(parts) or raw


def compact_team(ts: dict) -> dict:
    out = {}
    for h, k in (("FD", "fd"), ("TOP", "top"), ("3rdDownEff", "3d"), ("4thDownEff", "4d"), ("PEN", "pen"), ("PENY", "peny"), ("FUM", "fum"), ("Lost", "fl")):
        v = ts.get(h)
        if v:
            out[k] = int(v) if v.isdigit() else v
    for k, v in ts.get("_", {}).items():
        key = {"RUra": "ra", "RUry": "ry", "PApa": "pa", "PApc": "pc", "PApy": "py", "PApi": "pi", "PAsk": "sk", "PAsy": "sy"}.get(k)
        if key:
            out[key] = int(v)
    return out


def main() -> None:
    global PEOPLE, ROSTERS
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 1966
    last = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    PEOPLE = load_people()
    ROSTERS = load_rosters()
    # Each season's opening day, so preseason games that come along with the pages are dropped.
    opening: dict[int, int] = {}
    sched = (ROOT / "src" / "lib" / "game" / "data" / "realSchedules.ts").read_text(encoding="utf-8")
    for y, body in re.findall(r'\s(\d{4}): "([^"]*)"', sched.split("REAL_SCHEDULES", 1)[1]):
        dates = [season_order(g.split(",")[5]) for g in body.split("|") if len(g.split(",")) > 5 and g.split(",")[5]]
        if dates:
            opening[int(y)] = min(dates)
    OUT.mkdir(parents=True, exist_ok=True)
    for y in range(first, last + 1):
        files = sorted(CACHE.glob(f"{y}*.html.gz"))
        if not files:
            continue
        m = Matcher(y)
        games, bad, linked, named = [], 0, 0, 0
        for f in files:
            g = parse(gzip.decompress(f.read_bytes()).decode("latin-1"), y, m)
            if not g:
                bad += 1
                continue
            if y in opening and season_order(g["d"]) < opening[y]:
                continue  # preseason
            for p in g["p"]:
                if isinstance(p[1], int):
                    linked += 1
                else:
                    named += 1
            # Ids base 36, like the other History tables.
            for p in g["p"]:
                if isinstance(p[1], int):
                    p[1] = "#" + base36(p[1])
            for side in g.get("l", []):
                for row in side:
                    if isinstance(row[1], int):
                        row[1] = "#" + base36(row[1])
            games.append(g)
        games.sort(key=lambda g: (season_order(g["d"]), g["h"]))
        body = json.dumps(games, separators=(",", ":"), ensure_ascii=False)
        (OUT / f"{y}.ts").write_text(
            "/** Auto-generated by scripts/ingest-boxscores.py from Pro Football Archives. Do not hand-edit. */\n"
            "export const BOX = `" + body.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`;\n",
            encoding="utf-8",
        )
        share = linked / max(1, linked + named)
        print(f"{y}: {len(games)} games ({bad} unreadable), {share:.1%} of lines tied to a player")


def season_order(mmdd: str) -> int:
    # A season runs September into the next February.
    m = int(mmdd[:2])
    return (m + 12 if m < 7 else m) * 100 + int(mmdd[2:])


def base36(n: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = digits[r] + s
        if not n:
            return s


if __name__ == "__main__":
    main()
