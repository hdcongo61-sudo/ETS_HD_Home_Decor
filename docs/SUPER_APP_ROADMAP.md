# HD Gestion → "Super App" Roadmap

> Goal: evolve the current retail/stock management suite into a multi-tenant
> **super app** able to run a shop *or* other kinds of businesses (services,
> food, pharmacy, rental…), on the same platform.
>
> Status: analysis of the current codebase (routes, controllers, models,
> feature flags, docs, UX backlog). Effort estimates assume **1 senior
> full-stack developer** familiar with the existing patterns, and **exclude**
> QA sign-off, translation, and deployment. Sizes are relative to this codebase.

---

## 0. Where we are today

The app is already a mature single-vertical suite (see
[GUIDE_HD_GESTION_FR.md](../GUIDE_HD_GESTION_FR.md)):

| Area | State |
|---|---|
| Sales / POS | ✅ full flow: credit, partial payments, delivery, proforma, returns/refunds, reminders |
| Inventory | ✅ variants, attributes, units, multi-location, transfers, counts, landed cost |
| Purchasing | ✅ suppliers, POs, supplier invoices, replenishment |
| Money | ✅ cash sessions, bank, expenses, accounting cockpit (P&L / cash / balance / journal) |
| People | ✅ employees + payroll, clients + RFM, loyalty points/tiers |
| Platform | ✅ multi-tenant fail-closed isolation, super-admin, plans/features, PawaPay billing, MFA |
| Tests | ✅ 23 backend test files (Jest + supertest), 24 frontend test files — solid base to build on |

The gaps below are what stand between "great shop app" and "super app".

---

## Definition of "super app" (exit criteria)

1. A tenant can be configured with its own **currency** and **language**.
2. Invoices carry **tax** and can be produced for any market.
3. Checkout works with **barcode scanning**, and stock stays accurate **offline**.
4. Pricing is flexible: **promotions, coupons, price lists, quantity tiers**.
5. Third parties can integrate through a **public API + webhooks**.
6. At least **one non-retail vertical** (services/appointments) runs on the same core.
7. Accounting and payroll are **complete enough to file**: VAT declarations,
   payroll deductions, export to external tools.
8. The platform is **safe to change**: CI/CD + end-to-end tests.

---

## Phase 0 — Foundations: tenant configurability

**Why first:** currency and language are hard-coded today. Every market beyond
the current CFA/French base is blocked until this is lifted.

### 0.1 Multi-currency per tenant
- Replace the single `formatCfa` formatter ([frontend/src/utils/format.js](../frontend/src/utils/format.js))
  with a tenant-aware money formatter and currency setting.
- Add `currency` + optional `exchangeRate` to tenant settings; store amounts in
  a base currency and format per tenant.
- Scope: sales, payments, expenses, payroll, accounting, PDF/Excel exports.

**Effort: M — 4-6 days.** Low risk, very high leverage.

### 0.2 Multi-language (i18n)
- Introduce `react-i18next` (or `react-intl`); extract hard-coded strings.
- **Phased rollout:** shell + navigation first, then Sales, Products, Clients,
  then the long tail. Backend error messages last.
- Start with `fr` + `en`; add languages per market.

**Effort: XL — 15-25 days** (this is the largest single item because every
screen is hard-coded French). **Recommendation:** ship Phase 0.1 and the
barcode/tax items first; treat i18n as a parallel track, screen-group by
screen-group.

**Exit criteria:** a tenant has a `language` setting; switching language
changes the shell + core screens; remaining screens fall back to French.

---

## Phase 1 — Retail must-haves

### 1.1 Tax (TVA) engine
- Tax rate per tenant (default 0% to preserve current behavior), with the
  option for tax-inclusive vs tax-exclusive pricing.
- Tax lines on sale/invoice/proforma PDF; tax breakdown in accounting and
  reports.
- `tax` amount stored per sale line (not just computed at print time) so past
  documents remain stable if a rate changes.

**Effort: M-L — 5-8 days.** Touches [saleModel.js](../backend/models/saleModel.js),
sale/PDF controllers, exports, accounting summary.

### 1.2 Barcode scanning
- Add a `barcode` (EAN/UPC) field to products and variants.
- Scan-to-add in the sale form using `@zxing/browser` (the current
  `html5-qrcode` is QR-focused; 1D barcode support needs a zxing/quagga lib).
- Print barcodes on product/PDF labels.

**Effort: S-M — 3-5 days.** One new dependency + wiring into
[SaleForm.js](../frontend/src/components/SaleForm.js).

**Exit criteria:** a scanned EAN adds the product to a sale; duplicate/unknown
barcodes are explained inline.

---

## Phase 2 — Offline queue-and-sync (the differentiator)

**Why it matters:** many target shops have unreliable connectivity. Today the
PWA has a service worker + offline shell, but **data entry requires the
network**.

- **Spike first (2-3 days):** prove a sale can be created locally and
  reconciled with the server.
- Local mutation queue in IndexedDB (e.g., `dexie`): sales, payments, expenses,
  stock adjustments.
- Server assigns authoritative timestamps/IDs; client reconciles by
  `clientRequestId` for idempotency.
- Conflict policy: last-write-wins with server audit log; warn on stock
  conflicts at sync time.
- Sync status UI (pending count, last sync, retry).

**Effort: XL — 20-35 days.** Highest risk item on this list; do the spike
before committing.

**Exit criteria:** a shop can record sales and payments with no connection and
see them sync automatically when back online, with no data loss or duplicate
stock deductions.

