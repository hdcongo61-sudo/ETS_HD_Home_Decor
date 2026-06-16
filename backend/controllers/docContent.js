// Content specs for the super-admin documents (flyer, guide, formation).
// Rendered to branded PDF by pdfController.generateDocPdf.

const flyer = {
  title: 'HD Gestion',
  subtitle: 'Gérez toute votre boutique depuis votre téléphone',
  sections: [
    {
      heading: 'Ventes - Stock - Clients - Caisse - Dépenses - Employés - Bénéfices',
      body: 'Tout au même endroit, avec des analyses qui disent au commerçant quoi faire pour gagner plus.',
    },
    {
      heading: 'Ce que ça change pour le commerçant',
      bullets: [
        'Il sait exactement combien il gagne : bénéfice net en temps réel (ventes - coûts - casse - cadeaux).',
        'Sa caisse est sous contrôle : encaissements du jour et mouvements financiers suivis.',
        'Il perd moins : stock dormant détecté, casse & cadeaux suivis, impayés relancés par WhatsApp en 1 clic.',
        'Il fidélise ses meilleurs clients : VIP, fidèles et clients à relancer identifiés automatiquement.',
        "Il a l'air pro : factures et bulletins de paie PDF à son nom et à ses couleurs.",
        'Il garde le contrôle : ses vendeurs vendent sans voir les marges ; rien sans sa validation.',
      ],
    },
    {
      heading: 'Les fonctions clés',
      bullets: [
        'Ventes : vente en 2 clics, crédit & paiements partiels, livraison, factures PDF.',
        'Produits : catalogue, import Excel, QR code, alertes de rupture, suggestions pour vendre le stock lent.',
        'Caisse / Banque : encaissements du jour, mouvements financiers, suivi de la trésorerie.',
        'Clients : fiches, historique, segmentation VIP / fidèles / à relancer.',
        'Recouvrement : rappels WhatsApp aux clients (message pré-rempli), appel direct, suivi des relances.',
        'Bénéfices : marge nette, par produit / catégorie / conteneur, pertes déduites.',
        'Dépenses & Paie : suivi, objectif mensuel, bulletins de paie, avances.',
        'Assistance intégrée : messagerie directe avec le support (suggestions, réclamations, questions).',
        'Deux profils : Administrateur (tout) et Vendeur (vend sans voir les marges).',
      ],
    },
    {
      heading: 'Pourquoi HD Gestion ?',
      body: 'Voir clair. Perdre moins. Gagner du temps. Garder le contrôle.',
      bullets: [
        '100 % mobile : téléphone, tablette, ordinateur, installable comme une vraie application.',
        'En français, en francs CFA.',
        'Sécurisé : données protégées et isolées par boutique.',
        "À l'image de la boutique : logo, couleurs, nom.",
      ],
    },
    {
      heading: 'Contact',
      body: "Contactez-nous pour une démonstration et démarrez en quelques minutes.",
    },
  ],
};

