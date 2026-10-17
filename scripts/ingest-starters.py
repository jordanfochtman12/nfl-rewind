"""
Who started, and at which exact spot, every season from 1966.

1966-2000: Pro Football Archives' rosters (data/history/pfa/YYYY.csv, already kept for
ingest-history.py): every man's games played and started for each club, and his spot (LOT,
ROG, RLB, LCB, LS for the left safety...). 2001 on: nflverse's depth charts, below.

Reads:
  history/depth/depth_charts_YYYY.csv   nflverse depth charts (weekly to 2024; dated snapshots
                                        from 2025). Not kept in the repo: fetched from
                                        nflverse-data's depth_charts release.
  history/rosters/roster_YYYY.csv, history/weekly/roster_weekly_YYYY.csv
                                        to tie each gsis id to the record's person
  src/lib/game/data/history/people.ts

Writes src/lib/game/data/history/starters.ts:
  STARTERS[year] = "person.starts.spot,..."  starts = regular-season weeks he was first string
                   (out of the season's weeks), spot = where he was listed most (LT, RG, OLB, FS...)
"""
from __future__ import annotations

import csv
import importlib.util
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "history"
GEN = ROOT / "src" / "lib" / "game" / "data" / "history"

spec = importlib.util.spec_from_file_location("ingest_opening", ROOT / "scripts" / "ingest-opening.py")

# The record's people, so ids match the other tables.
spec_h = importlib.util.spec_from_file_location("ingest_history", ROOT / "scripts" / "ingest-history.py")
hist = importlib.util.module_from_spec(spec_h)
spec_h.loader.exec_module(hist)
norm = hist.norm
PEOPLE = re.search(r"PEOPLE = `(.*?)`", (GEN / "people.ts").read_text(), re.S).group(1).split("\n")
people = [line.split("|") for line in PEOPLE]
by_key: dict[str, int] = {}
by_name: dict[str, list[int]] = defaultdict(list)
for i, (first, last, pos, birth, *_rest) in enumerate(people):
    if birth:
        by_key.setdefault(f"{norm(first + last)}|{birth}", i)
    by_name[norm(first + last)].append(i)


def who(first: str, last: str, full: str, birth: str) -> int | None:
    if last and last in full and full.index(last) > 0:
        first = full.split(last)[0].strip()
    birth = birth.replace("-", "")
    if birth and f"{norm(first + last)}|{birth}" in by_key:
        return by_key[f"{norm(first + last)}|{birth}"]
    hits = by_name.get(norm(first + last), [])
    return hits[0] if len(hits) == 1 else None


# The game's spots from the depth charts' (which name the side and the linebacker's job).
SPOT = {
    "QB": "QB", "RB": "RB", "HB": "RB", "TB": "RB", "FB": "FB", "WR": "WR", "LWR": "WR", "RWR": "WR", "SWR": "WR", "SE": "WR",
    "FL": "WR", "TE": "TE", "LT": "LT", "LG": "LG", "C": "C", "RG": "RG", "RT": "RT",
    "DE": "DE", "LDE": "DE", "RDE": "DE", "LE": "DE", "RE": "DE", "EDGE": "DE", "DT": "DT", "LDT": "DT", "RDT": "DT",
    "NT": "DT", "MLB": "MLB", "ILB": "MLB", "LILB": "MLB", "RILB": "MLB", "MIKE": "MLB", "WLB": "OLB",
    "SLB": "OLB", "LOLB": "OLB", "ROLB": "OLB", "OLB": "OLB", "WILL": "OLB", "SAM": "OLB",
    "CB": "CB", "LCB": "CB", "RCB": "CB", "NB": "CB", "NCB": "CB", "FS": "S", "SS": "S", "S": "S",
    "K": "K", "PK": "K", "P": "P",
}


def gsis_people(y: int) -> dict[str, int]:
    out: dict[str, int] = {}
    for path in (DATA / "rosters" / f"roster_{y}.csv", DATA / "weekly" / f"roster_weekly_{y}.csv"):
        if not path.exists():
            continue
        for r in csv.DictReader(open(path, encoding="utf-8")):
            g = (r.get("gsis_id") or "").strip()
            if not g or g in out:
                continue
            i = who((r["first_name"] or "").strip(), (r["last_name"] or "").strip(), (r["full_name"] or "").strip(), r["birth_date"] or "")
            if i is not None:
                out[g] = i
    return out


# Pro Football Archives' spot codes (a man who played two is listed "LDE-RDE": the first is his).
PFA_SPOT = {
    "QB": "QB", "RB": "RB", "HB": "RB", "TB": "RB", "LHB": "RB", "RHB": "RB", "FB": "FB", "WR": "WR", "FL": "WR",
    "SE": "WR", "TE": "TE", "HBK": "TE", "UBK": "TE", "LOT": "LT", "ROT": "RT", "LOG": "LG", "ROG": "RG", "C": "C",
    "DE": "DE", "LDE": "DE", "RDE": "DE", "DT": "DT", "LDT": "DT", "RDT": "DT", "NT": "DT", "MG": "DT", "NG": "DT",
    "UT": "DT", "MLB": "MLB", "ILB": "MLB", "LILB": "MLB", "RILB": "MLB", "WILB": "MLB", "SILB": "MLB",
    "OLB": "OLB", "LLB": "OLB", "RLB": "OLB", "LOLB": "OLB", "ROLB": "OLB", "SLB": "OLB", "WLB": "OLB",
    "CB": "CB", "LCB": "CB", "RCB": "CB", "NB": "CB", "S": "S", "SS": "S", "FS": "S", "LS": "S", "RS": "S", "WS": "S",
    "K": "K", "P": "P",
}


