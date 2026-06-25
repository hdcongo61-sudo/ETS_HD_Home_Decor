import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Button } from './business';
import { Upload, Download, X, FileSpreadsheet, CheckCircle2, AlertTriangle, Ban, ArrowLeft } from 'lucide-react';
import { useModal } from '../context/ModalContext';

// Column aliases — must mirror the backend (productController.importProducts).
const NAME_KEYS = ['name', 'Name', 'Nom', 'nom'];
const PRICE_KEYS = ['price', 'Price', 'Prix', 'prix'];
const STOCK_KEYS = ['stock', 'Stock', 'Quantité', 'quantite', 'qty'];
const CAT_KEYS = ['category', 'Category', 'Catégorie', 'categorie'];
const COST_KEYS = ['costPrice', 'costprice', 'Prix de revient', 'prix de revient', 'cost'];
const SUPPLIER_KEYS = ['supplierName', 'supplier', 'Fournisseur', 'fournisseur'];
const SUPPLIER_PHONE_KEYS = ['supplierPhone', 'Téléphone fournisseur', 'telephone'];
const SKU_KEYS = ['sku', 'SKU', 'Référence', 'reference'];

const pick = (row, keys) => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
  }
  return '';
};

const toNumber = (v) => parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
const normalizeLookupName = (value) => String(value || '').trim().toLowerCase();

// Returns an array of human-readable reasons a row would be skipped. Empty = valid.
const getRowIssues = (row) => {
  const issues = [];
  const name = String(pick(row, NAME_KEYS)).trim();
  if (!name) issues.push('Nom manquant');

  const priceRaw = pick(row, PRICE_KEYS);
  const price = toNumber(priceRaw);
  if (priceRaw === '' ) issues.push('Prix manquant');
  else if (Number.isNaN(price) || price < 0) issues.push(`Prix invalide ("${priceRaw}")`);

  const stockRaw = pick(row, STOCK_KEYS);
  if (stockRaw !== '') {
    const stock = parseInt(stockRaw, 10);
    if (Number.isNaN(stock) || stock < 0) issues.push(`Stock invalide ("${stockRaw}")`);
  }
  return issues;
};

const normalizeForDisplay = (row, supplierPhoneByName = new Map()) => {
  const supplier = String(pick(row, SUPPLIER_KEYS)).trim();
  const providedSupplierPhone = String(pick(row, SUPPLIER_PHONE_KEYS)).trim();
  const lookupSupplierPhone = supplierPhoneByName.get(normalizeLookupName(supplier)) || '';

  return {
    name: String(pick(row, NAME_KEYS)).trim(),
    price: pick(row, PRICE_KEYS),
    stock: String(pick(row, STOCK_KEYS) || '0'),
    category: String(pick(row, CAT_KEYS)).trim() || 'Non catégorisé',
    costPrice: pick(row, COST_KEYS),
    supplier,
    supplierPhone: lookupSupplierPhone || providedSupplierPhone,
    sku: String(pick(row, SKU_KEYS)).trim(),
  };
};

const fmtPrice = (v) => {
  const n = toNumber(v);
  return Number.isNaN(n) ? String(v ?? '') : `${n.toLocaleString('fr-FR')} CFA`;
};

const MAX_RENDER = 250; // safety cap so very large files stay responsive