const guide = {
  title: 'Guide de gestion - HD Gestion',
  subtitle: 'Présentation complète des modules et fonctions',
  sections: [
    {
      heading: '1. Accueil / Tableau de bord',
      bullets: [
        'Indicateurs clés : chiffre d\'affaires, ventes, vente moyenne, encaissements, produits vendus.',
        'Synthèse intelligente : produit moteur, meilleur client, clients à relancer, ventes en gros.',
        "Détail d'une journée : ventes, dépenses et encaissements du jour.",
        'Accès rapides + liens Produits lents et Pertes & cadeaux.',
      ],
    },
    {
      heading: '2. Ventes',
      bullets: [
        'Enregistrer une vente (stock mis à jour automatiquement) ; vente rapide depuis tout écran.',
        'Détail et gros ; paiement complet, unique ou à crédit (multiple) ; paiements partiels.',
        'Suivi de livraison ; filtres avancés ; fiche de vente ; facture PDF à votre image.',
        'Vues Analytics / Clients / Bénéfices ; archives ; corbeille ; relances de paiement.',
        'Recouvrement des impayés : rappel WhatsApp ou appel en 1 clic (message pré-rempli avec le solde), depuis l\'accueil, la page « Paiements partiels » et la fiche de vente.',
        'Suivi des relances : chaque rappel est enregistré (canal, date) avec l\'historique et « relancé il y a X jours », pour ne jamais relancer deux fois.',
      ],
    },
    {
      heading: '3. Caisse / Banque',
      bullets: [
        'Suivi des mouvements financiers et des encaissements du jour.',
        'Vue claire de la trésorerie de la boutique.',
      ],
    },
    {
      heading: '4. Produits (catalogue)',
      bullets: [
        'Catalogue complet (prix, prix de revient, stock, conteneur, entrepôt, fournisseur, SKU, image).',
        'Import Excel en masse avec aperçu (importé / ignoré) et modèle téléchargeable.',
        'Tri et filtres ; fiche produit (stats, bénéfice brut et net, QR code, PDF).',
        'Galerie d\'images partagée entre fiches.',
      ],
    },
    {
      heading: '5. Optimisation du stock',
      bullets: [
        'Suggestions pour vendre les produits lents (jamais vendus, dormants, lents) + capital immobilisé.',
        'Alertes : stock critique, rupture, jamais vendus, meilleures ventes.',
        'Pertes & cadeaux : casse / cadeau suivis, déduits du bénéfice net, annulables, marqués au catalogue.',
      ],
    },
    {
      heading: '6. Clients',
      bullets: [
        'Fiches clients, historique d\'achats, soldes.',
        'Segmentation automatique : VIP, Fidèle, Régulier, Nouveau, Inactif.',
        'Tableau de bord clients et accès aux paiements partiels.',
      ],
    },
    {
      heading: '7. Finances',
      bullets: [
        'Dépenses avec catégories, paiements de salaire, objectif mensuel.',
        'Analyse des bénéfices : CA, coût, bénéfice brut, pertes, bénéfice net, marge nette.',
        'Répartition par produit, catégorie et conteneur.',
      ],
    },
    {
      heading: '8. Équipe & accès',
      bullets: [
        'Deux profils : Administrateur (tout) et Vendeur (vend sans voir les marges).',
        'Permissions fines, restriction horaire, historique des connexions, dashboard par vendeur.',
        'Demandes d\'approbation : l\'employé demande (prix/stock/suppression), l\'admin valide.',
        'Employés : bulletins de paie (PDF) et avances.',
      ],
    },
    {
      heading: '9. Fournisseurs, conteneurs & entrepôts',
      bullets: [
        'Statistiques par fournisseur, conteneur et entrepôt (valeur, ventes, marge, écoulement).',
      ],
    },
    {
      heading: '10. Paramètres & personnalisation',
      bullets: [
        'Identité : nom, logo, couleur, textes de connexion, footer, contact, adresse (sur les documents).',
        'Dates manuelles et listes de référence (catégories, conteneurs, entrepôts, fournisseurs).',
        'Mon abonnement : voir le plan actuel, ses avantages, et envoyer une demande de changement de plan au support.',
      ],
    },
    {
      heading: '11. Assistance & support',
      bullets: [
        'Messagerie intégrée avec l\'équipe : ouvrez un message par catégorie (suggestion, réclamation, question, autre).',
        'Fil de discussion : le support répond, vous êtes notifié, un badge indique les messages non lus.',
        'Suivi des échanges avec leur statut (ouvert / résolu) depuis la page « Assistance ».',
      ],
    },
    {
      heading: '12. Plateforme (multi-boutiques) - réservé éditeur',
      bullets: [
        'Console super-admin : gérer plusieurs boutiques, plans et limites, statistiques, audit.',
        'Demandes de changement de plan et messages d\'assistance des boutiques traités au même endroit.',
        'Indicatif pays défini par boutique (pour les rappels WhatsApp) ; documents (flyer, guide, formation) modifiables depuis l\'interface.',
        'Connexion assistée (impersonation) et isolation stricte des données par boutique.',
      ],
    },
    {
      heading: 'À retenir',
      body: 'Voir clair (bénéfice net, stock, caisse, clients) - Perdre moins (pertes suivies, stock lent activé, impayés relancés) - Gagner du temps & crédibilité - Garder le contrôle.',
    },
  ],
};

