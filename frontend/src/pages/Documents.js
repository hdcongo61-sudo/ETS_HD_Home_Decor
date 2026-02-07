import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import toast, { Toaster } from 'react-hot-toast';

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

  const fetchDocuments = async () => {
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
  };

  useEffect(() => {
    fetchDocuments();
  }, [yearFilter]);

  useEffect(() => {
    fetchYears();
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
      await api.post('/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document enregistré.');
      setShowUpload(false);
      setForm({ type: 'fiscal', note: '', date: new Date().toISOString().slice(0, 10) });
      setFile(null);
      fetchDocuments();
      fetchYears();
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
      fetchDocuments();
      fetchYears();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression.');
    }
  };

  const typeLabel = (value) => DOCUMENT_TYPES.find((t) => t.value === value)?.label || value;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <Toaster position="top-right" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Documents de l’entreprise</h1>
            <p className="text-sm text-gray-500">Fiscaux, loyers, contrats et autres pièces</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un document
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Filtre par année */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="doc-year" className="text-sm font-medium text-gray-700">Année</label>
        <select
          id="doc-year"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Toutes les années</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Aucun document{yearFilter ? ` pour ${yearFilter}` : ''}.</p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="mt-3 text-indigo-600 font-medium hover:underline"
          >
            Ajouter un document
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {typeLabel(doc.type)}
                  </span>
                  <span className="text-sm text-gray-500">{formatDate(doc.date)}</span>
                </div>
                <p className="font-medium text-gray-900 truncate mt-0.5" title={doc.fileName}>
                  {doc.fileName}
                </p>
                {doc.note && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{doc.note}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ouvrir
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(doc._id)}
                  className="min-h-[44px] p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  aria-label="Supprimer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal d’upload */}
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
        subtitle="Fiscal, loyer, contrat… (PDF, images, 15 Mo max)"
        size="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full min-h-[44px] px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
              placeholder="Ex. Reçu loyer mars 2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fichier</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">PDF, Word, Excel ou images. Max 15 Mo.</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              disabled={uploading}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium transition-colors w-full sm:w-auto"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Envoi…
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Documents;
