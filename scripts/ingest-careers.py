#!/usr/bin/env python3
"""Ingest real pre-dynasty season stats from archived Pro-Football-Reference tables.

Writes src/lib/game/data/careerSeasons.ts keyed by first|last.
Re-run: python3 scripts/ingest-careers.py
"""
from __future__ import annotations

import html as htmllib
import re
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "careers" / "pfr"
OUT = ROOT / "src" / "lib" / "game" / "data" / "careerSeasons.ts"

UA = "NFLRewind/1.0 (historical dynasty research; cached PFR season tables)"
SNAPSHOTS = [
    "https://web.archive.org/web/2020/",
    "https://web.archive.org/web/2018/",
    "https://web.archive.org/web/202306/",
    "https://web.archive.org/web/2024/",
]

TYPES = [
    ("passing", "passing"),
    ("rushing", "rushing"),
    ("receiving", "receiving"),
    ("defense", "defense"),
    ("kicking", "kicking"),
    ("punting", "punting"),
    ("returns", "returns"),
]

TEAM = {
    "GNB": "gnb",
    "GB": "gnb",
    "CHI": "chi",
    "CLE": "cle",
    "BAL": "clt",
    "DET": "det",
    "SFO": "sfo",
    "SF": "sfo",
    "RAM": "ram",
    "LA": "ram",
    "PIT": "pit",
    "PHI": "phi",
    "WAS": "was",
    "NYG": "nyg",
    "DAL": "dal",
    "MIN": "min",
    "ATL": "atl",
    "STL": "crd",
    "CRD": "crd",
    "BOS": "nwe",
    "NWE": "nwe",
    "BUF": "buf",
    "NYJ": "nyj",
    "MIA": "mia",
    "DEN": "den",
    "HOU": "oti",
    "OAK": "rai",
    "SDG": "sdg",
    "SD": "sdg",
    "KAN": "kan",
    "KC": "kan",
    "CIN": "cin",
    "NOR": "nor",
    "NO": "nor",
    "TAM": "tam",
    "TB": "tam",
    "SEA": "sea",
    "PHO": "crd",
    "ARI": "crd",
    "RAI": "rai",
    "LAC": "sdg",
    "LAR": "ram",
    "IND": "clt",
    "TEN": "oti",
    "OTI": "oti",
}

SKIP_NAMES = {"player", "rk", "league average", "avg/a-league", "team total"}


def fetch(url: str, dest: Path) -> str:
    if dest.exists() and dest.stat().st_size > 2000:
        existing = dest.read_text(errors="replace")
        if "data-stat" in existing or dest.stat().st_size > 12000:
            return existing
    dest.parent.mkdir(parents=True, exist_ok=True)
    last_err = "no snapshot"
    for snap in SNAPSHOTS:
        full = snap + url
        req = urllib.request.Request(full, headers={"User-Agent": UA})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read()
                text = raw.decode("utf-8", "replace")
                if "captcha" in text.lower() and "data-stat" not in text:
                    raise RuntimeError("challenge page")
                if "data-stat" not in text:
                    raise RuntimeError("empty page")
                dest.write_text(text)
                time.sleep(1.6)
                return text
            except Exception as e:
                last_err = str(e)
                wait = 8 * (attempt + 1)
                if "429" in last_err:
                    wait = 20 * (attempt + 1)
                print(f"  retry {full[-48:]} ({e}) in {wait}s")
                time.sleep(wait)
    return dest.read_text(errors="replace") if dest.exists() else ""


def cell_map(row: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', row, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", v)
        text = htmllib.unescape(text).replace("*", "").replace("+", "").strip()
        out[k] = text
    return out


def parse_table(html: str, table_id: str) -> list[dict[str, str]]:
    html = re.sub(r"<!--|-->", "", html)
    m = re.search(rf'<table[^>]*id="{table_id}".*?</table>', html, re.S | re.I)
    if not m:
        ids = re.findall(r'<table[^>]*id="([^"]+)"', html)
        for alt in ids:
            if table_id in alt or alt in table_id:
                m = re.search(rf'<table[^>]*id="{alt}".*?</table>', html, re.S | re.I)
                if m:
                    break
    if not m:
        return []
    rows = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S | re.I):
        cm = cell_map(row)
        name = cm.get("player") or cm.get("name") or cm.get("name_display") or ""
        if not name or name.lower() in SKIP_NAMES:
            continue
        rows.append(cm)
    return rows


def num(row: dict[str, str], *keys: str) -> int:
    for k in keys:
        v = row.get(k)
        if v is None or v in ("", "-"):
            continue
        v = v.replace(",", "").replace("%", "")
        try:
            return int(round(float(v)))
        except ValueError:
            continue
    return 0


