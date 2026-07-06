"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { isNativeApp } from "@/lib/nativeApp";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Nouveaux états
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth-code-error") {
      setError("Échec de la connexion. Veuillez réessayer.");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setFirstName("");
    setLastName("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);

    if (mode === "signup" && (!firstName.trim() || !lastName.trim())) {
      setError("Veuillez renseigner votre prénom et votre nom.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Renseignez votre e-mail et votre mot de passe.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      // Définir le cookie remember_me pour le serveur
      document.cookie = `remember_me=${rememberMe}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax`;

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            }
          },
        });
        if (error) throw error;
        // Selon les réglages Supabase : session immédiate ou e-mail de confirmation
        if (data.session) {
          window.location.href = "/";
        } else {
          setNotice(
            "Compte créé ! Vérifiez votre boîte mail pour confirmer votre inscription."
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err: unknown) {
      setError(translateError(err));
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    setNotice(null);
    try {
      // Définir le cookie remember_me pour le serveur
      document.cookie = `remember_me=${rememberMe}; path=/; max-age=${365 * 24 * 3600}; SameSite=Lax`;

      // Dans l'app native, Google refuse de s'authentifier dans une WKWebView :
      // on redirige vers un schéma personnalisé intercepté par une session
      // d'authentification système (voir WebViewModel.swift côté iOS), plutôt
      // que vers l'URL https habituelle.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: isNativeApp()
            ? "glasstime://auth-callback"
            : `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(translateError(err));
      setGoogleLoading(false);
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
        style={{ padding: 28, width: "100%", maxWidth: 420, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center" }}>
          <Image
            src="/logo.png"
            alt="GlassTime"
            width={96}
            height={96}
            priority
            style={{ borderRadius: 22, margin: "0 auto" }}
          />
          <p className="muted" style={{ marginTop: 14, marginBottom: 22 }}>
            {mode === "signin"
              ? "Connectez-vous pour retrouver vos séries, films et livres."
              : "Créez un compte pour synchroniser vos suivis sur tous vos appareils."}
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="glass card" style={{ textAlign: "center" }}>
            <p className="muted">
              L'authentification n'est pas encore activée. L'application est
              accessible librement pour le moment.
            </p>
            <a
              href="/"
              className="btn btn-primary pressable"
              style={{ marginTop: 16, display: "inline-flex" }}
            >
              Entrer
            </a>
          </div>
        ) : (
          <>
            {/* Bascule connexion / inscription */}
            <div className="glass segmented" style={{ marginBottom: 18 }}>
              <button
                className={mode === "signin" ? "active" : ""}
                onClick={() => switchMode("signin")}
                type="button"
              >
                Connexion
              </button>
              <button
                className={mode === "signup" ? "active" : ""}
                onClick={() => switchMode("signup")}
                type="button"
              >
                Inscription
              </button>
            </div>

             <form onSubmit={handleEmailSubmit} className="stack" style={{ gap: 12 }}>
              {mode === "signup" && (
                <div className="row" style={{ gap: 10 }}>
                  <input
                    className="field"
                    type="text"
                    placeholder="Prénom"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    className="field"
                    type="text"
                    placeholder="Nom"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              )}

              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div style={{ position: "relative", width: "100%" }}>
                <input
                  className="field"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 46 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-3)",
                  }}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              {mode === "signup" && (
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    className="field"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirmer le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ paddingRight: 46 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-3)",
                    }}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              )}

              <label className="row pressable" style={{ gap: 8, alignItems: "center", width: "fit-content", marginTop: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "var(--accent)",
                    cursor: "pointer"
                  }}
                />
                <span className="tiny" style={{ fontWeight: 600, color: "var(--text-2)", cursor: "pointer", userSelect: "none" }}>
                  Rester connecté
                </span>
              </label>

              {error && (
                <p style={{ color: "var(--danger)", fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>
                  {error}
                </p>
              )}
              {notice && (
                <p style={{ color: "var(--accent-ink)", fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>
                  {notice}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary pressable"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading}
              >
                {loading
                  ? "Un instant…"
                  : mode === "signin"
                    ? "Se connecter"
                    : "Créer mon compte"}
              </button>
            </form>

            <div className="divider" style={{ margin: "18px 0" }}>
              ou
            </div>

            <button
              onClick={handleGoogleLogin}
              className="btn pressable"
              style={{ width: "100%" }}
              disabled={googleLoading}
              type="button"
            >
              <svg viewBox="0 0 24 24" width="19" height="19" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M5.2662 9.7651A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3.01A11.962 11.962 0 0 0 12 0C7.18 0 3.06 2.72 1.058 6.702l4.208 3.063z" />
                <path fill="#FBBC05" d="M1.058 6.702A11.944 11.944 0 0 0 0 12c0 1.88.432 3.657 1.2 5.253l4.243-3.153A7.054 7.054 0 0 1 4.909 12c0-1.6.436-3.109 1.2-4.418l-5.05-4.88z" />
                <path fill="#4285F4" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.84-2.99a7.077 7.077 0 0 1-10.854-3.793l-4.243 3.153C3.06 21.28 7.18 24 12 24z" />
                <path fill="#34A853" d="M24 12c0-.86-.08-1.7-.22-2.51H12v4.75h6.73c-.29 1.53-1.15 2.82-2.45 3.68l3.84 2.99C22.37 19.04 24 15.82 24 12z" />
              </svg>
              {googleLoading ? "Redirection…" : "Continuer avec Google"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

/** Messages d'erreur Supabase traduits en français lisible. */
function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Un compte existe déjà avec cet e-mail. Connectez-vous.";
  if (m.includes("email not confirmed"))
    return "Confirmez d'abord votre e-mail via le lien reçu par mail.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Réessayez dans un instant.";
  if (m.includes("password")) return "Mot de passe invalide (6 caractères minimum).";
  return "Une erreur est survenue. Veuillez réessayer.";
}
