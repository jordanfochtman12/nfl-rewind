import { ArrowUpRight, BookOpen, ClipboardList, GitBranch, Play, Trophy } from "lucide-react";

export type ModeMarkKind = "franchise" | "timeline" | "record" | "architect" | "continue";

const MARKS = {
  franchise: Trophy,
  timeline: GitBranch,
  record: BookOpen,
  architect: ClipboardList,
  continue: Play,
} satisfies Record<ModeMarkKind, typeof Trophy>;

/** A sports-specific medallion for each mode, with a separate, legible action cue. */
export function ModeMark({ kind }: { kind: ModeMarkKind }) {
  const Mark = MARKS[kind];
  return (
    <span className="next-mode-mark" data-mode={kind} aria-hidden="true">
      <span className="next-mode-symbol"><Mark size={24} strokeWidth={1.8} /></span>
      <ArrowUpRight className="next-mode-launch" size={15} strokeWidth={2.2} />
    </span>
  );
}
