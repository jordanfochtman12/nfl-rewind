#!/usr/bin/env python3
"""History mode's record book, as it really changed: when each all-time record fell.

For the big records (passing, rushing and receiving yards and touchdowns, catches,
interceptions, sacks), single-season and career, this walks the real seasons week by week
and notes the week a record fell and who held it before.

- Inside a season, the running totals come from the real box scores
  (data/history/box/YYYY.ts, built by scripts/ingest-boxscores.py), so a record falls in the
  week it really fell. Each season's official line replaces the running total at season's end.
- Careers count the official season lines (stats.ts) plus every season before 1966 from the
  archive's team-season pages (data/history/pfa/, NFL 1920-65 and AFL 1960-65; the AAFC isn't
  counted, as the league's record book doesn't count it). The career records standing in 1966
  are checked against the record book's numbers below (printed where they differ).
- Sacks weren't an official stat until 1982; their records start there.

Writes src/lib/game/data/history/recordMoments.ts.
Re-run (after the box scores): python3 scripts/ingest-record-moments.py
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HIST = ROOT / "src" / "lib" / "game" / "data" / "history"
GAME = ROOT / "src" / "lib" / "game" / "data"
DATA = ROOT / "data" / "history"
OUT = HIST / "recordMoments.ts"
FIRST, LAST = 1966, 2025

# Box-score key, official stat field, label.
CATS = [
    ("passYds", "py", "passing yards"),
    ("passTd", "pt", "touchdown passes"),
    ("rushYds", "ry", "rushing yards"),
    ("rushTd", "rt", "rushing touchdowns"),
    ("rec", "re", "catches"),
    ("recYds", "ey", "receiving yards"),
    ("recTd", "et", "touchdown catches"),
    ("ints", "in", "interceptions"),
    ("sacks", "sa", "sacks"),
]
SACKS_FROM = 1982
# Career sacks only count from 1982, so the early "career leaders" are a few seasons' worth;
# a change at the top is news once the mark is a real career's (Reggie White passing Lawrence
# Taylor in 1993 is the first).
SACK_CAREER_FROM = 100

# Standing single-season records entering 1966 (holder, value, year).
SEASON_BEFORE = {
    "passYds": ("Sonny Jurgensen", 3723, 1961),
    "passTd": ("George Blanda and Y.A. Tittle", 36, 1963),
    "rushYds": ("Jim Brown", 1863, 1963),
    "rushTd": ("Jim Taylor", 19, 1962),
    "rec": ("Charley Hennigan", 101, 1964),
    "recYds": ("Charley Hennigan", 1746, 1961),
    "recTd": ("Don Hutson, Elroy Hirsch and Bill Groman", 17, 1961),
    "ints": ('Dick "Night Train" Lane', 14, 1952),
}
# Career records held entering 1966 by players already retired (active players' careers are
# counted from their real season lines).
CAREER_BEFORE = {
    "rushYds": ("Jim Brown", 12312),
    "rushTd": ("Jim Brown", 106),
    "rec": ("Billy Howton", 503),
    "recYds": ("Billy Howton", 8459),
    "recTd": ("Don Hutson", 99),
    "ints": ("Emlen Tunnell", 79),
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", s.lower())
    return re.sub(r"[^a-z]", "", s)


def ts_record(path: Path, const: str) -> dict[int, str]:
    text = path.read_text(encoding="utf-8")
    body = text.split(f"export const {const}", 1)[1]
    return {int(y): v for y, v in re.findall(r'\s(\d{4}): "([^"]*)"', body)}


def main() -> None:
    people_text = (HIST / "people.ts").read_text(encoding="utf-8").split("export const PEOPLE = `", 1)[1].split("`", 1)[0]
    people = [l.split("|") for l in people_text.split("\n")]
    name = lambda i: f"{people[i][0]} {people[i][1]}"  # noqa: E731

    fields_text = (HIST / "stats.ts").read_text(encoding="utf-8")
    fields = json.loads(re.search(r"STAT_FIELDS = (\[.*?\])", fields_text).group(1))
    official: dict[int, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for y, body in ts_record(HIST / "stats.ts", "STATS").items():
        for row in body.split("|"):
            c = row.split(",")
            if len(c) < 3:
                continue
            i = int(c[0], 36)
            for k, v in zip(fields, c[2:]):
                if v and v != "?":
                    official[y][i][k] += float(v)


    # Careers before 1966, from the archive's team-season pages (NFL 1920-65, AFL 1960-65; the
    # AAFC isn't in them). Players still active in 1966 are tied to their History person by the
    # archive's player id (data/history/pfa_ids.csv, written by ingest-history.py).
    pfa_ids = {pid: int(i) for pid, i in csv.reader(open(DATA / "pfa_ids.csv", encoding="utf-8"))}
    prior: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    retired: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    retired_name: dict[str, str] = {}
    COLS = {
        "PASSING": {"YDS": "passYds", "TD": "passTd"},
        "RUSHING": {"YDS": "rushYds", "TD": "rushTd"},
        "RECEIVING": {"REC": "rec", "NO": "rec", "YDS": "recYds", "TD": "recTd"},
        "INTERCEPTIONS": {"INT": "ints", "NO": "ints"},
    }
    for y in range(1920, 1966):
        f = DATA / "pfa" / f"{y}.csv"
        if not f.exists():
            continue
        head: dict[tuple[str, str], list[str]] = {}
        for code, title, pid, *cells in csv.reader(open(f, encoding="utf-8")):
            if title not in COLS:
                continue
            if not pid:
                if (code, title) not in head and cells and cells[0] == title:
                    head[(code, title)] = cells
                continue
            h = head.get((code, title))
            if not h:
                continue
            row = dict(zip(h, cells))
            for col, k in COLS[title].items():
                v = row.get(col, "").rstrip("t")
                try:
                    n = float(v) if v else 0.0
                except ValueError:
                    continue
                if pid in pfa_ids:
                    prior[pfa_ids[pid]][k] += n
                retired[pid][k] += n
                retired_name[pid] = cells[0]

    weeks: dict[int, dict[tuple[str, str, str], int]] = defaultdict(dict)
    for y, body in ts_record(GAME / "realSchedules.ts", "REAL_SCHEDULES").items():
        for g in body.split("|"):
            c = g.split(",")
            if len(c) >= 6:
                weeks[y][(c[1], c[2], c[5])] = int(c[0])

    events: list[list] = []
    season_rec = {k: [h, v, y, None] for k, (h, v, y) in SEASON_BEFORE.items()}  # holder, value, year, person
    career_tot: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for i, ln in prior.items():
        for k, v in ln.items():
            career_tot[i][k] += v
    career_rec: dict[str, list] = {}
    for k, *_ in CATS:
        if k == "sacks":
            continue
        best = max(((ln.get(k, 0), pid) for pid, ln in retired.items()), default=(0, None))
        if best[1] is None or best[0] <= 0:
            continue
        pid = best[1]
        i = pfa_ids.get(pid)
        holder = name(i) if i is not None else retired_name[pid]
        base = CAREER_BEFORE.get(k)
        if base and (base[0] != holder or base[1] != best[0]):
            print(f"  career {k} entering 1966: the archive says {holder} {best[0]:g}, the record book {base[0]} {base[1]}")
        if base and i is None:
            career_rec[k] = [base[0], base[1], None]  # the record book's number for a retired holder
        else:
            career_rec[k] = [holder, best[0], i]
    def fmt(v: float) -> str:
        return f"{v:g}" if v % 1 else f"{int(v):,}"

    career_rec_start.update({k: list(v) for k, v in career_rec.items()})
    for y in range(FIRST, LAST + 1):
        box_path = HIST / "box" / f"{y}.ts"
        running: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        by_week: dict[int, list] = defaultdict(list)
        if box_path.exists():
            raw = box_path.read_text(encoding="utf-8").split("export const BOX = `", 1)[1].rsplit("`;", 1)[0]
            raw = re.sub(r"\\(.)", r"\1", raw)  # undo the module's escapes (\\, \`, \${)
            for g in json.loads(raw):
                wk = weeks[y].get((g["h"], g["a"], g["d"])) or weeks[y].get((g["a"], g["h"], g["d"]))
                if wk:
                    by_week[wk].append(g)
        season_before = {k: list(v) for k, v in season_rec.items()}
        career_before = {k: list(v) for k, v in career_rec.items()}
        fired: set[tuple[str, str]] = set()
        # A box score can be missing a player's line (the archive's 2020 Saints-Buccaneers page
        # has no Drew Brees passing row). A record only falls in a given week when both players'
        # box-score sums match their official season lines; otherwise it's noted at season's end.
        boxsum: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for wk in by_week:
            for g in by_week[wk]:
                for _side, who, ln in g["p"]:
                    if isinstance(who, str) and who.startswith("#"):
                        for k, bk, _ in CATS:
                            if bk in ln:
                                boxsum[int(who[1:], 36)][k] += ln[bk]

        def sound(i: int | None, k: str) -> bool:
            if i is None:
                return True  # retired before this season: nothing to check
            off = official[y].get(i, {}).get(k, 0)
            got = boxsum.get(i, {}).get(k, 0)
            if not off and not got:
                return True
            return abs(got - off) <= max(2, 0.02 * off)

        for wk in sorted(by_week):
            for g in by_week[wk]:
                for _side, who, ln in g["p"]:
                    if not isinstance(who, str) or not who.startswith("#"):
                        continue
                    i = int(who[1:], 36)
                    for k, bk, _ in CATS:
                        if bk in ln:
                            running[i][k] += ln[bk]
            for k, _bk, _label in CATS:
                if k == "sacks" and y < SACKS_FROM:
                    continue
                lead = max(((running[i].get(k, 0), i) for i in running), default=(0, None))
                rec = season_rec.get(k)
                if lead[1] is not None and lead[0] > 0 and (rec is None or lead[0] > rec[1]):
                    i = lead[1]
                    # 1982, sacks' first official season, had no record to break.
                    if rec is not None and not (rec[2] == y and rec[3] == i) and not (k == "sacks" and y == SACKS_FROM) and sound(i, k) and (rec[2] != y or sound(rec[3], k)):
                        events.append([y, wk, k, "s", i, lead[0], rec[0], rec[1], rec[2]])
                        fired.add((k, "s"))
                    season_rec[k] = [name(i), lead[0], y, i]
                tot = lambda i: career_tot[i].get(k, 0) + running[i].get(k, 0)  # noqa: E731
                cand = max(((tot(i), i) for i in running), default=(0, None))
                crec = career_rec.get(k)
                if crec and crec[2] is not None:
                    crec[1] = max(crec[1], tot(crec[2]))
                if cand[1] is not None and cand[0] > 0 and (crec is None or cand[0] > crec[1]):
                    i = cand[1]
                    v_ok = cand[0] >= SACK_CAREER_FROM
                    if crec is not None and crec[2] != i and (k != "sacks" or v_ok) and sound(i, k) and sound(crec[2], k):
                        events.append([y, wk, k, "c", i, cand[0], crec[0], crec[1], 0])
                        fired.add((k, "c"))
                    career_rec[k] = [name(i), cand[0], i]
        # Season's end: the official lines replace the running totals.
        for i, ln in official[y].items():
            for k, *_ in CATS:
                if k == "sacks" and y < SACKS_FROM:
                    continue
                career_tot[i][k] += ln.get(k, 0)
        for k, _bk, _label in CATS:
            if k == "sacks" and y < SACKS_FROM:
                continue
            drop = lambda scope: [e for e in events if not (e[0] == y and e[2] == k and e[3] == scope)]  # noqa: E731
            lead = max(((official[y][i].get(k, 0), i) for i in official[y]), default=(0, None))
            before = season_before.get(k)
            if lead[1] is not None and lead[0] > 0 and (before is None or lead[0] > before[1]):
                if before is not None and (k, "s") not in fired:
                    # It fell without a box-score week to pin it to: note it at season's end.
                    events.append([y, 99, k, "s", lead[1], lead[0], before[0], before[1], before[2]])
                season_rec[k] = [name(lead[1]), lead[0], y, lead[1]]
                events.append([y, 99, k, "S", lead[1], lead[0], "", 0, 0])
            else:
                if (k, "s") in fired:
                    events[:] = drop("s")  # the box scores' sums ran a little high; the official line didn't break it
                season_rec[k] = before if before else season_rec.get(k)
            cand = max(((career_tot[i].get(k, 0), i) for i in career_tot), default=(0, None))
            cb = career_before.get(k)
            if cand[1] is None or cand[0] <= 0:
                continue
            if cb is None or cand[0] > cb[1] or cb[2] == cand[1]:
                v_ok = cand[0] >= SACK_CAREER_FROM
                if cb is not None and cb[2] != cand[1] and (k, "c") not in fired and (k != "sacks" or v_ok):
                    # The record passed is the old holder's number after this season, if he played it.
                    passed = career_tot[cb[2]].get(k, 0) if cb[2] is not None else cb[1]
                    events.append([y, 99, k, "c", cand[1], cand[0], cb[0], max(cb[1], passed), 0])
                career_rec[k] = [name(cand[1]), cand[0], cand[1]]
                events.append([y, 99, k, "C", cand[1], cand[0], "", 0, 0])
            else:
                if (k, "c") in fired:
                    events[:] = drop("c")
                career_rec[k] = cb

    # Silent season's-end rows ('S'/'C') keep the book right; only keep the ones that change it.
    out, last = [], {}
    for e in events:
        key = (e[2], e[3].lower())
        if e[3] in "SC":
            if last.get(key) == (e[4], e[5]):
                continue
        last[key] = (e[4], e[5])
        out.append(e)
    rows = []
    for y, wk, k, scope, i, v, ph, pv, py in out:
        rows.append(f"{y},{wk},{k},{scope},{i:x},{v:g},{ph},{pv:g},{py}".replace("|", "/"))
    OUT.write_text(
        "/** Auto-generated by scripts/ingest-record-moments.py. Do not hand-edit. */\n"
        "/**\n * When the all-time records fell: year,week (99 = season's end),stat,scope,person (hex),value,\n"
        " * previous holder,previous value,previous year. Scope s/c: a single-season / career record\n"
        " * fell that week; S/C (season's end): the official numbers settle the holder and value.\n */\n"
        f"export const RECORD_MOMENTS = {json.dumps('|'.join(rows))};\n"
        "/** Standing records entering 1966: stat -> holder, value, year (career: year 0). */\n"
        f"export const RECORDS_1966: Record<string, [string, number, number]> = {json.dumps({**{k + ':s': list(v) for k, v in SEASON_BEFORE.items()}, **{k + ':c': [h, v, 0] for k, (h, v) in CAREER_BEFORE.items()}, **{k + ':c': [r[0], r[1], 0] for k, r in career_rec_start.items()}})};\n",
        encoding="utf-8",
    )
    for y, wk, k, scope, i, v, ph, pv, py in out:
        if scope in "sc":
            print(f"{y} wk{wk:>2} {k:8} {'season' if scope == 's' else 'career'}: {name(i)} {fmt(v)} (was {ph} {fmt(pv)})")


career_rec_start: dict[str, list] = {}

if __name__ == "__main__":
    main()
