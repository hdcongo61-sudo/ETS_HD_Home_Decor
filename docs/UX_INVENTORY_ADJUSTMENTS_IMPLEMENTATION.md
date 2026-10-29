# Inventory V2 signed adjustments

Date: 2026-10-25

## Delivered

- Separate entry and review stages for signed quantity adjustments. Positive quantities add stock; negative quantities remove it. Existing fractional inventory quantity support is preserved.
- Product, nonzero finite quantity, nonnegative finite unit cost, and a written reason are validated. The reason is stored in the movement note and enforced by the API.
- Location follows the existing active-location header; without it, the oldest active location is displayed, matching middleware fallback.
- Product/location balances are loaded independently of the dashboard list. Preview uses only the default variant that the endpoint actually mutates.
- Missing/uninitialized balances are described explicitly; no initial zero is invented. The server calculates initialization and validates the final mutation.
- Load errors offer retry. Save errors retain input and request IDs. Duplicate clicks are blocked synchronously, and local close/tab/refresh controls are disabled while saving.
- Stock conflicts reload the selected balance and return the form to reviewable entry state with inputs retained.
- Success displays the authoritative returned quantity, refreshes balances/history/reconciliation, and broadcasts the stock-change event.

## Validation

55 frontend tests and five backend validation tests pass. Production build passes with two existing unrelated lint warnings.

Five form tests cover reason validation, balance/location lookup, preview and review, negative stock and invalid cost, retained failed inputs, repeated clicks, server-confirmed results, missing balances, and conflict refresh. Two backend adjustment validation tests cover signed/decimal quantities and invalid reason/cost values. Run with the existing UX and stock-removal regression checks plus production build.

## Remaining checks

- Authenticated API and mobile/desktop visual acceptance, especially active location headers and default location ordering.
- Permission-aware visibility of inventory mutation controls; backend permission checks remain authoritative.
- Server-side idempotency for uncertain network outcomes and full adjustment integration against a transactional database.
- Direct product-edit stock changes and broader inventory loading/error-state consolidation.
