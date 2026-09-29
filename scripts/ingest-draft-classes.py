#!/usr/bin/env python3
"""Build src/lib/game/data/draftClassesIngest.ts from cached PFR/nflverse + Wikipedia.

Sources:
  data/drafts/draft_picks.csv     nflverse PFR draft picks (1980+)
  data/drafts/pfr/*.htm           Wayback PFR draft tables (1966–79 career AV)
  data/drafts/wiki/*.wikitext     Wikipedia draft pages (1966–1979)
  data/players/players.csv        nflverse bios (height/weight)

Overall and locked kits come from what the player actually did in the NFL
(AV, Pro Bowls, production), not draft slot. Recent rookies with no career
yet keep pick-based overall (1.01 is not the same 76 as 1.32) and a full
locked kit so two same-overall players are not clones. 1966–79 pick lists
come from Wikipedia plus PFR HTML so late-round names fill the board.

Re-run: python3 scripts/ingest-draft-classes.py
"""
from __future__ import annotations

import csv
import html as htmllib
import json
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI_DIR = ROOT / "data" / "drafts" / "wiki"
CSV_PATH = ROOT / "data" / "drafts" / "draft_picks.csv"
PFR_DIR = ROOT / "data" / "drafts" / "pfr"
PLAYERS_CSV = ROOT / "data" / "players" / "players.csv"
OUT_PATH = ROOT / "src" / "lib" / "game" / "data" / "draftClassesIngest.ts"

UA = "NFLRewind/1.0 (historical dynasty sim; draft catalog ingest)"

WIKI_PAGES = {
    1966: "1966_NFL_draft",
    1967: "1967_NFL/AFL_draft",
    1968: "1968_NFL/AFL_draft",
    1969: "1969_NFL/AFL_draft",
    **{y: f"{y}_NFL_draft" for y in range(1970, 1980)},
}

POS_MAP = {
    "quarterback": "QB",
    "qb": "QB",
    "running back": "RB",
    "halfback": "RB",
    "tailback": "RB",
    "hb": "RB",
    "rb": "RB",
    "fullback": "FB",
    "fb": "FB",
    "wide receiver": "WR",
    "flanker": "WR",
    "split end": "WR",
    "wr": "WR",
    "se": "WR",
    "fl": "WR",
    "wideout": "WR",
    "tight end": "TE",
    "te": "TE",
    "offensive tackle": "LT",
    "tackle": "LT",
    "ot": "LT",
    "t": "LT",
    "offensive guard": "LG",
    "guard": "LG",
    "og": "LG",
    "g": "LG",
    "center": "C",
    "c": "C",
    "offensive lineman": "LG",
    "ol": "LG",
    "defensive end": "DE",
    "de": "DE",
    "defensive tackle": "DT",
    "dt": "DT",
    "nose tackle": "DT",
    "nose guard": "DT",
    "nt": "DT",
    "defensive lineman": "DE",
    "dl": "DE",
    "linebacker": "MLB",
    "lb": "MLB",
    "inside linebacker": "MLB",
    "middle linebacker": "MLB",
    "ilb": "MLB",
    "mlb": "MLB",
    "outside linebacker": "OLB",
    "olb": "OLB",
    "cornerback": "CB",
    "corner": "CB",
    "cb": "CB",
    "safety": "S",
    "free safety": "S",
    "strong safety": "S",
    "fs": "S",
    "ss": "S",
    "saf": "S",
    "s": "S",
    "defensive back": "CB",
    "db": "CB",
    "kicker": "K",
    "placekicker": "K",
    "pk": "K",
    "k": "K",
    "punter": "P",
    "p": "P",
    "end": "WR",
    "e": "WR",
    "kick returner": "WR",
    "kr": "WR",
}

SKIP_POS = {"ls", "long snapper", "longsnapper"}

ARCH_POOL = {
    "QB": ["deadeye", "cannon", "scrambler", "manager", "dual"],
    "RB": ["elusive", "power-back", "home-run", "receiving-back"],
    "FB": ["power-back", "receiving-back"],
    "WR": ["burner", "possession", "contested", "slot"],
    "TE": ["move-te", "block-te"],
    "LT": ["pass-ol", "anchor", "run-ol"],
    "LG": ["run-ol", "anchor", "pass-ol"],
    "C": ["anchor", "pass-ol"],
    "RG": ["run-ol", "anchor", "pass-ol"],
    "RT": ["pass-ol", "run-ol", "anchor"],
    "DE": ["edge", "finisher", "two-gap"],
    "DT": ["two-gap", "finisher", "anchor"],
    "OLB": ["edge", "cover-lb", "finisher"],
    "MLB": ["thumper", "cover-lb", "finisher"],
    "CB": ["blanket", "hawk"],
    "S": ["hawk", "box-s"],
    "K": ["ice", "leg"],
    "P": ["leg", "ice"],
}

MEAS = {
    "QB": (75, 215, 4.80),
    "RB": (71, 210, 4.52),
    "FB": (73, 235, 4.68),
    "WR": (73, 195, 4.50),
    "TE": (76, 248, 4.70),
    "LT": (77, 305, 5.20),
    "LG": (76, 300, 5.25),
    "C": (75, 290, 5.20),
    "RG": (76, 302, 5.25),
    "RT": (77, 308, 5.22),
    "DE": (76, 268, 4.80),
    "DT": (75, 295, 5.05),
    "OLB": (74, 242, 4.68),
    "MLB": (74, 238, 4.72),
    "CB": (71, 190, 4.48),
    "S": (72, 200, 4.52),
    "K": (72, 190, 4.95),
    "P": (74, 205, 4.90),
}

OL_POS = {"LT", "LG", "C", "RG", "RT"}
SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v", "vi"}
LAST_PREFIX = {"van", "von", "de", "del", "della", "st", "st.", "le", "la", "du", "da", "di", "dos", "mc"}


def hash32(s: str) -> int:
    h = 2166136261
    for ch in s.lower():
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


def rounds_for(year: int) -> int:
    if year <= 1976:
        return 12
    if year <= 1993:
        return 8
    return 7


def nk(first: str, last: str) -> str:
    s = f"{first}|{last}".lower()
    return re.sub(r"[.'’`]", "", s)


