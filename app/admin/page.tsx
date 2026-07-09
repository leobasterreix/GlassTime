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

      {stats && (
        <div className="row" style={{ gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Comptes", value: stats.total },
            { label: "Premium", value: stats.premium },
            { label: "Inscriptions 30j", value: stats.signups30d },
          ].map((s) => (
            <div key={s.label} className="glass card" style={{ flex: "1 1 140px", padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{s.value}</div>
              <div className="tiny" style={{ color: "var(--text-2)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <input
        className="field"
        placeholder="Rechercher par email ou nom…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 16, width: "100%" }}
      />

      {!users && !error ? (
        <p className="muted">Chargement…</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {filtered?.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className="glass card pressable"
              style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {u.name || u.email}
                </div>
                <div className="tiny" style={{ color: "var(--text-3)" }}>
                  {u.email} · inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <span className={`badge-pill${u.subscriptionPlan === "premium" ? " status-ongoing" : ""}`}>
                {u.subscriptionPlan === "premium" ? "Premium" : "Gratuit"}
              </span>
              {u.banned && (
                <span className="badge-pill" style={{ background: "var(--danger)", color: "#fff" }}>
                  Suspendu
                </span>
              )}
            </Link>
          ))}
          {filtered?.length === 0 && <p className="muted">Aucun compte ne correspond.</p>}
        </div>
      )}
    </>
  );
}
