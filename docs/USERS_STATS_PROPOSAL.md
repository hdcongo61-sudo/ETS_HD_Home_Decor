# Proposition — Page Dashboard Utilisateurs (/users/stats)

Ce document décrit le redesign de la page **Dashboard administrateur** (route `/users/stats`, composant `DashboardAdmin`) pour un rendu plus professionnel sur **mobile** et **desktop**, ainsi que des pistes d’évolution futures.

---

## 1. Redesign appliqué (sans changer la logique)

### 1.1 Structure et layout

- **Wrapper**  
  - Passage à un conteneur `min-h-full` avec fond en dégradé (`from-gray-50 to-white` en clair, équivalent en sombre).  
  - Espacement interne cohérent (`space-y-4` / `space-y-6`) ; plus de double marge avec `AppLayout`.

- **Accès non-admin**  
  - Bloc « Accès administrateur requis » recentré, carte avec bordure et ombre, bouton « Retour à l’accueil » avec icône chevron et hauteur tactile 44px. Support du mode sombre.

### 1.2 En-tête (header)

- **Retour**  
  - Lien « Retour à l’accueil » avec icône `ChevronLeft` dans un bouton arrondi (44px), visible sur mobile et desktop.

- **Titre et sous-titre**  
  - Icône `Users` dans un badge indigo, titre « Dashboard administrateur » (`text-xl` → `text-2xl`), sous-titre « Utilisateurs, ventes et connexions » en `text-xs` / `text-sm`.

- **Actions**  
  - Badge « Mode Admin » et bouton « Actualiser » avec icône `RefreshCw` ; libellé « Actualiser » masqué sur très petit écran. Hauteur minimale 44px pour le bouton.

### 1.3 Onglets (tabs)

- **Navigation**  
  - Quatre onglets : Tableau de bord, Stats ventes, Connexions, Utilisateurs. Chaque onglet a une icône (BarChart3, LogIn, UserCog) et un libellé court pour mobile.

- **Comportement**  
  - Scroll horizontal sur mobile (`overflow-x-auto`), pas de scroll sur desktop. Onglet actif : fond indigo, texte blanc ; inactif : fond blanc/gris, bordure.

- **Accessibilité**  
  - `aria-label="Sections du tableau de bord"` sur la `nav`, `type="button"` sur les boutons d’onglets.

### 1.4 Onglet « Tableau de bord »

- **KPI (StatCard)**  
  - Quatre cartes : Utilisateurs totaux, Utilisateurs actifs, Administrateurs, Inscriptions récentes.  
  - Composant `StatCard` simplifié : plus de prop `icon` (path SVG), utilisation d’icônes Lucide par couleur (Users, BarChart3, UserCog).  
  - Cartes en `article`, grille 1 / 2 / 4 colonnes (mobile / sm / lg), bordure, ombre, hover. Support du mode sombre.

- **Graphiques**  
  - Deux sections : « Répartition des rôles » (Pie), « Activité récente » (Bar).  
  - Cartes avec `rounded-2xl`, bordure, padding responsive (`p-4 sm:p-6`). Hauteur des graphiques `h-56 sm:h-64`.

- **Utilisateurs récemment inscrits**  
  - **Mobile** : liste en cartes (avatar, nom, email, rôle, date) avec `sm:hidden`.  
  - **Desktop** : tableau avec `hidden sm:block`, thead/tbody avec styles dark. Lien vers détail utilisateur non modifié (tableau seul ; les cartes mobiles pourraient à l’avenir pointer vers le profil).

### 1.5 Onglet « Statistiques des ventes »

- **En-tête**  
  - Titre responsive, sélecteur de période et bouton « Actualiser » avec `min-h-[44px]`, `RefreshCw`. Support dark.

- **Bloc erreur / chargement**  
  - Message d’erreur avec icône, fond rouge clair/sombre. État de chargement : spinner + texte « Chargement des stats… ».

- **Contenu**  
  - Grille : graphique « Performance des vendeurs » (Bar) + trois cartes (Chiffre d’affaires total, Bénéfice total, Transactions totales). Cartes avec couleurs (blue, green, purple) et variantes dark.

- **Liste par utilisateur**  
  - **Mobile** : une seule liste de cartes (suppression du doublon). Chaque carte est un `Link` vers `/sales/user/:userId`. Avatar, nom, email, nombre de clients, puis grille 2 colonnes (Transactions, CA, Bénéfice, Vente moyenne).  
  - **Desktop** : tableau existant avec `responsive-table`, inchangé dans sa logique.

### 1.6 Ce qui n’a pas été modifié

- **Logique métier** : appels API (`/users/stats`, `/sales/user-stats`), calculs (profit, totaux), onglets (état `activeTab`), sous-composants `ResumeConnexions`, `UserManagement`.  
- **Routes et permissions** : accès réservé aux admins ; redirection ou message d’erreur inchangés.  
- **Données** : structure des réponses API et des props passées aux enfants inchangée.

---

## 2. Fichiers concernés

- **`frontend/src/pages/DashboardAdmin.js`**  
  - Modifications limitées au **rendu** : header, tabs, StatCard (icônes Lucide, dark), sections tableau de bord, liste récents (mobile cards + table desktop), onglet Stats ventes (header, une seule liste mobile, cartes KPI et graphique avec dark).  
  - Aucune modification des hooks, des appels API ni des formules de calcul.

- **`frontend/src/App.js`**  
  - Inchangé ; la route `/users/stats` pointe toujours vers `DashboardAdmin`.

---

## 3. Pistes d’évolution futures (proposition)

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| Haute | **Liens directs vers profils** | Dans la liste « Utilisateurs récemment inscrits », rendre chaque ligne (desktop) et chaque carte (mobile) cliquable vers une page profil ou détail utilisateur si elle existe. |
| Haute | **Export des stats** | Bouton « Exporter » (CSV/Excel) pour les statistiques par utilisateur (ventes, CA, bénéfice) et pour la liste des utilisateurs récents. |
| Moyenne | **Filtres et recherche** | Filtre par rôle (Admin / User), recherche par nom ou email sur les utilisateurs récents et sur le tableau des stats ventes. |
| Moyenne | **Période personnalisée** | Pour les stats ventes, choix de plage personnalisée (date début / date fin) en plus des présets 7 / 30 / 90 jours et « Toutes ». |
| Basse | **Graphiques comparatifs** | Vue « Comparer deux périodes » ou « Évolution par mois » pour les stats par utilisateur. |
| Basse | **Widgets réorganisables** | Permettre à l’admin de masquer ou réordonner les blocs (KPI, graphiques, tableau récents) et persister la préférence. |

---

## 4. Résumé

- **Dashboard /users/stats** : redesign **présentationnel** (header avec retour et titre, onglets avec icônes, KPI en StatCard avec Lucide, graphiques et tableaux en cartes, liste mobile en cartes avec lien vers stats par user, suppression du doublon mobile, dark mode).  
- **Logique** : 100 % préservée.  
- **Proposition** : ce fichier sert de base pour les évolutions listées en section 3 (liens profils, export, filtres, période personnalisée, graphiques comparatifs, widgets).
