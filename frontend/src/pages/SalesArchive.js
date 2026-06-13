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
import {
  Button,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from "../components/business";

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
    <Workspace>
        <PageHeader
          eyebrow="Archive ventes"
          title="Toutes les ventes"
          description="Liste complète et filtrée des ventes."
          actions={
            <Link
              to="/sales"
              className="ms-button ms-button-secondary ms-button-md"
              aria-label="Retour au tableau des ventes"
            >
              <ArrowLeft className="w-5 h-5 shrink-0 md:w-4 md:h-4" />
              <span>Tableau des ventes</span>
            </Link>
          }
        />

        {/* Filters — collapsible on mobile */}
        <Surface>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--colorNeutralBackground2)] sm:hidden"
            style={{ background: 'var(--colorNeutralBackground1)' }}
            aria-expanded={filtersOpen}
          >
            <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>Filtres</span>
            {hasActiveFilters && <StatusBadge tone="neutral">Actifs</StatusBadge>}
            <ChevronDown className={`w-5 h-5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--colorNeutralForeground3)' }} />
          </button>
          <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block border-t sm:border-t-0`} style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
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
        </Surface>

        {error && (
          <EmptyState title="Erreur de chargement" description={error} />
        )}

        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : (
          <>
            <Surface className="p-4 sm:p-5">
              <div className="ms-command-bar flex-wrap gap-y-2 mb-4">
                <div>
                  <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    Statistiques des filtres
                  </h2>
                  <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    {canViewSensitiveFinancials
                      ? 'Calculés sur les ventes actuellement affichées.'
                      : 'Vue opérationnelle sans données sensibles.'}
                  </p>
                </div>
                {hasActiveFilters && <StatusBadge tone="neutral">Filtres actifs</StatusBadge>}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>
            </Surface>

            <div className="ms-command-bar flex-wrap gap-y-2">
              <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{filteredSales.length}</span>
                {filteredSales.length === 1 ? ' vente' : ' ventes'}
              </p>
              <div className="ml-auto">
                <SalesListExportButtons sales={filteredSales} filenamePrefix="archive-ventes" label="Archive des ventes" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredSales.length === 0 ? (
                <EmptyState title="Aucune vente correspondante" description="Modifiez les filtres ou revenez plus tard." />
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
                      <Button
                        type="button"
                        onClick={() =>
                          setVisibleCount((current) =>
                            Math.min(current + VISIBLE_SALES_STEP, filteredSales.length)
                          )
                        }
                      >
                        Afficher plus ({formatNumber(visibleSales.length)} sur {formatNumber(filteredSales.length)})
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
    </Workspace>
  );
};

const StatCard = ({ label, value, helper, icon }) => (
  <KPICard title={label} value={value} context={helper} icon={icon} />
);

export default SalesArchive;
