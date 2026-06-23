import React, { useContext, useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { MessageCircle, Phone, Copy } from "lucide-react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import {
  Button,
  ChartCard,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
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

ChartJS.register(ArcElement, Tooltip, Legend);

const PaymentModal = lazy(() => import("../components/PaymentModal"));

const PartiallyPaidPurchases = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/sales", {
        params: {
          status: "partially_paid",
          summary: "compact",
        },
      });
      setSales(data || []);
    } catch {
      setError("Impossible de charger les ventes partiellement payées.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const partiallyPaid = useMemo(
    () =>
      (sales || [])
        .filter((s) => {
          if (!search.trim()) return true;
          const hay =
            (s.client?.name || "") +
            " " +
            (s.client?.email || "") +
            " " +
            (s._id || "");
          return hay.toLowerCase().includes(search.toLowerCase());
        }),
    [sales, search]
  );

  const totals = useMemo(() => {
    const t = partiallyPaid.reduce(
      (acc, s) => {
        const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        acc.total += s.totalAmount || 0;
        acc.paid += paid;
        acc.due += (s.totalAmount || 0) - paid;
        return acc;
      },
      { total: 0, paid: 0, due: 0 }
    );
    return t;
  }, [partiallyPaid]);

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
      ["Vente", "Client", "Total", "Payé", "Solde", "Dernier paiement"],
      ...partiallyPaid.map((s) => {
        const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const last = (s.payments || []).slice(-1)[0]?.paymentDate || s.updatedAt || s.createdAt;
        return [
          s._id,
          s.client?.name || "N/A",
          String(s.totalAmount || 0).replace(".", ","),
          String(paid).replace(".", ","),
          String((s.totalAmount || 0) - paid).replace(".", ","),
          last ? new Date(last).toLocaleDateString("fr-FR") : "",
        ];
      }),
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
          title="Ventes partiellement payées"
          description="Suivi précis des encaissements et relances ciblées."
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {isAdmin && (
                <Button onClick={exportCSV}>
                  Exporter CSV
                </Button>
              )}
              <Link
                to="/sales"
                className="ms-button ms-button-primary ms-button-md"
              >
                Retour
              </Link>
            </div>
          }
        />

        <Surface className="p-3">
          <SearchBox
              label="Rechercher dans les ventes partiellement payées"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher client, email ou #vente…"
            />
        </Surface>

        {/* KPIs & Donut */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Nombre" value={loading ? "—" : partiallyPaid.length} context="Ventes filtrées" />
          <KPICard title="Total" value={loading ? "—" : `${totals.total.toLocaleString("fr-FR")} CFA`} context="Montant facturé" />
          <KPICard title="Payé" value={loading ? "—" : `${totals.paid.toLocaleString("fr-FR")} CFA`} context="Déjà encaissé" tone="success" />
          <KPICard title="Solde" value={loading ? "—" : `${totals.due.toLocaleString("fr-FR")} CFA`} context="Reste à encaisser" tone="danger" />
        </div>

        <ChartCard title="Répartition" description="Payé contre restant dû">
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

        <Surface>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Détail des ventes</h3>
            {loading ? (
              <LoadingSkeleton rows={6} />
            ) : error ? (
              <EmptyState title="Erreur de chargement" description={error} action={<Button onClick={fetchSales}>Réessayer</Button>} />
            ) : partiallyPaid.length === 0 ? (
              <EmptyState title="Aucune vente partiellement payée" description="Les ventes avec solde restant apparaîtront ici." />
            ) : (
              <div className="space-y-4">
                {partiallyPaid.map((s) => {
                  const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const balance = (s.totalAmount || 0) - paid;
                  const lastPay = (s.payments || []).slice(-1)[0]?.paymentDate || s.updatedAt;
                  const daysSince = lastPay
                    ? Math.max(0, Math.floor((Date.now() - new Date(lastPay).getTime()) / 86400000))
                    : null;
                  const reminderMsg = buildReminderMessage({
                    clientName: s.client?.name,
                    shopName,
                    balance,
                    lastPaymentLabel: lastPay ? new Date(lastPay).toLocaleDateString("fr-FR") : "",
                    daysSince,
                  });
                  const wa = canWhatsApp(s.client?.phone) ? whatsAppLink(s.client?.phone, dialCode, reminderMsg) : "";
                  const tel = telLink(s.client?.phone);
                  return (
                    <div
                      key={s._id}
                      className="flex flex-col gap-4 rounded-md border border-[var(--ms-border)] bg-white p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <Link
                          to={`/sales/${s._id}`}
                          className="font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)]"
                        >
                          Vente #{s._id.slice(-6)}
                        </Link>
                        <div className="text-sm text-gray-600 mt-1">
                          {s.client?.name || "Client"} — {new Date(s.saleDate).toLocaleDateString("fr-FR")}
                        </div>
                      </div>

                      <div className="w-full md:w-auto flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                          <div>
                            <div className="text-xs text-gray-500">Total</div>
                            <div className="font-semibold">
                              {(s.totalAmount || 0).toLocaleString("fr-FR")} CFA
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Payé</div>
                            <div className="font-semibold text-green-700">
                              {paid.toLocaleString("fr-FR")} CFA
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Solde</div>
                            <div className="font-semibold text-red-600">
                              {balance.toLocaleString("fr-FR")} CFA
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {wa ? (
                            <button
                              type="button"
                              onClick={() => handleWhatsAppReminder(s, wa)}
                              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                              style={{ background: remindedSales[s._id] ? "#128C7E" : "#25D366" }}
                            >
                              <MessageCircle size={15} /> {remindedSales[s._id] ? 'Relancé ✓' : 'WhatsApp'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-400" title="Numéro de téléphone manquant">
                              <MessageCircle size={15} /> WhatsApp
                            </span>
                          )}
                          {tel && (
                            <a href={tel} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ms-border)] px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                              <Phone size={15} /> Appeler
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => copyMessage(reminderMsg)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ms-border)] px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
                          className="w-full md:w-auto"
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
