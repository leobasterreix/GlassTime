import SwiftUI

/// Un onglet complet : la WebView, un indicateur de chargement au tout premier
/// affichage, et un écran d'erreur avec bouton de réessai en cas de panne réseau.
struct WebViewContainer: View {
    @ObservedObject var model: WebViewModel

    var body: some View {
        ZStack {
            WebViewRepresentable(model: model)
                .opacity(model.loadError == nil ? 1 : 0)

            if model.isLoading && !model.hasCompletedFirstLoad {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
            }

            if let error = model.loadError {
                ErrorStateView(message: error) {
                    model.reload()
                }
            }
        }
        .onAppear { model.loadRootIfNeeded() }
    }
}

/// Écran affiché lorsque le chargement échoue (pas de réseau, domaine injoignable…).
private struct ErrorStateView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
            Button("Réessayer", action: retry)
                .buttonStyle(.glassProminent)
        }
        .padding(24)
    }
}
