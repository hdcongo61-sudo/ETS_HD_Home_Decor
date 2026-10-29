# Major-page UX audit and redesign specification

Date: 2026-10-25  
Scope: tenant application; platform administration is a separate workspace.  
Method: static source review of navigation, major pages, shared UI, mutations and recovery paths. This is a design and implementation specification, not a claim that the redesign has shipped or that browser usability testing has passed.

## 1. Recommendation

Keep the shared Fluent visual foundation and the recent sales, catalogue and inventory recovery improvements. Redesign around the work users complete: sell, collect payment, deliver, find stock, reconcile cash and resolve exceptions. The highest priority is reliable completion and recovery, followed by information hierarchy and responsive presentation.

A card/table switch alone does not establish good mobile UX. The next screen, action, permission, save result and recovery path must remain understandable on a small display and a slow connection.

The historical mobile plan dated 2026-08-24 is a record of layout changes. Its “completed,” “already optimal,” contrast and accessibility statements have not been established by this audit. Employees already has mobile cards; it should not be treated as a missing-card task. Sales already contains responsive presentations and must not be rebuilt simply to add cards again.

## 2. Evidence and important gaps

| Priority | Source evidence | User consequence | Required change |
| --- | --- | --- | --- |
| P0 | GlobalSaleModal.js:68 uses a sale draft key based on user ID only; SaleForm.js:88–130 restores and persists the stored selections | A user switching shops can be offered selections from a different shop; stale products/prices can be restored | Scope drafts by tenant, user and document mode; add expiry/version validation; revalidate referenced records and prices before submission; never migrate an ambiguous legacy draft automatically |
| P0 | SaleForm.js:322 starts submission by setting React state; its workflowSteps at ~428 are completion indicators and the component remains one form | The apparent stages do not guide navigation or provide a final review; state-only disabling is not a synchronous duplicate guard | Implement validated stages, a review screen and synchronous submit lock; protect server mutations with an idempotency contract |
| P0 | GlobalSaleModal.js handleSubmit closes after POST /sales and emits saleCreated; SaleForm has a separate proforma POST followed by PDF generation | Sale completion lacks a durable receipt destination; saved proforma + failed PDF can invite another creation attempt | Save once, retain returned ID, show a success screen linking to the saved document; PDF retry only regenerates/downloads the saved document |
| P0 | InventoryV2.js countedValues is indexed by product ID, including postCount and open count inputs | The same product in two open counts shares one unsaved input value | Key state by count ID and line/product identity; scope persistence by tenant/user/location; never silently copy a quantity between counts |
| P1 | Navigation.js, DesktopNavRail.js and BottomTabBar.js maintain separate destination definitions | Entry points and labels can drift across devices and permissions | A single navigation registry with label, destination, capability, module and placement metadata |
| P1 | BottomTabBar hides when scrolling down; shell changes at 768px, while several page layouts change at 1024px | Primary destinations can disappear during browsing; tablet layouts need an explicit density decision | Keep daily navigation stable; test shell and page layout independently at tablet sizes |
| P1 | Clients.js fetchClients catches with a toast and leaves its initial array empty; empty rendering says “Aucun client trouvé” | A failed first load can be confused with a successful empty search | Independent loaded/error/stale state, request ID, local retry, distinct first-use and no-results views |
| P1 | ClientProfile.js, Expenses.js, Bank.js, EmployeeList.js and Settings.js repeatedly store message strings instead of the original API error | Request IDs and recovery semantics are lost before rendering | Retain normalized error objects and provide recovery next to the failed section/action |
| P1 | InventoryV2 still accepts comma-separated product IDs for physical counts; PurchaseOrders.js uses window.prompt for rejection and payment | Users must understand internal identifiers; financial actions lack structured review and inline recovery | Search/select products and use count sessions; replace browser prompts with accessible, validated forms |
| P1 | Settings.js mixes configuration, subscription, reference lists and extensive document-generation code | Settings becomes a destination for operational work and is difficult to navigate | Separate configuration from operational documents, keeping compatible links |
| P2 | DataTable in components/business/index.js is a wrapper; responsive cards, filters, error states and action placement are implemented separately in pages | Shared styling does not yet guarantee shared behavior | Reusable list workspace, state container and form patterns with explicit contracts |

P0 = data integrity or unsafe task completion; P1 = common task friction and recovery; P2 = consistency and later optimization. Priorities are engineering judgment, not measured user-impact scores. Confirm ordering with staff task observations and support history.

