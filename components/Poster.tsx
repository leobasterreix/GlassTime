type PosterItem = {
  title: string;
  poster?: string | null;
  emoji?: string;
  colors?: [string, string];
};

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
  // Repli sans affiche : carte papier neutre (fond --surface-2 via le CSS),
  // initiale ou emoji + titre. Plus de teinte aléatoire qui jurerait.
  return (
    <div className={`poster${mini ? " mini" : ""}`}>
      <span className="emoji">{item.emoji ?? item.title.charAt(0)}</span>
      {!mini && <span className="label">{item.title}</span>}
    </div>
  );
}
