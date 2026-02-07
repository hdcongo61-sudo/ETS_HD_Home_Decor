# Proposition – Évolutions Gestion des Utilisateurs

Ce document propose des évolutions futures pour le module **Utilisateurs** (admin : Gestion utilisateurs, `/admin/users`), en cohérence avec l’app ETS HD Gestion.

---

## 1. Améliorations déjà en place

- **Modale Ajouter / Modifier** : utilisation du composant `Modal` partagé (drawer mobile, centré desktop), formulaire en français, champs avec `min-h-[44px]` pour le tactile, libellés et boutons unifiés (Annuler, Enregistrer les modifications / Créer l’utilisateur).
- **Formulaire** : photo, nom, email, téléphone, mot de passe, accès admin, fenêtre de connexion (restriction horaire), tout en français et adapté mobile.

---

## 2. Proposition d’évolutions (par priorité)

| Priorité | Fonctionnalité | Description | Impact |
|----------|----------------|-------------|--------|
| **Haute** | **Rôles et permissions** | Rôles au-delà de Admin/Utilisateur (ex. Vendeur, Comptable, Lecture seule) avec permissions par module (Ventes, Caisse, Clients, Produits, Dépenses). | Nouveau modèle ou champs (rôle, permissions), middleware et gardes côté front/back. |
| **Haute** | **Réinitialisation mot de passe** | L’admin peut forcer une réinitialisation (l’utilisateur doit changer au prochain login) ou envoyer un lien par email. | Backend : champ `mustResetPassword`, endpoint “forgot password” + email ou lien temporaire. |
| **Haute** | **Historique des connexions par utilisateur** | Depuis la fiche utilisateur, lien vers la liste des connexions (déjà partiellement disponible via “Historique connexions”) filtrée par utilisateur. | Réutiliser l’API/contenu existant, ajouter filtre par `userId` et lien depuis la liste/carte utilisateur. |
| **Moyenne** | **Activation / Désactivation de compte** | Désactiver un compte sans le supprimer (ex. départ, congé). Connexion impossible tant que le compte est désactivé. | Champ `isActive` (ou `disabled`) sur le modèle User, vérification au login. |
| **Moyenne** | **Invitation par email** | Créer un “utilisateur en attente” : envoi d’un email avec lien d’activation et choix du mot de passe. | Modèle ou statut “pending”, token d’activation, page publique “Activer mon compte”. |
| **Moyenne** | **Audit des modifications** | Historique des changements sur un utilisateur (qui a modifié quoi et quand). | Table ou log “user_audit” (userId, field, oldValue, newValue, by, date). |
| **Moyenne** | **Export de la liste des utilisateurs** | Export CSV/Excel (nom, email, rôle, dernière connexion, statut). | Réutiliser le pattern d’export existant (ex. ventes), endpoint ou génération côté client. |
| **Basse** | **Avatar par défaut / initiales** | Si pas de photo, afficher les initiales (déjà partiel) avec couleur dérivée de l’id ou du nom pour un rendu cohérent. | Uniquement frontend (composant Avatar). |
| **Basse** | **Recherche et filtres avancés** | Filtres par rôle, “connectés / jamais connectés”, date de création. | Extension des paramètres de l’API liste utilisateurs et de l’UI des filtres. |
| **Basse** | **Notifications (optionnel)** | Préférence par utilisateur : recevoir ou non les notifications push / email (rappels, alertes). | Champs sur le profil (notificationsEmail, notificationsPush), branchement aux jobs d’envoi. |

---

## 3. Idées complémentaires (optionnel)

- **Double authentification (2FA)** : TOTP (ex. Google Authenticator) pour les comptes admin ou tous les comptes.
- **Sessions actives** : Liste des sessions (appareil, date, IP) et possibilité de “Déconnecter toutes les autres sessions”.
- **Quotas ou limites** : Limiter le nombre d’utilisateurs selon l’offre (SaaS) ou par établissement.
- **SSO / connexion unique** : Connexion via un fournisseur d’identité (Google, Microsoft, etc.) pour simplifier la gestion des accès.

---

## 4. Résumé

Les changements récents (modale unique, formulaire en français, mobile-friendly) alignent la gestion des utilisateurs sur le reste de l’app. Les propositions ci‑dessus (rôles, réinitialisation mot de passe, historique par utilisateur, désactivation de compte, invitations, audit, export) peuvent être mises en œuvre par étapes en s’appuyant sur le modèle User et les écrans existants sans casser la logique actuelle.
