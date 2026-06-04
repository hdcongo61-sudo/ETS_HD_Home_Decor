# ETS HD Home Decor — Microsoft Business Suite Global Design Skill

## Mission

Redesign the entire ETS HD Home Decor management application with a professional Microsoft Business Suite design system.

The redesign must combine inspirations from:

* Microsoft Dynamics 365
* Microsoft Power BI
* Microsoft Excel
* Windows 11 business applications
* Microsoft Admin Center

The final application must feel like a premium enterprise business management software designed by Microsoft.

The application must not look:

* AI-generated
* Like a generic Tailwind dashboard
* Like a startup admin template
* Like a social media app
* Like a simple CRUD application

The application must look like a real business ERP for furniture and home decor management.

---

# GLOBAL REDESIGN STRATEGY

Do not redesign pages independently.

Create ONE unified global design system and apply it everywhere.

The entire application must share:

* same layout system
* same spacing system
* same typography
* same colors
* same tables
* same forms
* same modals
* same command bars
* same interaction patterns

The app must feel like one cohesive professional software.

---

# REMOVE OLD DESIGN SYSTEM

Before implementing the new design:

Audit the current application and remove old design patterns.

Remove:

* old inconsistent cards
* old modals
* old random Tailwind styles
* old oversized dashboard blocks
* old black-and-white-only layouts
* old inconsistent buttons
* old inconsistent spacing
* old duplicated styles
* old table systems
* old page structures
* old mobile navigation
* old typography hierarchy
* old design tokens
* old page wrappers
* old layout systems

Do not preserve old UI patterns unless technically necessary.

Replace everything with the Microsoft Business Suite system.

---

# GLOBAL DESIGN TOKENS

Create one centralized design token system.

## Colors

Primary Microsoft Blue:

```txt
#0078D4
```

Neutral Palette:

```txt
#FFFFFF
#F8F9FA
#F3F2F1
#EDEBE9
#D2D0CE
#C8C6C4
#605E5C
#323130
#201F1E
```

Semantic Colors:

```txt
Success: #107C10
Warning: #FFB900
Danger: #D13438
Info: #0078D4
```

Rules:

* Use color only for meaning.
* Avoid flashy gradients.
* Avoid neon colors.
* Avoid random Tailwind colors.

---

# TYPOGRAPHY SYSTEM

Use:

```css
font-family: "Segoe UI", Inter, system-ui, sans-serif;
```

Typography hierarchy:

* Page Title
* Section Title
* Table Header
* Body Text
* Caption Text
* Status Labels

Typography must be readable and enterprise-grade.

---

# GLOBAL LAYOUT SYSTEM

Use this application structure everywhere:

```txt
Sidebar
→ Top Command Bar
→ Main Workspace
→ Optional Right Detail Panel
```

Requirements:

* Fixed sidebar on desktop
* Collapsible sidebar
* Mobile bottom navigation
* Sticky command bar
* Responsive workspace
* Consistent page width
* Right-side detail panels

---

# SIDEBAR NAVIGATION

Create a professional Microsoft-style sidebar.

Sections:

* Dashboard
* Products
* Sales
* Customers
* Payments
* Expenses
* Suppliers
* Employees
* Reports
* Settings

Sidebar rules:

* Active state
* Hover state
* Collapsible
* Icons + labels
* Clean spacing
* Keyboard accessible

---

# COMMAND BAR SYSTEM

Every major page must have a Microsoft-style command bar.

Examples:

Products:

* Add Product
* Edit
* Delete
* Import
* Export Excel
* Print

Sales:

* New Sale
* Add Payment
* Refund
* Print Receipt
* Export

Customers:

* Add Customer
* View History
* Export
* Print Statement

Rules:

* Primary actions visible
* Secondary actions in dropdown
* Consistent alignment
* Sticky on desktop when needed

---

# GLOBAL UI COMPONENT SYSTEM

Create reusable enterprise-grade components.

## Core Components

Create:

* AppShell
* Sidebar
* TopCommandBar
* Workspace
* PageHeader
* MobileBottomNav
* RightDetailPanel

## Form Components

Create:

* Input
* Select
* Textarea
* Checkbox
* RadioGroup
* SearchBox
* DatePicker
* CurrencyInput

## Action Components

Create:

* Button
* IconButton
* DropdownMenu
* ConfirmDialog
* DrawerPanel

## Data Components

Create:

* DataTable
* StatusBadge
* KPICard
* ChartCard
* EmptyState
* LoadingSkeleton
* Pagination

All pages must use these reusable components.

