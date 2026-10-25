#!/usr/bin/env python3
"""Cache Pro Football Archives game box scores, 1966-2025, for History mode.

Each page (e.g. https://www.profootballarchives.com/nflboxscores1/1975nfl005.html) is one
game: date, venue, attendance, weather, score by quarter, every scoring play, the starting
lineups, team stats and every player's line. 1966-1998 games are the ones the cached
team-season pages link to (data/history/pfa_box_links.txt, built from the cached pages;
the latest season, whose regular-season games the team pages don't link yet, is listed by
number). Preseason pages that come along are dropped by the ingest.

Polite by design, like fetch-pfa.py: one request at a time with a pause, every page cached
(gzipped) under data/history/pfa_box/ (not committed), so a re-run only fetches what's
missing. scripts/ingest-boxscores.py turns the cache into the game's tables.

Run: python3 scripts/fetch-pfa-box.py [first_year] [last_year]
"""
from __future__ import annotations

import gzip
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "history" / "pfa_box"
LINKS = ROOT / "data" / "history" / "pfa_box_links.txt"
BASE = "https://www.profootballarchives.com/"
UA = "NFL-Rewind-history-ingest/1.0 (one request at a time; cached)"
PAUSE = 1.2


def get(name: str) -> bool | None:
    """True if cached (or fetched), False on a 404, None if the network kept failing."""
    path = OUT / (name.split("/")[-1] + ".gz")
    if path.exists() and path.stat().st_size > 500:
        return True
    for attempt in range(5):
        try:
            req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            path.write_bytes(gzip.compress(body))
            time.sleep(PAUSE)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                time.sleep(PAUSE)
                return False
            print(f"  {name}: {e}; retry {attempt + 1}", flush=True)
        except Exception as e:  # noqa: BLE001 - network hiccups: back off and retry
            print(f"  {name}: {e}; retry {attempt + 1}", flush=True)
        time.sleep(PAUSE * (2 ** (attempt + 1)))
    return None


def main() -> None:
    first = int(sys.argv[1]) if len(sys.argv) > 1 else 1966
    last = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
    OUT.mkdir(parents=True, exist_ok=True)
    known = [l.strip() for l in LINKS.read_text().splitlines() if l.strip()]
    for year in range(first, last + 1):
        got = 0
        for name in (n for n in known if n.split("/")[-1].startswith(str(year))):
            got += bool(get(name))
        print(f"{year}: {got} games", flush=True)


if __name__ == "__main__":
    main()
