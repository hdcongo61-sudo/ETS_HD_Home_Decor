# Paiements d'abonnement PawaPay (mobile money)

Les boutiques peuvent payer leur abonnement par **mobile money via PawaPay**.
L'autre mode de paiement reste **l'espèce versée au super-admin** (saisie
manuelle, inchangée).

## Configuration (backend)

| Variable | Description |
| --- | --- |
| `PAWAPAY_API_TOKEN` | Jeton Bearer du dashboard PawaPay (sandbox ≠ prod). Sans jeton, l'UI mobile money est masquée. |
| `PAWAPAY_BASE_URL` | `https://api.sandbox.pawapay.io` (défaut) ou `https://api.pawapay.io` |
| `PAWAPAY_PROVIDERS` | Optionnel, JSON : `[{"id":"MTN_MOMO_CIV","label":"…","country":"CIV","currency":"XOF"}]`. Les IDs doivent être activés sur le compte PawaPay. |
| `PAWAPAY_PUBLIC_KEY` | Optionnel, clé publique PEM pour vérifier les callbacks signés (RFC-9421). Sans elle, les callbacks sont acceptés sur confiance (avec journalisation). |

Voir `backend/.env.example`.

## Flux

1. La boutique (Admin) ouvre **Paramètres → Abonnement → Payer mon abonnement**,
   choisit l'opérateur, le numéro et le montant.
2. `POST /api/tenants/payment/pawapay/initiate` crée un dépôt PawaPay
   (`POST /v2/deposits`) et une ligne `SubscriptionPayment` (statut `pending`).
3. Le client valide le paiement sur son téléphone. Le frontend interroge
   `GET /api/tenants/payment/pawapay/:depositId` toutes les 5 s.
4. PawaPay appelle `POST /api/tenants/payment/pawapay/webhook` (configurer
   l'URL dans le dashboard : `<APP>/api/tenants/payment/pawapay/webhook`).
5. Statut final `COMPLETED` :
   - ajout dans `Tenant.payments` (`method: 'mobile_money'`),
   - `lastPaymentAt` mis à jour, `nextPaymentDue` +1 mois,
   - `status = 'active'` (réactive une boutique suspendue/expirée),
   - audit plateforme `tenant.payment_pawapay`.

## Boutiques suspendues / expirées

Les routes de facturation utilisent `protectForBilling` : une boutique
suspendue ou en fin d'essai peut toujours payer. Le token est conservé et la
page `/access-restricted` propose la réactivation par mobile money (ou espèces
auprès du support).

## Vérification des callbacks

- `Content-Digest` (sha-256/sha-512) toujours vérifié s'il est présent.
- Signature RFC-9421 (`Signature` + `Signature-Input`) vérifiée si
  `PAWAPAY_PUBLIC_KEY` est configuré (ECDSA P-256/P-384, RSA-PSS, RSA PKCS#1
  v1.5). Le corps brut est capturé via le hook `verify` d'`express.json`.

## Endpoints

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/api/tenants/payment/pawapay/config` | Billing (boutique) |
| POST | `/api/tenants/payment/pawapay/initiate` | Billing + admin boutique |
| GET | `/api/tenants/payment/pawapay/:depositId` | Billing (boutique) |
| POST | `/api/tenants/payment/pawapay/webhook` | Public (PawaPay) |
| POST | `/api/tenants/:id/payment` | Super-admin (espèces) — existant |