def name_keys_of(first: str, last: str) -> list[str]:
    keys = [nk(first, last)]
    parts = [p for p in f"{first} {last}".split() if p]
    if len(parts) >= 3:
        keys.append(nk(parts[0], " ".join(parts[1:])))
        keys.append(nk(" ".join(parts[:-1]), parts[-1]))
        keys.append(nk(parts[0], parts[-1]))
    return list(dict.fromkeys(keys))


def clean_wiki(text: str) -> str:
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"\b(?:bgcolor|style|align|valign|class|width|rowspan|colspan)\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s|]+)\s*\|?", " ", text, flags=re.I)
    text = text.replace("'''", "").replace("''", "")
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_name(raw: str) -> tuple[str, str] | None:
    raw = clean_wiki(raw)
    raw = re.sub(r"[\"“”']([^\"“”']+)[\"“”']", "", raw)
    raw = re.sub(r"\s+", " ", raw).strip(" .")
    if not raw or raw.lower() in {"n/a", "none", "pass", "forfeited"}:
        return None
    parts = [p for p in raw.replace(",", " ").split() if p]
    if not parts:
        return None
    while len(parts) > 1 and re.sub(r"[.]", "", parts[-1]).lower() in SUFFIXES | {"hof"}:
        parts.pop()
    if len(parts) == 1:
        return parts[0], parts[0]
    if len(parts) >= 3 and parts[1].lower().rstrip(".") in LAST_PREFIX:
        return parts[0], " ".join(parts[1:])
    if len(parts) >= 2 and re.match(r"^[A-Za-z]\.?(?:[A-Za-z]\.?)?$", parts[0]) and re.match(
        r"^[A-Za-z]\.?$", parts[1]
    ):
        return " ".join(parts[:2]), " ".join(parts[2:]) if len(parts) > 2 else parts[1]
    return parts[0], " ".join(parts[1:])


def map_pos(raw: str, name: str, category: str = "", side: str = "") -> str | None:
    key = clean_wiki(raw).lower()
    key = re.sub(r"\s+", " ", key)
    if key in SKIP_POS:
        return None
    pos = POS_MAP.get(key)
    if not pos:
        if "linebacker" in key:
            pos = "OLB" if "outside" in key else "MLB"
        elif "tackle" in key:
            pos = "DT" if "defensive" in key or "nose" in key else "LT"
        elif "guard" in key:
            pos = "DT" if "nose" in key or "defensive" in key else "LG"
        elif "end" in key:
            pos = "DE" if "defensive" in key else "WR"
        elif "back" in key:
            if "quarter" in key:
                pos = "QB"
            elif "full" in key:
                pos = "FB"
            elif "defensive" in key:
                pos = "CB"
            else:
                pos = "RB"
        elif category:
            pos = POS_MAP.get(category.lower())
    if not pos:
        return None
    h = hash32(name)
    if pos == "LT" and (h & 1):
        pos = "RT"
    if pos == "LG" and (h & 1):
        pos = "RG"
    if raw.lower() in {"db", "defensive back"} and (h & 1):
        pos = "S"
    if raw.lower() in {"lb", "linebacker"} and (h % 3 == 0):
        pos = "OLB"
    if raw.lower() in {"dl", "defensive lineman"} and (h & 1):
        pos = "DT"
    if raw.lower() in {"ol", "offensive lineman"}:
        pos = ["LT", "LG", "C", "RG", "RT"][h % 5]
    return pos


def college_of(raw: str) -> str:
    s = clean_wiki(raw)
    s = re.sub(r"\s*\(.*?\)\s*", " ", s).strip()
    s = s.replace(" University", "").replace(" College", "")
    if s.endswith(" University"):
        s = s[: -len(" University")]
    return s[:40] if s else "campus"


def meas_for(pos: str, year: int, name: str) -> tuple[int, int, float]:
    ht, wt, fy = MEAS[pos]
    h = hash32(name)
    ht = ht + (h % 5) - 2
    wt = wt + ((h >> 3) % 21) - 10
    fy = round(fy + (((h >> 8) % 15) - 7) * 0.01, 2)
    if pos in OL_POS:
        if year <= 1974:
            wt = int(wt * 0.80)
            ht -= 1
        elif year <= 1989:
            wt = int(wt * 0.88)
        elif year <= 1999:
            wt = int(wt * 0.94)
    if pos in {"DE", "DT"} and year <= 1974:
        wt = int(wt * 0.86)
    return ht, max(165, wt), fy


PRIMARY = {
    "QB": ["throwAcc", "throwAwr", "throwPow", "awareness", "rel", "stamina", "inj"],
    "RB": ["speed", "accel", "elu", "btk", "stamina", "inj", "agi"],
    "FB": ["runBlk", "truck", "str", "btk", "awareness", "inj"],
    "WR": ["catch", "speed", "rrt", "cit", "accel", "awareness"],
    "TE": ["catch", "runBlk", "cit", "str", "awareness", "inj"],
    "LT": ["passBlk", "runBlk", "str", "awareness", "inj", "stamina"],
    "LG": ["runBlk", "passBlk", "str", "awareness", "inj", "stamina"],
    "C": ["passBlk", "runBlk", "str", "awareness", "inj", "stamina"],
    "RG": ["runBlk", "passBlk", "str", "awareness", "inj", "stamina"],
    "RT": ["passBlk", "runBlk", "str", "awareness", "inj", "stamina"],
    "DE": ["prs", "tak", "str", "pur", "inj"],
    "DT": ["str", "tak", "prs", "inj", "stamina"],
    "OLB": ["prs", "tak", "pur", "speed", "inj"],
    "MLB": ["tak", "str", "awareness", "pur", "inj"],
    "CB": ["cov", "speed", "agi", "awareness", "inj"],
    "S": ["awareness", "cov", "tak", "speed", "inj"],
    "K": ["kickPow", "kickAcc", "awareness", "inj"],
    "P": ["kickPow", "kickAcc", "awareness", "inj"],
}

