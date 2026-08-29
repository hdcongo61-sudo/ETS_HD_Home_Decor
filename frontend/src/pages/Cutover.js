import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Flag, Scale, RefreshCw, FileCheck2, ChevronRight, ShieldCheck,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  LoadingSkeleton, DataTable,
} from '../components/business';
import { reportingApi } from '../features/reporting/api';
import { formatDate } from '../utils/saleUtils';

/**
 * Cutover — bascule opérationnelle (Phase 8.3/8.4).
 *
 * Drapeaux de fonctionnalités par organisation (lecture v2), génération de
 * rapports de rapprochement archivés avec somme de contrôle SHA-256.
 */
const Cutover = () => {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({});
  const [defaults, setDefaults] = useState({});
  const [toggling, setToggling] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [fRes, rRes] = await Promise.all([
        reportingApi.flags(),
        reportingApi.cutoverReports(),
      ]);
      setFlags(fRes.data?.flags || {});
      setDefaults(fRes.data?.defaults || {});
      setReports(Array.isArray(rRes.data?.reports) ? rRes.data.reports : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de charger la bascule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFlag = async (key, current) => {
    try {
      setToggling(key);
      await reportingApi.setFlag(key, !current);
      setFlags((prev) => ({ ...prev, [key]: !current }));
      toast.success(`${defaults[key]?.label || key} ${current ? 'désactivé' : 'activé'}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Modification impossible.');
    } finally {
      setToggling(null);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      await reportingApi.cutoverReport();
      toast.success('Rapport de rapprochement généré et archivé.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Génération impossible.');
    } finally {
      setGenerating(false);
    }
  };

  const viewReport = async (id) => {
    try {
      setViewingId(id);
      const { data } = await reportingApi.cutoverReportById(id);
      setSelected(data?.report || data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rapport introuvable.');
    } finally {
      setViewingId(null);
    }
  };

  const enabledCount = Object.values(flags).filter(Boolean).length;

  if (loading) {
    return (
      <Workspace>
        <PageHeader eyebrow="Bascule v2" title="Bascule opérationnelle" description="Drapeaux de lecture v2 et rapports de rapprochement archivés." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Bascule v2"
        title="Bascule opérationnelle"
        description="Activez la lecture v2 par domaine et archivez des rapports de rapprochement horodatés (somme SHA-256)."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={load}>
            <RefreshCw size={16} /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KPICard title="Drapeaux actifs" value={`${enabledCount}/${Object.keys(flags).length}`} context="Lecture v2 par domaine" tone={enabledCount > 0 ? 'success' : 'neutral'} />
        <KPICard title="Rapports archivés" value={reports.length} context="Rapprochements générés" />
        <KPICard
          title="Écriture duale"
          value="Active"
          context="Les deux sources restent alimentées — un drapeau ne supprime rien"
          tone="info"
        />
      </div>

      {/* ── Drapeaux ── */}
      <Surface className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Flag size={18} />
          <h2 className="fui-subtitle1">Drapeaux de lecture v2</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Object.entries(flags).map(([key, value]) => {
            const meta = defaults[key] || {};
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
                <div className="min-w-0">
                  <p className="fui-body1-strong">{meta.label || key}</p>
                  <p className="fui-caption1 truncate font-mono">{key}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(value)}
                    disabled={toggling === key}
                    onChange={() => toggleFlag(key, Boolean(value))}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-[var(--colorNeutralStroke3)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--colorBrandBackground)] peer-checked:after:translate-x-full" />
                </label>
              </div>
            );
          })}
        </div>
        <p className="fui-caption1 mt-3">
          <ShieldCheck size={12} className="inline" /> Ces drapeaux ne contrôlent que la <strong>lecture</strong> — l'écriture duale reste active tant que la migration n'est pas terminée.
        </p>
      </Surface>

      {/* ── Rapports ── */}
      <Surface className="p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale size={18} />
            <h2 className="fui-subtitle1">Rapports de rapprochement archivés</h2>
          </div>
          <button type="button" className="ms-button ms-button-primary ms-button-md" disabled={generating} onClick={generateReport}>
            {generating ? <RefreshCw size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Générer maintenant
          </button>
        </div>

        {reports.length === 0 ? (
          <EmptyState title="Aucun rapport archivé" description="Générez un rapport de rapprochement pour figer l'état de vos données à un instant T." />
        ) : (
          <DataTable>
            <table className="ms-table">
              <thead>
                <tr>
                  <th>N°</th><th>Date</th><th>Somme de contrôle</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep._id}>
                    <td className="font-mono">{String(rep._id).slice(-6).toUpperCase()}</td>
                    <td>{formatDate(rep.createdAt)}</td>
                    <td className="font-mono max-w-[240px] truncate">{rep.checksum || '—'}</td>
                    <td className="text-right">
                      <button type="button" className="btn-ghost" disabled={viewingId === rep._id} onClick={() => viewReport(rep._id)}>
                        <ChevronRight size={14} /> Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}

        {selected && (
          <div className="mt-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="fui-body1-strong">Détail du rapport</h3>
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Fermer</button>
            </div>
            {selected.stats && (
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(selected.stats).map(([k, v]) => (
                  <div key={k} className="rounded-[var(--radiusMedium)] p-3" style={{ background: 'var(--colorNeutralBackground1)' }}>
                    <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{k}</p>
                    <p className="fui-body1-strong">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
                  </div>
                ))}
              </div>
            )}
            <pre className="fui-caption1 overflow-auto rounded-[var(--radiusMedium)] p-3 font-mono" style={{ background: 'var(--colorNeutralBackground1)', maxHeight: 320 }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        )}
      </Surface>

      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
        <StatusBadge tone="success">Phase 8</StatusBadge> La bascule définitive se fait organisation par organisation après validation des rapports — pas un déploiement de code.
      </p>
    </Workspace>
  );
};

export default Cutover;
