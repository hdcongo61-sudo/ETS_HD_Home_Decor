/**
 * pageGuides — guides d’utilisation par page (fr-FR).
 *
 * Chaque route authentifiée possède un guide : description, étapes numérotées
 * et conseils. Le composant PageGuide fait correspondre l’URL courante à une
 * entrée (correspondance exacte d’abord, puis motifs dynamiques :id, :name…).
 */
const GUIDE = (path, label, description, steps, tips = []) => ({ path, label, description, steps, tips });

export const PAGE_GUIDES = [
  // ── Accueil ──
  GUIDE('/', 'Accueil', 'Votre tableau de bord central : suivez en temps réel vos ventes, votre trésorerie et l’état de votre stock.',
    [
      'Consultez les 4 KPI principaux en haut : Chiffre d’affaires du jour, Encaissé aujourd’hui, Solde en attente, et Stock restant.',
      'Utilisez la barre de recherche globale (en haut à droite) pour retrouver instantanément un produit, un client ou une vente par nom, SKU ou numéro.',
      'Cliquez sur n’importe quelle carte KPI pour accéder à la section détaillée correspondante (ex: cliquer sur "Chiffre d’affaires" ouvre la page Ventes).',
      'Consultez les alertes stock en temps réel dans la section "Alertes" : ruptures de stock et produits sous le seuil minimal.',
      'Accédez aux actions rapides via le menu « Accès rapide » : Nouvelle vente, Nouveau produit, Nouveau client, Caisse.',
      'Visualisez le graphique d’évolution des ventes des 7 derniers jours pour identifier les tendances.',
      'Vérifiez les 5 produits les plus vendus du jour dans la section "Top produits".'
    ],
    [
      'Les données se rafraîchissent automatiquement toutes les 5 minutes pendant que la page est ouverte.',
      'Un badge rouge sur l’icône stock indique le nombre de produits en alerte critique.',
      'Les montants en CFA sont formatés automatiquement avec séparateurs de milliers.',
      'Le chiffre d’affaires inclut toutes les ventes validées (partiellement payées ou entièrement réglées), hors ventes annulées.',
      'Les alertes stock ne concernent que les produits actifs (isActive = true).'
    ]),
  GUIDE('/dashboard', 'Tableau de bord', 'Vue d’ensemble complète de votre activité commerciale avec indicateurs clés et graphiques d’analyse.',
    [
      'Analysez les 6 cartes KPI en haut : Ventes totales, CA du mois, Stock total, Clients actifs, Commandes en cours, Marge moyenne.',
      'Explorez le graphique d’évolution des ventes (ligne) et du chiffre d’affaires (barres) sur les 30 derniers jours.',
      'Identifiez vos 10 meilleurs produits par chiffre d’affaires dans le tableau "Top produits".',
      'Consultez la répartition des ventes par catégorie de produits dans le graphique circulaire.',
      'Suivez les performances de vos vendeurs dans la section "Ventes par utilisateur".',
      'Cliquez sur "Exporter le rapport" pour télécharger un PDF complet du tableau de bord.',
      'Utilisez le sélecteur de période (7j / 30j / 90j / Année) pour ajuster la portée des analyses.'
    ],
    [
      'Les données se recalculent à chaque ouverture de page pour garantir l’exactitude.',
      'La marge moyenne est calculée uniquement sur les produits ayant un prix de revient renseigné.',
      'Les clients actifs sont ceux ayant effectué au moins un achat dans les 90 derniers jours.',
      'Le graphique de catégories exclut les ventes annulées.',
      'Utilisez le mode plein écran (F11) pour projeter le dashboard sur un écran lors de réunions.'
    ]),

  // ── Ventes ──
  GUIDE('/sales', 'Ventes', 'Centre de gestion des ventes : création, suivi des paiements, livraisons et historique complet.',
    [
      'Cliquez sur « Nouvelle vente » (bouton bleu en haut à droite) pour ouvrir le formulaire de vente.',
      'Sélectionnez le client dans la liste déroulante ou créez-en un nouveau directement depuis le formulaire.',
      'Ajoutez des produits en les recherchant par nom ou SKU, puis définissez la quantité pour chaque ligne.',
      'Vérifiez que le stock disponible est suffisant (affiché à côté de chaque produit).',
      'Choisissez le mode de paiement : Espèces, Carte bancaire, Mobile Money, Chèque, Virement, ou Crédit (paiement ultérieur).',
      'Pour un paiement partiel, saisissez le montant versé (le restant dû sera calculé automatiquement).',
      'Ajoutez des notes internes si nécessaire (visibles uniquement par les employés).',
      'Validez la vente : le stock sera automatiquement décrémenté et la vente apparaîtra dans l’historique.',
      'Suivez le statut de livraison (En attente / En cours / Livrée) et le solde restant directement dans la liste.',
      'Utilisez les filtres (client, vendeur, statut de paiement, date) pour retrouver rapidement une vente.',
      'Accédez aux statistiques rapides en haut : Total des ventes du jour, CA du mois, Nombre de transactions, Panier moyen.'
    ],
    [
      'Une vente en mode "Crédit" crée automatiquement une créance client consultable dans le profil client.',
      'Les ventes partiellement payées apparaissent dans l’onglet "Paiements partiels" pour faciliter le suivi.',
      'Double-cliquez sur une ligne de vente pour ouvrir rapidement sa fiche détaillée.',
      'Le stock est réservé immédiatement lors de la création de la vente, même si le paiement est différé.',
      'Pour annuler une vente, ouvrez sa fiche et cliquez sur "Supprimer" (nécessite les droits admin).',
      'Les ventes annulées sont archivées dans "Ventes supprimées" avec traçabilité complète (auteur, raison, date).',
      'Utilisez le raccourci clavier Ctrl+N (Cmd+N sur Mac) pour ouvrir rapidement le formulaire de nouvelle vente.',
      'Le calcul de TVA est automatique si configuré dans les paramètres (taux par défaut ou par catégorie).'
    ]),
  GUIDE('/sales/:id', 'Détail d’une vente', 'Fiche complète d’une vente : produits vendus, historique des paiements, livraison, facture et actions.',
    [
      'Consultez le résumé de la vente en haut : numéro, date, client, vendeur, montant total et statut de paiement.',
      'Visualisez la liste des produits vendus avec quantités, prix unitaire, prix total et marge pour chaque ligne.',
      'Accédez à l’historique complet des paiements : date, méthode, montant et auteur de chaque transaction.',
      'Ajoutez un paiement complémentaire avec le bouton "Ajouter un paiement" (si la vente n\'est pas soldée).',
      'Suivez l’état de livraison : cliquez sur "Modifier la livraison" pour changer le statut ou ajouter une date/notes.',
      'Imprimez ou téléchargez la facture en PDF en cliquant sur "Imprimer la facture".',
      'Envoyez un rappel de paiement par SMS ou email au client (si coordonnées renseignées).',
      'Consultez les notes internes ajoutées lors de la création ou modifiées ultérieurement.',
      'Modifiez la vente (produits, quantités) si elle n\'a pas encore été livrée (fonction admin).',
      'Marquez la vente comme livrée une fois la marchandise remise au client.'
    ],
    [
      'Le restant dû est recalculé en temps réel après chaque paiement ajouté.',
      'La facture PDF inclut automatiquement le logo de votre entreprise (configuré dans Paramètres).',
      'Les paiements sont horodatés et tracés par utilisateur pour l’audit.',
      'Si la vente est soldée, le bouton "Ajouter un paiement" disparaît.',
      'Les modifications de vente livrée sont bloquées pour garantir l’intégrité comptable.',
      'Le rappel de paiement utilise le modèle configuré dans les paramètres de notification.',
      'Vous pouvez ajouter plusieurs paiements partiels de différentes méthodes (ex: 50% espèces + 50% mobile money).',
      'La marge affichée par ligne est calculée avec le prix de revient (costPrice) du produit au moment de la vente.'
    ]),
  GUIDE('/sales/all', 'Archives des ventes', 'Historique exhaustif de toutes les ventes avec filtres avancés, recherche et export.',
    [
      'Utilisez la barre de recherche pour trouver une vente par numéro, nom de client, produit ou montant.',
      'Filtrez par période : sélectionnez une plage de dates avec le calendrier (début et fin).',
      'Filtrez par statut de paiement : Toutes, Payées, Partiellement payées, En attente, Crédit.',
      'Filtrez par statut de livraison : Toutes, En attente, En cours, Livrées.',
      'Filtrez par vendeur : sélectionnez un utilisateur dans la liste pour voir uniquement ses ventes.',
      'Filtrez par mode de paiement : Espèces, Carte bancaire, Mobile Money, Chèque, Virement.',
      'Triez les colonnes en cliquant sur les en-têtes : Date, Client, Montant, Statut.',
      'Exportez la liste filtrée en Excel avec le bouton "Exporter Excel" (toutes les colonnes incluses).',
      'Exportez en PDF pour archivage ou impression (format A4 paysage).',
      'Cliquez sur une ligne pour ouvrir la fiche détaillée de la vente.',
      'Visualisez les totaux en bas de liste : Nombre de ventes, CA total, Montant encaissé, Restant dû.'
    ],
    [
      'Les archives restent accessibles indéfiniment, même après clôture de mois ou d’exercice.',
      'L’export Excel inclut toutes les colonnes cachées dans la vue (prix de revient, marge, etc.).',
      'Les filtres se combinent : vous pouvez filtrer par date ET par client ET par statut simultanément.',
      'La pagination automatique charge 50 ventes à la fois pour optimiser les performances.',
      'Utilisez "Ctrl+F" dans votre navigateur pour rechercher rapidement dans la page affichée.',
      'Les ventes annulées n\'apparaissent pas ici : consultez "Ventes supprimées" pour les retrouver.',
      'Le montant total exclut les ventes en statut "annulé".',
      'Les données exportées respectent la locale française (format de date fr-FR, séparateurs de milliers).'
    ]),
  GUIDE('/sales/deleted', 'Ventes supprimées', 'Journal d’audit des ventes supprimées avec traçabilité complète : qui, quand, pourquoi.',
    [
      'Consultez la liste complète des ventes supprimées, triée par date de suppression (plus récentes en premier).',
      'Visualisez pour chaque suppression : numéro de vente, client, montant, date de vente originale, et date de suppression.',
      'Identifiez l’auteur de la suppression : nom de l’utilisateur et son rôle au moment de l’action.',
      'Lisez la raison de suppression (obligatoire lors de la suppression d’une vente).',
      'Recherchez une suppression par nom de client, montant ou auteur avec la barre de recherche.',
      'Filtrez par période de suppression pour analyser les suppressions sur une plage donnée.',
      'Exportez le journal au format CSV pour audit externe ou archivage.',
      'Consultez le stock restauré : les quantités sont automatiquement réintégrées lors de la suppression.'
    ],
    [
      'Ce journal est immutable : aucune suppression ne peut être effacée de l’historique (conformité audit).',
      'La suppression d’une vente nécessite les droits administrateur et un code MFA si activé.',
      'Les ventes supprimées sont exclues de tous les rapports financiers et statistiques.',
      'Le stock est restauré instantanément lors de la suppression (remise en disponibilité).',
      'La raison de suppression est horodatée et signée numériquement (non modifiable).',
      'Utilisez ce journal pour détecter les abus ou erreurs de manipulation.',
      'Les suppressions massives (plus de 5 ventes en moins de 10 minutes) déclenchent une alerte admin.',
      'L’export CSV inclut l’adresse IP de l’auteur pour traçabilité maximale.'
    ]),
  GUIDE('/sales/partially-paid', 'Paiements partiels', 'Suivi centralisé des ventes partiellement payées ou en attente de règlement complet.',
    [
      'Visualisez toutes les ventes avec un solde restant dû, triées par ancienneté (plus anciennes en premier).',
      'Consultez pour chaque vente : client, montant total, montant déjà payé, restant dû, et nombre de jours depuis la création.',
      'Identifiez rapidement les créances urgentes grâce au code couleur : vert (<7j), orange (7-30j), rouge (>30j).',
      'Cliquez sur une ligne pour ouvrir la fiche de vente et ajouter un paiement.',
      'Utilisez le filtre par client pour afficher uniquement les ventes d’un client spécifique.',
      'Filtrez par ancienneté : Toutes, Récentes (<7j), Moyennes (7-30j), Anciennes (>30j).',
      'Exportez la liste CSV pour relances clients ou tableau de suivi externe.',
      'Suivez le total des créances en haut de page : Nombre de ventes, Montant total dû.',
      'Contactez le client directement depuis la liste (bouton "Relancer" si téléphone/email renseigné).'
    ],
    [
      'Une vente soldée disparaît automatiquement de cette liste (mise à jour en temps réel).',
      'Le délai de paiement par défaut est configurable dans les paramètres (ex: 30 jours).',
      'Les ventes en crédit (0 CFA payé à la création) apparaissent également ici.',
      'Utilisez cette page quotidiennement pour suivre votre trésorerie et éviter les impayés.',
      'La relance automatique par SMS peut être activée dans les paramètres (J+7, J+15, J+30).',
      'Les ventes avec restant dû < 100 CFA peuvent être masquées (seuil configurable).',
      'Le classement par ancienneté aide à prioriser les relances clients.',
      'Les clients avec plusieurs ventes impayées sont marqués d’un badge d’alerte.'
    ]),
  GUIDE('/sales/user/:userId', 'Ventes par utilisateur', 'Rapport détaillé des performances commerciales d\'un utilisateur avec statistiques et graphiques.',
    [
      'Consultez les KPI du vendeur en haut : Nombre de ventes, CA total, Panier moyen, Marge totale.',
      'Visualisez le graphique d’évolution des ventes sur la période sélectionnée (7j / 30j / 90j / Année).',
      'Analysez la répartition des ventes par catégorie de produits (graphique circulaire).',
      'Consultez la liste détaillée de toutes les ventes du vendeur avec filtres et tri.',
      'Identifiez les 10 produits les plus vendus par ce vendeur.',
      'Comparez les performances avec la moyenne de l’équipe (si plusieurs vendeurs).',
      'Exportez le rapport en PDF pour archivage ou présentation.',
      'Filtrez par période pour analyser un mois ou une semaine spécifique.'
    ],
    [
      'Pratique pour calculer les commissions basées sur le CA ou la marge.',
      'Les objectifs individuels peuvent être définis dans le profil utilisateur.',
      'Le panier moyen aide à identifier les vendeurs qui maximisent la valeur par transaction.',
      'Les ventes annulées sont exclues des statistiques de performance.',
      'Utilisez cette page lors des entretiens individuels pour suivre la progression.',
      'La marge totale n\'est visible que pour les utilisateurs ayant la permission "view_sensitive_financials".',
      'Le graphique de catégories révèle les spécialités de chaque vendeur (bijoux, meubles, etc.).'
    ]),

  // ── Caisse / banque ──
  GUIDE('/bank', 'Caisse', 'Gestion complète de la trésorerie : encaissements, dépôts bancaires, retraits et rapprochement.',
    [
      'Consultez le solde actuel de la caisse en haut de page (mise à jour en temps réel).',
      'Enregistrez un dépôt (entrée) : cliquez sur "Nouveau mouvement", sélectionnez "Dépôt", saisissez le montant et le libellé (ex: "Ventes du jour", "Remboursement fournisseur").',
      'Enregistrez un retrait (sortie) : sélectionnez "Retrait" et précisez la raison (ex: "Dépôt banque", "Paiement fournisseur", "Frais divers").',
      'Ajoutez une référence (numéro de bordereau, reçu) pour faciliter le rapprochement bancaire.',
      'Filtrez les mouvements par type (Tous / Dépôts / Retraits) avec les onglets en haut.',
      'Recherchez un mouvement par libellé, montant ou référence avec la barre de recherche.',
      'Filtrez par période : sélectionnez une plage de dates pour analyser un mois ou une semaine.',
      'Consultez les totaux en bas : Total dépôts, Total retraits, Solde de la période.',
      'Exportez l’historique en Excel pour rapprochement comptable ou audit.',
      'Modifiez ou supprimez un mouvement récent (moins de 24h) si erreur de saisie.'
    ],
    [
      'Chaque mouvement est horodaté et signé par l’utilisateur qui l’a créé (traçabilité totale).',
      'Le solde de caisse inclut les ventes en espèces et les mouvements manuels (dépôts/retraits).',
      'Les ventes en mobile money ou carte bancaire n\'affectent pas le solde caisse physique.',
      'Effectuez un comptage de caisse quotidien et créez un ajustement si écart (motif obligatoire).',
      'Le rapprochement bancaire consiste à comparer les retraits "Dépôt banque" avec les relevés bancaires.',
      'Les droits de modification sont limités aux admins et responsables caisse.',
      'Un mouvement de plus de 1 000 000 CFA déclenche une validation admin automatique.',
      'Utilisez la référence pour noter le numéro de bordereau de remise en banque.',
      'Le journal caisse est consultable sur plusieurs mois pour l’analyse des flux de trésorerie.',
      'En cas d’erreur, préférez créer un mouvement correctif plutôt que supprimer (meilleure traçabilité).'
    ]),

  // ── Clients ──
  GUIDE('/clients', 'Clients', 'Gestion du fichier clients : création, profils, historique d\'achats et programme de fidélité.',
    [
      'Créez un nouveau client avec "Nouveau client" : saisissez nom, téléphone, email et adresse (optionnels).',
      'Recherchez un client par nom, téléphone ou email avec la barre de recherche (recherche instantanée).',
      'Filtrez par statut : Tous, Actifs (achat <90j), Inactifs (pas d’achat depuis 90j+).',
      'Triez la liste par nom, dernière visite, ou montant total dépensé (cliquez sur les en-têtes).',
      'Consultez les indicateurs rapides pour chaque client : Nombre d’achats, Total dépensé, Dernière visite, Points fidélité.',
      'Ouvrez un profil client en cliquant sur son nom pour voir l’historique complet des achats.',
      'Identifiez les meilleurs clients avec le badge "VIP" (plus de 5 achats ou 1M CFA de CA).',
      'Visualisez le solde dû de chaque client (montant en rouge si créances impayées).',
      'Exportez la liste clients en Excel avec toutes les coordonnées et statistiques.',
      'Supprimez un client inactif sans historique de vente (fonction admin).',
      'Fusionnez des doublons clients (même personne créée plusieurs fois) pour nettoyer la base.'
    ],
    [
      'Le profil client regroupe l’historique complet : achats, paiements, retours, points fidélité.',
      'Un client "Actif" a effectué au moins un achat dans les 90 derniers jours.',
      'Les coordonnées clients sont cryptées en base de données (protection RGPD).',
      'Le numéro de téléphone sert d’identifiant unique : pas de doublons possibles.',
      'Les clients sans email ne peuvent pas recevoir de factures par mail (impression papier uniquement).',
      'Le badge VIP est attribué automatiquement selon les critères définis dans les paramètres.',
      'Utilisez les filtres pour segmenter votre base : clients inactifs à relancer, VIP à fidéliser, etc.',
      'L’export Excel respecte le format fr-FR pour les dates et les montants.',
      'Un client supprimé ne peut plus être restauré : ses ventes restent en base mais anonymisées.',
      'La fonction de fusion de doublons transfère automatiquement l’historique vers le profil conservé.'
    ]),
  GUIDE('/clients/dashboard', 'Tableau de bord clients', 'Analyse approfondie de votre base clients : segmentation, comportements d\'achat et opportunités commerciales.',
    [
      'Consultez les KPI clients en haut : Nombre total, Nouveaux ce mois, Actifs, Taux de rétention.',
      'Analysez le graphique d’acquisition clients sur 12 mois (nouveaux clients par mois).',
      'Identifiez vos 20 meilleurs clients par CA total (tableau classé).',
      'Visualisez la répartition des clients par statut (Actifs / Inactifs / VIP) dans le graphique circulaire.',
      'Consultez la distribution des achats : combien de clients ont fait 1 achat, 2-5, 6-10, 10+ achats.',
      'Analysez la valeur vie client (CLV = Customer Lifetime Value) moyenne.',
      'Repérez les clients à risque (pas d’achat depuis 60-90 jours) dans la section "Clients à réactiver".',
      'Consultez la fréquence d’achat moyenne (nombre de jours entre deux achats).',
      'Exportez le rapport complet en PDF pour présentation ou archivage.',
      'Utilisez les données pour créer des campagnes ciblées (relance inactifs, offres VIP, etc.).'
    ],
    [
      'Utile pour cibler vos relances et offres fidélité selon les segments.',
      'Le taux de rétention mesure le % de clients qui reviennent acheter après leur 1er achat.',
      'Un taux de rétention < 30% indique un problème d’expérience client à investiguer.',
      'Les clients VIP génèrent souvent 60-80% du CA total (règle de Pareto).',
      'La valeur vie client aide à définir le budget d’acquisition client acceptable.',
      'Les clients "à risque" sont une opportunité de réactivation avec une offre personnalisée.',
      'Comparez les périodes (mois N vs mois N-1) pour suivre l’évolution de vos indicateurs.',
      'Utilisez la fréquence d’achat moyenne pour espacer vos relances marketing.',
      'Le dashboard clients se complète avec le dashboard produits pour une vision 360°.'
    ]),
  GUIDE('/clients/loyalty', 'Fidélité', 'Programme de fidélité complet : accumulation de points, récompenses et historique des opérations.',
    [
      'Consultez les règles du programme en haut de page : taux d’accumulation (ex: 1 point = 100 CFA dépensés) et valeur de conversion (ex: 100 points = 1000 CFA de réduction).',
      'Recherchez un client par nom ou téléphone pour gérer ses points.',
      'Visualisez le solde de points actuel du client dans sa fiche.',
      'Ajoutez des points bonus manuellement : saisissez le nombre de points et le motif (anniversaire, parrainage, geste commercial).',
      'Utilisez des points lors d’une vente : sélectionnez "Paiement par points" et saisissez le nombre de points à convertir en CFA.',
      'Consultez l’historique complet des opérations de points : date, type (gain/utilisation/bonus), montant, solde avant/après.',
      'Filtrez l’historique par type d’opération (Tous / Gains / Utilisations / Bonus / Expirations).',
      'Configurez la durée de validité des points (ex: 12 mois) dans les paramètres du programme.',
      'Envoyez un récapitulatif de points par SMS au client après chaque opération.',
      'Exportez la liste des clients par solde de points (top fidèles) pour campagnes ciblées.',
      'Gérez les niveaux de fidélité (Bronze / Argent / Or) avec avantages progressifs.'
    ],
    [
      'Les points sont recalculés automatiquement après chaque vente (pas de saisie manuelle nécessaire).',
      'L’expiration des points est automatique selon la règle définie (ex: points > 12 mois expirés).',
      'Les points bonus n’expirent pas (ou selon paramétrage spécifique).',
      'Le client voit son solde de points sur son reçu de caisse et sa facture.',
      'Les points ne peuvent être utilisés que pour un montant ≤ 50% du total de la vente (configurable).',
      'Les points utilisés lors d’une vente annulée sont recrédités automatiquement.',
      'Le programme de fidélité augmente le taux de rétention de 20-40% en moyenne.',
      'Envoyez des alertes automatiques aux clients proches de l’expiration de leurs points.',
      'Les niveaux de fidélité débloquent des avantages : réductions supplémentaires, ventes privées, etc.',
      'Analysez le ROI du programme : CA généré par les clients fidélisés vs coût des récompenses.'
    ]),
  GUIDE('/clients/:id/:slug?', 'Profil client', 'Fiche client détaillée : coordonnées, historique d\'achats complet, créances, points de fidélité et statistiques.',
    [
      'Consultez les informations personnelles en haut : nom, téléphone, email, adresse complète.',
      'Modifiez les coordonnées en cliquant sur "Modifier" (si droits suffisants).',
      'Visualisez les statistiques du client : Nombre total d’achats, CA total, Panier moyen, Dernière visite.',
      'Consultez le solde de compte : montant dû (en rouge si créances), montant payé, solde actuel.',
      'Accédez à l’historique complet des achats : liste chronologique de toutes les ventes avec dates, montants, statuts.',
      'Cliquez sur une vente pour ouvrir sa fiche détaillée.',
      'Consultez l’historique des paiements : tous les règlements effectués par le client avec dates et méthodes.',
      'Gérez les points de fidélité : solde actuel, historique des gains/utilisations, expiration prochaine.',
      'Ajoutez une note client (commentaire interne) pour mémoriser des préférences ou informations importantes.',
      'Envoyez un message SMS ou email directement depuis le profil (bouton "Contacter").',
      'Visualisez le graphique d’évolution des achats sur 12 mois.',
      'Consultez les 10 produits préférés du client (plus achetés).',
      'Imprimez un relevé de compte complet (historique + solde) en PDF.'
    ],
    [
      'Le solde dû du client est visible dans sa fiche et se met à jour en temps réel.',
      'Les notes clients sont privées (visibles uniquement par les employés, jamais sur les factures).',
      'Le badge de fidélité (Bronze/Argent/Or) s’affiche automatiquement selon le CA total.',
      'Les coordonnées peuvent être masquées pour les utilisateurs sans permission "view_client_contacts".',
      'Le graphique d’achats révèle la saisonnalité : périodes de forte/faible activité du client.',
      'Les produits préférés permettent d’anticiper les besoins et de proposer des offres ciblées.',
      'Un client avec plus de 30 jours de retard de paiement reçoit un badge d\'alerte.',
      'Le relevé de compte PDF peut être envoyé au client sur demande (transparence).',
      'Les données RGPD : le client peut demander l’export ou la suppression de ses données.',
      'La fusion de profils clients transfère automatiquement tout l’historique vers le profil conservé.'
    ]),

  // ── Produits ──
  GUIDE('/products', 'Produits', 'Catalogue produits complet : création, édition, gestion du stock, images, imports/exports et actions groupées.',
    [
      'Créez un nouveau produit avec "Nouveau produit" : renseignez nom, description, catégorie, prix de vente, prix de revient (coût), stock initial, conteneur, entrepôt, fournisseur.',
      'Téléversez une image du produit (formats acceptés : JPG, PNG, max 5Mo) qui sera automatiquement optimisée et hébergée sur Cloudinary.',
      'Le SKU (référence) est généré automatiquement mais reste modifiable (doit être unique par boutique).',
      'Utilisez les filtres rapides en haut : recherche par nom/SKU, catégorie, conteneur, entrepôt, fournisseur, plage de prix, plage de stock.',
      'Sélectionnez plusieurs produits avec les cases à cocher pour activer les actions groupées : modification en masse, suppression, duplication, export.',
      'Modifiez plusieurs produits en une fois : sélectionnez-les, cliquez "Modifier la sélection", changez les champs communs (prix, catégorie, entrepôt, etc.).',
      'Dupliquez un produit pour créer rapidement une variante (même produit dans un autre conteneur/couleur) : copie tout sauf le SKU.',
      'Ouvrez un produit pour voir sa fiche détaillée : stock actuel, historique des ventes, mouvements de stock, statistiques, galerie d\'images.',
      'Exportez le catalogue en Excel avec toutes les données : nom, catégorie, prix, stock, fournisseur, marge, etc. + une feuille "Listes de valeurs" avec toutes les catégories/conteneurs/entrepôts/fournisseurs existants.',
      'Importez des produits en masse depuis Excel : téléchargez le modèle, remplissez, importez (validation et rapport d\'erreurs avant exécution).',
      'Migrez les données produits : si vous changez une catégorie/conteneur/fournisseur dans les paramètres, utilisez "Migrer données" pour mettre à jour les produits concernés.',
      'Filtrez les produits par statut : Tous, Actifs, Inactifs, Stock critique (<5), Rupture de stock (0).',
      'Triez les colonnes : cliquez sur les en-têtes (Nom, Catégorie, Prix, Stock) pour trier A-Z ou Z-A.',
      'Consultez les statistiques en haut : Nombre total de produits, Valeur totale du stock (prix × stock), Produits en alerte, Produits inactifs.'
    ],
    [
      'Le SKU est généré automatiquement mais reste modifiable (format : SKU-timestamp-random).',
      'La duplication crée une copie identique pour un nouveau conteneur/variante (gagner du temps).',
      'Les images partagées : si plusieurs produits ont le même nom, leurs images sont partagées dans une galerie commune.',
      'Le prix de revient (costPrice) sert à calculer la marge : (prix de vente - prix de revient) / prix de vente × 100.',
      'Les produits inactifs (isActive=false) n’apparaissent plus dans les formulaires de vente mais restent dans le catalogue.',
      'Le stock minimum (minStockLevel) déclenche une alerte quand le stock descend en dessous (par défaut 5 unités).',
      'Les catégories, conteneurs, entrepôts et fournisseurs sont dynamiques : les dropdowns affichent uniquement les valeurs existantes dans vos produits.',
      'L’export Excel inclut une feuille "Listes de valeurs" : toutes les catégories, conteneurs, entrepôts et fournisseurs avec téléphones pour référence rapide.',
      'L’import en masse valide les données avant insertion : rapport d\'erreurs affiché (SKU dupliqué, prix invalide, etc.).',
      'La migration de données ne concerne que les produits avec stock > 0 (évite de modifier des produits dormants).',
      'Les actions groupées économisent du temps : changez la catégorie de 50 produits en 10 secondes.',
      'Les produits supprimés sont archivés (soft delete) : non visibles mais restaurables en base de données.',
      'La recherche est instantanée et insensible à la casse (majuscules/minuscules).',
      'Les filtres se combinent : vous pouvez filtrer par catégorie ET conteneur ET plage de prix simultanément.',
      'Le badge "Stock bas" (orange) apparaît quand stock ≤ minStockLevel, "Rupture" (rouge) quand stock = 0.'
    ]),
  GUIDE('/products/:id/:slug?', 'Détail produit', 'Fiche produit complète : stock actuel, historique des ventes, mouvements de stock, statistiques de performance et galerie d\'images.',
    [
      'Consultez les informations principales : nom, SKU, catégorie, conteneur, entrepôt, fournisseur avec téléphone.',
      'Visualisez le stock actuel avec badge de statut (Disponible/Stock bas/Rupture) et indicateur visuel.',
      'Consultez le prix de vente, prix de revient (coût) et marge unitaire calculée automatiquement.',
      'Modifiez le produit en cliquant sur "Modifier" : changez nom, prix, catégorie, image, etc. (droits admin requis).',
      'Visualisez la galerie d\'images : toutes les photos de ce produit + images partagées des produits portant le même nom.',
      'Consultez les statistiques de vente sur 30 jours : Unités vendues, CA généré, Marge totale, Nombre de commandes.',
      'Analysez le graphique d\'évolution des ventes (unités) sur les 30 derniers jours pour identifier les tendances.',
      'Consultez l\'historique des 10 dernières ventes : date, client, quantité, prix unitaire, montant total.',
      'Visualisez les mouvements de stock : historique complet des entrées/sorties avec dates, types (vente/ajustement/casse/vol/péremption), quantités, auteurs.',
      'Enregistrez une sortie de stock (perte) : casse, vol, péremption, cadeau, usage personnel avec quantité et motif (droits admin).',
      'Demandez un ajustement de stock à un administrateur si vous n\'avez pas les droits : créez une demande avec raison.',
      'Consultez les indicateurs de rotation : taux de rotation (ventes/stock moyen), couverture stock (jours de vente restants).',
      'Dupliquez le produit pour créer une variante rapide (autre conteneur/couleur/taille).'
    ],
    [
      'Les images partagées s\'affichent pour les produits du même nom : pratique pour les variantes.',
      'Le stock est mis à jour automatiquement lors des ventes (décrément) et des retours (incrément).',
      'Les mouvements de stock sont immuables : un enregistrement ne peut être modifié, seulement ajouté (traçabilité).',
      'La marge affichée est la marge brute : (prix de vente - prix de revient) / prix de revient × 100.',
      'Le taux de rotation optimal varie selon le secteur : >4 est excellent pour des produits de consommation.',
      'La couverture stock indique combien de jours vous pouvez tenir avec le stock actuel au rythme de vente moyen.',
      'Un produit avec couverture < 7 jours nécessite un réapprovisionnement urgent.',
      'Les sorties de stock (casse/vol) impactent négativement la rentabilité : suivre mensuellement.',
      'Les demandes d\'ajustement sont tracées et nécessitent validation admin (évite les erreurs).'
    ]),
  GUIDE('/products/edit/:id/:slug?', 'Édition produit', 'Modification d\'un produit existant : nom, prix, image, stock et métadonnées.',
    [
      'Modifiez le nom du produit (attention : impacte l\'affichage dans tout l\'historique).',
      'Changez la catégorie si le produit a été mal classé initialement.',
      'Ajustez le prix de vente : la modification s\'applique uniquement aux futures ventes (historique préservé).',
      'Modifiez le prix de revient (coût) pour recalculer la marge sur les futures ventes.',
      'Changez le conteneur ou l\'entrepôt si le produit a été déplacé.',
      'Modifiez le fournisseur et son téléphone.',
      'Ajustez le stock minimum (minStockLevel) pour adapter le seuil d\'alerte.',
      'Changez ou ajoutez une image : l\'ancienne est conservée dans Cloudinary.',
      'Modifiez la description pour améliorer la présentation.',
      'Changez le SKU si nécessaire (attention : doit rester unique).',
      'Enregistrez les modifications : elles sont tracées avec date et auteur.'
    ],
    [
      'La modification est immédiatement visible dans le catalogue.',
      'Les ventes passées conservent le prix au moment de la vente (pas de rétroactivité).',
      'Changer le nom peut impacter les recherches et les filtres : à éviter si possible.',
      'Les changements de prix sont enregistrés dans l\'activité du produit (audit).',
      'Un produit avec des ventes ne peut pas être supprimé : le marquer inactif à la place.',
      'Toute modification nécessite les droits admin par sécurité.'
    ]),
  GUIDE('/products/critical', 'Stock critique', 'Liste des produits dont le stock est passé sous le seuil minimal défini (alerte de réapprovisionnement).',
    [
      'Consultez tous les produits avec stock actuel ≤ niveau de stock minimum (par défaut 5 unités).',
      'Visualisez pour chaque produit : nom, catégorie, stock actuel, stock minimum, écart, fournisseur.',
      'Triez par écart (différence stock actuel - stock min) pour prioriser les plus urgents.',
      'Cliquez sur un produit pour ouvrir sa fiche et commander auprès du fournisseur.',
      'Contactez le fournisseur directement depuis la liste (téléphone affiché si renseigné).',
      'Exportez la liste en Excel pour créer un bon de commande fournisseur.',
      'Filtrez par fournisseur pour regrouper les commandes par source d\'approvisionnement.',
      'Consultez le total de produits en alerte en haut de page.'
    ],
    [
      'Le seuil minimal se règle dans la fiche produit (champ minStockLevel).',
      'Un seuil bien calibré évite les ruptures de stock ET l\'immobilisation excessive de trésorerie.',
      'Pour les produits à rotation rapide : seuil = ventes moyennes × délai de livraison + marge de sécurité.',
      'Consultez cette page hebdomadairement pour anticiper les commandes fournisseurs.',
      'Les produits en rupture totale (stock = 0) apparaissent en rouge prioritaire.',
      'Utilisez l\'export Excel pour envoyer la liste par email à vos fournisseurs.'
    ]),
  GUIDE('/products/out-of-stock', 'Ruptures de stock', 'Produits totalement épuisés (stock = 0) nécessitant un réapprovisionnement immédiat.',
    [
      'Listez tous les produits avec stock = 0 unités (rupture totale).',
      'Visualisez pour chaque produit : nom, catégorie, dernière vente (date), fournisseur, téléphone fournisseur.',
      'Triez par date de dernière vente pour identifier les plus demandés récemment (priorité haute).',
      'Ouvrez un produit pour consulter son historique de ventes et évaluer la demande.',
      'Contactez le fournisseur directement depuis la liste pour commander.',
      'Marquez un produit comme inactif s\'il n\'est plus commercialisé.',
      'Exportez la liste en CSV pour suivi ou bon de commande fournisseur.',
      'Créez un bon de commande fournisseur directement depuis cette page (module Achats requis).'
    ],
    [
      'Pensez au module Achats pour passer un bon de commande fournisseur structuré.',
      'Les ruptures de stock coûtent cher : perte de CA + insatisfaction client.',
      'Analysez la fréquence de rupture par produit pour ajuster les quantités de commande.',
      'Les produits sans vente depuis 30+ jours et en rupture peuvent être discontinués.',
      'Le tri par dernière vente révèle les produits à forte demande vs stock dormant épuisé.',
      'Un produit en rupture n\'apparaît plus dans les formulaires de vente.',
      'Utilisez cette page quotidiennement en période de forte activité.'
    ]),
  GUIDE('/products/never-sold', 'Produits jamais vendus', 'Produits sans aucune vente enregistrée.',
    ['Identifiez les références dormantes.', 'Décidez de promouvoir ou retirer ces produits.'],
    ['Utile pour nettoyer le catalogue.']),
  GUIDE('/products/slow-movers', 'Ventes lentes', 'Produits à rotation lente sur une période donnée.',
    ['Choisissez la période d’analyse.', 'Consultez le résumé et la liste des produits lents.'],
    ['Combinez avec « Jamais vendus » pour détecter les stocks morts.']),
  GUIDE('/products/losses', 'Pertes de stock', 'Journal des sorties de stock (casse, perte, péremption).',
    ['Filtrez par motif ou période.', 'Consultez le montant total des pertes.'],
    ['Chaque sortie est tracée avec son auteur et sa raison.']),
  GUIDE('/products/top-sellers', 'Meilleures ventes', 'Classement des produits les plus vendus.',
    ['Consultez le top produits du mois.', 'Utilisez-le pour prioriser vos achats.'],
    ['Les données proviennent des ventes réelles du tenant.']),
  GUIDE('/products/by-supplier', 'Produits par fournisseur', 'Catalogue groupé par fournisseur.',
    ['Choisissez un fournisseur pour voir ses produits.', 'Comparez les coûts d’achat entre fournisseurs.'],
    ['Le profil fournisseur détaille les produits liés.']),
  GUIDE('/products/by-container', 'Produits par conteneur', 'Produits regroupés par conteneur d’import.',
    ['Suivez les arrivages par conteneur.', 'Ouvrez un conteneur pour voir ses produits.'],
    ['Pratique pour valoriser un lot importé.']),
  GUIDE('/products/by-warehouse', 'Produits par entrepôt', 'Répartition du stock par entrepôt / boutique.',
    ['Visualisez les quantités par site.', 'Identifiez les transferts nécessaires entre boutiques.'],
    ['Les transferts se font dans le module Inventaire v2.']),
  GUIDE('/product-dashboard', 'Analytics produits', 'Tableau de bord produits : valeur de stock et rotations.',
    ['Consultez la valeur totale du stock.', 'Analysez les produits vendus et dormants.', 'Exportez les indicateurs si nécessaire.'],
    ['La valeur de stock est calculée au coût d’achat.']),
  GUIDE('/suppliers/:name', 'Profil fournisseur', 'Détail d’un fournisseur et de ses produits.',
    ['Consultez les produits fournis et leur coût.', 'Comparez les volumes par période.'],
    ['Les bons de commande liés se gèrent dans le module Achats.']),

  // ── Inventaire v2 ──
  GUIDE('/inventory-v2', 'Inventaire', 'Moteur d’inventaire : soldes, transferts, inventaires physiques et rapprochement.',
    ['Onglet Soldes : consultez le stock par produit et par boutique.', 'Onglet Transferts : créez un transfert, expédiez-le puis réceptionnez-le à destination.', 'Onglet Inventaires : ouvrez un comptage, saisissez les quantités comptées puis publiez.', 'Onglet Ajustements : saisissez une entrée ou sortie signée avec motif.', 'Onglet Rapprochement : vérifiez la cohérence stock hérité ↔ registre.'],
    ['Une quantité positive = entrée, négative = sortie.', 'Publier un inventaire applique automatiquement les écarts.']),

  // ── Achats ──
  GUIDE('/purchasing', 'Achats', 'Cycle d’achat complet : bon de commande, expédition, facture et règlement.',
    ['Créez un bon de commande avec fournisseur et lignes.', 'Soumettez puis approuvez le bon.', 'Réceptionnez la marchandise (complète ou partielle).', 'Suivez les expéditions entrantes (planifiée → en transit → reçue).', 'Comptabilisez la facture fournisseur puis enregistrez les paiements.'],
    ['L’onglet « À payer » résume les dettes fournisseurs.', 'La réception met à jour le stock automatiquement.']),

  // ── Retours ──
  GUIDE('/returns', 'Retours & remboursements', 'Gestion des retours de vente et des remboursements clients.',
    ['Sélectionnez la vente concernée dans la liste.', 'Créez un retour en choisissant produit, quantité et disposition (remise en stock, endommagé, jeté).', 'Passez le retour pour réintégrer le stock.', 'Enregistrez un remboursement avec montant, méthode et motif.'],
    ['Seules les quantités réellement vendues peuvent être retournées.', 'Un retour « remise en stock » réintègre automatiquement le stock v2.']),

  // ── Rapports ──
  GUIDE('/reporting', 'Rapports, exports & imports', 'Agrégats de ventes, exports asynchrones et imports par lots.',
    ['Onglet Rapport ventes : regroupez par jour, semaine, mois ou année.', 'Onglet Rapport inventaire : filtrez sous le seuil minimal si besoin.', 'Onglet Exports : lancez un export ventes ou inventaire puis téléchargez-le une fois prêt.', 'Onglet Imports : collez un CSV (name, description, category, price), vérifiez les erreurs, confirmez puis exécutez.'],
    ['Les exports sont générés en arrière-plan : actualisez pour voir leur statut.', 'Un import ne crée que les lignes valides ; les erreurs sont listées avant exécution.']),

  // ── Bascule ──
  GUIDE('/cutover', 'Bascule v2', 'Drapeaux de lecture v2 et rapports de rapprochement archivés.',
    ['Activez ou désactivez la lecture v2 par domaine avec les interrupteurs.', 'Générez un rapport de rapprochement pour figer l’état de vos données.', 'Consultez un rapport archivé pour comparer avant/après.'],
    ['Les drapeaux ne contrôlent que la lecture : l’écriture duale reste active.', 'Archivez un rapport avant chaque bascule de domaine.']),

  // ── Comptabilité ──
  GUIDE('/comptabilite', 'Comptabilité', 'Suivi financier : synthèse, résultat, dépenses et journal.',
    ['Choisissez la période (mois, année…).', 'Consultez la synthèse (encaissé, dû, dépenses).', 'Ouvrez le journal pour le détail des écritures.', 'Imprimez le rapport si nécessaire.'],
    ['Les données proviennent des ventes, dépenses et paiements enregistrés.']),

  // ── Dépenses ──
  GUIDE('/expenses', 'Dépenses', 'Enregistrement et suivi des dépenses de l’entreprise.',
    ['Ajoutez une dépense : montant, catégorie et date.', 'Filtrez par catégorie ou période.', 'Modifiez ou supprimez une dépense depuis la liste.'],
    ['Les catégories se gèrent dans les paramètres (lookups).']),
  GUIDE('/expenses/monthly-plan', 'Objectif mensuel', 'Plan de dépenses mensuel : comparez prévu et réel.',
    ['Consultez les dépenses et ventes du mois.', 'Comparez au budget défini.', 'Ajustez votre plan si nécessaire.'],
    ['Le total du mois se met à jour automatiquement.']),

  // ── Employés ──
  GUIDE('/employees', 'Employés', 'Gestion des employés : profils et accès.',
    ['Créez un employé avec « Nouvel employé ».', 'Ouvrez une fiche pour modifier ou gérer la paie.', 'Suivez avances et fiches de paie depuis la fiche.'],
    ['Les fiches de paie sont traitées séparément (statuts pending/paid/cancelled).']),
  GUIDE('/employees/new', 'Nouvel employé', 'Création d’un employé.',
    ['Renseignez nom, poste et salaire.', 'Enregistrez pour créer la fiche.'],
    ['Les champs d’adresse ont été volontairement retirés du formulaire.']),
  GUIDE('/employees/:id/:slug?', 'Fiche employé', 'Détail employé : informations, paie et avances.',
    ['Modifiez les informations de l’employé.', 'Créez une fiche de paie depuis l’onglet paie.', 'Enregistrez une avance sans limite de montant.'],
    ['L’historique de paie reste consultable dans la fiche.']),
  GUIDE('/employees/:id/:slug?/payroll', 'Paie', 'Fiches de paie et avances de l’employé.',
    ['Créez une fiche de paie ou une avance.', 'Marquez les fiches payées.', 'Imprimez les fiches.'],
    ['Les statuts possibles : pending, paid, cancelled.']),
  GUIDE('/employees/:id/:slug?/payroll/new', 'Nouvelle fiche de paie', 'Création d’une fiche de paie.',
    ['Renseignez salaire de base, primes et retenues.', 'Enregistrez puis marquez la fiche comme payée.'],
    ['Le salaire de l’employé est pré-rempli si défini.']),
  GUIDE('/employees/:id/:slug?/payroll/:payslipId/edit', 'Édition fiche de paie', 'Modification d’une fiche de paie existante.',
    ['Ajustez primes, retenues ou avances.', 'Enregistrez les modifications.'],
    ['Une fiche payée peut être annulée (statut cancelled).']),
  GUIDE('/employees/:id/:slug?/payroll/:payslipId/print', 'Impression fiche de paie', 'Fiche de paie prête à imprimer.',
    ['Vérifiez les montants affichés.', 'Imprimez ou enregistrez en PDF.'],
    ['Le document est au format A4.']),

  // ── Documents ──
  GUIDE('/documents', 'Documents', 'Archivage des documents (fiscaux, contrats…).',
    ['Téléversez un fichier avec type, date et note.', 'Filtrez par année.', 'Téléchargez ou supprimez un document depuis la liste.'],
    ['Les documents sont classés par date automatiquement.']),

  // ── Paramètres ──
  GUIDE('/settings', 'Paramètres', 'Configuration de la boutique : marque, dates et modules.',
    ['Personnalisez le nom et le logo de la boutique.', 'Réglez les formats de dates et la devise.', 'Gérez votre abonnement et le catalogue de plans.', 'Configurez les lookups (catégories, fournisseurs, boutiques).'],
    ['Certains réglages nécessitent le rôle administrateur.']),

  // ── Sécurité ──
  GUIDE('/security', 'Sécurité', 'Sécurité du compte : sessions et authentification à deux facteurs.',
    ['Consultez vos sessions actives et révoquez celles suspectes.', 'Activez la MFA avec votre application d’authentification.', 'Déconnectez toutes les autres sessions si nécessaire.'],
    ['Un code MFA sera demandé pour les actions sensibles une fois activé.']),

  // ── Support ──
  GUIDE('/support', 'Assistance', 'Échange avec l’équipe support.',
    ['Créez un ticket avec catégorie, sujet et message.', 'Suivez les réponses dans le fil de discussion.', 'Répondez directement depuis la page.'],
    ['Le badge dans le menu indique les réponses non lues.']),

  // ── Demandes admin ──
  GUIDE('/admin-requests', 'Demandes admin', 'Demandes de modification (stock, mot de passe…) soumises à un administrateur.',
    ['Créez une demande depuis la page concernée (ex. produit).', 'Suivez le statut : en attente, approuvée, rejetée.', 'Les administrateurs traitent les demandes avec un commentaire.'],
    ['Une demande approuvée est appliquée automatiquement.']),

  // ── Modules ──
  GUIDE('/admin-modules', 'Modules', 'Activation des modules et paramètres avancés.',
    ['Activez ou désactivez un module avec l’interrupteur.', 'Modifiez les paramètres hiérarchisés en bas de page.', 'Enregistrez pour appliquer.'],
    ['Le backend reste décisionnaire : un module désactivé bloque les actions même si l’interface l’affiche.']),

  // ── Filtres ultimes ──
  GUIDE('/ultimate-filters', 'Filtres ultimes', 'Recherche avancée multi-domaines.',
    ['Choisissez un domaine (ventes, produits, clients…).', 'Composez vos filtres (date, statut, montant…).', 'Exportez les résultats vers Excel.'],
    ['Les filtres se combinent entre eux.']),

  // ── Utilisateurs ──
  GUIDE('/users/stats', 'Utilisateurs', 'Tableau de bord utilisateurs : activité et statistiques.',
    ['Consultez les indicateurs d’activité.', 'Analysez les ventes par utilisateur.', 'Gérez les objectifs des vendeurs.'],
    ['Le rapport hebdomadaire peut être envoyé par notification.']),
  GUIDE('/admin/users', 'Gestion utilisateurs', 'Comptes utilisateurs du tenant : création, rôles et activation.',
    ['Créez un compte avec rôle et photo.', 'Activez ou désactivez un compte.', 'Réinitialisez un mot de passe si nécessaire.'],
    ['Les rôles déterminent les permissions appliquées.']),
  GUIDE('/users/login-stats', 'Connexions', 'Historique des connexions des utilisateurs.',
    ['Repérez les connexions récentes.', 'Ouvrez une activité pour le détail (IP, appareil).'],
    ['Utile pour détecter un accès inhabituel.']),
  GUIDE('/users/login-activity/:id', 'Détail de connexion', 'Détail d’une session : appareil, localisation et risque.',
    ['Vérifiez la localisation et l’appareil utilisés.', 'Évaluez le niveau de risque affiché.'],
    ['En cas de doute, révoquez la session depuis Sécurité.']),

  // ── Plateforme ──
  GUIDE('/super-admin', 'Super Admin', 'Console plateforme : boutiques, utilisateurs plateforme, abonnements et audit.',
    ['Onglet Boutiques : créez, suspendez ou changez le plan d’une boutique.', 'Onglet Abonnements/Paiements : suivez les règlements.', 'Onglet Utilisateurs : gérez les comptes plateforme.', 'Onglet Journal : consultez l’audit des actions.', 'Onglet Ressources : téléchargez les documents PDF et modifiez leur contenu.'],
    ['L’accès supervision (impersonation) est en lecture seule et exige une raison + code MFA le cas échéant.']),
  GUIDE('/profile', 'Profil', 'Votre profil utilisateur.',
    ['Mettez à jour nom, photo et informations.', 'Consultez vos statistiques de ventes.', 'Modifiez vos préférences.'],
    ['Le mot de passe se change via la procédure de réinitialisation.']),
];

/**
 * Trouve le guide correspondant à un chemin : correspondance exacte d’abord,
 * puis motifs dynamiques (:id, :name, :userId, :slug…).
 */
export function matchGuide(pathname) {
  const path = pathname || '/';
  const exact = PAGE_GUIDES.find((g) => g.path === path);
  if (exact) return exact;
  const matchers = PAGE_GUIDES
    .filter((g) => g.path.includes(':'))
    .map((g) => ({
      guide: g,
      regex: new RegExp(`^${g.path.replace(/:[A-Za-z]+/g, '[^/]+').replace(/\?/g, '')}$`),
    }));
  const found = matchers.find((m) => m.regex.test(path));
  return found ? found.guide : null;
}

export default PAGE_GUIDES;
