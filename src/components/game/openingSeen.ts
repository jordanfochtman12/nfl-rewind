/** Big nights' openings already shown this visit (each airs once), by night: "sb-1999", "hof-2003". */
const seen = new Set<string>();
export const openingSeen = (key: string) => seen.has(key);
export const markOpeningSeen = (key: string) => void seen.add(key);

/** Nights whose short show open already ran (or was replaced by the full opening). */
export const showOpened = new Set<string>();
export const markShowOpened = (id: string) => void showOpened.add(id);