---

## Phase 3 — Commerce depth

### 3.1 Promotions, coupons, price lists, quantity tiers
- Discount engine (percent/amount), coupons with expiry/usage limits,
  customer-specific or tiered price lists.
- Applies on sale save; profit analysis must reflect discounted prices.

**Effort: L — 10-15 days.**

### 3.2 Stock valuation method (weighted average / FIFO)
- Currently profit uses a per-product "prix de revient" (cost price). Introduce
  a proper costing method so cost of goods is accurate across price changes.
- Keep the existing cost-price field as an override.

**Effort: L — 10-15 days.** Touches [costing](../backend/tests/costing.test.js),
purchase receipt, inventory movements.

### 3.3 Quote (devis) → proforma → sale pipeline
- Devis lifecycle (draft/sent/accepted/rejected/expired), convert devis →
  proforma → sale without re-entering data.

**Effort: M — 5-8 days.**

---

## Phase 4 — Platform & integrations

### 4.1 Public REST API + webhooks
- API keys per tenant, scoped permissions, rate limits, versioned endpoints.
- Webhooks for events: `sale.created`, `payment.received`,
  `stock.updated`, `invoice.generated`.
- Enables accounting tools, e-commerce, and custom integrations.

**Effort: L — 10-15 days.**

### 4.2 Automated messaging + email delivery
- Send invoices by email (SMTP; `nodemailer` is already installed) and via
  WhatsApp Business API (currently reminders are manual `wa.me` links).
- Bulk campaigns (SMS/email) for the CRM segmentation already built.

**Effort: M-L — 8-12 days.** WhatsApp API integration has external
onboarding/approval lead time.

### 4.3 CI/CD + end-to-end tests
- GitHub Actions: lint + backend Jest + frontend tests + Playwright smoke on
  the critical paths (login, sale, payment, stock adjustment).
- Coverage gate for the money paths (sales/payments/inventory).

**Effort: M — 5-8 days.**

---

## Phase 5 — New verticals (beyond retail)

### 5.1 Services & appointments (first vertical)
- Service catalog (non-inventory, no stock), booking/calendar, job tickets,
  service billing, deposits.
- Reuses clients, payments, cash, expenses, accounting, roles.

**Effort: XL — 20-30 days.** This is the proof that the core generalizes;
choose it before food/pharmacy.

### 5.2 Later verticals (only after 5.1 proves the model)
- **Food/restaurant:** table management, modifiers, kitchen display, split bill.
- **Pharmacy:** batch/serial/expiry tracking (prerequisite in §5.3), regulatory.
- **Rental/subscriptions:** recurring invoices, rental stock.

### 5.3 Cross-cutting prerequisite: serial / batch / expiry
- Add serial-number and batch/expiry tracking to inventory — required by
  pharmacy and food, useful for electronics.

**Effort: L — 10-15 days.**

---

## Phase 6 — Accounting & payroll depth

### 6.1 Double-entry ledger + fixed assets
- Today accounting is cash-based reports. Add a real ledger, fixed assets and
  depreciation so the cockpit is auditable and exportable.

**Effort: XL — 20-30 days.**

### 6.2 Payroll deductions
- Configurable deductions (CNSS, impôts) on payslips; net vs gross.

**Effort: M — 5-8 days.**

### 6.3 Compliance exports
- VAT declarations, payroll tax summaries, export to accounting tools (SAGE
  CSV, etc.).

**Effort: M — 5-8 days.**

---

## Recommended sequencing (summary)

| # | Work | Size | Priority |
|---|---|---|---|
| 0.1 | Multi-currency per tenant | M | 🔴 now |
| 1.2 | Barcode scanning | S-M | 🔴 now |
| 1.1 | Tax engine | M-L | 🔴 now |
| 0.2 | i18n (parallel track) | XL | 🟡 soon |
| 2 | Offline queue-and-sync (spike first) | XL | 🟠 after tax |
| 3.1 | Promotions / price lists | L | 🟡 |
| 3.2 | Stock valuation method | L | 🟡 |
| 3.3 | Devis → sale pipeline | M | 🟢 |
| 4.1 | Public API + webhooks | L | 🟡 |
| 4.2 | Email/WhatsApp automation | M-L | 🟡 |
| 4.3 | CI/CD + E2E | M | 🔴 enabler, can start any time |
| 5.3 | Serial / batch / expiry | L | 🟡 |
| 5.1 | Services & appointments vertical | XL | 🟢 |
| 6.2 | Payroll deductions | M | 🟢 |
| 6.1 | Double-entry ledger | XL | 🟢 |
| 6.3 | Compliance exports | M | 🟢 |

**Fastest path to "super app" credibility:** Phase 0.1 (currency) + Phase 1
(barcode + tax) + Phase 4.3 (CI/CD) ≈ **12-21 days**, then decide between the
offline spike (differentiator) and the services vertical (generality).

---

## Risks & notes

- **i18n** is the biggest single cost — do it incrementally, don't block other
  phases on it.
- **Offline sync** is the highest technical risk — always spike before
  committing; conflicts with stock are the hard part.
- **Tax changes** must be historical: store tax on the sale line, never rely on
  the current rate at print time.
- **Tenant isolation** is sacrosanct — every new feature must respect
  [tenantGuardPlugin.js](../backend/utils/tenantGuardPlugin.js); never bypass it.
- **WhatsApp Business API** and payment-provider onboarding have external lead
  times — start requests early.
- Re-run the **security review** before exposing a public API (§4.1) or
  webhooks.
