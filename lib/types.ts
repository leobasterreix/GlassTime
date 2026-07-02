export type Episode = {
  s: number;
  e: number;
  title: string;
  airDate: string; // ISO
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
  status: "En cours" | "Terminée";
  runtime: number; // minutes par épisode
  emoji: string;
  colors: [string, string];
  overview: string;
  trending?: boolean;
  seasons: Season[];
};

export type Movie = {
  id: number;
  title: string;
  year: number;
  runtime: number;
  genres: string[];
  emoji: string;
  colors: [string, string];
  overview: string;
  rating: number; // sur 10
};
