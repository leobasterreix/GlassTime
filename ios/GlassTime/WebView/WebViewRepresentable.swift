import SwiftUI
import WebKit

/// Pont SwiftUI ↔ UIKit : affiche le WKWebView déjà créé par le WebViewModel.
/// Il n'est jamais recréé par `makeUIView`, ce qui préserve l'état de
/// navigation de l'onglet même si SwiftUI reconstruit la hiérarchie de vues.
struct WebViewRepresentable: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeUIView(context: Context) -> WKWebView {
        let webView = model.webView

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            model,
            action: #selector(WebViewModel.handlePullToRefresh),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl
        model.refreshControl = refreshControl

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Le contenu est entièrement piloté par WebViewModel ; rien à synchroniser ici.
    }
}
