"""
Fetch each season's All-Pro team and Pro Bowl rosters from Wikipedia (wikitext), politely:
one request at a time, honoring Retry-After on a 429, with a pause between pages.
Writes data/honors/<page>.wiki. Pages already fetched are skipped.
"""
from __future__ import annotations

import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "honors"
UA = "nfl-rewind-headshots/1.0 (offline data build)"
RAW = "https://en.wikipedia.org/w/index.php"
PAUSE = 3


def pages(y: int) -> list[list[str]]:
    """Each entry: alternative titles for one page, first found wins."""
    out = [[f"{y} All-Pro Team"]]
    nxt = y + 1
    out.append([f"{nxt} Pro Bowl Games", f"{nxt} Pro Bowl"] if nxt >= 2023 else [f"{nxt} Pro Bowl"])
    if y <= 1969:
        out.append([f"{nxt} American Football League All-Star Game", f"{y} American Football League All-Star Game"])
    return out


def get(title: str) -> str | None:
    """A page's wikitext (index.php?action=raw), following its redirect if it is one."""
    for _hop in range(3):
        q = urllib.parse.urlencode({"title": title.replace(" ", "_"), "action": "raw"})
        text = None
        for _ in range(8):
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{RAW}?{q}", headers={"User-Agent": UA}), timeout=60) as r:
                    text = r.read().decode("utf-8")
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                if e.code == 429:
                    time.sleep(int(e.headers.get("Retry-After") or 30) + 1)
                    continue
                raise
        if text is None:
            return None
        m = re.match(r"\s*#REDIRECT\s*\[\[([^\]|#]+)", text, re.I)
        if not m:
            return text
        title = m.group(1)
        time.sleep(PAUSE)
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    first, last = int(sys.argv[1]), int(sys.argv[2])
    for y in range(first, last + 1):
        for alts in pages(y):
            name = f"{y}-" + ("allpro" if "All-Pro" in alts[0] else "afl" if "American" in alts[0] else "probowl")
            path = OUT / f"{name}.wiki"
            if path.exists():
                continue
            text = None
            for t in alts:
                text = get(t)
                time.sleep(PAUSE)
                if text:
                    break
            path.write_text(text or "")
            print(y, name, len(text or ""), flush=True)


if __name__ == "__main__":
    main()
