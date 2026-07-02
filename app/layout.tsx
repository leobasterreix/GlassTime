import type { Metadata, Viewport } from "next";
import "./globals.css";
import SyncManager from "@/components/SyncManager";
import TabBar from "@/components/TabBar";

export const metadata: Metadata = {
  title: "GlassTime — Suivi séries & films",
  description:
    "Suivez vos séries et films préférés : épisodes vus, agenda des diffusions, statistiques.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GlassTime",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#06070d",
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
        {children}
        <TabBar />
      </body>
    </html>
  );
}
