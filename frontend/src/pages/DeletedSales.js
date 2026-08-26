import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { salesApi } from "../features/sales/api";
import { formatDate } from "../utils/saleUtils";
import { formatCfa as cfa } from "../utils/format";
import {
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
  StatusBadge,
  Surface,
  Workspace,
} from "../components/business";

const DeletedSales = () => {
  const [deletedSales, setDeletedSales] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDeletedSales = async () => {
      setLoading(true);
      try {
        const { data } = await salesApi.deleted();
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

  const filtered = useMemo(() => {
    if (!search.trim()) return deletedSales;
    const q = search.toLowerCase();
    return deletedSales.filter((entry) => {
      const snapshot = entry?.saleSnapshot || {};
      const hay = [
        snapshot?.client?.name,
        snapshot?.clientName,
        entry?.deletionReason,
        entry?.deletedBy?.name,
        entry?.deletedBy?.email,
        String(snapshot?._id || entry?.saleId || ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [deletedSales, search]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, e) => sum + (Number(e?.saleSnapshot?.totalAmount) || 0), 0),
    [filtered]
  );

  return (
    <Workspace>
        <PageHeader
          eyebrow="Archive ventes"
          title="Ventes supprimées"
          description="Journal d'audit des suppressions : montant, raison et auteur de chaque suppression."
          actions={
          <Link to="/sales" className="ms-button ms-button-secondary ms-button-md">
            Retour aux ventes
          </Link>
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <KPICard title="Suppressions" value={loading ? "—" : filtered.length} context={search ? "Après recherche" : "Total enregistré"} />
          <KPICard title="Montant concerné" value={loading ? "—" : cfa(totalAmount)} context="Somme des ventes supprimées" tone="danger" />
        </div>

        <Surface className="p-3">
          <SearchBox
            label="Rechercher dans les ventes supprimées"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, raison, auteur ou #vente…"
          />
        </Surface>

        {error && <EmptyState title="Erreur de chargement" description={error} />}

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <EmptyState
                title={search ? "Aucun résultat" : "Aucune vente supprimée"}
                description={search ? "Modifiez la recherche pour élargir les résultats." : "L'historique des suppressions apparaîtra ici."}
              />
            ) : (
              filtered.map((entry) => {
                const snapshot = entry?.saleSnapshot || {};
                const saleId = snapshot?._id || entry?.saleId;
                const saleIdLabel = saleId ? String(saleId).slice(-6) : "—";
                const clientName =
                  snapshot?.client?.name || snapshot?.clientName || "Client non spécifié";
                const totalAmountRow = Number(snapshot?.totalAmount) || 0;
                const saleDate = snapshot?.saleDate;
                const deletedBy =
                  entry?.deletedBy?.name || entry?.deletedBy?.email || "Utilisateur inconnu";

                return (
                  <Surface
                    key={entry._id}
                    className="space-y-3 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="danger">Supprimée</StatusBadge>
                        <span className="fui-body1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>
                          Vente #{saleIdLabel}
                        </span>
                      </div>
                      <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>
                        Supprimée le {formatDate(entry?.deletedAt)} par <span className="fui-caption1-strong" style={{ color: "var(--colorNeutralForeground2)" }}>{deletedBy}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <span className="block fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Client</span>
                        <span className="fui-caption1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{clientName}</span>
                      </div>
                      <div>
                        <span className="block fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Montant</span>
                        <span className="fui-caption1-strong tabular-nums" style={{ color: "var(--colorNeutralForeground1)" }}>
                          {cfa(totalAmountRow)}
                        </span>
                      </div>
                      <div>
                        <span className="block fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Date de vente</span>
                        <span className="fui-caption1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{formatDate(saleDate)}</span>
                      </div>
                    </div>

                    <div
                      className="rounded-[var(--radiusMedium)] border p-3 text-sm"
                      style={{
                        borderColor: "var(--colorStatusDangerStroke1)",
                        background: "var(--colorStatusDangerBackground1)",
                        color: "var(--colorStatusDangerForeground1)",
                      }}
                    >
                      <div className="font-semibold">Raison de suppression</div>
                      <div>{entry?.deletionReason || "Aucune raison renseignée."}</div>
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
