import React, { useContext, useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageCircle, Phone, Copy, ArrowUpDown, AlertTriangle, CalendarDays, HandCoins } from "lucide-react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import { useFeature, LockedFeatureButton } from "../components/FeatureGate";
import { FEATURE_KEYS } from "../config/features";
import {
  Button,
  ChartCard,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
  StatusBadge,
  Surface,
  Workspace,
} from "../components/business";
import {
  buildReminderMessage,
  whatsAppLink,
  telLink,
  canWhatsApp,
  recordReminder,
} from "../utils/clientReminder";
import { formatCfa as cfa } from "../utils/format";
import PaymentProgress, { paymentRatio } from "./sales-shared/PaymentProgress";

ChartJS.register(ArcElement, Tooltip, Legend);

const PaymentModal = lazy(() => import("../components/PaymentModal"));

// Ancienneté depuis le dernier paiement (ou la vente si jamais payé)
const AGING_BUCKETS = [
  { key: "recent", label: "≤ 7 jours", min: 0, max: 7, tone: "success" },
  { key: "medium", label: "8 – 30 jours", min: 8, max: 30, tone: "warning" },
  { key: "old", label: "+30 jours", min: 31, max: Infinity, tone: "danger" },
];

const SORT_OPTIONS = [
  { value: "balance", label: "Solde le plus élevé" },
  { value: "oldest", label: "Relance la plus urgente" },
  { value: "recent", label: "Vente la plus récente" },
];

// Filtre sur la date de vente
const DATE_FILTER_OPTIONS = [
  { value: "", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "7days", label: "7 derniers jours" },
  { value: "30days", label: "30 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Période personnalisée" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "", label: "Tous les encaissements" },
  { value: "never_paid", label: "Jamais encaissées" },
  { value: "partially_paid", label: "Avec acompte" },
];

const getDateBounds = (preset, startStr, endStr) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  if (preset === "today") return { start: startOfToday, end: endOfToday };
  if (preset === "7days") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return { start, end: endOfToday };
  }
  if (preset === "30days") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    return { start, end: endOfToday };
  }
  if (preset === "month") {
    const start = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    return { start, end: endOfToday };
  }
  if (preset === "custom") {
    const start = startStr ? new Date(`${startStr}T00:00:00`) : null;
    const end = endStr ? new Date(`${endStr}T23:59:59.999`) : null;
    if (!start && !end) return null;
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null,
    };
  }
  return null;
};

const matchesDateBounds = (sale, bounds) => {
  if (!bounds) return true;
  const d = new Date(sale.saleDate || sale.createdAt || 0);
  if (Number.isNaN(d.getTime())) return false;
  if (bounds.start && d < bounds.start) return false;
  if (bounds.end && d > bounds.end) return false;
  return true;
};

// Le badge d'urgence reprend le ton du bucket d'ancienneté — une seule
// source de vérité pour les seuils (AGING_BUCKETS).
const bucketTone = (sale) =>
  sale.daysSince == null
    ? "neutral"
    : AGING_BUCKETS.find((b) => b.key === sale.bucket)?.tone || "neutral";

