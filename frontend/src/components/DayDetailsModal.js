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
    // eslint-disable-next-line no-unused-vars -- only need totalSales, profit, profitMargin here
    const { totalSales, totalExpenses, totalPayments, profit, profitMargin } = totals;

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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-6xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/40 dark:border-gray-800 safe-area-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile: minimal top bar (drag handle + date + close) */}
          <div className="sm:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0 safe-area-top">
            <div className="w-10 shrink-0 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden />
            </div>
            <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-white truncate text-center">
              {safeFormatDate(date, "EEEE d MMMM yyyy")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition touch-manipulation"
              aria-label="Fermer"
            >
              <X size={22} />
            </button>
          </div>

          {/* Desktop: full header with gradient and summary */}
          <div className="hidden sm:block relative px-4 pb-4 pt-0 sm:p-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 dark:from-indigo-700 dark:via-indigo-800 dark:to-purple-900 text-white">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-semibold leading-tight">
                  Détails du {safeFormatDate(date)}
                </h2>
                <p className="text-xs sm:text-sm opacity-90 mt-1.5 line-clamp-2 sm:line-clamp-none">
                  {summary.text}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm font-medium">
                  {summary.trend.icon}
                  <span>{summary.trend.text}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition touch-manipulation"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>
            <div className="absolute top-0 right-0 opacity-10 pointer-events-none" aria-hidden>
              <Brain size={100} className="sm:w-[120px] sm:h-[120px]" />
            </div>
          </div>

          {/* Stat Row: compact on mobile, clearer hierarchy */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3 px-4 py-4 sm:p-4 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
            <MiniStat color="green" label="Ventes" value={totals.totalSales} />
            <MiniStat color="blue" label="Encaissements" value={totals.totalPayments} />
            <MiniStat color="red" label="Dépenses" value={totals.totalExpenses} />
            <MiniStat color="purple" label="Profit" value={totals.profit} />
          </div>

          {/* Body: more spacing and clarity on mobile */}
          <div className="overflow-auto flex-grow overscroll-contain px-4 py-4 sm:p-6 space-y-6 sm:space-y-8">
            <Section
              icon={<ShoppingBag className="text-green-600 dark:text-green-400 shrink-0" size={18} />}
              title={`Ventes (${sales.length})`}
              link={`/sales?date=${formatDateForLink(date)}`}
              emptyText="Aucune vente pour cette journée"
            >
              {sales.map((s, i) => (
                <motion.div
                  key={s._id || i}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm min-h-[56px] flex flex-col justify-center touch-manipulation"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base">
                        Vente #{s.saleNumber || `T${i + 1}`}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {s.client?.name || "Client non spécifié"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {safeFormatTime(s.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-green-600 dark:text-green-400 font-bold tabular-nums text-base sm:text-base">
                        {formatCurrency(s.totalAmount)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>

            <Section
              icon={<Receipt className="text-red-600 dark:text-red-400 shrink-0" size={18} />}
              title={`Dépenses (${expenses.length})`}
              link={isAdmin ? `/expenses?date=${formatDateForLink(date)}` : null}
              emptyText="Aucune dépense pour cette journée"
            >
              {expenses.map((e, i) => (
                <motion.div
                  key={e._id || i}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm min-h-[56px] flex flex-col justify-center touch-manipulation"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 text-base">
                        {e.description || "Dépense sans description"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-xs font-medium">
                          {e.category || "Non catégorisé"}
                        </span>
                        {e.supplier && <span className="truncate text-xs">Fourn.: {e.supplier}</span>}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {safeFormatTime(e.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-red-600 dark:text-red-400 font-bold tabular-nums text-base">
                        {formatCurrency(e.amount)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>

            <Section
              icon={<CreditCard className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />}
              title={`Encaissements (${payments.length})`}
              emptyText="Aucun encaissement pour cette journée"
            >
              {payments.map((p, i) => (
                <motion.div
                  key={p._id || i}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm min-h-[56px] flex flex-col justify-center touch-manipulation"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                        Paiement #{i + 1}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {p.client?.name || "Client non spécifié"}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                        <span className="capitalize">{p.method || "—"}</span>
                        <span>·</span>
                        <span>{safeFormatTime(p.paymentDate)}</span>
                      </div>
                      {p.saleId && (
                        <Link
                          to={`/sales/${p.saleId}`}
                          className="inline-flex items-center gap-1 mt-2 min-h-[44px] sm:min-h-0 py-2 -my-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm font-medium touch-manipulation"
                        >
                          Voir la vente <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-blue-600 dark:text-blue-400 font-bold tabular-nums text-base">
                        {formatCurrency(p.amount)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </Section>
          </div>

          {/* Footer: 3 columns on mobile, row on desktop */}
          <div className="px-4 py-4 sm:p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 safe-area-bottom">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left order-2 sm:order-1">
              {sales.length + expenses.length + payments.length} transaction{sales.length + expenses.length + payments.length !== 1 ? "s" : ""} au total
            </p>
            <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
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
                type="button"
                onClick={onClose}
                className="min-h-[44px] py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-5 rounded-xl transition-colors w-full sm:w-auto touch-manipulation font-medium text-sm sm:text-base"
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
const MINI_STAT_STYLES = {
  green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
};

const MiniStat = ({ color, label, value }) => (
  <div
    className={`p-3 sm:p-3 rounded-2xl sm:rounded-xl flex flex-col items-center justify-center min-h-[64px] sm:min-h-0 ${MINI_STAT_STYLES[color] || MINI_STAT_STYLES.blue}`}
  >
    <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-current opacity-90">{label}</div>
    <div className="text-base sm:text-lg font-bold tabular-nums mt-1 break-all text-center">{Number(value || 0).toLocaleString("fr-FR")} CFA</div>
  </div>
);

const Section = ({ icon, title, link, children, emptyText }) => (
  <section>
    <div className="flex items-center justify-between gap-3 mb-4 sm:mb-4 pb-3 border-b-2 border-gray-200 dark:border-gray-700">
      <h3 className="text-base sm:text-lg font-bold flex items-center gap-2.5 text-gray-900 dark:text-gray-100 min-w-0">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
      {link ? (
        <Link
          to={link}
          className="flex-shrink-0 min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm font-medium py-2.5 px-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition touch-manipulation"
        >
          Voir tout <ChevronRight size={14} />
        </Link>
      ) : (
        <span className="text-gray-400 dark:text-gray-500 text-sm flex items-center gap-1 cursor-not-allowed py-2.5 px-3 font-medium">
          Voir tout <ChevronRight size={14} />
        </span>
      )}
    </div>
    {children?.length ? (
      <div className="space-y-3 sm:space-y-3">{children}</div>
    ) : (
      <div className="text-center py-10 sm:py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 px-4">{emptyText}</p>
      </div>
    )}
  </section>
);

const LinkButton = ({ to, label }) => (
  <Link
    to={to}
    className="min-h-[44px] py-3 sm:py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 px-2 sm:px-5 rounded-xl transition w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation font-medium text-sm sm:text-base"
  >
    <FileText size={14} className="shrink-0 sm:w-4 sm:h-4" /> <span className="truncate">{label}</span>
  </Link>
);

const DisabledButton = ({ label }) => (
  <span className="min-h-[44px] py-3 sm:py-2.5 bg-white dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-800 px-2 sm:px-5 rounded-xl w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 cursor-not-allowed font-medium text-sm sm:text-base">
    <FileText size={14} className="shrink-0 sm:w-4 sm:h-4" /> <span className="truncate">{label}</span>
  </span>
);

export default DayDetailsModal;
