#!/usr/bin/env python3
"""Build the History mode data: what really happened, season by season, 1966-2025.

Sources (cached under data/):
  history/rosters/roster_YYYY.csv      nflverse rosters, every club's players each season
  history/stats/stats_player_reg_YYYY  nflverse regular-season player stats, 1999+
                                       (offense, defense, kicking, returns)
  history/fdp/YYYY.csv                 Pro-Football-Reference season tables (offense), 1970-2019,
                                       as published by fantasydatapros/data; used 1970-1998
  schedules/fivethirtyeight_nfl_games  playoff games 1966-1998 (FiveThirtyEight)
  schedules/nflverse_games.csv         playoff games 1999+ (nflverse)
  drafts/pfr/*.htm                     PFR draft tables 1966-1979 (archive.org)
  drafts/draft_picks.csv               nflverse draft picks 1980+

Writes src/lib/game/data/history/{people,rosters,stats,playoffs,drafts}.ts.

Nothing here is estimated: a season with no source for a stat simply has no line for it.

Re-run: python3 scripts/ingest-history.py
"""
from __future__ import annotations

import csv
import datetime as dt
import html as htmllib
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "src" / "lib" / "game" / "data" / "history"
FIRST, LAST = 1966, 2025

# ---------- teams ----------


def team_of(code: str, year: int) -> str | None:
    """A source's club code, in that season, to the engine's franchise id."""
    c = code.upper()
    if c in ("BAL", "BLT"):
        return "clt" if year <= 1983 else "rav"
    if c in ("HOU", "HST"):
        return "oti" if year <= 1996 else "htx"
    if c in ("STL", "SL"):
        return "crd" if year <= 1987 else "ram"
    fixed = {
        "ARI": "crd", "ARZ": "crd", "PHO": "crd", "ATL": "atl", "BOS": "nwe", "NE": "nwe", "NWE": "nwe",
        "BUF": "buf", "CAR": "car", "CHI": "chi", "CIN": "cin", "CLE": "cle", "CLV": "cle", "DAL": "dal",
        "DEN": "den", "DET": "det", "GB": "gnb", "GNB": "gnb", "IND": "clt", "JAX": "jax", "JAC": "jax",
        "KC": "kan", "KAN": "kan", "LA": "ram", "LAR": "ram", "RAM": "ram", "LAC": "sdg", "SD": "sdg",
        "SDG": "sdg", "LV": "rai", "LVR": "rai", "OAK": "rai", "RAI": "rai", "MIA": "mia", "MIN": "min",
        "NO": "nor", "NOR": "nor", "NYG": "nyg", "NYJ": "nyj", "PHI": "phi", "PIT": "pit", "SEA": "sea",
        "SF": "sfo", "SFO": "sfo", "TB": "tam", "TAM": "tam", "TEN": "oti", "WAS": "was", "WSH": "was",
    }
    return fixed.get(c)


# ---------- people ----------


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", s.lower())
    return re.sub(r"[^a-z]", "", s)


POS = {
    "QB": "QB", "RB": "RB", "HB": "RB", "FB": "FB", "WR": "WR", "PR": "WR", "KR": "WR", "TE": "TE",
    "T": "LT", "OT": "LT", "LT": "LT", "RT": "RT", "G": "LG", "OG": "LG", "LG": "LG", "RG": "RG", "C": "C",
    "OL": "LG", "LS": "C", "DE": "DE", "DL": "DE", "EDGE": "DE", "DT": "DT", "NT": "DT", "OLB": "OLB",
    "LB": "MLB", "ILB": "MLB", "MLB": "MLB", "CB": "CB", "DB": "CB", "S": "S", "FS": "S", "SS": "S",
    "SAF": "S", "K": "K", "PK": "K", "P": "P",
}


def pos_of(position: str, depth: str = "") -> str:
    for raw in (depth, position):
        p = POS.get((raw or "").upper().strip())
        if p:
            return p
    return "LG" if (position or "").upper() == "SPEC" else "WR"