ARCH_BOOST = {
    "cannon": {"throwPow": 10, "rel": 4},
    "deadeye": {"throwAcc": 10, "throwAwr": 8},
    "scrambler": {"speed": 10, "agi": 8},
    "manager": {"throwAwr": 8, "awareness": 8, "throwPow": -4},
    "dual": {"speed": 8, "throwPow": 6},
    "elusive": {"elu": 10, "agi": 8, "truck": -6},
    "power-back": {"truck": 10, "str": 8, "elu": -4},
    "home-run": {"speed": 10, "accel": 8},
    "receiving-back": {"catch": 8, "rrt": 6},
    "burner": {"speed": 10, "accel": 8},
    "possession": {"catch": 10, "rrt": 8, "speed": -4},
    "contested": {"cit": 10, "catch": 4},
    "slot": {"rrt": 10, "agi": 6},
    "move-te": {"speed": 8, "catch": 8, "runBlk": -4},
    "block-te": {"runBlk": 10, "str": 6, "speed": -4},
    "pass-ol": {"passBlk": 10, "agi": 4},
    "run-ol": {"runBlk": 10, "str": 6},
    "anchor": {"str": 10, "passBlk": 6},
    "edge": {"prs": 10, "speed": 6},
    "two-gap": {"str": 10, "tak": 6, "prs": -4},
    "finisher": {"tak": 8, "pur": 8},
    "cover-lb": {"cov": 10, "speed": 6, "tak": -4},
    "thumper": {"tak": 10, "str": 6, "cov": -4},
    "blanket": {"cov": 10, "agi": 6},
    "hawk": {"awareness": 8, "catch": 8},
    "box-s": {"tak": 10, "str": 4, "cov": -4},
    "leg": {"kickPow": 10},
    "ice": {"kickAcc": 10, "awareness": 4},
}


def ovr_from_round(rnd: int, bump: int = 0, pick: int = 0, name: str = "") -> int:
    table = {1: 76, 2: 72, 3: 70, 4: 67, 5: 64, 6: 62, 7: 60, 8: 58, 9: 56, 10: 54, 11: 52, 12: 50}
    o = table.get(rnd, 50) + bump
    if rnd == 1:
        if 0 < pick <= 5:
            o += 10
        elif pick <= 12:
            o += 7
        elif pick <= 20:
            o += 4
        else:
            o += 2
    elif rnd == 2:
        o += 3 if 0 < pick <= 48 else 1
    jitter = (hash32(name) % 5) - 2 if name else 0
    return clamp(o + jitter, 48, 92)


def fill_full_kit(pos: str, arch: str, ovr: int, name: str, rt: dict[str, int]) -> dict[str, int]:
    """Lock every primary so two 76-overall players are not the same kit.

    Unused skills stay out of the catalog (file size) — ratingsFromProfile
    already keeps them low. Primaries get independent hash jitter + arch boost.
    """
    primaries = PRIMARY.get(pos, [])
    boost = ARCH_BOOST.get(arch, {})
    h = hash32(name)
    for i, k in enumerate(primaries):
        if k in rt:
            continue
        jitter = ((h >> (i * 3)) % 11) - 5
        v = int(48 + ovr * 0.38 + boost.get(k, 0) + jitter)
        rt[k] = clamp(v, 42, 96)
    return rt


def _n(row: dict | None, *keys: str) -> float:
    if not row:
        return 0.0
    for k in keys:
        v = row.get(k)
        if v is None or v == "":
            continue
        try:
            return float(str(v).replace(",", "").replace("%", ""))
        except ValueError:
            continue
    return 0.0


def is_hof(row: dict | None) -> bool:
    if not row:
        return False
    if str(row.get("hof") or "").upper() == "TRUE":
        return True
    return "HOF" in str(row.get("player") or "")


def _played(row: dict | None) -> bool:
    if not row:
        return False
    g = _n(row, "games", "g")
    av = _n(row, "w_av", "career_av")
    py = _n(row, "pass_yards")
    ry = _n(row, "rush_yards")
    recy = _n(row, "rec_yards")
    sk = _n(row, "def_sacks", "sacks")
    ints = _n(row, "def_ints", "def_int")
    return g >= 8 or av >= 3 or (py + ry + recy + sk * 20 + ints * 40) >= 400


def career_complete(row: dict | None) -> bool:
    """True when the NFL career is a finished (or clearly established) sample."""
    if not row:
        return False
    av = _n(row, "w_av", "career_av")
    g = _n(row, "games", "g")
    to = _n(row, "to", "year_max")
    py = _n(row, "pass_yards")
    ry = _n(row, "rush_yards")
    recy = _n(row, "rec_yards")
    sk = _n(row, "def_sacks", "sacks")
    ints = _n(row, "def_ints", "def_int")
    established = (
        av >= 40
        or g >= 80
        or py >= 15000
        or ry >= 5000
        or recy >= 5000
        or sk >= 50
        or ints >= 25
        or is_hof(row)
    )
    season = _n(row, "season")
    if to >= 2024:
        return established
    if to > 0 and to < 2024:
        return True
    if season and season <= 2018:
        return True
    return established


