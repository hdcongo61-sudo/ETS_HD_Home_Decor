import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { formatDate } from "../utils/saleUtils";
import {
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from "../components/business";

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

  return (
    <Workspace>
        <PageHeader
          eyebrow="Archive ventes"
          title="Ventes supprimées"
          description="Historique complet des ventes supprimées, avec la raison et l'auteur."
          actions={
          <Link to="/sales" className="text-sm text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] underline">
            Retour aux ventes
          </Link>
          }
        />

        {error && <EmptyState title="Erreur de chargement" description={error} />}

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <div className="space-y-4">
            {deletedSales.length === 0 ? (
              <EmptyState title="Aucune vente supprimée" description="L’historique des suppressions apparaîtra ici." />
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
                  <Surface
                    key={entry._id}
                    className="space-y-3 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900">Vente #{saleIdLabel}</div>
                      <span className="text-xs text-[var(--ms-text-muted)]">
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

                    <div className="rounded-md border border-[rgba(209,52,56,0.22)] bg-[#FDF3F4] p-3 text-sm text-[var(--ms-danger)]">
                      <div className="font-semibold">Raison de suppression</div>
                      <div>{entry?.deletionReason || "Aucune raison renseignée."}</div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--ms-text-muted)]">
                      <StatusBadge tone="danger">Supprimée</StatusBadge>
                      <span>Par {deletedBy}</span>
                    </div>
                  </Surface>
                );
              })
            )}
          </div>
        )}
    </Workspace>
  );
};

export default DeletedSales;
