import type { Metadata, Viewport } from "next";
import "./globals.css";
import NotificationCenter from "@/components/NotificationCenter";
import SwipeNav from "@/components/SwipeNav";
import SyncManager from "@/components/SyncManager";
import TabBar from "@/components/TabBar";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  title: "GlassTime — Suivi séries, films & livres",
  description:
    "Suivez vos séries, films et livres préférés : épisodes vus, agenda des diffusions, statistiques.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    // Texte sombre sur fond clair (thème SaaS/Tech clair par défaut)
    statusBarStyle: "default",
    title: "GlassTime",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Couleur de la barre du navigateur selon le thème système — doit rester
  // synchro avec --bg dans globals.css (Zinc/Slate clair et sombre).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <div className="aurora" />
        <SyncManager />
        <SwipeNav>{children}</SwipeNav>
        <Toaster />
        <NotificationCenter />
        <TabBar />
      </body>
    </html>
  );
}
