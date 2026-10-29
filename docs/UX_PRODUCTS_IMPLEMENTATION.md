# Products and stock — catalogue increment

Date: 2026-10-25

## Delivered

- Product search accepts name and SKU, ignoring case, accents, and surrounding spaces. Existing URL filter persistence continues to work.
- No-results states distinguish a filtered search from an empty catalogue. Both mobile and desktop representations offer a reset action when filters exclude all products.
- Catalogue load failures use the shared error display, preserving server messages and request IDs. Transient failures offer retry.
- Failed background refreshes keep the last successful catalogue and warn that quantities may be stale. Background refresh has a visible loading message.
- Request sequencing prevents a slower earlier response from overwriting the latest catalogue.
- Search, sort, stock presets, export controls, and removable filter chips use larger touch targets. Filter removal and mobile export buttons have accessible names; selected stock presets expose pressed state and result counts are announced.

## Validation

Eleven new automated checks cover accented names, SKU queries, missing identifiers, URL filtering, empty-result reset, empty catalogues, load retry, retained data after failed refresh, and out-of-order refresh responses. Run together with existing UX regressions and the production build.

## Remaining work

- Stock adjustments must show before/after quantities and require a reason; this increment does not change stock mutations.
- Audit configured minimum-stock thresholds across badges, quick filters, and dashboard totals before changing their existing shared threshold convention.
- Review receipt/transfer/count workflows and location context.
- Verify authenticated administrator/seller workflows and 320px/375px layouts in real browsers.
- Search remains client-side over the existing authorized catalogue response; large-catalogue server pagination is separate work.
