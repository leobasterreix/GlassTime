import Foundation
import WebKit
import UIKit

/// Encapsule un WKWebView pour un onglet donné : chargement, état observable
/// (chargement, erreur, page de connexion) et politique de navigation.
///
/// Un seul WebViewModel est créé par onglet et conservé pendant toute la vie
/// de l'app : l'instance WKWebView n'est jamais recréée en changeant d'onglet,
/// ce qui préserve l'historique de navigation et le défilement propres à
/// chaque onglet (ex : rester sur la fiche d'une série après être passé sur
/// Profil puis revenu sur Découvrir).
@MainActor
final class WebViewModel: NSObject, ObservableObject {
    let tab: AppTab
    let webView: WKWebView

    @Published var isLoading = false
    @Published var loadError: String?
    @Published var isOnLoginPage = false
    /// Passe à `true` une seule fois, à la fin du tout premier chargement.
    /// Sert à n'afficher le grand indicateur de chargement qu'au lancement,
    /// pas lors d'un tirer-pour-actualiser ou d'un changement de page interne.
    @Published private(set) var hasCompletedFirstLoad = false

    /// Empêche de recharger la page racine si l'onglet a déjà été ouvert une fois.
    private var hasStartedLoading = false
    weak var refreshControl: UIRefreshControl?

    init(tab: AppTab) {
        self.tab = tab

        let configuration = WKWebViewConfiguration()
        // Store persistant : cookies (dont le cookie de session APP_PASSWORD) et
        // localStorage conservés entre les lancements, partagés par les 3 onglets.
        configuration.websiteDataStore = .default()
        // Signale à Next.js que l'app tourne dans le wrapper natif (voir
        // components/TabBar.tsx côté web), pour qu'il masque sa propre barre.
        configuration.applicationNameForUserAgent = Constants.nativeAppUserAgent

        webView = WKWebView(frame: .zero, configuration: configuration)

        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // Évite un double calcul des safe areas : la WebView est déjà en plein
        // écran et le CSS du site gère lui-même les env(safe-area-inset-*).
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Fond sombre par défaut (identique à --bg: #06070d du site) pour éviter
        // un flash blanc avant le premier rendu de la page.
        let brandDark = UIColor(red: 0x06 / 255, green: 0x07 / 255, blue: 0x0D / 255, alpha: 1)
        webView.isOpaque = false
        webView.backgroundColor = brandDark
        webView.scrollView.backgroundColor = brandDark
    }

    /// Charge la page racine de l'onglet, une seule fois (appelé au premier affichage).
    func loadRootIfNeeded() {
        guard !hasStartedLoading else { return }
        hasStartedLoading = true
        webView.load(URLRequest(url: tab.url))
    }

    /// Recharge la page actuelle. Utilisé par le tirer-pour-actualiser et le
    /// bouton « Réessayer » de l'écran d'erreur.
    func reload() {
        loadError = nil
        if webView.url != nil {
            webView.reload()
        } else {
            hasStartedLoading = false
            loadRootIfNeeded()
        }
    }

    @objc func handlePullToRefresh() {
        reload()
    }

    private func updateLoginState() {
        isOnLoginPage = webView.url?.path == "/login"
    }

    private func handleFailure(_ error: Error) {
        isLoading = false
        refreshControl?.endRefreshing()
        let nsError = error as NSError
        // Ignore les annulations volontaires (rechargement rapide, navigation coupée).
        if nsError.code == NSURLErrorCancelled { return }
        loadError = "Impossible de charger GlassTime. Vérifiez votre connexion internet."
    }
}

// MARK: - WKNavigationDelegate

extension WebViewModel: WKNavigationDelegate {
    /// Laisse naviguer librement à l'intérieur du domaine de l'app (fiches
    /// série/film/livre, collections…) ; ouvre tout le reste dans Safari.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url, let host = url.host else {
            decisionHandler(.allow)
            return
        }

        if host == Constants.allowedHost {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        loadError = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        hasCompletedFirstLoad = true
        refreshControl?.endRefreshing()
        updateLoginState()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }
}

// MARK: - WKUIDelegate

extension WebViewModel: WKUIDelegate {
    /// Gère les ouvertures de fenêtre déclenchées en JS (window.open, target="_blank") :
    /// navigue dans la même WebView si c'est le domaine de l'app, ouvre Safari sinon.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }

        if url.host == Constants.allowedHost {
            webView.load(URLRequest(url: url))
        } else {
            UIApplication.shared.open(url)
        }
        return nil
    }
}
