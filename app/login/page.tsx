"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth-code-error") {
      setError("Échec de la connexion. Veuillez réessayer.");
    }
  }, []);

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue lors de la redirection.");
      setLoading(false);
    }
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
      <div
        className="glass"
        style={{ padding: 28, width: "100%", maxWidth: 420, margin: "0 auto", textAlign: "center" }}
      >
        <div style={{ fontSize: 52, filter: "drop-shadow(0 8px 20px rgba(0,0,0,.5))" }}>
          📺
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 10 }}>
          GlassTime
        </h1>
        <p className="muted" style={{ marginTop: 6, marginBottom: 24 }}>
          Suivez vos séries et films préférés avec synchronisation multi-appareils
        </p>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
            {error}
          </p>
        )}

        <button
          onClick={handleGoogleLogin}
          className="btn pressable"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 14,
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
          disabled={loading}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            style={{ marginRight: 10, flexShrink: 0 }}
          >
            <path
              fill="#EA4335"
              d="M5.2662 9.7651A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3.01A11.962 11.962 0 0 0 12 0C7.18 0 3.06 2.72 1.058 6.702l4.208 3.063z"
            />
            <path
              fill="#FBBC05"
              d="M1.058 6.702A11.944 11.944 0 0 0 0 12c0 1.88.432 3.657 1.2 5.253l4.243-3.153A7.054 7.054 0 0 1 4.909 12c0-1.6.436-3.109 1.2-4.418l-5.05-4.88z"
            />
            <path
              fill="#4285F4"
              d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.84-2.99a7.077 7.077 0 0 1-10.854-3.793l-4.243 3.153C3.06 21.28 7.18 24 12 24z"
            />
            <path
              fill="#34A853"
              d="M24 12c0-.86-.08-1.7-.22-2.51H12v4.75h6.73c-.29 1.53-1.15 2.82-2.45 3.68l3.84 2.99C22.37 19.04 24 15.82 24 12z"
            />
          </svg>
          {loading ? "Redirection vers Google…" : "Se connecter avec Google"}
        </button>
      </div>
    </main>
  );
}
