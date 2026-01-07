import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  BellRing,
  Search,
  Filter,
  CalendarClock,
  Users,
} from "lucide-react";

const ReminderCard = ({ sale, color, label }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    transition={{ type: "spring", stiffness: 250, damping: 14 }}
    className={`relative group overflow-hidden p-5 rounded-2xl border-l-4 ${color.border} 
                ${color.bg} backdrop-blur-sm border border-gray-200/40 
                shadow-sm dark:border-gray-700/40 hover:shadow-md transition-all`}
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br from-white to-transparent transition-opacity duration-300"></div>

    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <h4 className={`font-semibold ${color.text}`}>
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
        className={`text-xs px-2 py-1 rounded-full font-medium tracking-wide ${color.badge}`}
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

const RemindersPanel = ({ overdue = [], upcoming = [] }) => {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [partialAgeFilter, setPartialAgeFilter] = useState("10");

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

  const partialAgeMin =
    partialAgeOptions.find((opt) => opt.key === partialAgeFilter)?.minDays || 10;

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
    return data.sort((a, b) => b.daysSincePayment - a.daysSincePayment);
  }, [partialAgeMin, partialOrders, search]);

  const getColor = (type) =>
    type === "overdue"
      ? {
          bg: "bg-red-50/70 dark:bg-red-900/30",
          text: "text-red-700 dark:text-red-300",
          border: "border-red-500/70",
          badge: "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100",
        }
      : {
          bg: "bg-orange-50/70 dark:bg-orange-900/30",
          text: "text-orange-700 dark:text-orange-300",
          border: "border-orange-400/70",
          badge: "bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-100",
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
  ];

  return (
    <motion.div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-lg p-6 space-y-6"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BellRing className="text-blue-600 dark:text-blue-400" />
            Gestion des Rappels Clients
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
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
            className="pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 
                       bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72"
          />
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-3 mt-4 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all
              ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
          className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filtered.length > 0 ? (
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
            <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <BellRing className="w-10 h-10 mb-2 opacity-60" />
              <p>Aucun rappel trouvé pour ce filtre</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ===== PARTIAL ORDERS FILTER ===== */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Filter size={16} className="text-indigo-500" />
              Ventes partiellement payées sans paiement récent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtrer par délai depuis le dernier paiement enregistré
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={partialAgeFilter}
              onChange={(e) => setPartialAgeFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {partialFiltered.length > 0 ? (
            partialFiltered.map((sale) => (
              <Link key={sale._id} to={`/sales/${sale._id}`} className="group">
                <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {sale.client?.name || "Client inconnu"}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Dernier paiement :{" "}
                        {sale.lastPayment
                          ? sale.lastPayment.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "N/A"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Solde restant :{" "}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {sale.balance?.toLocaleString("fr-FR")} CFA
                        </span>
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
                      {sale.daysSincePayment} j
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                    Voir la vente
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              Aucune vente partiellement payée pour ce délai
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RemindersPanel;
