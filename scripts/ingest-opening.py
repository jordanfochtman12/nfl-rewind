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
# A listing that only names the unit ("LB", "DB", "T") says nothing about which spot in it.
GENERIC = {"LB", "DB", "T", "G", "OL", "OT", "OG", "DL", "SPEC", ""}
GROUP = {"QB": "QB", "RB": "B", "FB": "B", "WR": "WR", "TE": "TE", "LT": "OL", "LG": "OL", "C": "OL", "RG": "OL", "RT": "OL",
         "DE": "DE", "DT": "DT", "OLB": "LB", "MLB": "LB", "CB": "CB", "S": "S", "K": "K", "P": "P"}


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


def who(r: dict) -> int | None:
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


opening: dict[int, dict[str, list[tuple[int, str]]]] = {}
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
            if r["status"] == "ACT" and r["week"].isdigit():
                active[(r["team"], int(r["week"]))] += 1
        first_week: dict[str, int] = {}
        for team in {t for t, _ in active}:
            weeks = sorted(w for t, w in active if t == team)
            early = weeks[:3]
            fit = [w for w in early if active[(team, w)] <= 55]
            first_week[team] = fit[0] if fit else min(early, key=lambda w: active[(team, w)])
        clubs: dict[str, list[tuple[int, str]]] = defaultdict(list)
        seen: set[int] = set()
        miss = 0
        for r in rows:
            if r.get("status") in SKIP or not r["week"].isdigit():
                continue
            opening_row = int(r["week"]) == first_week.get(r["team"])
            i = who(r)
            if i is None:
                miss += opening_row
                continue
            spot = season_spot(r)
            if spot:
                pos_seen[i][spot] += 1
            t = team_of(r["team"], y)
            if not opening_row or not t or i in seen:
                continue
            seen.add(i)
            # His spot in week one: the unit he was really in, his career spot within it.
            clubs[t].append((i, spot if spot and GROUP.get(spot) != GROUP.get(people[i][2]) else people[i][2]))
        opening[y] = clubs
        missed[y] = miss
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
    "/** Week one of the regular season: club:person.pos,... (person ids in base 36). */",
    "export const OPENING: Record<number, string> = {",
]
for y, clubs in sorted(opening.items()):
    body = ";".join(f"{t}:" + ",".join(f"{b36(i)}.{p}" for i, p in ids) for t, ids in sorted(clubs.items()))
    lines.append(f'  {y}: "{body}",')
lines += ["};", "/** The position each person played that season, where it isn't his career one: person.pos,... */", "export const SEASON_POS: Record<number, string> = {"]
for y, m in sorted(season_pos.items()):
    lines.append(f'  {y}: "' + ",".join(f"{b36(i)}.{p}" for i, p in sorted(m.items())) + '",')
lines.append("};")
OUT.write_text("\n".join(lines) + "\n")
print("opening seasons", len(opening), "week-one players not matched to the record:", {y: n for y, n in missed.items() if n})
print("season positions that differ:", sum(len(m) for m in season_pos.values()))