## 3. Role-based operating model

Roles below are task profiles, not new authorization roles. Derive actual access from the server's existing permissions, tenant modules, location scope and supervision mode. Legacy individual permissions and membership RBAC currently coexist; a shared capability adapter must explain this rather than silently changing access.

| Task profile | First-screen focus | Primary action | Secondary destinations |
| --- | --- | --- | --- |
| Seller | Own active sales, payments needing follow-up, delivery commitments | Nouvelle vente | Ventes, Produits, Clients |
| Cash operator | Sales awaiting payment, recent collections, cash movements | Encaisser | Caisse, Ventes, Clients |
| Stock operator | Stock exceptions, incoming/outgoing transfers, open counts | Contextual: receive, transfer or count | Stock, Produits, authorized purchasing |
| Owner/manager | Exceptions across sales, payments, stock and payroll; daily cash context | Highest-priority unresolved task | Reporting, staff, configuration |
| Platform operator | Tenant health, support and subscriptions | Platform-specific task | Separate platform navigation |

Recommended daily structure: Accueil, Ventes, Stock/Produits, Clients, Caisse when permitted. Group secondary work into Opérations (achats, retours, dépenses, documents), Pilotage (reports/accounting) and Administration (users, settings, security, modules). Exact role-specific ordering remains a usability-test hypothesis.

Mobile: at most five stable bottom destinations, including Menu; a prominently placed sale action may be the primary action slot for sellers. For stock/cash profiles, do not force selling as the only prominent action. Avoid showing the same primary action in three competing places. Desktop: one rail, one page command bar, one optional contextual panel. Keep operational detail routes linkable.

## 4. Shared page anatomy

1. Context: page title, active shop/location, reporting period when relevant.
2. One primary action; secondary actions in a labelled menu. Hide inaccessible mutations and explain read-only access within the page.
3. Search and compact workflow filters. Put additional filters in a sheet with Apply, Reset and active-filter count.
4. Worklist or current task. Keep chart blocks and broad statistics below operational work.
5. Persistent result/recovery feedback at the affected area. Success names the saved record and next action.

Mobile cards show identity, one decision-relevant amount or quantity, status and next action. Expand for metadata; do not turn every table cell into a labelled card field. Desktop tables show sortable task-relevant columns, with details in a panel or route. Both presentations use the same data, selection and action logic.

Use the existing shared tokens and components. Add missing behavior there rather than creating another style family. Choose each breakpoint by content fit; the shell's 768px transition does not require every dense table to fit at that width. CSS-hidden mobile and desktop trees can both mount; do not claim they reduce DOM work or use duplicate IDs in them.

## 5. Page-by-page redesign

### Accueil and dashboards — P1

Source: Overview.js, Home.js, DashboardAdmin.js, DashboardDataContext.js.

Keep: tasks-first home, distinct seller/manager content, freshness information and partial-load warning already implemented.

Adapt: show the next three to five prioritized exceptions, each with a direct filtered destination. Separate today’s sales from money collected and outstanding balances. Give each metric period/scope. Move detailed charts and comparisons to Pilotage. Include a stock/cash task profile when granted those capabilities; do not infer every non-admin is a seller. Make missing task data explicit without declaring “nothing to do.”

Acceptance: every exception opens the matching records; a failed section does not hide successful tasks; first screen has a clear next action at 390px. Treat these as targets until visually verified.

### Sales list and sale details — P1

Source: Sales.js, sales-shared/, SaleDetailPage.js, components/sales/.

Keep: accent-insensitive search, removable filters, restored list position, next-action sale panel, payment/delivery timeline and retained failed payment input.

Adapt: make daily queues explicit: Toutes, À encaisser, À livrer, Terminées, with counts only when authoritative. Keep archives and deleted sales secondary. Cards lead with reference/client, balance owed, delivery status and one next action. Separate lifecycle status from payment and delivery status. On desktop, use a compact table and details panel where practical; retain a shareable full-detail route.

Acceptance: search by reference/phone/name; filtered URL survives refresh; Back restores filters and focus; status meanings agree across list/detail/receipt. Server pagination and aggregate counts must align with filters.

### New sale and proforma — P0

Source: SaleForm.js, GlobalSaleModal.js, Sales.js sale entry point.

