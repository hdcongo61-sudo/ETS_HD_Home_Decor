import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart3, Boxes, Download, Upload, Plus, X, RefreshCw, FileSpreadsheet,
  Check, Play, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  Workspace, PageHeader, Surface, StatusBadge, KPICard, EmptyState,
  LoadingSkeleton, DataTable,
} from '../components/business';
import { confirmDialog } from '../components/ConfirmProvider';
import { reportingApi } from '../features/reporting/api';
import { formatCfa as cfa } from '../utils/format';
import { formatDate } from '../utils/saleUtils';

const TABS = [
  { key: 'sales', label: 'Rapport ventes', icon: BarChart3 },
  { key: 'inventory', label: 'Rapport inventaire', icon: Boxes },
  { key: 'exports', label: 'Exports', icon: Download },
  { key: 'imports', label: 'Imports produits', icon: Upload },
];

const JOB_TONE = {
  pending: 'neutral', processing: 'info', running: 'info', completed: 'success',
  failed: 'danger', uploaded: 'info', validated: 'info', confirmed: 'info', invalid: 'danger',
};

const asList = (data, field) => (Array.isArray(data) ? data : (Array.isArray(data?.[field]) ? data[field] : []));

const Reporting = () => {
  const [tab, setTab] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState(null);
  const [invReport, setInvReport] = useState(null);
  const [exportsJobs, setExportsJobs] = useState([]);
  const [importsJobs, setImportsJobs] = useState([]);
  const [currentImport, setCurrentImport] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [salesFilters, setSalesFilters] = useState({ groupBy: 'day', from: '', to: '', page: 1 });
  const [minStockOnly, setMinStockOnly] = useState(false);
  const [exportForm, setExportForm] = useState({ type: 'sales', from: '', to: '' });
  const [showExportForm, setShowExportForm] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');

  const pollRef = useRef(null);

  const loadSalesReport = useCallback(async () => {
    try {
      const params = { groupBy: salesFilters.groupBy, page: salesFilters.page, limit: 50 };
      if (salesFilters.from) params.from = salesFilters.from;
      if (salesFilters.to) params.to = salesFilters.to;
      const { data } = await reportingApi.salesReport(params);
      setSalesReport(data.report || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rapport ventes indisponible.');
    }
  }, [salesFilters]);

  const loadInventoryReport = useCallback(async () => {
    try {
      const { data } = await reportingApi.inventoryReport({ limit: 500, minStockOnly });
      setInvReport(data.report || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rapport inventaire indisponible.');
    }
  }, [minStockOnly]);

  const loadExports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await reportingApi.listExports({ limit: 50 });
      setExportsJobs(asList(data, 'jobs'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Exports indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadImports = useCallback(async () => {
    try {
      const { data } = await reportingApi.listImports({ limit: 50 });
      setImportsJobs(asList(data, 'jobs'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Imports indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (tab === 'sales') loadSalesReport();
    else if (tab === 'inventory') loadInventoryReport();
    else if (tab === 'exports') loadExports();
    else if (tab === 'imports') loadImports();
  }, [tab, loadSalesReport, loadInventoryReport, loadExports, loadImports]);

  // Auto-poll des exports tant qu'un job est actif.
  useEffect(() => {
    const hasActive = exportsJobs.some((j) => ['pending', 'processing'].includes(j.status));
    if (tab !== 'exports' || !hasActive) return undefined;
    pollRef.current = setInterval(() => loadExports(true), 4000);
    return () => clearInterval(pollRef.current);
  }, [tab, exportsJobs, loadExports]);

  const createExport = async (e) => {
    e.preventDefault();
    try {
      const filters = {};
      if (exportForm.from) filters.from = exportForm.from;
      if (exportForm.to) filters.to = exportForm.to;
      await reportingApi.createExport(exportForm.type, filters);
      toast.success('Export lancé — il sera prêt dans quelques secondes.');
      setShowExportForm(false);
      loadExports(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lancement impossible.');
    }
  };

  const downloadExport = async (job) => {
    try {
      setBusyId(job._id);
      const { data } = await reportingApi.exportJob(job._id);
      const token = data?.result?.downloadToken;
      if (!token) { toast.error('Fichier pas encore disponible.'); return; }
      window.open(reportingApi.downloadUrl(job._id, token), '_blank', 'noopener');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Téléchargement impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const uploadCsv = async (e) => {
    e.preventDefault();
    if (!csv.trim()) { toast.error('Collez du CSV (colonnes : name, description, category, price[, sku, stock]).'); return; }
    try {
      const { data } = await reportingApi.uploadProducts({ csv, fileName: fileName || 'import.csv' });
      setCurrentImport(data);
      toast.success('Import téléversé — vérifiez les erreurs avant confirmation.');
      loadImports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Téléversement impossible.');
    }
  };

  const confirmImport = async () => {
    if (!currentImport) return;
    if (!(await confirmDialog('Confirmer cet import ? Les lignes valides seront prêtes à être exécutées.', { confirmLabel: 'Confirmer' }))) return;
    try {
      setBusyId(currentImport._id);
      const { data } = await reportingApi.confirmImport(currentImport._id);
      setCurrentImport(data);
      loadImports();
      toast.success('Import confirmé — lancez l’exécution.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Confirmation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const runImport = async () => {
    if (!currentImport) return;
    try {
      setBusyId(currentImport._id);
      const { data } = await reportingApi.runImport(currentImport._id);
      setCurrentImport(data);
      loadImports();
      toast.success('Import en cours d’exécution…');
      const timer = setInterval(async () => {
        try {
          const { data: fresh } = await reportingApi.importJob(currentImport._id);
          setCurrentImport(fresh);
          if (['completed', 'failed'].includes(fresh.status)) clearInterval(timer);
        } catch { clearInterval(timer); }
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Exécution impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const importRowStats = useMemo(() => {
    const rows = currentImport?.rows || [];
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      created: rows.filter((r) => r.status === 'created').length,
      skipped: rows.filter((r) => r.status === 'skipped').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      invalidRows: rows.filter((r) => r.status === 'invalid').slice(0, 20),
    };
  }, [currentImport]);

  const invRows = useMemo(() => {
    const rows = asList(invReport?.rows, 'rows');
    return rows.length ? rows : (Array.isArray(invReport) ? invReport : []);
  }, [invReport]);

  if (loading && tab !== 'sales') {
    return (
      <Workspace>
        <PageHeader eyebrow="Rapports v2" title="Rapports, exports & imports" description="Agrégats de ventes, inventaire, exports asynchrones et imports en lots." />
        <LoadingSkeleton rows={6} />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <PageHeader
        eyebrow="Rapports v2"
        title="Rapports, exports & imports"
        description="Ventes agrégées par période, état des stocks, exports asynchrones signés et imports produits par lots."
        actions={
          <button type="button" className="ms-button ms-button-secondary ms-button-md" onClick={() => (tab === 'exports' ? loadExports(true) : loadSalesReport())}>
            <RefreshCw size={16} /> Actualiser
          </button>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections rapports">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key ? 'ms-button ms-button-primary ms-button-md' : 'ms-button ms-button-secondary ms-button-md'}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ── Rapport ventes ── */}
      {tab === 'sales' && (
        <Surface className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="form-control w-40">
              <span className="fui-caption1 mb-1">Regrouper par</span>
              <select className="form-control" value={salesFilters.groupBy} onChange={(e) => setSalesFilters({ ...salesFilters, groupBy: e.target.value, page: 1 })}>
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </label>
            <label className="form-control">
              <span className="fui-caption1 mb-1">Du</span>
              <input type="date" className="form-control" value={salesFilters.from} onChange={(e) => setSalesFilters({ ...salesFilters, from: e.target.value, page: 1 })} />
            </label>
            <label className="form-control">
              <span className="fui-caption1 mb-1">Au</span>
              <input type="date" className="form-control" value={salesFilters.to} onChange={(e) => setSalesFilters({ ...salesFilters, to: e.target.value, page: 1 })} />
            </label>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={loadSalesReport}>Appliquer</button>
          </div>

          {salesReport ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KPICard title="Commandes" value={salesReport.summary?.orders || 0} />
                <KPICard title="Facturé" value={cfa(salesReport.summary?.invoiced || 0)} tone="info" />
                <KPICard title="Encaissé" value={cfa(salesReport.summary?.collected || 0)} tone="success" />
                <KPICard title="Restant dû" value={cfa(salesReport.summary?.outstanding || 0)} tone="warning" />
              </div>
              {(salesReport.periods || []).length === 0 ? (
                <EmptyState title="Aucune donnée" description="Aucune vente sur la période sélectionnée." />
              ) : (
                <DataTable>
                  <table className="ms-table">
                    <thead>
                      <tr>
                        <th>Période</th><th className="text-right">Commandes</th>
                        <th className="text-right">Facturé</th><th className="text-right">Encaissé</th>
                        <th className="text-right">Restant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesReport.periods || []).map((p) => (
                        <tr key={p.period}>
                          <td className="font-mono">{p.period}</td>
                          <td className="text-right">{p.orders}</td>
                          <td className="text-right">{cfa(p.invoiced)}</td>
                          <td className="text-right">{cfa(p.collected)}</td>
                          <td className="text-right">{cfa(p.outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              )}
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button" className="btn-ghost"
                  disabled={salesFilters.page <= 1}
                  onClick={() => setSalesFilters({ ...salesFilters, page: salesFilters.page - 1 })}
                >
                  ← Précédent
                </button>
                <span className="fui-caption1">Page {salesReport.page || 1}</span>
                <button
                  type="button" className="btn-ghost"
                  disabled={(salesReport.periods || []).length < (salesReport.limit || 50)}
                  onClick={() => setSalesFilters({ ...salesFilters, page: salesFilters.page + 1 })}
                >
                  Suivant →
                </button>
              </div>
            </>
          ) : (
            <LoadingSkeleton rows={4} />
          )}
        </Surface>
      )}

      {/* ── Rapport inventaire ── */}
      {tab === 'inventory' && (
        <Surface className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={minStockOnly} onChange={(e) => setMinStockOnly(e.target.checked)} />
              <span className="fui-body1">Sous le seuil minimal uniquement</span>
            </label>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={loadInventoryReport}>Appliquer</button>
          </div>
          {invRows.length === 0 ? (
            <EmptyState title="Aucun solde" description="Aucune ligne de stock v2 pour l'instant." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Produit</th><th>SKU</th>
                    <th className="text-right">En stock</th>
                    <th className="text-right">Réservé</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-right">Coût unit.</th>
                    <th className="text-right">Seuil min.</th>
                  </tr>
                </thead>
                <tbody>
                  {invRows.map((row, idx) => (
                    <tr key={row.productId || idx}>
                      <td>{row.name || '—'}</td>
                      <td className="font-mono">{row.sku || '—'}</td>
                      <td className="text-right">{row.onHand}</td>
                      <td className="text-right">{row.reserved || 0}</td>
                      <td className="text-right">
                        <StatusBadge tone={Number(row.available) < Number(row.minStockLevel || 0) ? 'warning' : 'success'}>
                          {row.available}
                        </StatusBadge>
                      </td>
                      <td className="text-right">{cfa(row.unitCost || 0)}</td>
                      <td className="text-right">{row.minStockLevel || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Exports ── */}
      {tab === 'exports' && (
        <Surface className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="fui-subtitle1">Exports asynchrones</h2>
            <button type="button" className="ms-button ms-button-primary ms-button-md" onClick={() => setShowExportForm((v) => !v)}>
              {showExportForm ? <X size={16} /> : <Plus size={16} />} {showExportForm ? 'Fermer' : 'Nouvel export'}
            </button>
          </div>

          {showExportForm && (
            <form onSubmit={createExport} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Type</span>
                  <select className="form-control" value={exportForm.type} onChange={(e) => setExportForm({ ...exportForm, type: e.target.value })}>
                    <option value="sales">Ventes</option>
                    <option value="inventory">Inventaire</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Du</span>
                  <input type="date" className="form-control" value={exportForm.from} onChange={(e) => setExportForm({ ...exportForm, from: e.target.value })} />
                </label>
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Au</span>
                  <input type="date" className="form-control" value={exportForm.to} onChange={(e) => setExportForm({ ...exportForm, to: e.target.value })} />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary"><Download size={16} /> Lancer l'export</button>
              </div>
            </form>
          )}

          {exportsJobs.length === 0 ? (
            <EmptyState title="Aucun export" description="Lancez un export ventes ou inventaire." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Type</th><th>Date</th><th>Statut</th><th>Erreur</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exportsJobs.map((job) => (
                    <tr key={job._id}>
                      <td><FileSpreadsheet size={14} className="mr-1 inline" /> {job.type}</td>
                      <td>{formatDate(job.createdAt)}</td>
                      <td>
                        <StatusBadge tone={JOB_TONE[job.status] || 'neutral'}>
                          {['pending', 'processing'].includes(job.status) ? <Loader2 size={12} className="inline animate-spin" /> : null} {job.status}
                        </StatusBadge>
                      </td>
                      <td className="max-w-[200px] truncate">{job.error || '—'}</td>
                      <td className="text-right whitespace-nowrap">
                        {job.status === 'completed' && (
                          <button type="button" className="btn-ghost" disabled={busyId === job._id} onClick={() => downloadExport(job)}>
                            <Download size={14} /> Télécharger
                          </button>
                        )}
                        {job.status !== 'completed' && <span className="fui-caption1">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}

      {/* ── Imports ── */}
      {tab === 'imports' && (
        <Surface className="p-4">
          <h2 className="fui-subtitle1 mb-4">Import produits (CSV)</h2>
          <form onSubmit={uploadCsv} className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="form-control md:col-span-2">
                <span className="fui-caption1 mb-1">Contenu CSV</span>
                <textarea
                  className="form-control font-mono" rows="6"
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder={'name,description,category,price,sku,stock\nSavon naturel,Savon au karité,Soins,2500,SAV001,40'}
                />
              </label>
              <div className="flex flex-col gap-3">
                <label className="form-control">
                  <span className="fui-caption1 mb-1">Nom du fichier</span>
                  <input type="text" className="form-control" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="produits.csv" />
                </label>
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Colonnes requises : name, description, category, price. Optionnelles : sku, stock.
                </p>
                <button type="submit" className="btn-primary"><Upload size={16} /> Téléverser</button>
              </div>
            </div>
          </form>

          {currentImport && (
            <div className="mb-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="fui-body1-strong">Import en cours : <span className="font-mono">{String(currentImport._id).slice(-6)}</span></h3>
                <StatusBadge tone={JOB_TONE[currentImport.status] || 'neutral'}>{currentImport.status}</StatusBadge>
                {['uploaded', 'validated'].includes(currentImport.status) && (
                  <button type="button" className="btn-ghost" disabled={busyId === currentImport._id} onClick={confirmImport}>
                    <Check size={14} /> Confirmer
                  </button>
                )}
                {['confirmed', 'validated'].includes(currentImport.status) && (
                  <button type="button" className="btn-ghost" disabled={busyId === currentImport._id} onClick={runImport}>
                    <Play size={14} /> Exécuter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KPICard title="Lignes" value={importRowStats.total} />
                <KPICard title="Valides" value={importRowStats.valid} tone="success" />
                <KPICard title="Erreurs" value={importRowStats.invalid} tone="danger" />
                <KPICard title="Créées" value={importRowStats.created} tone="info" />
              </div>
              {importRowStats.invalidRows.length > 0 && (
                <div className="mt-3">
                  <p className="fui-body1-strong mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} style={{ color: 'var(--colorStatusWarningForeground1)' }} /> Lignes en erreur
                  </p>
                  <ul className="fui-caption1" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                    {importRowStats.invalidRows.map((row, i) => (
                      <li key={i}>Ligne {row.rowNumber || i + 1} : {(row.errors || []).join(' ; ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <h3 className="fui-body1-strong mt-4 mb-2">Historique des imports</h3>
          {importsJobs.length === 0 ? (
            <EmptyState title="Aucun import" description="Téléversez un CSV pour importer des produits par lots." />
          ) : (
            <DataTable>
              <table className="ms-table">
                <thead>
                  <tr>
                    <th>Fichier</th><th>Date</th><th>Statut</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {importsJobs.map((job) => (
                    <tr key={job._id}>
                      <td>{job.fileName || '—'}</td>
                      <td>{formatDate(job.createdAt)}</td>
                      <td><StatusBadge tone={JOB_TONE[job.status] || 'neutral'}>{job.status}</StatusBadge></td>
                      <td className="text-right">
                        <button type="button" className="btn-ghost" onClick={async () => {
                          try {
                            const { data } = await reportingApi.importJob(job._id);
                            setCurrentImport(data);
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Impossible de charger cet import.');
                          }
                        }}>
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
          )}
        </Surface>
      )}
    </Workspace>
  );
};

export default Reporting;
