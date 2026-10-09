/** Session memory of watched broadcasts. No React. */

/** Games already watched this session, so revisiting the film doesn't replay the broadcast. */
const watched = new Set<string>();
export function wasWatched(id: string): boolean {
  if (watched.has(id)) return true;
  try {
    return sessionStorage.getItem(`nfl-rewind:watched:${id}`) === "1";
  } catch {
    return false;
  }
}
export function markWatched(id: string): void {
  watched.add(id);
  try {
    sessionStorage.setItem(`nfl-rewind:watched:${id}`, "1");
  } catch {
    /* private mode */
  }
}

