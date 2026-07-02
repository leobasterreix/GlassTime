import { NextResponse } from "next/server";
import type { Book } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const isbn = searchParams.get("isbn");

    if (!query && !isbn) {
      return NextResponse.json({ error: "Query or ISBN required" }, { status: 400 });
    }

    let url = "";
    if (isbn) {
      // Clean up ISBN string (remove spaces, hyphens)
      const cleanIsbn = isbn.replace(/[\s-]/g, "");
      url = `https://openlibrary.org/search.json?q=isbn:${cleanIsbn}&limit=1`;
    } else {
      url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query!)}&limit=20`;
    }

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`OpenLibrary returned ${res.status}`);
    }

    const data = await res.json();
    const docs = data.docs ?? [];

    const books: Book[] = docs.map((doc: any) => {
      // Extract work ID from key "/works/OL82563W" -> "OL82563W"
      const id = doc.key ? doc.key.replace(/^\/works\//, "") : "";
      
      const rating5 = doc.ratings_average ?? null;
      const rating = rating5 ? Number((rating5 * 2).toFixed(1)) : undefined;

      return {
        id,
        title: doc.title,
        author: doc.author_name && doc.author_name.length > 0 ? doc.author_name[0] : "Auteur inconnu",
        year: doc.first_publish_year ?? 0,
        genres: doc.subject ? doc.subject.slice(0, 3) : [],
        overview: "",
        poster: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
        pages: doc.number_of_pages_median ?? undefined,
        rating,
      };
    }).filter((b: Book) => b.id && b.title);

    return NextResponse.json(books);
  } catch (err: any) {
    console.error("OpenLibrary search error:", err);
    return NextResponse.json([], { status: 200 }); // Graceful fallback
  }
}
