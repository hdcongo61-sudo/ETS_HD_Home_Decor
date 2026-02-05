# Sales – Fonctionnalités et évolutions

Ce document décrit les fonctionnalités actuelles des pages Ventes, les **données répétitives** identifiées, et les **nouvelles fonctionnalités** proposées pour un module Sales professionnel (mobile et desktop).

---

## 1. Fonctionnalités actuelles

- **Ventes (Sales.js)**  
  - Tableau de bord commercial : KPIs, graphiques (tendance, méthodes de paiement, statuts), formulaire de vente, historique filtré.  
  - Vues : Standard, Analytics avancées, Analyse Bénéfices, Analyse Clients.  
  - Filtres : statut, client, date, livraison. Filtres rapides : Hautes valeurs, Retards paiement, Clients récurrents, Hauts bénéfices.  
  - Cartes vente : total, payé, solde, statut, livraison, lien détail, actions (paiement, livraison, export PDF).

- **Archives (SalesArchive.js)**  
  - Liste complète des ventes avec filtres (statut, client, date, livraison).  
  - Même structure de cartes que Sales.

- **Paiements partiels (PartiallyPaidPurchases.js)**  
  - Liste des ventes partiellement payées, KPIs (total, payé, dû), donut, export CSV, recherche.

- **Ventes supprimées (DeletedSales.js)**  
  - Liste des ventes supprimées avec raison et auteur.

- **Détail vente (SaleDetailPage)**  
  - Fiche complète : produits, paiements, profits, livraison, rappels, historique des modifications.

---

## 2. Données et code répétitifs (réduits)

Les éléments suivants ont été centralisés pour éviter la duplication :

| Élément répétitif | Solution |
|-------------------|----------|
| Options de filtre **Statut** (Tous, Payée, Partiellement payée, En attente, Annulée) | `pages/sales/constants.js` → `STATUS_OPTIONS` |
| Options **Livraison** (Tous, Livré, En attente, Non livré) | `constants.js` → `DELIVERY_OPTIONS_MAIN` / `DELIVERY_OPTIONS_ARCHIVE` |
| Options **Date** (Aujourd'hui, Cette semaine, Ce mois, etc.) | `constants.js` → `DATE_FILTER_OPTIONS` |
| Barre de filtres (Statut, Client, Date, Livraison, Réinitialiser) | Composant `SalesFiltersBar` (`pages/sales/SalesFiltersBar.js`) |
| Carte d’une vente (en-tête, client, total/payé/solde, produits, actions) | Composant `SaleCard` (`pages/sales/SaleCard.js`) |

**Utilisation :**  
- `Sales.js` et `SalesArchive.js` peuvent importer `SalesFiltersBar`, `SaleCard` et les constantes depuis `./sales` (ou `pages/sales`).  
- Les libellés et options ne sont plus dupliqués entre les pages.

---

## 3. Nouvelles fonctionnalités proposées

| Priorité | Fonctionnalité | Description |
|----------|----------------|-------------|
| Haute | **Facturation** | Génération de factures PDF avec numérotation légale, lien vente ↔ facture. |
| Haute | **Rappels automatiques** | Envoi automatique des rappels de paiement (email/SMS) selon une règle (ex. J+7, J+14). |
| Moyenne | **Devis** | Création de devis (brouillon) converti en vente, avec numérotation et statut (brouillon / envoyé / accepté / refusé). |
| Moyenne | **Objectifs et alertes** | Objectif de CA par période (jour/semaine/mois) et alerte si écart. |
| Moyenne | **Export planifié** | Export CSV/Excel des ventes par email (quotidien / hebdo) pour la compta. |
| Basse | **Signature électronique** | Signature client sur devis/vente (optionnel). |
| Basse | **Règles de commission** | Calcul des commissions par vendeur selon règles (%, paliers). |

---

## 4. Redesign mobile / desktop (appliqué)

- **Layout**  
  - Grille responsive : 1 colonne sur mobile, 2 sur tablette, 3–4 sur desktop pour les KPIs et cartes.  
  - Conteneur principal avec `max-w-7xl` et espacement cohérent (gap, padding).

- **Filtres**  
  - `SalesFiltersBar` : même composant sur toutes les pages Sales ; sur mobile, grille 1–2 colonnes avec champs empilés.

- **Cartes vente**  
  - `SaleCard` : carte unique réutilisable ; sur mobile, blocs empilés (total / payé / solde), boutons pleine largeur si besoin.

- **Graphiques**  
  - Hauteur fixe avec `maintainAspectRatio: false` et conteneur responsive ; sur petit écran, légendes et axes restent lisibles.

- **Actions**  
  - Boutons d’action (Ajouter paiement, Gérer livraison, etc.) avec zone de clic suffisante (min 44px) sur mobile.

---

## 5. Fichiers concernés

- `frontend/src/pages/sales/constants.js` – Constantes partagées (options de filtres, etc.).  
- `frontend/src/pages/sales/SalesFiltersBar.js` – Barre de filtres réutilisable.  
- `frontend/src/pages/sales/SaleCard.js` – Carte vente réutilisable.  
- `frontend/src/pages/sales/index.js` – Export du module sales.  
- `frontend/src/pages/Sales.js` – Page principale (utilise les composants et constantes ci-dessus).  
- `frontend/src/pages/SalesArchive.js` – Peut importer `SalesFiltersBar`, `SaleCard`, constantes.  
- `docs/SALES_FEATURES.md` – Ce document.

---

Pour toute évolution (ex. facturation, rappels automatiques), s’appuyer sur ce document et sur le module `pages/sales` sans dupliquer la logique de filtres ou de cartes.
