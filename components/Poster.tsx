import { isOngoingStatus, type DisplayStatus } from "@/lib/utils";

type PosterItem = {
  title: string;
  poster?: string | null;
  emoji?: string;
  colors?: [string, string];
  /** Séries, films ou livres : pilote la couleur du bandeau de statut. */
  status?: DisplayStatus;
};

export default function Poster({
  item,
  mini,
}: {
  item: PosterItem;
  mini?: boolean;
}) {
  // Bandeau de statut : une fine bande de couleur au pied de l'affiche, sans
  // texte (juste la couleur suffit à distinguer « en cours »/« en liste » du
  // vert, de « terminé »/« vu »/« lu » du violet) — fonctionne donc aussi
  // bien en taille normale qu'en mini affiche.
  const banner = item.status && (
    <span
      className={`poster-banner${isOngoingStatus(item.status) ? " status-ongoing" : ""}`}
    />
  );

  if (item.poster) {
    return (
      <div className={`poster${mini ? " mini" : ""}`}>
        <img className="art" src={item.poster} alt={item.title} loading="lazy" />
        {banner}
      </div>
    );
  }
  // Repli sans affiche : carte papier neutre (fond --surface-2 via le CSS),
  // initiale ou emoji + titre. Plus de teinte aléatoire qui jurerait.
  return (
    <div className={`poster${mini ? " mini" : ""}`}>
      <span className="emoji">{item.emoji ?? item.title.charAt(0)}</span>
      {!mini && <span className="label">{item.title}</span>}
      {banner}
    </div>
  );
}
