import { formatCfa } from '../utils/format';
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
  Warehouse,
  Store,
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
          <span
            className="ms-status-badge ms-status-neutral"
            title="Numéro de téléphone manquant"
          >
            <MessageCircle size={14} /> WhatsApp
          </span>
        )}
        {tel && (
          <a href={tel} onClick={(e) => { stop(e); log("call"); }} className="ms-button ms-button-secondary ms-button-sm">
            <Phone size={14} /> Appeler
          </a>
        )}
        <button type="button" onClick={copy} className="ms-button ms-button-secondary ms-button-sm">
          <Copy size={14} /> Copier
        </button>
      </div>
      {remindedAt && (
        <p className="mt-1.5 inline-flex items-center gap-1 fui-caption1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
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
    className="fluent-card-filled p-4 transition-shadow hover:shadow-md"
    style={{ borderColor: color.border }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h4 className="truncate font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>
          {sale.client?.name || "Client inconnu"}
        </h4>
        <p className="fui-caption1">
          Solde restant :{" "}
          <span className="font-medium" style={{ color: 'var(--colorNeutralForeground2)' }}>
            {formatCfa(sale.balance)}
          </span>
        </p>
        {sale.nextPaymentDate && (
          <p className="fui-caption1 mt-1 flex items-center gap-1">
            <CalendarClock size={12} />{" "}
            {new Date(sale.nextPaymentDate).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
      <span className="ms-status-badge shrink-0" style={{ background: color.badgeBg, color: color.badgeFg }}>
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
    className="relative overflow-hidden rounded-[var(--radiusLarge)] p-5 text-white shadow-[var(--shadow16)]"
    style={{ background: 'var(--colorNeutralForeground1)' }}
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
            {formatCfa(Number(employee.salary || 0))}
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

  const qty = Number(reminder.quantityToReplace || 0);
  const lastSale = reminder.lastSaleAt
    ? new Date(reminder.lastSaleAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : "—";

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="flex h-full flex-col fluent-card-filled p-4 transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--colorStatusSuccessStroke1)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 truncate font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>{productName}</h4>
        <span className="ms-status-badge shrink-0" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
          <Warehouse size={11} /> → <Store size={11} />
        </span>
      </div>

      {/* 3-column stat layout */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[var(--radiusMedium)] p-2 text-center" style={{ background: 'var(--colorStatusSuccessBackground1)' }}>
          <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>À remettre</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums leading-none" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{qty.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-[var(--radiusMedium)] p-2 text-center" style={{ background: 'var(--ms-bg-subtle)' }}>
          <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>Stock</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums leading-none" style={{ color: 'var(--colorNeutralForeground1)' }}>{Number(currentStock || 0).toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-[var(--radiusMedium)] p-2 text-center" style={{ background: 'var(--ms-bg-subtle)' }}>
          <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>Dern. vente</p>
          <p className="mt-0.5 text-sm font-bold leading-none" style={{ color: 'var(--colorNeutralForeground1)', paddingTop: 2 }}>{lastSale}</p>
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1 fui-caption1">
        <Warehouse size={12} className="shrink-0" />
        <span className="shrink-0">Source :</span>
        <span className="truncate font-medium" style={{ color: 'var(--colorNeutralForeground2)' }}>{warehouseName}</span>
      </p>

      <button
        type="button"
        onClick={confirmReplacement}
        disabled={confirming}
        className="ms-button ms-button-primary mt-auto w-full"
        style={{ background: 'var(--colorStatusSuccessForeground1)', borderColor: 'var(--colorStatusSuccessForeground1)' }}
      >
        <CheckCircle2 size={16} />
        {confirming ? "Confirmation..." : "Confirmer mis en boutique"}
      </button>
    </motion.article>
  );
};

const FollowUpCard = ({ sale, badge, helperLabel, helperValue, amountLabel, amount, tone, daysSince, shopName, dialCode }) => {
  const toneStyle =
    tone === "rose"
      ? { background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)' }
      : { background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' };

  return (
    <motion.article whileHover={{ y: -2 }} className="fluent-card-filled p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>
            {sale.client?.name || "Client inconnu"}
          </h4>
          <p className="fui-caption1 mt-1">
            {helperLabel} : {helperValue}
          </p>
          <p className="fui-caption1 mt-1">
            {amountLabel} :{" "}
            <span className="font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>
              {formatCfa(Number(amount || 0))}
            </span>
          </p>
        </div>
        <span className="ms-status-badge shrink-0" style={toneStyle}>
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

      <Link to={`/sales/${sale._id}`} className="mt-3 block fui-caption1-strong hover:underline" style={{ color: 'var(--colorNeutralForeground2)' }}>
        Voir la vente
      </Link>
    </motion.article>
  );
};

const RemindersPanel = ({
  overdue = [],
  upcoming = [],
  neverPaid = [],
  stalePartial = [],
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

  // Source = stalePartial (calculé côté backend sur l'historique des
  // paiements) et non plus overdue/upcoming — ces deux listes ne contiennent
  // que les ventes avec un rappel programmé à la main, ce qui laissait
  // invisibles les ventes partiellement payées livrées à elles-mêmes.
  const partialOrders = useMemo(() => {
    return stalePartial.map((sale) => ({
      ...sale,
      lastPayment: getLastPaymentDate(sale.payments || []),
    }));
  }, [stalePartial]);

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

  // Risque par client : une dette de 15 000 CFA répartie sur 3 ventes est
  // aussi prioritaire qu'une seule vente de 15 000 — regrouper par client
  // change qui mérite vraiment d'être relancé en premier.
  const clientRisk = useMemo(() => {
    const byClient = new Map();
    const register = (sale, ageInDays) => {
      const balance = Number(sale.balance || 0);
      if (balance <= 0) return;
      const clientId = sale.client?._id || sale.client?.name || 'unknown';
      const clientName = sale.client?.name || 'Client inconnu';
      const entry = byClient.get(clientId) || {
        clientId,
        clientName,
        clientPhone: sale.client?.phone || '',
        totalBalance: 0,
        saleIds: new Set(),
        oldestAge: 0,
      };
      if (!entry.saleIds.has(sale._id)) {
        entry.saleIds.add(sale._id);
        entry.totalBalance += balance;
        entry.oldestAge = Math.max(entry.oldestAge, ageInDays || 0);
      }
      byClient.set(clientId, entry);
    };

    partialOrders.forEach((sale) => register(sale, sale.daysSincePayment));
    neverPaidOrders.forEach((sale) => register(sale, sale.daysWithoutPayment));

    return Array.from(byClient.values())
      .map((entry) => ({ ...entry, saleCount: entry.saleIds.size }))
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }, [partialOrders, neverPaidOrders]);

  const getColor = (type) =>
    type === "overdue"
      ? {
          border: 'var(--colorStatusDangerStroke1)',
          badgeBg: 'var(--colorStatusDangerBackground1)',
          badgeFg: 'var(--colorStatusDangerForeground1)',
        }
      : {
          border: 'var(--colorStatusWarningStroke1)',
          badgeBg: 'var(--colorStatusWarningBackground1)',
          badgeFg: 'var(--colorStatusWarningForeground1)',
        };

  const tabs = [
    { key: "all", label: "Tous", icon: <Users size={16} />, count: all.length },
    { key: "overdue", label: "En retard", icon: <AlertTriangle size={16} style={{ color: 'var(--colorStatusDangerForeground1)' }} />, count: overdue.length },
    { key: "upcoming", label: "À venir", icon: <Clock size={16} style={{ color: 'var(--colorStatusWarningForeground1)' }} />, count: upcoming.length },
    { key: "salary", label: "Salaires", icon: <Wallet size={16} />, count: salaryReminders.length },
    { key: "stock", label: "Dépôt → boutique", icon: <PackageCheck size={16} style={{ color: 'var(--colorStatusSuccessForeground1)' }} />, count: stockReplacementReminders.length },
  ];

  const sectionLinks = [
    ['#reminders-clients', 'Risque par client', clientRisk.length],
    ['#reminders-tabs', 'Rappels', all.length + salaryReminders.length + stockReplacementReminders.length],
    ['#reminders-partial', 'Paiements partiels', partialSummary.count],
    ['#reminders-never-paid', 'Sans paiement', neverPaidFiltered.length],
  ];

  return (
    <motion.div
      className="fluent-card-filled overflow-hidden"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== HEADER ===== */}
      <div className="border-b border-[var(--ms-border)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="fui-caption1-strong uppercase tracking-[0.16em]" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Recouvrement
            </p>
            <h2 className="fui-title2 mt-1 flex items-center gap-2">
              <BellRing style={{ color: 'var(--colorNeutralForeground2)' }} />
              Gestion des Rappels Clients
            </h2>
            <p className="fui-caption1 mt-1">
              Suivi automatique des paiements clients et rappels planifiés
            </p>
          </div>

          {/* Barre de recherche */}
          <div className="relative flex items-center">
            <Search className="absolute left-3" size={16} style={{ color: 'var(--colorNeutralForeground3)' }} />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control w-full pl-9 text-sm md:w-72"
            />
          </div>
        </div>

        {/* Sommaire interne : la page est longue (rappels + 2 sections de suivi) */}
        <nav aria-label="Sections de ce panneau" className="mt-4 flex flex-wrap gap-2">
          {sectionLinks.map(([href, label, count]) => (
            <a
              key={href}
              href={href}
              className="ms-status-badge ms-status-neutral inline-flex items-center gap-1.5 hover:bg-[var(--ms-bg-subtle)]"
            >
              {label}
              {count > 0 && <span className="font-bold">{count}</span>}
            </a>
          ))}
        </nav>
      </div>

      {/* ===== RISQUE PAR CLIENT ===== */}
      {clientRisk.length > 0 && (
        <div id="reminders-clients" className="scroll-mt-24 border-b border-[var(--ms-border)] p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="fui-subtitle2 flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: 'var(--colorStatusDangerForeground1)' }} />
                Clients à risque
              </h3>
              <p className="fui-caption1 mt-0.5">
                Solde dû total par client, toutes ventes impayées confondues — à traiter avant les relances isolées.
              </p>
            </div>
            <span className="ms-status-badge ms-status-danger w-fit">
              {formatCfa(clientRisk.reduce((sum, c) => sum + c.totalBalance, 0))} au total
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clientRisk.slice(0, 9).map((entry) => {
              const message = buildReminderMessage({
                clientName: entry.clientName,
                shopName,
                balance: entry.totalBalance,
                daysSince: entry.oldestAge,
              });
              const wa = canWhatsApp(entry.clientPhone) ? whatsAppLink(entry.clientPhone, dialCode, message) : '';
              const tel = telLink(entry.clientPhone);
              return (
                <li key={entry.clientId} className="fluent-card-filled p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>{entry.clientName}</p>
                      <p className="fui-caption1 mt-0.5">
                        {entry.saleCount} vente{entry.saleCount > 1 ? 's' : ''} impayée{entry.saleCount > 1 ? 's' : ''} · {entry.oldestAge} j max
                      </p>
                    </div>
                    <span className="ms-status-badge ms-status-danger shrink-0">{formatCfa(entry.totalBalance)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
                        style={{ background: '#25D366' }}
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    ) : (
                      <span className="ms-status-badge ms-status-neutral" title="Numéro de téléphone manquant">
                        <MessageCircle size={14} /> WhatsApp
                      </span>
                    )}
                    {tel && (
                      <a href={tel} className="ms-button ms-button-secondary ms-button-sm">
                        <Phone size={14} /> Appeler
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ===== TABS ===== */}
      <div id="reminders-tabs" className="scroll-mt-24">
      <div className="flex gap-2 overflow-x-auto border-b border-[var(--ms-border)] p-4 sm:p-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`ms-button min-h-[42px] shrink-0 ${activeTab === tab.key ? 'ms-button-primary' : 'ms-button-secondary'}`}
            aria-pressed={activeTab === tab.key}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span
              className="ms-status-badge"
              style={
                activeTab === tab.key
                  ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                  : { background: 'var(--ms-bg-subtle)', color: 'var(--colorNeutralForeground2)' }
              }
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
              <div className="col-span-full flex flex-col items-center rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-10 text-center">
                <Wallet className="mb-2 h-10 w-10 opacity-60" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <p className="fui-caption1">Aucun salaire à payer aujourd'hui</p>
              </div>
            )
          ) : activeTab === "stock" ? (
            stockReplacementReminders.length > 0 ? (
              <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stockReplacementReminders.map((reminder) => (
                  <StockReplacementCard
                    key={reminder._id}
                    reminder={reminder}
                    onConfirmed={onStockReplacementConfirmed}
                  />
                ))}
              </div>
            ) : (
              <div className="col-span-full flex flex-col items-center rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-10 text-center">
                <PackageCheck className="mb-2 h-10 w-10 opacity-60" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <p className="fui-caption1">Aucun transfert dépôt → boutique à confirmer</p>
              </div>
            )
          ) : filtered.length > 0 ? (
            filtered.map((sale) => (
              <Link key={sale._id} to={`/sales/${sale._id}`}>
                <ReminderCard
                  sale={sale}
                  color={overdue.includes(sale) ? getColor("overdue") : getColor("upcoming")}
                  label={overdue.includes(sale) ? "EN RETARD" : "À VENIR"}
                />
              </Link>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-10 text-center">
              <BellRing className="mb-2 h-10 w-10 opacity-60" style={{ color: 'var(--colorNeutralForeground3)' }} />
              <p className="fui-caption1">Aucun rappel trouvé pour ce filtre</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* ===== PARTIAL ORDERS FILTER ===== */}
      <div id="reminders-partial" className="scroll-mt-24 space-y-4 border-t border-[var(--ms-border)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="fui-subtitle2 flex items-center gap-2">
              <Filter size={16} style={{ color: 'var(--colorNeutralForeground3)' }} />
              Ventes partiellement payées sans paiement récent
            </h3>
            <p className="fui-caption1 mt-0.5">
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
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recovery KPIs */}
        {partialSummary.count > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
              <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>À recouvrer</p>
              <p className="mt-0.5 text-sm font-bold" style={{ color: 'var(--colorNeutralForeground1)' }}>{formatCfa(partialSummary.total)}</p>
            </div>
            <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
              <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>Clients</p>
              <p className="mt-0.5 text-sm font-bold" style={{ color: 'var(--colorNeutralForeground1)' }}>{partialSummary.count}</p>
            </div>
            <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
              <p className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>Plus ancien</p>
              <p className="mt-0.5 text-sm font-bold" style={{ color: 'var(--colorNeutralForeground1)' }}>{partialSummary.oldest} j</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {partialFiltered.length > 0 ? (
            partialFiltered.map((sale) => (
              <FollowUpCard
                key={sale._id}
                sale={sale}
                badge={`${sale.daysSincePayment} j`}
                helperLabel="Dernier paiement"
                helperValue={
                  sale.lastPayment
                    ? sale.lastPayment.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
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
            <div className="col-span-full rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-8 text-center">
              <p className="fui-caption1">Aucune vente partiellement payée pour ce délai</p>
            </div>
          )}
        </div>
      </div>

      <div id="reminders-never-paid" className="scroll-mt-24 space-y-4 border-t border-[var(--ms-border)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="fui-subtitle2 flex items-center gap-2">
              <Filter size={16} style={{ color: 'var(--colorStatusDangerForeground1)' }} />
              Ventes sans paiement
            </h3>
            <p className="fui-caption1 mt-0.5">
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
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {neverPaidFiltered.length > 0 ? (
            neverPaidFiltered.map((sale) => (
              <FollowUpCard
                key={sale._id}
                sale={sale}
                badge={`${sale.daysWithoutPayment} j`}
                helperLabel="Créée le"
                helperValue={
                  sale.saleDate
                    ? new Date(sale.saleDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
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
            <div className="col-span-full rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-8 text-center">
              <p className="fui-caption1">Aucune vente sans paiement pour ce délai</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RemindersPanel;
