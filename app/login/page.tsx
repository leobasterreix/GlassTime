"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      setError("Mot de passe incorrect");
    } catch {
      setError("Impossible de se connecter, réessayez.");
    }
    setLoading(false);
  }

  return (
    <main
      className="page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 24,
      }}
    >
      <form
        onSubmit={submit}
        className="glass"
        style={{ padding: 28, width: "100%", textAlign: "center" }}
      >
        <div style={{ fontSize: 52, filter: "drop-shadow(0 8px 20px rgba(0,0,0,.5))" }}>
          🔒
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 10 }}>
          GlassTime
        </h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 20 }}>
          Espace privé — entrez le mot de passe
        </p>

        <div className="glass search" style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Mot de passe"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ textAlign: "center" }}
          />
        </div>

        {error && (
          <p style={{ color: "#ff6b6b", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary pressable"
          style={{ width: "100%" }}
          disabled={loading || !password}
        >
          {loading ? "Vérification…" : "Déverrouiller"}
        </button>
      </form>
    </main>
  );
}
