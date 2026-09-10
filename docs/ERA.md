# Era rules

Season length, conferences, playoff brackets, and stat shape by year. Helpers: `src/lib/game/teams.ts`, `src/lib/game/era.ts`, `src/lib/game/playoffs.ts`.

## Season length — `gamesInSeason(year)`

| Years | Games | Notes |
|-------|------:|-------|
| 1966–1977 | 14 | AFL and NFL both 14 in 1966–69 |
| 1978–1981 | 16 | |
| 1982 | 9 | Strike. 16-team Super Bowl tournament historically; we still run conference playoffs + SB |
| 1983–1986 | 16 | |
| 1987 | 15 | Strike; three replacement weeks folded into 15 counting games |
| 1988–2020 | 16 | |
| 2021–2027 | 17 | |

A 14-game *season* may span 14–15 calendar weeks because odd-sized leagues need byes (1966 NFL has 15 clubs). QA asserts **14 scheduled games per club**, not “exactly 14 calendar rows.”

## Conferences and divisions

### 1966 (24 clubs)

Conferences are **NFL** and **AFL**. UI must not say AFC/NFC.

- **NFL East:** atl, cle, crd, dal, nyg, phi, pit, was
- **NFL West:** chi, clt, det, gnb, min, ram, sfo
- **AFL East:** buf, mia, nwe, nyj, oti
- **AFL West:** den, kan, rai, sdg

Atlanta already exists in 1966 (Eastern). Boston Patriots, Houston Oilers, Baltimore Colts, St. Louis Cardinals, Oakland Raiders, San Diego Chargers, Los Angeles Rams.

### 1967–1969 NFL four-division split (16 NFL after Saints)

- **Capitol:** dal, nyg, phi, was
- **Century:** cle, crd, nor, pit
- **Coastal:** atl, clt, ram, sfo
- **Central:** chi, det, gnb, min

AFL 1967 still 9. 1968 Bengals join AFL West (10 AFL clubs).

- **AFL East:** buf, mia, nwe, nyj, oti
- **AFL West:** cin (1968+), den, kan, rai, sdg

1969 AFL added a first-round playoff (four teams). NFL 1967–69: four division winners → two conference championships → NFL Championship → Super Bowl.

### 1970 merger

AFL + NFL become **AFC / NFC**. Colts, Browns, and Steelers move to the AFC. 26 clubs.

**AFC East:** buf, clt, mia, nwe, nyj  
**AFC Central:** cin, cle, oti, pit  
**AFC West:** den, kan, rai, sdg  

**NFC East:** crd, dal, nyg, phi, was  
**NFC Central:** chi, det, gnb, min  
**NFC West:** atl, nor, ram, sfo  

### 1976–1977 expansion placement

- 1976: tam in AFC West, sea in NFC West (30 clubs).
- 1977+: tam in NFC Central, sea in AFC West.

### 1995–2001

- 1995: car NFC West, jax AFC Central (30).
- 1996: rav AFC Central; **cle inactive**.
- 1999: cle returns, AFC Central (31).
- 2002: htx, 32 clubs, eight divisions of four. **sea → NFC West.**

2002+ divisions:

- AFC East: buf, mia, nwe, nyj
- AFC North: rav, cin, cle, pit
- AFC South: htx, clt, jax, oti
- AFC West: den, kan, rai, sdg
- NFC East: dal, nyg, phi, was
- NFC North: chi, det, gnb, min
- NFC South: atl, car, nor, tam
- NFC West: crd, ram, sfo, sea

## Playoff formats

| Years | Field | Shape |
|-------|------:|-------|
| 1966 | 2 + 2 + SB | NFL East vs West; AFL East vs West; winners in Super Bowl I |
| 1967–1968 | NFL 4 + AFL 2 + SB | NFL division winners, AFL championship, Super Bowl |
| 1969 | NFL 4 + AFL 4 + SB | AFL adds first round |
| 1970–1977 | 8 | Division winners only (4 per conference), divisional + conference + SB |
| 1978–1989 | 10 | 5 per conference (1 wild card) |
| 1990–2019 | 12 | 6 per conference (3 wild cards from 2002; 2 before with 3 divisions) |
| 2020–2027 | 14 | 7 per conference, 1 bye |

