# Returning to sales history

Date: 2026-10-25

## Delivered

- Browser Back restores the list search, regular filters, quick filters, and history workspace.
- The explicit return-to-sales link carries a history-entry token and preserves its URL filters.
- After data loads, the selected sale is brought into view and its link receives keyboard focus without another scroll. If the record has disappeared from the filtered list, the saved scroll offset is used instead.
- Snapshots use tab-local session storage, scoped by shop, user, and browser history entry. Missing identity disables persistence. Snapshots expire after 30 minutes.
- Fresh navigation does not restore old filters; explicit return filters must match their snapshot. Form hash links retain their form destination.
- Only UI state, a sale identifier, and the scroll offset are stored. Sale records are fetched again through the existing authorized endpoint.
- Storage failures do not block navigation. Scroll writes are limited to one per animation frame.
- Existing desktop new-tab behavior remains available, including snapshots for normal clicks, middle-clicks, and context-menu opening.

## Validation

Six new automated checks cover browser Back, explicit return, delayed data, missing records, shop/user/history isolation, expiration, malformed data, and unavailable storage. They run alongside the existing thirty UX regression checks. Production frontend compilation is checked.

## Remaining acceptance work

- Verify actual scrolling and focus in supported mobile/desktop browsers with authenticated accounts, including desktop new-tab returns.
- Confirm behavior when a selected sale is deleted or stops matching filters while its detail page is open.
- Expanded history modal returns restore the main list record; modal-open state is intentionally not persisted in this increment.
