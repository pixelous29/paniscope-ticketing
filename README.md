
# Paniscope Ticketing

![Statut CI](https://github.com/pixelous29/paniscope-ticketing/actions/workflows/ci.yml/badge.svg)

## Description

Paniscope Ticketing est un projet React/Vite avec un système de tests unitaires (Vitest), de linting (ESLint), et un déploiement continu via Firebase Hosting grâce à GitHub Actions.

## Technologies utilisées

- ⚛️ React 19
- ⚡ Vite 7
- ✅ Vitest pour les tests unitaires
- 📏 ESLint pour l’analyse statique du code
- ☁️ Firebase Hosting pour le déploiement
- 🛠️ GitHub Actions pour CI/CD

## Arborescence de base

```
paniscope-ticketing/
├── frontend/
│   ├── dist/               # Build généré par Vite
│   ├── public/             # Fichiers publics
│   ├── src/                # Code source
│   ├── __tests__/          # Fichiers de test Vitest
│   ├── package.json        # Scripts npm & dépendances
│   ├── vite.config.js      # Configuration Vite
│   └── firebase.json       # Configuration Firebase Hosting
├── .github/
│   └── workflows/
│       └── ci.yml          # Pipeline CI/CD GitHub Actions
└── README.md
```

## Scripts disponibles (dans `/frontend`)

- `npm run dev` : Lance le serveur de développement Vite
- `npm run lint` : Vérifie le code avec ESLint
- `npm run test` : Exécute les tests avec Vitest
- `npm run build` : Génére la version de production

## CI/CD avec GitHub Actions

Le fichier `.github/workflows/ci.yml` réalise les actions suivantes :

### Étapes CI (intégration continue)

1. **Lint du code** (`npm run lint`)
2. **Tests unitaires** (`npm run test`)
3. **Build du projet** (`npm run build`)

### Étapes CD (déploiement continu)

- Un déploiement automatique vers Firebase Hosting est effectué si le `push` est fait sur la branche `main`.

## Configuration Firebase Hosting

Tu dois avoir un fichier `firebase.json` dans `/frontend` avec :

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

## Variables secrètes GitHub à configurer

- `FIREBASE_TOKEN` : Jeton CI généré avec `firebase login:ci`

## Déploiement local

```bash
cd frontend
npm install
npm run build
firebase deploy
```

## Push Git

```bash
git add .
git commit -m "exemple : Ajout de la configuration complète CI/CD + mise à jour du README"
git push origin main

git status 'vérifier que tout est prêt'

git diff --cached  'vérifier avant de push'

```


## Auteur

Projet initié par Yves Le Signor
