# GlassTime iOS

Coquille native SwiftUI (iOS 26) qui enveloppe l'application web
[GlassTime](https://glass-time.vercel.app) dans une vraie app installable via
l'App Store. Tout le contenu et la logique métier restent en web (mis à jour
via Vercel/GitHub, sans jamais repasser par l'App Store) ; seule la barre
d'onglets du bas est du SwiftUI natif avec l'effet Liquid Glass d'iOS 26.

## Ouvrir le projet

```bash
open GlassTime.xcodeproj
```

Le projet est généré par [XcodeGen](https://github.com/yonaskolb/XcodeGen)
à partir de `project.yml`. Après une modification de `project.yml` (nouveau
target, réglage de build…), régénérer avec :

```bash
brew install xcodegen   # si pas déjà installé
xcodegen generate
```

Ajouter un nouveau fichier Swift dans `GlassTime/` ne nécessite **pas** de
régénérer : XcodeGen inclut tout le contenu du dossier automatiquement, et
Xcode enregistre lui-même les fichiers créés depuis son propre menu.

## Architecture

```
GlassTime/
├── GlassTimeApp.swift       point d'entrée @main
├── ContentView.swift        assemble les 3 WebViews + la barre flottante
├── Support/Constants.swift  URL de base, hôte autorisé, user-agent natif
├── Models/AppTab.swift      les 3 onglets (titre, icône, route)
├── WebView/
│   ├── WebViewModel.swift        WKWebView + délégués de navigation
│   ├── WebViewRepresentable.swift pont UIViewRepresentable
│   └── WebViewContainer.swift     chargement, erreur, tirer-pour-actualiser
└── TabBar/LiquidTabBar.swift  barre pilule flottante, .glassEffect() natif
```

**Un WebViewModel par onglet, créé une seule fois.** Les 3 WKWebView restent
montées en permanence (seules leur opacité et leur interactivité changent) :
naviguer dans une fiche série puis changer d'onglet et revenir la préserve
exactement là où on l'a laissée, comme dans une vraie app native.

**Session et cookies partagés.** Les 3 WebViews utilisent le même
`WKWebsiteDataStore.default()` (store persistant, non-éphémère) : le cookie
de session `APP_PASSWORD` est donc partagé entre les onglets et survit aux
relances de l'app.

**Barre native masquée sur `/login`**, exactement comme `TabBar.tsx` côté web
(`if (pathname === "/login") return null`) — la session expirée redirige
vers /login, et la barre SwiftUI se retire pour laisser la page de connexion
web occuper tout l'écran.

**Pas de double barre de navigation.** La WebView envoie un user-agent
personnalisé (`Constants.nativeAppUserAgent`, ajouté via
`WKWebViewConfiguration.applicationNameForUserAgent`) ; côté web,
`components/TabBar.tsx` détecte ce marqueur et masque sa propre barre. Les
deux valeurs doivent rester synchronisées si l'une est renommée.

**Navigation interne vs externe.** `decidePolicyFor` et `createWebViewWith`
laissent naviguer librement à l'intérieur du domaine de l'app (fiches
série/film/livre, collections…) et ouvrent tout le reste (liens externes,
`target="_blank"` hors domaine) dans Safari.

## Note sur le rendu Liquid Glass

`GlassEffectContainer` combine mal plusieurs `.glassEffect()` imbriqués ou
trop proches (« le verre ne peut pas échantillonner un autre verre ») : des
artefacts de rendu ont été observés en testant sur simulateur en imbriquant
un halo de sélection en `.glassEffect()` à l'intérieur d'un conteneur qui en
avait déjà un. `LiquidTabBar` n'utilise donc qu'**un seul** `.glassEffect()`
natif (la pilule de fond) ; le halo de l'onglet sélectionné est un
`matchedGeometryEffect` classique (dégradé bleu → violet), plus simple et
fiable, sans rien retirer au flou/à la réfraction natifs du fond.

Le rendu du flou/réfraction est généralement plus flatteur sur un appareil
réel que sur le simulateur (qui approxime l'effet plutôt que d'utiliser le
même pipeline GPU) — à vérifier sur iPhone si le résultat au simulateur
semble en retrait.

## Vérifié

- Build réel (`xcodebuild`, pas seulement la compilation) sur simulateur
  iPhone 17 Pro Max, iOS 26.4 : succès
- Lancement sans crash, barre Liquid Glass affichée sans artefact
- Chargement réel du contenu depuis `https://glass-time.vercel.app` dans la
  WebView (page Agenda visible avec son contenu réel)
- Détection du user-agent natif côté web : logique testée (matche un
  user-agent natif réaliste, ne se déclenche jamais sur un navigateur
  classique), non-régression de l'affichage en navigateur confirmée

## À vérifier vous-même

- Changement d'onglet à la volée (Agenda ↔ Découvrir ↔ Profil) : l'aller-retour
  entre onglets n'a pas pu être simulé par tap depuis cet environnement
  (pas d'outil d'automatisation UI installé) — l'implémentation suit un
  pattern SwiftUI standard et bien établi (opacity + allowsHitTesting sur un
  ZStack), mais un test manuel rapide est recommandé
- Comportement sur `/login` : nécessite de réactiver l'authentification côté
  web (actuellement en bypass temporaire, voir `middleware.ts`) pour observer
  la barre native se masquer en conditions réelles
- Rendu Liquid Glass sur appareil physique (voir note ci-dessus)
- Tirer-pour-actualiser et écran d'erreur réseau (couper le Wi-Fi pendant le
  chargement) : implémentés mais pas testés en conditions de coupure réelle