people: list[dict] = []
by_key: dict[str, int] = {}
by_gsis: dict[str, int] = {}


def person(first: str, last: str, pos: str, birth: str = "", college: str = "", gsis: str = "") -> int:
    key = f"{norm(first + last)}|{birth}" if birth else ""
    if gsis and gsis in by_gsis:
        return by_gsis[gsis]
    if key and key in by_key:
        i = by_key[key]
    else:
        i = len(people)
        people.append({"f": first, "l": last, "p": pos, "b": birth, "c": college})
        if key:
            by_key[key] = i
    if gsis:
        by_gsis[gsis] = i
    return i


# ---------- rosters ----------

KEEP = {"ACT", "RES", "INA", "PUP", "SUS", "NWT", "TRC", "TRD", "TRT", "TRL", "EXE", "", "RSN"}
# Released players count for the club they played for that season (Jeff George, Atlanta 1996).
cut_pool: dict[int, list[tuple[int, str]]] = defaultdict(list)
# Season tables that print a player under another name than the roster's.
ALIAS = {"karimabduljabbar": "abdulkarimaljabbar", "rocketismail": "raghibismail"}
rosters: dict[int, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))
jerseys: dict[tuple[int, int, str], int] = {}
seasons_of: dict[int, set[int]] = defaultdict(set)
team_in: dict[tuple[int, int], set[str]] = defaultdict(set)


def load_rosters() -> None:
    for y in range(FIRST, LAST + 1):
        seen: set[tuple[int, str]] = set()
        for r in csv.DictReader(open(DATA / "history" / "rosters" / f"roster_{y}.csv", encoding="utf-8")):
            status = r["status"] or ""
            if status not in KEEP and status != "CUT":
                continue
            t = team_of(r["team"], y)
            if not t:
                continue
            full = (r["full_name"] or "").strip()
            last = (r["last_name"] or "").strip() or full.split(" ")[-1]
            # "Will Anderson Jr.": the given name is what comes before the surname in the full name.
            first = full.split(last)[0].strip() if last in full and full.index(last) > 0 else (r["first_name"] or "").strip()
            if not first or not last:
                continue
            birth = (r["birth_date"] or "").replace("-", "")
            i = person(first, last, pos_of(r["position"], r["depth_chart_position"]), birth, (r["college"] or "").strip(), (r["gsis_id"] or "").strip())
            if status == "CUT":
                cut_pool[y].append((i, t))
                continue
            if (i, t) in seen:
                continue
            seen.add((i, t))
            rosters[y][t].append(i)
            try:
                jerseys[(i, y, t)] = int(float(r["jersey_number"] or 0))
            except ValueError:
                pass
            seasons_of[i].add(y)
            team_in[(i, y)].add(t)


# ---------- stats ----------

# Season line fields, in the order they're written (matches SeasonStats keys).
FIELDS = [
    "gp", "passAtt", "passCmp", "passYds", "passTd", "passInt", "sacksThrown", "rushAtt", "rushYds", "rushTd",
    "rec", "targets", "recYds", "recTd", "tackles", "sacks", "ints", "ff", "tfl", "pd", "qbHits", "fr",
    "fgAtt", "fgMade", "xpAtt", "xpMade", "krYds", "prYds",
]
stats: dict[int, list[tuple[int, str, dict]]] = defaultdict(list)


def num(v: str | None) -> float:
    try:
        return float(v) if v not in (None, "", "NA") else 0.0
    except ValueError:
        return 0.0


def join_roster(i: int, t: str, y: int) -> None:
    """A player with a season line belongs on that club's roster, cut or not."""
    if t and t not in team_in[(i, y)]:
        rosters[y][t].append(i)
        team_in[(i, y)].add(t)
        seasons_of[i].add(y)


