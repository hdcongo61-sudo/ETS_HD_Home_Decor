# ETS HD Gestion – Proposition SaaS & Redesign

Ce document décrit les changements effectués (sans toucher à la logique métier), les fichiers MF (manifests) ajoutés, et des propositions de fonctionnalités pour faire de l’app un SaaS complet pour l’entreprise.

---

## 1. Ce qui a été fait (sans modifier la logique)

### 1.1 Fichiers MF (Manifest) pour l’avenir

- **`frontend/src/config/manifests/feature-manifest.json`**  
  Liste des fonctionnalités (actuelles et futures). Permet plus tard de gérer des feature flags, de masquer des entrées de menu, ou de piloter une roadmap. Les entrées avec `enabled: false` sont des fonctionnalités prévues (facturation, alertes stock, multi-établissements, clés API).

- **`frontend/src/config/manifests/modules-manifest.json`**  
  Modules métier (Ventes, Caisse, Clients, Produits, Employés, Dépenses, Administration) et sous-routes. Utilisable pour générer la navigation dynamiquement, gérer les permissions, ou préparer des micro-frontends.

- **`frontend/src/config/manifests/saas-manifest.json`**  
  Identité de l’app (nom, version, thème, PWA, URLs support/confidentialité). Centralise la config “marque” et SaaS.

- **`frontend/src/config/manifests/index.js`**  
  Export des manifests pour utilisation future dans l’app (optionnel).

- **`frontend/src/config/manifests/README.md`**  
  Documentation des MF.

**Aucune logique métier n’est modifiée** : ces fichiers servent uniquement à la configuration et à la structure (navigation, branding, roadmap).

### 1.2 Layout et mobile/desktop

- **`frontend/src/components/AppLayout.js`**  
  Wrapper unique pour le contenu principal : largeur max 1600px, padding responsive, prise en compte des safe-areas (encoches mobiles). Aucune logique métier à l’intérieur.

- **`frontend/src/App.js`**  
  Le contenu des routes est enveloppé dans `AppLayout` à la place du simple `div` avec `container mx-auto px-4 py-8`. Comportement et routes inchangés.

- **`frontend/src/index.css`**  
  - `viewport-fit=cover` et safe-areas sur `body` pour les appareils à encoche.  
  - Cibles tactiles minimales (min 44px) sur les boutons pour le tactile.  
  - Classe utilitaire `.safe-area-padding` pour les éléments fixes/sticky.

- **`frontend/public/index.html`**  
  - Meta viewport avec `viewport-fit=cover`.  
  - Description et titre adaptés au positionnement SaaS.  
  - `format-detection` et `apple-mobile-web-app-title` pour une meilleure expérience mobile/PWA.

- **`frontend/public/manifest.json`**  
  - Nom et description alignés sur “ETS HD Gestion – SaaS”.  
  - `display_override` avec `minimal-ui`, catégorie `finance`, `prefer_related_applications: false`, et `purpose` explicite sur les icônes.

- **`frontend/src/tailwind.config.js`**  
  - `maxWidth.saas: 1600px` et breakpoint `touch` pour les médias tactiles (optionnel).

---

## 2. Ce qui n’a pas été modifié (100 % logique préservée)

- **Backend** : aucun fichier modifié.  
- **Contrôleurs, modèles, routes, middlewares** : inchangés.  
- **Contextes (Auth, Modal), hooks, services API** : inchangés.  
- **Logique des pages et composants** : calculs, appels API, règles métier, formulaires, permissions : **inchangés**.  
- **Routes React** : mêmes chemins et mêmes composants.  
- **Navigation** : même structure de liens ; les MF ne sont pas encore branchés au menu (optionnel plus tard).

Toute évolution proposée ci-dessous pourra être faite en s’appuyant sur les MF et le layout, sans casser la logique actuelle.

---

## 3. Pistes de redesign mobile/desktop (sans toucher à la logique) — **APPLIQUÉ**

Les éléments suivants ont été mis en place (présentation uniquement) :

1. **Navigation**  
   - Sur mobile : barre d’onglets en bas (Ventes, Caisse, Clients, Produits) ; menu hamburger pour le reste (Accueil, Dashboard Produits/Utilisateurs, Employés, Dépenses, Déconnexion).  
   - Sur desktop : barre actuelle inchangée.

