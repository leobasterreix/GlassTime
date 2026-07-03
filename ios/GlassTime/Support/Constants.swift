import Foundation

/// Constantes de configuration de l'application.
enum Constants {
    /// URL de base de l'application web GlassTime (déployée sur Vercel).
    static let baseURL = URL(string: "https://glass-time.vercel.app")!

    /// Hôte autorisé à rester dans la WebView ; tout le reste s'ouvre dans Safari.
    static let allowedHost = baseURL.host ?? ""

    /// Suffixe ajouté au user-agent de la WebView. Next.js le détecte côté client
    /// (voir components/TabBar.tsx) pour masquer sa propre barre d'onglets et
    /// éviter d'avoir deux barres superposées.
    static let nativeAppUserAgent = "GlassTimeNativeApp/1.0"
}