Target stages: Client → Articles → Paiement et livraison → Vérification → Résultat. Each stage validates only its fields, retains state when moving back and exposes a clear Continue label. Wholesale/proforma paths reuse the workflow but label their distinct outcomes.

Review shows client, each line, quantities, prices, total, amount collected, remaining balance and delivery choice. “Enregistrer la vente” is the committing action. A saved-result screen shows reference, view sale, print/download receipt and new sale. PDF failure stays on that result screen and never re-POSTs the sale/proforma.

Draft contract: tenant + user + mode key; explicit resume/discard choices; saved-at label; expiry; storage-unavailable feedback; logout policy; inventory/price revalidation. Sensitive customer data should be minimized. Closing with a draft must explain whether work is saved or discarded, consistently with actual storage behavior.

Acceptance: a failed submission retains all inputs; double-click creates one record; lost response after server success resolves via idempotency/status lookup; expiry and shop-switch never restore the wrong records. Changes in price/stock require a new review.

### Payments and cash — P0/P1

Source: PaymentModal.js, GlobalPaymentModal.js, Bank.js.

Keep: existing payment save lock, overpayment checks, failure retention and explicit confirmation in sale detail.

Adapt: payment begins with sale/customer lookup and balance due; show payment method, amount, remaining balance and a final receipt result. The cash workspace distinguishes actual cash movements from sales/revenue and separates cash entry from payment against a sale. Surface reconciliation exceptions before historical analytics. Use one period selector and a concise movement list with type, label, amount and author.

Acceptance: failed reads never imply a zero balance; a duplicate/lost-response payment is recoverable; totals identify covered period and location; permission errors explain who can help. Backend ledger/idempotency guarantees need verification before claiming completion.

### Product catalogue and detail — P1

Source: Products.js, ProductDetails.js, InventoryAdjustmentForm.js, StockRemovalDialog.js.

Keep: catalogue retry/stale states, product search, reviewed stock removal and reviewed signed adjustments.

Adapt catalogue: identity/photo, selling price, available stock and location are primary. Category, supplier and logistics metadata belong in expanded filters/details. One visible row/card action opens the product; edit, duplicate and delete are contextual secondary actions. Distinguish no products, no matches and unavailable stock.

Adapt detail: identity + price + stock availability first; sell or edit according to capabilities; stock operations grouped in their own area. History, performance and logistics are secondary sections. Do not make price/stock-changing actions look equivalent to viewing information.

Acceptance: staff can find availability without opening several analytics panels; selected location is clear; catalogue refresh reflects stock mutations; destructive actions show product identity and consequences.

### Inventory, transfers and counts — P0/P1

Source: InventoryV2.js and inventory-shared/.

Keep: independent load/retry states, stale warnings, membership-based actions and adjustment review.

Adapt: lead with À recevoir, À expédier, À compter and Écarts. Rename technical headings such as “Product.stock ↔ registre” to business language with technical explanation secondary. Use searchable product selection and active-location context. Counts become dedicated sessions, scoped inputs, progress, variance review and explicit publication. Transfers show source, destination, quantity, status and one allowed next transition; validate different locations and valid lines before review.

Mobile: product/transfer cards and focused count entry, not an entire spreadsheet squeezed into the viewport. Preserve desktop comparison tables for reviewing variances.

Acceptance: two counts containing the same product keep separate values; count drafts survive intentional resume; a publication conflict retains entries and reloads authoritative quantities; duplicate mutation clicks are blocked. Fix input identity before visual redesign.

### Clients and client profile — P1

Source: Clients.js, ClientProfile.js.

Keep: existing mobile cards, desktop table, customer panel and search URL integration.

Adapt list: name, phone, balance due and last activity; one primary “Ajouter un client” action. Profile starts with contact, outstanding balance, relevant open sales and “Nouvelle vente”/“Encaisser” when permitted. Move loyalty and broad purchase statistics after current obligations. Editing should preserve input on failure and return focus to the initiating client.

Acceptance: initial failure cannot render a no-results claim; retry preserves search; a new client created during a sale becomes selected without losing the basket; archive/delete rules are explained for clients with financial history.

### Expenses — P1

Source: Expenses.js, GlobalExpenseModal.js.

Keep: existing responsive cards and shared detail panel.

Adapt: compact list with category/date/amount/payment method; expense entry groups amount, purpose, method and optional evidence. Place field validation next to controls, retain original API errors and keep failed save feedback inside the form. Move secondary metadata and export under contextual actions. Report period and filter totals must agree.

