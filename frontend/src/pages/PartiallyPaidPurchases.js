import React, { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";
import api from "../services/api";

ChartJS.register(ArcElement, Tooltip, Legend);

const PaymentModal = lazy(() => import("../components/PaymentModal"));

const Glass = ({ children }) => (
  <div className="rounded-2xl border border-gray-200/70 bg-white/90 backdrop-blur-sm shadow-sm">
    {children}
  </div>
);

const PartiallyPaidPurchases = () => {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [search, setSearch] = useState("");

  const fetchSales = useCallback(async () => {
    const { data } = await api.get("/sales");
    setSales(data || []);
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const partiallyPaid = useMemo(
    () =>
      (sales || [])
        .filter((s) => s.status === "partially_paid")
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
        backgroundColor: ["rgba(34,197,94,.9)", "rgba(239,68,68,.9)"],
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
    await api.post(`/sales/${selectedSale._id}/payments`, paymentData);
    setShowPaymentModal(false);
    await fetchSales();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              💳 Ventes Partiellement Payées
            </h1>
            <p className="text-gray-600 mt-1">
              Suivi précis des encaissements et relances ciblées
            </p>
          </div>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher client, email ou #vente…"
              className="flex-1 lg:w-64 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={exportCSV}
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
            >
              Export CSV
            </button>
            <Link
              to="/sales"
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Retour
            </Link>
          </div>
        </div>

        {/* KPIs & Donut */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Glass>
            <div className="p-5">
              <div className="text-gray-600 text-sm">Nombre</div>
              <div className="text-2xl font-semibold text-gray-900">{partiallyPaid.length}</div>
            </div>
          </Glass>
          <Glass>
            <div className="p-5">
              <div className="text-gray-600 text-sm">Total</div>
              <div className="text-2xl font-semibold text-gray-900">
                {totals.total.toLocaleString("fr-FR")} CFA
              </div>
            </div>
          </Glass>
          <Glass>
            <div className="p-5">
              <div className="text-gray-600 text-sm">Payé</div>
              <div className="text-2xl font-semibold text-green-700">
                {totals.paid.toLocaleString("fr-FR")} CFA
              </div>
            </div>
          </Glass>
          <Glass>
            <div className="p-5">
              <div className="text-gray-600 text-sm">Solde</div>
              <div className="text-2xl font-semibold text-red-600">
                {totals.due.toLocaleString("fr-FR")} CFA
              </div>
            </div>
          </Glass>
        </div>

        <Glass>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Répartition</h3>
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
          </div>
        </Glass>

        <Glass>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Détail des ventes</h3>
            {partiallyPaid.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Aucune vente partiellement payée</div>
            ) : (
              <div className="space-y-4">
                {partiallyPaid.map((s) => {
                  const paid = (s.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                  const balance = (s.totalAmount || 0) - paid;
                  return (
                    <div
                      key={s._id}
                      className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <Link
                          to={`/sales/${s._id}`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          Vente #{s._id.slice(-6)}
                        </Link>
                        <div className="text-sm text-gray-600 mt-1">
                          {s.client?.name || "Client"} — {new Date(s.saleDate).toLocaleDateString("fr-FR")}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Total</div>
                          <div className="font-semibold">
                            {(s.totalAmount || 0).toLocaleString("fr-FR")} CFA
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Payé</div>
                          <div className="font-semibold text-green-700">
                            {paid.toLocaleString("fr-FR")} CFA
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Solde</div>
                          <div className="font-semibold text-red-600">
                            {balance.toLocaleString("fr-FR")} CFA
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSale(s);
                            setShowPaymentModal(true);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                        >
                          Ajouter paiement
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Glass>

        <Suspense fallback={null}>
          <PaymentModal
            show={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            sale={selectedSale}
            onAddPayment={handleAddPayment}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default PartiallyPaidPurchases;
