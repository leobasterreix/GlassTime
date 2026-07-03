import type { DisplayShowStatus } from "@/lib/utils";

/**
 * Badge de statut d'une série, en ligne de texte (à côté d'un titre).
 * Uniquement les séries : films et livres n'ont pas cette notion.
 * Sur une affiche/couverture, Poster affiche directement un bandeau dédié
 * (voir .poster-banner) plutôt que ce badge.
 */
export default function ShowStatusBadge({
  status,
}: {
  status?: DisplayShowStatus;
}) {
  if (!status) return null;
  const ongoing = status === "En cours";
  return (
    <span className={`badge-pill ${ongoing ? "status-ongoing" : "status-ended"}`}>
      {status}
    </span>
  );
}
