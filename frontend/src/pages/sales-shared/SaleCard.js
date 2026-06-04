import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getSaleTypeText } from "../../utils/saleUtils";
import { StatusBadge } from "../../components/business";

const getSaleStatusTone = (status) => {
  if (status === "completed") return "success";
  if (status === "partially_paid") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
};

const getDeliveryTone = (deliveryStatus) => {
  if (deliveryStatus === "delivered") return "success";
  if (deliveryStatus === "not_delivered") return "danger";
  return "neutral";
};

/**
 * Reusable sale card for list views (Sales.js non-admin & admin, SalesArchive).
 * Mobile-first: stacked layout, touch-friendly. Desktop: compact header row, clear totals.
 */
const SaleCard = ({
  sale,
  totalPaid = 0,
  balance = 0,
  formatDate,
  getStatusText,
  getProfitCategoryClass,
  getProfitCategoryText,
  showProfitBadge = false,
  profitCategory,
  isModified,
  desktopLinkProps = {},
  linkState,
  returnTo,
  actions,
  className = "",
}) => {
  const returnSearch = returnTo ? `?returnToSales=${encodeURIComponent(returnTo)}` : "";
  const linkTo = `/sales/${sale._id}${returnSearch}`;
  const hasProducts = Array.isArray(sale.products) && sale.products.length > 0;

  return (
    <motion.article
      key={sale._id}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`ms-surface w-full h-full flex flex-col md:min-h-[360px] overflow-hidden transition-shadow ${className}`}
    >
      <div className="p-4 sm:p-5 lg:p-5 flex-1 flex flex-col min-h-0">
        {/* Header: sale id + date + badges — mobile: stack; desktop: row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <Link
              to={linkTo}
              state={linkState}
              className="inline-flex touch-manipulation items-center gap-1 text-base font-semibold text-[var(--ms-blue)] transition-colors hover:text-[var(--ms-blue-dark)]"
              {...desktopLinkProps}
            >
              Vente #{sale._id.slice(-6)}
            </Link>
            <p className="mt-0.5 text-sm text-[var(--ms-text-muted)] sm:mt-1">
              {formatDate(sale.saleDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getSaleStatusTone(sale.status)}>
              {getStatusText(sale.status)}
            </StatusBadge>
            <StatusBadge tone={sale.saleType === "wholesale" ? "warning" : "neutral"}>
              {getSaleTypeText(sale.saleType)}
            </StatusBadge>
            {isModified && (
              <StatusBadge tone="warning">
                Modifiée
              </StatusBadge>
            )}
            {sale.status === "completed" && (
              <StatusBadge tone={getDeliveryTone(sale.deliveryStatus)}>
                {sale.deliveryStatus === "delivered" ? "Livré" : sale.deliveryStatus === "not_delivered" ? "Non livré" : "En attente"}
              </StatusBadge>
            )}
            {showProfitBadge && profitCategory && getProfitCategoryClass && getProfitCategoryText && (
              <StatusBadge tone="neutral">
                {getProfitCategoryText(profitCategory)}
              </StatusBadge>
            )}
          </div>
        </div>

        {/* Client name — prominent */}
        <p className="mt-3 text-base font-semibold text-[var(--ms-text-strong)] sm:mt-2">
          {sale.client?.name || "Client non spécifié"}
        </p>

        {/* Totals — 3 cols mobile & desktop, clear labels */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-4">
          <div className="rounded-md border border-[var(--ms-border)] bg-[var(--ms-bg)] p-3">
            <p className="text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Total</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--ms-text-strong)] sm:text-base">
              {(sale.totalAmount || 0).toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div className="rounded-md border border-[rgba(16,124,16,0.22)] bg-[#F1FAF1] p-3">
            <p className="text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Payé</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--ms-success)] sm:text-base">
              {totalPaid.toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div className={`rounded-md border p-3 ${balance > 0 ? "border-[rgba(209,52,56,0.22)] bg-[#FDF3F4]" : "border-[var(--ms-border)] bg-[var(--ms-bg)]"}`}>
            <p className="text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Solde</p>
            <p className={`mt-0.5 text-sm font-semibold tabular-nums sm:text-base ${balance > 0 ? "text-[var(--ms-danger)]" : "text-[var(--ms-text-strong)]"}`}>
              {balance.toLocaleString("fr-FR")} CFA
            </p>
          </div>
        </div>

        {/* Products — compact list */}
        {hasProducts && (
          <div className="mt-4 border-t border-[var(--ms-border)] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--ms-text-muted)]">Produits</p>
            <ul className="space-y-1.5 text-sm text-[var(--ms-text)]">
              {sale.products.slice(0, 5).map((item, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="truncate">{item.product?.name || "Produit"}</span>
                  <span className="shrink-0 text-[var(--ms-text-muted)]">x{item.quantity || 0}</span>
                </li>
              ))}
              {sale.products.length > 5 && (
                <li className="text-xs text-[var(--ms-text-muted)]">+{sale.products.length - 5} autre(s)</li>
              )}
            </ul>
          </div>
        )}

        {/* Actions — full width on mobile, row on desktop; pushed to bottom on desktop */}
        {actions && (
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--ms-border)] pt-4 sm:flex-row sm:flex-wrap sm:gap-2 md:mt-auto md:pt-4">
            {actions}
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default SaleCard;