Acceptance: add/edit failures retain entries; failed list loads do not imply no spending; repeated submits are locked; deleting an expense names the record and requires the appropriate capability.

### Accounting and reporting — P1/P2

Source: Comptabilite.js, DashboardAdmin.js, ProductDashboard.js and reporting routes.

Adapt: ask a business question first: sales, collections, spending, margins or stock. One shared period/location control; summaries with scope and freshness; comparisons/charts second; detail journal last. Treat revenue, collection and profit as distinct concepts. Explain why estimates are incomplete when source sections fail.

Mobile: show a concise summary and one chart at a time, with an accessible table alternative. Wide journals may have intentional local horizontal scrolling for comparison; the whole page must not require horizontal scrolling.

Acceptance: totals match the report/export scope; exports show progress and preserve filters; missing sections are unavailable, not zero. Do not claim margin accuracy without validating its backend definition.

### Employees and payroll — P1/P2

Source: EmployeeList.js, EmployeeDetail.js, PaySlipList.js and payroll forms.

Keep: employee list already has mobile and desktop views; existing active/status/payroll filters.

Adapt: organize by “Who needs a payroll action?” and “Find an employee.” Lead with due/paid state and payroll period, with employee profile/contact secondary. Use explicit advance, salary and payslip flows with review/result. Normalize retry states before styling. Preserve business rules: no invented cap on employee advances; payslip states remain pending/paid/cancelled.

Acceptance: period and paid state agree across list/profile/receipt; payment retry cannot issue a second payment; authorized users see the correct payroll actions. Detailed payroll mutation safety still requires a dedicated follow-up audit.

### Purchasing, returns and refunds — P0/P1 when enabled

Source: PurchaseOrders.js, ReturnsRefunds.js.

Adapt purchasing: supplier → items → review → submit/approve → receive → invoice/payment. Replace prompt-based amounts and rejection reasons with reviewed forms. Support explicit partial receipts; do not assume receiving everything is the default safe action.

Adapt returns: start from a sale/receipt; choose eligible lines/quantities; record condition/disposition; review stock impact and refund independently. Explain that returning goods and issuing money are separate transitions. Do not expose actions solely because a module is enabled.

Acceptance: remaining eligible quantity/refund amount comes from the server; concurrency conflicts retain entries; saved refund result links to its record; original sale remains traceable. Confirm current backend guarantees before redesigning mutation semantics.

### Settings, users and documents — P2

Source: Settings.js, Documents.js, ProtectedRoute.js, features/platform/ (UserManagement.js is a re-export).

Adapt settings into business identity, catalogue reference data, team/access, subscription and security. Operational receipt/document generation belongs in Documents or the relevant sale/employee workflow. Preserve existing URLs through redirects or compatibility tabs.

Use per-section save with dirty-state protection, inline validation and explicit saved confirmation. Permission editors explain what an action permits and its location scope. Document upload shows file restrictions before selection, upload progress, a persistent result and a retry that retains metadata.

Acceptance: navigation does not discard unsaved settings; a failed plan/configuration lookup is distinguishable from “no plan/data”; team access uses business labels and accurately matches server enforcement. Keep platform tenant administration separate.

## 6. One coherent state and error contract

| State | Presentation | Next action |
| --- | --- | --- |
| Initial loading | Skeleton in the affected region; labelled status | Navigation/other loaded regions remain available |
| Successful empty collection | Explain what the collection contains | Create first record when allowed |
| No search results | Repeat active query/filter context | Clear filters; preserve query when navigating back |
| Read failure | Local error with request ID | Retry the read, not the entire page or a mutation |
| Stale/offline data | Retained content + freshness/scope warning | Reconnect/refresh; mark uncertain values |
| Validation failure | Summary linked to invalid fields + inline text | Focus first invalid field; retain input |
| Permission failure | Explain required capability/location | Return to accessible workflow or contact administrator |
| Session expiry | Explain reconnect requirement | Re-authenticate and return safely without auto-submitting |
| Conflict | Identify changed record/state | Refresh affected data, retain draft, require review |
| Rate limiting | Explain temporary delay | Honor server Retry-After where supplied |
| Unknown mutation outcome | “Result not confirmed” with operation reference | Resolve operation by ID/idempotency key before another write |
| Saved but export failed | Persistent saved reference | Retry export only |
| Success | Saved record, exact outcome and next action | Receipt/detail/new task |