Do not create duplicate styles.

---

# TABLE SYSTEM — EXCEL STYLE

Tables are the main interface pattern.

All modules must use professional tables:

* Products
* Sales
* Customers
* Payments
* Expenses
* Employees
* Suppliers
* Reports

Requirements:

* Sticky header
* Sorting
* Filters
* Search
* Row selection
* Bulk actions
* Pagination
* Export Excel
* Responsive mobile layout
* Empty states
* Loading skeletons

Tables must feel closer to Excel and Dynamics 365.

---

# DASHBOARD SYSTEM — POWER BI STYLE

Dashboards must answer:

“What is happening in the business today?”

Include:

* Today Sales
* Weekly Sales
* Monthly Sales
* Net Profit
* Expenses
* Outstanding Payments
* Inventory Value
* Top Products
* Top Customers
* Recent Sales
* Recent Expenses

Use:

* compact KPI cards
* clean analytics charts
* export actions
* date filters
* business-focused layouts

Charts must resemble Power BI dashboards.

---

# WORKFLOW SYSTEM — DYNAMICS STYLE

Business workflows must feel like Dynamics 365.

Use:

* command bars
* detail side panels
* confirmation dialogs
* business statuses
* structured forms
* fast navigation

Examples:

* Product details open in right-side panel
* Customer profile opens in workspace panel
* Payment review uses structured business layout
* Sale creation uses enterprise form layout

---

# FORMS SYSTEM

Forms must feel like Microsoft Admin Center.

Requirements:

* Labels above fields
* Validation messages
* Multi-column desktop layout
* Single-column mobile layout
* Grouped sections
* Save / Cancel actions
* Loading states
* Disabled states

Do not use placeholder-only fields.

---

# MODAL SYSTEM

Replace old modal patterns.

Rules:

* Use right-side detail panels for viewing/editing
* Use confirmation dialogs only for destructive actions
* Use full-screen sheets on mobile

Remove inconsistent modal sizes.

---

# KPI CARDS

KPI cards must be compact and useful.

Each KPI card should include:

* title
* value
* change indicator
* optional icon
* date range context

Do not create oversized decorative cards.

---

# STATUS SYSTEM

Use semantic status badges.

Sales:

* Paid
* Partial
* Unpaid
* Cancelled

Payments:

* Pending
* Verified
* Rejected
* Amount Mismatch

Products:

* Available
* Low Stock
* Out of Stock

Employees:

* Active
* Suspended

Rules:

* Small badges
* Readable text
* Semantic colors only

---

# MOBILE EXPERIENCE

Mobile must feel like a Microsoft mobile business application.

Requirements:

* Bottom navigation
* Full-screen forms
* Mobile cards for tables
* Sticky actions
* Large touch targets
* Fast loading
* One-hand usability

Users must be able to:

* Add sales
* Add products
* Add customers
* Record payments
* Search records
* View dashboard

from mobile efficiently.

---

# ACCESSIBILITY

Implement:

* keyboard navigation
* visible focus states
* ARIA labels
* proper contrast
* screen reader support

Enterprise-level accessibility required.

---

# PERFORMANCE

Implement:

* skeleton loading
* lazy loading
* pagination
* virtualized tables if needed
* optimistic updates where safe
* no layout shifts
* fast transitions

The app must remain fast with many records.

---

# GLOBAL APPLICATION

Apply the new Microsoft Business Suite system globally to:

* Dashboard
* Products
* Product Details
* Sales
* Sale Details
* Customers
* Customer Details
* Payments
* Expenses
* Users
* Suppliers
* Employees
* Reports
* Settings
* Login
* Register

Every page must use the same reusable design system.

---

# PREVENT DESIGN REGRESSION

After implementation:

* no inline random colors
* no duplicated styles
* no duplicated buttons
* no duplicated tables
* no old modals
* no old cards
* no inconsistent spacing
* no old Tailwind utility clutter

All pages must import from the centralized design system.

---

# FINAL EXPECTED RESULT

ETS HD Home Decor must feel like:

* a lightweight Microsoft Dynamics 365
* a Power BI business analytics dashboard
* an Excel-style business management system

The application must feel:

* premium
* structured
* scalable
* professional
* fast
* business-focused
* enterprise-grade
* mobile-friendly
* production-ready

add some colory to the button, some button can't be seen
and test everytime you made a change to ensure it work. 

Do not stop after redesigning a few pages.
Continue until every screen uses the new centralized design system.
Generate a migration plan before making changes and then execute the migration progressively while preserving functionality.