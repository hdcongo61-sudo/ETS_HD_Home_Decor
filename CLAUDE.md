# ETS HD Home Décor

Gestion des ventes, stock, clients, employés et comptabilité pour ETS HD Home Décor. App multi-tenant (plusieurs entreprises sur la même instance).

## Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT auth, Cloudinary (images), PDFKit/ExcelJS (exports)
- **Frontend**: React 18, React Router, Tailwind CSS, Axios, Chart.js/Recharts
- **Langue UI**: français (fr-FR), devise CFA

## Commandes

```bash
# Racine — lance backend + frontend en parallèle
npm run install:all   # installe les deux
npm start             # backend (nodemon, port 5001) + frontend (port 3000)

# Backend seul
cd backend && npm run server   # nodemon
cd backend && npm run seed     # seed DB

# Frontend seul
cd frontend && npm start
cd frontend && npm run build   # build:css (tailwind) puis react-scripts build
```

Pas de suite de tests configurée (`backend/package.json` test script est un stub). Vérifier manuellement via le serveur de dev + le navigateur pour les changements UI.

## Architecture backend

- `server.js` — point d'entrée, montage des routes, middlewares de sécurité (helmet, rate-limit, mongo-sanitize, xss-clean, hpp, cors)
- `controllers/` — logique métier, un fichier par domaine (pas de séparation systématique controller/service)
- `models/` — schémas Mongoose
- `routes/` — définition des endpoints, protégés par `authMiddleware`
- `middlewares/authMiddleware.js` — `protect` (JWT), rôles admin
- `middlewares/featureMiddleware.js` — `requireFeature` (feature flags par tenant, voir `config/features.js`)
- `utils/tenantGuardPlugin.js` — plugin Mongoose global, **isolation multi-tenant fail-closed** : injecte automatiquement `{ tenantId }` dans toutes les requêtes des schémas qui ont un champ `tenantId`. Sans contexte tenant (super-admin, scripts), rien n'est injecté. Ne pas contourner ce plugin sans comprendre l'impact sécurité.
- Rôle **super-admin** = opérateur plateforme (gestion des tenants), distinct des admins par tenant.

Controllers notables :
- `employeeController.js` — CRUD employés uniquement
- `payrollController.js` — paie, avances, résumé financier, stats dashboard
- `comptabiliteController.js` — module comptabilité (P&L, trésorerie, bilan, journal)
- `tenantController.js` — gestion des tenants (super-admin)
- `subscriptionPaymentController.js` + `utils/pawapay.js` — paiements mobile money via PawaPay (voir `docs/PAWAPAY_PAYMENTS.md`)

## Architecture frontend

- `src/pages/` — une page par écran/route, pas de state management global (pas de Redux), state local ou Context
- `src/context/` — `AuthContext`, `AppSettingsContext`, `ModalContext`
- `src/services/api.js` — client Axios centralisé
- `src/config.js` — `API_URL`, bascule dev/prod

## Décisions clés à respecter

- Pas de limite sur les avances employés (montant libre)
- Champs adresse (address/city/country/postalCode) supprimés du schéma employé — ne pas les réintroduire
- Statut des fiches de paie : `pending`/`paid`/`cancelled`
- Réapprovisionnement fournisseur : pas encore de module dédié (CMP, dette fournisseur) — le stock s'ajoute pour l'instant via le formulaire produit ([voir docs si besoin de réactiver ce chantier])

## Sécurité

- Toute route sensible doit passer par `protect` (et `requireFeature`/vérif rôle si applicable)
- Ne jamais bypasser `tenantGuardPlugin` — c'est la seule barrière anti fuite de données entre tenants
- Secrets dans `.env` (voir `backend/.env.example`), jamais commités
