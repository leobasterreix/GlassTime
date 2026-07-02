# GlassTime 📺

Webapp mobile-first de suivi de séries et films (inspirée de TV Time), avec un design **liquid glass** façon Apple.

## Fonctionnalités

- **À suivre** : vos séries, le prochain épisode à voir, marquage rapide "vu", progression par série
- **Découvrir** : recherche, filtres par genre, tendances
- **Fiche série** : saisons dépliables, marquage épisode par épisode, par saison ou série entière
- **Agenda** : prochaines diffusions de vos séries, regroupées par jour
- **Films** : liste "à voir", films vus, découverte
- **Profil** : statistiques (épisodes vus, temps de visionnage, genres favoris) et badges
- Données sauvegardées en local (localStorage) — aucune inscription nécessaire
- Installable sur l'écran d'accueil (PWA manifest)
- **Catalogue TMDB** : avec une clé API (gratuite), recherche mondiale, vraies affiches et épisodes à jour ; sans clé, catalogue de démonstration intégré

## Catalogue TMDB (optionnel mais recommandé)

1. Créer un compte gratuit sur [themoviedb.org](https://www.themoviedb.org/signup), puis générer une clé dans **Paramètres → API**
2. En local : `cp .env.example .env.local` et renseigner `TMDB_API_KEY=…`
3. Sur Vercel : **Settings → Environment Variables** → ajouter `TMDB_API_KEY`, puis redéployer

La clé v3 (« API Key ») et le jeton v4 (« API Read Access Token ») fonctionnent tous les deux. En cas d'absence de clé ou d'erreur TMDB, l'application retombe automatiquement sur le catalogue de démonstration.

## Accès privé (mot de passe)

L'application peut être verrouillée par un mot de passe unique : définir la variable
d'environnement `APP_PASSWORD` (en local dans `.env.local`, sur Vercel dans
**Settings → Environment Variables**). Toutes les pages et routes API sont alors
protégées par un cookie de session d'un an ; le bouton « 🔒 Verrouiller l'appli »
du profil ferme la session. Sans cette variable, l'application est ouverte.

## Synchronisation multi-appareils (optionnel)

Par défaut, les données restent dans le navigateur (localStorage). Pour les
retrouver sur tous vos appareils, connectez une base Redis :

1. Sur Vercel : **Storage → Create Database → Upstash (Redis)**, plan gratuit,
   puis liez-la au projet — les variables `KV_REST_API_URL` et
   `KV_REST_API_TOKEN` sont ajoutées automatiquement
2. Redéployez : la synchronisation s'active toute seule (visible dans Profil →
   Données). Le plus récent gagne ; chaque modification est poussée après
   1,5 s d'inactivité.

## Développement

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 (idéalement en mode responsive mobile).

## Déploiement (GitHub + Vercel)

1. Créer un dépôt sur GitHub, puis :
   ```bash
   git remote add origin git@github.com:<votre-user>/glasstime.git
   git push -u origin main
   ```
2. Sur [vercel.com](https://vercel.com) : **Add New → Project → Import** le dépôt `glasstime`. Framework détecté automatiquement (Next.js), aucun réglage nécessaire.

## Pistes d'évolution

- Brancher l'API [TMDB](https://developer.themoviedb.org) (clé gratuite) pour un catalogue complet avec vraies affiches
- Comptes utilisateurs et synchronisation multi-appareils (Vercel Postgres / Supabase)
- Notifications de diffusion
