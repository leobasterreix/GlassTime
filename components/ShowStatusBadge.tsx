/**
 * Badge de statut de diffusion d'une série (uniquement les séries : les
 * films et les livres n'ont pas cette notion). "Terminée" signale qu'il
 * n'y aura pas de nouvelle saison à attendre.
 */
export default function ShowStatusBadge({
  status,
  overlay,
}: {
  status?: "En cours" | "Terminée";
  /** Médaillon sur un poster (fond sombre fixe) plutôt qu'un badge en ligne
   * de texte (teintes claires, pensées pour une surface papier). */
  overlay?: boolean;
}) {
  if (!status) return null;
  const ongoing = status === "En cours";

  if (overlay) {
    return (
      <span className={`poster-badge${ongoing ? " status-ongoing" : ""}`}>
        {status}
      </span>
    );
  }

  return (
    <span className={`badge-pill ${ongoing ? "status-ongoing" : "status-ended"}`}>
      {status}
    </span>
  );
}
