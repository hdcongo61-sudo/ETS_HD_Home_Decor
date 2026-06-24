import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  BellRing,
  Search,
  Filter,
  CalendarClock,
  Users,
  Wallet,
  PackageCheck,
  MessageCircle,
  Phone,
  Copy,
} from "lucide-react";
import api from "../services/api";
import { employeePayrollNewPath } from "../utils/paths";
import {
  buildReminderMessage,
  whatsAppLink,
  telLink,
  canWhatsApp,
  recordReminder,
  formatReminderAgo,
} from "../utils/clientReminder";

// Action row: WhatsApp reminder, call, copy message. Stops propagation so it
// can live inside a clickable card without triggering navigation. Logs each
// follow-up and shows when the client was last reminded.
const ReminderActions = ({ sale, balance, daysSince, lastPaymentLabel, shopName, dialCode }) => {
  const [remindedAt, setRemindedAt] = React.useState(sale.lastRemindedAt || null);
  const phone = sale.client?.phone || "";
  const message = buildReminderMessage({
    clientName: sale.client?.name,
    shopName,
    balance,
    lastPaymentLabel,
    daysSince,
  });
  const wa = canWhatsApp(phone) ? whatsAppLink(phone, dialCode, message) : "";
  const tel = telLink(phone);

  const log = (channel) => { recordReminder(sale._id, channel); setRemindedAt(new Date().toISOString()); };
  const stop = (e) => e.stopPropagation();
  const copy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(message)
      .then(() => { toast.success("Message copié"); log("manual"); })
      .catch(() => toast.error("Copie impossible"));
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { stop(e); log("whatsapp"); }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
            style={{ background: "#25D366" }}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400 dark:bg-gray-800" title="Numéro de téléphone manquant">
            <MessageCircle size={14} /> WhatsApp
          </span>
        )}
        {tel && (
          <a
            href={tel}
            onClick={(e) => { stop(e); log("call"); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Phone size={14} /> Appeler
          </a>
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Copy size={14} /> Copier
        </button>
      </div>
      {remindedAt && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
          <CheckCircle2 size={12} /> Relancé {formatReminderAgo(remindedAt)}
        </p>
      )}
    </>
  );
};

const ReminderCard = ({ sale, color, label }) => (
  <motion.div
    whileHover={{ y: -2 }}
    transition={{ type: "spring", stiffness: 250, damping: 14 }}
    className={`group rounded-[22px] border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-gray-900 ${color.border}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h4 className="truncate font-semibold text-gray-950 dark:text-white">
          {sale.client?.name || "Client inconnu"}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Solde restant :{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {sale.balance?.toLocaleString("fr-FR")} CFA
          </span>
        </p>
        {sale.nextPaymentDate && (
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <CalendarClock size={12} />{" "}
            {new Date(sale.nextPaymentDate).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${color.badge}`}
      >
        {label}
      </span>
    </div>
  </motion.div>
);

const getLastPaymentDate = (payments = []) => {
  let last = null;
  payments.forEach((p) => {
    const dt = p?.paymentDate || p?.createdAt;
    if (!dt) return;
    const time = new Date(dt).getTime();
    if (!Number.isFinite(time)) return;
    if (!last || time > last.getTime()) {
      last = new Date(time);
    }
  });
  return last;
};

const SalaryReminderCard = ({ employee }) => (
  <motion.div
    whileHover={{ scale: 1.015, y: -2 }}
    transition={{ type: "spring", stiffness: 260, damping: 18 }}
    className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 p-5 text-white shadow-[0_16px_42px_rgba(15,23,42,0.18)]"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="truncate font-semibold">{employee.name || "Employé"}</h4>
        <p className="mt-1 text-sm text-white/70">
          {employee.position || "Poste non renseigné"}
          {employee.department ? ` · ${employee.department}` : ""}
        </p>
        <p className="mt-3 text-sm text-white/75">
          Salaire prévu :{" "}
          <span className="font-semibold text-white">
            {Number(employee.salary || 0).toLocaleString("fr-FR")} CFA
          </span>
        </p>
      </div>
      <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs font-semibold text-white">
        Aujourd'hui
      </span>
    </div>
    <div className="mt-4 text-xs font-semibold text-white/80 group-hover:underline">
      Créer la fiche de paie
    </div>
  </motion.div>
);

const StockReplacementCard = ({ reminder, onConfirmed }) => {
  const [confirming, setConfirming] = React.useState(false);
  const product = reminder.product || {};
  const productName = product.name || reminder.productName || "Produit";
  const currentStock = product.stock ?? reminder.currentStock ?? 0;
  const warehouseName = product.warehouse || reminder.warehouseName || "Dépôt non défini";

  const confirmReplacement = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (confirming) return;

    try {
      setConfirming(true);
      await api.post(`/stock-replacement-reminders/${reminder._id}/confirm`);
      toast.success("Transfert dépôt → boutique confirmé");
      onConfirmed?.(reminder._id);
    } catch (error) {
      toast.error(error.response?.data?.message || "Confirmation impossible");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="rounded-[22px] border border-emerald-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-emerald-500/20 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-gray-950 dark:text-white">{productName}</h4>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            À remettre en boutique :{" "}
            <span className="font-semibold text-gray-950 dark:text-white">
              {Number(reminder.quantityToReplace || 0).toLocaleString("fr-FR")}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Source : {warehouseName}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Stock actuel indicatif : {Number(currentStock || 0).toLocaleString("fr-FR")}
          </p>
          {reminder.lastSaleAt && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Dernière vente : {new Date(reminder.lastSaleAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Dépôt → boutique
        </span>
      </div>

      <button
        type="button"
        onClick={confirmReplacement}
        disabled={confirming}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 size={16} />
        {confirming ? "Confirmation..." : "Confirmer mis en boutique"}
      </button>
    </motion.article>
  );
};

const FollowUpCard = ({ sale, badge, helperLabel, helperValue, amountLabel, amount, tone, daysSince, shopName, dialCode }) => {
  const toneClass =
    tone === "rose"
      ? "border-[var(--ms-danger)]/20 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
      : "border-[var(--ms-warning)]/20 bg-[var(--ms-warning)]/10 text-amber-700 dark:border-amber-500/20 dark:bg-[var(--ms-warning)]/100/10 dark:text-amber-300";

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-gray-950 dark:text-white">
            {sale.client?.name || "Client inconnu"}
          </h4>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {helperLabel} : {helperValue}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {amountLabel} :{" "}
            <span className="font-semibold text-gray-950 dark:text-white">
              {Number(amount || 0).toLocaleString("fr-FR")} CFA
            </span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
          {badge}
        </span>
      </div>

      <ReminderActions
        sale={sale}
        balance={amount}
        daysSince={daysSince}
        lastPaymentLabel={helperValue}
        shopName={shopName}
        dialCode={dialCode}
      />

      <Link to={`/sales/${sale._id}`} className="mt-3 block text-xs font-semibold text-gray-600 hover:underline dark:text-gray-300">
        Voir la vente
      </Link>
    </motion.article>
  );
};

const RemindersPanel = ({
  overdue = [],
  upcoming = [],
  neverPaid = [],
  salaryReminders = [],
  stockReplacementReminders = [],
  onStockReplacementConfirmed = () => {},
  shopName = "",
  dialCode = "",
}) => {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [partialAgeFilter, setPartialAgeFilter] = useState("10");
  const [neverPaidAgeFilter, setNeverPaidAgeFilter] = useState("7");
  const [partialSort, setPartialSort] = useState("age"); // age | amount

  const all = useMemo(() => [...overdue, ...upcoming], [overdue, upcoming]);

  const filtered = useMemo(() => {
    let data =
      activeTab === "overdue"
        ? overdue
        : activeTab === "upcoming"
        ? upcoming
        : all;

    if (search.trim()) {
      const query = search.toLowerCase();
      data = data.filter((s) =>
        (s.client?.name || "").toLowerCase().includes(query)
      );
    }
    return data;
  }, [activeTab, all, overdue, upcoming, search]);

  const partialAgeOptions = [
    { key: "10", label: "10 jours +", minDays: 10 },
    { key: "15", label: "15 jours +", minDays: 15 },
    { key: "20", label: "20 jours +", minDays: 20 },
    { key: "30", label: "30 jours et +", minDays: 30 },
  ];
  const neverPaidAgeOptions = [
    { key: "3", label: "3 jours +", minDays: 3 },
    { key: "7", label: "7 jours +", minDays: 7 },
    { key: "15", label: "15 jours +", minDays: 15 },
    { key: "30", label: "30 jours et +", minDays: 30 },
  ];

  const partialAgeMin =
    partialAgeOptions.find((opt) => opt.key === partialAgeFilter)?.minDays || 10;
  const neverPaidAgeMin =
    neverPaidAgeOptions.find((opt) => opt.key === neverPaidAgeFilter)?.minDays || 7;

  const partialOrders = useMemo(() => {
    const now = Date.now();
    return all
      .map((sale) => {
        const payments = sale.payments || [];
        const lastPayment = getLastPaymentDate(payments);
        if (!lastPayment) return null;
        const totalPaid =
          sale.totalPaid ??
          payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const balance =
          sale.balance ??
          Math.max(0, (sale.totalAmount || 0) - totalPaid);
        if (balance <= 0 || totalPaid <= 0) return null;
        const daysSincePayment = Math.max(
          0,
          Math.floor((now - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
        );
        return {
          ...sale,
          totalPaid,
          balance,
          lastPayment,
          daysSincePayment,
        };
      })
      .filter(Boolean);
  }, [all]);

  const partialFiltered = useMemo(() => {
    let data = partialOrders.filter((sale) => sale.daysSincePayment >= partialAgeMin);
    if (search.trim()) {
      const query = search.toLowerCase();
      data = data.filter((s) =>
        (s.client?.name || "").toLowerCase().includes(query)
      );
    }
    const sorter =
      partialSort === "amount"
        ? (a, b) => (b.balance || 0) - (a.balance || 0)
        : (a, b) => b.daysSincePayment - a.daysSincePayment;
    return [...data].sort(sorter);
  }, [partialAgeMin, partialOrders, search, partialSort]);

  // Recovery summary for the partial section.
  const partialSummary = useMemo(() => {
    const total = partialFiltered.reduce((s, sale) => s + (sale.balance || 0), 0);
    const oldest = partialFiltered.reduce((m, sale) => Math.max(m, sale.daysSincePayment || 0), 0);
    return { total, count: partialFiltered.length, oldest };
  }, [partialFiltered]);

  const neverPaidOrders = useMemo(() => {
    const now = Date.now();
    return (neverPaid || [])
      .map((sale) => {
        const totalPaid =
          sale.totalPaid ??
          (sale.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
        if (totalPaid > 0) return null;
        const saleDate = sale.saleDate ? new Date(sale.saleDate) : null;
        if (!saleDate || Number.isNaN(saleDate.getTime())) return null;
        const daysWithoutPayment = Math.max(
          0,
          Math.floor((now - saleDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        return {
          ...sale,
          totalPaid,
          balance: sale.balance ?? Math.max(0, (sale.totalAmount || 0) - totalPaid),
          daysWithoutPayment,
        };
      })
      .filter(Boolean);
  }, [neverPaid]);

  const neverPaidFiltered = useMemo(() => {
    let data = neverPaidOrders.filter((sale) => sale.daysWithoutPayment >= neverPaidAgeMin);
    if (search.trim()) {
      const query = search.toLowerCase();
      data = data.filter((s) =>
        (s.client?.name || "").toLowerCase().includes(query)
      );
    }
    return data.sort((a, b) => b.daysWithoutPayment - a.daysWithoutPayment);
  }, [neverPaidAgeMin, neverPaidOrders, search]);

  const getColor = (type) =>
    type === "overdue"
      ? {
          text: "text-red-700 dark:text-red-300",
          border: "border-[var(--ms-danger)]/20 dark:border-rose-500/20",
          badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
        }
      : {
          text: "text-orange-700 dark:text-orange-300",
          border: "border-[var(--ms-warning)]/20 dark:border-amber-500/20",
          badge: "bg-[var(--ms-warning)]/10 text-amber-700 dark:bg-[var(--ms-warning)]/100/10 dark:text-amber-300",
        };

  const tabs = [
    {
      key: "all",
      label: "Tous",
      icon: <Users size={16} />,
      count: all.length,
    },
    {
      key: "overdue",
      label: "En retard",
      icon: <AlertTriangle size={16} className="text-red-500" />,
      count: overdue.length,
    },
    {
      key: "upcoming",
      label: "À venir",
      icon: <Clock size={16} className="text-orange-500" />,
      count: upcoming.length,
    },
    {
      key: "salary",
      label: "Salaires",
      icon: <Wallet size={16} className="text-gray-700" />,
      count: salaryReminders.length,
    },
    {
      key: "stock",
      label: "Dépôt → boutique",
      icon: <PackageCheck size={16} className="text-emerald-600" />,
      count: stockReplacementReminders.length,
    },
  ];

  return (
    <motion.div
      className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-gray-800 dark:bg-gray-900"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== HEADER ===== */}
      <div className="border-b border-gray-100 p-4 dark:border-gray-800 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
            Recouvrement
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-bold tracking-tight text-gray-950 dark:text-white">
            <BellRing className="text-gray-700 dark:text-gray-200" />
            Gestion des Rappels Clients
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Suivi automatique des paiements clients et rappels planifiés
          </p>
        </div>

        {/* Barre de recherche */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-control w-full pl-9 text-sm md:w-72"
          />
        </div>
      </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-100 p-4 dark:border-gray-800 sm:p-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex min-h-[42px] shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all
              ${
                activeTab === tab.key
                  ? "bg-gray-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)] dark:bg-white dark:text-gray-950"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
              }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ===== CONTENT ===== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3"
        >
          {activeTab === "salary" ? (
            salaryReminders.length > 0 ? (
              salaryReminders.map((employee) => (
                <Link key={employee._id} to={employeePayrollNewPath(employee)} className="group">
                  <SalaryReminderCard employee={employee} />
                </Link>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
                <Wallet className="w-10 h-10 mb-2 opacity-60" />
                <p>Aucun salaire à payer aujourd'hui</p>
              </div>
            )
          ) : activeTab === "stock" ? (
            stockReplacementReminders.length > 0 ? (
              stockReplacementReminders.map((reminder) => (
                <StockReplacementCard
                  key={reminder._id}
                  reminder={reminder}
                  onConfirmed={onStockReplacementConfirmed}
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
                <PackageCheck className="w-10 h-10 mb-2 opacity-60" />
                <p>Aucun transfert dépôt → boutique à confirmer</p>
              </div>
            )
          ) : filtered.length > 0 ? (
            filtered.map((sale) => (
              <Link key={sale._id} to={`/sales/${sale._id}`}>
                <ReminderCard
                  sale={sale}
                  color={
                    overdue.includes(sale)
                      ? getColor("overdue")
                      : getColor("upcoming")
                  }
                  label={
                    overdue.includes(sale) ? "EN RETARD" : "À VENIR"
                  }
                />
              </Link>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
              <BellRing className="w-10 h-10 mb-2 opacity-60" />
              <p>Aucun rappel trouvé pour ce filtre</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ===== PARTIAL ORDERS FILTER ===== */}
      <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-800 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-gray-950 dark:text-white">
              <Filter size={16} className="text-gray-500" />
              Ventes partiellement payées sans paiement récent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtrer par délai depuis le dernier paiement enregistré
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={partialSort}
              onChange={(e) => setPartialSort(e.target.value)}
              className="form-control text-sm"
              aria-label="Trier"
            >
              <option value="age">Trier : plus ancien</option>
              <option value="amount">Trier : plus gros solde</option>
            </select>
            <select
              value={partialAgeFilter}
              onChange={(e) => setPartialAgeFilter(e.target.value)}
              className="form-control text-sm"
              aria-label="Filtre délai paiement"
            >
              {partialAgeOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recovery KPIs */}
        {partialSummary.count > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">À recouvrer</p>
              <p className="mt-0.5 text-sm font-bold text-gray-950 dark:text-white">{partialSummary.total.toLocaleString("fr-FR")} CFA</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Clients</p>
              <p className="mt-0.5 text-sm font-bold text-gray-950 dark:text-white">{partialSummary.count}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Plus ancien</p>
              <p className="mt-0.5 text-sm font-bold text-gray-950 dark:text-white">{partialSummary.oldest} j</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {partialFiltered.length > 0 ? (
            partialFiltered.map((sale) => (
              <FollowUpCard
                key={sale._id}
                sale={sale}
                badge={`${sale.daysSincePayment} j`}
                helperLabel="Dernier paiement"
                helperValue={
                  sale.lastPayment
                    ? sale.lastPayment.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "N/A"
                }
                amountLabel="Solde restant"
                amount={sale.balance}
                daysSince={sale.daysSincePayment}
                shopName={shopName}
                dialCode={dialCode}
                tone="amber"
              />
            ))
          ) : (
            <div className="col-span-full rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
              Aucune vente partiellement payée pour ce délai
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-800 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-gray-950 dark:text-white">
              <Filter size={16} className="text-rose-500" />
              Ventes sans paiement
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtrer par délai depuis la création de la vente sans aucun paiement
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={neverPaidAgeFilter}
              onChange={(e) => setNeverPaidAgeFilter(e.target.value)}
              className="form-control text-sm"
              aria-label="Filtre délai sans paiement"
            >
              {neverPaidAgeOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {neverPaidFiltered.length > 0 ? (
            neverPaidFiltered.map((sale) => (
              <FollowUpCard
                key={sale._id}
                sale={sale}
                badge={`${sale.daysWithoutPayment} j`}
                helperLabel="Créée le"
                helperValue={
                  sale.saleDate
                    ? new Date(sale.saleDate).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "N/A"
                }
                amountLabel="Montant"
                amount={sale.totalAmount}
                daysSince={sale.daysWithoutPayment}
                shopName={shopName}
                dialCode={dialCode}
                tone="rose"
              />
            ))
          ) : (
            <div className="col-span-full rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
              Aucune vente sans paiement pour ce délai
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RemindersPanel;
