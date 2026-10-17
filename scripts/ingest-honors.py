"""
Each season's honors from Wikipedia (fetched by scripts/fetch-honors.py into data/honors/):
first- and second-team All-Pro and the Pro Bowl (AFL All-Star Game before the merger), matched
to the record's people by name and the club he was on that season.

Writes src/lib/game/data/history/honors.ts:
  HONORS[season] = "person.code,..."  code: 1 first-team All-Pro, 2 second-team, p Pro Bowl
"""
from __future__ import annotations

import importlib.util
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "honors"
GEN = ROOT / "src" / "lib" / "game" / "data" / "history"

spec = importlib.util.spec_from_file_location("ingest_history", ROOT / "scripts" / "ingest-history.py")
hist = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hist)
norm = hist.norm

people = [l.split("|") for l in re.search(r"PEOPLE = `(.*?)`", (GEN / "people.ts").read_text(), re.S).group(1).split("\n")]
ROSTERS = dict(re.findall(r'^  (\d{4}): "([^"]*)"', (GEN / "rosters.ts").read_text(), re.M))

# Club names on the pages, by the last word or two, to the engine's ids.
CLUB = {
    "falcons": "atl", "bills": "buf", "bears": "chi", "bengals": "cin", "browns": "cle", "colts": "clt", "cardinals": "crd",
    "cowboys": "dal", "broncos": "den", "lions": "det", "packers": "gnb", "oilers": "oti", "titans": "oti", "texans": "htx",
    "jaguars": "jax", "chiefs": "kan", "rams": "ram", "chargers": "sdg", "raiders": "rai", "dolphins": "mia", "vikings": "min",
    "patriots": "nwe", "saints": "nor", "giants": "nyg", "jets": "nyj", "eagles": "phi", "steelers": "pit", "seahawks": "sea",
    "49ers": "sfo", "forty-niners": "sfo", "buccaneers": "tam", "redskins": "was", "commanders": "was", "football team": "was",
    "ravens": "rav", "panthers": "car",
}
CITY = {
    "atlanta": "atl", "buffalo": "buf", "chicago": "chi", "cincinnati": "cin", "cleveland": "cle", "dallas": "dal", "denver": "den",
    "detroit": "det", "green bay": "gnb", "jacksonville": "jax", "kansas city": "kan", "miami": "mia", "minnesota": "min",
    "new england": "nwe", "boston": "nwe", "new orleans": "nor", "philadelphia": "phi", "pittsburgh": "pit", "seattle": "sea",
    "san francisco": "sfo", "tampa bay": "tam", "washington": "was", "carolina": "car", "tennessee": "oti", "arizona": "crd",
    "phoenix": "crd", "san diego": "sdg", "oakland": "rai", "las vegas": "rai", "houston": None, "baltimore": None,
    "indianapolis": "clt", "st. louis": None, "los angeles": None, "new york": None,
}


def club_of(text: str) -> str | None:
    t = text.lower()
    for k, v in CLUB.items():
        if k in t:
            return v
    for k, v in CITY.items():
        if t.strip().startswith(k):
            return v
    return None


def roster(y: int) -> dict[int, set[str]]:
    on: dict[int, set[str]] = defaultdict(set)
    for chunk in ROSTERS.get(str(y), "").split(";"):
        if not chunk:
            continue
        team, lst = chunk.split(":")
        for e in lst.split(","):
            if e:
                on[int(e.split(".")[0], 36)].add(team)
    return on


LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def entries(cell: str):
    """Each player named in a table cell: (name, club text after him, set in bold)."""
    for part in re.split(r"<br\s*/?>|<BR>|\n", cell, flags=re.I):
        bold = "\'\'\'" in part.split(",")[0]
        m = LINK.search(part)
        if m:
            name = (m.group(2) or re.sub(r"\s*\(.*?\)\s*$", "", m.group(1))).strip()
            rest = part[m.end():]
        else:
            # Unlinked: "Jonathan Ogden, Baltimore Ravens (AP-2)"
            bare = re.sub(r"\{\{[^}]*\}\}", "", part).strip(" |")
            if "," not in bare:
                continue
            name, rest = bare.split(",", 1)
            name = name.strip()
        if not name or len(name.split()) < 2 or len(name) > 40:
            continue
        yield name, rest, bold


