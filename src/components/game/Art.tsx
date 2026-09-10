type Still = "title" | "primetime" | "superbowl" | "draft" | "office" | "helmet";

const SRC: Record<Still, string> = {
  title: "/art/title.jpg",
  primetime: "/art/primetime.jpg",
  superbowl: "/art/superbowl.jpg",
  draft: "/art/draft.jpg",
  office: "/art/office.jpg",
  helmet: "/art/helmet.jpg",
};

export function FilmStill({
  still,
  video,
  className = "",
  veil = "left",
}: {
  still: Still;
  video?: string;
  className?: string;
  veil?: "left" | "bottom" | "full" | "none";
}) {
  const veilClass =
    veil === "left"
      ? "bg-gradient-to-r from-bg via-bg/85 to-bg/25"
      : veil === "bottom"
        ? "bg-gradient-to-t from-bg via-bg/70 to-bg/20"
        : veil === "full"
          ? "bg-bg/70"
          : "";
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {video ? (
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={SRC[still]}
        >
          <source src={video} type="video/mp4" />
        </video>
      ) : (
        <img src={SRC[still]} alt="" className="h-full w-full object-cover" />
      )}
      <div className={`absolute inset-0 ${veilClass}`} />
      <div className="film-grain" />
    </div>
  );
}
