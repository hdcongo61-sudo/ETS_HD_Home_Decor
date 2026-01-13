import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatDate } from "../utils/saleUtils";

const DeletedSales = () => {
  const [deletedSales, setDeletedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDeletedSales = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/sales/deleted");
        setDeletedSales(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Erreur lors du chargement des ventes supprimées :", err);
        setError("Impossible de charger les ventes supprimées.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeletedSales();
  }, []);

  const loadingPlaceholder = (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-t-2 border-b-2 border-rose-500 rounded-full animate-spin" />
      <p className="mt-3 text-gray-600">Chargement des ventes supprimées...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Ventes supprimées</h1>
            <p className="text-sm text-gray-500">
              Historique complet des ventes supprimées, avec la raison et l'auteur.
            </p>
          </div>
          <Link to="/sales" className="text-sm text-indigo-600 hover:text-indigo-700 underline">
            Retour aux ventes
          </Link>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {loading ? (
          loadingPlaceholder
        ) : (
          <div className="space-y-4">
            {deletedSales.length === 0 ? (
              <div className="text-center py-10 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                Aucune vente supprimée pour le moment.
              </div>
            ) : (
              deletedSales.map((entry) => {
                const snapshot = entry?.saleSnapshot || {};
                const saleId = snapshot?._id || entry?.saleId;
                const saleIdLabel = saleId ? String(saleId).slice(-6) : "—";
                const clientName =
                  snapshot?.client?.name || snapshot?.clientName || "Client non spécifié";
                const totalAmount = Number(snapshot?.totalAmount) || 0;
                const saleDate = snapshot?.saleDate;
                const deletedBy =
                  entry?.deletedBy?.name || entry?.deletedBy?.email || "Utilisateur inconnu";

                return (
                  <div
                    key={entry._id}
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">Vente #{saleIdLabel}</div>
                      <span className="text-xs text-gray-500">
                        Supprimée le {formatDate(entry?.deletedAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
                      <div>
                        <span className="block text-xs text-gray-400">Client</span>
                        <span className="font-medium text-gray-800">{clientName}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400">Montant</span>
                        <span className="font-medium text-gray-800">
                          {totalAmount.toLocaleString("fr-FR")} CFA
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400">Date de vente</span>
                        <span className="font-medium text-gray-800">{formatDate(saleDate)}</span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">
                      <div className="font-semibold">Raison de suppression</div>
                      <div>{entry?.deletionReason || "Aucune raison renseignée."}</div>
                    </div>

                    <div className="text-xs text-gray-500">Supprimée par {deletedBy}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeletedSales;
