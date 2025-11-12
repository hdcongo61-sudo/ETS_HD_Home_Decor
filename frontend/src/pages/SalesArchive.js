import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

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

  const desktopLinkProps = useMemo(
    () => (isDesktop ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    [isDesktop]
  );

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

  const loadingPlaceholder = (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin" />
      <p className="mt-3 text-gray-600">Chargement des ventes...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Toutes les ventes</h1>
            <p className="text-sm text-gray-500">
              Liste complète et filtrée des ventes, accessible depuis l'historique des ventes.
            </p>
          </div>
          <Link
            to="/sales"
            className="text-sm text-indigo-600 hover:text-indigo-700 underline"
          >
            Retour au tableau des ventes
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                Statut
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tous</option>
                <option value="completed">Payée</option>
                <option value="partially_paid">Partiellement payée</option>
                <option value="pending">En attente</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                Client
              </label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tous les clients</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                Livraison
              </label>
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tous</option>
                <option value="all_completed">Toutes complétées</option>
                <option value="delivered">Livrées</option>
                <option value="pending">En attente</option>
                <option value="not_delivered">Non livrées</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          {loading ? (
            loadingPlaceholder
          ) : (
            <div className="space-y-4">
              {filteredSales.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  Aucune vente correspondante
                </div>
              ) : (
                filteredSales.map((sale) => {
                  const { totalPaid } = calculateSaleTotals(sale);
                  return (
                    <div
                      key={sale._id}
                      className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <Link
                          to={`/sales/${sale._id}`}
                          className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 transition-colors"
                          {...desktopLinkProps}
                        >
                          <span>Vente #{sale._id.slice(-6)}</span>
                        </Link>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:flex-wrap md:justify-end">
                          <span className="text-sm text-gray-500 inline-flex items-center gap-1">
                            📅 {formatDate(sale.saleDate)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusClass(sale.status)}`}>
                            {getStatusText(sale.status)}
                          </span>
                          {sale.deliveryStatus && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                sale.deliveryStatus === "delivered"
                                  ? "bg-green-100 text-green-800"
                                  : sale.deliveryStatus === "not_delivered"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {sale.deliveryStatus === "delivered"
                                ? "Livré"
                                : sale.deliveryStatus === "not_delivered"
                                ? "Non livré"
                                : "En attente"}
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${getProfitCategoryClass(
                              sale.computedCategory
                            )}`}
                          >
                            {getProfitCategoryText(sale.computedCategory)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mt-4">
                        <div>
                          <p className="text-gray-500 text-xs">Client</p>
                          <p className="font-medium text-gray-900">{sale.client?.name || "Client non spécifié"}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Total</p>
                          <p className="font-semibold text-gray-900">
                            {(sale.totalAmount || 0).toLocaleString("fr-FR")} CFA
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Payé</p>
                          <p className="font-semibold text-green-600">
                            {totalPaid.toLocaleString("fr-FR")} CFA
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesArchive;
