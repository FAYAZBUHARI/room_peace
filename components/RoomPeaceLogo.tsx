/** Original PNGs remain unmodified, including all transparent padding. */
export function RoomPeaceLogo({ surface = "dark", className = "" }: { surface?: "dark" | "light"; className?: string }) {
  const file = surface === "dark" ? "White mirrored speech bubble logo.png" : "Mirrored speech bubble logo.png";
  return <span className={`roompeace-logo ${className}`}>
    <img src={`/${encodeURIComponent(file)}`} width={1254} height={1254} alt="RoomPeace" draggable={false} />
  </span>;
}

export function HeroEmblem() {
  const asset = "/White%20mirrored%20speech%20bubble%20logo.png";
  return <div className="emblem-presentation">
    <div className="emblem">
      <div className="bubble-light" aria-hidden="true">
        <img className="bubble-halo" src={asset} alt="" width={1254} height={1254} />
        <img className="bubble-edge" src={asset} alt="" width={1254} height={1254} />
        <img className="bubble-upper" src={asset} alt="" width={1254} height={1254} />
      </div>
      <img className="bubble-silhouette" src={asset} alt="RoomPeace" width={1254} height={1254} draggable={false} />
    </div>
  </div>;
}