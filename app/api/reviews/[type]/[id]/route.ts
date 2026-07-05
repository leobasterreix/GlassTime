import { NextResponse } from "next/server";
import { getShowReviews, getMovieReviews } from "@/lib/catalog";
import { createClient } from "@/lib/supabaseServer";
import type { Review } from "@/lib/types";

const VALID_TYPES = ["movie", "show", "book"] as const;
type ReviewType = (typeof VALID_TYPES)[number];

/** Les IDs TMDB (films/séries) sont numériques, les IDs OpenLibrary (livres,
 * ex. "OL82563W") sont des chaînes — jamais convertir en Number pour un livre
 * sous peine de NaN. */
function parseItemId(type: ReviewType, id: string): number | string {
  return type === "book" ? id : Number(id);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source"); // "site" | "tmdb" | null

  if (!VALID_TYPES.includes(type as ReviewType)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }
  const itemId = parseItemId(type as ReviewType, id);

  // 1. Récupérer les avis TMDB (aucune source équivalente pour les livres)
  const getTmdb = async (): Promise<Review[]> => {
    if (source === "site" || type === "book") return [];
    try {
      if (type === "show") {
        return await getShowReviews(itemId as number);
      } else {
        return await getMovieReviews(itemId as number);
      }
    } catch (err) {
      console.error("Erreur de récupération des avis TMDB :", err);
      return [];
    }
  };

  // 2. Récupérer les avis de notre site dans Supabase
  const getSite = async (): Promise<any[]> => {
    if (source === "tmdb") return [];
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("user_reviews")
        .select("*")
        .eq("item_id", itemId)
        .eq("item_type", type)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("La table user_reviews n'est probablement pas encore créée :", error.message);
        return [];
      } else if (data) {
        return data.map((r: any) => ({
          id: r.id,
          author: r.author_name,
          avatar: r.author_avatar,
          rating: r.rating,
          content: r.content,
          createdAt: r.created_at,
          userId: r.user_id,
          isSiteReview: true,
        }));
      }
      return [];
    } catch (err) {
      console.error("Erreur de récupération des avis Supabase :", err);
      return [];
    }
  };

  // Exécuter en parallèle
  const [tmdbReviews, siteReviews] = await Promise.all([getTmdb(), getSite()]);

  if (source === "site") {
    return NextResponse.json(siteReviews);
  }
  if (source === "tmdb") {
    return NextResponse.json(tmdbReviews);
  }

  return NextResponse.json({
    site: siteReviews,
    tmdb: tmdbReviews,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;

  if (!VALID_TYPES.includes(type as ReviewType)) {
    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }
  const itemId = parseItemId(type as ReviewType, id);

  try {
    const { rating, content } = await req.json();
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Note invalide (doit être entre 1 et 5)" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Vous devez être connecté pour publier un avis" }, { status: 401 });
    }

    const authorName = user.user_metadata?.full_name ?? user.email ?? "Utilisateur GlassTime";
    const authorAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;

    const { error: upsertError } = await supabase
      .from("user_reviews")
      .upsert({
        user_id: user.id,
        item_id: itemId,
        item_type: type,
        rating,
        content: content || "",
        author_name: authorName,
        author_avatar: authorAvatar,
        created_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,item_id,item_type",
      });

    if (upsertError) {
      console.error("Erreur d'enregistrement de l'avis :", upsertError);
      // Cas fréquent pour les livres : la colonne item_id est en integer côté
      // Supabase (héritée de l'époque films/séries uniquement) et refuse un
      // ID OpenLibrary alphanumérique ("OL82563W").
      const looksLikeIntegerColumn =
        type === "book" && /invalid input syntax for type (integer|bigint)/i.test(upsertError.message);
      return NextResponse.json(
        {
          error: looksLikeIntegerColumn
            ? "La colonne item_id de user_reviews doit être en texte pour accepter les ID de livres. Exécutez : ALTER TABLE user_reviews ALTER COLUMN item_id TYPE text;"
            : "Impossible d'enregistrer l'avis. Avez-vous créé la table user_reviews dans votre console Supabase ?",
          details: upsertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erreur dans POST /api/reviews :", err);
    return NextResponse.json({ error: "Erreur interne", details: err.message }, { status: 500 });
  }
}
