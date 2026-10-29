# UX Workflow Backlog

This backlog defines the workflows to redesign around user goals. Each workflow should be completed end to end, tested on desktop and mobile, and measured before moving to the next one.

## Priority order

- **P0**: daily revenue or access blocked; redesign first.
- **P1**: frequent operational work; redesign after P0.
- **P2**: management, reporting, and administration.

## P0: daily revenue workflows

### 1. Sign in and recover access

- **Users:** everyone
- **Goal:** enter the correct shop and start work without uncertainty.
- **Current risks:** unclear failure messages, tenant ambiguity, lockout confusion, restricted access redirects.
- **Target flow:** identify with phone/email, select shop when needed, show clear validation, explain lockout or subscription restriction, recover password, land on the correct role workspace.
- **Acceptance criteria:**
  - [ ] Errors appear beside the relevant field or state.
  - [ ] Multiple-shop login explains the available shop codes.
  - [ ] Lockout shows the remaining time and next available action.
  - [ ] Restricted accounts can understand why access is blocked and what payment/support action is available.
  - [ ] Successful login lands on a role-appropriate home page.

### 2. Start the workday from Home

Implemented: role-aware task-first Home, all tracked administrator alert categories, filtered delivery links, seller next-action link, compact daily metrics, shared quick actions, permission-aware expenses/analytics, explicit offline data label, and forced-refresh recovery. Removed duplicate charts and module cards from Home; detailed analysis remains on /dashboard. Failed dashboard sections now return null instead of synthetic zero figures. Four Home behavior tests pass alongside four payment regression tests. Live API and mobile visual verification remain pending.

- **Users:** seller, manager, administrator
- **Goal:** understand what needs attention and take the next action quickly.
- **Current risks:** too many metrics and module links compete with urgent work.
- **Target flow:** greeting, today's key numbers, prioritized action queue, quick actions, recent activity, clear empty state when nothing needs attention.
- **Acceptance criteria:**
  - [ ] The first viewport answers “what needs attention today?”.
  - [ ] Every alert links directly to the resolution workflow.
  - [ ] “Nouvelle vente” is always reachable within one click/tap.
  - [ ] Incomplete data is clearly labelled and retryable.
  - [ ] The layout is useful for seller and manager roles without showing irrelevant modules.

### 3. Create a sale

- **Completion handoff (2026-10-25):** after the Sales page confirms the save, the form becomes a completion state with server totals and the next actions: open the sale to collect balance/manage delivery, download its invoice, browse sales history, or start another sale. A failed create stays in the form with the entered data; a later dashboard refresh failure no longer looks like a failed sale. Eight focused SaleForm tests pass and production build succeeds. Details: [Sale completion implementation](UX_SALE_COMPLETION_IMPLEMENTATION.md).
- **Guided-flow increment (2026-10-25):** sale and proforma entry now use validated client, product, payment/validity, and review stages. The review summarizes the full sale before the existing save action. Stage changes focus and scroll the next heading into view; scoped draft recovery and failed-save retention remain intact. Eight SaleForm tests pass and the production frontend build compiles (two existing unused-variable warnings). Durable post-save receipt actions, unknown-outcome/idempotency handling, retryable proforma PDF generation, and live mobile/keyboard verification remain open. Details: [Guided sale implementation](UX_GUIDED_SALE_IMPLEMENTATION.md).

- **Users:** seller, manager
- **Goal:** record a correct sale quickly.
- **Current risks:** long form, hidden sequence, lost input, unclear completion state.
- **Target flow:** customer, products, review, payment, delivery, confirmation/receipt.
- **Acceptance criteria:**
  - [x] The current step and remaining steps are visible.
  - [ ] Product search shows price and available stock before adding.
  - [ ] Totals update immediately and remain visible on mobile.
  - [ ] Invalid quantities and insufficient stock are explained beside the item.
  - [ ] Draft is preserved when the user navigates away or refreshes.
  - [x] Duplicate submission is prevented while saving.
  - [x] Success state offers receipt, payment, delivery, history, and new-sale actions.