def match(name: str, club: str | None, on: dict[int, set[str]], by_name: dict[str, list[int]]) -> int | None:
    hits = [i for i in by_name.get(norm(name), []) if i in on]
    if club:
        here = [i for i in hits if club in on[i]]
        if len(here) == 1:
            return here[0]
    return hits[0] if len(hits) == 1 else None


def main() -> None:
    by_name: dict[str, list[int]] = defaultdict(list)
    for i, p in enumerate(people):
        by_name[norm(p[0] + p[1])].append(i)
    out: dict[int, dict[int, str]] = {}
    unmatched: dict[int, list[str]] = defaultdict(list)
    for y in range(1966, 2026):
        on = roster(y)
        got: dict[int, str] = {}
        rank = {"1": 3, "2": 2, "p": 1}

        def add(name: str, rest: str, code: str) -> None:
            i = match(name, club_of(rest), on, by_name)
            if i is None:
                unmatched[y].append(name)
                return
            if rank[code] > rank.get(got.get(i, ""), 0):
                got[i] = code

        ap = (SRC / f"{y}-allpro.wiki")
        if ap.exists():
            text = ap.read_text()
            # Table rows: | position || first team || second team
            for row in re.split(r"\n\|-", text):
                cells = [c for c in re.split(r"\n\|(?!-)|\|\|", row) if c.strip()]
                cells = [c for c in cells if not c.strip().startswith(("!", "{|", "|}"))]
                if len(cells) < 2:
                    continue
                # One list per position (the 1960s-70s pages): AP's first team is in bold.
                if len(cells) == 2:
                    # The rest are the other papers' picks: Pro Bowl company, not AP's second team.
                    for name, rest, bold in entries(cells[1]):
                        add(name, rest, "1" if bold else "p")
                    continue
                for col, code in ((1, "1"), (2, "2")):
                    if col < len(cells):
                        for name, rest, _bold in entries(cells[col]):
                            # The first-team column also lists other selectors' picks: AP's is the one.
                            sel = re.search(r"\(([^)]*)\)", rest)
                            if code == "1" and sel and "AP" not in sel.group(1):
                                code_here = "2"
                            elif code == "2" and sel and "AP" not in sel.group(1):
                                # Another paper's second team: Pro Bowl company.
                                code_here = "p"
                            else:
                                code_here = code
                            add(name, rest, code_here)
        for kind in ("probowl", "afl"):
            pb = SRC / f"{y}-{kind}.wiki"
            if not pb.exists():
                continue
            text = pb.read_text()
            # The rosters, not the scoring summary or the coaches.
            parts = re.split(r"\n==+[^=\n]*roster[^=\n]*==+", text, flags=re.I)
            body = "\n".join(re.split(r"\n==[^=]", part)[0] for part in parts[1:])
            for line in body.split("\n"):
                if not line.startswith("|") or line.startswith(("|-", "|}")):
                    continue
                for name, rest, _bold in entries(line.lstrip("|")):
                    add(name, rest, "p")
        out[y] = got

    def b36(n: int) -> str:
        s = ""
        while True:
            n, d = divmod(n, 36)
            s = "0123456789abcdefghijklmnopqrstuvwxyz"[d] + s
            if not n:
                return s

    lines = [
        "/** Auto-generated by scripts/ingest-honors.py from Wikipedia's All-Pro and Pro Bowl pages. Do not hand-edit. */",
        "/** Per season: person.code,... (1 first-team All-Pro, 2 second-team, p Pro Bowl; person ids in base 36). */",
        "export const HONORS: Record<number, string> = {",
    ]
    for y, got in sorted(out.items()):
        lines.append(f'  {y}: "' + ",".join(f"{b36(i)}.{c}" for i, c in sorted(got.items())) + '",')
    lines.append("};")
    (GEN / "honors.ts").write_text("\n".join(lines) + "\n")
    for y, got in sorted(out.items()):
        c = defaultdict(int)
        for v in got.values():
            c[v] += 1
        print(y, dict(c), "unmatched", len(unmatched[y]), unmatched[y][:6])


if __name__ == "__main__":
    main()