def load_nflverse_stats() -> None:
    for y in range(1999, LAST + 1):
        f = DATA / "history" / "stats" / f"stats_player_reg_{y}.csv"
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r.get("season_type", "REG") not in ("REG", ""):
                continue
            gsis = r["player_id"]
            i = by_gsis.get(gsis)
            if i is None:
                # Played but missing from the roster file: add him under his stats name.
                name = (r.get("player_display_name") or r.get("player_name") or "").strip()
                if " " not in name:
                    continue
                first, last = name.split(" ", 1)
                i = person(first, last, pos_of(r.get("position") or ""), "", "", gsis)
            t = team_of(r.get("recent_team") or r.get("team") or "", y) or ""
            if t and num(r.get("games")) > 0:
                join_roster(i, t, y)
            tackles = num(r.get("def_tackles_solo")) + num(r.get("def_tackle_assists"))
            line = {
                "gp": num(r.get("games")),
                "passAtt": num(r.get("attempts")), "passCmp": num(r.get("completions")), "passYds": num(r.get("passing_yards")),
                "passTd": num(r.get("passing_tds")), "passInt": num(r.get("passing_interceptions")), "sacksThrown": num(r.get("sacks_suffered")),
                "rushAtt": num(r.get("carries")), "rushYds": num(r.get("rushing_yards")), "rushTd": num(r.get("rushing_tds")),
                "rec": num(r.get("receptions")), "targets": num(r.get("targets")), "recYds": num(r.get("receiving_yards")), "recTd": num(r.get("receiving_tds")),
                "tackles": tackles, "sacks": num(r.get("def_sacks")), "ints": num(r.get("def_interceptions")), "ff": num(r.get("def_fumbles_forced")),
                "tfl": num(r.get("def_tackles_for_loss")), "pd": num(r.get("def_pass_defended")), "qbHits": num(r.get("def_qb_hits")),
                "fr": num(r.get("fumble_recovery_opp")),
                "fgAtt": num(r.get("fg_att")), "fgMade": num(r.get("fg_made")), "xpAtt": num(r.get("pat_att")), "xpMade": num(r.get("pat_made")),
                "krYds": num(r.get("kickoff_return_yards")), "prYds": num(r.get("punt_return_yards")),
            }
            stats[y].append((i, t, line))


GROUP = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}


def fallback_match(raw: str, pos: str, team: str | None, y: int) -> list[int]:
    """A season line whose name differs from the roster's (John L. Williams, Raghib for Rocket):
    the one player on that club that season with the same last name, or the same first name,
    at the same position."""
    if not team:
        return []
    parts = raw.split()
    if len(parts) < 2:
        return []
    last, first = norm(parts[-1]), norm(parts[0])
    grp = GROUP.get(pos.upper().strip(), "")
    pool = [i for i in rosters[y].get(team, []) if GROUP.get(people[i]["p"], people[i]["p"]) == grp or not grp]
    same_last = [i for i in pool if norm(people[i]["l"]) == last or norm(people[i]["l"]).endswith(last) or last.endswith(norm(people[i]["l"]))]
    if len(same_last) == 1:
        return same_last
    same_first = [i for i in pool if norm(people[i]["f"]) == first]
    if len(same_first) == 1 and not same_last:
        return same_first
    return []


