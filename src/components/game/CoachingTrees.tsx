/** The league's coaching trees: who came up under whom, in this timeline and before it. */
import { useMemo, useState } from "react";
import { coachingTrees, type TreeNode } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";

const rec = (n: TreeNode) => `${n.wins}-${n.losses}${n.ties ? `-${n.ties}` : ""}`;

function Branch({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children.length > 0;
  return (
    <li className={depth ? "border-l border-line pl-3" : ""}>
      <div className="flex flex-wrap items-baseline gap-x-2 py-1">
        {hasKids ? (
          <button type="button" className="min-h-8 text-left font-medium text-paper hover:text-brass" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "▾" : "▸"} {node.name}
          </button>
        ) : (
          <span className="font-medium text-paper">{node.name}</span>
        )}
        <span className="text-xs text-muted">
          {rec(node)}
          {node.titles ? ` · ${node.titles} ${node.titles === 1 ? "title" : "titles"}` : ""}
          {hasKids ? ` · ${node.size} head ${node.size === 1 ? "coach" : "coaches"} below` : ""}
          {node.root === "real" ? " · real-life roots" : ""}
        </span>
      </div>
      {hasKids && open && (
        <ul className="ml-1 space-y-0.5">
          {node.children.map((c) => (
            <Branch key={c.name} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CoachingTrees() {
  const save = useGameStore((s) => s.save)!;
  const trees = useMemo(() => coachingTrees(save, 6), [save]);
  if (!trees.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Coaching trees">
      <p className="text-xs tracking-[0.25em] text-muted">COACHING TREES</p>
      <p className="mt-1 text-sm text-paper">
        Every coordinator who spends a season on a head coach's staff joins his tree. Real coaches start from the staffs they actually came up on; this timeline grows the branches from there.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {trees.map((t) => (
          <article key={t.name} className="rounded-lg border border-line bg-black/30 p-3">
            <ul>
              <Branch node={t} depth={0} />
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
