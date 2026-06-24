import { confirmDialog } from '../components/ConfirmProvider';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  Button,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
  StatusBadge,
  Surface,
  Workspace,
} from '../components/business';
import {
  AlertCircle,
  CalendarClock,
  ExternalLink,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'rent_payment', label: 'Loyer / Paiement loyer' },
  { value: 'insurance', label: 'Assurance' },
  { value: 'contract', label: 'Contrat' },
  { value: 'other', label: 'Autre' },
];

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sortDocumentsByDate = (items) =>
  [...items].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime());

const typeLabel = (value) => DOCUMENT_TYPES.find((t) => t.value === value)?.label || value || 'Autre';

// File-type visual metadata derived from the file extension.
const getFileMeta = (fileName = '') => {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return { label: 'PDF', Icon: FileText, bg: 'rgba(209,52,56,0.12)', fg: 'var(--ms-danger)' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp'].includes(ext)) return { label: 'Image', Icon: ImageIcon, bg: 'rgba(14,116,144,0.12)', fg: '#0e7490' };
  if (['doc', 'docx'].includes(ext)) return { label: 'Word', Icon: FileText, bg: 'var(--ms-blue-soft)', fg: 'var(--ms-blue)' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'Excel', Icon: FileSpreadsheet, bg: 'rgba(16,124,16,0.12)', fg: 'var(--ms-success)' };
  return { label: ext ? ext.toUpperCase() : 'Fichier', Icon: FileIcon, bg: 'var(--colorNeutralBackground3)', fg: 'var(--ms-text-muted)' };
};

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [years, setYears] = useState([]);
  const [yearFilter, setYearFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({
    type: 'fiscal',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const fetchYears = async () => {
    try {
      const res = await api.get('/documents/years');
      setYears(res.data || []);
    } catch (err) {
      console.error('Error fetching years:', err);
    }
  };

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = yearFilter ? `?year=${yearFilter}` : '';
      const res = await api.get(`/documents${params}`);
      setDocuments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement des documents.');
    } finally {
      setLoading(false);
    }
  }, [yearFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchYears();
  }, []);

  const shouldIncludeDocumentInCurrentFilter = useCallback((document) => {
    if (!yearFilter) return true;
    const year = new Date(document?.date).getFullYear();
    return String(year) === String(yearFilter);
  }, [yearFilter]);

  const syncYearsFromDocuments = useCallback((docs) => {
    const nextYears = [...new Set(
      docs
        .map((doc) => new Date(doc?.date).getFullYear())
        .filter((year) => Number.isFinite(year))
    )].sort((a, b) => b - a);
    setYears(nextYears);
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Veuillez sélectionner un fichier.');
      return;
    }
    if (!form.date) {
      toast.error('La date est requise.');
      return;
    }
    try {
      setUploading(true);
      setError('');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', form.type);
      fd.append('note', form.note);
      fd.append('date', form.date);
      const { data } = await api.post('/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document enregistré.');
      setShowUpload(false);
      setForm({ type: 'fiscal', note: '', date: new Date().toISOString().slice(0, 10) });
      setFile(null);
      if (shouldIncludeDocumentInCurrentFilter(data)) {
        setDocuments((prev) => sortDocumentsByDate([data, ...prev]));
      }
      syncYearsFromDocuments([...documents, data]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Erreur lors de l’envoi.';
      toast.error(msg);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirmDialog('Supprimer ce document ?')) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Document supprimé.');
      const remainingDocuments = documents.filter((document) => document._id !== id);
      setDocuments(remainingDocuments);
      syncYearsFromDocuments(remainingDocuments);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression.');
    }
  };

  const closeUpload = () => {
    if (uploading) return;
    setShowUpload(false);
    setForm({ type: 'fiscal', note: '', date: new Date().toISOString().slice(0, 10) });
    setFile(null);
  };

  /* ------- Derived data ------- */
  const typeCounts = useMemo(() => {
    const counts = {};
    documents.forEach((d) => { counts[d.type] = (counts[d.type] || 0) + 1; });
    return counts;
  }, [documents]);

  const stats = useMemo(() => {
    const distinctTypes = new Set(documents.map((d) => d.type)).size;
    const latest = documents.reduce((max, d) => {
      const t = new Date(d?.date).getTime();
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    return { total: documents.length, distinctTypes, latest: latest ? new Date(latest) : null };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((d) => {
      const typeOk = !typeFilter || d.type === typeFilter;
      const text = `${d.fileName || ''} ${d.note || ''}`.toLowerCase();
      const searchOk = !term || text.includes(term);
      return typeOk && searchOk;
    });
  }, [documents, typeFilter, search]);

  const isFiltered = Boolean(typeFilter || search.trim());

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Entreprise"
        title="Documents"
        description="Pièces fiscales, loyers, assurances, contrats et autres documents."
        actions={<Button variant="primary" onClick={() => setShowUpload(true)}><Plus className="h-4 w-4" /> Ajouter un document</Button>}
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard title="Documents" value={stats.total} context={yearFilter ? `Année ${yearFilter}` : 'Toutes les années'} icon={<FolderOpen className="h-4 w-4" />} tone="brand" />
        <KPICard title="Catégories" value={stats.distinctTypes} context={`${DOCUMENT_TYPES.length} types disponibles`} icon={<Layers className="h-4 w-4" />} tone="neutral" />
        <KPICard title="Dernier ajout" value={stats.latest ? formatDate(stats.latest) : '—'} context="Date la plus récente" icon={<CalendarClock className="h-4 w-4" />} tone="neutral" />
      </div>

      {/* Toolbar */}
      <Surface className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBox
            label="Rechercher un document"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom de fichier ou note…"
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="doc-year" className="text-sm font-semibold text-[var(--ms-text-muted)]">Année</label>
            <select id="doc-year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="form-control w-auto min-w-[140px]">
              <option value="">Toutes</option>
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-2">
          {[{ value: '', label: 'Tous' }, ...DOCUMENT_TYPES].map((t) => {
            const count = t.value ? (typeCounts[t.value] || 0) : documents.length;
            const active = typeFilter === t.value;
            return (
              <button
                key={t.value || 'all'}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-transparent bg-[var(--ms-blue)] text-white'
                    : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-[var(--ms-surface-muted)]'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-white/20' : 'bg-[var(--ms-white)] text-[var(--ms-text-muted)]'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </Surface>

      {/* Results */}
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : documents.length === 0 ? (
        <EmptyState
          title={`Aucun document${yearFilter ? ` pour ${yearFilter}` : ''}`}
          description="Ajoutez vos documents fiscaux, loyers, contrats et autres pièces."
          action={<Button variant="primary" onClick={() => setShowUpload(true)}><Plus className="h-4 w-4" /> Ajouter un document</Button>}
        />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          description="Aucun document ne correspond à votre recherche ou au filtre sélectionné."
          action={<Button onClick={() => { setSearch(''); setTypeFilter(''); }}>Réinitialiser les filtres</Button>}
        />
      ) : (
        <>
          <p className="text-sm text-[var(--ms-text-muted)]">
            <span className="font-semibold text-[var(--ms-text)]">{filteredDocuments.length}</span>
            {filteredDocuments.length > 1 ? ' documents' : ' document'}
            {isFiltered ? ' (filtrés)' : ''}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((doc) => {
              const meta = getFileMeta(doc.fileName);
              const { Icon } = meta;
              return (
                <article key={doc._id} className="ms-surface flex h-full flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.bg, color: meta.fg }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="neutral">{typeLabel(doc.type)}</StatusBadge>
                        <span className="text-xs font-medium" style={{ color: meta.fg }}>{meta.label}</span>
                      </div>
                      <p className="mt-1.5 truncate font-semibold text-[var(--ms-text-strong)]" title={doc.fileName}>{doc.fileName}</p>
                      <p className="text-xs text-[var(--ms-text-muted)]">{formatDate(doc.date)}</p>
                    </div>
                  </div>

                  {doc.note && <p className="mt-3 line-clamp-2 text-sm text-[var(--ms-text-muted)]">{doc.note}</p>}

                  <div className="mt-auto flex items-center gap-2 border-t border-[var(--ms-border)] pt-3">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-button ms-button-secondary ms-button-sm flex-1 justify-center no-underline"
                    >
                      <ExternalLink className="h-4 w-4" /> Ouvrir
                    </a>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(doc._id)} aria-label="Supprimer le document">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal
        show={showUpload}
        onClose={closeUpload}
        title="Ajouter un document"
        subtitle="Fiscal, loyer, contrat… (PDF, Word, Excel ou images — 5 Mo max)"
        size="md"
        icon={<FileText className="h-5 w-5" />}
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="form-control" required>
                {DOCUMENT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
            <div>
              <label className="form-label mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="form-control" required />
            </div>
          </div>
          <div>
            <label className="form-label mb-1 block">Note (optionnel)</label>
            <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} placeholder="Ex. Reçu loyer mars 2024" className="form-control resize-y" />
          </div>
          <div>
            <label className="form-label mb-1 block">Fichier</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-bg-subtle)] px-4 py-6 text-center transition-colors hover:bg-[var(--ms-surface-muted)]">
              <FolderOpen className="h-6 w-6 text-[var(--ms-text-muted)]" />
              <span className="text-sm font-medium text-[var(--ms-text)]">
                {file ? file.name : 'Cliquez pour choisir un fichier'}
              </span>
              <span className="text-xs text-[var(--ms-text-muted)]">PDF, Word, Excel ou images · Max 5 Mo</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="sr-only"
                required
              />
            </label>
          </div>
          <div className="flex flex-col-reverse justify-end gap-3 border-t border-[var(--ms-border)] pt-4 sm:flex-row">
            <Button type="button" variant="secondary" onClick={closeUpload} disabled={uploading}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={uploading}>
              {uploading ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Envoi…</>) : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>
    </Workspace>
  );
};

export default Documents;
