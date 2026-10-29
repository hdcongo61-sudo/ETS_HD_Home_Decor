# Guided sale workflow

Implemented 2026-10-25: sale entry now presents a validated sequence of client, products, payment, and final review. Users can return to completed stages, each transition validates the information needed for the next step, and the final review summarizes the client, line items, note, totals, payment, and remaining balance before the existing save action runs. Stage changes move keyboard focus and scroll the new heading into view on mobile. The proforma path shares client/products/review stages and uses offer validity in place of sale payment.

Existing tenant/user/mode-scoped draft recovery continues to preserve the in-progress form. Repeated submission remains locked and failed saves retain inputs. Eight focused SaleForm tests pass; the production frontend build succeeds with two pre-existing unused-variable warnings in accounting and the admin dashboard.

Still open: browser-based mobile/keyboard verification; a durable post-save receipt/result screen with next actions; unknown-outcome/idempotency behavior if a request succeeds server-side but the response is lost; and making PDF export retryable without issuing a duplicate proforma.
