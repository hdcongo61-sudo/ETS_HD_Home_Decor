# Manifest files (MF) – ETS HD SaaS

Ces fichiers **manifest** définissent les fonctionnalités, modules et identité de l’application. Ils permettent d’évoluer vers un SaaS professionnel sans modifier la logique métier.

## Fichiers

| Fichier | Rôle |
|--------|------|
| **feature-manifest.json** | Liste des fonctionnalités (actuelles et futures). Peut servir pour feature flags, roadmap, ou masquer des entrées de menu. |
| **modules-manifest.json** | Modules métier (Ventes, Caisse, Clients, Produits, etc.) et sous-routes. Utile pour générer la navigation, permissions, ou futurs micro-frontends. |
| **saas-manifest.json** | Identité de l’app (nom, version, thème, PWA, URLs support/confidentialité). Centralise la config “marque” et SaaS. |

## Utilisation prévue

- **Feature manifest** : importer dans l’app et filtrer les routes / liens du menu selon `enabled` et `adminOnly`. Les entrées avec `enabled: false` sont des fonctionnalités à venir.
- **Modules manifest** : alimenter un menu dynamique, breadcrumbs, ou un shell pour micro-frontends (Module Federation plus tard).
- **SaaS manifest** : titre, meta, thème PWA, liens footer (support, CGU, confidentialité) sans coder en dur.

## Logique métier

Aucune logique métier (API, calculs, règles) n’est modifiée par ces manifests. Ils servent uniquement à la **configuration** et à la **structure** de l’interface et des fonctionnalités exposées.
