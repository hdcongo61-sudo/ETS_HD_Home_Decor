# Sale details — guided next action

Date: 2026-10-25

## Implemented

- A compact summary leads with client, total, collected amount, remaining balance, and the next action.
- Outstanding sales lead to payment. Paid sales awaiting delivery lead to delivery, with invoice download as a secondary action. Paid/delivered sales lead to invoice download.
- Cancelled sales have no transactional primary action. Inconsistent payment/status combinations ask the user to refresh rather than bypass backend requirements.
- Payment totals come from actual payment entries; missing payment arrays use the supplied total paid.
- Secondary editing, requests, reminders, detailed modification history, and profit visibility live in an expandable action group. Profit sections are collapsed by default.
- A dated activity list combines sale creation, payments, delivery, modification notes, and recorded reminders, newest first. Undated/invalid events are omitted.
- Initial load failures use the shared error component, show a request ID when available, offer retry for transient failures, and retain the return-to-sales action. Obsolete requests cannot replace the current sale.
- Delivery uses the shared full-screen mobile dialog. Failures remain in the dialog with input retained. A synchronous save lock prevents duplicate requests; controls and closing are locked during save.
- Editing a delivery note on an already delivered sale preserves its recorded delivery date.
- Existing invoice generation remains intact; its button accepts the shared primary/secondary visual treatment.

## Verification

30 tests pass across seven suites, including ten new workflow/detail checks and twenty existing regression checks.

- Automated workflow tests cover collection, delivery, invoice, cancellation, inconsistent states, amounts, and chronological activity.
- Full-page tests cover initial load retry, delivery failure/retry, duplicate save prevention, progression to invoice, and preservation of delivery timestamps.
- Existing Home, payment, and sales-search regression tests are included in validation.
- Production frontend build is checked. Two unrelated pre-existing lint warnings remain in Comptabilite.js and DashboardAdmin.js.

## Remaining acceptance work

- Authenticated live API checks for seller and administrator accounts.
- Visual checks at mobile and desktop widths, keyboard/focus behavior, PDF generation/download, and screen reader announcements.
- Browser Back list state and selected-record/scroll restoration are now implemented in the sales list. Real-browser acceptance checks remain pending.
- Other legacy detail-page sections, reminder forms, and modification-history modal still require progressive simplification.
