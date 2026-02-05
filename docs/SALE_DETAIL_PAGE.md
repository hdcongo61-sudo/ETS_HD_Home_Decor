# Page Détail de Vente (SaleDetailPage)

## Vue d’ensemble

La **page détail de vente** affiche une vente individuelle : en-tête (statut, date, actions), rappel de paiement, livraison, note, client / vendeur / résumé financier / bénéfices (admin), produits vendus, historique des paiements et historique des modifications. Toute la logique métier (chargement, calculs, API) est conservée ; seuls le layout et les modales ont été redesignés.

## Route

- **Chemin :** `/sales/:id`
- **Composant :** `SaleDetailPage.js` (lazy-loaded dans `App.js`)

## Contenu de la page

### 1. En-tête de page

- Lien **Retour aux ventes** (navigation vers `/sales`)
- Titre **Détails de la vente** avec icône
- Bandeau de **message** (succès ou erreur) selon les actions (paiement, rappel, livraison, etc.)

### 2. Carte principale (vente)

- **Identifiant** : Vente #`{6 derniers caractères de _id}`
- **Badges** : Statut (Payée / Partiellement payée / En attente / Annulée), optionnel « Modifiée », optionnel statut de livraison (Livrée / Non livrée / En attente)
- **Date** de la vente
- **Actions** (boutons) :
  - **Modifier** (admin, si vente non annulée) → `/sales/:id/edit`
  - **Ajouter paiement** (désactivé si vente complétée ou annulée) → ouvre le modal de paiement
  - **Définir rappel** / **Modifier rappel** (si en attente ou partiellement payée) → ouvre le modal rappel
  - **Statut livraison** (si vente complétée) → ouvre le modal livraison
  - **Historique** (si la vente a un historique de modifications) → ouvre le modal historique

### 3. Bloc Rappel de paiement (si défini)

- Affichage selon état : envoyé, en retard, aujourd’hui, ou programmé
- Note du rappel si présente
- Actions : **Envoyer** (si en attente), **Modifier**, **Supprimer**

### 4. Bloc Statut de livraison (si vente complétée)

- Livré / Non livré / En attente
- Note de livraison si présente
- Action **Modifier** → ouvre le modal livraison

### 5. Note (si présente)

- Zone en surbrillance (ambre) avec le texte de la note.

### 6. Grille d’informations (4 colonnes sur grand écran)

- **Client** : nom (lien vers fiche client si admin), email, téléphone
- **Vendeur** : nom, email de l’utilisateur ayant enregistré la vente
- **Résumé financier** : total vente, total payé, solde restant
- **Bénéfices** (admin uniquement) : bénéfice total, marge %, coût total

### 7. Produits vendus

- **Mobile** : cartes par produit (nom, prix unitaire, quantité, profit unitaire/total, marge si admin)
- **Desktop** : tableau (produit, prix unitaire, coût/bénéfice unitaire si admin, quantité, total, bénéfice total / marge si admin)

### 8. Onglets mobile (Paiements / Historique)

- Sur petit écran, bascule entre la section **Historique des paiements** et la section **Historique** (modifications). Sur desktop les deux sont visibles.

### 9. Historique des paiements

- Graphique en barres (montant des paiements)
- Tableau : date, méthode, montant, enregistré par, rôle ; action **Supprimer** (admin) par paiement
- Message vide si aucun paiement

---

## Modales rattachées

Toute la logique (état, handlers, appels API) est inchangée ; seul le style et l’accessibilité ont été harmonisés.

### 1. Modal Paiement (`PaymentModal`)

- **Composant :** `PaymentModal.js` (réutilisé depuis la liste des ventes)
- **Ouverture :** bouton « Ajouter paiement »
- **Contenu :** récapitulatif vente (client, total, payé, solde), historique des paiements, formulaire (montant, méthode), boutons Annuler / Enregistrer
- **Fermeture :** bouton, ou clic sur le fond (backdrop)
- **Comportement :** `onAddPayment` appelle l’API puis recharge la vente et ferme le modal

### 2. Modal Rappel

