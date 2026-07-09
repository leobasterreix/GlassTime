"use client";

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

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
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
    } catch (err) {
      toast("Une erreur est survenue", "⚠️");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast("Compte supprimé", "🗑️");
      router.push("/admin");
    } catch (err) {
      toast("Une erreur est survenue", "⚠️");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="glass empty">
        <p className="muted">{error}</p>
      </div>
    );
  }

  if (!detail) return <p className="muted">Chargement…</p>;

  const isPremium = detail.profile?.subscription_plan === "premium";
  const name = [detail.profile?.first_name, detail.profile?.last_name].filter(Boolean).join(" ");

  return (
    <>
      <h1 className="page-title">{name || detail.email}</h1>
      <p className="page-sub">{detail.email}</p>

      <div className="glass card" style={{ padding: 18, marginBottom: 16 }}>
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
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">Statut</span>
          <span className={`badge-pill${isPremium ? " status-ongoing" : ""}`}>
            {isPremium ? "Premium" : "Gratuit"}
          </span>
        </div>
      </div>

      <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary pressable" disabled={busy} onClick={() => runAction("toggle_premium")}>
          {isPremium ? "Repasser en Gratuit" : "Passer en Premium"}
        </button>
        <button className="btn pressable" disabled={busy} onClick={() => runAction(detail.banned ? "unban" : "ban")}>
          {detail.banned ? "Réactiver le compte" : "Suspendre le compte"}
        </button>
        <button
          className="btn pressable"
          disabled={busy}
          onClick={handleDelete}
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          Supprimer le compte
        </button>
      </div>

      <h2 className="section-title">Historique Lemon Squeezy</h2>
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
    </>
  );
}
