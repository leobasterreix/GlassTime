import Foundation

/// Les trois onglets de l'application, à l'identique de components/TabBar.tsx côté web.
enum AppTab: Int, CaseIterable, Identifiable {
    case agenda
    case decouvrir
    case profil

    var id: Int { rawValue }

    /// Libellé affiché sous l'icône.
    var title: String {
        switch self {
        case .agenda: return "Agenda"
        case .decouvrir: return "Découvrir"
        case .profil: return "Profil"
        }
    }

    /// SF Symbol de l'onglet.
    var systemImage: String {
        switch self {
        case .agenda: return "calendar"
        case .decouvrir: return "safari"
        case .profil: return "person.crop.circle"
        }
    }

    /// Route Next.js correspondante.
    var path: String {
        switch self {
        case .agenda: return "/"
        case .decouvrir: return "/discover"
        case .profil: return "/profile"
        }
    }

    /// URL complète à charger dans la WebView de cet onglet.
    var url: URL {
        URL(string: Constants.baseURL.absoluteString + path)!
    }
}
