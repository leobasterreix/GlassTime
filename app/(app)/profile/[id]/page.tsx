"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Clapperboard, Heart, Library, Tv } from "lucide-react";
import Poster from "@/components/Poster";
import { useMounted } from "@/lib/store";
import { toast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";

export default function FriendProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const targetUserId = params.id;
  const mounted = useMounted();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Get current session
      const { data: { session } } = await supabase.auth.getSession();
      const currentUid = session?.user?.id || null;
      setMyUserId(currentUid);

      if (currentUid === targetUserId) {
        // Rediriger vers notre propre profil si c'est nous
        router.replace("/profile");
        return;
      }

      // 2. Fetch target profile
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      if (!prof) {
        toast("Utilisateur introuvable", "⚠️");
        router.push("/profile");
        return;
      }
      setProfile(prof);

      // 3. Fetch follow state
      if (currentUid) {
        const { data: follow } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", currentUid)
          .eq("followed_id", targetUserId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      toast("Impossible de charger le profil", "⚠️");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [targetUserId]);

  async function toggleFollow() {
    if (!myUserId) {
      toast("Veuillez vous connecter pour vous abonner", "🔒");
      router.push("/login");
      return;
    }
    setActionLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", myUserId)
          .eq("followed_id", targetUserId);
        if (error) throw error;
        setIsFollowing(false);
        toast("Désabonnement réussi", "🔕");
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: myUserId,
            followed_id: targetUserId
          });
        if (error) throw error;
        setIsFollowing(true);
        toast("Abonnement réussi !", "🔔");
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      toast("Une erreur est survenue", "⚠️");
    } finally {
      setActionLoading(false);
    }
  }

  if (!mounted || loading) {
    return (
      <main className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p className="muted">Chargement du profil...</p>
      </main>
    );
  }

  const pState = profile?.public_state || {};
  const shows = (pState.followed || []).map((id: number) => pState.showCache?.[id]).filter(Boolean);
  const movies = (pState.moviesWatched || []).map((id: number) => pState.movieCache?.[id]).filter(Boolean);
  const books = (pState.booksRead || []).map((id: string) => pState.bookCache?.[id]).filter(Boolean);

  const favShows = (pState.favoriteShows || []).map((id: number) => pState.showCache?.[id]).filter(Boolean);
  const favMovies = (pState.favoriteMovies || []).map((id: number) => pState.movieCache?.[id]).filter(Boolean);
  const favBooks = (pState.favoriteBooks || []).map((id: string) => pState.bookCache?.[id]).filter(Boolean);

  const favoriteItems = [
    ...favShows.map((s: any) => ({
      key: `fav-show-${s.id}`,
      item: s,
    })),
    ...favMovies.map((m: any) => ({
      key: `fav-movie-${m.id}`,
      item: m,
    })),
    ...favBooks.map((b: any) => ({
      key: `fav-book-${b.id}`,
      item: b,
    })),
  ];

  const name = profile?.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Membre GlassTime";

  return (
    <main className="page">
      {/* Retour */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/profile" className="tiny" style={{ fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)" }}>
          ← Retour à mon profil
        </Link>
      </div>

      {/* Header Profil */}
      <div
        className="glass card row"
        style={{ marginBottom: 26, gap: 16, padding: 20, alignItems: "center" }}
      >
        {profile?.avatar_url && (profile.avatar_url.startsWith("http") || profile.avatar_url.includes("/")) ? (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "1px solid var(--glass-border)",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              background: "var(--accent-wash)",
              border: "1px solid var(--accent)",
            }}
          >
            {profile?.avatar_url || "🍿"}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{name}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {profile?.email}
          </div>
        </div>
        <button
          onClick={toggleFollow}
          disabled={actionLoading}
          className="glass card pressable"
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            margin: 0,
            background: isFollowing ? "transparent" : "var(--accent-wash)",
            borderColor: isFollowing ? "var(--hairline)" : "var(--accent)",
            color: isFollowing ? "var(--text-2)" : "var(--accent)",
          }}
        >
          {isFollowing ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <BellOff size={13} /> Se désabonner
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Bell size={13} /> S'abonner
            </span>
          )}
        </button>
      </div>

      {/* Listes sans détail */}
      <div className="stack" style={{ gap: 24 }}>
        {/* Favoris */}
        {favoriteItems.length > 0 && (
          <div>
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Heart size={14} /> Favoris ({favoriteItems.length})
            </h2>
            <div className="hscroll">
              {favoriteItems.map(({ key, item }) => (
                <div key={key} style={{ opacity: 0.9 }}>
                  <Poster item={item} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Séries suivies */}
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Tv size={14} /> Séries suivies ({shows.length})
          </h2>
          {shows.length > 0 ? (
            <div className="hscroll">
              {shows.map((s: any) => (
                <div key={s.id} style={{ opacity: 0.9 }}>
                  <Poster item={s} />
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny" style={{ color: "var(--text-3)" }}>Aucune série suivie.</p>
          )}
        </div>

        {/* Films vus */}
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clapperboard size={14} /> Films vus ({movies.length})
          </h2>
          {movies.length > 0 ? (
            <div className="hscroll">
              {movies.map((m: any) => (
                <div key={m.id} style={{ opacity: 0.9 }}>
                  <Poster item={m} />
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny" style={{ color: "var(--text-3)" }}>Aucun film vu.</p>
          )}
        </div>

        {/* Livres lus */}
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Library size={14} /> Livres lus ({books.length})
          </h2>
          {books.length > 0 ? (
            <div className="hscroll">
              {books.map((b: any) => (
                <div key={b.id} style={{ opacity: 0.9 }}>
                  <Poster item={b} />
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny" style={{ color: "var(--text-3)" }}>Aucun livre lu.</p>
          )}
        </div>
      </div>
    </main>
  );
}
