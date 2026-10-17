/**
 * The position a player is shown at. The game plays one safety position, but a safety is a free
 * or a strong safety: the record's own spot where it names one, else his type (a ballhawk plays
 * free, a box safety strong), else his ratings (more cover than hit is free).
 */
type Labeled = { pos: string; role?: string; arch?: string; ratings?: { cov?: number; tak?: number } };

export function safetyRole(p: Labeled): "FS" | "SS" {
  if (p.role === "FS" || p.role === "SS") return p.role;
  if (p.arch === "hawk") return "FS";
  if (p.arch === "box-s") return "SS";
  return (p.ratings?.cov ?? 0) >= (p.ratings?.tak ?? 0) ? "FS" : "SS";
}

export function posLabel(p: Labeled): string {
  if (p.pos !== "S") return p.pos;
  // A line that kept only the position, with nothing to tell which safety, stays "S".
  return p.role || p.arch || p.ratings ? safetyRole(p) : "S";
}

/** A club's two starting safeties, one free and one strong. */
export function safetyPair(a?: Labeled, b?: Labeled): ["FS" | "SS", "FS" | "SS"] {
  if (!a || !b) return [a ? safetyRole(a) : "FS", b ? safetyRole(b) : "SS"];
  const ra = safetyRole(a), rb = safetyRole(b);
  if (ra !== rb) return [ra, rb];
  // Both the same: the one with more cover over hit plays free, unless the record named the other.
  if (a.role && !b.role) return [ra, ra === "FS" ? "SS" : "FS"];
  if (b.role && !a.role) return [rb === "FS" ? "SS" : "FS", rb];
  const lean = (p: Labeled) => (p.ratings?.cov ?? 0) - (p.ratings?.tak ?? 0);
  return lean(a) >= lean(b) ? ["FS", "SS"] : ["SS", "FS"];
}
