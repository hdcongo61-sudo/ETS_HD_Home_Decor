# Inventory: permissions and recoverable section states

Implemented on 2026-10-25 in InventoryV2.

## Behavior

- Each balance, transfer, count, movement, reconciliation, lookup and permission request has independent loading, failure and retry state. A slow endpoint no longer blocks the whole workspace.
- A failed initial load displays an unavailable value (—), never a zero total or an empty journal. Reconciliation failures never imply coherence or a correction requirement.
- Failed refreshes retain the last successful records with a visible freshness warning. Errors use SectionError and preserve API request IDs. Retry reloads the affected section only.
- Global refresh shows its pending state and blocks repeated refresh clicks. Open forms retain their input while lookups reload or fail; their fieldsets disable until recovery.
- Mutation controls follow the current tenant's active membership permissions from GET /memberships/me. inventory.transfer, inventory.count and inventory.adjust are independent. Wildcard roles and legacy admin access match backend requirePermission behavior. Manual adjustments additionally match the active location's membership scope. Supervision sessions stay read-only.
- Read-only users retain access to reports and receive an explanation instead of unusable mutation controls. Missing permission data fails closed with a retryable error. Backend authorization remains authoritative.
- Workspace state resets on tenant/user changes. Request sequence checks prevent a slow old response overwriting a newer success or failure.
- Cancellation icons now have accessible labels.

## Verification

Automated coverage checks first-load failures, retained stale data, per-section retries, slow endpoints, read-only and scoped memberships, administrator compatibility, supervision, lookup failures, preserved form input and out-of-order responses. The selected frontend UX regression suite passes: 68 tests across 15 suites (13 new tests for this increment). The isolated production build succeeds with the two existing unused-variable warnings in Comptabilite.js and DashboardAdmin.js.

Live API authorization, mobile layouts, keyboard interaction and screen-reader behavior still need manual validation. Existing transfer/count submission design, manual product-ID entry, count input identity and mutation duplicate guards remain follow-up work; this change does not mark those workflows complete. Existing bounded list endpoints still limit KPI coverage; server aggregates/pagination remain separate work.