2. **Listes et tableaux**  
   - CSS `.responsive-table` ajouté : sur petit écran les tableaux avec `data-title` (via `useResponsiveTable`) s'affichent en cartes.  
   - Clients et Employés avaient déjà table + cartes (sm/md) ; le pattern est cohérent.

3. **Formulaires**  
   - Composants `FormLayout`, `FormLayoutFullWidth`, `FormActionsSticky` ajoutés (`components/FormLayout.js`).  
   - Une colonne sur mobile, deux colonnes sur `md+` via `FormLayout` ; `FormActionsSticky` pour les boutons en bas (sticky sur mobile). Exemple : `ExpenseForm`.

4. **Dashboard**  
   - Grille inchangée (1 / 2 / 4 colonnes).  
   - Section « Statistiques des ventes » enveloppée dans `AccordionSection` : repliée par défaut sur mobile, toujours ouverte sur desktop.

5. **Modales**  
   - `Modal.js` : sur mobile le panneau s’affiche en drawer (aligné en bas, `rounded-t-2xl`, `max-h-[90vh]`). Comportement (ouvert/fermé) inchangé.

6. **Double padding**  
   - Wrappers internes retirés ou allégés sur Home, UserSalesDashboard, DeletedSales, SalesArchive, Bank, EditProductForm (padding géré par `AppLayout`).

---

## 4. Nouvelles fonctionnalités proposées pour un SaaS complet

Ces propositions s’appuient sur les entrées “futures” du `feature-manifest` et sur les besoins typiques d’une entreprise.

| Priorité | Fonctionnalité | Description | Impact logique |
|----------|----------------|-------------|----------------|
| Haute | **Facturation / numérotation** | Génération de factures PDF avec numérotation légale, mentions obligatoires, lien vente ↔ facture. | Nouveau module backend (factures), pas de changement aux ventes existantes. |
| Haute | **Paramètres / préférences** | Page Paramètres : devise, format date, seuils d’alerte stock, préférences notifications. | Nouveau modèle ou config, nouveau écran ; logique actuelle inchangée. |
| Haute | **Alertes stock** | Seuils par produit ou par catégorie, notifications (push / email) quand stock &lt; seuil. | Nouveau modèle “alertes”, jobs ou webhooks ; logique stock actuelle inchangée. |
| Moyenne | **Multi-établissements** | Plusieurs points de vente / filiales : filtrage ventes, stock, rapports par établissement. | Nouveau champ “établissement” et filtres ; évolution progressive des modèles. |
| Moyenne | **Clés API / intégrations** | Génération de clés API pour accès externe (compta, e-commerce). | Nouveau modèle “API keys”, middleware auth API ; pas de changement aux flux utilisateur actuels. |
| Moyenne | **Exports planifiés** | Export CSV/Excel ou rapports PDF envoyés par email (quotidien / hebdo). | Jobs côté backend, pas de changement aux exports manuels existants. |
| Basse | **Tableau de bord personnalisable** | Choix des widgets et de leur ordre sur le dashboard. | Préférences utilisateur + layout dynamique ; logique des widgets inchangée. |
| Basse | **Thème (clair/sombre)** | Déjà partiellement en place (Dashboard) ; généraliser à toute l’app via une préférence. | Uniquement CSS / classe sur la racine ; pas de logique métier. |
| Basse | **Support / aide** | Lien “Aide” ou “Support” (URL dans `saas-manifest.json`) et éventuellement FAQ. | Liens et contenu uniquement. |

Vous pouvez activer ces fonctionnalités dans le `feature-manifest` au fur et à mesure (passer `enabled` à `true` et brancher les routes/menus) sans modifier la logique existante.

---

## 5. Résumé

- **MF** : trois manifests (features, modules, SaaS) + README et export JS ; prêts pour feature flags, navigation dynamique et branding.  
- **Layout / mobile** : `AppLayout`, safe-areas, PWA et meta renforcés ; logique des pages et du backend inchangée.  
- **Proposition** : redesign progressif (nav, listes, formulaires, dashboard) en ne touchant qu’à la présentation ; nouvelles fonctionnalités listées ci-dessus pour un SaaS complet, avec impact sur la logique clairement indiqué.

Si vous souhaitez qu’on modifie une partie de la **logique** (ex. ajout d’un modèle Facture ou d’un champ établissement), il faudra le faire de façon explicite et ciblée ; ce document et les MF servent de base pour avancer sans casser l’existant.
