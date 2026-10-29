# Dashboard: analysis and source-record exploration

Implemented: 2026-10-25. Route: /dashboard (distinct from the tasks-first home).

## Visual redesign update\n\nThe dashboard now uses one primary workspace flow: purpose and period context first, financial KPI summary second, one chart and its controls third, source data fourth, and secondary destinations behind a disclosure. Primary buttons use the shared blue command treatment, secondary exploration actions use the outlined treatment, and all interactive dashboard controls use a 44px minimum touch target. On narrow screens, cards stack, the period controls remain grouped, and data tables scroll inside a bounded region rather than widening the page.\n\n## Hierarchy and interaction

- The page now opens with Tableau de bord, its purpose, the successfully loaded financial period and links to financial synthesis, underlying data and sales.
- Duplicate mobile shortcut cards have been removed from the first screen. The administrator's existing related destinations remain available in the collapsed Explorer les autres espaces disclosure after the financial section.
- Financial KPI cards offer explicit actions: sales, payments, expenses or the daily calculation. These open and focus the corresponding table view instead of relying on chart pointer interactions alone.
- The financial chart retains day-click behavior and adds a visible table/detail action. The former “today” shortcut now opens the last loaded day of the displayed period, rather than claiming today's records are present when viewing an older period.
- A shared financial explorer presents daily values, source sales, collected payments and permitted expenses. Sales/payment records open their original sale. Expense records link to the selected day's expense list. Original saleNumber references are used where present.
- Daily profit for admins is paidProfit minus expenses, matching the existing cash-basis calculation. Sales and collection concepts are explicitly distinguished. Seller views omit expense/profit controls and columns. Negative payment/refund values remain signed.
- Financial tables initially show 30 rows, with incremental disclosure. Missing references do not produce invalid record links. Zero is displayed as zero rather than unavailable.
- Sales trend and status charts have visible sales-list links and an expandable raw-value table. Trend rows link by day when the server date is an ISO day; status rows link using the existing status filter. These status links explicitly say all dates because the destination does not accept the source's rolling date range.
- The top-product section links to the detailed ranking (period must be chosen there); identifiable products link to their own records. Existing advanced analytics and exports are retained.

## Reliability and scope

The main financial loader retains original errors/request IDs and offers retry. Failed initial loads do not render zero financial KPIs. After a failed refresh, the last loaded period is named and the financial views are hidden until retry succeeds, avoiding a chart with old data and new period labels. Latest-response checks protect the current-period loader and unmounts. Tenant/user/admin changes reset dashboard page state.

Expenses now accepts the existing date=YYYY-MM-DD day-detail URL and applies it to both start/end filters, including navigation between linked days.

The financial period and the independently selected commercial-statistics period are explicitly distinguished. Cross-page aggregate-range synchronization is not claimed. Several legacy secondary fetches still have console-only errors, comparison loading has its existing mechanics, and advanced analytics remains a separate existing component; a complete dashboard data-layer migration is follow-up work. Offline-cache responses retain existing API behavior; this change does not implement an independent dashboard freshness contract.

## Verification

Tests cover hierarchy, primary financial failure/retry, daily table values/profit calculation, sale/payment destinations, expense date links, permission-based columns, zero values and progressive disclosure. The selected UX regression suite passes 95 tests across 21 suites. The isolated production build succeeds with the two existing unused-variable warnings in Comptabilite.js and DashboardAdmin.js.

Authenticated browser review, visual chart interactions, expense API date behavior, tablet layouts, phone widths and screen-reader checks remain pending. No claim of visual/accessibility conformance is made from source tests alone.
