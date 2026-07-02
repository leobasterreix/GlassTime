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
};
