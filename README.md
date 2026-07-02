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
