import type { DisplayShowStatus } from "@/lib/utils";

type PosterItem = {
  title: string;
  poster?: string | null;
  emoji?: string;
  colors?: [string, string];
  /** Séries uniquement : films et livres n'ont pas cette notion. */
  status?: DisplayShowStatus;
};

export default function Poster({
  item,
  mini,
}: {
  item: PosterItem;
  mini?: boolean;
}) {
  // Bandeau de statut : uniquement sur les affiches de taille normale (une
  // mini affiche de 56px n'a pas la place pour un texte lisible ; ce
  // contexte-là garde un badge en ligne à côté du titre à la place).
  const banner = !mini && item.status && (
    <span
      className={`poster-banner${item.status === "En cours" ? " status-ongoing" : ""}`}
    >
      {item.status}
    </span>
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
