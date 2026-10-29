# Mobile-First Redesign - Tenant Interface

**Date:** 2026-08-24  
**Historical status (2026-08-24):** Layout updates reported; current workflow audit and validation pending

## Review update — 2026-10-25

This document is a historical layout-change record from August 24, 2026. Its completion labels are not evidence that end-to-end workflows, accessibility, contrast or real-device behavior have been verified. The current source already includes mobile employee cards and additional sales/catalogue/inventory recovery improvements.

Use [Major-page UX audit and redesign specification](UX_MAJOR_PAGES_AUDIT.md) for current priorities, role-based workflows, page specifications, error handling and implementation acceptance criteria. The review recommends sale draft/task-completion safety and count input isolation before broad visual changes. Runtime and real-device validation remain pending.

The performance and accessibility assertions later in this historical document are unverified. CSS-hidden mobile/desktop trees can both mount; card layouts are not inherently faster. The documented 44px size is a project target, not proof of accessibility conformance.

## Shared mobile refresh — implemented 2026-10-25

The shared Navigation header now includes a 44px Actualiser icon button below 768px across authenticated pages using that shell, including nested/detail routes. It reloads the current URL, so each page runs its existing data-loading logic. It is a full page reload, not pull-to-refresh or a background data refresh.

- Offline taps keep the page in place and explain that reconnection is needed.
- Edited input/select/textarea/contenteditable fields require confirmation before reload; this includes inline stock-count inputs. Tracking is conservative and may also warn after filter edits or saved forms until navigation.
- Shared Axios POST/PUT/PATCH/DELETE requests disable refresh until completion. A save starting while confirmation is open also cancels refresh. Request tracking does not cover writes made outside the shared API client.
- Repeated refresh taps are locked. Loading state, accessible label and failure feedback are provided.
- Existing fullscreen forms continue owning the mobile screen: the global header and its refresh button remain hidden there. Close the form to return to the shared refresh control. Public pages without the authenticated shell are outside this control's scope.
- The control does not erase offline caches, authentication or saved drafts. Unsaved page-local filters/scroll may reset on full reload; URL-backed filters remain in the URL. Offline fallback may still return cached data if the connection fails during reload.

Source: MobileRefreshButton.js, requestActivity.js, Navigation.js and services/api.js. Automated tests cover repeated taps, offline recovery, edit confirmation/cancellation, active writes, confirmation/save races and refresh failure. Real-device header fit at 320px/390px and mobile browser reload behavior remain to be checked.

## Overview

Systematic mobile-first responsive redesign of the ETS HD Home Décor application, following Microsoft Fluent 2 design system principles.

## Design Pattern

### Dual Layout System
- **Mobile (< 1024px):** Card-based vertical layouts with touch-friendly controls
- **Desktop (≥ 1024px):** Table-based horizontal layouts with hover interactions

### Key Responsive Patterns

```jsx
{/* Mobile card layout */}
<div className="lg:hidden space-y-3 p-3">
  {items.map(item => (
    <div className="fluent-card-filled p-4 space-y-3">
      {/* Card content */}
    </div>
  ))}
</div>

{/* Desktop table */}
<div className="hidden lg:block overflow-x-auto">
  <table className="min-w-full">
    {/* Table content */}
  </table>
</div>
```

### Mobile UI Guidelines
- **Touch targets:** Minimum 44px height for all interactive elements
- **Buttons:** Full-width or flex-1 on mobile, compact on desktop
- **Navigation:** Dropdown selects on mobile, horizontal tabs on desktop
- **Filters:** Flexible width (`flex-1 sm:w-auto`) that wraps naturally
- **Status badges:** Compact, color-coded for quick scanning

## Completed Pages

### 1. SuperAdmin Interface ✅
**File:** `frontend/src/pages/SuperAdmin.js`

**Changes:**
- Tab navigation: Dropdown on mobile, horizontal tabs on desktop
- Users tab: Card layout (mobile) + table layout (desktop)
- Subscriptions tab: Fully responsive filters and dual layout
- Mobile cards show: user info, role badge, status, full-width action buttons
- Desktop table shows: all fields in columns with inline action buttons

**Mobile Features:**
- Touch-friendly 44px minimum heights
- Vertical stacked card layout
- Full-width action buttons
- Compact status badges with icons

### 2. Products Page (Admin View) ✅
**File:** `frontend/src/pages/Products.js`

**Changes:**
- Replaced old mobile cards with improved Fluent 2 design
- Mobile layout now shows:
  - Checkbox selection with visual feedback
  - Product image (16x16 rounded)
  - Name and category
  - Price and stock in 2-column grid
  - Container, warehouse, supplier badges
  - Full-width action buttons (Modifier, Dupliquer, Supprimer)
- Desktop table unchanged (already optimal)
- Toolbar and filters already responsive

**Before/After:**
- **Before:** Basic mobile cards with inconsistent spacing
- **After:** Fluent 2 cards with proper hierarchy, badges, and touch targets

### 3. Clients Page ✅
**File:** `frontend/src/pages/Clients.js`

**Status:** Already mobile-first with card/table dual layout
- Mobile: Touch-friendly cards with client info
- Desktop: Traditional table with sortable columns
- No changes needed

### 4. Settings Page ✅
**File:** `frontend/src/pages/Settings.js`

**Status:** Already mobile-responsive
- Mobile: Horizontal scrolling section pills
- Desktop: Vertical sidebar navigation
- No changes needed

### 5. Comptabilité Page (Journal comptable) ✅
**File:** `frontend/src/pages/Comptabilite.js`