def ovr_from_career(row: dict | None, rnd: int, pos: str = "WR", pick: int = 0, name: str = "") -> int:
    """Overall from what the player actually did in the NFL, not draft slot."""
    del pos
    if not row:
        return ovr_from_round(rnd, pick=pick, name=name)
    av = _n(row, "w_av", "career_av")
    g = _n(row, "games", "g")
    pb = _n(row, "probowls", "pro_bowls")
    ap = _n(row, "allpro", "all_pros_first_team")
    py = _n(row, "pass_yards")
    ry = _n(row, "rush_yards")
    recy = _n(row, "rec_yards")
    sk = _n(row, "def_sacks", "sacks")
    ints = _n(row, "def_ints", "def_int")
    to = _n(row, "to", "year_max")
    played = _played(row)
    if not played:
        if to >= 2024 or to == 0:
            return ovr_from_round(rnd, pick=pick, name=name)
        return clamp(ovr_from_round(rnd, pick=pick, name=name) - 14, 48, 68)

    if av >= 160:
        o = 96
    elif av >= 140:
        o = 94
    elif av >= 118:
        o = 92
    elif av >= 100:
        o = 90
    elif av >= 84:
        o = 87
    elif av >= 70:
        o = 85
    elif av >= 56:
        o = 82
    elif av >= 44:
        o = 79
    elif av >= 34:
        o = 76
    elif av >= 24:
        o = 73
    elif av >= 16:
        o = 70
    elif av >= 10:
        o = 67
    elif av >= 5:
        o = 64
    else:
        o = 60

    if is_hof(row):
        o = max(o, 90)
    if ap >= 5 or pb >= 10:
        o = max(o, 91)
    elif ap >= 3 or pb >= 7:
        o = max(o, 87)
    elif ap >= 1 or pb >= 4:
        o = max(o, 82)
    elif pb >= 1:
        o = max(o, 76)

    if py >= 70000:
        o = max(o, 95)
    elif py >= 50000:
        o = max(o, 92)
    elif py >= 35000:
        o = max(o, 88)
    elif py >= 20000:
        o = max(o, 82)
    if ry >= 12000:
        o = max(o, 92)
    elif ry >= 8000:
        o = max(o, 88)
    elif ry >= 5000:
        o = max(o, 82)
    if recy >= 18000:
        o = max(o, 95)
    elif recy >= 12000:
        o = max(o, 90)
    elif recy >= 8000:
        o = max(o, 84)
    if sk >= 120:
        o = max(o, 93)
    elif sk >= 80:
        o = max(o, 88)
    elif sk >= 50:
        o = max(o, 82)
    if ints >= 50:
        o = max(o, 88)
    elif ints >= 30:
        o = max(o, 82)
    if to >= 2024 or to == 0:
        o = max(o, ovr_from_round(rnd, pick=pick, name=name))
    return clamp(int(round(o)), 48, 97)


def ovr_from_csv(row: dict, rnd: int, pos: str = "WR") -> int:
    pick = 0
    try:
        pick = int(row.get("pick") or 0)
    except ValueError:
        pick = 0
    return ovr_from_career(row, rnd, pos, pick=pick, name=row.get("pfr_player_name") or "")


def arch_for(pos: str, name: str, row: dict | None = None) -> str:
    pool = ARCH_POOL[pos]
    if row:
        rush = _n(row, "rush_yards")
        yds = _n(row, "pass_yards")
        tds = _n(row, "pass_tds")
        ints = _n(row, "pass_ints")
        att = _n(row, "pass_attempts")
        cmp_ = _n(row, "pass_completions")
        rec = _n(row, "receptions")
        recy = _n(row, "rec_yards")
        rtd = _n(row, "rush_tds")
        ratt = _n(row, "rush_atts", "rush_att")
        sk = _n(row, "def_sacks", "sacks")
        dint = _n(row, "def_ints", "def_int")
        if pos == "QB":
            pct = cmp_ / att if att >= 80 else 0
            ypa = yds / att if att >= 80 else 0
            ratio = tds / max(ints, 1) if att >= 80 else 0
            if rush >= 2500 and yds >= 18000:
                return "dual"
            if rush >= 1800 and yds >= 8000:
                return "scrambler"
            great = yds >= 40000 or is_hof(row) or _n(row, "w_av", "career_av") >= 100
            if great:
                if rush >= 2000:
                    return "dual"
                if ypa >= 7.25 and pct < 0.635:
                    return "cannon"
                if pct >= 0.60 or ratio >= 1.8:
                    return "deadeye"
                return "cannon"
            if pct >= 0.60 or (ratio >= 2.0 and yds >= 20000):
                return "deadeye"
            if ypa >= 7.2 and yds >= 15000:
                return "cannon"
            if yds >= 15000:
                return "manager"
        if pos == "RB" or pos == "FB":
            ypc = rush / ratt if ratt >= 80 else 0
            if rec >= 400:
                return "receiving-back"
            if ypc >= 4.7 and rush >= 4000:
                return "home-run"
            if rtd >= 60 and ypc <= 4.2:
                return "power-back"
            if ypc >= 4.4:
                return "elusive"
            if rush >= 6000:
                return "home-run"
        if pos == "WR":
            ypr = recy / rec if rec >= 40 else 0
            if ypr >= 16.5:
                return "burner"
            if rec >= 700:
                return "possession"
            if rec >= 200 and recy / max(rec, 1) <= 13:
                return "slot"
        if pos == "TE":
            if rec >= 500 or recy >= 6000:
                return "move-te"
            return "block-te"
        if pos in {"DE", "OLB"}:
            if sk >= 50:
                return "edge"
        if pos == "DT":
            if sk >= 40:
                return "finisher"
        if pos == "CB":
            if dint >= 25:
                return "hawk"
        if pos == "S":
            if dint >= 20:
                return "hawk"
            return "box-s"
        if pos == "MLB":
            if dint >= 15:
                return "cover-lb"
            return "thumper"
    return pool[hash32(name) % len(pool)]