def pfa_season(y: int) -> tuple[dict[int, tuple[int, str | None]], int]:
    """person -> (games started, spot at the club he started most for), and the season's games."""
    pfa_ids = {pid: int(i) for pid, i in csv.reader(open(DATA / "pfa_ids.csv", encoding="utf-8"))}
    starts: dict[int, int] = defaultdict(int)
    best: dict[int, tuple[int, str | None]] = {}
    most = 0
    for r in csv.reader(open(DATA / "pfa" / f"{y}.csv", encoding="utf-8")):
        if len(r) < 12 or r[1] != "ROSTER" or not r[2]:
            continue
        i = pfa_ids.get(r[2])
        if i is None:
            continue
        gs = int(r[11]) if r[11].strip().isdigit() else 0
        most = max(most, gs)
        code = (r[5] or "").upper().replace(" ", "").split("-")[0]
        spot = PFA_SPOT.get(code)
        starts[i] += gs
        if i not in best or gs > best[i][0] or (spot and not best[i][1]):
            best[i] = (gs, spot or (best[i][1] if i in best else None))
    return {i: (starts[i], best[i][1]) for i in starts}, most


def b36(n: int) -> str:
    s = ""
    while True:
        n, d = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[d] + s
        if not n:
            return s


def main() -> None:
    lines = [
        "/** Auto-generated by scripts/ingest-starters.py from nflverse depth charts. Do not hand-edit. */",
        "/** Per season: person.starts.spot,... (starts = regular-season weeks first string, of WEEKS[season]). */",
        "export const STARTERS: Record<number, string> = {",
    ]
    weeks_of: dict[int, int] = {}
    for y in range(1966, 2001):
        got, games = pfa_season(y)
        weeks_of[y] = games
        # A man with no spot of his own here (a bare LB or DB) still counts his starts.
        body = [f"{b36(i)}.{gs}.{spot or ''}" for i, (gs, spot) in sorted(got.items())]
        lines.append(f'  {y}: "{",".join(body)}",')
        print(y, "games", games, "players", len(got), "starters (half+)", sum(1 for gs, _ in got.values() if gs * 2 >= games))
    for y in range(2001, 2027):
        path = DATA / "depth" / f"depth_charts_{y}.csv"
        if not path.exists():
            continue
        ids = gsis_people(y)
        starts: dict[int, set] = defaultdict(set)
        spots: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        periods: set = set()
        rows = csv.DictReader(open(path, encoding="utf-8"))
        dated = "dt" in (rows.fieldnames or [])
        for r in rows:
            g = (r.get("gsis_id") or "").strip()
            i = ids.get(g)
            if dated:
                # Snapshots by date: the regular season (September through early January), by week.
                d = r["dt"][:10]
                if not (d >= f"{y}-09-01" or d <= f"{y + 1}-01-08") or not d.startswith((str(y), str(y + 1))):
                    continue
                if d < f"{y}-09-01" or d > f"{y + 1}-01-08":
                    continue
                period = d[:10]
                raw = (r.get("pos_abb") or "").upper()
                first = r.get("pos_rank") == "1"
            else:
                if r.get("game_type") != "REG" or not (r.get("week") or "").isdigit():
                    continue
                if r.get("formation") == "Special Teams" and (r.get("depth_position") or "").upper() not in ("K", "PK", "P"):
                    continue
                period = int(r["week"])
                raw = (r.get("depth_position") or r.get("position") or "").upper()
                first = r.get("depth_team") == "1"
            spot = SPOT.get(raw)
            periods.add(period)
            if i is None or not spot:
                continue
            spots[i][spot] += 1
            if first:
                starts[i].add(period)
        n = len(periods) or 1
        weeks_of[y] = n
        body = []
        for i, c in sorted(spots.items()):
            spot = max(c, key=c.get)
            # Dated snapshots come several a week: starts scale to a 17-week season.
            s = len(starts.get(i, ()))
            s = round(s * 17 / n) if dated else s
            body.append(f"{b36(i)}.{s}.{spot}")
        lines.append(f'  {y}: "{",".join(body)}",')
        print(y, "periods", n, "players", len(spots), "starters (8+)", sum(1 for i in spots if len(starts.get(i, ())) * (17 / n if dated else 1) >= 8))
    lines.append("};")
    lines.append("/** Weeks the depth charts cover each season (dated seasons are scaled to 17). */")
    lines.append("export const WEEKS: Record<number, number> = {" + ", ".join(f"{y}: {17 if y >= 2025 else n}" for y, n in sorted(weeks_of.items())) + "};")
    (GEN / "starters.ts").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
