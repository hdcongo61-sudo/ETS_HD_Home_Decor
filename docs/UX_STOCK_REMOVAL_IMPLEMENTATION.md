# Stock removals — reason and quantity review

Date: 2026-10-25

## Delivered

- Product-detail non-sale stock removals use a shared full-screen mobile dialog.
- The user must explicitly choose a reason; Other requires a written explanation.
- Positive whole quantities are required. Fractions are rejected instead of truncated. Displayed available stock is checked before review; server stock validation remains authoritative.
- Product name, warehouse when available, current quantity, removal quantity, and resulting quantity are shown before confirmation.
- Review locks the entered fields until the user chooses Modify. No request is sent until confirmation.
- Save errors appear inside the dialog with request IDs when supplied. Entered quantity, reason, and note survive failed requests.
- A synchronous lock blocks repeated confirmation and closing during save.
- Success updates the displayed product from the server-returned quantity, reports remaining stock, reloads movement history/statistics, and broadcasts productStockChanged for the catalogue.
- API validation requires a valid reason, whole positive quantity, explanation for Other, and a note no longer than 300 characters. Existing authorization and tenant filtering are unchanged.

## Validation

50 frontend tests and 3 backend validation tests pass. Production build passes with the two existing unrelated lint warnings in Comptabilite.js and DashboardAdmin.js.

- Three dialog tests cover reason/quantity validation, explanation and review, failed submission retention, retry, duplicate clicks, close lock, and submitted payload.
- Three backend validation tests cover accepted inputs, fractional/nonpositive/nonfinite quantities, missing reasons/explanations, and note length.
- Existing frontend UX regression suites and production build are run together with this increment.

## Remaining work

- Authenticated live API and mobile/desktop visual checks, including modal focus and keyboard behavior.
- Signed Inventory V2 adjustments and direct product-edit quantity changes remain separate workflows; this increment applies to non-sale stock removals on product details.
- Database transactionality, concurrent stock writes, and idempotent retries need a dedicated backend audit. The new UI lock prevents repeated clicks in the active dialog, not all possible duplicate requests after uncertain network outcomes.
- Existing history/statistics loaders still need explicit recovery states for failed refreshes.