def rt_from_stats(pos: str, arch: str, ovr: int, row: dict | None, name: str = "") -> dict:
    """Lock the kit to actual career production. Always fill remaining primaries so two 76s are not clones."""
    rt: dict[str, int] = {}
    identity = {
        "cannon": ("throwPow", min(97, ovr + 10)),
        "deadeye": ("throwAcc", min(97, ovr + 8)),
        "scrambler": ("speed", min(90, ovr + 4)),
        "dual": ("speed", min(90, ovr + 3)),
        "elusive": ("elu", min(95, ovr + 8)),
        "power-back": ("truck", min(95, ovr + 8)),
        "home-run": ("speed", min(96, ovr + 8)),
        "receiving-back": ("catch", min(92, ovr + 6)),
        "burner": ("speed", min(97, ovr + 10)),
        "possession": ("catch", min(96, ovr + 8)),
        "contested": ("cit", min(95, ovr + 8)),
        "slot": ("rrt", min(94, ovr + 8)),
        "move-te": ("catch", min(92, ovr + 6)),
        "block-te": ("runBlk", min(92, ovr + 8)),
        "pass-ol": ("passBlk", min(96, ovr + 8)),
        "run-ol": ("runBlk", min(96, ovr + 8)),
        "anchor": ("str", min(95, ovr + 8)),
        "edge": ("prs", min(97, ovr + 10)),
        "two-gap": ("str", min(95, ovr + 8)),
        "finisher": ("tak", min(94, ovr + 8)),
        "cover-lb": ("cov", min(92, ovr + 6)),
        "thumper": ("tak", min(96, ovr + 8)),
        "blanket": ("cov", min(96, ovr + 8)),
        "hawk": ("awareness", min(96, ovr + 8)),
        "box-s": ("tak", min(92, ovr + 8)),
        "leg": ("kickPow", min(96, ovr + 10)),
        "ice": ("kickAcc", min(96, ovr + 10)),
    }
    if arch in identity:
        k, v = identity[arch]
        rt[k] = clamp(v, 40, 99)
    if not row or not _played(row):
        return fill_full_kit(pos, arch, ovr, name, rt)

    g = max(_n(row, "games", "g"), 1)
    av = _n(row, "w_av", "career_av")
    pb = _n(row, "probowls", "pro_bowls")

    if pos == "QB":
        att = _n(row, "pass_attempts")
        cmp_ = _n(row, "pass_completions")
        yds = _n(row, "pass_yards")
        tds = _n(row, "pass_tds")
        ints = _n(row, "pass_ints")
        rush = _n(row, "rush_yards")
        if att >= 80:
            pct = cmp_ / att
            rt["throwAcc"] = clamp(int(68 + (pct - 0.48) * 170), 58, 98)
            ypa = yds / att
            rt["throwPow"] = clamp(int(66 + (ypa - 5.8) * 11), 58, 99)
            ratio = tds / max(ints, 1)
            rt["throwAwr"] = clamp(int(64 + ratio * 12 + min(yds / 8000, 8)), 58, 99)
            rt["rel"] = clamp(int(68 + min(yds / 6000, 12) + (6 if pct >= 0.61 else 0)), 60, 98)
        rt["awareness"] = clamp(int(68 + av / 10 + pb), 62, 99)
        if rush >= 600:
            rt["speed"] = clamp(int(54 + rush / 350), 48, 94)
            rt["agi"] = clamp(rt["speed"] - 2, 48, 92)
        rt["inj"] = clamp(int(52 + min(g, 280) / 5.5), 48, 96)
        rt["stamina"] = clamp(int(68 + min(g, 280) / 9), 62, 96)
        rt.setdefault("catch", 38)
        rt.setdefault("tak", 32)
    elif pos in {"RB", "FB"}:
        rush = _n(row, "rush_yards")
        ratt = max(_n(row, "rush_atts", "rush_att"), 1)
        rec = _n(row, "receptions")
        recy = _n(row, "rec_yards")
        td = _n(row, "rush_tds")
        ypc = rush / ratt if ratt >= 40 else 3.8
        rt["speed"] = clamp(int(62 + (ypc - 3.4) * 22 + min(rush / 2500, 8)), 58, 98)
        rt["elu"] = clamp(int(60 + (ypc - 3.5) * 20), 55, 99)
        rt["btk"] = clamp(int(66 + rush / 1800 + td / 12), 58, 96)
        rt["truck"] = clamp(int(62 + td / 6 + (4 if ypc < 4.1 else 0)), 55, 97)
        rt["accel"] = clamp(rt["speed"] - 2, 55, 96)
        if rec >= 40:
            rt["catch"] = clamp(int(62 + rec / 25 + recy / 800), 58, 94)
        rt["stamina"] = clamp(int(70 + min(g, 200) / 8 + rush / 2000), 64, 98)
        rt["inj"] = clamp(int(54 + min(g, 200) / 6), 48, 94)
        rt.setdefault("throwAcc", 28)
    elif pos in {"WR", "TE"}:
        rec = _n(row, "receptions")
        recy = _n(row, "rec_yards")
        td = _n(row, "rec_tds")
        if rec >= 20:
            ypr = recy / rec
            rt["catch"] = clamp(int(68 + rec / 40 + td / 15), 60, 98)
            rt["rrt"] = clamp(int(66 + rec / 50 + (6 if ypr < 14 else 0)), 58, 97)
            rt["speed"] = clamp(int(64 + (ypr - 12) * 4 + recy / 2500), 58, 99)
            rt["cit"] = clamp(int(62 + td / 8 + (6 if ypr >= 15 else 0)), 55, 97)
            rt["accel"] = clamp(rt["speed"] - 1, 58, 97)
        if pos == "TE":
            rt["runBlk"] = clamp(int(58 + av / 8 + (10 if rec < 300 else 0)), 52, 92)
            rt["str"] = clamp(int(64 + av / 10), 58, 90)
        rt["stamina"] = clamp(int(68 + min(g, 250) / 10), 62, 96)
        rt["inj"] = clamp(int(54 + min(g, 250) / 6), 48, 94)
        rt.setdefault("throwPow", 28)
    elif pos in {"LT", "LG", "C", "RG", "RT"}:
        rt["passBlk"] = clamp(int(68 + av / 6 + pb * 1.2), 60, 98)
        rt["runBlk"] = clamp(int(66 + av / 6 + pb), 58, 98)
        rt["str"] = clamp(int(70 + av / 8), 62, 96)
        rt["awareness"] = clamp(int(66 + av / 8 + pb), 60, 96)
        rt["inj"] = clamp(int(58 + min(g, 250) / 6), 52, 96)
        rt["stamina"] = clamp(int(70 + min(g, 250) / 9), 64, 96)
        if arch == "pass-ol":
            rt["passBlk"] = max(rt["passBlk"], min(97, ovr + 6))
        if arch == "run-ol":
            rt["runBlk"] = max(rt["runBlk"], min(97, ovr + 6))
        rt.setdefault("throwAcc", 26)
        rt.setdefault("speed", 48)
    elif pos in {"DE", "DT", "OLB", "MLB"}:
        sk = _n(row, "def_sacks", "sacks")
        dint = _n(row, "def_ints", "def_int")
        rt["tak"] = clamp(int(68 + av / 6 + min(g, 200) / 12), 60, 98)
        rt["prs"] = clamp(int(62 + sk / 2.2 + (8 if pos in {"DE", "OLB"} else 0)), 55, 99)
        rt["str"] = clamp(int(68 + av / 8 + (8 if pos == "DT" else 0)), 60, 96)
        rt["pur"] = clamp(int(64 + sk / 4 + av / 10), 58, 96)
        rt["cov"] = clamp(int(52 + dint * 1.4 + (10 if pos in {"OLB", "MLB"} else 0)), 42, 92)
        rt["awareness"] = clamp(int(66 + av / 8 + pb + dint / 3), 60, 97)
        rt["inj"] = clamp(int(54 + min(g, 220) / 6), 48, 94)
        rt.setdefault("throwAcc", 26)
        rt.setdefault("catch", 36)
    elif pos in {"CB", "S"}:
        dint = _n(row, "def_ints", "def_int")
        rt["cov"] = clamp(int(68 + dint / 1.6 + av / 10), 60, 98)
        rt["awareness"] = clamp(int(66 + dint / 2 + av / 8 + pb), 60, 98)
        rt["catch"] = clamp(int(58 + dint / 1.4), 50, 92)
        rt["speed"] = clamp(int(72 + av / 15 + (6 if pos == "CB" else 0)), 64, 96)
        rt["agi"] = clamp(rt["speed"] - 2, 62, 96)
        rt["tak"] = clamp(int(58 + av / 8 + (10 if pos == "S" else 0)), 50, 94)
        rt["inj"] = clamp(int(54 + min(g, 220) / 6), 48, 94)
        rt.setdefault("throwAcc", 28)
        rt.setdefault("throwPow", 28)
    elif pos in {"K", "P"}:
        rt["kickPow"] = clamp(ovr + (8 if arch == "leg" else 4), 70, 97)
        rt["kickAcc"] = clamp(ovr + (8 if arch == "ice" else 3), 70, 97)
        rt["awareness"] = clamp(int(70 + av / 6), 64, 92)
        rt["inj"] = clamp(int(70 + min(g, 280) / 8), 64, 96)
        rt.setdefault("throwAcc", 30)
        rt.setdefault("speed", 42)
    filled = {k: clamp(int(v), 25, 99) for k, v in rt.items()}
    return fill_full_kit(pos, arch, ovr, name, filled)


