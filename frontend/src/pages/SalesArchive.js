import React, { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Banknote,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  PackageCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import {
  calculateSaleTotals,
  calculateSaleProfit,
  calculateSaleMargin,
  deriveProfitCategoryFromMargin,
  formatDate,
  getPaymentStructureKey,
  getProfitCategoryClass,
  getProfitCategoryText,
  getStatusClass,
  getStatusText,
  parseDateSafely,
} from "../utils/saleUtils";
import { SalesFiltersBar, SaleCard, SalesListExportButtons } from "./sales-shared";
import AppLoader from "../components/AppLoader";

const ExportSalesPdf = lazy(() => import("../components/ExportSalesPdf"));

const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString("fr-FR")} CFA`;

const formatNumber = (value) => Number(value || 0).toLocaleString("fr-FR");

const formatPercent = (value) => `${Number(value || 0).toFixed(1)} %`;

const INITIAL_VISIBLE_SALES = 40;
const VISIBLE_SALES_STEP = 40;

const getSaleSellerId = (sale) => {
  if (!sale?.user) return "";
  return typeof sale.user === "object" ? String(sale.user._id || sale.user.id || "") : String(sale.user);
};

const getSaleSellerName = (sale) => {
  if (!sale?.user || typeof sale.user !== "object") return "";
  return sale.user.name || sale.user.email || "";
};

const SalesArchive = () => {
  const location = useLocation();
  const { auth } = useContext(AuthContext);
  const canViewSensitiveFinancials = Boolean(
    auth?.user?.isAdmin || auth?.user?.permissions?.includes("view_sensitive_financials")
  );
  const [sales, setSales] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [saleTypeFilter, setSaleTypeFilter] = useState("");
  const [paymentStructureFilter, setPaymentStructureFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [containerFilter, setContainerFilter] = useState("");
  const [containers, setContainers] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SALES);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setStatusFilter(params.get("status") || "");
    setClientFilter(params.get("client") || "");
    setSellerFilter(params.get("seller") || "");
    setSaleTypeFilter(params.get("saleType") || "");
    setPaymentStructureFilter(params.get("paymentStructure") || "");
    setDateFilter(params.get("date") || "");
    setDeliveryFilter(params.get("delivery") || "");
    setContainerFilter(params.get("container") || "");
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [salesRes, clientsRes, containersRes] = await Promise.all([
          api.get("/sales", { params: { summary: "list" } }),
          api.get("/clients"),
          api.get("/lookups/containers"),
        ]);
        setSales(salesRes.data || []);
        const list = Array.isArray(clientsRes.data)
          ? clientsRes.data
          : clientsRes.data?.clients || [];
        setClients(list);
        setContainers(containersRes.data || []);
      } catch (err) {
        console.error("Erreur lors du chargement des ventes :", err);
        setError("Impossible de charger les ventes.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_SALES);
  }, [
    statusFilter,
    clientFilter,
    sellerFilter,
    saleTypeFilter,
    paymentStructureFilter,
    dateFilter,
    deliveryFilter,
    containerFilter,
  ]);

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

  const sellers = useMemo(() => {
    const byId = new Map();
    sales.forEach((sale) => {
      const sellerId = getSaleSellerId(sale);
      if (!sellerId || byId.has(sellerId)) return;
      byId.set(sellerId, {
        _id: sellerId,
        name: getSaleSellerName(sale) || "Vendeur sans nom",
        email: typeof sale.user === "object" ? sale.user.email || "" : "",
      });
    });
    return Array.from(byId.values()).sort((a, b) =>
      (a.name || a.email || "").localeCompare(b.name || b.email || "", "fr", { sensitivity: "base" })
    );
  }, [sales]);

  const applyArchiveFilters = useCallback((source, options = {}) => {
    const { includeDate = true } = options;
    const base = source.filter((sale) => {
      const statusMatch = !statusFilter || sale.status === statusFilter;
      const clientMatch = !clientFilter || sale.client?._id === clientFilter;
      const sellerMatch = !sellerFilter || getSaleSellerId(sale) === sellerFilter;
      const saleTypeMatch = !saleTypeFilter || (sale.saleType || "normal") === saleTypeFilter;
      const paymentStructureMatch =
        !paymentStructureFilter || getPaymentStructureKey(sale) === paymentStructureFilter;
      const saleDate = parseDateSafely(sale.saleDate);
      const dateMatch = !includeDate || !dateFilter || (saleDate && saleDate.toLocaleDateString("fr-CA") === dateFilter);
      const deliveryMatch =
        !deliveryFilter ||
        (sale.status === "completed" &&
          (deliveryFilter === "all_completed" || sale.deliveryStatus === deliveryFilter));
      const containerMatch =
        !containerFilter ||
        (sale.products || []).some((p) => p.product?.container === containerFilter);
      return statusMatch && clientMatch && sellerMatch && saleTypeMatch && paymentStructureMatch && dateMatch && deliveryMatch && containerMatch;
    });
    return base;
  }, [statusFilter, clientFilter, sellerFilter, saleTypeFilter, paymentStructureFilter, dateFilter, deliveryFilter, containerFilter]);

  const filteredSales = useMemo(
    () => applyArchiveFilters(salesWithMetrics, { includeDate: true }),
    [applyArchiveFilters, salesWithMetrics]
  );

  const hasActiveFilters =
    !!statusFilter || !!clientFilter || !!sellerFilter || !!saleTypeFilter || !!paymentStructureFilter || !!dateFilter || !!deliveryFilter || !!containerFilter;

  const visibleSales = useMemo(
    () => filteredSales.slice(0, visibleCount),
    [filteredSales, visibleCount]
  );

  const hasMoreSales = visibleCount < filteredSales.length;

  const filteredStats = useMemo(() => {
    const initial = {
      totalSales: filteredSales.length,
      totalAmount: 0,
      totalPaid: 0,
      totalBalance: 0,
      totalProfit: 0,
      totalItems: 0,
      completedSales: 0,
      partiallyPaidSales: 0,
      pendingSales: 0,
      deliveredSales: 0,
      modifiedSales: 0,
      multiplePaymentSales: 0,
      paymentsOnSelectedDate: 0,
      paymentsOnSelectedDateCount: 0,
    };

    filteredSales.forEach((sale) => {
      const { totalPaid, balance } = calculateSaleTotals(sale);
      const itemCount = (sale.products || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      initial.totalAmount += Number(sale.totalAmount || 0);
      initial.totalPaid += totalPaid;
      initial.totalBalance += Math.max(balance, 0);
      initial.totalProfit += Number(sale.computedProfit || 0);
      initial.totalItems += itemCount;

      if (sale.status === "completed") initial.completedSales += 1;
      if (sale.status === "partially_paid") initial.partiallyPaidSales += 1;
      if (sale.status === "pending") initial.pendingSales += 1;
      if (sale.deliveryStatus === "delivered") initial.deliveredSales += 1;
      if (
        Number(sale.modificationCount || 0) > 0 ||
        (Array.isArray(sale.modificationHistory) && sale.modificationHistory.length > 0)
      ) {
        initial.modifiedSales += 1;
      }
      if (getPaymentStructureKey(sale) === "multiple_payments") {
        initial.multiplePaymentSales += 1;
      }
    });

    initial.averageTicket = initial.totalSales ? initial.totalAmount / initial.totalSales : 0;
    initial.averageMargin = initial.totalAmount ? (initial.totalProfit / initial.totalAmount) * 100 : 0;
    initial.collectionRate = initial.totalAmount ? (initial.totalPaid / initial.totalAmount) * 100 : 0;

    const paymentSourceSales = dateFilter
      ? applyArchiveFilters(salesWithMetrics, { includeDate: false })
      : filteredSales;

    paymentSourceSales.forEach((sale) => {
      (sale.payments || []).forEach((payment) => {
        const paymentDate = parseDateSafely(payment.paymentDate || payment.createdAt);
        if (!paymentDate) return;
        const matchesDate = dateFilter
          ? paymentDate.toLocaleDateString("fr-CA") === dateFilter
          : true;
        if (!matchesDate) return;
        initial.paymentsOnSelectedDate += Number(payment.amount) || 0;
        initial.paymentsOnSelectedDateCount += 1;
      });
    });

    return initial;
  }, [applyArchiveFilters, dateFilter, filteredSales, salesWithMetrics]);

  const statsCards = [
    {
      label: "Ventes filtrées",
      value: formatNumber(filteredStats.totalSales),
      helper: hasActiveFilters ? "Selon les filtres actifs" : "Vue complète",
      icon: <ClipboardList className="w-5 h-5" />,
      tone: "indigo",
    },
    {
      label: "Chiffre d'affaires",
      value: formatCurrency(filteredStats.totalAmount),
      helper: `Ticket moyen: ${formatCurrency(filteredStats.averageTicket)}`,
      icon: <Banknote className="w-5 h-5" />,
      tone: "emerald",
    },
    {
      label: "Montant encaissé",
      value: formatCurrency(filteredStats.totalPaid),
      helper: `Taux encaissé: ${formatPercent(filteredStats.collectionRate)}`,
      icon: <CreditCard className="w-5 h-5" />,
      tone: "green",
    },
    {
      label: dateFilter ? "Paiements encaissés ce jour" : "Paiements des ventes filtrées",
      value: formatCurrency(filteredStats.paymentsOnSelectedDate),
      helper: `${formatNumber(filteredStats.paymentsOnSelectedDateCount)} paiement(s)${
        dateFilter ? " sur la date choisie" : " liés aux ventes affichées"
      }`,
      icon: <CreditCard className="w-5 h-5" />,
      tone: "sky",
    },
    {
      label: "Solde restant",
      value: formatCurrency(filteredStats.totalBalance),
      helper: `${formatNumber(filteredStats.partiallyPaidSales + filteredStats.pendingSales)} vente(s) non soldée(s)`,
      icon: <WalletCards className="w-5 h-5" />,
      tone: filteredStats.totalBalance > 0 ? "rose" : "slate",
    },
    ...(canViewSensitiveFinancials
      ? [{
          label: "Profit estimé",
          value: formatCurrency(filteredStats.totalProfit),
          helper: `Marge moyenne: ${formatPercent(filteredStats.averageMargin)}`,
          icon: <TrendingUp className="w-5 h-5" />,
          tone: "violet",
        }]
      : []),
    {
      label: "Unités vendues",
      value: formatNumber(filteredStats.totalItems),
      helper: `${formatNumber(filteredStats.multiplePaymentSales)} paiement(s) multiples`,
      icon: <Boxes className="w-5 h-5" />,
      tone: "amber",
    },
    {
      label: "Ventes payées",
      value: formatNumber(filteredStats.completedSales),
      helper: `${formatNumber(filteredStats.deliveredSales)} livrée(s)`,
      icon: <CheckCircle2 className="w-5 h-5" />,
      tone: "green",
    },
    {
      label: "Ventes modifiées",
      value: formatNumber(filteredStats.modifiedSales),
      helper: "Avec historique de modification",
      icon: <PackageCheck className="w-5 h-5" />,
      tone: "sky",
    },
  ];

  const handleResetFilters = () => {
    setStatusFilter("");
    setClientFilter("");
    setSellerFilter("");
    setSaleTypeFilter("");
    setPaymentStructureFilter("");
    setDateFilter("");
    setDeliveryFilter("");
    setContainerFilter("");
  };

  return (
    <div className="min-h-full bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header — compact on mobile */}
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              to="/sales"
              className="flex items-center gap-2 shrink-0 w-10 h-10 justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-950 transition-colors md:w-auto md:h-auto md:px-3 md:py-2 md:rounded-full md:justify-start"
              aria-label="Retour au tableau des ventes"
            >
              <ArrowLeft className="w-5 h-5 shrink-0 md:w-4 md:h-4" />
              <span className="hidden md:inline text-sm font-medium">
                Tableau des ventes
              </span>
            </Link>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Archive ventes</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl md:text-3xl">
                Toutes les ventes
              </h1>
              <p className="hidden sm:block text-sm text-slate-500 mt-0.5">
                Liste complète et filtrée des ventes.
              </p>
            </div>
          </div>
        </div>

        {/* Filters — collapsible on mobile */}
        <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between p-4 text-left sm:hidden bg-white hover:bg-slate-50 transition-colors"
            aria-expanded={filtersOpen}
          >
            <span className="font-medium text-slate-900">Filtres</span>
            {hasActiveFilters && (
              <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-full">
                Actifs
              </span>
            )}
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`${filtersOpen ? "block" : "hidden"} sm:block border-t border-slate-100 sm:border-t-0`}>
            <div className="p-4 sm:p-6 pt-0 sm:pt-6">
              <SalesFiltersBar
                statusFilter={statusFilter}
                clientFilter={clientFilter}
                sellerFilter={sellerFilter}
                saleTypeFilter={saleTypeFilter}
                paymentStructureFilter={paymentStructureFilter}
                dateFilter={dateFilter}
                deliveryFilter={deliveryFilter}
                containerFilter={containerFilter}
                clients={clients}
                containers={containers}
                sellers={sellers}
                onStatusChange={setStatusFilter}
                onClientChange={setClientFilter}
                onSellerChange={setSellerFilter}
                onSaleTypeChange={setSaleTypeFilter}
                onPaymentStructureChange={setPaymentStructureFilter}
                onDateChange={setDateFilter}
                onDeliveryChange={setDeliveryFilter}
                onContainerChange={setContainerFilter}
                onReset={handleResetFilters}
                variant="archive"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[1.5rem] bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20">
            <AppLoader fullScreen={false} text="Chargement des ventes…" />
          </div>
        ) : (
          <>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Statistiques des filtres sélectionnés
                  </h2>
                  <p className="text-sm text-slate-500">
                    {canViewSensitiveFinancials
                      ? "Ces chiffres sont calculés uniquement sur les ventes actuellement affichées."
                      : "Vue opérationnelle: ventes, paiements, soldes et livraisons sans données sensibles."}
                  </p>
                </div>
                {hasActiveFilters && (
                  <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 sm:self-auto">
                    Filtres actifs
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-950">{filteredSales.length}</span>
                {filteredSales.length === 1 ? " vente" : " ventes"}
              </p>
              <SalesListExportButtons
                sales={filteredSales}
                filenamePrefix="archive-ventes"
                label="Archive des ventes"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredSales.length === 0 ? (
                <div className="col-span-full text-center py-12 sm:py-16 rounded-[1.5rem] border border-dashed border-slate-300 bg-white">
                  <p className="text-slate-600 font-medium">Aucune vente correspondante</p>
                  <p className="text-sm text-slate-400 mt-1">Modifiez les filtres ou revenez plus tard.</p>
                </div>
              ) : (
                <>
                  {visibleSales.map((sale, index) => {
                    const { totalPaid, balance } = calculateSaleTotals(sale);
                    const isModified =
                      Number(sale.modificationCount || 0) > 0 ||
                      (Array.isArray(sale.modificationHistory) && sale.modificationHistory.length > 0);
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
                          showProfitBadge={canViewSensitiveFinancials}
                          profitCategory={sale.computedCategory}
                          isModified={isModified}
                          actions={
                            sale.status === "completed" ? (
                              <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
                                <Suspense fallback={<div className="flex justify-center py-2"><AppLoader fullScreen={false} text="Facture…" /></div>}>
                                  <ExportSalesPdf sale={sale} />
                                </Suspense>
                              </div>
                            ) : null
                          }
                        />
                      </motion.div>
                    );
                  })}

                  {hasMoreSales && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleCount((current) =>
                            Math.min(current + VISIBLE_SALES_STEP, filteredSales.length)
                          )
                        }
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Afficher plus ({formatNumber(visibleSales.length)} sur {formatNumber(filteredSales.length)})
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const statTones = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  green: "bg-green-50 text-green-700 border-green-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  slate: "bg-slate-50 text-slate-700 border-slate-100",
};

const StatCard = ({ label, value, helper, icon, tone = "indigo" }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-slate-500">
          {label}
        </p>
        <p className="mt-1 break-words text-xl font-semibold text-slate-950 tabular-nums">
          {value}
        </p>
      </div>
      <div className={`shrink-0 rounded-xl border p-2.5 ${statTones[tone] || statTones.indigo}`}>
        {icon}
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500">{helper}</p>
  </div>
);

export default SalesArchive;