def name_keys(raw: str) -> list[str]:
    s = re.sub(r"[*+]", "", raw)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(".", "")
    s = re.sub(r"[\"']", "", s)
    parts = [p for p in s.split() if p]
    if len(parts) < 2:
        return []
    first, last = parts[0], " ".join(parts[1:])
    keys = [f"{first}|{last}".lower()]
    if len(parts) >= 3:
        keys.append(f"{' '.join(parts[:-1])}|{parts[-1]}".lower())
        keys.append(f"{parts[0]}|{parts[-1]}".lower())
    return list(dict.fromkeys(keys))


def team_of(row: dict[str, str]) -> str:
    raw = (row.get("team") or row.get("team_name_abbr") or "").upper()
    raw = re.sub(r"[^A-Z0-9]", "", raw)
    if raw in TEAM:
        return TEAM[raw]
    if raw in {"2TM", "3TM", "2TM", "TOT"}:
        return "two"
    return "two"


def blank(year: int, team: str) -> dict:
    return {
        "y": year,
        "t": team,
        "gp": 0,
        "passAtt": 0,
        "passCmp": 0,
        "passYds": 0,
        "passTd": 0,
        "passInt": 0,
        "sacksThrown": 0,
        "rushAtt": 0,
        "rushYds": 0,
        "rushTd": 0,
        "rec": 0,
        "recYds": 0,
        "recTd": 0,
        "tackles": 0,
        "sacks": 0,
        "ints": 0,
        "ff": 0,
        "fgAtt": 0,
        "fgMade": 0,
        "xpAtt": 0,
        "xpMade": 0,
        "punts": 0,
        "puntYds": 0,
        "krYds": 0,
        "prYds": 0,
    }


def add_row(acc: dict, kind: str, row: dict[str, str], year: int) -> None:
    keys = name_keys(row.get("player") or "")
    if not keys:
        return
    team = team_of(row)
    rec = acc[keys[0]]
    slot = None
    for existing in rec:
        if existing["y"] == year and (existing["t"] == team or team == "two" or existing["t"] == "two"):
            slot = existing
            if team != "two":
                slot["t"] = team
            break
    if slot is None:
        slot = blank(year, team)
        rec.append(slot)
    gp = num(row, "g", "games")
    if gp > slot["gp"]:
        slot["gp"] = gp
    if kind == "passing":
        slot["passAtt"] = max(slot["passAtt"], num(row, "pass_att"))
        slot["passCmp"] = max(slot["passCmp"], num(row, "pass_cmp"))
        slot["passYds"] = max(slot["passYds"], num(row, "pass_yds"))
        slot["passTd"] = max(slot["passTd"], num(row, "pass_td"))
        slot["passInt"] = max(slot["passInt"], num(row, "pass_int"))
        slot["sacksThrown"] = max(slot["sacksThrown"], num(row, "pass_sacked", "sacked"))
    elif kind == "rushing":
        slot["rushAtt"] = max(slot["rushAtt"], num(row, "rush_att"))
        slot["rushYds"] = max(slot["rushYds"], num(row, "rush_yds"))
        slot["rushTd"] = max(slot["rushTd"], num(row, "rush_td"))
    elif kind == "receiving":
        slot["rec"] = max(slot["rec"], num(row, "rec"))
        slot["recYds"] = max(slot["recYds"], num(row, "rec_yds"))
        slot["recTd"] = max(slot["recTd"], num(row, "rec_td"))
    elif kind == "defense":
        slot["ints"] = max(slot["ints"], num(row, "def_int", "int", "interceptions"))
        slot["sacks"] = max(slot["sacks"], num(row, "sacks", "sk", "def_sacks"))
        slot["tackles"] = max(slot["tackles"], num(row, "tackles_combined", "tackles", "comb"))
        slot["ff"] = max(slot["ff"], num(row, "fumbles_forced", "ff"))
    elif kind == "kicking":
        slot["fgAtt"] = max(slot["fgAtt"], num(row, "fga", "fg_att"))
        slot["fgMade"] = max(slot["fgMade"], num(row, "fgm", "fg"))
        slot["xpAtt"] = max(slot["xpAtt"], num(row, "xpa", "xp_att"))
        slot["xpMade"] = max(slot["xpMade"], num(row, "xpm", "xp"))
    elif kind == "punting":
        slot["punts"] = max(slot["punts"], num(row, "punt", "punts"))
        slot["puntYds"] = max(slot["puntYds"], num(row, "punt_yds"))
    elif kind == "returns":
        slot["krYds"] = max(slot["krYds"], num(row, "kick_ret_yds", "kr_yds"))
        slot["prYds"] = max(slot["prYds"], num(row, "punt_ret_yds", "pr_yds"))
    for alias in keys[1:]:
        acc[alias] = rec