def cell_map(row: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', row, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", v)
        text = htmllib.unescape(text).replace("*", "").replace("+", "").strip()
        text = re.sub(r"\s+HOF\s*$", "", text, flags=re.I)
        out[k] = text
    return out


def parse_pfr_draft(html: str) -> list[dict]:
    html = re.sub(r"<!--|-->", "", html)
    m = re.search(r'<table[^>]*id="drafts".*?</table>', html, re.S | re.I)
    if not m:
        ids = re.findall(r'<table[^>]*id="([^"]+)"', html)
        for alt in ids:
            if "draft" in alt:
                m = re.search(rf'<table[^>]*id="{re.escape(alt)}".*?</table>', html, re.S | re.I)
                if m:
                    break
    if not m:
        return []
    rows: list[dict] = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(0), re.S | re.I):
        raw_player = re.search(r'data-stat="player"[^>]*>(.*?)</t[dh]>', row, re.S | re.I)
        hof = False
        if raw_player:
            blob = raw_player.group(1)
            hof = "*" in blob or "+" in blob or "hof" in blob.lower()
        cm = cell_map(row)
        name = cm.get("player") or ""
        if not name or name.lower() in {"player", "rk"}:
            continue
        spl = split_name(name)
        if not spl:
            continue
        f_n, l_n = spl

        def _int(s: str | None) -> int:
            try:
                return int(re.sub(r"\D", "", s or "") or "0")
            except ValueError:
                return 0

        college = college_of(cm.get("college_id") or "")
        rec = {
            "player": name,
            "hof": "TRUE" if hof else "FALSE",
            "w_av": cm.get("career_av") or cm.get("w_av") or "",
            "career_av": cm.get("career_av") or "",
            "games": cm.get("g") or "",
            "g": cm.get("g") or "",
            "pass_completions": cm.get("pass_cmp") or "",
            "pass_attempts": cm.get("pass_att") or "",
            "pass_yards": cm.get("pass_yds") or "",
            "pass_tds": cm.get("pass_td") or "",
            "pass_ints": cm.get("pass_int") or "",
            "rush_atts": cm.get("rush_att") or "",
            "rush_yards": cm.get("rush_yds") or "",
            "rush_tds": cm.get("rush_td") or "",
            "receptions": cm.get("rec") or "",
            "rec_yards": cm.get("rec_yds") or "",
            "rec_tds": cm.get("rec_td") or "",
            "def_sacks": cm.get("sacks") or "",
            "sacks": cm.get("sacks") or "",
            "def_ints": cm.get("def_int") or "",
            "def_int": cm.get("def_int") or "",
            "probowls": cm.get("pro_bowls") or "",
            "pro_bowls": cm.get("pro_bowls") or "",
            "allpro": cm.get("all_pros_first_team") or "",
            "all_pros_first_team": cm.get("all_pros_first_team") or "",
            "to": cm.get("year_max") or "",
            "year_max": cm.get("year_max") or "",
            "f": f_n,
            "l": l_n,
            "r": _int(cm.get("draft_round")),
            "pick": _int(cm.get("draft_pick")),
            "pos_raw": cm.get("pos") or "",
            "college": college,
            "c": college,
        }
        rows.append(rec)
    return rows


def load_pfr_careers() -> tuple[dict[int, dict[str, dict]], dict[str, dict]]:
    by_year: dict[int, dict[str, dict]] = defaultdict(dict)
    by_name: dict[str, dict] = {}
    if not PFR_DIR.exists():
        return by_year, by_name
    for path in sorted(PFR_DIR.glob("*.htm")):
        html = path.read_text(errors="replace")
        if "data-stat" not in html:
            continue
        m = re.search(r"(19\d{2}|20\d{2})", path.name)
        year = int(m.group(1)) if m else 0
        for rec in parse_pfr_draft(html):
            rec["season"] = str(year) if year else rec.get("season", "")
            for key in name_keys_of(rec["f"], rec["l"]):
                if year:
                    prev = by_year[year].get(key)
                    if not prev or _n(rec, "w_av", "career_av") >= _n(prev, "w_av", "career_av"):
                        by_year[year][key] = rec
                prev = by_name.get(key)
                if not prev or _n(rec, "w_av", "career_av") >= _n(prev, "w_av", "career_av"):
                    by_name[key] = rec
    return by_year, by_name