- **Ouverture :** « Définir rappel » / « Modifier rappel » ou icône modifier sur le bloc rappel
- **Contenu :**
  - Champ **Date et heure du rappel** (`datetime-local`)
  - **Note du rappel** (optionnel, 200 car. max)
  - Texte d’info (rappel affiché au tableau de bord, notifications client)
- **Actions :** Annuler (ferme) / Modifier ou Définir (appel `handleSetReminder` puis fermeture)
- **Fermeture :** bouton fermer, clic backdrop
- **Design :** en-tête avec icône rappel (ambre), champs avec `min-height` 44px, pied de modal avec boutons

### 3. Modal Livraison

- **Ouverture :** « Statut livraison » ou « Modifier » sur le bloc livraison
- **Contenu :**
  - **Statut** : select (En attente / Livré / Non livré)
  - **Note de livraison** (optionnel, 500 car. max)
- **Actions :** Annuler / Enregistrer (`handleUpdateDelivery` puis fermeture après succès)
- **Fermeture :** bouton fermer, clic backdrop
- **Design :** en-tête avec icône livraison (émeraude), pied avec boutons

### 4. Modal Historique des modifications

- **Ouverture :** bouton « Historique » (si `sale.modificationHistory.length > 0`)
- **Contenu :**
  - Tableau : Date, Utilisateur (nom + badge rôle), Note, Modifications (détail produits : quantités, prix)
  - Les noms de produits sont résolus via `productNames` (chargés depuis l’API pour les ids présents dans l’historique)
- **Action :** bouton Fermer
- **Fermeture :** bouton fermer, clic backdrop
- **Design :** en-tête avec icône historique (gris), zone scrollable, pied avec bouton Fermer

---

## Comportement et logique conservés

- **Chargement :** `useEffect` sur `id` → `api.get(\`/sales/${id}\`)`, mise à jour de `sale`, `reminderDate`, `reminderNote`, `deliveryStatus`, `deliveryNote`, et chargement des noms de produits pour l’historique.
- **Paiement :** `handleAddPayment` → `api.post(\`/sales/${id}/payments\`, payload)` puis rechargement de la vente.
- **Suppression paiement :** `handleDeletePayment` (confirmation navigateur) → `api.delete(\`/sales/${id}/payments/${paymentId}\`)` puis rechargement.
- **Rappel :** `handleSetReminder` → `api.put(\`/sales/${id}/reminder\`, { reminderDate, reminderNote, isSet })` ; `handleSendReminder` et `handleDeleteReminder` inchangés.
- **Livraison :** `handleUpdateDelivery` → `api.put(\`/sales/${id}/delivery\`, { deliveryStatus, deliveryNote, deliveryDate })` puis rechargement.
- **Calculs :** `calculateTotalProfit`, `calculateProfitMargin`, `getProductProfit`, helpers de statut (`getStatusClass`, `getStatusText`, `getDeliveryStatusClass`, `getDeliveryStatusText`), `getRoleBadge`, `isReminderOverdue`, `isReminderDueToday`, `formatReminderDate`, `formatModificationDate` — tous conservés.
- **Données affichées :** client, vendeur (`sale.user`), produits, paiements, modification history, payment reminder, delivery — sans changement de structure.

## Responsive et accessibilité

- **Mobile :** boutons avec `min-h-[44px]`, modales en style « bottom sheet » (`items-end`) sur petit écran, contenu scrollable.
- **Desktop :** modales centrées, largeur max adaptée (max-w-md ou max-w-4xl pour l’historique).
- **Focus / clavier :** boutons et champs avec états focus visibles ; labels associés aux champs (`htmlFor` / `id`) dans les modales.
- **Contraste :** couleurs lisibles en thème clair et sombre (classes `dark:` utilisées où nécessaire).

## Fichiers concernés

- `frontend/src/components/SaleDetailPage.js` — page et modales Rappel, Livraison, Historique
- `frontend/src/components/PaymentModal.js` — modal paiement (partagé)
- `frontend/src/App.js` — route `/sales/:id` → `SaleDetailPage`
