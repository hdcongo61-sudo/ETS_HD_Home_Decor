import React, { useContext, useMemo } from "react";
import { format, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AuthContext from "../context/AuthContext";
import {
  ShoppingBag,
  Receipt,
  CreditCard,
  X,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  LineChart,
  FileText,
  Brain,
} from "lucide-react";

const DayDetailsModal = ({
  date,
  sales = [],
  expenses = [],
  payments = [],
  onClose,
}) => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);

  /* ------------------- Utilities ------------------- */
  const formatCurrency = (v) => {
    if (!v || isNaN(v)) return "0 CFA";
    return `${Number(v).toLocaleString("fr-FR")} CFA`;
  };

  const safeFormatDate = (d, fmt = "dd MMMM yyyy") => {
    try {
      const dateObj = new Date(d);
      return isValid(dateObj) ? format(dateObj, fmt, { locale: fr }) : "—";
    } catch {
      return "—";
    }
  };

  const safeFormatTime = (d) => safeFormatDate(d, "HH:mm");

  const formatDateForLink = (d) => {
    const dateObj = new Date(d);
    return isValid(dateObj)
      ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(dateObj.getDate()).padStart(2, "0")}`
      : "";
  };

  /* ------------------- Totals ------------------- */
  const totals = useMemo(() => {
    const totalSales = sales.reduce((s, x) => s + (x?.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((s, x) => s + (x?.amount || 0), 0);
    const totalPayments = payments.reduce((s, x) => s + (x?.amount || 0), 0);
    const profit = totalPayments - totalExpenses;
    const profitMargin =
      totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0;
    return { totalSales, totalExpenses, totalPayments, profit, profitMargin };
  }, [sales, expenses, payments]);

  /* ------------------- AI-style Insight Summary ------------------- */
  const summary = useMemo(() => {
    const { totalSales, totalExpenses, totalPayments, profit, profitMargin } =
      totals;

    const trend =
      profitMargin >= 30
        ? { text: "Excellente performance", icon: <TrendingUp className="text-green-500" /> }
        : profitMargin >= 15
        ? { text: "Performance stable", icon: <LineChart className="text-blue-500" /> }
        : { text: "Marge faible", icon: <TrendingDown className="text-red-500" /> };

    return {
      text: `Ce jour, vous avez réalisé ${formatCurrency(
        totalSales
      )} de ventes, avec ${formatCurrency(
        profit
      )} de profit net (${profitMargin}% de marge).`,
      trend,
    };
  }, [totals]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", duration: 0.35 }}
          className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/40 dark:border-gray-800"
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 dark:from-indigo-700 dark:via-indigo-800 dark:to-purple-900 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-semibold">
                  Détails du {safeFormatDate(date)}
                </h2>
                <p className="text-sm opacity-90 mt-1">{summary.text}</p>
                <div className="flex items-center gap-2 mt-2 text-sm font-medium">
                  {summary.trend.icon}
                  <span>{summary.trend.text}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
              >
                <X size={22} />
              </button>
            </div>
            <div className="absolute top-0 right-0 opacity-10">
              <Brain size={120} />
            </div>
          </div>

          {/* Stat Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <MiniStat color="green" label="Ventes" value={totals.totalSales} />
            <MiniStat color="blue" label="Encaissements" value={totals.totalPayments} />
            <MiniStat color="red" label="Dépenses" value={totals.totalExpenses} />
            <MiniStat color="purple" label="Profit" value={totals.profit} />
          </div>

          {/* Body */}
          <div className="overflow-auto flex-grow p-6 space-y-8">
            <Section
              icon={<ShoppingBag className="text-green-600" size={18} />}
              title={`Ventes (${sales.length})`}
              link={`/sales?date=${formatDateForLink(date)}`}
              emptyText="Aucune vente pour cette journée"
            >
              {sales.map((s, i) => (
                <motion.div
                  key={s._id || i}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 rounded-xl shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        Vente #{s.saleNumber || `T${i + 1}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {s.client?.name || "Client non spécifié"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-green-600 font-semibold">
                        {formatCurrency(s.totalAmount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {safeFormatTime(s.createdAt)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>

            <Section
              icon={<Receipt className="text-red-600" size={18} />}
              title={`Dépenses (${expenses.length})`}
              link={isAdmin ? `/expenses?date=${formatDateForLink(date)}` : null}
              emptyText="Aucune dépense pour cette journée"
            >
              {expenses.map((e, i) => (
                <motion.div
                  key={e._id || i}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 rounded-xl shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {e.description || "Dépense sans description"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                          {e.category || "Non catégorisé"}
                        </span>
                        {e.supplier && <span>Fourn.: {e.supplier}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-600 font-semibold">
                        {formatCurrency(e.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {safeFormatTime(e.createdAt)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>

            <Section
              icon={<CreditCard className="text-blue-600" size={18} />}
              title={`Encaissements (${payments.length})`}
              emptyText="Aucun encaissement pour cette journée"
            >
              {payments.map((p, i) => (
                <motion.div
                  key={p._id || i}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 rounded-xl shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        Paiement #{i + 1}
                      </div>
                      <div className="text-sm text-gray-500">
                        {p.client?.name || "Client non spécifié"}
                      </div>
                      {p.saleId && (
                        <Link
                          to={`/sales/${p.saleId}`}
                          className="text-blue-600 hover:text-blue-400 text-xs underline flex items-center gap-1 mt-1"
                        >
                          Voir la vente <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600 font-semibold">
                        {formatCurrency(p.amount)}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {p.method || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {safeFormatTime(p.paymentDate)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200/50 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              {sales.length + expenses.length + payments.length} transactions
              totales
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <LinkButton
                to={`/sales?date=${formatDateForLink(date)}`}
                label="Ventes"
              />
              {isAdmin ? (
                <LinkButton
                  to={`/expenses?date=${formatDateForLink(date)}`}
                  label="Dépenses"
                />
              ) : (
                <DisabledButton label="Dépenses" />
              )}
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-colors w-full sm:w-auto"
              >
                Fermer
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ------------------- Helper Components ------------------- */
const MiniStat = ({ color, label, value }) => (
  <div
    className={`p-3 rounded-xl flex flex-col items-center justify-center bg-${color}-50 dark:bg-${color}-900/20 text-${color}-700 dark:text-${color}-300`}
  >
    <div className="text-xs font-medium">{label}</div>
    <div className="text-lg font-semibold">{value.toLocaleString()} CFA</div>
  </div>
);

const Section = ({ icon, title, link, children, emptyText }) => (
  <div>
    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
        {icon} {title}
      </h3>
      {link ? (
        <Link
          to={link}
          className="text-blue-600 hover:text-blue-400 text-sm flex items-center gap-1 transition"
        >
          Voir tout <ChevronRight size={14} />
        </Link>
      ) : (
        <span className="text-gray-400 text-sm flex items-center gap-1 cursor-not-allowed">
          Voir tout <ChevronRight size={14} />
        </span>
      )}
    </div>
    {children?.length ? (
      <div className="space-y-3">{children}</div>
    ) : (
      <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
        <p className="text-gray-500 dark:text-gray-400">{emptyText}</p>
      </div>
    )}
  </div>
);

const LinkButton = ({ to, label }) => (
  <Link
    to={to}
    className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 px-5 py-2.5 rounded-xl transition w-full sm:w-auto flex items-center justify-center gap-2"
  >
    <FileText size={16} /> {label}
  </Link>
);

const DisabledButton = ({ label }) => (
  <span className="bg-white dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-800 px-5 py-2.5 rounded-xl w-full sm:w-auto flex items-center justify-center gap-2 cursor-not-allowed">
    <FileText size={16} /> {label}
  </span>
);

export default DayDetailsModal;