### 4. Find and review a sale

Return-navigation increment (2026-10-25): browser Back restores search/filter state; explicit return links restore the selected sale and focus after data loads. Session snapshots are scoped to shop, user, and history entry, expire after 30 minutes, and do not cache sale records. Fresh links retain their own filters. Six regression checks cover both return paths, delayed data, missing records, isolation, expiration, and storage failure. Real-browser mobile and desktop acceptance checks remain pending.

Sale-detail increment (2026-10-25): status-based primary action for payment, delivery, or invoice; visible client/total/paid/balance; collapsed secondary actions and profit controls; dated activity feed; normalized load errors with retry; full-screen mobile delivery dialog with inline errors, retained input, duplicate-save protection, and preservation of the original delivery timestamp. Authenticated API and mobile visual checks remain pending.

Implemented: always-visible reference/client/phone search with accent-insensitive names and normalized phone formatting; removable filter chips including quick filters; all-date default; guided no-results recovery; list loading retry; and search/filter restoration through sale-detail return links. Filtered links now open the history workspace. Sales list API now supplies client phone numbers within the existing access scope. Twelve search/navigation behavior checks pass alongside eight Home/payment regression checks. Live API/mobile verification, detail-page action hierarchy, and browser Back scroll restoration remain open.

- **Users:** seller, manager, administrator
- **Goal:** locate a sale and know its status, balance, and next action.
- **Current risks:** filters and archive screens make finding records slow.
- **Target flow:** search by reference/client/phone, filter by status, open compact detail, show timeline, balance, payment and delivery actions.
- **Acceptance criteria:**
  - [x] Search works with reference, client name, and phone.
  - [x] Active filters are visible and removable.
  - [ ] Sale status and remaining balance are visible without opening every tab.
  - [x] Detail page has one primary next action.
  - [x] Empty results explain how to broaden the search.

### 5. Record a payment

Implemented: balance preview, accessible inline errors, synchronous submission lock, locked controls while saving, settled-sale guard, mobile full-screen form, and shared refresh event. Fixed sale-detail failure propagation. Four behavioral tests cover rerenders, duplicate submissions, failed-request retry, and overpayment. Live API and mobile browser verification remain pending.

- **Users:** seller, cashier, manager
- **Goal:** collect and record money against a sale accurately.
- **Current risks:** amount validation and balance context are easy to miss.
- **Target flow:** show total/paid/balance, enter amount and method, optionally mark delivery, confirm, show updated balance and receipt.
- **Acceptance criteria:**
  - [ ] Remaining balance is visible beside the amount field.
  - [ ] Amount cannot exceed the balance without a clear explanation.
  - [ ] Payment method labels are understandable.
  - [ ] Saving shows progress and prevents repeated clicks.
  - [ ] Success updates the sale and dashboard without a manual refresh.

## P1: operational workflows

### 6. Manage products and stock

- **Product workflow increment (2026-10-25):** product detail now separates product, statistics, linked-sales, and stock-history recovery; catalogue/detail stock labels share one threshold helper; general product editing no longer changes stock; create/update leaves a direct saved-product handoff; and lookup failures are retryable. Thirteen focused product/inventory tests pass and the production build succeeds. Browser/mobile verification remains open. Details: [Product workflow implementation](UX_PRODUCTS_WORKFLOW_IMPLEMENTATION.md).

Inventory V2 increment (2026-10-25): signed adjustments require a reason, show the resolved active/default location, load the default-variant balance for that product/location, preview before/after quantities when available, and require review before confirmation. Missing balances are explicit. Inline errors retain input, repeated saves are blocked, conflicts refresh the balance and require review again, and success displays the server-confirmed quantity. API validation enforces reason/cost/quantity inputs. Live API/browser checks remain open.

