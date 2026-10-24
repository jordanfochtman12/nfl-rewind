import type { CSSProperties } from "react";

type Still = "title" | "primetime" | "superbowl" | "draft" | "office" | "helmet";

const STILL_IMAGE: Record<Still, string> = {
  title: "/art/rewind-stadium-night.webp",
  superbowl: "/art/rewind-stadium-night.webp",
  helmet: "/art/rewind-stadium-night.webp",
  primetime: "/art/primetime-studio.webp",
  office: "/art/primetime-studio.webp",
  draft: "/art/draft-theater.webp",
};

/** Photo-real broadcast stills replace the former block-and-grid vector backdrops. */
export function FilmStill({
  still,
  className = "",
  veil = "left",
}: {
  still: Still;
  /** Kept for compatibility with older callers. */
  video?: string;
  className?: string;
  veil?: "left" | "bottom" | "full" | "none";
}) {
  const image = STILL_IMAGE[still];
  const veilStyle: CSSProperties =
    veil === "left"
      ? { background: "linear-gradient(90deg, rgba(4,7,13,.94) 0%, rgba(4,7,13,.72) 48%, rgba(4,7,13,.08) 100%)" }
      : veil === "bottom"
        ? { background: "linear-gradient(0deg, rgba(4,7,13,.95) 0%, rgba(4,7,13,.5) 48%, rgba(4,7,13,.04) 100%)" }
        : veil === "full"
          ? { background: "linear-gradient(135deg, rgba(4,7,13,.56), rgba(4,7,13,.72))" }
          : {};

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${image}")`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0" style={veilStyle} />
      <div className="film-grain" />
    </div>
  );
}
