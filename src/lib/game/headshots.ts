/**
 * Real players' portraits (data/history/headshots.ts), loaded on first use: the studio
 * headshot a broadcast shows where there is one, then the league's photo, then a freely
 * licensed Wikimedia Commons photo or his Wikipedia article's free lead photo. A
 * record player is found by his id. One the draft room or a classic start made is found by
 * name, but only when exactly one photographed man of that name was born within two years of
 * him, so a 1970s namesake never wears a 2020 face.
 */
import type { Player } from "./types.ts";

let byId: Map<string, string> | undefined;
let byName: Map<string, { born: number; key: string }[]> | undefined;
let loading: Promise<void> | undefined;

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");

/**
 * Record players whose league photo is someone else, found by looking at every league photo the
 * game shows (person id, base 36). They wear the helmet stand-in until a right one turns up.
 */
const WRONG_PHOTO = new Set([
  "a2y", // Cedrick Wilson (WR, 2001-07): a 1970s 49ers #86
  "7v6", // Ernest Jones (LB, 1994-99): the Rams linebacker of the same name, 2021-
]);

export function loadHeadshots(): Promise<void> {
  loading ??= import("./data/history/headshots.ts").then(({ HEADSHOTS }) => {
    const ids = new Map<string, string>();
    const names = new Map<string, { born: number; key: string }[]>();
    for (const row of HEADSHOTS.split(";")) {
      const [id, key, name, born] = row.split(":");
      if (!id || !key || WRONG_PHOTO.has(id)) continue;
      ids.set(id, key);
      if (name && born) {
        const list = names.get(name) ?? [];
        list.push({ born: Number(born), key });
        names.set(name, list);
      }
    }
    byId = ids;
    byName = names;
  });
  return loading;
}

export function headshotsReady(): boolean {
  return !!byId;
}

function urlOf(key: string): string {
  if (key[0] === "e") return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${key.slice(1)}.png&w=240&h=175`;
  if (key[0] === "w") return `https://commons.wikimedia.org/wiki/Special:FilePath/${key.slice(1)}?width=240`;
  // His Wikipedia article's free lead photo: some are kept on Wikipedia, not Commons.
  if (key[0] === "x") return `https://en.wikipedia.org/wiki/Special:FilePath/${key.slice(1)}?width=240`;
  // The league's retired-player portrait is an action cutout: cropped to the face, it sits in
  // the card like a studio headshot.
  if (key[0] === "n") return `https://static.www.nfl.com/image/private/c_thumb,g_face,z_0.7,w_240,h_175,f_auto,q_auto/league/${key.slice(1)}`;
  return `https://static.www.nfl.com/image/${key[0] === "u" ? "upload" : "private"}/f_auto,q_auto,w_240/league/${key.slice(1)}`;
}

/** His portrait's address, sized for a card, or undefined (not loaded yet, or no photo). `year` is the season on screen. */
export function headshotUrl(p: Player, year: number): string | undefined {
  if (!byId || !byName || !p.historical) return undefined;
  let key = p.id.startsWith("r-") ? byId.get(p.id.slice(2)) : undefined;
  if (!key && !p.id.startsWith("r-")) {
    const born = year - p.age;
    const near = (byName.get(norm(p.firstName + p.lastName)) ?? []).filter((c) => Math.abs(c.born - born) <= 2);
    if (near.length === 1) key = near[0]!.key;
  }
  return key ? urlOf(key) : undefined;
}