const formation = {
  title: 'Guide de formation - HD Gestion',
  subtitle: 'Pour former et accompagner un nouveau commerçant',
  sections: [
    {
      heading: '1. Prise en main (premier jour)',
      bullets: [
        'Se connecter avec le compte fourni ; installer l\'application (Ajouter à l\'écran d\'accueil).',
        'Paramètres : renseigner nom, logo, couleur, adresse et contact de la boutique.',
        'Créer les listes de référence : catégories, conteneurs, entrepôts, fournisseurs.',
        'Ajouter les produits (un par un ou via l\'import Excel avec le modèle fourni).',
      ],
    },
    {
      heading: '2. Comprendre les deux rôles',
      bullets: [
        'Administrateur (patron) : voit tout (marges, bénéfices), gère utilisateurs et paramètres, valide les demandes.',
        'Vendeur : enregistre les ventes et encaisse, mais ne voit ni les coûts ni les marges.',
        'Règle d\'or : on délègue la vente, on protège les chiffres.',
      ],
    },
    {
      heading: '3. Le quotidien du vendeur (à enseigner)',
      bullets: [
        'Enregistrer chaque vente : client, produits, quantité ; encaisser (total ou partiel).',
        'Pour une livraison : indiquer le statut (livré / en attente).',
        'Suivre les encaissements du jour dans la Caisse / Banque.',
      ],
    },
    {
      heading: '4. Le quotidien de l\'administrateur',
      bullets: [
        'Vérifier le tableau de bord (CA, bénéfice net, synthèse intelligente).',
        'Valider ou refuser les demandes des vendeurs (prix, stock, suppression).',
        'Enregistrer les pertes & cadeaux (casse, dons) pour un bénéfice réaliste.',
        'Relancer les impayés : rappel WhatsApp ou appel en 1 clic depuis l\'accueil / la fiche de vente ; chaque relance est tracée (historique, « relancé il y a X jours »).',
        'Réapprovisionner via les alertes de stock ; activer le stock lent avec les suggestions.',
      ],
    },
    {
      heading: '5. Tirer profit des analyses',
      bullets: [
        'Analyse des bénéfices : comprendre la marge nette par produit, catégorie et conteneur.',
        'Clients : repérer les VIP à choyer et les inactifs à relancer.',
        'Produits lents : appliquer remises / lots pour libérer du capital immobilisé.',
      ],
    },
    {
      heading: '6. Bonnes pratiques',
      bullets: [
        'Saisir les ventes en temps réel (ne pas attendre le soir).',
        'Renseigner le prix de revient pour avoir un vrai bénéfice.',
        'Donner à chaque vendeur son propre compte (traçabilité).',
        'Sauvegarde automatique dans le cloud : aucune donnée perdue.',
      ],
    },
    {
      heading: '7. Besoin d\'aide ? L\'assistance intégrée',
      bullets: [
        'Page « Assistance » : écrivez directement au support (suggestion, réclamation, question).',
        'Suivez la réponse dans le fil de discussion ; un badge signale les messages non lus.',
        'Pour changer de formule : Paramètres → Mon abonnement → demander un changement de plan.',
      ],
    },
    {
      heading: '8. Questions fréquentes',
      bullets: [
        'Le vendeur voit-il mes bénéfices ? Non, jamais (marges et coûts masqués).',
        'Comment relancer un client qui n\'a pas payé ? Bouton WhatsApp/Appeler depuis l\'accueil ou la vente ; le message est pré-rempli.',
        'Puis-je corriger une erreur ? Oui : annulation des pertes, corbeille des ventes, demandes validées.',
        'Ça marche sans internet ? L\'application signale le mode hors-ligne ; les données se synchronisent.',
        'Sur quel appareil ? Téléphone, tablette ou ordinateur, et installable comme une application.',
      ],
    },
  ],
};

module.exports = { flyer, guide, formation };
