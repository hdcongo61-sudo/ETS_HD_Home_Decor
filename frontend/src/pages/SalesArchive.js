import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import api from "../services/api";
import {
  calculateSaleTotals,
  calculateSaleProfit,
  calculateSaleMargin,
  deriveProfitCategoryFromMargin,
  formatDate,
  getProfitCategoryClass,
  getProfitCategoryText,
  getStatusClass,
  getStatusText,
  parseDateSafely,
} from "../utils/saleUtils";
import { SalesFiltersBar, SaleCard } from "./sales-shared";

const SalesArchive = () => {
  const location = useLocation();
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setStatusFilter(params.get("status") || "");
    setClientFilter(params.get("client") || "");
    setDateFilter(params.get("date") || "");
    setDeliveryFilter(params.get("delivery") || "");
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [salesRes, clientsRes] = await Promise.all([
          api.get("/sales"),
          api.get("/clients"),
        ]);
        setSales(salesRes.data || []);
        const list = Array.isArray(clientsRes.data)
          ? clientsRes.data
          : clientsRes.data?.clients || [];
        setClients(list);
      } catch (err) {
        console.error("Erreur lors du chargement des ventes :", err);
        setError("Impossible de charger les ventes.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const salesWithMetrics = useMemo(
    () =>
      sales.map((sale) => {
        const computedProfit = sale?.profitData?.totalProfit ?? calculateSaleProfit(sale);
        const computedMargin = sale?.profitData?.profitMargin ?? calculateSaleMargin(sale);
        const computedCategory =
          sale?.profitCategory || deriveProfitCategoryFromMargin(computedMargin);
        return { ...sale, computedProfit, computedMargin, computedCategory };
      }),
    [sales]
  );

  const filteredSales = useMemo(() => {
    const base = salesWithMetrics.filter((sale) => {
      const statusMatch = !statusFilter || sale.status === statusFilter;
      const clientMatch = !clientFilter || sale.client?._id === clientFilter;
      const saleDate = parseDateSafely(sale.saleDate);
      const dateMatch = !dateFilter || (saleDate && saleDate.toLocaleDateString("fr-CA") === dateFilter);
      const deliveryMatch =
        !deliveryFilter ||
        (sale.status === "completed" &&
          (deliveryFilter === "all_completed" || sale.deliveryStatus === deliveryFilter));
      return statusMatch && clientMatch && dateMatch && deliveryMatch;
    });
    return base;
  }, [salesWithMetrics, statusFilter, clientFilter, dateFilter, deliveryFilter]);

  const hasActiveFilters =
    !!statusFilter || !!clientFilter || !!dateFilter || !!deliveryFilter;

  const handleResetFilters = () => {
    setStatusFilter("");
    setClientFilter("");
    setDateFilter("");
    setDeliveryFilter("");
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header — compact on mobile */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/sales"
              className="flex items-center gap-2 shrink-0 w-10 h-10 justify-center rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors md:w-auto md:h-auto md:px-0 md:py-0 md:bg-transparent md:border-0 md:rounded-none md:justify-start"
              aria-label="Retour au tableau des ventes"
            >
              <svg
                className="w-5 h-5 shrink-0 md:w-4 md:h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden md:inline text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Tableau des ventes
              </span>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl md:text-3xl">
                Toutes les ventes
              </h1>
              <p className="hidden sm:block text-sm text-gray-500 mt-0.5">
                Liste complète et filtrée des ventes.
              </p>
            </div>
          </div>
        </div>

        {/* Filters — collapsible on mobile */}
        <div className="rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between p-4 text-left sm:hidden bg-white hover:bg-gray-50/80 transition-colors"
            aria-expanded={filtersOpen}
          >
            <span className="font-medium text-gray-900">Filtres</span>
            {hasActiveFilters && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                Actifs
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`${filtersOpen ? "block" : "hidden"} sm:block border-t border-gray-100 sm:border-t-0`}>
            <div className="p-4 sm:p-6 pt-0 sm:pt-6">
              <SalesFiltersBar
                statusFilter={statusFilter}
                clientFilter={clientFilter}
                dateFilter={dateFilter}
                deliveryFilter={deliveryFilter}
                clients={clients}
                onStatusChange={setStatusFilter}
                onClientChange={setClientFilter}
                onDateChange={setDateFilter}
                onDeliveryChange={setDeliveryFilter}
                onReset={handleResetFilters}
                variant="archive"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20">
            <div className="w-12 h-12 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-gray-600">Chargement des ventes...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredSales.length}</span>
                {filteredSales.length === 1 ? " vente" : " ventes"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredSales.length === 0 ? (
                <div className="col-span-full text-center py-12 sm:py-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                  <p className="text-gray-500 font-medium">Aucune vente correspondante</p>
                  <p className="text-sm text-gray-400 mt-1">Modifiez les filtres ou revenez plus tard.</p>
                </div>
              ) : (
                <>
                  {filteredSales.map((sale, index) => {
                    const { totalPaid, balance } = calculateSaleTotals(sale);
                    const isModified =
                      Array.isArray(sale.modificationHistory) && sale.modificationHistory.length > 0;
                    return (
                      <motion.div
                        key={sale._id}
                        className="h-full"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                      >
                        <SaleCard
                          sale={sale}
                          totalPaid={totalPaid}
                          balance={balance}
                          formatDate={formatDate}
                          getStatusClass={getStatusClass}
                          getStatusText={getStatusText}
                          getProfitCategoryClass={getProfitCategoryClass}
                          getProfitCategoryText={getProfitCategoryText}
                          showProfitBadge
                          profitCategory={sale.computedCategory}
                          isModified={isModified}
                        />
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SalesArchive;
