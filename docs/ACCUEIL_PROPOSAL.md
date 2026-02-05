# Proposition — Page Accueil (Tableau de bord)

Ce document décrit le redesign de la page **Accueil** (route `/`, composant `Dashboard`) pour un rendu plus professionnel sur **mobile** et **desktop**, ainsi que des pistes d’évolution futures.

---

## 1. Redesign appliqué (sans changer la logique)

### 1.1 Structure et layout

- **Wrapper**  
  - Passage de `min-h-screen p-6` à `min-h-full` avec fond en dégradé (`from-gray-50 to-white` en clair, équivalent en sombre).  
  - Le padding horizontal/vertical est géré par `AppLayout` en amont ; plus de double marge.

- **Chargement**  
  - État de chargement allégé : `min-h-[40vh]`, spinner centré, texte « Chargement du tableau de bord… » pour un rendu plus pro.

### 1.2 En-tête (header)

- **Message d’accueil**  
  - Affichage conditionnel « Bienvenue, [nom] » lorsque l’utilisateur est connecté (`auth.user.name` ou `auth.user.username`).

- **Titre et sous-titre**  
  - Titre : « Tableau de bord » avec hiérarchie typographique (`text-2xl` mobile → `text-3xl` desktop, `font-bold`, `tracking-tight`).  
  - Sous-titre : « Aperçu global des performances » en `text-sm` / `text-base` selon la taille d’écran.

- **Contrôles (période, thème, comparaison, export)**  
  - Hauteur minimale **44px** sur les boutons et champs pour une bonne zone tactile sur mobile.  
  - Sélecteurs et boutons en `rounded-xl`, libellés de comparaison raccourcis sur mobile (« Vs semaine préc. », etc.).  
  - Bouton Exporter : icône `Download` + texte « Exporter » masqué sur très petit écran pour gagner de la place.  
  - Thème unifié (indigo pour actions principales, bordures cohérentes).

### 1.3 Cartes KPI (Ventes, Encaissements, Dépenses, Profit)

- **Grille**  
  - 1 colonne sur mobile, 2 sur `sm`, 4 sur `xl` ; espacement `gap-3` / `gap-4` selon la taille d’écran.

- **Contenu**  
  - Icônes en taille fixe (`size={22}`), tendance (↑/↓ + pourcentage) en haut à droite.  
  - Titre en `text-sm`, valeur en `text-xl` / `text-2xl` avec `tabular-nums` pour un alignement propre des chiffres.  
  - Effet au survol léger (`scale: 1.01`), ombre renforcée au hover.

- **Accessibilité**  
  - Bloc des KPI en `<section aria-label="Indicateurs clés">`, chaque carte en `<article>`.

### 1.4 Carte « Analyse financière » (graphique)

- **Conteneur**  
  - Carte avec `rounded-2xl`, bordure, ombre ; badge « Comparaison activée/désactivée » en petit en haut à droite.

- **Bouton « Détails du jour »**  
  - Pleine largeur sur mobile (`w-full`), hauteur 44px, libellé et icône centrés.

- **Graphique**  
  - Hauteur responsive : `h-64` sur mobile, `h-72` sur `sm+` pour garder une bonne lisibilité.

---

## 2. Ce qui n’a pas été modifié

- **Logique métier** : calculs, appels API, filtres par période, comparaison, export Excel, rappels, statistiques des ventes, etc.  
- **Composants enfants** : `AccordionSection`, `BusinessAnalyticsDashboard`, `RemindersPanel`, `DayDetailsModal`, `ExportModal`.  
- **Données** : mêmes sources et mêmes props ; aucun changement de contrat d’API.

---

## 3. Pistes d’évolution futures (proposition)

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| Haute | **Raccourcis rapides** | Sur l’Accueil, liens ou boutons directs vers « Nouvelle vente », « Ventes », « Caisse », « Clients » pour réduire le nombre de clics. |
| Haute | **Widgets personnalisables** | Permettre à l’utilisateur de réorganiser ou masquer des blocs (KPI, graphique, stats ventes, rappels) et persister le layout (localStorage ou préférences serveur). |
| Moyenne | **Résumé du jour** | Encart « Aujourd’hui » : ventes du jour, encaissements du jour, objectif du jour (si configuré). |
| Moyenne | **Notifications / alertes sur l’Accueil** | Affichage des alertes stock, rappels de paiement ou tâches du jour directement sur le tableau de bord. |
| Basse | **Thème Accueil dédié** | Option « Vue compacte » vs « Vue détaillée » pour adapter la densité d’information (mobile vs grand écran). |
| Basse | **Export / impression** | Bouton « Imprimer le tableau de bord » ou « Exporter en PDF » pour une vue figée de l’Accueil. |

---

## 4. Fichiers concernés

- **`frontend/src/pages/Home.js`**  
  - Inchangé : affiche uniquement `<Dashboard />`.

- **`frontend/src/components/Dashboard.js`**  
  - Modifications limitées au **rendu** (structure, classes, accessibilité, message d’accueil).  
  - Aucune modification des hooks, des appels API ni des calculs.

- **`frontend/src/components/AppLayout.js`**  
  - Inchangé ; continue de fournir le padding et la largeur max au contenu (dont l’Accueil).

---

## 5. Résumé

- **Accueil** : redesign **présentationnel** (header avec bienvenue, KPI en cartes, graphique en carte, chargement allégé, mobile-first avec zones tactiles 44px).  
- **Logique** : 100 % préservée.  
- **Proposition** : ce fichier sert de base pour les évolutions listées en section 3 (raccourcis, widgets, résumé du jour, alertes, options d’affichage, export PDF/impression).
