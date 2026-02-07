import React from "react";
import {
  STATUS_OPTIONS,
  DELIVERY_OPTIONS_MAIN,
  DELIVERY_OPTIONS_ARCHIVE,
  DATE_FILTER_OPTIONS,
} from "./constants";

/**
 * Reusable filter bar for Sales list (status, client, date, delivery, reset).
 * variant: "main" = date as select with DATE_FILTER_OPTIONS; "archive" = date as input type="date"
 */
const SalesFiltersBar = ({
  statusFilter,
  clientFilter,
  dateFilter,
  deliveryFilter,
  clients = [],
  onStatusChange,
  onClientChange,
  onDateChange,
  onDeliveryChange,
  onReset,
  variant = "main",
}) => {
  const deliveryOptions = variant === "archive" ? DELIVERY_OPTIONS_ARCHIVE : DELIVERY_OPTIONS_MAIN;

  const inputClass =
    "w-full min-h-[44px] px-3 py-2.5 sm:py-2 border border-gray-300 rounded-xl text-gray-900 " +
    "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" role="group" aria-label="Filtres des ventes">
      <div className="space-y-1.5">
        <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">
          Statut
        </label>
        <select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={inputClass}
          aria-label="Filtrer par statut"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="filter-client" className="block text-sm font-medium text-gray-700">
          Client
        </label>
        <select
          id="filter-client"
          value={clientFilter}
          onChange={(e) => onClientChange(e.target.value)}
          className={inputClass}
          aria-label="Filtrer par client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="filter-date" className="block text-sm font-medium text-gray-700">
          Date
        </label>
        {variant === "archive" ? (
          <label
            htmlFor="filter-date"
            className="flex items-center w-full min-h-[44px] px-3 py-2.5 sm:py-2 border border-gray-300 rounded-xl bg-white cursor-pointer touch-manipulation focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 focus-within:outline-none"
          >
            <input
              id="filter-date"
              type="date"
              value={dateFilter}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full min-h-[44px] border-0 p-0 bg-transparent text-base text-gray-900 focus:outline-none focus:ring-0 [color-scheme:light]"
              style={{ fontSize: "16px" }}
              aria-label="Filtrer par date"
            />
          </label>
        ) : (
          <select
            id="filter-date"
            value={dateFilter}
            onChange={(e) => onDateChange(e.target.value)}
            className={inputClass}
            aria-label="Filtrer par période"
          >
            {DATE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="filter-delivery" className="block text-sm font-medium text-gray-700">
          Livraison
        </label>
        <select
          id="filter-delivery"
          value={deliveryFilter}
          onChange={(e) => onDeliveryChange(e.target.value)}
          className={inputClass}
          aria-label="Filtrer par livraison"
        >
          {deliveryOptions.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 flex flex-col justify-end">
        <span className="block text-sm font-medium text-gray-700 invisible sm:visible" aria-hidden="true">
          &nbsp;
        </span>
        <button
          type="button"
          onClick={onReset}
          className="w-full min-h-[44px] px-3 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          aria-label="Réinitialiser les filtres"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
};

export default SalesFiltersBar;
