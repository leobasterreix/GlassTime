import type { Movie, Season, Show } from "./types";
import { DAY } from "./utils";

const NOW = Date.now();

/** Saison terminée : épisodes hebdomadaires à partir d'une date passée. */
function season(n: number, count: number, start: string): Season {
  const t0 = new Date(start).getTime();
  return {
    n,
    episodes: Array.from({ length: count }, (_, i) => ({
      s: n,
      e: i + 1,
      title: `Épisode ${i + 1}`,
      airDate: new Date(t0 + i * 7 * DAY).toISOString(),
    })),
  };
}

/** Saison en cours de diffusion : le 1er épisode a été diffusé il y a `agoDays` jours, puis hebdomadaire. */
function liveSeason(n: number, count: number, agoDays: number): Season {
  const t0 = NOW - agoDays * DAY;
  return {
    n,
    episodes: Array.from({ length: count }, (_, i) => ({
      s: n,
      e: i + 1,
      title: `Épisode ${i + 1}`,
      airDate: new Date(t0 + i * 7 * DAY).toISOString(),
    })),
  };
}

export const SHOWS: Show[] = [
  {
    id: 1,
    title: "Breaking Bad",
    year: 2008,
    genres: ["Drame", "Crime"],
    status: "Terminée",
    runtime: 47,
    emoji: "🧪",
    colors: ["#0f3d2e", "#1f8a5f"],
    overview:
      "Un professeur de chimie atteint d'un cancer se lance dans la fabrication de méthamphétamine pour assurer l'avenir de sa famille.",
    trending: true,
    seasons: [
      season(1, 7, "2008-01-20"),
      season(2, 13, "2009-03-08"),
      season(3, 13, "2010-03-21"),
      season(4, 13, "2011-07-17"),
      season(5, 16, "2012-07-15"),
    ],
  },
  {
    id: 2,
    title: "Stranger Things",
    year: 2016,
    genres: ["Science-fiction", "Horreur"],
    status: "En cours",
    runtime: 51,
    emoji: "🚲",
    colors: ["#3d0b0b", "#c1272d"],
    overview:
      "À Hawkins, la disparition d'un jeune garçon révèle des expériences secrètes et un monde parallèle terrifiant.",
    trending: true,
    seasons: [
      season(1, 8, "2016-07-15"),
      season(2, 9, "2017-10-27"),
      season(3, 8, "2019-07-04"),
      season(4, 9, "2022-05-27"),
      liveSeason(5, 8, 16),
    ],
  },
  {
    id: 3,
    title: "Game of Thrones",
    year: 2011,
    genres: ["Fantasy", "Drame"],
    status: "Terminée",
    runtime: 57,
    emoji: "🐉",
    colors: ["#1a1f2e", "#5a6b8c"],
    overview:
      "Plusieurs familles nobles se disputent le Trône de Fer de Westeros pendant qu'une menace ancienne s'éveille au nord.",
    seasons: [
      season(1, 10, "2011-04-17"),
      season(2, 10, "2012-04-01"),
      season(3, 10, "2013-03-31"),
      season(4, 10, "2014-04-06"),
      season(5, 10, "2015-04-12"),
      season(6, 10, "2016-04-24"),
      season(7, 7, "2017-07-16"),
      season(8, 6, "2019-04-14"),
    ],
  },
  {
    id: 4,
    title: "The Office",
    year: 2005,
    genres: ["Comédie"],
    status: "Terminée",
    runtime: 22,
    emoji: "📎",
    colors: ["#2e2a1f", "#8c7a4b"],
    overview:
      "Le quotidien absurde des employés d'une entreprise de papier à Scranton, filmé façon documentaire.",
    seasons: [
      season(1, 6, "2005-03-24"),
      season(2, 22, "2005-09-20"),
      season(3, 25, "2006-09-21"),
      season(4, 19, "2007-09-27"),
      season(5, 28, "2008-09-25"),
      season(6, 26, "2009-09-17"),
      season(7, 26, "2010-09-23"),
      season(8, 24, "2011-09-22"),
      season(9, 25, "2012-09-20"),
    ],
  },
  {
    id: 5,
    title: "Succession",
    year: 2018,
    genres: ["Drame"],
    status: "Terminée",
    runtime: 60,
    emoji: "🏙️",
    colors: ["#101418", "#3e4c5e"],
    overview:
      "La famille Roy se déchire pour le contrôle d'un empire médiatique mondial vieillissant.",
    seasons: [
      season(1, 10, "2018-06-03"),
      season(2, 10, "2019-08-11"),
      season(3, 9, "2021-10-17"),
      season(4, 10, "2023-03-26"),
    ],
  },
  {
    id: 6,
    title: "The Last of Us",
    year: 2023,
    genres: ["Drame", "Science-fiction"],
    status: "En cours",
    runtime: 55,
    emoji: "🍄",
    colors: ["#1c2416", "#5c7a45"],
    overview:
      "Vingt ans après une pandémie fongique, Joel escorte Ellie à travers une Amérique dévastée.",
    trending: true,
    seasons: [
      season(1, 9, "2023-01-15"),
      season(2, 7, "2025-04-13"),
      liveSeason(3, 8, 9),
    ],
  },
  {
    id: 7,
    title: "Severance",
    year: 2022,
    genres: ["Thriller", "Science-fiction"],
    status: "En cours",
    runtime: 50,
    emoji: "💼",
    colors: ["#0c1b24", "#2e7d9e"],
    overview:
      "Chez Lumon, des employés subissent une opération séparant leurs souvenirs professionnels et personnels.",
    trending: true,
    seasons: [
      season(1, 9, "2022-02-18"),
      season(2, 10, "2025-01-17"),
      liveSeason(3, 10, 2),
    ],
  },
  {
    id: 8,
    title: "The Bear",
    year: 2022,
    genres: ["Drame", "Comédie"],
    status: "En cours",
    runtime: 32,
    emoji: "🔪",
    colors: ["#241a12", "#a3552e"],
    overview:
      "Un jeune chef étoilé reprend la sandwicherie familiale de Chicago et tente d'en faire un grand restaurant.",
    seasons: [
      season(1, 8, "2022-06-23"),
      season(2, 10, "2023-06-22"),
      season(3, 10, "2024-06-26"),
      liveSeason(4, 10, 23),
    ],
  },
  {
    id: 9,
    title: "Dark",
    year: 2017,
    genres: ["Science-fiction", "Thriller"],
    status: "Terminée",
    runtime: 53,
    emoji: "⏳",
    colors: ["#0b0e14", "#39465e"],
    overview:
      "La disparition d'enfants à Winden révèle les secrets de quatre familles liées à travers le temps.",
    seasons: [
      season(1, 10, "2017-12-01"),
      season(2, 8, "2019-06-21"),
      season(3, 8, "2020-06-27"),
    ],
  },
  {
    id: 10,
    title: "Friends",
    year: 1994,
    genres: ["Comédie"],
    status: "Terminée",
    runtime: 22,
    emoji: "☕",
    colors: ["#2a1f33", "#8c5fa8"],
    overview:
      "Six amis new-yorkais traversent ensemble les hauts et les bas de la vie, de l'amour et du travail.",
    seasons: Array.from({ length: 10 }, (_, i) =>
      season(i + 1, 24, `${1994 + i}-09-22`)
    ),
  },
  {
    id: 11,
    title: "The Mandalorian",
    year: 2019,
    genres: ["Science-fiction", "Aventure"],
    status: "En cours",
    runtime: 40,
    emoji: "🪖",
    colors: ["#1f1a10", "#7d6a3a"],
    overview:
      "Un chasseur de primes solitaire protège un mystérieux enfant dans les confins de la galaxie.",
    seasons: [
      season(1, 8, "2019-11-12"),
      season(2, 8, "2020-10-30"),
      season(3, 8, "2023-03-01"),
    ],
  },
  {
    id: 12,
    title: "Peaky Blinders",
    year: 2013,
    genres: ["Crime", "Drame"],
    status: "Terminée",
    runtime: 58,
    emoji: "🎩",
    colors: ["#14171c", "#4a5568"],
    overview:
      "À Birmingham après la Première Guerre mondiale, Thomas Shelby fait prospérer le gang familial.",
    seasons: Array.from({ length: 6 }, (_, i) =>
      season(i + 1, 6, `${2013 + i * 2}-09-12`)
    ),
  },
  {
    id: 13,
    title: "Arcane",
    year: 2021,
    genres: ["Animation", "Fantasy"],
    status: "Terminée",
    runtime: 42,
    emoji: "⚗️",
    colors: ["#1c1230", "#7a4fd1"],
    overview:
      "Deux sœurs que tout oppose s'affrontent entre la cité radieuse de Piltover et les bas-fonds de Zaun.",
    trending: true,
    seasons: [season(1, 9, "2021-11-06"), season(2, 9, "2024-11-09")],
  },
  {
    id: 14,
    title: "Ted Lasso",
    year: 2020,
    genres: ["Comédie", "Sport"],
    status: "En cours",
    runtime: 34,
    emoji: "⚽",
    colors: ["#122414", "#3f8c4a"],
    overview:
      "Un coach de football américain débarque en Angleterre pour entraîner une équipe de Premier League… sans rien y connaître.",
    seasons: [
      season(1, 10, "2020-08-14"),
      season(2, 12, "2021-07-23"),
      season(3, 12, "2023-03-15"),
      liveSeason(4, 12, 30),
    ],
  },
  {
    id: 15,
    title: "House of the Dragon",
    year: 2022,
    genres: ["Fantasy", "Drame"],
    status: "En cours",
    runtime: 60,
    emoji: "🔥",
    colors: ["#240f0f", "#a83232"],
    overview:
      "Deux cents ans avant Game of Thrones, la maison Targaryen se déchire dans une guerre civile dévastatrice.",
    trending: true,
    seasons: [
      season(1, 10, "2022-08-21"),
      season(2, 8, "2024-06-16"),
      liveSeason(3, 8, -4),
    ],
  },
  {
    id: 16,
    title: "Lupin",
    year: 2021,
    genres: ["Thriller", "Crime"],
    status: "En cours",
    runtime: 45,
    emoji: "🎭",
    colors: ["#101c2e", "#3a6ea5"],
    overview:
      "Inspiré par Arsène Lupin, Assane Diop orchestre des vols spectaculaires pour venger son père.",
    seasons: [
      season(1, 5, "2021-01-08"),
      season(2, 5, "2021-06-11"),
      season(3, 7, "2023-10-05"),
      liveSeason(4, 7, 12),
    ],
  },
];

