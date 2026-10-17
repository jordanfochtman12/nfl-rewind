"""
Opening-day rosters and each season's positions, for a league begun from the record.

The season roster files list everyone a club had at any point that year (the man signed in
December, the practice squad, the camp cut), and a person carries one position for his whole
career. A league that opens on a season wants who was there in week one, at the spot he played
that year.

Reads:
  history/weekly/roster_weekly_YYYY.csv   nflverse weekly rosters (2002 on; not kept in the repo,
                                          fetched from nflverse-data's weekly_rosters release)
  history/rosters/roster_YYYY.csv         nflverse season rosters (every season)
  src/lib/game/data/history/people.ts     the record's people, so ids match the other tables

Writes src/lib/game/data/history/opening.ts:
  OPENING[year]  week one of the regular season, club by club (2002 on)
  SEASON_POS[year]  the position each person played that season, where it differs from his
                    career position in people.ts
"""
from __future__ import annotations

import csv
import importlib.util
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "history"
OUT = ROOT / "src" / "lib" / "game" / "data" / "history" / "opening.ts"

spec = importlib.util.spec_from_file_location("ingest_history", ROOT / "scripts" / "ingest-history.py")
hist = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hist)
norm, pos_of, team_of = hist.norm, hist.pos_of, hist.team_of

# Not on the club in week one: cut, the practice squad, unsigned.
SKIP = {"CUT", "DEV", "UFA", "RFA", "EXE"}
# The week's own status, where the file has it. The early files' `status` is where a man ended
# the season (Vanderjagt reads CUT every week of 2006, though he kicked for Dallas into November);
# status_description_abbr is that week: A active, I inactive, R reserve, P practice squad.
def off_roster(r: dict) -> bool:
    week = (r.get("status_description_abbr") or "").strip().upper()
    if week:
        return week[0] in ("P", "W", "C", "E", "U")
    return (r.get("status") or "") in SKIP


# On the club but not the active roster that week: injured reserve, PUP, suspended, did not report.
RESERVE = {"RES", "PUP", "SUS", "RSN", "NWT", "NFI"}


def on_reserve(r: dict) -> bool:
    week = (r.get("status_description_abbr") or "").strip().upper()
    if week:
        return week[0] == "R"
    return (r.get("status") or "") in RESERVE


def season_clubs(y: int) -> dict[int, set[str]]:
    """Each person's clubs on the record's season rosters."""
    out: dict[int, set[str]] = defaultdict(set)
    for t, ids in ROSTER_IDS.get(y, {}).items():
        for i in ids:
            out[i].add(t)
    return out
# A listing that only names the unit ("LB", "DB", "T") says nothing about which spot in it.
GENERIC = {"LB", "DB", "T", "G", "OL", "OT", "OG", "DL", "SPEC", ""}
GROUP = {"QB": "QB", "RB": "B", "FB": "B", "WR": "WR", "TE": "TE", "LT": "OL", "LG": "OL", "C": "OL", "RG": "OL", "RT": "OL",
         "DE": "DE", "DT": "DT", "OLB": "OLB", "MLB": "MLB", "CB": "CB", "S": "S", "K": "K", "P": "P"}


def season_spot(r: dict) -> str | None:
    """The spot a row names, when it names one."""
    for raw in (r.get("depth_chart_position", ""), r["position"]):
        raw = (raw or "").upper().strip()
        if raw and raw not in GENERIC and raw in hist.POS:
            return hist.POS[raw]
    return None

PEOPLE = re.search(r"PEOPLE = `(.*?)`", (ROOT / "src/lib/game/data/history/people.ts").read_text(), re.S).group(1).split("\n")
people = [line.split("|") for line in PEOPLE]
by_key: dict[str, int] = {}
by_name: dict[str, list[int]] = defaultdict(list)
for i, (first, last, pos, birth, *_rest) in enumerate(people):
    if birth:
        by_key.setdefault(f"{norm(first + last)}|{birth}", i)
    by_name[norm(first + last)].append(i)


