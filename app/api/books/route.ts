import { NextResponse } from "next/server";
import { OPENLIBRARY_FIELDS, mapOpenLibraryDocs } from "@/lib/openlibrary";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const isbn = searchParams.get("isbn");
    const year = searchParams.get("year");
    const month = searchParams.get("month"); // "01".."12", ignoré sans year
    const subject = searchParams.get("subject");

    if (!query && !isbn && !year && !subject) {
      return NextResponse.json(
        { error: "Query, ISBN, year ou subject requis" },
        { status: 400 }
      );
    }

    let url = "";
    if (isbn) {
      // Clean up ISBN string (remove spaces, hyphens)
      const cleanIsbn = isbn.replace(/[\s-]/g, "");
      url = `https://openlibrary.org/search.json?q=isbn:${cleanIsbn}&limit=1&fields=${OPENLIBRARY_FIELDS}`;
    } else {
      // Combine texte libre + filtres champ:valeur (syntaxe supportée par
      // OpenLibrary, ex. "first_publish_year:2023 AND publish_date:2023-05").
      const parts: string[] = [];
      if (query) parts.push(query);
      if (year) parts.push(`first_publish_year:${year}`);
      if (year && month) parts.push(`publish_date:"${year}-${month}"`);
      if (subject) parts.push(`subject:"${subject}"`);
      const q = parts.join(" AND ");
      const sort = !query && (year || subject) ? "&sort=rating" : "";
      url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=${OPENLIBRARY_FIELDS}${sort}`;
    }

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`OpenLibrary returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(mapOpenLibraryDocs(data.docs ?? []));
  } catch (err: any) {
    console.error("OpenLibrary search error:", err);
    return NextResponse.json([], { status: 200 }); // Graceful fallback
  }
}
