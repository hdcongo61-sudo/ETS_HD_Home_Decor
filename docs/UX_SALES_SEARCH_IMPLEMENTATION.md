# Sales search and review — implementation increment

Date: 2026-10-25

## Delivered

- Search is visible above advanced filters for both seller and administrator history screens and in the expanded history view.
- Matching supports sale reference, identifier, client name (case/accent insensitive), and phone (with or without formatting).
- Sales history starts with all dates. Delivery links from Home no longer silently exclude older sales.
- Every active filter, including quick filters, has a visible remove control. Search can be cleared independently or together with all filters.
- Empty search results explain how to broaden the search and offer one reset action. Initial loading failures provide a retry action.
- Sale detail return links carry search, date, regular filters, quick filters, and the history workspace selection.
- Filter controls have a minimum 44px height. Search has an associated label and results are announced through a status region.
- The existing authorized sales-list API projection includes client phone numbers. Tenant and seller access rules are unchanged.

## Validation

- 12 search/navigation checks: references, identifiers, accented names, formatted phones, unmatched queries, missing clients, query round trips, empty date defaults, removable filters, and detail return links.
- 8 existing Home/payment regression checks.
- Production frontend compilation and backend JavaScript syntax check.

## Next acceptance work

- Verify against an authenticated live API with administrator and seller accounts.
- Visually verify 320px/375px layouts, touch targets, focus behavior, and screen reader announcements.
- Delivered in the next increment: sale-detail payment/delivery/invoice guidance and a chronological activity feed. See UX_SALE_DETAILS_IMPLEMENTATION.md.
- Implemented browser Back list state and selected-record/scroll restoration; real-browser acceptance checks remain pending. See UX_SALES_RETURN_IMPLEMENTATION.md.
- Evaluate pagination/server search for large datasets; this increment filters the records loaded by the existing list endpoint.
- Audit the other sales routes (archives and seller-specific history) separately before claiming global search parity.
