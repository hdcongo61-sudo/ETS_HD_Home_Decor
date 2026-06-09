import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Button } from './business';
import { Upload, Download, X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const HEADER_LABELS = {
  name: 'Nom *',
  description: 'Description',
  price: 'Prix *',
  stock: 'Stock *',
  category: 'Catégorie',
  costPrice: 'Prix de revient',
  supplierName: 'Fournisseur',
  supplierPhone: 'Tél. fournisseur',
  container: 'Conteneur',
  warehouse: 'Entrepôt',
  sku: 'SKU',
  minStockLevel: 'Stock min.',
};

const getRowPreview = (row, headers) => {
  const visibleHeaders = headers.length > 0 ? headers : Object.keys(row || {});
  return visibleHeaders
    .map((header) => {
      const value = row?.[header];
      if (value === undefined || value === null || value === '') return null;
      return `${header}: ${String(value)}`;
    })
    .filter(Boolean)
    .join(' | ');
};

const ProductImportModal = ({ isOpen, onClose, onImported }) => {
  const { suppressGlobalModals } = useModal();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    return suppressGlobalModals();
  }, [isOpen, suppressGlobalModals]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (data.length === 0) {
          toast.error('Le fichier Excel est vide.');
          return;
        }
        const cols = Object.keys(data[0]);
        setHeaders(cols);
        setRows(data);
      } catch (err) {
        toast.error('Impossible de lire le fichier. Vérifiez le format.');
        setRows([]);
        setHeaders([]);
      }
    };
    reader.readAsBinaryString(f);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { data } = await api.post('/products/import', { products: rows });
      setResults(data);
      if (data.created > 0) {
        toast.success(data.message);
        if (onImported) onImported(data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      name: 'Exemple Produit',
      description: 'Description du produit',
      price: 5000,
      stock: 10,
      category: 'Meubles',
      costPrice: 3000,
      supplierName: 'Fournisseur SARL',
      supplierPhone: '+243000000000',
      container: 'CONT-001',
      warehouse: 'Entrepôt A',
      sku: 'SKU-001',
      minStockLevel: 5,
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, 'modele_import_produits.xlsx');
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[260] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-md"
      style={{ top: 'var(--app-nav-offset, 0px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-700" />
            Importer des produits depuis Excel
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Step 1: Upload */}
          {!results && (
            <>
              <div className="rounded-xl border border-dashed border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-[var(--ms-text-muted)] mb-3" />
                <p className="text-sm font-medium text-[var(--ms-text)] mb-1">
                  {file ? file.name : 'Sélectionnez un fichier Excel (.xlsx, .xls)'}
                </p>
                <p className="text-xs text-[var(--ms-text-muted)] mb-4">
                  Colonnes acceptées : Nom, Prix, Stock, Catégorie, Description, Prix de revient, Fournisseur, Conteneur, Entrepôt, SKU
                </p>
                <div className="flex items-center justify-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="inline-flex items-center gap-2 min-h-[38px] px-4 rounded-md bg-[var(--ms-blue)] text-white text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choisir un fichier
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-2 min-h-[38px] px-4 rounded-md border border-[var(--ms-border)] bg-white text-[var(--ms-text)] text-sm font-medium hover:bg-[var(--ms-bg-subtle)] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger le modèle
                  </button>
                </div>
              </div>

              {/* Preview */}
              {rows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[var(--ms-text-strong)]">
                      Aperçu — {rows.length} ligne{rows.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[var(--ms-border)]">
                    <table className="w-full text-[12px]">
                      <thead className="bg-[var(--ms-bg-subtle)]">
                        <tr>
                          {headers.slice(0, 8).map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--ms-text)] whitespace-nowrap">
                              {HEADER_LABELS[h] || h}
                            </th>
                          ))}
                          {headers.length > 8 && (
                            <th className="px-3 py-2 text-left font-semibold text-[var(--ms-text)]">
                              +{headers.length - 8}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ms-border)]">
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-[var(--ms-bg-subtle)]">
                            {headers.slice(0, 8).map((h) => (
                              <td key={h} className="px-3 py-2 text-[var(--ms-text)] whitespace-nowrap max-w-[150px] truncate">
                                {String(row[h] ?? '')}
                              </td>
                            ))}
                            {headers.length > 8 && (
                              <td className="px-3 py-2 text-[var(--ms-text-muted)]">...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <p className="text-[11px] text-[var(--ms-text-muted)] mt-1 text-center">
                      Affichage des 5 premières lignes sur {rows.length}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              <div className={`rounded-xl p-5 ${results.errors.length === 0 ? 'bg-green-50 border border-green-200' : results.created > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {results.errors.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <p className="font-semibold text-gray-900">{results.message}</p>
                </div>
                {results.errors.length > 0 && (
                  <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <div key={i} className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-800">
                        <p className="font-semibold">
                          Ligne {err.row}: {err.message}
                        </p>
                        <p className="mt-1 break-words text-red-700">
                          {getRowPreview(rows[Number(err.row) - 2], headers) || 'Données de la ligne indisponibles'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm font-medium text-[var(--ms-blue)] hover:underline"
              >
                ← Importer un autre fichier
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!results && (
          <div className="flex justify-between items-center gap-3 px-5 py-4 sm:px-6 border-t border-gray-100 bg-gray-50/30">
            <button
              type="button"
              onClick={handleReset}
              disabled={!file}
              className="text-sm text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] disabled:opacity-40"
            >
              Réinitialiser
            </button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={rows.length === 0 || importing}
              >
                {importing ? 'Importation...' : `Importer ${rows.length} produit${rows.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImportModal;
