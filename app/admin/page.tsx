"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  subscriptionPlan: "free" | "premium";
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
};

type Stats = { total: number; premium: number; signups30d: number };

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setUsers(data.users);
        setStats(data.stats);
      })
      .catch(() => setError("Erreur de chargement"));
  }, []);

  // Ordre au chargement initial, stable pendant la recherche : sert de base
  // au délai du stagger, pour que retaper dans le champ ne rejoue pas
  // l'animation d'apparition (elle ne doit jouer qu'une fois, pas à chaque frappe).
  const rowDelay = useMemo(() => {
    const map = new Map<string, number>();
    (users ?? []).forEach((u, i) => map.set(u.id, i));
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <>
      <h1 className="page-title">Back-office</h1>
      <p className="page-sub">Gestion des comptes GlassTime.</p>

      {error && (
        <div className="glass empty" style={{ marginBottom: 20 }}>
          <p className="muted">{error}</p>
        </div>
      )}

      <div className="row" style={{ gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {stats
          ? [
              { label: "Comptes", value: stats.total },
              { label: "Premium", value: stats.premium },
              { label: "Inscriptions 30j", value: stats.signups30d },
            ].map((s) => (
              <div key={s.label} className="glass card" style={{ flex: "1 1 140px", padding: 18, textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{s.value}</div>
                <div className="tiny" style={{ color: "var(--text-2)" }}>{s.label}</div>
              </div>
            ))
          : !error &&
            [0, 1, 2].map((i) => (
              <div key={i} className="glass card" style={{ flex: "1 1 140px", padding: 18 }}>
                <div className="skeleton" style={{ height: 26, width: 40, margin: "0 auto 8px", borderRadius: 6 }} />
                <div className="skeleton skeleton-line" style={{ width: "80%", margin: "0 auto" }} />
              </div>
            ))}
      </div>

      <input
        className="field"
        placeholder="Rechercher par email ou nom…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16, width: "100%" }}
      />

      {!users && !error ? (
        <div className="stack" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass card" style={{ padding: 14 }}>
              <div className="skeleton skeleton-line" style={{ width: "45%", marginBottom: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: "70%", marginBottom: 0 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {filtered?.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className="glass card pressable admin-row-in"
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
                animationDelay: `${Math.min(rowDelay.get(u.id) ?? 0, 10) * 30}ms`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {u.name || u.email}
                </div>
                <div className="tiny" style={{ color: "var(--text-3)" }}>
                  {u.email} · inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <span className={`badge-pill${u.subscriptionPlan === "premium" ? " status-premium" : ""}`}>
                {u.subscriptionPlan === "premium" ? "Premium" : "Gratuit"}
              </span>
              {u.banned && <span className="badge-pill status-danger">Suspendu</span>}
            </Link>
          ))}
          {filtered?.length === 0 && <p className="muted">Aucun compte ne correspond.</p>}
        </div>
      )}
    </>
  );
}
