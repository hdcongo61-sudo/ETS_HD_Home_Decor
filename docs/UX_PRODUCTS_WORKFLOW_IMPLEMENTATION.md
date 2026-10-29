# Product workflow improvements

Implemented 2026-10-25:

- Product detail loading now distinguishes a missing product from a failed request and offers retry/return actions.
- Product statistics, linked sales, and stock-removal history have independent recovery states instead of silently displaying zero or empty data.
- Catalogue and detail use the same stock status thresholds and labels.
- Editing product metadata no longer sends a stock change through the general product update form. Existing stock is shown with a link back to the product workflow for reviewed adjustments.
- Product create/update now leaves a completion result with a direct link to the saved product.
- Lookup failures in the create form are visible and retryable instead of appearing as missing reference data.

The focused product, inventory-adjustment, and stock-removal suites pass: 13 tests across 3 suites. The production frontend build succeeds with the two existing accounting/admin unused-variable warnings. Browser verification at mobile widths and authenticated product-detail failure injection remain open.