def dump_ts(acc: dict[str, list[dict]]) -> str:
    lines = [
        "/** Auto-generated by scripts/ingest-careers.py — real PFR season lines through 1965. */",
        "export interface CareerSeasonRow {",
        "  y: number; t: string; gp?: number;",
        "  passAtt?: number; passCmp?: number; passYds?: number; passTd?: number; passInt?: number; sacksThrown?: number;",
        "  rushAtt?: number; rushYds?: number; rushTd?: number;",
        "  rec?: number; recYds?: number; recTd?: number;",
        "  tackles?: number; sacks?: number; ints?: number; ff?: number;",
        "  fgAtt?: number; fgMade?: number; xpAtt?: number; xpMade?: number;",
        "  punts?: number; puntYds?: number; krYds?: number; prYds?: number;",
        "}",
        "export const CAREER_SEASONS: Record<string, CareerSeasonRow[]> = {",
    ]
    skip = {
        "gp",
        "passAtt",
        "passCmp",
        "passYds",
        "passTd",
        "passInt",
        "sacksThrown",
        "rushAtt",
        "rushYds",
        "rushTd",
        "rec",
        "recYds",
        "recTd",
        "tackles",
        "sacks",
        "ints",
        "ff",
        "fgAtt",
        "fgMade",
        "xpAtt",
        "xpMade",
        "punts",
        "puntYds",
        "krYds",
        "prYds",
    }

    def compact_rows(rows: list[dict]) -> str:
        bits = []
        for r in sorted(rows, key=lambda x: (x["y"], x["t"])):
            work = sum(r[k] for k in skip if k != "gp") + r["gp"]
            if work <= 0:
                continue
            parts = [f"y:{r['y']}", f"t:{r['t']!r}"]
            for k in skip:
                if r[k]:
                    parts.append(f"{k}:{r[k]}")
            bits.append("{" + ",".join(parts) + "}")
        return ",".join(bits)

    emitted: dict[int, str] = {}
    for key in sorted(acc):
        rows = acc[key]
        ident = id(rows)
        if ident not in emitted:
            emitted[ident] = compact_rows(rows)
        body = emitted[ident]
        if not body:
            continue
        lines.append(f"  {key!r}: [{body}],")
    lines.append("};")
    return "\n".join(lines) + "\n"


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    acc: dict[str, list[dict]] = defaultdict(list)
    jobs: list[tuple[int, str, str, str]] = []
    # Stars first: passing/rushing/receiving 1952–65, then the rest.
    primary = ("passing", "rushing", "receiving")
    rest = ("defense", "kicking", "punting", "returns")
    for year in range(1952, 1966):
        for path in primary:
            jobs.append((year, "nfl", path, path))
        if year >= 1960:
            for path in primary:
                jobs.append((year, "afl", path, path))
    for year in range(1946, 1966):
        kinds = primary + rest if year < 1952 else rest
        for path in kinds:
            jobs.append((year, "nfl", path, path))
        if year >= 1960:
            kinds_a = primary + rest if year < 1952 else rest
            for path in kinds_a:
                jobs.append((year, "afl", path, path))
    print(f"jobs {len(jobs)}")

    def dest_for(year: int, league: str, path: str) -> Path:
        return CACHE / f"{year}_{league}_{path}.htm"

    def parse_job(year: int, league: str, path: str, table: str, html: str) -> int:
        if "data-stat" not in html:
            return 0
        rows = parse_table(html, table)
        for row in rows:
            add_row(acc, table, row, year)
        return len(rows)

    def write() -> None:
        flat: dict[str, list[dict]] = dict(acc)
        text = dump_ts(flat)
        OUT.write_text(text)
        print("wrote", OUT, "keys", len(flat), "bytes", OUT.stat().st_size)

    missing: list[tuple[int, str, str, str]] = []
    for i, (year, league, path, table) in enumerate(jobs, 1):
        dest = dest_for(year, league, path)
        if dest.exists() and dest.stat().st_size > 2000:
            existing = dest.read_text(errors="replace")
            if "data-stat" in existing or dest.stat().st_size > 12000:
                n = parse_job(year, league, path, table, existing)
                print(f"[{i}/{len(jobs)}] cache {year} {league} {path} {n}")
                continue
        missing.append((year, league, path, table))
    write()
    print(f"fetch remaining {len(missing)}")
    for i, (year, league, path, table) in enumerate(missing, 1):
        if league == "nfl":
            url = f"https://www.pro-football-reference.com/years/{year}/{path}.htm"
        else:
            url = f"https://www.pro-football-reference.com/years/{year}_AFL/{path}.htm"
        dest = dest_for(year, league, path)
        print(f"[{i}/{len(missing)}] {year} {league} {path}")
        html = fetch(url, dest)
        n = parse_job(year, league, path, table, html)
        print(f"  {n} rows")
        if i % 10 == 0:
            write()
    write()


if __name__ == "__main__":
    main()
