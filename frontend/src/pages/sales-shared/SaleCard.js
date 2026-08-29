import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getSaleTypeText } from "../../utils/saleUtils";
import { StatusBadge } from "../../components/business";
import PaymentProgress, { paymentRatio } from "./PaymentProgress";

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
 * Hierarchy: client first, sale ref secondary; payment progress bar; token-based
 * colors (light/dark safe). Mobile-first, actions pinned at the bottom.
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
  const totalAmount = Number(sale.totalAmount) || 0;
  const paidRatio = paymentRatio(totalPaid, totalAmount);
  const isSettled = balance <= 0;

  return (
    <motion.article
      key={sale._id}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={`ms-surface w-full h-full flex flex-col overflow-hidden transition-shadow ${className}`}
    >
      <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0">
        {/* Header : client (primaire) + réf/date, badges à droite */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <Link
              to={linkTo}
              state={linkState}
              className="block touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)] rounded-sm"
              {...desktopLinkProps}
            >
              <span className="fui-body1-strong block truncate" style={{ color: "var(--colorNeutralForeground1)" }}>
                {sale.client?.name || "Client non spécifié"}
              </span>
              <span className="fui-caption1 mt-0.5 block" style={{ color: "var(--colorBrandForeground1)" }}>
                {sale.reference || ("Vente #" + sale._id.slice(-6))}
                <span style={{ color: "var(--colorNeutralForeground3)" }}> · {formatDate(sale.saleDate)}</span>
              </span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <StatusBadge tone={getSaleStatusTone(sale.status)}>
              {getStatusText(sale.status)}
            </StatusBadge>
            {sale.saleType === "wholesale" && (
              <StatusBadge tone="warning">{getSaleTypeText(sale.saleType)}</StatusBadge>
            )}
            {isModified && <StatusBadge tone="warning">Modifiée</StatusBadge>}
            {sale.status === "completed" && (
              <StatusBadge tone={getDeliveryTone(sale.deliveryStatus)}>
                {sale.deliveryStatus === "delivered" ? "Livré" : sale.deliveryStatus === "not_delivered" ? "Non livré" : "Livraison en attente"}
              </StatusBadge>
            )}
            {showProfitBadge && profitCategory && getProfitCategoryClass && getProfitCategoryText && (
              <StatusBadge tone="neutral">{getProfitCategoryText(profitCategory)}</StatusBadge>
            )}
          </div>
        </div>

        {/* Encaissement : barre de progression payé / total */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>
              Encaissé <span className="fui-caption1-strong tabular-nums" style={{ color: "var(--colorNeutralForeground1)" }}>{paidRatio}%</span>
            </p>
            <p className="fui-caption1 tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>
              {totalPaid.toLocaleString("fr-FR")} / {totalAmount.toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <PaymentProgress
            className="mt-1.5"
            ratio={paidRatio}
            color={isSettled ? "var(--colorStatusSuccessForeground1)" : "var(--colorBrandBackground)"}
          />
        </div>

        {/* Totaux */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
          <div className="rounded-[var(--radiusMedium)] border p-2.5" style={{ borderColor: "var(--ms-border)", background: "var(--colorNeutralBackground2)" }}>
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Total</p>
            <p className="mt-0.5 fui-caption1-strong tabular-nums sm:text-sm" style={{ color: "var(--colorNeutralForeground1)" }}>
              {totalAmount.toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div className="rounded-[var(--radiusMedium)] border p-2.5" style={{ borderColor: "var(--colorStatusSuccessStroke1)", background: "var(--colorStatusSuccessBackground1)" }}>
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Payé</p>
            <p className="mt-0.5 fui-caption1-strong tabular-nums sm:text-sm" style={{ color: "var(--colorStatusSuccessForeground1)" }}>
              {totalPaid.toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div
            className="rounded-[var(--radiusMedium)] border p-2.5"
            style={
              balance > 0
                ? { borderColor: "var(--colorStatusDangerStroke1)", background: "var(--colorStatusDangerBackground1)" }
                : { borderColor: "var(--ms-border)", background: "var(--colorNeutralBackground2)" }
            }
          >
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Solde</p>
            <p
              className="mt-0.5 fui-caption1-strong tabular-nums sm:text-sm"
              style={{ color: balance > 0 ? "var(--colorStatusDangerForeground1)" : "var(--colorNeutralForeground1)" }}
            >
              {balance.toLocaleString("fr-FR")} CFA
            </p>
          </div>
        </div>

        {/* Produits — compact */}
        {hasProducts && (
          <div className="mt-3.5 border-t pt-3" style={{ borderColor: "var(--ms-border)" }}>
            <ul className="space-y-1 fui-caption1" style={{ color: "var(--colorNeutralForeground2)" }}>
              {sale.products.slice(0, 3).map((item, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="truncate">{item.product?.name || "Produit"}</span>
                  <span className="shrink-0 tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>×{item.quantity || 0}</span>
                </li>
              ))}
              {sale.products.length > 3 && (
                <li>
                  <Link
                    to={linkTo}
                    state={linkState}
                    className="fui-caption1-strong hover:underline"
                    style={{ color: "var(--colorBrandForeground1)" }}
                    {...desktopLinkProps}
                  >
                    +{sale.products.length - 3} autre(s) produit(s)
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Actions — pleine largeur mobile, alignées en bas */}
        {actions && (
          <div className="mt-3.5 flex flex-col gap-2 border-t pt-3.5 sm:flex-row sm:flex-wrap sm:gap-2 md:mt-auto" style={{ borderColor: "var(--ms-border)" }}>
            {actions}
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default SaleCard;
