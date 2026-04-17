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
} from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

const StatCard = ({ icon, title, value, color }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4"
  >
    <div className={`p-3 rounded-xl ${color.bg} text-white`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        {typeof value === "number"
          ? value.toLocaleString("fr-FR") + " CFA"
          : value}
      </h3>
    </div>
  </motion.div>
);

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

  // === Synthèse intelligente en français ===
  const insightSummary = `
Cette semaine (${format(currentWeek.start, "dd MMM", {
    locale: fr,
  })} - ${format(currentWeek.end, "dd MMM", { locale: fr })}) :

💰 Ventes : ${totalSales.toLocaleString("fr-FR")} CFA  
🏦 Encaissements : ${totalPaid.toLocaleString("fr-FR")} CFA  
📉 Dépenses : ${totalExpenses.toLocaleString("fr-FR")} CFA  
💹 Profit : ${profit.toLocaleString("fr-FR")} CFA (${margin.toFixed(1)} % de marge)

🛒 Produits analysés : ${productStats.total}  
👥 Clients actifs : ${clientStats.total}

📦 Ventes en gros : ${commerceHighlights.wholesale.count} (${commerceHighlights.wholesale.totalAmount.toLocaleString("fr-FR")} CFA)
💳 Paiement unique : ${commerceHighlights.singlePayment.count} (${commerceHighlights.singlePayment.totalAmount.toLocaleString("fr-FR")} CFA)
🧾 Paiements multiples : ${commerceHighlights.multiplePayments.count} (${commerceHighlights.multiplePayments.totalAmount.toLocaleString("fr-FR")} CFA)

🔝 **Top Produits :** ${productStats.top
    .map((p) => `${p.name} (${p.revenue.toLocaleString("fr-FR")} CFA)`)
    .join(", ")}

🌟 **Top Clients :** ${clientStats.top
    .map((c) => `${c.name} (${c.totalSpent.toLocaleString("fr-FR")} CFA)`)
    .join(", ")} 

${
  clientStats.inactive.length > 0
    ? `⚠️ Clients à relancer : ${clientStats.inactive
        .map((c) => c.name)
        .join(", ")}`
    : "Tous vos clients sont actifs cette semaine ! 🚀"
}
  `.trim();

  return (
    <motion.div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-lg p-6 space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* ====== Résumé Analytique ====== */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Résumé Analytique
        </h2>
        <button
          onClick={() => onOpenDayDetails?.(new Date())}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <CalendarDays size={16} />
          Voir les détails du jour
        </button>
      </div>

      {/* Cartes principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventes"
          value={totalSales}
          icon={<DollarSign size={20} />}
          color={{ bg: "bg-green-500" }}
        />
        <StatCard
          title="Encaissements"
          value={totalPaid}
          icon={<Coins size={20} />}
          color={{ bg: "bg-blue-500" }}
        />
        <StatCard
          title="Dépenses"
          value={totalExpenses}
          icon={<TrendingDown size={20} />}
          color={{ bg: "bg-red-500" }}
        />
        <StatCard
          title="Profit Net"
          value={profit}
          icon={<PieIcon size={20} />}
          color={{ bg: "bg-purple-500" }}
        />
      </div>

      {/* ====== Analyse Produits ====== */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
          <ShoppingBag className="text-indigo-500" size={18} />
          Analyse des Produits
        </h3>
        {productStats.top.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {productStats.top.map((p) => (
              <motion.div
                key={p.name}
                whileHover={{ scale: 1.03 }}
                className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                  {p.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {p.quantity} vendu(s)
                </p>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {p.revenue.toLocaleString("fr-FR")} CFA
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Aucune vente enregistrée cette semaine.
          </p>
        )}
      </div>

      {/* ====== Analyse Clients ====== */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Users className="text-teal-500" size={18} />
          Analyse des Clients
        </h3>
        {clientStats.top.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clientStats.top.map((c) => (
              <motion.div
                key={c.name}
                whileHover={{ scale: 1.03 }}
                className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-green-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <h4 className="font-semibold text-gray-800 dark:text-gray-100">
                  {c.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {c.count} achat(s)
                </p>
                <p className="text-sm font-medium text-teal-600 dark:text-teal-400">
                  {c.totalSpent.toLocaleString("fr-FR")} CFA dépensés
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Aucun client actif cette semaine.
          </p>
        )}
      </div>

      {/* ====== Synthèse Intelligente ====== */}
      <motion.div
        className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm mt-6"
        whileHover={{ scale: 1.01 }}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Brain className="text-blue-600 dark:text-blue-400" size={18} />
            Synthèse Intelligente
          </h3>
          <button
            onClick={() => onOpenDayDetails?.(new Date())}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <CalendarDays size={14} /> Voir les détails
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl border border-fuchsia-200 bg-white/80 p-4 dark:border-fuchsia-900/60 dark:bg-gray-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">
              Ventes en gros
            </p>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {commerceHighlights.wholesale.count}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {commerceHighlights.wholesale.totalAmount.toLocaleString("fr-FR")} CFA
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4 dark:border-emerald-900/60 dark:bg-gray-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Paiement unique
            </p>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {commerceHighlights.singlePayment.count}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {commerceHighlights.singlePayment.totalAmount.toLocaleString("fr-FR")} CFA
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 dark:border-amber-900/60 dark:bg-gray-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Paiements multiples
            </p>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
              {commerceHighlights.multiplePayments.count}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {commerceHighlights.multiplePayments.totalAmount.toLocaleString("fr-FR")} CFA
            </p>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
          {insightSummary}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default BusinessAnalyticsDashboard;
