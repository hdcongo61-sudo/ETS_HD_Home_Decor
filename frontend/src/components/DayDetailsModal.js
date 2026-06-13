import React, { useContext, useMemo, useState } from "react";
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
import {
  Button,
  KPICard,
  StatusBadge,
} from './business';

const DayDetailsModal = ({
  date,
  sales = [],
  expenses = [],
  payments = [],
  onClose,
}) => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  // Mobile: show one section at a time via tabs (avoids one very long scroll).
  const [activeTab, setActiveTab] = useState("sales");

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
        className="fixed inset-0 z-[260] flex items-end justify-center bg-[rgba(32,31,30,0.36)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
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
          className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-xl border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow-lg)] sm:max-h-[calc(100dvh-4.5rem)] sm:max-w-6xl sm:rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div className="sm:hidden border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--ms-text)]">
                {safeFormatDate(date, "EEEE d MMMM")}
              </h2>
              <button type="button" onClick={onClose} className="ms-icon-button shrink-0" aria-label="Fermer"><X size={22} /></button>
            </div>
            <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)] px-2.5 py-1 text-xs font-medium text-[var(--ms-text-muted)]">
              {React.cloneElement(summary.trend.icon, { size: 14 })}
              {summary.trend.text}
            </span>
          </div>

          {/* Desktop header */}
          <div className="hidden border-b border-[var(--ms-border)] bg-[var(--ms-white)] px-5 py-4 sm:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ms-text-muted)]">Details du jour</p>
                  <StatusBadge tone="neutral">{sales.length + expenses.length + payments.length} transaction{sales.length + expenses.length + payments.length !== 1 ? "s" : ""}</StatusBadge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <h2 className="text-xl font-bold text-[var(--ms-text-strong)]">{safeFormatDate(date)}</h2>
                  <div className="flex items-center gap-2 rounded-full bg-[var(--ms-bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--ms-text)]">
                    {summary.trend.icon}
                    <span>{summary.trend.text}</span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 max-w-4xl text-sm text-[var(--ms-text-muted)]">{summary.text}</p>
              </div>
              <button type="button" onClick={onClose} className="ms-icon-button" aria-label="Fermer"><X size={22} /></button>
            </div>
          </div>

          {/* Stat Row */}
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-3 sm:grid-cols-5 sm:px-4">
            <KPICard title="Ventes" value={`${totals.totalSales.toLocaleString("fr-FR")} CFA`} tone="success" />
            <KPICard title="Encaissements" value={`${totals.totalPayments.toLocaleString("fr-FR")} CFA`} tone="neutral" />
            <KPICard title="Depenses" value={`${totals.totalExpenses.toLocaleString("fr-FR")} CFA`} tone="danger" />
            <KPICard title="Profit" value={`${totals.profit.toLocaleString("fr-FR")} CFA`} tone={totals.profit >= 0 ? "success" : "danger"} />
            <KPICard title="Vente en gros" value={`${wholesaleStats.totalAmount.toLocaleString("fr-FR")} CFA`} context={`${wholesaleStats.count} vente${wholesaleStats.count > 1 ? "s" : ""}`} tone="warning" />
          </div>

          {/* Mobile section tabs */}
          <div className="sm:hidden flex gap-1 border-b border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 shrink-0">
            {[
              { id: "sales", label: "Ventes", count: sales.length },
              { id: "expenses", label: "Dépenses", count: expenses.length },
              { id: "payments", label: "Encaiss.", count: payments.length },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[40px] flex-1 rounded-md px-1.5 text-xs font-semibold transition-colors ${
                  activeTab === t.id
                    ? "bg-[var(--ms-blue)] text-white"
                    : "text-[var(--ms-text-muted)] hover:bg-[var(--ms-bg-subtle)]"
                }`}
                aria-pressed={activeTab === t.id}
              >
                {t.label} <span className="opacity-80">({t.count})</span>
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="grid flex-grow gap-4 overflow-auto overscroll-contain bg-[var(--ms-white)] px-4 py-4 sm:grid-cols-3 sm:p-5">
            <div className={activeTab === "sales" ? "" : "hidden sm:block"}>
            <Section
              icon={<ShoppingBag size={18} />}
              title={`Ventes (${sales.length})`}
              link={`/sales?date=${formatDateForLink(date)}`}
              emptyText="Aucune vente pour cette journee"
            >
              {sales.map((s, i) => (
                <div key={s._id || i} className="ms-surface p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--ms-text)] truncate">Vente #{s.saleNumber || `T${i + 1}`}</div>
                      <div className="text-sm text-[var(--ms-text-muted)] truncate mt-0.5">{s.client?.name || "Client non specifie"}</div>
                      <div className="text-xs text-[var(--ms-text-muted)] mt-1">{safeFormatTime(s.createdAt)}</div>
                    </div>
                    <div className="text-right shrink-0 font-bold text-[var(--ms-success)]">{formatCurrency(s.totalAmount)}</div>
                  </div>
                </div>
              ))}
            </Section>
            </div>

            <div className={activeTab === "expenses" ? "" : "hidden sm:block"}>
            <Section
              icon={<Receipt size={18} />}
              title={`Depenses (${expenses.length})`}
              link={isAdmin ? `/expenses?date=${formatDateForLink(date)}` : null}
              emptyText="Aucune depense pour cette journee"
            >
              {expenses.map((e, i) => (
                <div key={e._id || i} className="ms-surface p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--ms-text)] line-clamp-2">{e.description || "Depense sans description"}</div>
                      <div className="text-xs text-[var(--ms-text-muted)] mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone="neutral">{e.category || "Non categorise"}</StatusBadge>
                        {e.supplier && <span className="truncate text-xs">Fourn.: {e.supplier}</span>}
                      </div>
                      <div className="text-xs text-[var(--ms-text-muted)] mt-1">{safeFormatTime(e.createdAt)}</div>
                    </div>
                    <div className="text-right shrink-0 font-bold text-[var(--ms-danger)]">{formatCurrency(e.amount)}</div>
                  </div>
                </div>
              ))}
            </Section>
            </div>

            <div className={activeTab === "payments" ? "" : "hidden sm:block"}>
            <Section
              icon={<CreditCard size={18} />}
              title={`Encaissements (${payments.length})`}
              emptyText="Aucun encaissement pour cette journee"
            >
              {payments.map((p, i) => (
                <div key={p._id || i} className="ms-surface p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--ms-text)]">Paiement #{i + 1}</div>
                      <div className="text-sm text-[var(--ms-text-muted)] truncate mt-0.5">{p.client?.name || "Client non specifie"}</div>
                      <div className="text-xs text-[var(--ms-text-muted)] mt-1 flex flex-wrap items-center gap-2">
                        <span className="capitalize">{p.method || "—"}</span><span>·</span><span>{safeFormatTime(p.paymentDate)}</span>
                      </div>
                      {p.saleId && (
                        <Link to={`/sales/${p.saleId}`} className="inline-flex items-center gap-1 mt-2 text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] text-sm font-medium">
                          Voir la vente <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                    <div className="text-right shrink-0 font-bold text-[var(--ms-blue)]">{formatCurrency(p.amount)}</div>
                  </div>
                </div>
              ))}
            </Section>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <p className="text-xs sm:text-sm text-[var(--ms-text-muted)] text-center sm:text-left order-2 sm:order-1">
              {sales.length + expenses.length + payments.length} transaction{sales.length + expenses.length + payments.length !== 1 ? "s" : ""} au total
            </p>
            <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
              <Link to={`/sales?date=${formatDateForLink(date)}`} className="ms-button ms-button-secondary ms-button-sm justify-center"><FileText size={14} /> Ventes</Link>
              {isAdmin ? (
                <Link to={`/expenses?date=${formatDateForLink(date)}`} className="ms-button ms-button-secondary ms-button-sm justify-center"><FileText size={14} /> Depenses</Link>
              ) : (
                <span className="ms-button ms-button-sm justify-center opacity-40 cursor-not-allowed"><FileText size={14} /> Depenses</span>
              )}
              <Button variant="primary" size="sm" onClick={onClose}>Fermer</Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ------------------- Section Helper ------------------- */
const Section = ({ icon, title, link, children, emptyText }) => (
  <section className="min-h-0 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2.5 text-[15px] font-bold text-[var(--ms-text)]">
        {icon}
        <span className="truncate">{title}</span>
      </h3>
      {link ? (
        <Link to={link} className="ms-button ms-button-secondary ms-button-sm"><ChevronRight size={14} /> Voir tout</Link>
      ) : (
        <span className="ms-button ms-button-sm opacity-40 cursor-not-allowed"><ChevronRight size={14} /> Voir tout</span>
      )}
    </div>
    {children?.length ? (
      <div className="space-y-2">{children}</div>
    ) : (
      <div className="rounded-lg border border-dashed border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--ms-text-muted)]">{emptyText}</p>
      </div>
    )}
  </section>
);

export default DayDetailsModal;
