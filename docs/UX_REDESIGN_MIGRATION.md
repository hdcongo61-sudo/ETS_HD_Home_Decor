# UX Redesign Migration

This migration turns the current feature-heavy interface into a task-first business workspace while preserving existing routes and business logic.

## Product model

The application is organized around six work areas:

1. Accueil: today's work, exceptions, and the next action.
2. Ventes: create a sale, collect payment, delivery, and returns.
3. Stock: products, receiving, counts, transfers, and replenishment.
4. Clients and suppliers: profiles, history, balances, and contacts.
5. Finance and reports: cash, bank, expenses, profit, and exports.
6. Administration: users, permissions, subscription, security, and settings.

The default landing experience is role-aware:

- Sellers start with sale creation, assigned sales, and payment follow-up.
- Warehouse users start with stock exceptions and receiving work.
- Managers start with today's performance, unpaid balances, and delivery issues.
- Administrators see operations first and configuration under Administration.

## Delivery sequence

### Phase 1: interaction foundation (implemented in this migration)

- Standard API error envelope with a request ID and stable error code.
- Frontend error normalization for validation, auth, permission, conflict, network, offline, and server failures.
- Visible page-level recovery boundary with retry and home actions.
- Explicit permission screen instead of silent redirects.
- Visible lazy-loading fallback for route transitions.
- Global search available to every authenticated role.
- Shared retry/error component for data sections.

### Phase 2: daily-work navigation

- Reduce primary navigation to Accueil, Ventes, Stock, Clients, Finance, and Menu.
- Keep Administration in a dedicated group.
- Preserve deep links and existing permissions while migrating labels and locations.

### Phase 3: workflow redesign

- Convert sale creation into resumable steps: customer, items, review, payment, delivery, confirmation.
- Persist an unfinished sale draft locally and restore it after accidental navigation or refresh.
- Make the confirmation screen the source of truth for receipt, next payment, and delivery actions.

### Phase 4: role workspaces and measurement

- Replace repeated dashboards with role-specific task views.
- Instrument task start, task completion, failed submissions, retries, repeated clicks, and abandoned forms.
- Review mobile layouts for every high-frequency workflow at 320px, 390px, 768px, and 1024px.

## UX rules

- Every page states the user's job and the next action.
- Errors explain what happened, whether data was saved, and how to recover.
- Cached data is labelled with its age; stale data is never presented as live.
- Loading states reserve space and never appear as a blank screen.
- Permission failures explain the missing access and provide a route back to permitted work.
- Destructive actions require confirmation and successful mutations provide an undo or a clear receipt of the result.

## Acceptance checks

- A user can create a sale without searching through the full navigation.
- A failed request always has a visible recovery path.
- A user can tell whether a displayed value is live, cached, incomplete, or unavailable.
- A user who lacks permission sees an explanation instead of being silently returned to the home page.
- Route transitions show progress or a skeleton instead of a blank frame.
