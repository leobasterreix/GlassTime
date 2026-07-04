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
