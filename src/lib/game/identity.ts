import { HISTORICAL_ALIASES } from "./data/playerAliases.ts";

/** Strip table-cell attributes, never ordinary apostrophes or hyphenated names. */
export function cleanPlayerName(text: string): string {
  return text
    .replace(
      /\b(?:bgcolor|align|valign|style|class|width|rowspan|colspan)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*\|?/gi,
      " ",
    )
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanNameParts(
  first: string,
  last: string,
): { firstName: string; lastName: string } {
  const f = cleanPlayerName(first);
  const l = cleanPlayerName(last);
  if (f) return { firstName: f, lastName: l };
  const [head = "", ...tail] = l.split(" ");
  return { firstName: head, lastName: tail.join(" ") };
}

/** Spacing of initials and first/last splits does not define a new person. */
export function normalizedName(first: string, last = ""): string {
  return cleanPlayerName(`${first} ${last}`)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`\s"“”]/g, "");
}

const aliases = new Map<string, string>();
for (const [year, canonical, ...variants] of HISTORICAL_ALIASES) {
  for (const name of [canonical, ...variants])
    aliases.set(`${year}:${normalizedName(name)}`, normalizedName(canonical));
}

/** Alias resolution is scoped to a historical draft class, never applied to generated players. */
export function historicalNameKey(first: string, last: string, year: number): string {
  const name = normalizedName(first, last);
  return aliases.get(`${year}:${name}`) ?? name;
}