Stock-removal increment (2026-10-25): the product detail workflow now requires an explicit reason, validates whole positive quantities against displayed stock, shows warehouse and before/removal/after quantities, and requires a review before confirmation. Other reasons require explanation. Failures retain input with a normalized error/request ID; a synchronous lock prevents repeated saves and closing while saving. Success uses the server-returned stock and refreshes history/catalogue. API validation rejects fractional quantities instead of rounding. General product editing now leaves stock unchanged; signed Inventory V2 adjustments and authenticated mobile checks remain open.

Catalogue increment (2026-10-25): accent-insensitive name/SKU search, explicit empty-catalogue versus no-results states, reset action on mobile and desktop, shared normalized loading errors with request IDs and retry, retained catalogue after refresh failure with stale-stock warning, and protection against older responses overwriting newer quantities. Search/sort/filter controls have larger touch targets and active stock filters expose pressed state. Stock adjustment reasons, before/after review, and authenticated mobile visual checks remain open.

- **Users:** warehouse user, seller, manager
- **Goal:** know what is available and correct stock safely.
- **Target flow:** search product, inspect stock by location, adjust/receive/transfer, confirm reason, show movement history.
- **Acceptance criteria:**
  - [ ] Stock status is visible as available, low, or out of stock.
  - [ ] Adjustments require a reason and show before/after quantities.
  - [ ] Insufficient stock errors explain the current quantity.
  - [ ] Mobile cards expose the same actions as desktop tables.
  - [ ] Successful changes show the resulting balance.

### 7. Receive, transfer, and count stock

- **Users:** warehouse user, manager
- **Goal:** keep physical and recorded inventory aligned.
- **Target flow:** choose location, scan/search products, enter quantities, review differences, confirm movement, view history.
- **Acceptance criteria:**
  - [ ] Active location is always visible.
  - [ ] Unsaved counts survive accidental navigation.
  - [ ] Large batches show progress and partial failure details.
  - [ ] Conflicts explain which quantity changed.

### 8. Manage clients

- **Users:** seller, manager
- **Goal:** create/find a client and understand purchase/payment history.
- **Target flow:** search, create, open profile, view sales/balance, record relevant action.
- **Acceptance criteria:**
  - [ ] Search supports name and phone.
  - [ ] Duplicate client warnings are understandable.
  - [ ] Profile shows current balance and recent sales immediately.
  - [ ] Add-client flow can be opened from sale creation without losing the sale draft.

### 9. Track delivery and returns

- **Users:** seller, warehouse user, manager
- **Goal:** move an order to delivered or resolve a return.
- **Target flow:** see pending deliveries, open sale, update delivery status, add note/proof, process return/refund, show audit history.
- **Acceptance criteria:**
  - [ ] Pending and failed deliveries are prioritized.
  - [ ] Status changes require the minimum necessary confirmation.
  - [ ] Return/refund shows financial impact before confirmation.
  - [ ] Completed actions appear in the sale timeline.

## P2: management and administration workflows

### 10. Review financial position

- **Users:** manager, administrator
- **Goal:** understand revenue, collections, expenses, profit, and cash.
- **Target flow:** choose period, inspect compact KPIs, drill into exceptions, export when needed.
- **Acceptance criteria:**
  - [ ] Every metric has a period and data freshness label.
  - [ ] KPI cards link to the underlying records.
  - [ ] Missing data has a retry state instead of a misleading zero.
  - [ ] Exports show progress and completion feedback.

### 11. Manage users, roles, and permissions

- **Users:** administrator
- **Goal:** give each person the access needed for their job.
- **Target flow:** invite/create user, assign role, grant individual permissions, set access hours, review activity, suspend/reactivate.
- **Acceptance criteria:**
  - [ ] Permission names describe business actions.
  - [ ] Changes show exactly what access was added or removed.
  - [ ] Users can see why a page is unavailable.
  - [ ] Destructive actions require confirmation and are auditable.

