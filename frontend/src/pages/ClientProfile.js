import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import AppLoader from '../components/AppLoader';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { getPaymentStructureKey } from '../utils/saleUtils';

const PROFILE_GENDER_LABELS = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  unknown: 'Non renseigné'
};

const ALERT_STYLES = {
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
  green: 'bg-green-50 border-green-200 text-green-800'
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Espèces',
  MobileMoney: 'Mobile Money',
  credit: 'Crédit'
};

const formatGenderLabel = (gender) => PROFILE_GENDER_LABELS[gender] || PROFILE_GENDER_LABELS.unknown;

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const returnToClients = location.state?.returnToClients || queryParams.get('returnToClients') || '/clients';
  const [client, setClient] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    totalSpent: 0,
    purchaseCount: 0,
    lastPurchaseDate: null,
    lastPaymentDate: null,
    averagePurchase: 0,
    totalOutstanding: 0,
    unpaidSalesCount: 0,
    wholesaleCount: 0,
    wholesaleAmount: 0,
    singlePaymentCount: 0,
    singlePaymentAmount: 0,
    multiplePaymentCount: 0,
    multiplePaymentAmount: 0,
    averageItemsPerSale: 0,
    averagePurchaseGapDays: null,
    favoritePaymentMethod: null,
    bestMonthLabel: null,
  });

  // --- Fetch client + sales ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientRes, salesRes] = await Promise.all([
          api.get(`/clients/${id}`),
          api.get(`/sales?client=${id}`)
        ]);

        const c = clientRes.data;
        const s = salesRes.data;
        setClient(c);
        setPurchases(s);

        const totalSpent = s.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const purchaseCount = s.length;
        const lastPurchaseDate = purchaseCount > 0
          ? new Date(Math.max(...s.map((x) => new Date(x.saleDate))))
          : null;
        const allPayments = s.flatMap((sale) => sale.payments || []);
        const totalOutstanding = s.reduce((sum, sale) => {
          const saleTotal = Number(sale.totalAmount) || 0;
          const paid = (sale.payments || []).reduce((paymentSum, payment) => paymentSum + (Number(payment.amount) || 0), 0);
          return sum + Math.max(saleTotal - paid, 0);
        }, 0);
        const unpaidSalesCount = s.filter((sale) => {
          const saleTotal = Number(sale.totalAmount) || 0;
          const paid = (sale.payments || []).reduce((paymentSum, payment) => paymentSum + (Number(payment.amount) || 0), 0);
          return Math.max(saleTotal - paid, 0) > 0;
        }).length;
        const lastPaymentDate = allPayments.length > 0
          ? new Date(Math.max(...allPayments.map((p) => new Date(p.paymentDate))))
          : null;
        const averagePurchase = purchaseCount ? totalSpent / purchaseCount : 0;
        const wholesaleSales = s.filter((sale) => (sale.saleType || 'normal') === 'wholesale');
        const wholesaleCount = wholesaleSales.length;
        const wholesaleAmount = wholesaleSales.reduce((sum, sale) => sum + (Number(sale.totalAmount) || 0), 0);

        const paymentStructureStats = s.reduce((acc, sale) => {
          const key = getPaymentStructureKey(sale);
          const totalAmount = Number(sale.totalAmount) || 0;
          acc[key].count += 1;
          acc[key].amount += totalAmount;
          return acc;
        }, {
          full_payment: { count: 0, amount: 0 },
          multiple_payments: { count: 0, amount: 0 },
          pending_payment: { count: 0, amount: 0 },
        });

        const paymentMethodStats = allPayments.reduce((acc, payment) => {
          const method = payment?.method || 'cash';
          if (!acc[method]) {
            acc[method] = { count: 0, amount: 0 };
          }
          acc[method].count += 1;
          acc[method].amount += Number(payment.amount) || 0;
          return acc;
        }, {});

        const favoritePaymentMethodEntry = Object.entries(paymentMethodStats)
          .sort((a, b) => b[1].amount - a[1].amount || b[1].count - a[1].count)[0];

        const bestMonthMap = s.reduce((acc, sale) => {
          const date = new Date(sale.saleDate);
          const key = `${date.getFullYear()}-${date.getMonth()}`;
          if (!acc[key]) {
            acc[key] = {
              label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
              total: 0,
            };
          }
          acc[key].total += Number(sale.totalAmount) || 0;
          return acc;
        }, {});

        const bestMonthEntry = Object.values(bestMonthMap).sort((a, b) => b.total - a.total)[0];

        const totalItems = s.reduce((sum, sale) => (
          sum + (sale.products || []).reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0)
        ), 0);
        const averageItemsPerSale = purchaseCount ? totalItems / purchaseCount : 0;

        const sortedPurchaseDates = [...s]
          .map((sale) => new Date(sale.saleDate))
          .sort((a, b) => a - b);
        const averagePurchaseGapDays = sortedPurchaseDates.length > 1
          ? sortedPurchaseDates.slice(1).reduce((sum, currentDate, index) => {
              const previousDate = sortedPurchaseDates[index];
              const diffDays = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
              return sum + diffDays;
            }, 0) / (sortedPurchaseDates.length - 1)
          : null;

        setStats({
          totalSpent,
          purchaseCount,
          lastPurchaseDate,
          lastPaymentDate,
          averagePurchase,
          totalOutstanding,
          unpaidSalesCount,
          wholesaleCount,
          wholesaleAmount,
          singlePaymentCount: paymentStructureStats.full_payment.count,
          singlePaymentAmount: paymentStructureStats.full_payment.amount,
          multiplePaymentCount: paymentStructureStats.multiple_payments.count,
          multiplePaymentAmount: paymentStructureStats.multiple_payments.amount,
          averageItemsPerSale,
          averagePurchaseGapDays,
          favoritePaymentMethod: favoritePaymentMethodEntry
            ? {
                key: favoritePaymentMethodEntry[0],
                label: PAYMENT_METHOD_LABELS[favoritePaymentMethodEntry[0]] || favoritePaymentMethodEntry[0],
                amount: favoritePaymentMethodEntry[1].amount,
                count: favoritePaymentMethodEntry[1].count,
              }
            : null,
          bestMonthLabel: bestMonthEntry?.label || null,
        });
      } catch (err) {
        console.error('Erreur client:', err);
        setError("Impossible de charger les données du client.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const notifications = useMemo(() => {
    const alerts = [];
    const now = new Date();
    const thresholdDays = 60;
    const spendingLimit = 1000000;

    if (stats.lastPurchaseDate) {
      const diffDays = Math.floor((now - new Date(stats.lastPurchaseDate)) / (1000 * 60 * 60 * 24));
      if (diffDays > thresholdDays) {
        alerts.push({
          type: 'warning',
          title: 'Client inactif',
          message: `Ce client n’a pas effectué d’achat depuis ${diffDays} jours.`,
          color: 'yellow'
        });
      }
    } else {
      alerts.push({
        type: 'info',
        title: 'Aucun achat',
        message: "Ce client n’a encore effectué aucun achat.",
        color: 'gray'
      });
    }

    if (stats.totalSpent > spendingLimit) {
      alerts.push({
        type: 'success',
        title: 'Client Premium 💎',
        message: `Ce client a dépassé ${spendingLimit.toLocaleString('fr-FR')} CFA de dépenses cumulées.`,
        color: 'green'
      });
    }

    if (stats.totalOutstanding > 0) {
      alerts.push({
        type: 'warning',
        title: 'Solde restant à suivre',
        message: `${stats.totalOutstanding.toLocaleString('fr-FR')} CFA restent à encaisser sur ${stats.unpaidSalesCount} vente${stats.unpaidSalesCount > 1 ? 's' : ''}.`,
        color: 'yellow'
      });
    }

    return alerts;
  }, [stats]);

  const insightCards = useMemo(() => ([
    {
      label: 'Vente en gros',
      value: `${stats.wholesaleAmount.toLocaleString('fr-FR')} CFA`,
      helper: `${stats.wholesaleCount} vente${stats.wholesaleCount > 1 ? 's' : ''}`,
      classes: 'bg-amber-50 border-amber-100 text-amber-700'
    },
    {
      label: 'Paiement unique',
      value: `${stats.singlePaymentAmount.toLocaleString('fr-FR')} CFA`,
      helper: `${stats.singlePaymentCount} vente${stats.singlePaymentCount > 1 ? 's' : ''}`,
      classes: 'bg-emerald-50 border-emerald-100 text-emerald-700'
    },
    {
      label: 'Paiements multiples',
      value: `${stats.multiplePaymentAmount.toLocaleString('fr-FR')} CFA`,
      helper: `${stats.multiplePaymentCount} vente${stats.multiplePaymentCount > 1 ? 's' : ''}`,
      classes: 'bg-indigo-50 border-indigo-100 text-indigo-700'
    },
    {
      label: 'Solde restant',
      value: `${stats.totalOutstanding.toLocaleString('fr-FR')} CFA`,
      helper: `${stats.unpaidSalesCount} vente${stats.unpaidSalesCount > 1 ? 's' : ''} à suivre`,
      classes: 'bg-rose-50 border-rose-100 text-rose-700'
    },
    {
      label: 'Mode favori',
      value: stats.favoritePaymentMethod?.label || '—',
      helper: stats.favoritePaymentMethod
        ? `${stats.favoritePaymentMethod.amount.toLocaleString('fr-FR')} CFA encaissés`
        : 'Aucun paiement enregistré',
      classes: 'bg-sky-50 border-sky-100 text-sky-700'
    },
    {
      label: 'Rythme moyen',
      value: stats.averagePurchaseGapDays !== null ? `${Math.round(stats.averagePurchaseGapDays)} j` : '—',
      helper: stats.bestMonthLabel
        ? `Mois fort : ${stats.bestMonthLabel}`
        : 'Pas assez d’historique',
      classes: 'bg-violet-50 border-violet-100 text-violet-700'
    }
  ]), [stats]);

  const handleCopy = async (number) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur de copie:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <AppLoader fullScreen={false} text="Chargement du profil client…" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-red-600 font-semibold mb-4">{error || "Client introuvable"}</p>
        <Link to={returnToClients} className="text-blue-600 hover:underline">
          ← Retour à la liste des clients
        </Link>
      </div>
    );
  }

  // --- Graph Data ---
  const chartData = purchases.map((p) => ({
    date: formatDate(p.saleDate),
    total: p.totalAmount,
  }));

  const monthsSpending = Object.values(
    purchases.reduce((acc, sale) => {
      const month = new Date(sale.saleDate).toLocaleString('fr-FR', { month: 'short', year: '2-digit' });
      if (!acc[month]) acc[month] = { month, total: 0 };
      acc[month].total += sale.totalAmount;
      return acc;
    }, {})
  );

  // --- UI ---
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to={returnToClients} className="p-2 rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-3xl font-semibold text-gray-900">Profil du client</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {client.phone && (
            <>
              <a href={`tel:${client.phone}`} className="px-3 py-2 bg-white border rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2">📞 Appeler</a>
              <a
                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                💬 WhatsApp
              </a>
            </>
          )}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-gray-100 border rounded-lg hover:bg-gray-200"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* 🔔 Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((n, i) => (
            <div key={i} className={`p-4 rounded-xl border ${ALERT_STYLES[n.color] || ALERT_STYLES.gray}`}>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm">{n.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* CLIENT INFO CARD */}
      <div className="bg-white p-6 rounded-3xl shadow border space-y-6">
        {/* Header Info */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{client.name}</h2>
              <p className="text-gray-600">{client.email || '—'}</p>
              <p className="text-sm text-gray-600 mt-1">
                Genre : <span className="text-gray-800">{formatGenderLabel(client.gender)}</span>
              </p>
              {client.phone && (
                <div className="flex items-center gap-2 mt-1 group">
                  <a
                    href={`tel:${client.phone}`}
                    className="flex items-center gap-1 text-blue-600 hover:text-indigo-700 transition"
                    title="Appeler ce numéro"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M3 5a2 2 0 012-2h3.28a2 2 0 011.948 1.516l.72 3.104a2 2 0 01-.516 1.833l-1.12 1.12a12.042 12.042 0 005.657 5.657l1.12-1.12a2 2 0 011.833-.516l3.104.72A2 2 0 0121 19.72V22a2 2 0 01-2 2h-.28C9.507 24 0 14.493 0 3.28V3a2 2 0 012-2h1z" />
                    </svg>
                    <span className="font-medium">{client.phone}</span>
                  </a>

                  {/* COPY BUTTON */}
                  <button
                    onClick={() => handleCopy(client.phone)}
                    className="ml-2 text-gray-400 hover:text-gray-700 transition"
                    title="Copier le numéro"
                  >
                    📋
                  </button>
                  {copied && (
                    <span className="ml-1 text-xs text-green-600 font-medium animate-fadeIn">copié !</span>
                  )}
                </div>
              )}
            </div>
            
          </div>

          {/* Mini Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-3 rounded-xl text-center">
              <p className="text-xs text-blue-600 font-medium">Achats</p>
              <p className="text-xl font-bold">{stats.purchaseCount}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-xl text-center">
              <p className="text-xs text-green-600 font-medium">Total</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.totalSpent.toLocaleString('fr-FR')} CFA
              </p>
            </div>
          </div>
        </div>

        {/* TIMELINE INFO */}
        <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">📅</span>
            <div>
              <p className="font-semibold text-gray-800">Inscrit le</p>
              <p className="text-gray-600">{formatDate(client.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-green-600">💳</span>
            <div>
              <p className="font-semibold text-gray-800">Dernier achat</p>
              <p className="text-gray-600">{formatDate(stats.lastPurchaseDate || client.lastPurchaseDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-emerald-600">💸</span>
            <div>
              <p className="font-semibold text-gray-800">Dernier paiement</p>
              <p className="text-gray-600">{formatDate(stats.lastPaymentDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-yellow-600">✏️</span>
            <div>
              <p className="font-semibold text-gray-800">Dernière modification</p>
              <p className="text-gray-600">{formatDate(client.updatedAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-purple-600">👤</span>
            <div>
              <p className="font-semibold text-gray-800">Modifié par</p>
              <p className="text-gray-600">
                {client.updatedBy?.name || client.updatedBy?.email || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {purchases.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow border space-y-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-gray-900">Statistiques commerciales</h2>
            <p className="text-sm text-gray-500">
              Lecture rapide du comportement d’achat et de paiement de ce client.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {insightCards.map((card) => (
              <div key={card.label} className={`rounded-2xl border p-4 ${card.classes}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="mt-1 text-sm opacity-90">{card.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Panier moyen</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{stats.averagePurchase.toLocaleString('fr-FR')} CFA</p>
              <p className="mt-1 text-sm text-gray-600">Moyenne par vente créée</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Articles par vente</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{stats.averageItemsPerSale.toFixed(1)}</p>
              <p className="mt-1 text-sm text-gray-600">Volume moyen du panier</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Profil de paiement</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {stats.multiplePaymentCount > stats.singlePaymentCount ? 'Échelonné' : 'Direct'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {stats.multiplePaymentCount > stats.singlePaymentCount
                  ? 'Ce client paie souvent en plusieurs fois.'
                  : 'Ce client règle surtout en un seul paiement.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GRAPHS + PURCHASE HISTORY */}
      {purchases.length > 0 && (
        <>
          <div className="bg-white p-6 rounded-3xl shadow border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Évolution des achats</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Total dépensé par mois</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthsSpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                <Bar dataKey="total" fill="#10b981" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* HISTORY */}
          <div className="bg-white p-6 rounded-3xl shadow border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M3 3h18M9 3v18M15 3v18" />
              </svg>
              Historique des Achats
            </h2>

            {purchases.length > 0 ? (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-left text-gray-600 bg-gray-50">
                        <th className="px-4 py-2 rounded-l-lg font-medium">Date</th>
                        <th className="px-4 py-2 font-medium">Montant total</th>
                        <th className="px-4 py-2 font-medium">Statut</th>
                        <th className="px-4 py-2 text-right rounded-r-lg font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p, index) => (
                        <tr
                          key={p._id}
                          className={`transition-all duration-200 cursor-pointer ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          } hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md`}
                          onClick={() => navigate(`/sales/${p._id}`)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-700 rounded-l-lg">
                            {formatDate(p.saleDate)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {p.totalAmount.toLocaleString('fr-FR')} CFA
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
                              p.status === 'completed'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : p.status === 'partially_paid'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse'
                                : p.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                : p.status === 'cancelled'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}>
                              {p.status === 'partially_paid'
                                ? 'Paiement partiel'
                                : p.status === 'completed'
                                ? 'Payé'
                                : p.status === 'pending'
                                ? 'En attente'
                                : p.status === 'cancelled'
                                ? 'Annulé'
                                : 'Inconnu'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right rounded-r-lg">
                            <Link
                              to={`/sales/${p._id}`}
                              className="text-blue-600 hover:text-indigo-700 text-sm font-medium hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Voir détails →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-4">
                  {purchases.map((p, index) => (
                    <div
                      key={p._id}
                      className="border border-gray-200 rounded-2xl p-4 shadow-sm bg-white"
                      onClick={() => navigate(`/sales/${p._id}`)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {p.totalAmount.toLocaleString('fr-FR')} CFA
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(p.saleDate)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          p.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'partially_paid'
                            ? 'bg-indigo-100 text-indigo-800'
                            : p.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {p.status === 'partially_paid'
                            ? 'Paiement partiel'
                            : p.status === 'completed'
                            ? 'Payé'
                            : p.status === 'pending'
                            ? 'En attente'
                            : 'Annulé'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/${p._id}`);
                        }}
                        className="w-full text-blue-600 hover:text-indigo-700 text-sm font-medium mt-2"
                      >
                        Voir détails →
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  🎉 Tous les produits ont été vendus au moins une fois !
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClientProfile;
