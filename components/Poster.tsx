type PosterItem = {
  title: string;
  poster?: string | null;
  emoji?: string;
  colors?: [string, string];
};

/** Teinte dérivée du titre pour les affiches sans image. */
function fallbackColors(title: string): [string, string] {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [`hsl(${h} 45% 16%)`, `hsl(${h} 55% 42%)`];
}

export default function Poster({
  item,
  mini,
}: {
  item: PosterItem;
  mini?: boolean;
}) {
  if (item.poster) {
    return (
      <div className={`poster${mini ? " mini" : ""}`}>
        <img className="art" src={item.poster} alt={item.title} loading="lazy" />
      </div>
    );
  }
  const colors = item.colors ?? fallbackColors(item.title);
  return (
    <div
      className={`poster${mini ? " mini" : ""}`}
      style={{
        background: `linear-gradient(160deg, ${colors[1]} 0%, ${colors[0]} 78%)`,
      }}
    >
      <span className="emoji">{item.emoji ?? item.title.charAt(0)}</span>
      {!mini && <span className="label">{item.title}</span>}
    </div>
  );
}