# The record's own season rosters (rosters.ts), already matched to people: each club's men, and
# through them each gsis id, so a nickname in the weekly file ("Bert Berry") still finds his man.
ROSTER_IDS: dict[int, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
for _y, _body in re.findall(r'^  (\d{4}): "([^"]*)"', (ROOT / "src/lib/game/data/history/rosters.ts").read_text(), re.M):
    for _chunk in _body.split(";"):
        if ":" not in _chunk:
            continue
        _t, _lst = _chunk.split(":", 1)
        for _e in _lst.split(","):
            if _e:
                ROSTER_IDS[int(_y)][_t].add(int(_e.split(".")[0], 36))
BY_GSIS: dict[str, int] = {}
for _y in range(1966, 2027):
    _path = DATA / "rosters" / f"roster_{_y}.csv"
    if not _path.exists():
        continue
    for _r in csv.DictReader(open(_path, encoding="utf-8")):
        _g = (_r.get("gsis_id") or "").strip()
        _t = team_of(_r["team"], _y)
        if not _g or _g in BY_GSIS or not _t:
            continue
        _last = norm((_r["last_name"] or "").strip())
        _hits = [i for i in ROSTER_IDS[_y][_t] if norm(people[i][1]) == _last]
        if len(_hits) == 1:
            BY_GSIS[_g] = _hits[0]


def who(r: dict) -> int | None:
    g = (r.get("gsis_id") or "").strip()
    if g in BY_GSIS:
        return BY_GSIS[g]
    full = (r["full_name"] or "").strip()
    last = (r["last_name"] or "").strip() or full.split(" ")[-1]
    first = full.split(last)[0].strip() if last in full and full.index(last) > 0 else (r["first_name"] or "").strip()
    birth = (r["birth_date"] or "").replace("-", "")
    if birth and f"{norm(first + last)}|{birth}" in by_key:
        return by_key[f"{norm(first + last)}|{birth}"]
    hits = by_name.get(norm(first + last), [])
    return hits[0] if len(hits) == 1 else None


def b36(n: int) -> str:
    s = ""
    while True:
        n, d = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[d] + s
        if not n:
            return s


opening: dict[int, dict[str, list[tuple[int, str, bool]]]] = {}
season_pos: dict[int, dict[int, str]] = {}
missed: dict[int, int] = {}
for y in range(1966, 2027):
    weekly = DATA / "weekly" / f"roster_weekly_{y}.csv"
    season = DATA / "rosters" / f"roster_{y}.csv"
    pos_seen: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    if weekly.exists():
        rows = [r for r in csv.DictReader(open(weekly, encoding="utf-8")) if r.get("game_type") == "REG"]
        # Each club's opening week: its first with a real 53-man roster. Some seasons' week one is
        # the 90-man camp list (2016), and a club can open late (Miami and Tampa Bay, Irma, 2017).
        active: dict[tuple[str, int], int] = defaultdict(int)
        for r in rows:
            if not off_roster(r) and not on_reserve(r) and r["week"].isdigit():
                active[(r["team"], int(r["week"]))] += 1
        first_week: dict[str, int] = {}
        for team in {t for t, _ in active}:
            weeks = sorted(w for t, w in active if t == team)
            early = weeks[:3]
            fit = [w for w in early if active[(team, w)] <= 55]
            first_week[team] = fit[0] if fit else min(early, key=lambda w: active[(team, w)])
        clubs: dict[str, list[tuple[int, str, bool]]] = defaultdict(list)
        seen: set[int] = set()
        anywhere: set[int] = set()
        miss = 0
        for r in rows:
            if off_roster(r) or not r["week"].isdigit():
                continue
            opening_row = int(r["week"]) == first_week.get(r["team"])
            i = who(r)
            if i is None:
                miss += opening_row
                continue
            anywhere.add(i)
            spot = season_spot(r)
            if spot:
                pos_seen[i][spot] += 1
            t = team_of(r["team"], y)
            if not opening_row or not t or i in seen:
                continue
            seen.add(i)
            # His spot in week one: the unit he was really in, his career spot within it.
            clubs[t].append((i, spot if spot and GROUP.get(spot) != GROUP.get(people[i][2]) else people[i][2], on_reserve(r)))
        # The weekly files miss some men altogether (Chad Johnson, Bertrand Berry and Rod Coleman
        # aren't in 2006's at all). A man missing from every week of the file, on a club's season
        # roster and on the same club the year before, was there for week one too. One the file
        # has only from later weeks really wasn't (a holdout, a practice-squad call-up).
        this_year, last_year = season_clubs(y), season_clubs(y - 1)
        backfilled = 0
        for i, teams in this_year.items():
            if i in seen or i in anywhere:
                continue
            stayed = sorted(teams & last_year.get(i, set()))
            if len(stayed) == 1:
                clubs[stayed[0]].append((i, people[i][2], False))
                seen.add(i)
                backfilled += 1
        opening[y] = clubs
        missed[y] = miss
        print(y, "backfilled from the season roster:", backfilled)
    elif season.exists():
        for r in csv.DictReader(open(season, encoding="utf-8")):
            if (r.get("status") or "") in SKIP:
                continue
            i = who(r)
            spot = season_spot(r)
            if i is not None and spot:
                pos_seen[i][spot] += 1
    # The spot he was listed at most that season, where it's another unit than his career one
    # (a corner moved to safety, an end stood up at linebacker); a side of the line isn't a move.
    season_pos[y] = {}
    for i, c in pos_seen.items():
        top = max(c, key=c.get)
        if GROUP.get(top) != GROUP.get(people[i][2]):
            season_pos[y][i] = top

lines = [
    "/** Auto-generated by scripts/ingest-opening.py from nflverse rosters. Do not hand-edit. */",
    "/** Week one of the regular season: club:person.pos[.r],... (.r: on reserve that week; person ids in base 36). */",
    "export const OPENING: Record<number, string> = {",
]
for y, clubs in sorted(opening.items()):
    body = ";".join(f"{t}:" + ",".join(f"{b36(i)}.{p}" + (".r" if res else "") for i, p, res in ids) for t, ids in sorted(clubs.items()))
    lines.append(f'  {y}: "{body}",')
lines += ["};", "/** The position each person played that season, where it isn't his career one: person.pos,... */", "export const SEASON_POS: Record<number, string> = {"]
for y, m in sorted(season_pos.items()):
    lines.append(f'  {y}: "' + ",".join(f"{b36(i)}.{p}" for i, p in sorted(m.items())) + '",')
lines.append("};")
OUT.write_text("\n".join(lines) + "\n")
print("opening seasons", len(opening), "week-one players not matched to the record:", {y: n for y, n in missed.items() if n})
print("season positions that differ:", sum(len(m) for m in season_pos.values()))
