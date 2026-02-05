/**
 * Shared constants for Sales pages (Sales.js, SalesArchive.js, PartiallyPaidPurchases, etc.)
 * Reduces repetitive option lists and labels.
 */

export const STATUS_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "completed", label: "Payée" },
  { value: "partially_paid", label: "Partiellement payée" },
  { value: "pending", label: "En attente" },
  { value: "cancelled", label: "Annulée" },
];

export const DELIVERY_OPTIONS_MAIN = [
  { value: "", label: "Tous" },
  { value: "delivered", label: "Livré" },
  { value: "pending", label: "En attente" },
  { value: "not_delivered", label: "Non livré" },
];

export const DELIVERY_OPTIONS_ARCHIVE = [
  { value: "", label: "Tous" },
  { value: "all_completed", label: "Toutes complétées" },
  { value: "delivered", label: "Livrées" },
  { value: "pending", label: "En attente" },
  { value: "not_delivered", label: "Non livrées" },
];

export const DATE_FILTER_OPTIONS = [
  { value: "", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
];

export const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } },
    x: { grid: { display: false } },
  },
};