const PartiallyPaidPurchases = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
  const canExport = useFeature(FEATURE_KEYS.DATA_EXPORT);
  const shopName = auth?.tenant?.name || "";
  const dialCode = auth?.tenant?.dialCode || "";

  const copyMessage = (msg) => {
    navigator.clipboard?.writeText(msg)
      .then(() => toast.success("Message copié"))
      .catch(() => toast.error("Copie impossible"));
  };

  const handleWhatsAppReminder = async (sale, waLink) => {
    try {
      await recordReminder(sale._id, 'whatsapp');
      setRemindedSales((prev) => ({ ...prev, [sale._id]: new Date().toISOString() }));
    } catch {
      // Silently fail — WhatsApp still opens
    }
    window.open(waLink, '_blank', 'noopener,noreferrer');
  };
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [remindedSales, setRemindedSales] = useState({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("oldest");
  const [agingFilter, setAgingFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [partiallyPaidResponse, pendingResponse] = await Promise.all([
        api.get("/sales", {
          params: { status: "partially_paid", summary: "compact" },
        }),
        api.get("/sales", {
          params: { status: "pending", summary: "compact" },
        }),
      ]);
      setSales([
        ...(partiallyPaidResponse.data || []),
        ...(pendingResponse.data || []),
      ]);
    } catch {
      setError("Impossible de charger les ventes à solder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Refresh immediately when a sale or payment is created from the global modal.
  useEffect(() => {
    window.addEventListener('saleCreated', fetchSales);
    window.addEventListener('paymentCreated', fetchSales);
    return () => {
      window.removeEventListener('saleCreated', fetchSales);
      window.removeEventListener('paymentCreated', fetchSales);
    };
  }, [fetchSales]);

  // Enrichit chaque vente : payé, solde, jours depuis dernier paiement, bucket
  const enriched = useMemo(
    () =>
      (sales || []).map((s) => {
        const payments = Array.isArray(s.payments) ? s.payments : [];
        const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const balance = (s.totalAmount || 0) - paid;
        const actualPayments = payments.filter((p) => (Number(p.amount) || 0) > 0);
        const hasPayment = actualPayments.length > 0;
        const lastPay = actualPayments.slice(-1)[0]?.paymentDate || null;
        const agingDate = lastPay || s.saleDate || s.createdAt;
        const daysSince = agingDate
          ? Math.max(0, Math.floor((Date.now() - new Date(agingDate).getTime()) / 86400000))
          : null;
        const bucket = AGING_BUCKETS.find(
          (b) => daysSince != null && daysSince >= b.min && daysSince <= b.max
        )?.key || "old";
        return { ...s, paid, balance, hasPayment, lastPay, daysSince, bucket };
      }),
    [sales]
  );

  const dateBounds = useMemo(
    () => getDateBounds(dateFilter, dateStart, dateEnd),
    [dateFilter, dateStart, dateEnd]
  );

  // Base commune : recherche + date de vente + encaissement
  const searchedAndDated = useMemo(() => {
    let list = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const hay = `${s.client?.name || ""} ${s.client?.email || ""} ${s._id || ""}`;
        return hay.toLowerCase().includes(q);
      });
    }
    if (dateBounds) {
      list = list.filter((s) => matchesDateBounds(s, dateBounds));
    }
    if (paymentFilter === "never_paid") {
      list = list.filter((s) => !s.hasPayment);
    } else if (paymentFilter === "partially_paid") {
      list = list.filter((s) => s.hasPayment);
    }
    return list;
  }, [enriched, search, dateBounds, paymentFilter]);

  const partiallyPaid = useMemo(() => {
    let list = searchedAndDated;
    if (agingFilter) {
      list = list.filter((s) => s.bucket === agingFilter);
    }
    const sorted = [...list];
    if (sortBy === "balance") sorted.sort((a, b) => b.balance - a.balance);
    else if (sortBy === "oldest") sorted.sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
    else sorted.sort((a, b) => new Date(b.saleDate || 0) - new Date(a.saleDate || 0));
    return sorted;
  }, [searchedAndDated, agingFilter, sortBy]);

  const totals = useMemo(() => {
    const t = partiallyPaid.reduce(
      (acc, s) => {
        acc.total += s.totalAmount || 0;
        acc.paid += s.paid;
        acc.due += s.balance;
        return acc;
      },
      { total: 0, paid: 0, due: 0 }
    );
    return t;
  }, [partiallyPaid]);

  // Répartition par ancienneté (respecte recherche + date, pas le filtre bucket)
  const agingSummary = useMemo(() => {
    const acc = Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, { count: 0, due: 0 }]));
    searchedAndDated.forEach((s) => {
      const slot = acc[s.bucket];
      if (slot) {
        slot.count += 1;
        slot.due += s.balance;
      }
    });
    return AGING_BUCKETS.map((b) => ({ ...b, ...acc[b.key] }));
  }, [searchedAndDated]);

  const donutData = {
    labels: ["Payé", "Restant dû"],
    datasets: [
      {
        data: [totals.paid, totals.due],
        backgroundColor: ["#107C10", "#D13438"],
      },
    ],
  };

  const exportCSV = () => {
    const rows = [
      ["Vente", "Client", "Total", "Payé", "Solde", "Dernier paiement", "Jours sans paiement"],
      ...partiallyPaid.map((s) => [
        s._id,
        s.client?.name || "N/A",
        String(s.totalAmount || 0).replace(".", ","),
        String(s.paid).replace(".", ","),
        String(s.balance).replace(".", ","),
        s.lastPay ? new Date(s.lastPay).toLocaleDateString("fr-FR") : "",
        s.daysSince == null ? "" : String(s.daysSince),
      ]),
    ]
      .map((row) => row.join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partially-paid-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPayment = async (paymentData) => {
    if (!selectedSale) return;
    const { data } = await api.post(`/sales/${selectedSale._id}/payments`, paymentData);
    const nextSale = {
      ...selectedSale,
      ...data,
      client: selectedSale.client,
      products: selectedSale.products,
    };
    // Once the balance is settled the sale is no longer "partially paid":
    // drop it from the list immediately instead of waiting for a reload.
    const isSettled =
      nextSale.status === "completed" || Number(nextSale.balance ?? 1) <= 0;
    setSales((prev) =>
      isSettled
        ? prev.filter((sale) => sale._id !== selectedSale._id)
        : prev.map((sale) => (sale._id === selectedSale._id ? nextSale : sale))
    );
    if (isSettled) {
      toast.success("Vente soldée ✓");
    }
    setSelectedSale(null);
    setShowPaymentModal(false);
  };

  return (
    <Workspace>
        <PageHeader
          eyebrow="Paiements"
          title="Recouvrement des soldes"
          description="Ventes avec un solde restant : relances ciblées, priorisées par urgence."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isAdmin && (
                canExport
                  ? <Button onClick={exportCSV}>Exporter CSV</Button>
                  : <LockedFeatureButton feature={FEATURE_KEYS.DATA_EXPORT}>Exporter CSV</LockedFeatureButton>
              )}
              <Link
                to="/sales"
                className="ms-button ms-button-primary ms-button-md"
              >
                Retour aux ventes
              </Link>
            </div>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KPICard title="Ventes à solder" value={loading ? "—" : partiallyPaid.length} context="Après filtres" />
          <KPICard title="Total facturé" value={loading ? "—" : cfa(totals.total)} context="Montant des ventes" />
          <KPICard title="Déjà encaissé" value={loading ? "—" : cfa(totals.paid)} context={totals.total ? `${Math.round((totals.paid / totals.total) * 100)}% du total` : ""} tone="success" />
          <KPICard title="Reste à encaisser" value={loading ? "—" : cfa(totals.due)} context="Solde cumulé" tone="danger" />
        </div>

        {/* Ancienneté — cliquable pour filtrer */}
        <Surface className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="fui-caption1-strong uppercase" style={{ color: "var(--colorNeutralForeground3)", letterSpacing: "0.06em" }}>
              Ancienneté du dernier paiement
            </p>
            {agingFilter && (
              <button type="button" onClick={() => setAgingFilter("")} className="fui-caption1-strong hover:underline" style={{ color: "var(--colorBrandForeground1)" }}>
                Tout afficher
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {agingSummary.map((b) => {
              const active = agingFilter === b.key;
              // "success" → "Success" : le ton est le nom du token de statut
              const statusName = b.tone[0].toUpperCase() + b.tone.slice(1);
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setAgingFilter(active ? "" : b.key)}
                  aria-pressed={active}
                  className="rounded-[var(--radiusLarge)] border p-3 text-left transition-shadow hover:shadow-[var(--ms-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
                  style={{
                    borderColor: active ? "var(--colorBrandBackground)" : `var(--colorStatus${statusName}Stroke1)`,
                    background: `var(--colorStatus${statusName}Background1)`,
                    boxShadow: active ? "0 0 0 1px var(--colorBrandBackground)" : undefined,
                  }}
                >
                  <p className="fui-caption1-strong" style={{ color: `var(--colorStatus${statusName}Foreground1)` }}>
                    {b.label}
                  </p>
                  <p className="mt-1 fui-subtitle1 tabular-nums" style={{ color: "var(--colorNeutralForeground1)" }}>
                    {b.count} <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>vente(s)</span>
                  </p>
                  <p className="fui-caption1 tabular-nums" style={{ color: "var(--colorNeutralForeground2)" }}>
                    {cfa(b.due)} dus
                  </p>
                </button>
              );
            })}
          </div>
        </Surface>

        {/* Recherche + encaissement + date + tri */}
        <Surface className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex-1">
              <SearchBox
                label="Rechercher dans les ventes à solder"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher client, email ou #vente…"
              />
            </div>
            <label className="flex items-center gap-2 shrink-0">
              <HandCoins className="h-4 w-4" style={{ color: "var(--colorNeutralForeground3)" }} aria-hidden />
              <span className="sr-only">Filtrer par encaissement</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="form-control text-sm"
                aria-label="Filtrer les ventes par encaissement"
              >
                {PAYMENT_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 shrink-0">
              <CalendarDays className="h-4 w-4" style={{ color: "var(--colorNeutralForeground3)" }} aria-hidden />
              <span className="sr-only">Filtrer par date de vente</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="form-control text-sm"
                aria-label="Filtrer par date de vente"
              >
                {DATE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 shrink-0">
              <ArrowUpDown className="h-4 w-4" style={{ color: "var(--colorNeutralForeground3)" }} aria-hidden />
              <span className="sr-only">Trier par</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-control text-sm"
                aria-label="Trier les ventes"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {dateFilter === "custom" && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex-1 space-y-1">
                <span className="fui-caption1-strong block" style={{ color: "var(--colorNeutralForeground3)" }}>Du</span>
                <input
                  type="date"
                  value={dateStart}
                  max={dateEnd || undefined}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="form-control text-sm w-full"
                  aria-label="Date de début"
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="fui-caption1-strong block" style={{ color: "var(--colorNeutralForeground3)" }}>Au</span>
                <input
                  type="date"
                  value={dateEnd}
                  min={dateStart || undefined}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="form-control text-sm w-full"
                  aria-label="Date de fin"
                />
              </label>
              <button
                type="button"
                onClick={() => { setDateFilter(""); setDateStart(""); setDateEnd(""); }}
                className="ms-button ms-button-secondary ms-button-sm shrink-0"
              >
                Effacer les dates
              </button>
            </div>
          )}
        </Surface>

        {/* Liste des ventes */}
        <Surface>
          <div className="p-5 sm:p-6">
            <h3 className="fui-subtitle1 mb-4" style={{ color: "var(--colorNeutralForeground1)" }}>
              Détail des ventes
            </h3>
            {loading ? (
              <LoadingSkeleton rows={6} />
            ) : error ? (
              <EmptyState title="Erreur de chargement" description={error} action={<Button onClick={fetchSales}>Réessayer</Button>} />
            ) : partiallyPaid.length === 0 ? (
              <EmptyState title="Aucune vente à solder" description={agingFilter || paymentFilter || search || dateFilter ? "Ajustez la recherche, la période ou les filtres." : "Les ventes avec solde restant apparaîtront ici."} />
            ) : (
              <div className="space-y-4">
                {partiallyPaid.map((s) => {
                  const paidRatio = paymentRatio(s.paid, s.totalAmount);
                  const reminderMsg = buildReminderMessage({
                    clientName: s.client?.name,
                    shopName,
                    balance: s.balance,
                    lastPaymentLabel: s.lastPay ? new Date(s.lastPay).toLocaleDateString("fr-FR") : "",
                    daysSince: s.daysSince,
                  });
                  const wa = canWhatsApp(s.client?.phone) ? whatsAppLink(s.client?.phone, dialCode, reminderMsg) : "";
                  const tel = telLink(s.client?.phone);
                  const tone = bucketTone(s);
                  return (
                    <div
                      key={s._id}
                      className="flex flex-col gap-4 rounded-[var(--radiusLarge)] border p-4 lg:flex-row lg:items-start lg:justify-between"
                      style={{ borderColor: "var(--ms-border)", background: "var(--ms-white)" }}
                    >
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/sales/${s._id}`}
                            className="fui-body1-strong hover:underline"
                            style={{ color: "var(--colorNeutralForeground1)" }}
                          >
                            {s.client?.name || "Client"}
                          </Link>
                          <StatusBadge tone={tone}>
                            {!s.hasPayment ? "Jamais encaissée" : s.daysSince === 0 ? "Payé aujourd'hui" : `${s.daysSince} j sans paiement`}
                          </StatusBadge>
                          {s.daysSince != null && s.daysSince > 30 && (
                            <AlertTriangle className="h-4 w-4" style={{ color: "var(--colorStatusDangerForeground1)" }} aria-label="Relance urgente" />
                          )}
                        </div>
                        <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>
                          Vente #{s._id.slice(-6)} · {new Date(s.saleDate).toLocaleDateString("fr-FR")}
                          {s.lastPay ? ` · dernier paiement le ${new Date(s.lastPay).toLocaleDateString("fr-FR")}` : ""}
                        </p>

                        {/* Progression encaissement */}
                        <div className="max-w-md">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="fui-caption1 tabular-nums" style={{ color: "var(--colorStatusSuccessForeground1)" }}>
                              {cfa(s.paid)} payé ({paidRatio}%)
                            </span>
                            <span className="fui-caption1-strong tabular-nums" style={{ color: "var(--colorStatusDangerForeground1)" }}>
                              {cfa(s.balance)} restant
                            </span>
                          </div>
                          <PaymentProgress className="mt-1" ratio={paidRatio} color="var(--colorStatusSuccessForeground1)" />
                          <p className="mt-1 fui-caption1 tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>
                            Total facturé : {cfa(s.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2.5 lg:items-end">
                        <div className="flex flex-wrap items-center gap-2">
                          {wa ? (
                            <button
                              type="button"
                              onClick={() => handleWhatsAppReminder(s, wa)}
                              className="inline-flex items-center gap-1.5 rounded-[var(--radiusMedium)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                              style={{ background: remindedSales[s._id] ? "#128C7E" : "#25D366" }}
                            >
                              <MessageCircle size={15} /> {remindedSales[s._id] ? 'Relancé ✓' : 'WhatsApp'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-[var(--radiusMedium)] px-3 py-2 text-sm font-semibold" style={{ background: "var(--colorNeutralBackground3)", color: "var(--colorNeutralForeground3)" }} title="Numéro de téléphone manquant">
                              <MessageCircle size={15} /> WhatsApp
                            </span>
                          )}
                          {tel && (
                            <a href={tel} className="ms-button ms-button-secondary ms-button-sm">
                              <Phone size={15} /> Appeler
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => copyMessage(reminderMsg)}
                            className="ms-button ms-button-secondary ms-button-sm"
                          >
                            <Copy size={15} /> Copier
                          </button>
                        </div>
                        <Button
                          onClick={() => {
                            setSelectedSale(s);
                            setShowPaymentModal(true);
                          }}
                          variant="primary"
                          className="w-full lg:w-auto"
                        >
                          Ajouter un paiement
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Surface>

        {/* Répartition globale payé / dû */}
        <ChartCard title="Répartition" description="Payé contre restant dû (ventes affichées)">
            <div className="h-56">
              <Doughnut
                data={donutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            </div>
        </ChartCard>

        <Suspense fallback={null}>
          <PaymentModal
            show={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            sale={selectedSale}
            onAddPayment={handleAddPayment}
          />
        </Suspense>
    </Workspace>
  );
};

export default PartiallyPaidPurchases;
