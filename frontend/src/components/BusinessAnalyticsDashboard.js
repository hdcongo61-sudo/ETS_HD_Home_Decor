import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Coins,
  TrendingDown,
  PieChart as PieIcon,
  Brain,
  CalendarDays,
  ShoppingBag,
  Users,
  ArrowRight,
  BadgePercent,
  PackageCheck,
  Receipt,
  Sparkles,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { KPICard, ChartCard } from "./business";

const formatCFA = (value) =>
  `${Math.round(value || 0).toLocaleString("fr-FR")} CFA`;

const StatCard = ({ icon: Icon, title, value, helper, tone = "slate" }) => {
  const toneClasses = {
    green: "bg-[var(--ms-success)]/10 text-emerald-700 border-emerald-200 dark:bg-[var(--ms-success)]/100/10 dark:text-emerald-300 dark:border-emerald-500/20",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    red: "bg-[var(--ms-danger)]/10 text-rose-700 border-rose-200 dark:bg-[var(--ms-danger)]/100/10 dark:text-rose-300 dark:border-rose-500/20",
    violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
    slate: "bg-gray-100 text-gray-700 border-gray-200   ",
  };

  return (
  <motion.div
    whileHover={{ y: -2 }}
    className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md  "
  >
    <div className="flex items-start justify-between gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[tone] || toneClasses.slate}`}>
        <Icon size={20} />
      </span>
      {helper && (
        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500  ">
          {helper}
        </span>
      )}
    </div>
    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
      {title}
    </p>
    <h3 className="mt-2 text-xl font-bold text-gray-950 ">
        {typeof value === "number"
          ? formatCFA(value)
          : value}
    </h3>
  </motion.div>
  );
};