const ProductImportModal = ({ isOpen, onClose, onImported }) => {
  const { suppressGlobalModals } = useModal();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    return suppressGlobalModals();
  }, [isOpen, suppressGlobalModals]);

  useEffect(() => {
    if (!isOpen) return;
    api.get('/lookups/suppliers')
      .then(({ data }) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => setSuppliers([]));
  }, [isOpen]);

  const supplierPhoneByName = useMemo(
    () => new Map(
      suppliers
        .filter((supplier) => supplier?.name)
        .map((supplier) => [normalizeLookupName(supplier.name), supplier.phone || ''])
    ),
    [suppliers]
  );

  // Split parsed rows into what will / won't be imported.
  const { validRows, invalidRows } = useMemo(() => {
    const valid = [];
    const invalid = [];
    rows.forEach((row, index) => {
      const issues = getRowIssues(row);
      const entry = { row, index, rowNum: index + 2, display: normalizeForDisplay(row, supplierPhoneByName), issues };
      if (issues.length === 0) valid.push(entry);
      else invalid.push(entry);
    });
    return { validRows: valid, invalidRows: invalid };
  }, [rows, supplierPhoneByName]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (data.length === 0) {
          toast.error('Le fichier Excel est vide.');
          return;
        }
        setRows(data);
      } catch (err) {
        toast.error('Impossible de lire le fichier. Vérifiez le format.');
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    // Smooth "creep" toward 92% so the bar feels alive during server processing,
    // while the real upload phase drives the first 70%.
    const creep = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + Math.max(1, Math.round((92 - p) / 10))));
    }, 180);
    try {
      // Send ONLY the valid rows — the preview is authoritative.
      const { data } = await api.post(
        '/products/import',
        { products: validRows.map((v) => v.row) },
        {
          onUploadProgress: (e) => {
            if (e.total) setProgress((p) => Math.max(p, Math.round((e.loaded / e.total) * 70)));
          },
        }
      );
      clearInterval(creep);
      setProgress(100);
      setResults(data);
      if (data.created > 0) {
        toast.success(data.message);
        if (onImported) onImported(data);
      }
    } catch (err) {
      clearInterval(creep);
      setProgress(0);
      toast.error(err.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRows([]);
    setResults(null);
    setProgress(0);
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
      image: 'https://exemple.com/photo.jpg',
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, 'modele_import_produits.xlsx');
  };

  const hasFile = rows.length > 0;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end justify-center bg-[rgba(32,31,30,0.45)] p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Importer des produits"
    >
      <div
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow-lg)] sm:max-h-[90vh] sm:max-w-5xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber (mobile) */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[var(--ms-border)]" aria-hidden />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 pb-4 pt-3 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Importer des produits depuis Excel</h2>
              <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                {hasFile ? 'Vérifiez les lignes avant de confirmer l\'import.' : 'Importez votre catalogue en une fois.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="ms-icon-button shrink-0" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {/* Importing — progress */}
          {!results && importing && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                <FileSpreadsheet className="h-6 w-6 animate-pulse" />
              </div>
              <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                Importation de {validRows.length} produit{validRows.length > 1 ? 's' : ''}…
              </p>
              <p className="fui-caption1 mb-4 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                {progress < 70 ? 'Envoi des données…' : progress < 100 ? 'Création des produits sur le serveur…' : 'Terminé !'}
              </p>
              <div className="h-2 w-full max-w-sm overflow-hidden rounded-full" style={{ background: 'var(--colorNeutralBackground3)' }}>
                <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%`, background: 'var(--ms-blue)' }} />
              </div>
              <p className="fui-caption1-strong mt-2" style={{ color: 'var(--colorBrandForeground1)' }}>{progress}%</p>
            </div>
          )}

          {/* Step 1: Upload */}
          {!results && !importing && (
            <>
              <div className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-bg-subtle)] p-6 text-center">
                <Upload className="mx-auto mb-3 h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  {file ? file.name : 'Sélectionnez un fichier Excel (.xlsx, .xls)'}
                </p>
                <p className="fui-caption1 mx-auto mb-4 mt-1 max-w-lg" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Colonnes : Nom*, Prix*, Stock, Catégorie, Description, Prix de revient, Fournisseur, Conteneur, Entrepôt, SKU. (* obligatoire)
                </p>
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" id="excel-upload" />
                  <label htmlFor="excel-upload" className="ms-button ms-button-primary ms-button-md w-full cursor-pointer justify-center sm:w-auto">
                    <Upload className="h-4 w-4" />
                    {file ? 'Changer de fichier' : 'Choisir un fichier'}
                  </label>
                  <button type="button" onClick={handleDownloadTemplate} className="ms-button ms-button-secondary ms-button-md w-full justify-center sm:w-auto">
                    <Download className="h-4 w-4" />
                    Télécharger le modèle
                  </button>
                </div>
              </div>

              {/* Step 2: Two-panel review */}
              {hasFile && (
                <>
                  {/* Summary */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                      {rows.length} ligne{rows.length > 1 ? 's' : ''} lue{rows.length > 1 ? 's' : ''}
                    </span>
                    <span className="ms-status-badge ms-status-success">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{validRows.length} à importer
                    </span>
                    {invalidRows.length > 0 && (
                      <span className="ms-status-badge ms-status-warning">
                        <Ban className="mr-1 inline h-3.5 w-3.5" />{invalidRows.length} ignorée{invalidRows.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* WILL be imported */}
                    <section className="flex flex-col overflow-hidden rounded-[var(--radiusLarge)] border" style={{ borderColor: 'var(--colorStatusSuccessStroke1)' }}>
                      <header className="flex items-center justify-between gap-2 px-3.5 py-2.5" style={{ background: 'var(--colorStatusSuccessBackground1)' }}>
                        <span className="fui-subtitle2 inline-flex items-center gap-1.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                          <CheckCircle2 className="h-4 w-4" /> À importer
                        </span>
                        <span className="fui-caption1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{validRows.length}</span>
                      </header>
                      <ul className="max-h-[34vh] space-y-1.5 overflow-y-auto p-2.5 sm:max-h-[42vh]">
                        {validRows.length === 0 ? (
                          <li className="px-2 py-6 text-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune ligne valide à importer.</li>
                        ) : (
                          validRows.slice(0, MAX_RENDER).map((v) => (
                            <li key={v.index} className="rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{v.display.name}</span>
                                <span className="shrink-0 fui-body1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{fmtPrice(v.display.price)}</span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                                <span>Stock&nbsp;{v.display.stock}</span>
                                <span>· {v.display.category}</span>
                                {v.display.supplier && (
                                  <span>
                                    · {v.display.supplier}
                                    {v.display.supplierPhone ? ` (${v.display.supplierPhone})` : ''}
                                  </span>
                                )}
                                {v.display.sku && <span>· {v.display.sku}</span>}
                              </div>
                            </li>
                          ))
                        )}
                        {validRows.length > MAX_RENDER && (
                          <li className="px-2 py-1 text-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            +{validRows.length - MAX_RENDER} autres seront aussi importées
                          </li>
                        )}
                      </ul>
                    </section>

                    {/* Will NOT be imported */}
                    <section className="flex flex-col overflow-hidden rounded-[var(--radiusLarge)] border" style={{ borderColor: invalidRows.length ? 'var(--colorStatusDangerStroke1)' : 'var(--ms-border)' }}>
                      <header className="flex items-center justify-between gap-2 px-3.5 py-2.5" style={{ background: invalidRows.length ? 'var(--colorStatusDangerBackground1)' : 'var(--colorNeutralBackground2)' }}>
                        <span className="fui-subtitle2 inline-flex items-center gap-1.5" style={{ color: invalidRows.length ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground2)' }}>
                          <Ban className="h-4 w-4" /> Ne seront pas importées
                        </span>
                        <span className="fui-caption1-strong" style={{ color: invalidRows.length ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground2)' }}>{invalidRows.length}</span>
                      </header>
                      <ul className="max-h-[34vh] space-y-1.5 overflow-y-auto p-2.5 sm:max-h-[42vh]">
                        {invalidRows.length === 0 ? (
                          <li className="px-2 py-6 text-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            Parfait — toutes les lignes sont valides.
                          </li>
                        ) : (
                          invalidRows.slice(0, MAX_RENDER).map((v) => (
                            <li key={v.index} className="rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                                  {v.display.name || '(sans nom)'}
                                </span>
                                <span className="shrink-0 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Ligne {v.rowNum}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {v.issues.map((issue, k) => (
                                  <span key={k} className="ms-status-badge ms-status-danger">{issue}</span>
                                ))}
                              </div>
                            </li>
                          ))
                        )}
                        {invalidRows.length > MAX_RENDER && (
                          <li className="px-2 py-1 text-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            +{invalidRows.length - MAX_RENDER} autres lignes ignorées
                          </li>
                        )}
                      </ul>
                    </section>
                  </div>

                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    Les doublons de SKU et la limite de votre plan sont vérifiés au moment de l'import.
                  </p>
                </>
              )}
            </>
          )}

          {/* Step 3: Results */}
          {results && (
            <div className="space-y-4">
              <div
                className="fluent-card-filled p-5"
                style={{
                  borderColor: results.errors.length === 0 ? 'var(--colorStatusSuccessStroke1)' : 'var(--colorStatusWarningStroke1)',
                  background: results.errors.length === 0 ? 'var(--colorStatusSuccessBackground1)' : 'var(--colorStatusWarningBackground1)',
                }}
              >
                <div className="flex items-center gap-2">
                  {results.errors.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                  ) : (
                    <AlertTriangle className="h-5 w-5" style={{ color: 'var(--colorStatusWarningForeground1)' }} />
                  )}
                  <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{results.message}</p>
                </div>

                {results.errors.length > 0 && (
                  <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
                    {results.errors.map((err, i) => {
                      const src = validRows[Number(err.row) - 2];
                      return (
                        <div key={i} className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
                          <p className="fui-caption1-strong" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                            {src?.display?.name ? `${src.display.name} — ` : `Ligne ${err.row} — `}{err.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {invalidRows.length > 0 && (
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {invalidRows.length} ligne{invalidRows.length > 1 ? 's' : ''} non valide{invalidRows.length > 1 ? 's' : ''} avai{invalidRows.length > 1 ? 'ent' : 't'} été ignorée{invalidRows.length > 1 ? 's' : ''} avant l'import.
                </p>
              )}

              <button type="button" onClick={handleReset} className="ms-button ms-button-secondary ms-button-sm">
                <ArrowLeft className="h-4 w-4" />
                Importer un autre fichier
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!results && !importing && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={handleReset}
              disabled={!file}
              className="fui-caption1-strong disabled:opacity-40"
              style={{ color: 'var(--colorNeutralForeground2)' }}
            >
              Réinitialiser
            </button>
            <div className="flex gap-2 sm:gap-3">
              <Button variant="secondary" onClick={onClose}>Annuler</Button>
              <Button variant="primary" onClick={handleImport} disabled={validRows.length === 0 || importing}>
                {importing ? 'Importation...' : `Importer ${validRows.length} produit${validRows.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImportModal;
