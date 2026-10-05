#!/usr/bin/env python3
"""Cache Pro Football Archives team-season pages, 1966-1998, for History mode.

Each page (e.g. https://www.profootballarchives.com/1975nflpit.html) carries the club's
player stats for that season: passing, rushing, receiving, interceptions, sacks, fumbles,
kicking, punting and returns. They fill what the other sources lack: 1966-69 offense, and
defense, kicking and returns before 1999.

Polite by design: one request at a time, a pause between them, and every page is cached
under data/history/pfa_html/ (not committed) so a re-run only fetches what's missing. The
stat tables are then extracted to data/history/pfa/YYYY.csv (committed), which is what
scripts/ingest-history.py reads.

Run: python3 scripts/fetch-pfa.py [first_year] [last_year]
"""
from __future__ import annotations

import csv
import html as htmllib
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "history" / "pfa_html"
TABLES = ROOT / "data" / "history" / "pfa"
BASE = "https://www.profootballarchives.com/"
UA = "NFL-Rewind-history-ingest/1.0 (one request at a time; cached)"
PAUSE = 1.5
SKIP = {"draft", "awards", "allpro", "probowl", "leaders", "standings", "playoffs", "stats", "coaches"}


def get(name: str) -> str | None:
    path = OUT / name
    if path.exists() and path.stat().st_size > 1000:
        return path.read_text(encoding="latin-1")
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("latin-1")
            path.write_text(body, encoding="latin-1")
            time.sleep(PAUSE)
            return body
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            print(f"  {name}: {e}; retry {attempt + 1}", flush=True)
            time.sleep(PAUSE * (2 ** (attempt + 1)))
        except Exception as e:  # noqa: BLE001 - network hiccups: back off and retry
            print(f"  {name}: {e}; retry {attempt + 1}", flush=True)
            time.sleep(PAUSE * (2 ** (attempt + 1)))
    return None


def main() -> None:
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 1966
    last = int(sys.argv[2]) if len(sys.argv) > 2 else 1998
    OUT.mkdir(parents=True, exist_ok=True)
    for y in range(first, last + 1):
        for lg in ["nfl", "afl"] if y <= 1969 else ["nfl"]:
            index = get(f"{y}{lg}.html")
            if not index:
                print(f"{y} {lg}: no index page", flush=True)
                continue
            teams = sorted({m for m in re.findall(rf'href="/?({y}{lg}([a-z]+)\.html)"', index) if m[1] not in SKIP and "draft" not in m[1]})
            got = sum(1 for name, _ in teams if get(name))
            print(f"{y} {lg}: {got}/{len(teams)} team pages", flush=True)


def extract(first: int, last: int) -> None:
    """Every stat table on each cached team page, one CSV per season:
    page code, table title, player id ('' for headers and totals), then the cells."""
    TABLES.mkdir(parents=True, exist_ok=True)
    for y in range(first, last + 1):
        rows = []
        for f in sorted(OUT.glob(f"{y}[na]fl?*.html")):
            code = f.stem[len(str(y)):]
            page = f.read_text(encoding="latin-1")
            for t in re.findall(r"<table.*?</table>", page, re.S):
                trs = re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S)
                cells = [[htmllib.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)] for tr in trs]
                if not cells or not cells[0] or not cells[0][0].isupper():
                    continue
                title = cells[0][0]
                if title in ("SCORES", "TEAM STATS", "SCORING BY QUARTERS", "DRAFT LIST"):
                    continue
                if len(cells[0]) == 1:
                    # A title row of its own (the roster): the column headers are the next row.
                    trs, cells = trs[1:], cells[1:]
                    if not cells or len(cells[0]) < 2:
                        continue
                for tr, c in zip(trs, cells):
                    m = re.search(r'href="/players/[a-z]/([a-z0-9]+)\.html"', tr)
                    rows.append([code, title, m.group(1) if m else ""] + c)
        if rows:
            with open(TABLES / f"{y}.csv", "w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerows(rows)
            print(f"{y}: {len(rows)} table rows", flush=True)


if __name__ == "__main__":
    main()
    extract(int(sys.argv[1]) if len(sys.argv) > 1 else 1966, int(sys.argv[2]) if len(sys.argv) > 2 else 1998)
