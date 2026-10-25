#!/usr/bin/env python3
"""
Add a season's real rosters to the record without re-running the whole ingest; then run
build-headshots.py for the portraits.

  python3 scripts/append-season.py <dir with roster_YYYY.csv> <season>

Uses ingest-history.py's own rules (club codes, positions, who counts as on a roster) and its
person key (name + birth date), so a man already in the record keeps his id. Rewrites:
  src/lib/game/data/history/people.ts    new people appended (ids are line numbers, so stable)
  src/lib/game/data/history/rosters.ts   the season's line, replaced if it was there
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "lib" / "game" / "data" / "history"
src = (ROOT / "scripts" / "ingest-history.py").read_text()
ing: dict = {"__file__": str(ROOT / "scripts" / "ingest-history.py")}
# Only the helpers: stop before the ingest's own loading runs.
exec(compile(src.split("# ---------- rosters ----------")[0], "ingest-history.py", "exec"), ing)
norm, pos_of, team_of = ing["norm"], ing["pos_of"], ing["team_of"]

src_dir, season = Path(sys.argv[1]), int(sys.argv[2])

people_ts = (OUT / "people.ts").read_text()
head, body = people_ts.split("export const PEOPLE = `", 1)
lines, tail = body.split("`", 1)
rows = lines.split("\n")
key_of: dict[str, int] = {}
for i, line in enumerate(rows):
    f = line.split("|")
    if len(f) >= 4 and f[3]:
        key_of.setdefault(f"{norm(f[0] + f[1])}|{f[3]}", i)


def name_of(r: dict) -> tuple[str, str]:
    full = (r["full_name"] or "").strip()
    last = (r["last_name"] or "").strip() or full.split(" ")[-1]
    first = full.split(last)[0].strip() if last in full and full.index(last) > 0 else (r["first_name"] or "").strip()
    return first, last


def person_for(r: dict) -> int | None:
    first, last = name_of(r)
    birth = (r["birth_date"] or "").replace("-", "")
    if not first or not last or not birth:
        return None
    k = f"{norm(first + last)}|{birth}"
    if k not in key_of:
        college = (r["college"] or "").strip().split(";")[0].strip()
        rows.append("|".join([first, last, pos_of(r["position"], r["depth_chart_position"]), birth, college]).rstrip("|"))
        key_of[k] = len(rows) - 1
    return key_of[k]


def b36(n: int) -> str:
    s = ""
    while True:
        n, r = divmod(n, 36)
        s = "0123456789abcdefghijklmnopqrstuvwxyz"[r] + s
        if not n:
            return s


KEEP = {"ACT", "RES", "INA", "PUP", "SUS", "NWT", "TRC", "TRD", "TRT", "TRL", "EXE", "", "RSN"}
by_team: dict[str, list[str]] = {}
seen: set[tuple[int, str]] = set()
for r in csv.DictReader(open(src_dir / f"roster_{season}.csv", encoding="utf-8")):
    if (r["status"] or "") not in KEEP:
        continue
    t = team_of(r["team"], season)
    i = person_for(r) if t else None
    if i is None or (i, t) in seen:
        continue
    seen.add((i, t))
    try:
        n = int(float(r["jersey_number"] or 0))
    except ValueError:
        n = 0
    by_team.setdefault(t, []).append(b36(i) + (f".{n}" if n else ""))

(OUT / "people.ts").write_text(head + "export const PEOPLE = `" + "\n".join(rows) + "`" + tail)
rosters_ts = (OUT / "rosters.ts").read_text()
rosters_ts = re.sub(rf'^  {season}: ".*",\n', "", rosters_ts, flags=re.M)
line = f'  {season}: "' + ";".join(f"{t}:{','.join(ids)}" for t, ids in sorted(by_team.items())) + '",\n'
rosters_ts = re.sub(r"\n};\s*$", "\n" + line + "};\n", rosters_ts)
(OUT / "rosters.ts").write_text(rosters_ts)
print(f"{season}: {sum(len(v) for v in by_team.values())} roster spots on {len(by_team)} clubs; people {len(rows)}")
