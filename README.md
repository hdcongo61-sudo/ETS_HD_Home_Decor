# ETS HD Home Décor – Documentation Utilisateur

Cette documentation présente les fonctionnalités principales de l'application et détaille les parcours destinés aux **administrateurs** et aux **utilisateurs standard**. Elle couvre également les informations clés relatives à la sécurité et aux bonnes pratiques d'utilisation.

## 1. Présentation Générale

- **Application** : gestion des ventes, des rappels de paiement, des livraisons et de la relation client pour ETS HD Home Décor.
- **Architecture** :
  - `backend/` – API Node.js/Express avec MongoDB (gestion des ventes, utilisateurs, rappels, statistiques).
  - `frontend/` – Interface React (tableaux de bord, formulaires, visualisation des ventes et profils).
- **Authentification** : basée sur JWT. Chaque requête protégée nécessite l’en-tête `Authorization: Bearer <token>`.
- **Protection des connexions** :
  - Compte verrouillé après **5 tentatives** échouées.
  - Durée de verrouillage : **15 minutes** (message et minuterie affichés dans le formulaire de connexion).

## 2. Démarrage Rapide

1. **Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm start
   ```
3. **Configuration**
   - Variables d'environnement principales :
     - `MONGO_URI` : connexion MongoDB
     - `JWT_SECRET`
     - `PORT` (par défaut 5001 côté backend)
     - `REACT_APP_API_URL` (URL de l'API pour le frontend)

## 3. Rôles et Accès

| Rôle              | Accès principal                                   |
|-------------------|----------------------------------------------------|
| Administrateur    | Gestion des utilisateurs, statistiques globales, rappels, livraisons, tableau de bord complet. |
| Utilisateur       | Accès à ses ventes, ajout de paiements, suivi des rappels et de la livraison, consultation de son profil. |

## 4. Guide Administrateur

### 4.1 Connexion et Sécurité

- Se connecter via `/connexion` avec un compte admin.
- En cas de verrouillage, patienter la durée indiquée avant une nouvelle tentative.

### 4.2 Tableau de Bord des Ventes

- Aperçu global : nombre de ventes, statut, paiements reçus.
- Accès aux détails d'une vente (`/sales/:id`) pour consulter produits, paiements, profits et historique des modifications.

### 4.3 Gestion des Utilisateurs

- Page `Gestion des utilisateurs` (accessible uniquement aux admins) :
  - Créer, modifier ou supprimer un utilisateur.
  - Rechercher par nom, email ou téléphone.
  - Visualiser la dernière connexion et le statut du compte.

### 4.4 Gestion des Rappels de Paiement

- Planifier ou modifier un rappel (date, note, statut) directement depuis la fiche vente.
- Supprimer un rappel via l'action dédiée (API `DELETE /sales/:id/reminder`).
- Envoyer manuellement un rappel (`POST /sales/:id/send-reminder`).

### 4.5 Suivi des Livraisons

- Mettre à jour le statut (`pending`, `delivered`, `not_delivered`).
- Ajouter des notes de livraison et valider la date de livraison lorsque la vente est soldée.

### 4.6 Statistiques et Rapports

- `Dashboard` : indicateurs consolidés (profit, ventes par période, activité des utilisateurs).
- `Login Stats` : suivi des tentatives de connexion (réussies/échouées) pour surveiller la sécurité.

### 4.7 Bonnes Pratiques Admin

- Réinitialiser manuellement un compte verrouillé en mettant `lockUntil` à `null` si nécessaire.
- Utiliser des mots de passe forts et renouveler les accès administrateurs régulièrement.
- Vérifier périodiquement les rappels en retard (`/sales/reminders/upcoming`).

## 5. Guide Utilisateur Standard

### 5.1 Connexion

- Accès via `/connexion`.
- En cas de verrouillage, attendre la fin du décompte avant de réessayer.

### 5.2 Mon Profil (`/profil`)

- Affichage des informations personnelles : nom, email, téléphone, rôle.
- Historique : date d'inscription, **dernière connexion**.
- Possibilité de retourner à l'accueil ou d'accéder aux paramètres (prochaine évolution).

### 5.3 Mes Ventes

- Consultation des ventes assignées (montant total, status, solde restant).
- Détails d’une vente : produits vendus, profits estimés, paiements enregistrés.

### 5.4 Paiements

- Ajouter un paiement (montant, méthode : espèces, Mobile Money, crédit).
- Supprimer un paiement en cas d’erreur (suivant autorisations définies par l’administrateur).

### 5.5 Rappels et Suivi

- Consulter l'état du rappel de paiement (date prévue, statut : en attente, envoyé, annulé).
- Recevoir les notifications envoyées par un administrateur.

### 5.6 Livraison

- Vérifier le statut de livraison et les notes associées laissées par l’équipe logistique.

### 5.7 Bonnes Pratiques Utilisateur

- Mettre à jour son mot de passe régulièrement.
- Ajouter des notes claires lors de la création de rappels ou de l’ajout d’un paiement.
- Prévenir un administrateur en cas de compte verrouillé répété.

## 6. Support et Maintenance

- **Logs** :
  - Backend : consulter la console pour les erreurs d’API.
  - Login History : suivre les entrées dans `LoginHistory` pour les tentatives suspectes.
- **Tests** : utiliser les commandes `npm test` (si disponibles) dans les dossiers `frontend/` et `backend/`.
- **Mises à jour** :
  - Effectuer un `npm audit` sur le backend pour repérer les vulnérabilités.
  - Garder les dépendances React et Node.js à jour.

---

Pour toute question ou suggestion d’amélioration, contactez l’équipe technique ETS HD Home Décor.
