export type Episode = {
  s: number;
  e: number;
  title: string;
  airDate: string | null; // ISO, null si date inconnue
};

export type Season = {
  n: number;
  episodes: Episode[];
};

export type Show = {
  id: number;
  title: string;
  year: number;
  genres: string[];
  overview: string;
  poster?: string | null; // URL TMDB, sinon affiche générée
  backdrop?: string | null;
  emoji?: string;
  colors?: [string, string];
  rating?: number;
  trending?: boolean;
  status?: "En cours" | "Terminée";
  runtime?: number; // minutes par épisode
  seasons?: Season[]; // absent sur les résumés (recherche/tendances)
  trailerKey?: string; // YouTube video key
};

export type Movie = {
  id: number;
  title: string;
  year: number;
  genres: string[];
  overview: string;
  poster?: string | null;
  emoji?: string;
  colors?: [string, string];
  runtime?: number;
  rating?: number;
  trailerKey?: string; // YouTube video key
};

export type Review = {
  id: string;
  author: string;
  avatar?: string | null;
  rating?: number | null;
  content: string;
  createdAt: string;
};

export type Book = {
  id: string; // Work ID (ex: OL82563W) ou ISBN
  title: string;
  author: string;
  year: number;
  genres: string[];
  overview: string;
  poster?: string | null; // Cover URL
  pages?: number; // total pages
  rating?: number;
};
