import { NextResponse } from "next/server";
import type { Book } from "@/lib/types";

/** Tendances du jour OpenLibrary — sert à proposer des livres avant toute
 * recherche (page Découvrir). Structure de réponse différente de search.json
 * (pas de "subject" par défaut ici), mappée à part. */
export async function GET() {
  try {
    const res = await fetch("https://openlibrary.org/trending/daily.json", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`OpenLibrary returned ${res.status}`);

    const data = await res.json();
    const works = data.works ?? [];

    const books: Book[] = works
      .map((w: any) => ({
        id: w.key ? w.key.replace(/^\/works\//, "") : "",
        title: w.title,
        author: w.author_name && w.author_name.length > 0 ? w.author_name[0] : "Auteur inconnu",
        year: w.first_publish_year ?? 0,
        genres: [],
        overview: "",
        poster: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg` : null,
        pages: undefined,
        rating: undefined,
      }))
      .filter((b: Book) => b.id && b.title)
      .slice(0, 20);

    return NextResponse.json(books);
  } catch (err: any) {
    console.error("OpenLibrary trending error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
