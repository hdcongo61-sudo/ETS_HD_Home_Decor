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

  const wholesaleStats = useMemo(() => {
    const wholesaleSales = sales.filter(
      (sale) => (sale?.saleType || "normal") === "wholesale"
    );

    return {
      count: wholesaleSales.length,
      totalAmount: wholesaleSales.reduce(
        (sum, sale) => sum + Number(sale?.totalAmount || 0),
        0
      ),
    };
  }, [sales]);

  /* ------------------- Performance Summary ------------------- */
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
        className="fixed inset-0 z-[260] flex items-end justify-center bg-gray-950/50 p-0 backdrop-blur-md sm:items-center sm:p-4"
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
          className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/80 bg-white/96 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl safe-area-bottom dark:border-gray-800 dark:bg-gray-900/96 sm:max-h-[calc(100dvh-4.5rem)] sm:max-w-6xl sm:rounded-[28px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile: minimal top bar (drag handle + date + close) */}
          <div className="sm:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/92 dark:bg-gray-900/92 backdrop-blur-xl shrink-0 safe-area-top">
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
          <div className="hidden border-b border-gray-200 bg-white/92 px-5 py-4 text-gray-900 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/92 dark:text-white sm:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    Détails du jour
                  </p>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    {sales.length + expenses.length + payments.length} transaction{sales.length + expenses.length + payments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <h2 className="text-xl font-bold leading-tight tracking-tight">
                    {safeFormatDate(date)}
                  </h2>
                  <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {summary.trend.icon}
                    <span>{summary.trend.text}</span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {summary.text}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[42px] min-w-[42px] flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Stat Row: compact on mobile, clearer hierarchy */}
          <div className="grid grid-cols-2 gap-2 border-b border-gray-200 bg-gray-50/90 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/80 sm:grid-cols-5 sm:p-3">
            <MiniStat color="green" label="Ventes" value={totals.totalSales} />
            <MiniStat color="blue" label="Encaissements" value={totals.totalPayments} />
            <MiniStat color="red" label="Dépenses" value={totals.totalExpenses} />
            <MiniStat color="purple" label="Profit" value={totals.profit} />
            <MiniStat
              color="amber"
              label="Vente en gros"
              value={wholesaleStats.totalAmount}
              helperText={`${wholesaleStats.count} vente${wholesaleStats.count > 1 ? "s" : ""}`}
            />
          </div>

          {/* Body: more spacing and clarity on mobile */}
          <div className="grid flex-grow gap-4 overflow-auto overscroll-contain bg-white px-4 py-4 dark:bg-gray-900 sm:grid-cols-3 sm:p-5">
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
                  className="flex min-h-[64px] flex-col justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 sm:p-4"
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
                  className="flex min-h-[64px] flex-col justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 sm:p-4"
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
                  className="flex min-h-[64px] flex-col justify-center rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600 sm:p-4"
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
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50/88 px-4 py-4 backdrop-blur-xl safe-area-bottom dark:border-gray-700 dark:bg-gray-800/88 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
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
                className="form-button-primary w-full touch-manipulation text-sm sm:w-auto sm:text-base"
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
  green: "border-emerald-100 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300",
  blue: "border-blue-100 text-blue-700 dark:border-blue-900/50 dark:text-blue-300",
  red: "border-red-100 text-red-700 dark:border-red-900/50 dark:text-red-300",
  purple: "border-violet-100 text-violet-700 dark:border-violet-900/50 dark:text-violet-300",
  amber: "border-amber-100 text-amber-700 dark:border-amber-900/50 dark:text-amber-300",
};

const MiniStat = ({ color, label, value, helperText = "" }) => (
  <div
    className={`flex min-h-[64px] flex-col justify-center rounded-2xl border bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.04)] dark:bg-gray-900 sm:min-h-[60px] ${MINI_STAT_STYLES[color] || MINI_STAT_STYLES.blue}`}
  >
    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 break-all text-sm font-bold tabular-nums sm:text-base">{Number(value || 0).toLocaleString("fr-FR")} CFA</div>
    {helperText ? (
      <div className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">{helperText}</div>
    ) : null}
  </div>
);

const Section = ({ icon, title, link, children, emptyText }) => (
  <section className="min-h-0 rounded-[24px] border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/55">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2.5 text-[15px] font-bold text-gray-900 dark:text-gray-100">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
      {link ? (
        <Link
          to={link}
          className="flex min-h-[36px] flex-shrink-0 items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Voir tout <ChevronRight size={14} />
        </Link>
      ) : (
        <span className="flex cursor-not-allowed items-center gap-1 px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500">
          Voir tout <ChevronRight size={14} />
        </span>
      )}
    </div>
    {children?.length ? (
      <div className="space-y-3">{children}</div>
    ) : (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-900/70">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{emptyText}</p>
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
