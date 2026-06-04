import React from "react";
import {
  STATUS_OPTIONS,
  DELIVERY_OPTIONS_MAIN,
  DELIVERY_OPTIONS_ARCHIVE,
  DATE_FILTER_OPTIONS,
} from "./constants";
import { Button, StatusBadge } from "../../components/business";

const FIELD_PANEL_CLASS =
  "space-y-2 rounded-md border border-[var(--ms-border)] bg-white px-3 py-3";

const LABEL_CLASS =
  "flex items-center gap-2 text-[11px] font-semibold uppercase text-[var(--ms-text-muted)]";

const INPUT_CLASS =
  "w-full min-h-[38px] rounded-md border border-[var(--ms-border)] bg-white px-2.5 py-1.5 text-sm text-[var(--ms-text)] transition focus:outline-none focus:ring-2 focus:ring-[rgba(0,120,212,0.16)] focus:border-[var(--ms-blue)]";

const ICON_DOT_CLASS = {
  indigo: "bg-[var(--ms-blue)]",
  emerald: "bg-[var(--ms-success)]",
  amber: "bg-[var(--ms-warning)]",
  sky: "bg-[var(--ms-blue)]",
  rose: "bg-[var(--ms-danger)]",
  violet: "bg-[var(--ms-text-muted)]",
  slate: "bg-[var(--ms-text-muted)]",
};

const FilterCard = ({ label, accent = "indigo", helper, className = "", children }) => (
  <div className={`${FIELD_PANEL_CLASS} ${className}`}>
    <div className={LABEL_CLASS}>
      <span className={`h-2.5 w-2.5 rounded-full ${ICON_DOT_CLASS[accent] || ICON_DOT_CLASS.indigo}`} />
      <span>{label}</span>
    </div>
    {children}
    {helper ? <p className="hidden text-xs text-[var(--ms-text-muted)] lg:block">{helper}</p> : null}
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
      <div className="hidden items-start gap-4 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ms-text-strong)]">Filtres des ventes</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ms-text-muted)]">
            Affinez l’historique par statut, client, vendeur, date et livraison.
          </p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          {activeFilters.length > 0 ? (
            activeFilters.map((item) => (
              <StatusBadge key={item.key} tone="neutral">
                {item.label}
              </StatusBadge>
            ))
          ) : (
            <StatusBadge tone="neutral">
              Aucun filtre actif
            </StatusBadge>
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
              className="flex min-h-[38px] items-center rounded-md border border-[var(--ms-border)] bg-white px-2.5 focus-within:border-[var(--ms-blue)] focus-within:ring-2 focus-within:ring-[rgba(0,120,212,0.16)]"
            >
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full border-0 bg-transparent p-0 text-sm text-[var(--ms-text)] focus:outline-none focus:ring-0 [color-scheme:light]"
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
          <Button
            type="button"
            onClick={onReset}
            variant="primary"
            className="w-full justify-between px-4 py-3 text-left"
            aria-label="Réinitialiser les filtres"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Réinitialiser</div>
                <div className="mt-1 text-xs text-white/80">
                  Revenez instantanément à la vue complète des ventes.
                </div>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
                ↺
              </span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesFiltersBar;
