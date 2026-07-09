"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

type Detail = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  profile: {
    first_name?: string;
    last_name?: string;
    subscription_plan?: "free" | "premium";
    subscription_status?: string | null;
  } | null;
  events: { id: string; event_type: string; created_at: string }[];
};

type PendingAction = "toggle_premium" | "ban" | "unban" | "delete" | null;

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function load() {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDetail(data);
      })
      .catch(() => setError("Erreur de chargement"));
  }

  useEffect(load, [id]);

  async function runAction(action: "toggle_premium" | "ban" | "unban") {
    setPending(action);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast("Compte mis à jour", "✓");
      load();
    } catch {
      toast("Une erreur est survenue", "⚠️");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    setPending("delete");
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast("Compte supprimé", "🗑️");
      router.push("/admin");
    } catch {
      toast("Une erreur est survenue", "⚠️");
      setPending(null);
      setConfirmDelete(false);
    }
  }

  const backLink = (
    <Link href="/admin" className="chip pressable" style={{ marginBottom: 16, display: "inline-flex" }}>
      ← Retour à la liste
    </Link>
  );

  if (error) {
    return (
      <>
        {backLink}
        <div className="glass empty">
          <p className="muted">{error}</p>
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        {backLink}
        <div className="stack" style={{ gap: 16 }}>
          <div className="skeleton skeleton-line" style={{ width: "50%", height: 28 }} />
          <div className="glass card" style={{ padding: 18 }}>
            <div className="skeleton skeleton-line" style={{ width: "90%" }} />
            <div className="skeleton skeleton-line" style={{ width: "70%" }} />
            <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 0 }} />
          </div>
        </div>
      </>
    );
  }

  const isPremium = detail.profile?.subscription_plan === "premium";
  const name = [detail.profile?.first_name, detail.profile?.last_name].filter(Boolean).join(" ");

  return (
    <>
      {backLink}

      <h1 className="page-title">{name || detail.email}</h1>
      <p className="page-sub">{detail.email}</p>

      <div className="glass card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span className="muted">Inscrit le</span>
          <span>{new Date(detail.createdAt).toLocaleDateString("fr-FR")}</span>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <span className="muted">Dernière connexion</span>
          <span>
            {detail.lastSignInAt ? new Date(detail.lastSignInAt).toLocaleDateString("fr-FR") : "—"}
          </span>
        </div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: detail.banned ? 6 : 0 }}>
          <span className="muted">Abonnement</span>
          <span className={`badge-pill${isPremium ? " status-premium" : ""}`}>
            {isPremium ? "Premium" : "Gratuit"}
          </span>
        </div>
        {detail.banned && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Compte</span>
            <span className="badge-pill status-danger">Suspendu</span>
          </div>
        )}
      </div>

      {/* Action courante : sans risque, en avant */}
      <button
        className="btn btn-primary pressable"
        disabled={!!pending}
        onClick={() => runAction("toggle_premium")}
        style={{ width: "100%", marginBottom: 20 }}
      >
        {pending === "toggle_premium" ? (
          <span className="spinner" style={{ width: 16, height: 16 }} />
        ) : isPremium ? (
          "Repasser en Gratuit"
        ) : (
          "Passer en Premium"
        )}
      </button>

      {/* Zone sensible : actions réversibles puis irréversible, isolées et
          hiérarchisées par gravité plutôt que d'avoir le même poids visuel. */}
      <div className="glass card" style={{ padding: 16, border: "1px solid var(--hairline-strong)" }}>
        <div
          className="tiny"
          style={{ fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}
        >
          Zone sensible
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <button
            className="btn pressable"
            disabled={!!pending}
            onClick={() => runAction(detail.banned ? "unban" : "ban")}
            style={{ width: "100%" }}
          >
            {pending === "ban" || pending === "unban" ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : detail.banned ? (
              "Réactiver le compte"
            ) : (
              "Suspendre le compte"
            )}
          </button>
          <button
            className="btn pressable"
            disabled={!!pending}
            onClick={() => setConfirmDelete(true)}
            style={{ width: "100%", color: "var(--danger)", borderColor: "var(--danger)" }}
          >
            Supprimer le compte
          </button>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 26 }}>Historique Lemon Squeezy</h2>
      {detail.events.length === 0 ? (
        <p className="muted">Aucun événement reçu pour ce compte.</p>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {detail.events.map((e) => (
            <div key={e.id} className="glass card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{e.event_type}</span>
                <span className="tiny" style={{ color: "var(--text-3)" }}>
                  {new Date(e.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="tiny" style={{ color: "var(--text-3)", marginTop: 16 }}>
        Les séries/livres suivis ne sont visibles ici que si le compte a synchronisé
        en Premium — sinon ces données restent locales à l'appareil de l'utilisateur.
      </p>

      {confirmDelete && (
        <div
          className="notif-scrim"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 100 }}
          onClick={() => !pending && setConfirmDelete(false)}
        >
          <div
            className="glass card stack"
            style={{ width: "100%", maxWidth: 400, padding: 22, gap: 14, zIndex: 101 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16.5, fontWeight: 800 }}>Supprimer ce compte ?</h3>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {name || detail.email} sera définitivement supprimé, avec ses abonnements
              et relations. Cette action est irréversible.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn pressable"
                style={{ flex: 1 }}
                disabled={!!pending}
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
              <button
                className="btn pressable"
                style={{ flex: 1, background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}
                disabled={!!pending}
                onClick={handleDelete}
              >
                {pending === "delete" ? (
                  <span
                    className="spinner"
                    style={{ width: 16, height: 16, borderColor: "rgba(255,255,255,0.4)", borderTopColor: "#fff" }}
                  />
                ) : (
                  "Supprimer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