**Changes:**
- Journal comptable table redesigned with dual layout
- Mobile layout shows:
  - Libellé and date with status badge (Vente/Dépense)
  - 2-column grid for Produit/Charge amounts
  - Color-coded amounts (green for credit, red for debit)
  - Separate totals card at the end
- Desktop table unchanged

### 6. Expenses Page ✅
**File:** `frontend/src/pages/Expenses.js`

**Changes:**
- Expenses table redesigned with dual layout
- Mobile layout shows:
  - Description and date with category badge
  - 2-column grid for Montant and payment method
  - Employee salary section (when applicable)
  - Metadata section for created/modified by
  - Full-width action buttons (Modifier, Supprimer)
- Desktop table unchanged

### 7. CriticalStockProducts Page ✅
**File:** `frontend/src/pages/CriticalStockProducts.js`

**Changes:**
- Product table redesigned with dual layout
- Mobile layout shows:
  - Product name and category
  - Stock level with danger badge (AlertTriangle icon)
  - 2-column grid for Prix and Valeur Totale
  - Supplier badge (when applicable)
  - Full-width "Réapprovisionner" button
- Desktop table unchanged

### 8. TopSellingProducts Page ✅
**File:** `frontend/src/pages/TopSellingProducts.js`

**Changes:**
- Product ranking table redesigned with dual layout
- Mobile layout shows:
  - Rank badge with product name
  - Category and supplier badge
  - 2-column grid for Unités vendues and Prix unitaire
  - 3-column grid for Revenu/Profit/Marge
  - Color-coded financial metrics
- Desktop table unchanged

### 9. SlowProductSuggestions Page ✅
**File:** `frontend/src/pages/SlowProductSuggestions.js`

**Status:** Already mobile-optimized with card layout
- Mobile-first design with product cards
- Suggested actions displayed inline
- No changes needed

### 4. Overview Component ✅
**File:** `frontend/src/components/Overview.js`

**Status:** Already mobile-responsive with Fluent 2 patterns
- Responsive KPI grid
- Adaptive charts
- Card-based module shortcuts
- No changes needed

## Pages Still Using Desktop-Only Layouts

### High Priority (Data-Heavy Pages)
1. **Sales** (`frontend/src/pages/Sales.js`)
   - Large page with filters, stats, and sale cards
   - Already has some responsive elements but needs mobile card improvements

2. **Employees** (Employee list views)
   - Table-based employee listings
   - Needs mobile card layout

3. **Dashboard/Analytics** (`frontend/src/pages/DashboardAdmin.js`)
   - Heavy data tables and charts
   - Needs mobile-optimized chart views

### Medium Priority
4. **Bank** (`frontend/src/pages/Bank.js`)
   - Transaction listing
   - Needs mobile card layout

5. **Documents** (`frontend/src/pages/Documents.js`)
   - Document listing
   - Needs mobile card layout

### Lower Priority (Less Frequently Used)
6. Product detail pages
7. Client detail pages
8. Report pages

## Design Tokens (Fluent 2)

### Colors
- Brand: `var(--ms-blue)` - Primary actions
- Success: `var(--colorStatusSuccessForeground1)` - Positive states
- Warning: `var(--colorStatusWarningForeground1)` - Caution states
- Danger: `var(--colorStatusDangerForeground1)` - Destructive actions
- Neutral: `var(--colorNeutralForeground1)` - Default text

### Typography
- `fui-body1-strong` - Bold body text (names, values)
- `fui-caption1` - Small text (labels, metadata)
- `fui-caption2` - Extra small text (hints)
- `fui-subtitle2` - Section headers

### Components
- `fluent-card-filled` - Card with background fill
- `ms-button ms-button-primary` - Primary action button
- `ms-button ms-button-secondary` - Secondary action button
- `ms-status-badge` - Status indicator with color coding

## Mobile Breakpoints

```css
/* Mobile-first approach */
.element { /* Mobile styles (default) */ }

/* Small tablets and up */
@media (min-width: 640px) { /* sm: */ }

/* Tablets and up */
@media (min-width: 768px) { /* md: */ }

/* Desktop and up (main breakpoint) */
@media (min-width: 1024px) { /* lg: */ }

/* Large desktop */
@media (min-width: 1280px) { /* xl: */ }
```

**Primary breakpoint:** 1024px (`lg:`) - Switches from mobile cards to desktop tables

## Testing Checklist

- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on iPad (Safari)
- [ ] Test on desktop (1920x1080)
- [ ] Test landscape orientation
- [ ] Test with touch interactions
- [ ] Verify 44px touch targets
- [ ] Test with keyboard navigation
- [ ] Verify screen reader support

## Next Steps

1. **Sales Page:** Apply mobile-first card layout for sale items
2. **Employees:** Create mobile card layout for employee list
3. **Dashboard:** Optimize charts and data tables for mobile
4. **Bank/Expenses:** Apply dual layout pattern
5. **Document all patterns** in a reusable component library

## Resources

- [Fluent 2 Design System](https://fluent2.microsoft.design/)
- [Mobile Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)

## Performance Notes

- Mobile cards render faster than tables (fewer DOM nodes)
- `loading="lazy"` on all images
- Conditional rendering based on viewport (not hidden with CSS)
- No layout shift between mobile/desktop (separate components)

## Accessibility

- Touch targets: 44px minimum (WCAG AAA)
- Color contrast: All text meets WCAG AA
- Keyboard navigation: All interactive elements focusable
- Screen readers: Proper ARIA labels on all controls
- Focus indicators: Visible focus rings on all interactive elements