def load_fdp_stats() -> None:
    """1970-1998 offense from PFR's season tables. Matched to the roster by name and season."""
    unmatched = 0
    big: list[tuple] = []
    for y in range(1970, 1999):
        on_roster: dict[str, list[int]] = defaultdict(list)
        for t, ids in rosters[y].items():
            for i in ids:
                on_roster[norm(people[i]["f"] + people[i]["l"])].append(i)
        cut_team: dict[int, str] = {}
        for i, t in cut_pool[y]:
            k = norm(people[i]["f"] + people[i]["l"])
            if i not in on_roster[k]:
                on_roster[k].append(i)
                cut_team[i] = t
        # A plain reader, not DictReader: the 1970-1991 files repeat the Att/Yds headers, and a
        # dict keeps one column per name, which shifts every column after them (Rec read Fumbles).
        reader = csv.reader(open(DATA / "history" / "fdp" / f"{y}.csv", encoding="utf-8"))
        header = next(reader)
        for vals in reader:
            r = dict(zip(header, vals))
            raw = re.sub(r"[*+]", "", r["Player"] or "").strip()
            if not raw:
                continue
            cands = list(dict.fromkeys(on_roster.get(norm(raw), []) or on_roster.get(ALIAS.get(norm(raw), ""), [])))
            tm = r["Tm"]
            t = team_of(tm, y) if tm and not tm.endswith("TM") else None
            if not cands:
                cands = fallback_match(raw, r.get("Pos") or "", t, y)
            if len(cands) > 1 and t:
                cands = [i for i in cands if t in team_in[(i, y)]] or cands
            if len(cands) > 1:
                age = num(r.get("Age"))
                def age_of(i: int) -> float:
                    b = people[i]["b"]
                    return y - int(b[:4]) if b else -99
                cands = [i for i in cands if abs(age_of(i) - age) <= 1] or cands
            if len(cands) != 1:
                unmatched += 1
                tot = num(r.get("PassingYds")) + num(r.get("RushingYds")) + num(r.get("ReceivingYds"))
                if tot >= 400:
                    big.append((int(tot), y, raw, tm, len(cands)))
                continue
            i = cands[0]
            cols = vals
            if "Tgt" in r:
                # 1992+ layout: named columns, targets but no completions (left unknown, not zero).
                line = {
                    "gp": num(r.get("G")),
                    "passCmp": -1 if num(r.get("PassingAtt")) else 0, "passAtt": num(r.get("PassingAtt")), "passYds": num(r.get("PassingYds")),
                    "passTd": num(r.get("PassingTD")), "passInt": num(r.get("Int")),
                    "rushAtt": num(r.get("RushingAtt")), "rushYds": num(r.get("RushingYds")), "rushTd": num(r.get("RushingTD")),
                    "rec": num(r.get("Rec")), "targets": num(r.get("Tgt")), "recYds": num(r.get("ReceivingYds")), "recTd": num(r.get("ReceivingTD")),
                }
            else:
                # 1970-1991 layout repeats Att/Yds headers; read the passing and rushing blocks by position.
                # ,Player,Tm,Pos,Age,G,GS,Cmp,Att,Yds,Int,Att,Yds,Rec,Yds,Y/R,Fumbles,...,PassingYds,PassingTD,PassingAtt,RushingYds,...
                line = {
                    "gp": num(cols[5]),
                    "passCmp": num(cols[7]), "passAtt": num(r.get("PassingAtt")), "passYds": num(r.get("PassingYds")),
                    "passTd": num(r.get("PassingTD")), "passInt": num(cols[10]),
                    "rushAtt": num(r.get("RushingAtt")), "rushYds": num(r.get("RushingYds")), "rushTd": num(r.get("RushingTD")),
                    "rec": num(cols[13]), "recYds": num(r.get("ReceivingYds")), "recTd": num(r.get("ReceivingTD")),
                }
            team = t or (sorted(team_in[(i, y)])[0] if team_in[(i, y)] else cut_team.get(i, ""))
            join_roster(i, team, y)
            stats[y].append((i, team, line))
    print(f"fdp rows not matched to a roster player: {unmatched}; 400+ yards: {sorted(big, reverse=True)[:30]}")


# ---------- playoffs ----------

playoffs: dict[int, list[tuple]] = defaultdict(list)


