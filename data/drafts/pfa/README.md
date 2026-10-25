The 1966 AFL standard draft input was captured from Pro Football Archives:
https://www.profootballarchives.com/drafts/1966afldraft.html

`1966_afl_draft.html` includes both the standard AFL draft table and the
separate redshirt selections table. The history importer reads only the first
standard board; the redshirt event is separate from the NFL/AFL standard draft
records and is not represented as a third board in the current history model.
The `scripts/update-1966-draft-index.py` updater validates all 181 standard
overall pick numbers (1-181), including the source's round 12C selection at
overall pick 105. It preserves the existing people IDs and appends only
AFL-only prospects. The full history ingester also reads this source, but it
refuses to rewrite generated tables when the archived PFA team pages needed for
the older coach index are absent. The Pro Football Hall of
Fame's 1966 NFL draft page independently confirms Tommy Nobis as the NFL's first
pick and identifies the redshirt draft separately:
https://www.profootballhof.com/football-history/nfl-draft-history/1960/1966