export const MOVIES: Movie[] = [
  {
    id: 101,
    title: "Inception",
    year: 2010,
    runtime: 148,
    genres: ["Science-fiction", "Thriller"],
    emoji: "🌀",
    colors: ["#101828", "#3b5b8c"],
    overview: "Un voleur infiltre les rêves pour implanter une idée dans l'esprit d'un héritier.",
    rating: 8.4,
  },
  {
    id: 102,
    title: "Interstellar",
    year: 2014,
    runtime: 169,
    genres: ["Science-fiction", "Drame"],
    emoji: "🚀",
    colors: ["#0b1220", "#4a5f8c"],
    overview: "Des explorateurs traversent un trou de ver pour trouver un nouveau foyer à l'humanité.",
    rating: 8.4,
  },
  {
    id: 103,
    title: "Parasite",
    year: 2019,
    runtime: 132,
    genres: ["Thriller", "Drame"],
    emoji: "🏠",
    colors: ["#141d16", "#3e6b4a"],
    overview: "Une famille pauvre s'infiltre au service d'une famille riche, jusqu'au point de rupture.",
    rating: 8.5,
  },
  {
    id: 104,
    title: "Dune : Deuxième partie",
    year: 2024,
    runtime: 166,
    genres: ["Science-fiction", "Aventure"],
    emoji: "🏜️",
    colors: ["#241a0e", "#a8763a"],
    overview: "Paul Atreides s'unit aux Fremen pour venger sa famille et affronter son destin.",
    rating: 8.2,
  },
  {
    id: 105,
    title: "Oppenheimer",
    year: 2023,
    runtime: 180,
    genres: ["Drame", "Histoire"],
    emoji: "💥",
    colors: ["#1c130c", "#8c5a2e"],
    overview: "Le physicien J. Robert Oppenheimer dirige le projet Manhattan et en porte le poids moral.",
    rating: 8.1,
  },
  {
    id: 106,
    title: "La La Land",
    year: 2016,
    runtime: 128,
    genres: ["Romance", "Musical"],
    emoji: "🎹",
    colors: ["#1a1030", "#6a4fd1"],
    overview: "À Los Angeles, une actrice et un pianiste de jazz poursuivent leurs rêves au prix de leur amour.",
    rating: 8.0,
  },
  {
    id: 107,
    title: "Le Voyage de Chihiro",
    year: 2001,
    runtime: 125,
    genres: ["Animation", "Fantasy"],
    emoji: "🐲",
    colors: ["#0e1f24", "#3a8c8c"],
    overview: "Une fillette égarée dans un monde d'esprits doit travailler pour sauver ses parents.",
    rating: 8.6,
  },
  {
    id: 108,
    title: "The Dark Knight",
    year: 2008,
    runtime: 152,
    genres: ["Action", "Crime"],
    emoji: "🦇",
    colors: ["#0b0d12", "#2e3a52"],
    overview: "Batman affronte le Joker, un criminel qui veut plonger Gotham dans le chaos.",
    rating: 8.5,
  },
  {
    id: 109,
    title: "Pulp Fiction",
    year: 1994,
    runtime: 154,
    genres: ["Crime", "Drame"],
    emoji: "🍔",
    colors: ["#1f140e", "#8c4a2e"],
    overview: "Les destins croisés de gangsters, d'un boxeur et de braqueurs dans le Los Angeles des années 90.",
    rating: 8.5,
  },
  {
    id: 110,
    title: "Le Fabuleux Destin d'Amélie Poulain",
    year: 2001,
    runtime: 122,
    genres: ["Comédie", "Romance"],
    emoji: "🍬",
    colors: ["#1c2410", "#7a8c2e"],
    overview: "Une serveuse de Montmartre décide en secret d'arranger la vie de ceux qui l'entourent.",
    rating: 8.3,
  },
  {
    id: 111,
    title: "Everything Everywhere All at Once",
    year: 2022,
    runtime: 139,
    genres: ["Science-fiction", "Comédie"],
    emoji: "🥯",
    colors: ["#1f1024", "#a83a8c"],
    overview: "Une gérante de laverie découvre qu'elle doit sauver le multivers en explorant ses autres vies.",
    rating: 7.9,
  },
  {
    id: 112,
    title: "Whiplash",
    year: 2014,
    runtime: 107,
    genres: ["Drame", "Musical"],
    emoji: "🥁",
    colors: ["#1c1408", "#8c6a2e"],
    overview: "Un jeune batteur de jazz se heurte à un professeur aussi brillant qu'impitoyable.",
    rating: 8.5,
  },
];

export function getShow(id: number): Show | undefined {
  return SHOWS.find((s) => s.id === id);
}

export function getMovie(id: number): Movie | undefined {
  return MOVIES.find((m) => m.id === id);
}

export const GENRES = Array.from(
  new Set(SHOWS.flatMap((s) => s.genres))
).sort((a, b) => a.localeCompare(b, "fr"));