### 12. Configure shop and subscription

- **Users:** administrator, shop owner
- **Goal:** keep branding, billing, and operational settings correct.
- **Target flow:** settings sections, unsaved-change protection, save/reset, subscription status, payment/reactivation.
- **Acceptance criteria:**
  - [ ] Settings are grouped by task, not implementation detail.
  - [ ] Unsaved changes are protected.
  - [ ] Save success and failure are explicit.
  - [ ] Subscription state explains the next required action.

### 13. Support and report a problem

- **Users:** everyone
- **Goal:** recover from an issue without losing work.
- **Target flow:** describe issue, attach context/request ID, submit, track response, retry failed action.
- **Acceptance criteria:**
  - [ ] Error states expose a reference ID when available.
  - [ ] Support can receive the current page and action context.
  - [ ] Failed submissions preserve entered data.

## Inventory recovery increment — 2026-10-25

- [x] Independent loading and retry for inventory sections; unavailable data never appears as zero/empty.
- [x] Retain successful records with freshness warnings after refresh failures.
- [x] Align mutation controls with active-tenant RBAC, adjustment location scope and read-only supervision.
- [x] Preserve open form input through lookup refresh/retry; block editing until recovery.
- [x] Protect requests from stale responses and reset state when the account/shop changes.
- [ ] Verify live permissions, mobile layout and keyboard workflows.
- [ ] Replace manual product IDs in physical counts and redesign transfer/count submission safety.
- [ ] Introduce server-side inventory aggregates and pagination for complete KPI totals.

Details: [Inventory recovery implementation](UX_INVENTORY_RECOVERY_IMPLEMENTATION.md).

## Major-page redesign audit — 2026-10-25

The [major-page UX audit](UX_MAJOR_PAGES_AUDIT.md) defines the current role-based operating model, shared page anatomy, page-by-page redesign and implementation exit criteria. This is a source-based analysis; browser usability and accessibility validation are still pending.

Immediate priorities:

- [x] Scope sale drafts by tenant, user and document mode; validate expiry and restored references.
- [x] Isolate physical-count input values by count and product identity (current API keys quantities by product).
- [ ] Verify sale/proforma/payment duplicate and unknown-outcome protection; retry PDF exports against an already-saved document.
- [ ] Convert sale progress indicators into validated stages, review and a durable receipt/result screen.
- [ ] Unify navigation and capability metadata across desktop and mobile.
- [ ] Extend section-level recovery to clients, cash, expenses, settings and enabled operations.

## Cross-workflow quality checklist

- [ ] Desktop verified at 1024px and 1440px.
- [ ] Mobile verified at 320px and 390px.
- [ ] Keyboard navigation and visible focus verified.
- [ ] Loading, empty, success, validation, offline, permission, conflict, and server-error states verified.
- [ ] Primary action is visible without scrolling where practical.
- [ ] Duplicate clicks are prevented during mutations.
- [ ] Back navigation does not unexpectedly lose user input.
- [ ] Analytics event added for start, completion, failure, retry, and abandonment.

Implementation evidence: [Sale draft and count safety](UX_SALE_DRAFT_SAFETY_IMPLEMENTATION.md). Server idempotency, guided sale stages and saved receipt results remain open.

## Dashboard exploration increment — 2026-10-25

- [x] Put financial synthesis before secondary page shortcuts.
- [x] Add KPI detail actions, daily/source-data tables, sale/payment record links and expense day links.
- [x] Add commercial trend/status table alternatives and product detail/ranking destinations.
- [x] Expose financial load errors and retry without fabricated zero KPIs.
- [ ] Verify live chart interaction, expense date filtering and mobile layout.
- [ ] Standardize secondary dashboard fetch failures and synchronize reporting ranges where supported.

Details: [Dashboard implementation](UX_DASHBOARD_IMPLEMENTATION.md).
