import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import AppLoader from '../components/AppLoader';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { getPaymentStructureKey } from '../utils/saleUtils';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Copy,
  CreditCard,
  Edit3,
  History,
  Phone,
  Printer,
  UserRound,
} from 'lucide-react';
import {
  Button,
  ChartCard,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from '../components/business';

const PROFILE_GENDER_LABELS = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  unknown: 'Non renseigné'
};

const ALERT_TONES = { yellow: 'warning', gray: 'neutral', green: 'success' };

const PAYMENT_METHOD_LABELS = {
  cash: 'Espèces',
  MobileMoney: 'Mobile Money',
  credit: 'Crédit'
};

const formatGenderLabel = (gender) => PROFILE_GENDER_LABELS[gender] || PROFILE_GENDER_LABELS.unknown;

const formatUserName = (user) => {
  if (!user) return 'Utilisateur non disponible';
  if (typeof user === 'string') return user;
  return user.name || user.email || 'Utilisateur non disponible';
};

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
          message: `Ce client n'a pas effectué d'achat depuis ${diffDays} jours.`,
          color: 'yellow'
        });
      }
    } else {
      alerts.push({
        type: 'info',
        title: 'Aucun achat',
        message: "Ce client n'a encore effectué aucun achat.",
        color: 'gray'
      });
    }

    if (stats.totalSpent > spendingLimit) {
      alerts.push({
        type: 'success',
        title: 'Client Premium',
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
    { label: 'Vente en gros',       value: `${stats.wholesaleAmount.toLocaleString('fr-FR')} CFA`,     helper: `${stats.wholesaleCount} vente${stats.wholesaleCount > 1 ? 's' : ''}`,           tone: 'warning' },
    { label: 'Paiement unique',     value: `${stats.singlePaymentAmount.toLocaleString('fr-FR')} CFA`, helper: `${stats.singlePaymentCount} vente${stats.singlePaymentCount > 1 ? 's' : ''}`,   tone: 'success' },
    { label: 'Paiements multiples', value: `${stats.multiplePaymentAmount.toLocaleString('fr-FR')} CFA`,helper: `${stats.multiplePaymentCount} vente${stats.multiplePaymentCount > 1 ? 's' : ''}`, tone: 'neutral' },
    { label: 'Solde restant',       value: `${stats.totalOutstanding.toLocaleString('fr-FR')} CFA`,    helper: `${stats.unpaidSalesCount} vente${stats.unpaidSalesCount > 1 ? 's' : ''} à suivre`, tone: stats.totalOutstanding > 0 ? 'danger' : 'success' },
    { label: 'Mode favori',         value: stats.favoritePaymentMethod?.label || '—',                  helper: stats.favoritePaymentMethod ? `${stats.favoritePaymentMethod.amount.toLocaleString('fr-FR')} CFA encaissés` : 'Aucun paiement', tone: 'neutral' },
    { label: 'Rythme moyen',        value: stats.averagePurchaseGapDays !== null ? `${Math.round(stats.averagePurchaseGapDays)} j` : '—', helper: stats.bestMonthLabel ? `Mois fort : ${stats.bestMonthLabel}` : 'Pas assez d\'historique', tone: 'neutral' },
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
      <Workspace>
        <LoadingSkeleton rows={8} />
      </Workspace>
    );
  }

  if (error || !client) {
    return (
      <Workspace>
        <EmptyState
          title={error || 'Client introuvable'}
          description="Impossible de charger les données de ce client."
          action={
            <Link to={returnToClients} className="ms-button ms-button-secondary ms-button-md">
              Retour aux clients
            </Link>
          }
        />
      </Workspace>
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
  const lastModifiedBy = formatUserName(client.updatedBy);

  return (
    <Workspace className="space-y-5">
      {/* HEADER */}
      <PageHeader
        title={client.name}
        description={client.email || client.phone || 'Client enregistre'}
        actions={
          <div className="flex flex-wrap gap-2">
            {client.phone && (
              <>
                <a href={`tel:${client.phone}`} className="ms-button ms-button-secondary ms-button-sm"><Phone className="h-4 w-4" /> Appeler</a>
                <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="ms-button ms-button-primary ms-button-sm">WhatsApp</a>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer</Button>
          </div>
        }
      />

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-[var(--radiusLarge)] px-4 py-3"
              style={{
                background: n.color === 'yellow' ? 'var(--colorStatusWarningBackground1)' : n.color === 'green' ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorNeutralBackground2)',
                color: n.color === 'yellow' ? 'var(--colorStatusWarningForeground1)' : n.color === 'green' ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorNeutralForeground2)',
                border: `1px solid ${n.color === 'yellow' ? 'var(--colorStatusWarningStroke1)' : n.color === 'green' ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorNeutralStroke2)'}`,
              }}
            >
              <div className="min-w-0">
                <p className="fui-body1-strong">{n.title}</p>
                <p className="fui-caption1 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CLIENT INFO */}
      <Surface className="p-5 space-y-5">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[var(--ms-text-strong)]">{client.name}</h2>
              <p className="truncate text-[var(--ms-text-muted)] text-sm">{client.email || '—'}</p>
              <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Genre : <span className="text-[var(--ms-text)] font-medium">{formatGenderLabel(client.gender)}</span></p>
              {client.phone && (
                <div className="flex items-center gap-2 mt-1">
                  <a href={`tel:${client.phone}`} className="flex items-center gap-1 text-[var(--ms-text)] hover:text-[var(--ms-blue)] transition text-sm"><Phone className="h-4 w-4" />{client.phone}</a>
                  <button onClick={() => handleCopy(client.phone)} className="text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] transition" title="Copier"><Copy className="h-4 w-4" /></button>
                  {copied && <span className="text-xs font-medium text-[var(--ms-success)] animate-fadeIn">copie !</span>}
                </div>
              )}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
            <KPICard title="Achats" value={stats.purchaseCount} tone="neutral" />
            <KPICard title="Total" value={`${stats.totalSpent.toLocaleString('fr-FR')} CFA`} tone="success" />
          </div>
        </div>
        <div className="grid gap-3 border-t border-[var(--ms-border)] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3"><CalendarDays className="h-4 w-4 text-[var(--ms-text-muted)]" /><div><p className="font-semibold text-[var(--ms-text)]">Inscrit le</p><p className="text-[var(--ms-text-muted)] text-xs">{formatDate(client.createdAt)}</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3"><CreditCard className="h-4 w-4 text-[var(--ms-text-muted)]" /><div><p className="font-semibold text-[var(--ms-text)]">Dernier achat</p><p className="text-[var(--ms-text-muted)] text-xs">{formatDate(stats.lastPurchaseDate || client.lastPurchaseDate)}</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3"><CreditCard className="h-4 w-4 text-[var(--ms-text-muted)]" /><div><p className="font-semibold text-[var(--ms-text)]">Dernier paiement</p><p className="text-[var(--ms-text-muted)] text-xs">{formatDate(stats.lastPaymentDate)}</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3"><Edit3 className="h-4 w-4 text-[var(--ms-text-muted)]" /><div><p className="font-semibold text-[var(--ms-text)]">Derniere modification</p><p className="text-[var(--ms-text-muted)] text-xs">{formatDate(client.updatedAt)}</p><p className="text-[var(--ms-text-muted)] text-xs">par {lastModifiedBy}</p></div></div>
        </div>
      </Surface>

      {purchases.length > 0 && (
        <ChartCard title="Statistiques commerciales" description="Lecture rapide du comportement d'achat et de paiement">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {insightCards.map((card) => (
              <KPICard key={card.label} title={card.label} value={card.value} context={card.helper} tone={card.tone} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <KPICard title="Panier moyen" value={`${stats.averagePurchase.toLocaleString('fr-FR')} CFA`} context="Moyenne par vente" tone="neutral" />
            <KPICard title="Articles/vente" value={stats.averageItemsPerSale.toFixed(1)} context="Volume moyen" tone="neutral" />
            <KPICard title="Profil de paiement" value={stats.multiplePaymentCount > stats.singlePaymentCount ? 'Echelonne' : 'Direct'} context={stats.multiplePaymentCount > stats.singlePaymentCount ? 'Paie en plusieurs fois' : 'Un seul paiement'} tone="neutral" />
          </div>
        </ChartCard>
      )}

      {/* CHARTS */}
      {purchases.length > 0 && (
        <>
          <ChartCard title="Evolution des achats">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                <Line type="monotone" dataKey="total" stroke="#0078D4" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Total depense par mois">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthsSpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                <Bar dataKey="total" fill="#107C10" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* HISTORY */}
          <div>
            <DataTable className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr><th>Date</th><th>Montant</th><th>Statut</th><th className="text-right">Action</th></tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p._id} className="cursor-pointer" onClick={() => navigate(`/sales/${p._id}`)}>
                      <td className="font-medium">{formatDate(p.saleDate)}</td>
                      <td className="font-semibold">{p.totalAmount.toLocaleString('fr-FR')} CFA</td>
                      <td><StatusBadge tone={p.status === 'completed' ? 'success' : p.status === 'partially_paid' ? 'warning' : p.status === 'cancelled' ? 'danger' : 'neutral'}>{p.status === 'partially_paid' ? 'Partiel' : p.status === 'completed' ? 'Paye' : p.status === 'pending' ? 'En attente' : p.status === 'cancelled' ? 'Annule' : 'Inconnu'}</StatusBadge></td>
                      <td className="text-right">
                        <Link to={`/sales/${p._id}`} className="ms-button ms-button-secondary ms-button-sm" onClick={(e) => e.stopPropagation()}><ArrowRight className="h-4 w-4" /> Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>

            {/* Mobile */}
            <div className="md:hidden space-y-3 mt-4">
              {purchases.map((p) => (
                <div key={p._id} className="ms-surface p-4 cursor-pointer" onClick={() => navigate(`/sales/${p._id}`)}>
                  <div className="flex justify-between items-center mb-2">
                    <div><p className="font-semibold text-[var(--ms-text)]">{p.totalAmount.toLocaleString('fr-FR')} CFA</p><p className="text-xs text-[var(--ms-text-muted)]">{formatDate(p.saleDate)}</p></div>
                    <StatusBadge tone={p.status === 'completed' ? 'success' : p.status === 'partially_paid' ? 'warning' : p.status === 'cancelled' ? 'danger' : 'neutral'}>{p.status === 'partially_paid' ? 'Partiel' : p.status === 'completed' ? 'Paye' : 'En attente'}</StatusBadge>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full" onClick={(e) => { e.stopPropagation(); navigate(`/sales/${p._id}`); }}><ArrowRight className="h-4 w-4" /> Voir details</Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Workspace>
  );
};

export default ClientProfile;
