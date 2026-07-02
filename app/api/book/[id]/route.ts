import { NextResponse } from "next/server";
import type { Book } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Récupérer les métadonnées de recherche pour avoir l'auteur, pages, etc.
    const searchUrl = `https://openlibrary.org/search.json?q=key:/works/${id}&limit=1`;
    const workUrl = `https://openlibrary.org/works/${id}.json`;

    // Lancer les requêtes en parallèle
    const [searchRes, workRes] = await Promise.all([
      fetch(searchUrl, { next: { revalidate: 3600 } }).catch(() => null),
      fetch(workUrl, { next: { revalidate: 3600 } }).catch(() => null),
    ]);

    if (!searchRes || !searchRes.ok) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const searchData = await searchRes.json();
    const doc = searchData.docs?.[0];

    if (!doc) {
      return NextResponse.json({ error: "Book metadata not found" }, { status: 404 });
    }

    let overview = "";
    if (workRes && workRes.ok) {
      try {
        const workData = await workRes.json();
        if (workData.description) {
          if (typeof workData.description === "string") {
            overview = workData.description;
          } else if (workData.description.value) {
            overview = workData.description.value;
          }
        }
      } catch (e) {
        console.error("Error parsing work description:", e);
      }
    }

    const rating5 = doc.ratings_average ?? null;
    const rating = rating5 ? Number((rating5 * 2).toFixed(1)) : undefined;

    const book: Book = {
      id,
      title: doc.title,
      author: doc.author_name && doc.author_name.length > 0 ? doc.author_name[0] : "Auteur inconnu",
      year: doc.first_publish_year ?? 0,
      genres: doc.subject ? doc.subject.slice(0, 3) : [],
      overview,
      poster: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      pages: doc.number_of_pages_median ?? undefined,
      rating,
    };

    return NextResponse.json(book);
  } catch (err: any) {
    console.error("Book detail error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