const BusinessAnalyticsDashboard = ({
  sales = [],
  expenses = [],
  payments = [],
  onOpenDayDetails,
}) => {
  const today = new Date();
  const currentWeek = {
    start: startOfWeek(today, { locale: fr }),
    end: endOfWeek(today, { locale: fr }),
  };

  // === Calculs financiers de la semaine ===
  const weeklySales = sales.filter((s) =>
    isWithinInterval(new Date(s.saleDate || s.createdAt), currentWeek)
  );
  const weeklyPayments = payments.filter((p) =>
    isWithinInterval(new Date(p.paymentDate || p.createdAt), currentWeek)
  );
  const weeklyExpenses = expenses.filter((e) =>
    isWithinInterval(new Date(e.date || e.createdAt), currentWeek)
  );

  const totalSales = useMemo(
    () => weeklySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
    [weeklySales]
  );
  const totalPaid = useMemo(
    () => weeklyPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [weeklyPayments]
  );
  const totalExpenses = useMemo(
    () => weeklyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [weeklyExpenses]
  );
  const profit = totalPaid - totalExpenses;
  const margin = totalSales ? (profit / totalSales) * 100 : 0;
  const collectionRate = totalSales ? (totalPaid / totalSales) * 100 : 0;
  const expenseRate = totalPaid ? (totalExpenses / totalPaid) * 100 : 0;

  // === Analyse des produits ===
  const productStats = useMemo(() => {
    const map = {};
    weeklySales.forEach((sale) => {
      sale.products?.forEach((item) => {
        const name = item.product?.name || item.productId?.name || "Produit inconnu";
        map[name] = map[name] || { name, quantity: 0, revenue: 0 };
        map[name].quantity += item.quantity || 0;
        map[name].revenue += (item.priceAtSale || item.sellingPrice || 0) * (item.quantity || 0);
      });
    });
    const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    return {
      top: sorted.slice(0, 3),
      low: sorted.slice(-3),
      total: sorted.length,
    };
  }, [weeklySales]);

  // === Analyse des clients ===
  const clientStats = useMemo(() => {
    const map = {};
    weeklySales.forEach((sale) => {
      const name = sale.client?.name || "Client inconnu";
      map[name] = map[name] || { name, totalSpent: 0, count: 0 };
      map[name].totalSpent += sale.totalAmount || 0;
      map[name].count += 1;
    });
    const sorted = Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
    return {
      top: sorted.slice(0, 3),
      inactive: sorted.filter((c) => c.count === 1).slice(0, 3),
      total: sorted.length,
    };
  }, [weeklySales]);

  const commerceHighlights = useMemo(() => {
    const paymentMap = new Map();

    weeklyPayments.forEach((payment) => {
      const saleId = payment?.saleId;
      if (!saleId) return;
      const key = String(saleId);
      const current = paymentMap.get(key) || { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(payment.amount) || 0;
      paymentMap.set(key, current);
    });

    const result = {
      wholesale: { count: 0, totalAmount: 0 },
      singlePayment: { count: 0, totalAmount: 0 },
      multiplePayments: { count: 0, totalAmount: 0 },
    };

    weeklySales.forEach((sale) => {
      const saleTotal = Number(sale?.totalAmount || 0);
      const saleId = String(sale?._id || "");
      const paymentInfo = paymentMap.get(saleId) || { count: 0, total: 0 };

      if ((sale?.saleType || "normal") === "wholesale") {
        result.wholesale.count += 1;
        result.wholesale.totalAmount += saleTotal;
      }

      if (paymentInfo.count === 1) {
        result.singlePayment.count += 1;
        result.singlePayment.totalAmount += saleTotal;
      } else if (paymentInfo.count > 1) {
        result.multiplePayments.count += 1;
        result.multiplePayments.totalAmount += saleTotal;
      }
    });

    return result;
  }, [weeklyPayments, weeklySales]);

  const weeklyLabel = `${format(currentWeek.start, "dd MMM", {
    locale: fr,
  })} - ${format(currentWeek.end, "dd MMM", { locale: fr })}`;
  const topProduct = productStats.top[0];
  const topClient = clientStats.top[0];
  const insightCards = [
    {
      label: "Recouvrement",
      value: `${collectionRate.toFixed(1)}%`,
      helper:
        collectionRate >= 80
          ? "Encaissement solide sur la semaine."
          : "Suivre les ventes non totalement réglées.",
      icon: Coins,
      tone: "blue",
    },
    {
      label: "Marge nette",
      value: `${margin.toFixed(1)}%`,
      helper:
        profit >= 0
          ? "La semaine reste profitable."
          : "Les dépenses dépassent les encaissements.",
      icon: BadgePercent,
      tone: profit >= 0 ? "green" : "red",
    },
    {
      label: "Charge dépenses",
      value: `${expenseRate.toFixed(1)}%`,
      helper: "Dépenses comparées aux encaissements.",
      icon: Receipt,
      tone: expenseRate > 60 ? "red" : "slate",
    },
  ];

  return (
    <motion.div
      className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] "
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* ====== Résumé Analytique ====== */}
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] dark:bg-white dark:text-gray-950">
              <Brain size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                Semaine courante
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950  sm:text-2xl">
                Résumé analytique
              </h2>
              <p className="mt-1 text-sm text-gray-500 ">
                Lecture rapide des ventes, encaissements, clients et produits du {weeklyLabel}.
              </p>
            </div>
          </div>
          {onOpenDayDetails && (
            <button
              onClick={() => onOpenDayDetails(new Date())}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
            >
              <CalendarDays size={18} />
              Détails du jour
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        {/* Cartes principales */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Ventes" value={totalSales} icon={DollarSign} helper={`${weeklySales.length} vente(s)`} tone="green" />
          <StatCard title="Encaissements" value={totalPaid} icon={Coins} helper={`${collectionRate.toFixed(0)}% encaissé`} tone="blue" />
          <StatCard title="Dépenses" value={totalExpenses} icon={TrendingDown} helper={`${weeklyExpenses.length} ligne(s)`} tone="red" />
          <StatCard title="Profit net" value={profit} icon={PieIcon} helper={`${margin.toFixed(1)}% marge`} tone={profit >= 0 ? "violet" : "red"} />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {insightCards.map(({ label, value, helper, icon: Icon, tone }) => (
            <div
              key={label}
              className="rounded-[22px] border border-gray-200 bg-gray-50/80 p-4  /70"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                  {label}
                </p>
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm  ">
                  <Icon size={17} />
                </span>
              </div>
              <p className={`mt-3 text-2xl font-black tabular-nums ${
                tone === "red"
                  ? "text-rose-700 dark:text-rose-300"
                  : tone === "green"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : tone === "blue"
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-gray-950 "
              }`}>
                {value}
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-500 ">
                {helper}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ====== Analyse Produits ====== */}
          <AnalyticsList
            title="Produits qui tirent la semaine"
            description={`${productStats.total} produit(s) vendu(s) sur la période.`}
            icon={ShoppingBag}
            emptyText="Aucune vente enregistrée cette semaine."
          >
            {productStats.top.map((p, index) => (
              <RankedRow
                key={p.name}
                index={index}
                title={p.name}
                subtitle={`${p.quantity} vendu(s)`}
                value={formatCFA(p.revenue)}
              />
            ))}
          </AnalyticsList>

          {/* ====== Analyse Clients ====== */}
          <AnalyticsList
            title="Clients les plus actifs"
            description={`${clientStats.total} client(s) actif(s) cette semaine.`}
            icon={Users}
            emptyText="Aucun client actif cette semaine."
          >
            {clientStats.top.map((c, index) => (
              <RankedRow
                key={c.name}
                index={index}
                title={c.name}
                subtitle={`${c.count} achat(s)`}
                value={formatCFA(c.totalSpent)}
              />
            ))}
          </AnalyticsList>
        </div>

        {/* ====== Synthèse Intelligente ====== */}
        <div className="rounded-[24px] border border-gray-200 bg-gray-50/80 p-4  /70 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-800 shadow-sm  ">
                <Sparkles size={18} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-gray-950 ">
                  Synthèse intelligente
                </h3>
                <p className="mt-1 text-sm text-gray-500 ">
                  Points à retenir avant de passer aux détails.
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600   ">
              {weeklySales.length} vente(s)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CommerceMetric
              icon={PackageCheck}
              label="Ventes en gros"
              count={commerceHighlights.wholesale.count}
              amount={commerceHighlights.wholesale.totalAmount}
            />
            <CommerceMetric
              icon={Coins}
              label="Paiement unique"
              count={commerceHighlights.singlePayment.count}
              amount={commerceHighlights.singlePayment.totalAmount}
            />
            <CommerceMetric
              icon={Receipt}
              label="Paiements multiples"
              count={commerceHighlights.multiplePayments.count}
              amount={commerceHighlights.multiplePayments.totalAmount}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <InsightNote
              title="Produit moteur"
              value={topProduct?.name || "Aucun"}
              helper={topProduct ? `${formatCFA(topProduct.revenue)} générés` : "Pas encore de vente cette semaine."}
            />
            <InsightNote
              title="Client principal"
              value={topClient?.name || "Aucun"}
              helper={topClient ? `${formatCFA(topClient.totalSpent)} sur ${topClient.count} achat(s)` : "Pas encore de client actif."}
            />
            <InsightNote
              title="Relance"
              value={clientStats.inactive.length ? `${clientStats.inactive.length} client(s)` : "Stable"}
              helper={
                clientStats.inactive.length
                  ? clientStats.inactive.map((c) => c.name).join(", ")
                  : "Aucun signal de relance prioritaire."
              }
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const AnalyticsList = ({ title, description, icon: Icon, emptyText, children }) => {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <section className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm  ">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-700  ">
          <Icon size={18} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-gray-950 ">
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 ">
            {description}
          </p>
        </div>
      </div>
      {hasChildren ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500   ">
          {emptyText}
        </div>
      )}
    </section>
  );
};

const RankedRow = ({ index, title, subtitle, value }) => (
  <motion.div
    whileHover={{ x: 2 }}
    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3  /70"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-xs font-bold text-white dark:bg-white dark:text-gray-950">
        {index + 1}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-950 ">
          {title}
        </p>
        <p className="text-xs text-gray-500 ">{subtitle}</p>
      </div>
    </div>
    <span className="shrink-0 text-sm font-bold text-gray-950 ">
      {value}
    </span>
  </motion.div>
);

const CommerceMetric = ({ icon: Icon, label, count, amount }) => (
  <div className="rounded-[20px] border border-gray-200 bg-white p-4  ">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>
      <Icon size={17} className="text-gray-500 " />
    </div>
    <p className="mt-3 text-2xl font-black text-gray-950 ">
      {count || 0}
    </p>
    <p className="mt-1 text-sm font-medium text-gray-500 ">
      {formatCFA(amount)}
    </p>
  </div>
);

const InsightNote = ({ title, value, helper }) => (
  <div className="rounded-[20px] border border-gray-200 bg-white p-4  ">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
        {title}
      </p>
      <ArrowRight size={16} className="text-gray-400" />
    </div>
    <p className="mt-3 truncate text-base font-bold text-gray-950 ">
      {value}
    </p>
    <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500 ">
      {helper}
    </p>
  </div>
);

export default BusinessAnalyticsDashboard;