The shared normalizer exists but adoption is incomplete. Its current retryable field covers network/5xx/409; do not rely on that alone to decide whether a financial write is safe to retry. Add structured field errors, business codes and rate-limit handling without converting failures into fallback success/zero values.

## 7. Responsive and accessibility acceptance targets

These are project acceptance targets, not a conformance claim from this source review.

- Verify 320px and 390px phones, 768/820px tablets, and 1024/1440px desktop; include portrait, landscape and browser zoom.
- Daily workflows fit without page-wide horizontal scrolling. Intentional table scrolling has a clear boundary and keyboard access.
- Aim for 44px touch controls with visible focus and readable labels; verify icon controls and dense table actions individually.
- Safe-area spacing, sticky footer actions and the virtual keyboard must not cover focused inputs, errors or save buttons. Avoid competing sticky layers.
- Keyboard users can enter/leave sheets, use tabs and restore focus on close. Proper tab roles require keyboard behavior and associated panels; otherwise use ordinary navigation buttons/links.
- Announce save/load status and errors without repeatedly stealing focus. Associate field errors with their inputs.
- Verify contrast and all status meanings in the rendered UI. Color must not be the only distinction.
- Long French names, CFA amounts, delayed requests, offline transitions, permission denial and expired sessions are part of the test data.

## 8. Implementation sequence and file work packages

| Order | Deliverable | Main files | Exit condition |
| --- | --- | --- | --- |
| 1 | Sale integrity and count isolation | GlobalSaleModal.js, SaleForm.js, InventoryV2.js; corresponding backend mutation services/routes | Tenant-scoped drafts, count-scoped values, duplicate/lost-response tests, saved-document export retry |
| 2 | Shared navigation/capability contract and page states | Navigation.js, DesktopNavRail.js, BottomTabBar.js, ProtectedRoute.js, business/index.js, errorModel.js | One destination registry, permission parity tests, keyboard/sheet contracts |
| 3 | Real guided sale and receipt result | SaleForm.js, GlobalSaleModal.js, Sales.js | Stages validate/retain input; saved result remains accessible; mobile keyboard checked |
| 4 | Daily selling and collection pages | Sales.js, SaleDetailPage.js, PaymentModal.js, Bank.js, Overview.js | Task queues, filtered links, clear balances and retry behavior |
| 5 | Catalogue, inventory and customer workflows | Products.js, ProductDetails.js, InventoryV2.js, Clients.js, ClientProfile.js | Stock/count sessions, searchable selection, first-load recovery and preserved context |
| 6 | Expenses, purchasing, returns and payroll | Respective pages and domain forms/services | Reviewed mutations, scoped access, no prompt-based financial entry, receipt/result |
| 7 | Reports, settings and documents | Comptabilite.js, reporting pages, Settings.js, Documents.js, user management feature | Scoped summaries/exports, operational/config separation, dirty-state protection |

Ship small vertical workflows with source, backend safeguards when needed, regression coverage and a browser check together. Extract components as part of a workflow rather than replacing every page in one large rewrite. Keep working legacy links until their replacement is verified.

## 9. Measurement and definition of done

Baseline before setting numerical improvement goals. Collect privacy-minimized workflow events: started, stage reached, validation failed, submission attempted, confirmed success, unresolved outcome, resumed and deliberately discarded. Include workflow name, stage, safe error code, duration and device class; exclude names, phones, notes, receipts and form contents. Use operation IDs only under the application's retention policy.

Compare median and tail task duration, confirmed completion, validation failures, repeated submissions and resumed/discarded drafts by role/device. A tab close or missing event alone does not prove abandonment; define the event window and account for offline delivery.

A workflow is done when its primary task, permission, empty, slow, offline, validation, conflict, expired-session, unknown-outcome and success paths are covered; required backend guarantees are verified; browser checks at the agreed widths pass; keyboard/focus behavior is reviewed; and documentation records evidence and remaining limits.

## 10. Limits and next concrete increment

No authenticated browser session, visual screenshots, real-device tests, staff interviews or production analytics were used for this audit. Page-specific recommendations are based on inspected source; detailed backend transaction, payroll and refund safety require focused verification. Existing automated tests from previous increments do not establish usability or accessibility for all pages.

Recommended next implementation: fix tenant/mode-scoped sale drafts and count input isolation first, then implement the real sale review/result path. These address concrete correctness and task-completion problems before the broader visual migration.