def load_bios() -> dict[str, dict[str, int]]:
    bios: dict[str, dict[str, int]] = {}
    if not PLAYERS_CSV.exists():
        return bios
    with PLAYERS_CSV.open() as f:
        for row in csv.DictReader(f):
            last = (row.get("last_name") or "").strip()
            if not last:
                continue
            try:
                ht = int(float(row.get("height") or 0))
                wt = int(float(row.get("weight") or 0))
            except ValueError:
                continue
            if ht < 60 or ht > 84 or wt < 150 or wt > 420:
                continue
            firsts = [
                row.get("football_name") or "",
                row.get("common_first_name") or "",
                row.get("first_name") or "",
            ]
            display = (row.get("display_name") or "").strip()
            if display:
                spl = split_name(display)
                if spl:
                    firsts.append(spl[0])
            for first in firsts:
                first = first.strip()
                if not first:
                    continue
                for key in name_keys_of(first, last):
                    bios[key] = {"ht": ht, "wt": wt}
    return bios


def attach_career(rec: dict, year: int, by_year: dict[int, dict[str, dict]], by_name: dict[str, dict]) -> None:
    if rec.get("row"):
        return
    for key in name_keys_of(rec.get("f") or "", rec.get("l") or ""):
        row = (by_year.get(year) or {}).get(key) or by_name.get(key)
        if row:
            rec["row"] = row
            return


def fetch_wiki(page: str, dest: Path) -> str:
    if dest.exists() and dest.stat().st_size > 500:
        return dest.read_text()
    url = (
        "https://en.wikipedia.org/w/api.php?action=parse&page="
        + urllib.parse.quote(page)
        + "&prop=wikitext&format=json"
    )
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.load(resp)
            if "error" in data:
                print("wiki error", page, data["error"])
                return ""
            wt = data["parse"]["wikitext"]["*"]
            dest.write_text(wt)
            return wt
        except Exception as e:
            wait = 8 * (attempt + 1)
            print(f"fetch {page} failed ({e}); retry in {wait}s")
            time.sleep(wait)
    return dest.read_text() if dest.exists() else ""


def parse_nfl_draft_rows(wt: str) -> list[dict]:
    out = []
    i = 0
    while True:
        m = re.search(r"\{\{\s*NFLDraft-row\b", wt[i:], re.I)
        if not m:
            break
        start = i + m.start()
        pipe = wt.find("|", start)
        if pipe < 0:
            break
        depth = 1
        k = pipe
        while k < len(wt) and depth:
            if wt.startswith("{{", k):
                depth += 1
                k += 2
                continue
            if wt.startswith("}}", k):
                depth -= 1
                k += 2
                continue
            k += 1
        body = wt[pipe + 1 : k - 2]
        i = k
        fields: dict[str, str] = {}
        for part in body.split("|"):
            if "=" not in part:
                continue
            key, val = part.split("=", 1)
            fields[key.strip()] = val.strip()
        first = fields.get("first") or ""
        last = fields.get("last") or ""
        if not first or not last:
            continue
        try:
            rnd = int(re.sub(r"\D", "", fields.get("round") or "0") or "0")
        except ValueError:
            rnd = 0
        college = fields.get("collegelink") or fields.get("college") or ""
        pos_raw = fields.get("position") or ""
        out.append(
            {
                "f": first.strip(),
                "l": last.strip(),
                "pos_raw": pos_raw,
                "college": college_of(college),
                "r": rnd,
            }
        )
    return out


def parse_wikitable(wt: str) -> list[dict]:
    out = []
    parts = re.split(r"===+\s*Round\s+(\d+)\s*===+", wt, flags=re.I)
    i = 1
    while i + 1 < len(parts):
        try:
            current_round = int(parts[i])
        except ValueError:
            current_round = 0
        body = parts[i + 1]
        i += 2
        for line in body.splitlines():
            if not line.startswith("|"):
                continue
            if line.startswith("|}") or line.startswith("|+") or line.startswith("!"):
                continue
            raw = line.lstrip("|")
            if "Pick #" in raw or "NFL team" in raw:
                continue
            cells = [c.strip() for c in re.split(r"\|\|", raw)]
            if len(cells) < 5:
                continue
            pick_s = clean_wiki(cells[0])
            if not re.match(r"^\d+$", pick_s):
                continue
            name = split_name(cells[2])
            if not name:
                continue
            out.append(
                {
                    "f": name[0],
                    "l": name[1],
                    "pos_raw": cells[3],
                    "college": college_of(cells[4] if len(cells) > 4 else ""),
                    "r": current_round,
                }
            )
    return out


def wiki_picks(year: int, wt: str) -> list[dict]:
    rows = parse_nfl_draft_rows(wt)
    if len(rows) >= 80:
        return rows
    table = parse_wikitable(wt)
    return table if len(table) > len(rows) else rows or table


def csv_picks() -> dict[int, list[dict]]:
    by: dict[int, list[dict]] = defaultdict(list)
    if not CSV_PATH.exists():
        return by
    with CSV_PATH.open() as f:
        for row in csv.DictReader(f):
            try:
                year = int(row["season"])
                rnd = int(row["round"])
            except (KeyError, ValueError):
                continue
            if year < 1980 or year > 2026:
                continue
            name = row.get("pfr_player_name") or ""
            spl = split_name(name)
            if not spl:
                continue
            f_n, l_n = spl
            pos = map_pos(row.get("position") or "", f"{f_n} {l_n}", row.get("category") or "")
            if not pos:
                continue
            try:
                pick = int(row.get("pick") or 0)
            except ValueError:
                pick = 0
            by[year].append(
                {
                    "f": f_n,
                    "l": l_n,
                    "p": pos,
                    "c": college_of(row.get("college") or ""),
                    "r": rnd,
                    "pick": pick,
                    "ovr": ovr_from_csv(row, rnd, pos),
                    "row": row,
                }
            )
    return by