def round_names(y: int, games: list[dict]) -> None:
    """Label rounds the way the league did: Super Bowl last, conference title games before it."""
    dates = sorted({g["date"] for g in games})
    # A round is a weekend: dates within 3 days of each other.
    rounds: list[list[str]] = []
    for d in dates:
        if rounds and (dt.date.fromisoformat(d) - dt.date.fromisoformat(rounds[-1][-1])).days <= 3:
            rounds[-1].append(d)
        else:
            rounds.append([d])
    n = len(rounds)
    for k, ds in enumerate(rounds):
        back = n - 1 - k
        for g in games:
            if g["date"] not in ds:
                continue
            if back == 0:
                g["round"] = "Super Bowl"
            elif y <= 1969:
                afl = g["home"] in AFL_CLUBS or g["away"] in AFL_CLUBS
                if back == 1:
                    g["round"] = "AFL Championship" if afl else "NFL Championship"
                else:
                    g["round"] = "AFL Divisional Playoff" if afl else "NFL Conference Championship"
            elif back == 1:
                g["round"] = "Conference Championship"
            elif back == 2:
                g["round"] = "Divisional"
            else:
                g["round"] = "Wild Card" if y != 1982 else "First Round"


AFL_CLUBS = {"buf", "nwe", "nyj", "mia", "oti", "kan", "rai", "sdg", "den", "cin"}


def load_playoffs() -> None:
    by_year: dict[int, list[dict]] = defaultdict(list)
    for r in csv.DictReader(open(DATA / "schedules" / "fivethirtyeight_nfl_games.csv", encoding="utf-8")):
        y = int(r["season"])
        if not (FIRST <= y <= 1998) or r["playoff"] in ("", "0"):
            continue
        by_year[y].append({"date": r["date"], "home": team_of(r["team1"], y), "away": team_of(r["team2"], y),
                           "hs": int(r["score1"]), "as": int(r["score2"]), "neutral": r["neutral"] == "1"})
    for r in csv.DictReader(open(DATA / "schedules" / "nflverse_games.csv", encoding="utf-8")):
        y = int(r["season"])
        if y < 1999 or y > LAST or r["game_type"] == "REG" or r["home_score"] in ("", "NA"):
            continue
        by_year[y].append({"date": r["gameday"], "home": team_of(r["home_team"], y), "away": team_of(r["away_team"], y),
                           "hs": int(r["home_score"]), "as": int(r["away_score"]), "neutral": r["location"] == "Neutral",
                           "type": r["game_type"]})
    for y, games in by_year.items():
        if any("type" in g for g in games):
            names = {"WC": "Wild Card", "DIV": "Divisional", "CON": "Conference Championship", "SB": "Super Bowl"}
            for g in games:
                g["round"] = names[g["type"]]
        else:
            round_names(y, games)
        for g in sorted(games, key=lambda g: g["date"]):
            playoffs[y].append((g["date"].replace("-", "")[4:], g["round"], g["home"], g["away"], g["hs"], g["as"], "N" if g["neutral"] else ""))


# ---------- drafts ----------

drafts: dict[int, list[tuple]] = defaultdict(list)


