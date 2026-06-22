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
import { Button, StatusBadge } from "./business";

/* ------------------- Tone helpers ------------------- */
const TONE_COLORS = {
  success: "var(--ms-success)",
  danger: "var(--ms-danger)",
  blue: "var(--ms-blue)",
  brand: "var(--colorBrandForeground1)",
  warning: "#6B4A00",
  neutral: "var(--ms-text-strong)",
};

const ACCENTS = {
  sales: { bg: "rgba(16,124,16,0.12)", fg: "var(--ms-success)" },
  expenses: { bg: "rgba(209,52,56,0.10)", fg: "var(--ms-danger)" },
  payments: { bg: "var(--ms-blue-soft)", fg: "var(--ms-blue)" },
};

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
    // Realized (cash-basis) gross profit: margin actually collected via payments.
    const realizedProfit = payments.reduce((s, x) => s + (x?.profit || 0), 0);
    // Net profit = realized gross profit − expenses (same basis as the dashboard).
    const profit = realizedProfit - totalExpenses;
    // Cash result of the day: what came in (payments) minus what went out (expenses).
    const cashProfit = totalPayments - totalExpenses;
    const profitMargin =
      totalPayments > 0 ? ((realizedProfit / totalPayments) * 100).toFixed(1) : 0;
    return { totalSales, totalExpenses, totalPayments, realizedProfit, profit, cashProfit, profitMargin };
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

  const transactionCount = sales.length + expenses.length + payments.length;

  /* ------------------- Performance Summary ------------------- */
  const summary = useMemo(() => {
    const { totalSales, profit, profitMargin } = totals;

    const trend =
      profitMargin >= 30
        ? { text: "Excellente performance", icon: <TrendingUp className="text-green-500" /> }
        : profitMargin >= 15
        ? { text: "Performance stable", icon: <LineChart className="text-[var(--ms-blue)]" /> }
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

  const metrics = [
    { label: "Ventes", value: formatCurrency(totals.totalSales), tone: "success", sub: `${sales.length} vente${sales.length > 1 ? "s" : ""}` },
    { label: "Encaissements", value: formatCurrency(totals.totalPayments), tone: "blue", sub: `${payments.length} paiement${payments.length > 1 ? "s" : ""}` },
    { label: "Dépenses", value: formatCurrency(totals.totalExpenses), tone: "danger", sub: `${expenses.length} dépense${expenses.length > 1 ? "s" : ""}` },
    { label: "Profit (caisse)", value: formatCurrency(totals.cashProfit), tone: totals.cashProfit >= 0 ? "success" : "danger", sub: "Encaissements − dépenses" },
    { label: "Bénéfice encaissé", value: formatCurrency(totals.realizedProfit), tone: "brand", sub: "Marge collectée" },
    { label: "Profit net", value: formatCurrency(totals.profit), tone: totals.profit >= 0 ? "success" : "danger", sub: "Marge − dépenses" },
    { label: "Vente en gros", value: formatCurrency(wholesaleStats.totalAmount), tone: "warning", sub: `${wholesaleStats.count} vente${wholesaleStats.count > 1 ? "s" : ""}` },
  ];

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
          className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] shadow-[var(--ms-shadow-lg)] sm:max-h-[calc(100dvh-4.5rem)] sm:max-w-6xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div className="sm:hidden border-b border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--ms-text-strong)]">
                {safeFormatDate(date, "EEEE d MMMM")}
              </h2>
              <button type="button" onClick={onClose} className="ms-icon-button shrink-0" aria-label="Fermer"><X size={22} /></button>
            </div>
            <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--ms-text-muted)]">
              {React.cloneElement(summary.trend.icon, { size: 14 })}
              {summary.trend.text}
            </span>
          </div>

          {/* Desktop header */}
          <div className="hidden border-b border-[var(--ms-border)] bg-[var(--ms-white)] px-6 py-5 sm:block">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ms-text-muted)]">Détails du jour</p>
                  <StatusBadge tone="neutral">{transactionCount} transaction{transactionCount !== 1 ? "s" : ""}</StatusBadge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-2">
                  <h2 className="text-2xl font-bold text-[var(--ms-text-strong)]">{safeFormatDate(date)}</h2>
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

          {/* Metric strip — compact, professional */}
          <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-3 sm:grid-cols-3 sm:px-6 sm:py-4 lg:grid-cols-4">
            {metrics.map((m) => (
              <MetricTile key={m.label} {...m} />
            ))}
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
                className={`min-h-[40px] flex-1 rounded-lg px-1.5 text-xs font-semibold transition-colors ${
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
          <div className="grid flex-grow gap-4 overflow-auto overscroll-contain bg-[var(--ms-bg-subtle)] px-4 py-4 sm:grid-cols-3 sm:p-5">
            <div className={activeTab === "sales" ? "" : "hidden sm:block"}>
              <Section
                icon={<ShoppingBag size={18} />}
                accent={ACCENTS.sales}
                title="Ventes"
                count={sales.length}
                total={formatCurrency(totals.totalSales)}
                link={`/sales?date=${formatDateForLink(date)}`}
                emptyText="Aucune vente pour cette journée"
              >
                {sales.map((s, i) => (
                  <TxnCard
                    key={s._id || i}
                    accent={ACCENTS.sales}
                    icon={<ShoppingBag size={16} />}
                    title={`Vente #${s.saleNumber || `T${i + 1}`}`}
                    subtitle={s.client?.name || "Client non spécifié"}
                    time={safeFormatTime(s.createdAt)}
                    amount={formatCurrency(s.totalAmount)}
                    amountTone="success"
                    badges={
                      (s.saleType || "normal") === "wholesale" ? (
                        <StatusBadge tone="warning">Gros</StatusBadge>
                      ) : null
                    }
                  />
                ))}
              </Section>
            </div>

            <div className={activeTab === "expenses" ? "" : "hidden sm:block"}>
              <Section
                icon={<Receipt size={18} />}
                accent={ACCENTS.expenses}
                title="Dépenses"
                count={expenses.length}
                total={formatCurrency(totals.totalExpenses)}
                link={isAdmin ? `/expenses?date=${formatDateForLink(date)}` : null}
                emptyText="Aucune dépense pour cette journée"
              >
                {expenses.map((e, i) => (
                  <TxnCard
                    key={e._id || i}
                    accent={ACCENTS.expenses}
                    icon={<Receipt size={16} />}
                    title={e.description || "Dépense sans description"}
                    subtitle={e.supplier ? `Fourn.: ${e.supplier}` : null}
                    time={safeFormatTime(e.createdAt)}
                    amount={`- ${formatCurrency(e.amount)}`}
                    amountTone="danger"
                    badges={<StatusBadge tone="neutral">{e.category || "Non catégorisé"}</StatusBadge>}
                  />
                ))}
              </Section>
            </div>

            <div className={activeTab === "payments" ? "" : "hidden sm:block"}>
              <Section
                icon={<CreditCard size={18} />}
                accent={ACCENTS.payments}
                title="Encaissements"
                count={payments.length}
                total={formatCurrency(totals.totalPayments)}
                emptyText="Aucun encaissement pour cette journée"
              >
                {payments.map((p, i) => {
                  // Margin per payment is sensitive — only admins see it.
                  const hasProfit = isAdmin && p?.profit !== undefined && p?.profit !== null;
                  return (
                    <TxnCard
                      key={p._id || i}
                      accent={ACCENTS.payments}
                      icon={<CreditCard size={16} />}
                      title={`Paiement #${i + 1}`}
                      subtitle={p.client?.name || "Client non spécifié"}
                      time={safeFormatTime(p.paymentDate)}
                      meta={p.method ? <span className="capitalize">{p.method}</span> : null}
                      amount={formatCurrency(p.amount)}
                      amountTone="blue"
                      profit={hasProfit ? p.profit : undefined}
                      footer={
                        p.saleId ? (
                          <Link to={`/sales/${p.saleId}`} className="inline-flex items-center gap-1 text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] text-xs font-semibold">
                            Voir la vente <ChevronRight size={13} />
                          </Link>
                        ) : null
                      }
                    />
                  );
                })}
              </Section>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <p className="order-2 text-center text-xs text-[var(--ms-text-muted)] sm:order-1 sm:text-left sm:text-sm">
              {transactionCount} transaction{transactionCount !== 1 ? "s" : ""} au total
            </p>
            <div className="order-1 grid w-full grid-cols-3 gap-2 sm:order-2 sm:flex sm:w-auto sm:gap-3">
              <Link to={`/sales?date=${formatDateForLink(date)}`} className="ms-button ms-button-secondary ms-button-sm justify-center"><FileText size={14} /> Ventes</Link>
              {isAdmin ? (
                <Link to={`/expenses?date=${formatDateForLink(date)}`} className="ms-button ms-button-secondary ms-button-sm justify-center"><FileText size={14} /> Dépenses</Link>
              ) : (
                <span className="ms-button ms-button-sm justify-center opacity-40 cursor-not-allowed"><FileText size={14} /> Dépenses</span>
              )}
              <Button variant="primary" size="sm" onClick={onClose}>Fermer</Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ------------------- Metric tile ------------------- */
