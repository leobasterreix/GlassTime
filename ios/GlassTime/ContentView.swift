import SwiftUI

/// Vue racine de l'application.
///
/// Les 3 WebViews restent montées en permanence (seules leur opacité et leur
/// interactivité changent selon l'onglet actif) pour ne jamais recréer les
/// WKWebView sous-jacents et préserver la navigation propre à chaque onglet.
///
/// Le contenu web est volontairement dans un groupe séparé de la barre
/// d'onglets : lui seul ignore les zones sûres (plein écran, la Dynamic Island
/// comprise — le CSS du site gère déjà env(safe-area-inset-*)), tandis que la
/// barre flotte normalement au-dessus de la zone sûre du bas, juste au-dessus
/// de l'indicateur d'accueil.
struct ContentView: View {
    @State private var selection: AppTab = .agenda

    // Un WebViewModel par onglet, créé une seule fois et conservé pendant
    // toute la durée de vie de l'app.
    @StateObject private var agendaModel = WebViewModel(tab: .agenda)
    @StateObject private var decouvrirModel = WebViewModel(tab: .decouvrir)
    @StateObject private var profilModel = WebViewModel(tab: .profil)

    private var currentModel: WebViewModel {
        switch selection {
        case .agenda: return agendaModel
        case .decouvrir: return decouvrirModel
        case .profil: return profilModel
        }
    }

    var body: some View {
        ZStack {
            ZStack {
                tabContent(agendaModel, tab: .agenda)
                tabContent(decouvrirModel, tab: .decouvrir)
                tabContent(profilModel, tab: .profil)
            }
            .ignoresSafeArea()

            VStack {
                Spacer()
                // Masquée sur /login : la session a expiré, exactement comme
                // côté web (TabBar.tsx : `if (pathname === "/login") return null`).
                if !currentModel.isOnLoginPage {
                    LiquidTabBar(selection: $selection)
                        .padding(.bottom, 6)
                        .transition(.opacity.combined(with: .scale(scale: 0.92)))
                }
            }
            .animation(.easeInOut(duration: 0.25), value: currentModel.isOnLoginPage)
        }
    }

    @ViewBuilder
    private func tabContent(_ model: WebViewModel, tab: AppTab) -> some View {
        WebViewContainer(model: model)
            .opacity(selection == tab ? 1 : 0)
            .allowsHitTesting(selection == tab)
    }
}

#Preview {
    ContentView()
}