def cell_map(row: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in re.findall(r'data-stat="([^"]+)"[^>]*>(.*?)</t[dh]>', row, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", v)
        text = htmllib.unescape(text).replace("*", "").replace("+", "").strip()
        out[k] = re.sub(r"\s+HOF\s*$", "", text, flags=re.I)
    return out


def draftee(name: str, pos: str, college: str, year: int, team: str | None) -> int:
    """The person a pick became: the man of that name on a roster within two seasons, else a new entry."""
    n = norm(name)
    best = None
    for y in range(year, year + 3):
        for t, ids in rosters.get(y, {}).items():
            for i in ids:
                if norm(people[i]["f"] + people[i]["l"]) == n:
                    if best is None or t == team:
                        best = i
        if best is not None:
            break
    if best is not None:
        return best
    parts = name.split(" ", 1)
    return person(parts[0], parts[1] if len(parts) > 1 else "", pos, "", college)


def load_drafts() -> None:
    pfr = DATA / "drafts" / "pfr"
    for f in sorted(pfr.glob("*.htm")):
        m = re.match(r"(\d{4})_(nfl|afl)?_?draft", f.name)
        if not m:
            continue
        y = int(m.group(1))
        if y >= 1980:
            continue
        league = "afl" if f.name.startswith(f"{y}_draft") and y == 1966 else (m.group(2) or "nfl")
        html = re.sub(r"<!--|-->", "", f.read_text(errors="replace"))
        tm = re.search(r'<table[^>]*id="drafts".*?</table>', html, re.S | re.I)
        if not tm:
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", tm.group(0), re.S | re.I):
            cm = cell_map(row)
            name = cm.get("player") or ""
            if not name or name.lower() in ("player", "rk"):
                continue
            t = team_of(cm.get("team") or "", y)
            try:
                rnd = int(re.sub(r"\D", "", cm.get("draft_round") or "0") or 0)
                pick = int(re.sub(r"\D", "", cm.get("draft_pick") or "0") or 0)
            except ValueError:
                continue
            if not t or not rnd:
                continue
            i = draftee(name, pos_of(cm.get("pos") or ""), cm.get("college_id") or "", y, t)
            drafts[y].append((rnd, pick, t, i, league if y == 1966 else ""))
    for r in csv.DictReader(open(DATA / "drafts" / "draft_picks.csv", encoding="utf-8")):
        y = int(r["season"])
        if y < 1980 or y > LAST:
            continue
        t = team_of(r["team"], y)
        if not t:
            continue
        gsis = (r.get("gsis_id") or "").strip()
        if gsis and gsis in by_gsis:
            i = by_gsis[gsis]
        else:
            i = draftee(r["pfr_player_name"], pos_of(r["position"]), r.get("college") or "", y, t)
        drafts[y].append((int(r["round"]), int(r["pick"]), t, i, ""))


# ---------- awards and the Hall of Fame (Wikipedia) ----------

WIKI = DATA / "history" / "wiki"
NICKS = ("Packers Bears Lions Vikings Cowboys Giants Eagles Redskins Commanders Football Cardinals Rams 49ers "
         "Seahawks Saints Falcons Buccaneers Panthers Patriots Jets Dolphins Bills Steelers Ravens Browns Bengals "
         "Oilers Titans Texans Colts Jaguars Chiefs Raiders Chargers Broncos").split()
NOT_PERSON = re.compile(r"season|football|quarterback|back|end\b|tackle|guard|center|receiver|linebacker|safety|"
                        r"cornerback|kicker|punter|tight|defensive|offensive|running|wide|super bowl|coach|nfl|afl|award", re.I)
awards: dict[int, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
hof: dict[int, list[str]] = defaultdict(list)


def wiki_names(row: str) -> list[str]:
    """Winners named in a table row: {{sortname|First|Last}} first, else the first person link."""
    out = []
    for m in re.finditer(r"\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)", row, re.I):
        out.append(f"{m.group(1).strip()} {m.group(2).strip()}")
    if out:
        return out
    for m in re.finditer(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", row):
        target, shown = m.group(1), (m.group(2) or m.group(1))
        shown = re.sub(r"\s*\(.*?\)", "", shown).strip()
        # "Jack Lambert (American football)": judge the name, not the disambiguation.
        target = re.sub(r"\s*\(.*?\)", "", target).strip()
        if NOT_PERSON.search(target) or any(n in target for n in NICKS) or len(shown.split()) < 2 or re.search(r"\d", target):
            continue
        out.append(shown)
        break
    return out


def wiki_rows(text: str, award: str, year_re: str = r"\[\[(\d{4}) (?:NFL|AFL) season|\{\{NFL year\|(\d{4})") -> None:
    carry = (0, 0)  # a season cell spanning rows (co-winners on the next row)
    for row in re.split(r"\n\|-", text):
        row = row.split("\n|}")[0]
        m = re.search(year_re, row)
        # Only table rows: the season cell opens the row (prose above the table also links seasons).
        if not m or m.start() > 60:
            if carry[1] > 0 and re.match(r"\s*\n?\s*!", row):
                carry = (carry[0], carry[1] - 1)
                for name in wiki_names(row):
                    if name not in awards[carry[0]][award]:
                        awards[carry[0]][award].append(name)
            continue
        y = int(m.group(1) or m.group(2))
        span = re.search(r"rowspan=\"?(\d+)", row[: m.start() + 5])
        carry = (y, int(span.group(1)) - 1) if span else (0, 0)
        if not (FIRST <= y <= LAST):
            continue
        for name in wiki_names(row[m.end():]):
            if name not in awards[y][award]:
                awards[y][award].append(name)


def load_awards() -> None:
    page = lambda t: (WIKI / f"{t}.wikitext").read_text(errors="replace")
    wiki_rows(page("AP_NFL_Most_Valuable_Player"), "mvp")
    wiki_rows(page("AP_NFL_Offensive_Player_of_the_Year"), "opoy")
    wiki_rows(page("AP_NFL_Defensive_Player_of_the_Year"), "dpoy")
    wiki_rows(page("AP_NFL_Comeback_Player_of_the_Year"), "cpoy")
    wiki_rows(page("AP_NFL_Coach_of_the_Year"), "coy")
    rookie = page("AP_NFL_Rookie_of_the_Year")
    off, _, rest = rookie.partition("===Defensive===")
    wiki_rows(off, "oroy")
    wiki_rows(rest.split("==See also==")[0], "droy")
    # Super Bowl MVP rows link the season the game ended ([[1967 NFL season|1968]]).
    wiki_rows(page("Super_Bowl_Most_Valuable_Player"), "sbmvp")
    for row in re.split(r"\n\|-", page("List_of_Pro_Football_Hall_of_Fame_inductees")):
        m = re.search(r"\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)", row, re.I)
        if not m:
            continue
        y = re.search(r"(?:\|\||\|)\s*(?:rowspan=\d+\s*\|)?\s*((?:19[6-9]|20[0-2])\d)\s*(?:\|\||\n|$)", row[m.end():])
        if not y:
            continue
        name = f"{m.group(1).strip()} {m.group(2).strip()}"
        if name not in hof[int(y.group(1))]:
            hof[int(y.group(1))].append(name)


def resolve(name: str, year: int) -> str:
    """A winner's person id (base 36) if he was on a roster near that season, else '~Name'."""
    n = norm(name)
    best = None
    for dy in (0, -1, 1, -2, 2, -3, -4, -5):
        for t, ids in rosters.get(year + dy, {}).items():
            for i in ids:
                if norm(people[i]["f"] + people[i]["l"]) == n:
                    best = i
                    break
            if best is not None:
                break
        if best is not None:
            break
    if best is None:
        # Hall of Famers retired long before their class: any season he played.
        for i, p in enumerate(people):
            if norm(p["f"] + p["l"]) == n and seasons_of.get(i):
                best = i
                break
    return b36(best) if best is not None else "~" + name


# ---------- output ----------


def b36(n: int) -> str:
    s = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        n, r = divmod(n, 36)
        out = s[r] + out
        if n == 0:
            return out


def fmt(v: float) -> str:
    if v == -1:
        return "?"
    if not v:
        return ""
    return str(int(v)) if float(v).is_integer() else f"{v:.1f}"


def esc(s: str) -> str:
    return s.replace("\\", "").replace("|", "/").replace("\n", " ").replace('"', "'")


def write() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    head = "/** Auto-generated by scripts/ingest-history.py: what really happened. Do not hand-edit. */\n"
    lines = "\n".join(f'{esc(p["f"])}|{esc(p["l"])}|{p["p"]}|{p["b"]}|{esc(p["c"])}' for p in people)
    (OUT / "people.ts").write_text(head + "/** first|last|pos|birth (YYYYMMDD)|college, one per line; a person's id is his line number. */\nexport const PEOPLE = `" + lines.replace("`", "'") + "`;\n")
    ros = []
    for y in sorted(rosters):
        def entry(i: int, t: str) -> str:
            j = jerseys.get((i, y, t), 0)
            return f"{b36(i)}.{j}" if j else b36(i)
        ros.append(f'  {y}: "' + ";".join(f"{t}:{','.join(entry(i, t) for i in ids)}" for t, ids in sorted(rosters[y].items())) + '",')
    (OUT / "rosters.ts").write_text(head + "/** Per season: team:id[.jersey],... joined by ';' (ids base 36). */\nexport const ROSTERS: Record<number, string> = {\n" + "\n".join(ros) + "\n};\n")
    st = []
    for y in sorted(stats):
        rows = []
        for i, t, line in stats[y]:
            vals = [fmt(line.get(k, 0)) for k in FIELDS]
            while vals and vals[-1] == "":
                vals.pop()
            if not any(vals[1:]) and not vals:
                continue
            rows.append(f"{b36(i)},{t}," + ",".join(vals))
        st.append(f'  {y}: "' + "|".join(rows) + '",')
    (OUT / "stats.ts").write_text(
        head
        + f"export const STAT_FIELDS = {FIELDS!r} as const;\n".replace("'", '"')
        + "/** Per season: id,team,then STAT_FIELDS in order ('' = 0), rows joined by '|'. */\nexport const STATS: Record<number, string> = {\n"
        + "\n".join(st)
        + "\n};\n"
    )
    po = [f'  {y}: "' + "|".join(",".join(str(x) for x in g) for g in playoffs[y]) + '",' for y in sorted(playoffs)]
    (OUT / "playoffs.ts").write_text(head + "/** Per season: MMDD,round,home,away,homeScore,awayScore,N(neutral) joined by '|', in date order. */\nexport const PLAYOFFS: Record<number, string> = {\n" + "\n".join(po) + "\n};\n")
    dr = [f'  {y}: "' + "|".join(f"{r},{p},{t},{b36(i)},{lg}" for r, p, t, i, lg in sorted(drafts[y], key=lambda x: (x[4], x[0], x[1]))) + '",' for y in sorted(drafts)]
    (OUT / "drafts.ts").write_text(head + "/** Per draft: round,pick,team,person id (base 36),league (1966 only: afl/nfl) joined by '|'. */\nexport const DRAFTS: Record<number, string> = {\n" + "\n".join(dr) + "\n};\n")
    aw = []
    for y in sorted(awards):
        parts = [f"{k}:" + "/".join(("~" + n) if k == "coy" else resolve(n, y) for n in v) for k, v in sorted(awards[y].items())]
        aw.append(f'  {y}: "' + esc(";".join(parts)) .replace("/", "\u0000").replace("\u0000", "/") + '",')
    (OUT / "awards.ts").write_text(head + "/** Per season: award:id/id;... (base-36 person ids, or ~Name for coaches and unmatched names). */\nexport const AWARDS: Record<number, string> = {\n" + "\n".join(aw) + "\n};\n")
    def inductee(n: str, y: int) -> str:
        # A player is eligible five seasons after his last; a namesake still playing isn't him.
        r = resolve(n, y - 5)
        if r.startswith("~"):
            return r
        played = seasons_of.get(int(r, 36), set())
        return r if played and max(played) <= y - 5 else "~" + n
    hf = [f'  {y}: "' + esc("/".join(inductee(n, y) for n in names)).replace("|", "/") + '",' for y, names in sorted(hof.items()) if FIRST <= y <= LAST + 1]
    (OUT / "hof.ts").write_text(head + "/** Per Hall of Fame class: inductees as base-36 person ids, or ~Name for coaches, contributors and pre-1966 players. */\nexport const HOF_CLASSES: Record<number, string> = {\n" + "\n".join(hf) + "\n};\n")
    print(f"people {len(people)}, roster seasons {len(rosters)}, stat seasons {len(stats)}, playoff seasons {len(playoffs)}, drafts {len(drafts)}")


def main() -> None:
    load_rosters()
    load_nflverse_stats()
    load_fdp_stats()
    load_playoffs()
    load_drafts()
    load_awards()
    write()


if __name__ == "__main__":
    main()