const MetricTile = ({ label, value, sub, tone = "neutral" }) => {
  const color = TONE_COLORS[tone] || TONE_COLORS.neutral;
  return (
    <div
      className="rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2.5"
      style={{ boxShadow: "inset 3px 0 0 0 " + color }}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums sm:text-base" style={{ color }}>{value}</p>
      {sub && <p className="truncate text-[11px] text-[var(--ms-text-muted)]">{sub}</p>}
    </div>
  );
};

/* ------------------- Transaction card ------------------- */
const TxnCard = ({ accent, icon, title, subtitle, time, meta, amount, amountTone = "neutral", profit, badges, footer }) => {
  const amountColor = TONE_COLORS[amountTone] || TONE_COLORS.neutral;
  const hasProfit = profit !== undefined && profit !== null;
  const profitPositive = Number(profit) >= 0;
  return (
    <div className="group rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 transition-shadow hover:shadow-[var(--ms-shadow)]">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: accent?.bg, color: accent?.fg }}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ms-text-strong)]">{title}</p>
              {subtitle && <p className="mt-0.5 truncate text-xs text-[var(--ms-text-muted)]">{subtitle}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums" style={{ color: amountColor }}>{amount}</p>
              {hasProfit && (
                <span
                  className="mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    background: profitPositive ? "rgba(16,124,16,0.12)" : "rgba(209,52,56,0.10)",
                    color: profitPositive ? "var(--ms-success)" : "var(--ms-danger)",
                  }}
                  title="Marge réalisée sur ce paiement"
                >
                  {profitPositive ? "+" : ""}{Number(profit).toLocaleString("fr-FR")} <span className="opacity-70">marge</span>
                </span>
              )}
            </div>
          </div>
          {(meta || time || badges) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ms-text-muted)]">
              {badges}
              {meta}
              {meta && time && <span aria-hidden>·</span>}
              {time && <span>{time}</span>}
            </div>
          )}
          {footer && <div className="mt-2">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

/* ------------------- Section Helper ------------------- */
const Section = ({ icon, accent, title, count = 0, total, link, children, emptyText }) => (
  <section className="flex min-h-0 flex-col rounded-2xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ms-border)] px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: accent?.bg, color: accent?.fg }}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ms-text-strong)]">
            <span className="truncate">{title}</span>
            <span className="rounded-full bg-[var(--ms-bg-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ms-text-muted)]">{count}</span>
          </h3>
          {total && <p className="truncate text-xs font-semibold tabular-nums text-[var(--ms-text-muted)]">{total}</p>}
        </div>
      </div>
      {link ? (
        <Link to={link} className="ms-button ms-button-secondary ms-button-sm shrink-0"><ChevronRight size={14} /> Voir tout</Link>
      ) : (
        <span className="ms-button ms-button-sm shrink-0 opacity-40 cursor-not-allowed"><ChevronRight size={14} /> Voir tout</span>
      )}
    </div>
    <div className="min-h-0 flex-1 p-3">
      {children?.length ? (
        <div className="space-y-2.5">{children}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-12 text-center">
          <p className="text-sm text-[var(--ms-text-muted)]">{emptyText}</p>
        </div>
      )}
    </div>
  </section>
);

export default DayDetailsModal;
