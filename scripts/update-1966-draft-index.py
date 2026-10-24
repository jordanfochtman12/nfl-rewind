#!/usr/bin/env python3
"""Replace the duplicated 1966 AFL draft index without renumbering history people."""
from __future__ import annotations

import html
import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "drafts" / "pfa" / "1966_afl_draft.html"
PEOPLE_FILE = ROOT / "src" / "lib" / "game" / "data" / "history" / "people.ts"
DRAFTS_FILE = ROOT / "src" / "lib" / "game" / "data" / "history" / "drafts.ts"

spec = importlib.util.spec_from_file_location("history_ingest", ROOT / "scripts" / "ingest-history.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load the shared historical team and position mappings")
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)


def base36(value: str) -> int:
    return int(value, 36)


def decode_people(source: str) -> list[list[str]]:
    match = re.search(r"export const PEOPLE = `([\s\S]*?)`;\s*$", source)
    if not match:
        raise ValueError("Could not read the stable historical people index")
    return [line.split("|") for line in match.group(1).splitlines()]


def encode36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while value:
        value, digit = divmod(value, 36)
        out = digits[digit] + out
    return out or "0"


def parse_afl_source() -> list[tuple[int, int, str, str, str, str]]:
    source = SOURCE.read_text(encoding="utf-8", errors="replace")
    tables = re.findall(r"<table\b.*?</table>", source, re.S | re.I)
    table = next((x for x in tables if all(h in x.lower() for h in (">round<", ">overall<", ">player<", ">college<"))), None)
    if table is None:
        raise ValueError("The 1966 AFL source has no standard-draft table")

    def clean(cell: str) -> str:
        return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", cell))).replace("*", "").replace("+", "").strip()

    picks = []
    for row in re.findall(r"<tr\b.*?</tr>", table, re.S | re.I):
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row, re.S | re.I)
        if len(cells) < 6:
            continue
        round_match = re.match(r"\s*(\d+)", clean(cells[0]))
        overall = clean(cells[1])
        if not round_match or not overall.isdigit():
            continue
        team_match = re.search(r"href=[\"']/?1966afl([a-z]{2,3})\.html", cells[2], re.I)
        if not team_match:
            raise ValueError(f"Pick {overall} has an unrecognized team link")
        team = ingest.team_of(team_match.group(1), 1966)
        name = clean(cells[3])
        if not team or not name:
            raise ValueError(f"Pick {overall} has no known team or player")
        picks.append((int(round_match.group(1)), int(overall), team, name, ingest.pos_of(clean(cells[4])), clean(cells[5])))

    by_pick = {pick[1] for pick in picks}
    if len(picks) != 181 or by_pick != set(range(1, 182)):
        raise ValueError(f"Expected 181 unique AFL selections numbered 1-181; parsed {len(picks)}")
    if picks[0][3:4] != ("Jim Grabowski",) or picks[0][2] != "mia":
        raise ValueError("The AFL board must begin with Jim Grabowski to Miami")
    if next(p for p in picks if p[1] == 105)[:2] != (12, 105):
        raise ValueError("The round-12C extra selection at overall 105 is missing")
    return picks


def main() -> None:
    people_source = PEOPLE_FILE.read_text(encoding="utf-8")
    draft_source = DRAFTS_FILE.read_text(encoding="utf-8")
    people = decode_people(people_source)
    old_people_count = len(people)
    line = re.search(r'^  1966: "([^\"]*)",$', draft_source, re.M)
    if not line:
        raise ValueError("Could not read the existing 1966 draft record")
    old_rows = []
    for row in line.group(1).split("|"):
        rnd, pick, team, person, league = row.split(",")
        old_rows.append((int(rnd), int(pick), team, base36(person), league))
    nfl_rows = [row for row in old_rows if row[4] == "nfl"]
    if len(nfl_rows) != 305 or {row[1] for row in nfl_rows} != set(range(1, 306)):
        raise ValueError("Existing NFL selections are not a complete, unique 1966 board")

    by_name: dict[str, list[int]] = {}
    for index, entry in enumerate(people):
        by_name.setdefault(ingest.norm(" ".join(entry[:2])), []).append(index)
    nfl_by_name: dict[str, list[int]] = {}
    for _, _, _, index, _ in nfl_rows:
        entry = people[index]
        nfl_by_name.setdefault(ingest.norm(" ".join(entry[:2])), []).append(index)

    def person_for(name: str, college: str) -> int:
        key = ingest.norm(name)
        nfl_matches = sorted(set(nfl_by_name.get(key, [])))
        if len(nfl_matches) == 1:
            return nfl_matches[0]
        if len(nfl_matches) > 1:
            raise ValueError(f"AFL pick {name} has multiple 1966 NFL identities")

        matches = by_name.get(key, [])
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            college_key = ingest.norm(college)
            exact = [i for i in matches if len(people[i]) > 4 and ingest.norm(people[i][4]) == college_key]
            if len(exact) == 1:
                return exact[0]
            raise ValueError(f"AFL pick {name} is ambiguous in the existing people index")

        first, _, last = name.partition(" ")
        index = len(people)
        people.append([first, last, "", "", ""])
        # Use the shared source position conversion for unmatched draft prospects.
        picks_by_name = {ingest.norm(p[3]): p for p in afl_picks}
        source_pick = picks_by_name[key]
        people[index] = [first, last, source_pick[4], "", college]
        by_name[key] = [index]
        return index

    afl_picks = parse_afl_source()
    afl_rows = [(rnd, overall, team, person_for(name, college), "afl") for rnd, overall, team, name, _, college in afl_picks]
    rows = sorted(nfl_rows + afl_rows, key=lambda x: (x[4], x[0], x[1]))
    payload = "|".join(f"{rnd},{pick},{team},{encode36(person)},{league}" for rnd, pick, team, person, league in rows)
    draft_source = draft_source[: line.start(1)] + payload + draft_source[line.end(1) :]
    if len(people) != old_people_count:
        person_block = "\n".join("|".join(entry) for entry in people)
        people_source = re.sub(r"(?<=export const PEOPLE = `)[\s\S]*?(?=`;\s*$)", person_block, people_source)

    PEOPLE_FILE.write_text(people_source, encoding="utf-8")
    DRAFTS_FILE.write_text(draft_source, encoding="utf-8")
    print(f"Wrote 1966 draft boards: {len(nfl_rows)} NFL + {len(afl_rows)} AFL; appended {len(people) - old_people_count} AFL-only prospects without renumbering existing people.")


if __name__ == "__main__":
    main()