Seeds are record-based with division-winner priority. Ties: H2H → division record → conference record → point differential.

## Super Bowl sites (era-correct)

Numbered from the 1966 season = Super Bowl I. Full table in `src/lib/game/data/bowlSites.ts`.

| SB | Season | Site |
|----|--------|------|
| I | 1966 | Los Angeles Memorial Coliseum |
| II | 1967 | Miami Orange Bowl |
| III | 1968 | Miami Orange Bowl |
| IV | 1969 | Tulane Stadium, New Orleans |
| V | 1970 | Miami Orange Bowl |
| VI | 1971 | Tulane Stadium |
| VII | 1972 | Los Angeles Memorial Coliseum |
| VIII | 1973 | Rice Stadium, Houston |
| IX | 1974 | Tulane Stadium |
| X | 1975 | Miami Orange Bowl |
| XI | 1976 | Rose Bowl, Pasadena |
| XII | 1977 | Louisiana Superdome |
| XIII | 1978 | Miami Orange Bowl |
| XIV | 1979 | Rose Bowl |

Later sites rotate Rose Bowl, Superdome, Pasadena, Miami, Pontiac, Tampa, San Diego, Minneapolis, Atlanta, etc.

## Pro Bowl sites

- 1966–1969 NFL: Los Angeles Memorial Coliseum. AFL All-Star Game: various (1966 Houston / 1967–69 Oakland / Miami).
- 1970–1979: various (Los Angeles, Texas Stadium, etc.).
- 1980–2009: Honolulu / Aloha Stadium.
- 2010: Miami. 2011–2014, 2016: Hawaii. 2015+: Camping World / later venues; we use Orlando then Las Vegas.

Pre-1970 the UI labels the two squads **NFL** and **AFL**, not NFC/AFC.

## Stat era caps

The sim builds **team** passing/rushing volume from an era profile, then distributes to players. After distribution, clamps fire so a 1966 TE cannot finish with 111 catches.

| Era | Cmp% | Pass att/g | Y/A | INT rate | Team sacks allowed/g | Rush att/g | TE rec season cap | Rush TD cap | Ind. sack cap |
|-----|------:|-----------:|----:|---------:|---------------------:|-----------:|------------------:|------------:|--------------:|
| 1966–69 | ~51 | 28 | 6.8 | 5.5% | 2.0 | 35 | 55 | 16 | 18 |
| 1970–77 | 52 | 30 | 6.7 | 5.0% | 2.2 | 34 | 60 | 16 | 20 |
| 1978–89 | 54 | 32 | 6.9 | 4.2% | 2.5 | 32 | 70 | 18 | 22 |
| 1990–99 | 57 | 33 | 6.9 | 3.4% | 2.4 | 29 | 80 | 18 | 20 |
| 2000–09 | 60 | 33 | 7.0 | 3.0% | 2.3 | 28 | 90 | 20 | 20 |
| 2010–19 | 63 | 35 | 7.2 | 2.5% | 2.3 | 27 | 100 | 20 | 20 |
| 2020+ | 65 | 35 | 7.2 | 2.3% | 2.4 | 27 | 110 | 20 | 19 |

Forbidden 1966 shapes: 40 sacks, 17 INTs by one QB as a *typical* output, 28 rush TDs, 111-catch TEs. Star QBs may still lead the league with ~20–30 INT in the 1960s because that is historically real (Namath, Hadl). Do not *also* give them 5,000 yards.

## Identity moves (not expansions)

See `docs/EXPANSIONS.md` and `locationOf` / `nicknameOf`:

- 1971 nwe Boston → New England
- 1982 rai Oakland → Los Angeles; 1995 back to Oakland; 2020 Las Vegas
- 1984 clt Baltimore → Indianapolis
- 1988 crd St. Louis → Phoenix; 1994 Arizona
- 1995 ram Los Angeles → St. Louis; 2016 back to Los Angeles
- 1997 oti Houston Oilers → Tennessee Oilers; 1999 Titans
- 2017 sdg San Diego → Los Angeles
- 2020–22 was nickname Football Team then Commanders

## Week labels

`weekLabel(save)` must match `phase`. Never render “Playoffs” during Pro Bowl, awards, draft, or retirement.