def to_seed(year: int, rec: dict, bios: dict[str, dict[str, int]]) -> dict | None:
    name = f"{rec['f']} {rec['l']}"
    pos = rec.get("p") or map_pos(rec.get("pos_raw") or "", name)
    if not pos:
        return None
    rnd = int(rec.get("r") or 0)
    if rnd <= 0 or rnd > 20:
        return None
    row = rec.get("row")
    pick = 0
    try:
        pick = int(rec.get("pick") or 0)
    except (TypeError, ValueError):
        pick = 0
    if not pick and row:
        pick = int(_n(row, "pick", "draft_pick"))
    ovr = ovr_from_career(row, rnd, pos, pick=pick, name=name)
    arch = arch_for(pos, name, row)
    ht, wt, fy = meas_for(pos, year, name)
    for key in name_keys_of(rec["f"], rec["l"]):
        bio = bios.get(key)
        if bio:
            ht = bio["ht"]
            wt = bio["wt"]
            break
    rt = rt_from_stats(pos, arch, ovr, row, name)
    seed = {
        "f": rec["f"][:24],
        "l": rec["l"][:28],
        "p": pos,
        "c": (rec.get("c") or rec.get("college") or "campus")[:32],
        "o": int(ovr),
        "r": rnd,
        "arch": arch,
        "ht": ht,
        "wt": wt,
        "fy": fy,
        "rt": rt,
    }
    if career_complete(row):
        seed["src"] = "career"
    return seed


def emit_ts(years: dict[int, list[dict]]) -> str:
    lines = [
        "import type { DraftSeed } from \"./draftClasses.ts\";",
        "",
        "/** Auto-generated by scripts/ingest-draft-classes.py — do not hand-edit. */",
        "export const DRAFT_INGEST: Record<number, DraftSeed[]> = {",
    ]
    for year in sorted(years):
        rows = years[year]
        lines.append(f"  {year}: [")
        for s in rows:
            args = [
                json.dumps(s["f"]),
                json.dumps(s["l"]),
                json.dumps(s["p"]),
                json.dumps(s["c"]),
                str(s["o"]),
                str(s["r"]),
                json.dumps(s["arch"]),
                str(s["ht"]),
                str(s["wt"]),
                str(s["fy"]),
            ]
            extra = ""
            if s.get("src"):
                extra += f',src:{json.dumps(s["src"])}'
            if s.get("rt"):
                rt_js = json.dumps(s["rt"], separators=(",", ":"))
                extra += f",rt:{rt_js}"
            lines.append(
                f"    {{f:{args[0]},l:{args[1]},p:{args[2]},c:{args[3]},o:{args[4]},r:{args[5]},arch:{args[6]},ht:{args[7]},wt:{args[8]},fy:{args[9]}{extra}}},"
            )
        lines.append("  ],")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    WIKI_DIR.mkdir(parents=True, exist_ok=True)
    years: dict[int, list[dict]] = defaultdict(list)
    seen: dict[int, set[str]] = defaultdict(set)
    print("pfr 1966-79 career rows…")
    by_year, by_name = load_pfr_careers()
    print(f"  names {len(by_name)} years {len(by_year)}")
    print("player bios…")
    bios = load_bios()
    print(f"  bios {len(bios)}")

    def add(year: int, seed: dict) -> None:
        key = f"{seed['f']}|{seed['l']}|{seed['p']}".lower()
        if key in seen[year]:
            return
        seen[year].add(key)
        years[year].append(seed)

    print("wiki 1966-1979…")
    for year, page in WIKI_PAGES.items():
        dest = WIKI_DIR / (page.replace("/", "_") + ".wikitext")
        cached = dest.exists() and dest.stat().st_size > 500
        wt = fetch_wiki(page, dest)
        if not cached:
            time.sleep(1.2)
        picks = wiki_picks(year, wt) if wt else []
        hit = 0
        for rec in picks:
            rec["c"] = rec.get("college") or rec.get("c") or "campus"
            attach_career(rec, year, by_year, by_name)
            if rec.get("row"):
                hit += 1
            seed = to_seed(year, rec, bios)
            if seed:
                add(year, seed)
        print(f"  {year} {page}: {len(picks)} parsed, {hit} with career")

    print("pfr 1966-1979 as pick source…")
    seen_pfr: set[str] = set()
    for path in sorted(PFR_DIR.glob("*.htm")):
        if "afl" in path.name.lower():
            continue
        html = path.read_text(errors="replace")
        if "data-stat" not in html:
            continue
        m = re.search(r"(19\d{2}|20\d{2})", path.name)
        year = int(m.group(1)) if m else 0
        if year < 1966 or year > 1979:
            continue
        sig = f"{year}:{path.stat().st_size}"
        if sig in seen_pfr:
            continue
        seen_pfr.add(sig)
        recs = parse_pfr_draft(html)
        before = len(years[year])
        for rec in recs:
            rec["c"] = rec.get("college") or rec.get("c") or "campus"
            rec["row"] = rec
            seed = to_seed(year, rec, bios)
            if seed:
                add(year, seed)
        print(f"  {year} {path.name}: {len(recs)} parsed, {len(years[year]) - before} new")

    print("nflverse 1980+…")
    for year, recs in csv_picks().items():
        for rec in recs:
            seed = to_seed(year, rec, bios)
            if seed:
                add(year, seed)
        print(f"  {year}: {len(years[year])} unique")

    OUT_PATH.write_text(emit_ts(years))
    total = sum(len(v) for v in years.values())
    career_n = sum(1 for recs in years.values() for s in recs if s.get("src") == "career")
    print(f"wrote {OUT_PATH} ({total} named, {career_n} career-backed, {OUT_PATH.stat().st_size} bytes)")
    for y in [1966, 1967, 1970, 1972, 1975, 1977, 1979, 1983, 1998, 2000, 2007, 2011, 2020, 2025, 2026]:
        recs = years.get(y, [])
        thin = sum(1 for s in recs if len(s.get("rt") or {}) <= 2)
        fat = sum(1 for s in recs if len(s.get("rt") or {}) >= 8)
        print(f"  {y}: {len(recs)} named  fat {fat}  thin {thin}")


if __name__ == "__main__":
    main()
