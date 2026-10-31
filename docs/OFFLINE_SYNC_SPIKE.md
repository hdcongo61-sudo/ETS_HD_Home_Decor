# Offline queue-and-sync — Spike (Phase 2)

> Objectif de la spike : **prouver qu'une vente peut être enregistrée hors
> ligne puis réconciliée avec le serveur**, sans perte ni doublon, avant
> d'investir dans la construction complète (20–35 j).

## Verdict de faisabilité

**✅ Faisable.** Le socle est déjà là pour les lectures ; il manque uniquement
la file de mutations et l'idempotence serveur. Les deux points bloquants ont
été levés par la spike (voir « Preuve de concept »).

## État des lieux (constaté dans le code)

| Couche | État |
|---|---|
| Lectures hors-ligne | ✅ [offlineCache.js](../frontend/src/utils/offlineCache.js) (IndexedDB GET, TTL 5 min) + read-through dans [api.js](../frontend/src/services/api.js) |
| Shell PWA | ✅ [service-worker.js](../frontend/public/service-worker.js) (app shell + cache runtime + `offline.html`) |
| Brouillon de vente | ✅ [saleDraft.js](../frontend/src/utils/saleDraft.js) (localStorage, sécurité de saisie — PAS une sync) |
| Indicateur hors-ligne | ✅ [OfflineIndicator.js](../frontend/src/components/OfflineIndicator.js) — mais annonce « les modifications nécessitent une connexion » |
| **Mutations hors-ligne** | ❌ **Absent** : POST/PUT échouent sans réseau, rien n'est mis en file |
| **Idempotence serveur** | ❌ **Absent** : le serveur ne déduplique pas une requête rejouée |

## Architecture proposée

1. **File locale (IndexedDB)** — chaque mutation à risque (vente, paiement,
   dépense, ajustement de stock) est *enqueue* avant l'envoi, avec un
   `clientRequestId` unique généré côté client.
2. **Rejeu ordonné (FIFO)** — au retour du réseau (`online` event + retry
   périodique), les opérations sont rejouées dans l'ordre.
3. **Idempotence serveur** — le serveur mémorise `clientRequestId` (index
   unique sparse par tenant) et, sur rejeu, renvoie la vente déjà créée au
   lieu d'en créer une seconde.
4. **Conflits** — un `409` stock/conflit n'est pas rejoué en aveugle : l'op est
   marquée `stale` et la file s'arrête pour que l'utilisateur révise. Les
   échecs réseau stoppent la file sans retirer l'op.

## Preuve de concept (livrée avec la spike)

- **Frontend** — [offlineQueue.js](../frontend/src/utils/offlineQueue.js) :
  enqueue/drain FIFO, stockage injectable (IndexedDB par défaut, mémoire pour
  les tests), détection de déduplication, arrêt sur erreur réseau.
  [offlineQueue.test.js](../frontend/src/utils/offlineQueue.test.js) : 4 tests
  verts (ordre FIFO, déduplication, conservation hors-ligne, unicité des clés).
- **Backend** — [saleModel.js](../backend/models/saleModel.js) : champ
  `clientRequestId` + index unique sparse par tenant ;
  [saleController.js](../backend/controllers/saleController.js) : `createSale`
  renvoie la vente existante si `clientRequestId` est déjà connu
  (`{ deduplicated: true }`).

### Résultat

- Une vente créée hors-ligne est mise en file, rejouée à la reconnexion, et le
  serveur ne crée **jamais de doublon** même si la requête part deux fois.

## Limites connues (à traiter dans la construction complète)

1. **Horodatage** : la date de vente d'un vendeur non-admin est fixée à la
   synchronisation, pas au moment de la saisie hors-ligne (le backend refuse
   les dates manuelles hors admin). → Autoriser un `occurredAt` signé, ou
   accepter la date de sync pour les vendeurs.
2. **Dépendances** : une vente hors-ligne référence des produits/clients. Le
   rejeu doit revalider le stock (d'où l'arrêt sur `409`).
3. **Ordre** : une vente puis son paiement doivent être rejouées dans l'ordre ;
   la file FIFO + arrêt sur échec couvre ce cas.
4. **Réconciliation des listes** : après rejeu, rafraîchir les listes/tableaux
   (le cache GET est déjà invalidé sur mutation réussie).
5. **Paiements partiels / retours** : mêmes clés d'idempotence à ajouter sur
   `addPayment` et les retours avant de les mettre en file.

## Effort de la construction complète

Estimé **20–35 jours** (cohérent avec le plan initial), découpé en :

1. Idempotence serveur sur `addPayment` / retours / dépenses (réutilise le
   pattern `clientRequestId`). — 2–3 j
2. Branchement de `offlineQueue` dans `api.js` (interception des mutations en
   échec réseau + rejeu auto). — 3–5 j
3. UI : compteur de file, statut « en attente de sync », reprise manuelle. — 3–4 j
4. Gestion des conflits + `occurredAt` hors-ligne. — 4–6 j
5. Tests bout-en-bout (mode avion) + durcissement. — 5–7 j

## Recommandation

**Aller sur la construction complète.** La spike a prouvé le maillon le plus
risqué (réconciliation sans doublon). Le backend d'idempotence livré ici est
déjà utile en production (double-clic / double-envoi sur réseau instable).
