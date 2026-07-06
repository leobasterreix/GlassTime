import type { Book } from "./types";

/** Champs demandés explicitement : "subject" n'est pas renvoyé par défaut. */
export const OPENLIBRARY_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,ratings_average,subject";

export function mapOpenLibraryDoc(doc: any): Book {
  // Extrait l'ID d'œuvre depuis "/works/OL82563W" -> "OL82563W"
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
}

export function mapOpenLibraryDocs(docs: any[]): Book[] {
  return docs.map(mapOpenLibraryDoc).filter((b) => b.id && b.title);
}

/** Fiche complète d'un livre (résumé inclus) à partir de son ID d'œuvre OpenLibrary. */
export async function getBookDetail(id: string): Promise<Book | null> {
  try {
    const searchUrl = `https://openlibrary.org/search.json?q=key:/works/${id}&limit=1`;
    const workUrl = `https://openlibrary.org/works/${id}.json`;

    const [searchRes, workRes] = await Promise.all([
      fetch(searchUrl, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }).catch(() => null),
      fetch(workUrl, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }).catch(() => null),
    ]);

    if (!searchRes || !searchRes.ok) return null;

    const searchData = await searchRes.json();
    const doc = searchData.docs?.[0];
    if (!doc) return null;

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

    return {
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
  } catch (err) {
    console.error("Book detail error:", err);
    return null;
  }
}
