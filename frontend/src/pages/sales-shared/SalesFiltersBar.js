import React from "react";
import {
  STATUS_OPTIONS,
  DELIVERY_OPTIONS_MAIN,
  DELIVERY_OPTIONS_ARCHIVE,
  DATE_FILTER_OPTIONS,
} from "./constants";

const FIELD_PANEL_CLASS =
  "space-y-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm " +
  "lg:min-h-[128px] lg:bg-gradient-to-b lg:from-white lg:to-gray-50/80 lg:shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]";

const LABEL_CLASS =
  "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500";

const INPUT_CLASS =
  "w-full min-h-[46px] rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 " +
  "shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

const ICON_DOT_CLASS = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
};

const FilterCard = ({ label, accent = "indigo", helper, className = "", children }) => (
  <div className={`${FIELD_PANEL_CLASS} ${className}`}>
    <div className={LABEL_CLASS}>
      <span className={`h-2.5 w-2.5 rounded-full ${ICON_DOT_CLASS[accent] || ICON_DOT_CLASS.indigo}`} />
      <span>{label}</span>
    </div>
    {children}
    {helper ? <p className="hidden lg:block text-xs text-gray-500">{helper}</p> : null}
  </div>
);

/**
 * Reusable filter bar for Sales list (status, client, date, delivery, reset).
 * variant: "main" = date as select with DATE_FILTER_OPTIONS; "archive" = date as input type="date"
 */
const SalesFiltersBar = ({
  statusFilter,
  clientFilter,
  saleTypeFilter = "",
  paymentStructureFilter = "",
  dateFilter,
  deliveryFilter,
  containerFilter = "",
  sellerFilter = "",
  clients = [],
  containers = [],
  sellers = [],
  onStatusChange,
  onClientChange,
  onSellerChange = () => {},
  onSaleTypeChange = () => {},
  onPaymentStructureChange = () => {},
  onDateChange,
  onDeliveryChange,
  onContainerChange,
  onReset,
  variant = "main",
}) => {
  const deliveryOptions = variant === "archive" ? DELIVERY_OPTIONS_ARCHIVE : DELIVERY_OPTIONS_MAIN;

  const activeFilters = [
    statusFilter ? { key: "status", label: `Statut: ${STATUS_OPTIONS.find((opt) => opt.value === statusFilter)?.label || statusFilter}` } : null,
    clientFilter ? { key: "client", label: `Client sélectionné` } : null,
    sellerFilter ? { key: "seller", label: `Vendeur sélectionné` } : null,
    saleTypeFilter ? { key: "saleType", label: saleTypeFilter === "wholesale" ? "Vente en gros" : "Vente normale" } : null,
    paymentStructureFilter
      ? {
          key: "paymentStructure",
          label:
            paymentStructureFilter === "multiple_payments"
              ? "Paiements multiples"
              : paymentStructureFilter === "full_payment"
              ? "Paiement complet"
              : "Paiement en attente",
        }
      : null,
    dateFilter
      ? {
          key: "date",
          label: variant === "archive" ? `Date précise` : `Période active`,
        }
      : null,
    deliveryFilter
      ? {
          key: "delivery",
          label:
            deliveryFilter === "all_completed"
              ? "Toutes les ventes payées"
              : `Livraison filtrée`,
        }
      : null,
    containerFilter ? { key: "container", label: `Conteneur: ${containerFilter}` } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4" role="group" aria-label="Filtres des ventes">
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Filtres des ventes</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Vue desktop en colonnes: lecture verticale plus propre, champs mieux séparés, et repérage plus rapide des filtres actifs.
          </p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          {activeFilters.length > 0 ? (
            activeFilters.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700"
              >
                {item.label}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
              Aucun filtre actif
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 lg:gap-4">
        <FilterCard
          label="Statut"
          accent="indigo"
          helper="Filtre le niveau d’avancement du règlement."
        >
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par statut"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterCard>

        <FilterCard
          label="Client"
          accent="emerald"
          helper="Isolez un client précis dans l’historique."
        >
          <select
            id="filter-client"
            value={clientFilter}
            onChange={(e) => onClientChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par client"
          >
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </FilterCard>

        <FilterCard
          label="Vendeur"
          accent="slate"
          helper="Filtre les ventes enregistrées par un vendeur."
        >
          <select
            id="filter-seller"
            value={sellerFilter}
            onChange={(e) => onSellerChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par vendeur"
          >
            <option value="">Tous les vendeurs</option>
            {sellers.map((seller) => (
              <option key={seller._id} value={seller._id}>
                {seller.name || seller.email || "Vendeur sans nom"}
              </option>
            ))}
          </select>
        </FilterCard>

        <FilterCard
          label="Type de vente"
          accent="violet"
          helper="Distingue les ventes normales des ventes en gros."
        >
          <select
            id="filter-sale-type"
            value={saleTypeFilter}
            onChange={(e) => onSaleTypeChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par type de vente"
          >
            <option value="">Tous les types</option>
            <option value="normal">Vente normale</option>
            <option value="wholesale">Vente en gros</option>
          </select>
        </FilterCard>

        <FilterCard
          label="Structure paiement"
          accent="amber"
          helper="Sépare les ventes totalement réglées et celles en attente."
        >
          <select
            id="filter-payment-structure"
            value={paymentStructureFilter}
            onChange={(e) => onPaymentStructureChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par structure de paiement"
          >
            <option value="">Toutes les structures</option>
            <option value="full_payment">Paiement complet</option>
            <option value="multiple_payments">Paiements multiples</option>
            <option value="pending_payment">Paiement en attente</option>
          </select>
        </FilterCard>

        <FilterCard
          label="Date"
          accent="sky"
          helper={variant === "archive" ? "Choisissez une date précise." : "Choisissez une période rapide."}
        >
          {variant === "archive" ? (
            <label
              htmlFor="filter-date"
              className="flex min-h-[46px] items-center rounded-xl border border-gray-200 bg-white px-3.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500"
            >
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 focus:outline-none focus:ring-0 [color-scheme:light]"
                style={{ fontSize: "16px" }}
                aria-label="Filtrer par date"
              />
            </label>
          ) : (
            <select
              id="filter-date"
              value={dateFilter}
              onChange={(e) => onDateChange(e.target.value)}
              className={INPUT_CLASS}
              aria-label="Filtrer par période"
            >
              {DATE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </FilterCard>

        {containers.length > 0 && (
          <FilterCard
            label="Conteneur"
            accent="rose"
            helper="Utile pour isoler un lot ou une provenance."
          >
            <select
              id="filter-container"
              value={containerFilter}
              onChange={(e) => onContainerChange(e.target.value)}
              className={INPUT_CLASS}
              aria-label="Filtrer par conteneur"
            >
              <option value="">Tous les conteneurs</option>
              {containers.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </FilterCard>
        )}

        <FilterCard
          label="Livraison"
          accent="slate"
          helper="Affiche l’état de livraison des ventes déjà réglées."
        >
          <select
            id="filter-delivery"
            value={deliveryFilter}
            onChange={(e) => onDeliveryChange(e.target.value)}
            className={INPUT_CLASS}
            aria-label="Filtrer par livraison"
          >
            {deliveryOptions.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterCard>

        <div className="sm:col-span-2 lg:col-span-2 flex">
          <button
            type="button"
            onClick={onReset}
            className="w-full rounded-2xl border border-gray-900 bg-gray-900 px-4 py-4 text-left text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label="Réinitialiser les filtres"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Réinitialiser</div>
                <div className="mt-1 text-xs text-gray-300">
                  Revenez instantanément à la vue complète des ventes.
                </div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
                ↺
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesFiltersBar;
