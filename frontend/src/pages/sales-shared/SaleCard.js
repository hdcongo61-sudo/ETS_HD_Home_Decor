import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getSaleTypeClass, getSaleTypeText } from "../../utils/saleUtils";

/**
 * Reusable sale card for list views (Sales.js non-admin & admin, SalesArchive).
 * Mobile-first: stacked layout, touch-friendly. Desktop: compact header row, clear totals.
 */
const SaleCard = ({
  sale,
  totalPaid = 0,
  balance = 0,
  formatDate,
  getStatusClass,
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
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className={`w-full h-full flex flex-col md:min-h-[378px] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden active:shadow-md md:hover:shadow-md transition-shadow ${className}`}
    >
      <div className="p-4 sm:p-5 lg:p-5 flex-1 flex flex-col min-h-0">
        {/* Header: sale id + date + badges — mobile: stack; desktop: row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <Link
              to={linkTo}
              state={linkState}
              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors text-base sm:text-base touch-manipulation"
              {...desktopLinkProps}
            >
              Vente #{sale._id.slice(-6)}
            </Link>
            <p className="text-sm text-gray-500 mt-0.5 sm:mt-1">
              <span aria-hidden>📅</span> {formatDate(sale.saleDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-xs font-medium ${getStatusClass(sale.status)}`}>
              {getStatusText(sale.status)}
            </span>
            <span className={`px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-xs font-medium ${getSaleTypeClass(sale.saleType)}`}>
              {getSaleTypeText(sale.saleType)}
            </span>
            {isModified && (
              <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">
                Modifiée
              </span>
            )}
            {sale.status === "completed" && (
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  sale.deliveryStatus === "delivered"
                    ? "bg-green-100 text-green-800"
                    : sale.deliveryStatus === "not_delivered"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {sale.deliveryStatus === "delivered" ? "Livré" : sale.deliveryStatus === "not_delivered" ? "Non livré" : "En attente"}
              </span>
            )}
            {showProfitBadge && profitCategory && getProfitCategoryClass && getProfitCategoryText && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProfitCategoryClass(profitCategory)}`}>
                {getProfitCategoryText(profitCategory)}
              </span>
            )}
          </div>
        </div>

        {/* Client name — prominent */}
        <p className="font-medium text-gray-900 mt-3 sm:mt-2 text-base">
          {sale.client?.name || "Client non spécifié"}
        </p>

        {/* Totals — 3 cols mobile & desktop, clear labels */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-4">
          <div className="bg-gray-50 rounded-xl p-3 sm:p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
            <p className="text-sm sm:text-base font-semibold text-gray-900 mt-0.5 tabular-nums">
              {(sale.totalAmount || 0).toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div className="bg-green-50/80 rounded-xl p-3 sm:p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Payé</p>
            <p className="text-sm sm:text-base font-semibold text-green-700 mt-0.5 tabular-nums">
              {totalPaid.toLocaleString("fr-FR")} CFA
            </p>
          </div>
          <div className={`rounded-xl p-3 sm:p-3 ${balance > 0 ? "bg-red-50/80" : "bg-gray-50"}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Solde</p>
            <p className={`text-sm sm:text-base font-semibold mt-0.5 tabular-nums ${balance > 0 ? "text-red-700" : "text-gray-900"}`}>
              {balance.toLocaleString("fr-FR")} CFA
            </p>
          </div>
        </div>

        {/* Products — compact list */}
        {hasProducts && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Produits</p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {sale.products.slice(0, 5).map((item, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="truncate">{item.product?.name || "Produit"}</span>
                  <span className="text-gray-500 shrink-0">×{item.quantity || 0}</span>
                </li>
              ))}
              {sale.products.length > 5 && (
                <li className="text-gray-500 text-xs">+{sale.products.length - 5} autre(s)</li>
              )}
            </ul>
          </div>
        )}

        {/* Actions — full width on mobile, row on desktop; pushed to bottom on desktop */}
        {actions && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2 md:mt-auto md:pt-4">
            {actions}
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default SaleCard;
