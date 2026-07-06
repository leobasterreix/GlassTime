import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
    ],
  },
  // Anciennes routes (avant la refonte de la navigation à 3 onglets)
  async redirects() {
    return [
      { source: "/calendar", destination: "/", permanent: false },
      { source: "/movies", destination: "/discover", permanent: false },
      { source: "/books", destination: "/discover", permanent: false },
    ];
  },
};

export default nextConfig;
