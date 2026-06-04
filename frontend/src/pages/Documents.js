import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import toast, { Toaster } from 'react-hot-toast';
import {
  Button,
  CommandBar,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Workspace,
} from '../components/business';
import { FileText, Plus, Trash2 } from 'lucide-react';

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

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [years, setYears] = useState([]);
  const [yearFilter, setYearFilter] = useState('');
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
    if (!window.confirm('Supprimer ce document ?')) return;
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

  const typeLabel = (value) => DOCUMENT_TYPES.find((t) => t.value === value)?.label || value;

  return (
    <Workspace className="space-y-5">
      <Toaster position="top-right" />
      <PageHeader
        title="Documents de l'entreprise"
        description="Fiscaux, loyers, contrats et autres pièces"
        actions={<Button variant="primary" onClick={() => setShowUpload(true)}><Plus className="h-4 w-4" /> Ajouter un document</Button>}
      />
      {error && (<div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]"><svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>{error}</div>)}
      <CommandBar><div className="flex items-center gap-3"><label htmlFor="doc-year" className="text-sm font-semibold text-[var(--ms-text)]">Année</label><select id="doc-year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="form-control max-w-[200px]"><option value="">Toutes les années</option>{years.map((y) => (<option key={y} value={y}>{y}</option>))}</select></div></CommandBar>
      {loading ? (<LoadingSkeleton rows={5} />) : documents.length === 0 ? (
        <EmptyState
          title={`Aucun document${yearFilter ? ` pour ${yearFilter}` : ''}`}
          description="Ajoutez des documents fiscaux, loyers, contrats et autres pieces."
          action={<Button variant="primary" onClick={() => setShowUpload(true)}><Plus className="h-4 w-4" /> Ajouter un document</Button>}
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc._id} className="ms-surface flex flex-col sm:flex-row sm:items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StatusBadge tone="neutral">{typeLabel(doc.type)}</StatusBadge>
                  <span className="text-xs text-[var(--ms-text-muted)]">{formatDate(doc.date)}</span>
                </div>
                <p className="font-semibold text-[var(--ms-text)] truncate" title={doc.fileName}>{doc.fileName}</p>
                {doc.note && <p className="text-sm text-[var(--ms-text-muted)] mt-1 line-clamp-2">{doc.note}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="ms-button ms-button-secondary ms-button-sm inline-flex items-center gap-2 no-underline">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Ouvrir
                </a>
                <Button variant="danger" size="sm" onClick={() => handleDelete(doc._id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        show={showUpload}
        onClose={() => {
          if (!uploading) {
            setShowUpload(false);
            setForm({ type: 'fiscal', note: '', date: new Date().toISOString().slice(0, 10) });
            setFile(null);
          }
        }}
        title="Ajouter un document"
        subtitle="Fiscal, loyer, contrat... (PDF, images, 5 Mo max)"
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="form-label block mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="form-control" required>
              {DOCUMENT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div>
            <label className="form-label block mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="form-control" required />
          </div>
          <div>
            <label className="form-label block mb-1">Note (optionnel)</label>
            <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} placeholder="Ex. Recu loyer mars 2024" className="form-control" />
          </div>
          <div>
            <label className="form-label block mb-1">Fichier</label>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-[var(--ms-text)] file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--ms-blue-soft)] file:text-[var(--ms-blue)] file:font-semibold" required />
            <p className="form-help mt-1">PDF, Word, Excel ou images. Max 5 Mo.</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4 border-t border-[var(--ms-border)]">
            <Button type="button" variant="secondary" onClick={() => setShowUpload(false)} disabled={uploading}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={uploading}>
              {uploading ? (<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>) : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>
    </Workspace>
  );
};

export default Documents;
