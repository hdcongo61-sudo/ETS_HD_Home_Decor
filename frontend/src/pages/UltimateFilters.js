import { formatCfa } from '../utils/format';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, BarChart3, Boxes, Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Copy, FileText, Filter, Info, Landmark, Package, Receipt, RefreshCw, Save, ShoppingCart, Sparkles, TrendingUp, Trash2, UserCog, Users, X } from 'lucide-react';
import { Workspace } from '../components/business';
import SectionError from '../components/SectionError';
import { platformApi } from '../features/platform/api';
import { catalogApi } from '../features/catalog/api';
import { attributeApi } from '../services/variantApi';
import AdvancedFilters from '../components/AdvancedFilters';
import { SALES_FILTERS, PRODUCTS_FILTERS, EXPENSES_FILTERS, CLIENTS_FILTERS, EMPLOYEES_FILTERS, BANK_FILTERS, DOCUMENTS_FILTERS, populateDynamicOptions } from '../config/filterConfigs';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const STORAGE_KEY = 'ultimate-filters-saved-views-v1';
const COMBINED_FILTERS = [
  { key: 'saleSearch', type: 'search', label: 'Référence / promotion / note', placeholder: 'Référence de vente, code promo ou note...', icon: ShoppingCart, quick: true },
  { key: 'dateRange', type: 'dateRange', label: 'Date de vente', quick: true },
  { key: 'status', type: 'select', label: 'Statut de vente', quick: true, options: [
    { value: 'pending', label: 'En attente' }, { value: 'partially_paid', label: 'Partiellement payée' },
    { value: 'completed', label: 'Terminée' }, { value: 'cancelled', label: 'Annulée' },
    { value: 'partially_returned', label: 'Partiellement retournée' }, { value: 'returned', label: 'Retournée' },
  ] },
  { key: 'paymentMethod', type: 'select', label: 'Mode de paiement', quick: true, options: [
    { value: 'cash', label: 'Espèces' }, { value: 'MobileMoney', label: 'Mobile Money' }, { value: 'credit', label: 'Crédit' },
  ] },
  { key: 'saleType', type: 'select', label: 'Type de vente', quick: false, options: [
    { value: 'normal', label: 'Détail' }, { value: 'wholesale', label: 'Gros' },
  ] },
  { key: 'deliveryStatus', type: 'select', label: 'Livraison', quick: false, options: [
    { value: 'pending', label: 'En attente' }, { value: 'delivered', label: 'Livrée' }, { value: 'not_delivered', label: 'Non livrée' },
  ] },
  { key: 'deliveryDateRange', type: 'dateRange', label: 'Date de livraison', quick: false },
  { key: 'deliveryNote', type: 'text', label: 'Note de livraison', placeholder: 'Texte contenu dans la note...', quick: false },
  { key: 'clientSearch', type: 'text', label: 'Nom du client', placeholder: 'Rechercher un client...', quick: false },
  { key: 'locationId', type: 'select', label: 'Point de vente', quick: false, options: [] },
  { key: 'sellerId', type: 'select', label: 'Vendeur', quick: false, options: [] },
  { key: 'recordedDateRange', type: 'dateRange', label: 'Date d’enregistrement', quick: false },
  { key: 'hasProforma', type: 'select', label: 'Origine pro forma', quick: false, options: [
    { value: 'true', label: 'Issue d’un pro forma' }, { value: 'false', label: 'Sans pro forma' },
  ] },
  { key: 'taxInclusive', type: 'select', label: 'Taxe incluse', quick: false, options: [
    { value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' },
  ] },
  { key: 'taxLabel', type: 'text', label: 'Libellé de taxe', placeholder: 'Ex. TVA...', quick: false },
  { key: 'amountRange', type: 'amount', label: 'Montant total vente (CFA)', quick: false, min: 0, step: 1000 },
  { key: 'discountRange', type: 'amount', label: 'Remise de vente (CFA)', quick: false, min: 0, step: 500 },
  { key: 'taxRange', type: 'amount', label: 'Taxe de vente (CFA)', quick: false, min: 0, step: 500 },
  { key: 'profitRange', type: 'amount', label: 'Bénéfice de vente (CFA)', quick: false, step: 1000 },
  { key: 'profitMarginRange', type: 'number', label: 'Marge bénéficiaire (%)', quick: false, step: 1 },
  { key: 'paymentDetailMethod', type: 'select', label: 'Mode de paiement enregistré', quick: false, options: [
    { value: 'cash', label: 'Espèces' }, { value: 'MobileMoney', label: 'Mobile Money' }, { value: 'credit', label: 'Crédit' },
  ] },
  { key: 'paymentDateRange', type: 'dateRange', label: 'Date du règlement', quick: false },
  { key: 'paidAmountRange', type: 'amount', label: 'Montant d’un règlement (CFA)', quick: false, min: 0, step: 1000 },
  { key: 'hasReminder', type: 'select', label: 'Rappel de paiement', quick: false, options: [
    { value: 'true', label: 'Configuré' }, { value: 'false', label: 'Non configuré' },
  ] },
  { key: 'reminderStatus', type: 'select', label: 'Statut du rappel', quick: false, options: [
    { value: 'pending', label: 'En attente' }, { value: 'sent', label: 'Envoyé' }, { value: 'cancelled', label: 'Annulé' },
  ] },
  { key: 'reminderRange', type: 'dateRange', label: 'Date du rappel', quick: false },
  { key: 'lastReminderRange', type: 'dateRange', label: 'Date du dernier rappel', quick: false },
  { key: 'reminderChannel', type: 'select', label: 'Canal de relance', quick: false, options: [
    { value: 'whatsapp', label: 'WhatsApp' }, { value: 'call', label: 'Appel' },
    { value: 'sms', label: 'SMS' }, { value: 'email', label: 'E-mail' }, { value: 'manual', label: 'Manuel' },
  ] },
  { key: 'reminderSearch', type: 'text', label: 'Note de relance', placeholder: 'Texte contenu dans la relance...', quick: false },
  { key: 'stockDeducted', type: 'select', label: 'Déduction du stock', quick: false, options: [
    { value: 'true', label: 'Déjà déduit' }, { value: 'false', label: 'Non déduit' },
  ] },
  { key: 'quantityRange', type: 'number', label: 'Quantité vendue par ligne', quick: false, min: 0, step: 1 },
  { key: 'linePriceRange', type: 'amount', label: 'Prix de vente unitaire (CFA)', quick: false, min: 0, step: 1000 },
  { key: 'profitCategory', type: 'select', label: 'Catégorie de bénéfice', quick: false, options: [
    { value: 'faible', label: 'Faible' }, { value: 'moyen', label: 'Moyen' },
    { value: 'élevé', label: 'Élevé' }, { value: 'excellent', label: 'Excellent' },
  ] },
  { key: 'productSearch', type: 'search', label: 'Produit / SKU / code-barres', placeholder: 'Nom, description, SKU, code-barres...', icon: Package, quick: true },
  { key: 'category', type: 'select', label: 'Catégorie produit', quick: true, options: [] },
  { key: 'supplierName', type: 'select', label: 'Fournisseur', quick: false, options: [] },
  { key: 'container', type: 'select', label: 'Conteneur', quick: false, options: [] },
  { key: 'warehouse', type: 'select', label: 'Entrepôt', quick: false, options: [] },
  { key: 'isActive', type: 'select', label: 'État du produit', quick: false, options: [
    { value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' },
  ] },
  { key: 'priceRange', type: 'amount', label: 'Prix catalogue (CFA)', quick: false, min: 0, step: 1000 },
  { key: 'costPriceRange', type: 'amount', label: 'Prix de revient (CFA)', quick: false, min: 0, step: 1000 },
  { key: 'stockRange', type: 'number', label: 'Stock actuel', quick: false, min: 0, step: 1 },
  { key: 'minStockLevelRange', type: 'number', label: 'Seuil de stock faible', quick: false, min: 0, step: 1 },
  { key: 'sku', type: 'text', label: 'SKU exact', placeholder: 'Référence SKU...', quick: false },
  { key: 'barcode', type: 'text', label: 'Code-barres exact', placeholder: 'Code-barres...', quick: false },
  { key: 'batchNumber', type: 'text', label: 'Numéro de lot', placeholder: 'Numéro de lot...', quick: false },
  { key: 'supplierPhone', type: 'text', label: 'Téléphone fournisseur', placeholder: 'Téléphone...', quick: false },
  { key: 'slug', type: 'text', label: 'Slug produit', placeholder: 'Slug...', quick: false },
  { key: 'hasImage', type: 'select', label: 'Image produit', quick: false, options: [
    { value: 'true', label: 'Avec image' }, { value: 'false', label: 'Sans image' },
  ] },
  { key: 'lowStock', type: 'select', label: 'Niveau de stock', quick: false, options: [
    { value: 'true', label: 'Stock faible ou épuisé' }, { value: 'false', label: 'Stock supérieur au seuil' },
  ] },
  { key: 'activityType', type: 'select', label: 'Activité produit', quick: false, options: [
    { value: 'creation', label: 'Création' }, { value: 'stock_update', label: 'Mise à jour du stock' },
    { value: 'price_update', label: 'Mise à jour du prix' }, { value: 'sale', label: 'Vente' },
    { value: 'return', label: 'Retour' }, { value: 'view', label: 'Consultation' }, { value: 'adjustment', label: 'Ajustement' },
  ] },
  { key: 'createdBy', type: 'select', label: 'Produit créé par', quick: false, options: [] },
  { key: 'updatedBy', type: 'select', label: 'Produit modifié par', quick: false, options: [] },
  { key: 'productCreatedRange', type: 'dateRange', label: 'Date de création produit', quick: false },
  { key: 'productUpdatedRange', type: 'dateRange', label: 'Date de modification produit', quick: false },
  { key: 'expiryRange', type: 'dateRange', label: 'Date d’expiration produit', quick: false },
  { key: 'viewsRange', type: 'number', label: 'Vues produit', quick: false, min: 0, step: 1 },
  { key: 'conversionRateRange', type: 'number', label: 'Taux de conversion (%)', quick: false, min: 0, max: 100, step: 1 },
  { key: 'returnsRange', type: 'number', label: 'Retours produit', quick: false, min: 0, step: 1 },
];
const FILTER_PAGES = [
  { id: 'sales', title: 'Ventes', icon: ShoppingCart, config: SALES_FILTERS, endpoint: '/sales', color: 'var(--colorStatusSuccessForeground1)', description: 'Repérez les ventes à encaisser, livrer ou analyser.', link: '/sales' },
  { id: 'combined', title: 'Ventes + produits', icon: Sparkles, config: COMBINED_FILTERS, endpoint: '/sales/product-analysis', color: 'var(--colorBrandForeground1)', description: 'Croisez les critères de vente avec les propriétés du catalogue et ses attributs de variante.', link: '/sales' },
  { id: 'products', title: 'Produits', icon: Package, config: PRODUCTS_FILTERS, endpoint: '/products', color: 'var(--ms-blue)', description: 'Identifiez les produits à réapprovisionner, déprécier ou mettre en avant.', link: '/products' },
  { id: 'expenses', title: 'Dépenses', icon: Receipt, config: EXPENSES_FILTERS, endpoint: '/expenses', color: 'var(--colorStatusDangerForeground1)', description: 'Contrôlez les dépenses par période, catégorie et montant.', link: '/expenses' },
  { id: 'clients', title: 'Clients', icon: Users, config: CLIENTS_FILTERS, endpoint: '/clients', color: 'var(--colorStatusSuccessForeground1)', description: 'Construisez des segments utiles pour le suivi et la fidélisation.', link: '/clients' },
  { id: 'employees', title: 'Employés', icon: UserCog, config: EMPLOYEES_FILTERS, endpoint: '/employees', color: 'var(--colorBrandForeground1)', description: 'Analysez les équipes par poste, salaire et ancienneté.', link: '/employees' },
  { id: 'bank', title: 'Banque', icon: Landmark, config: BANK_FILTERS, endpoint: '/bank', color: 'var(--colorStatusWarningForeground1)', description: 'Suivez les entrées et sorties de trésorerie.', link: '/bank' },
  { id: 'documents', title: 'Documents', icon: FileText, config: DOCUMENTS_FILTERS, endpoint: '/documents', color: 'var(--colorNeutralForeground2)', description: 'Retrouvez rapidement les documents par type et période.', link: '/documents' },
];
const PRESETS = {
  sales: [{ id: 'sales-outstanding', label: 'À encaisser', filters: { paymentStatus: 'partial' } }, { id: 'sales-today', label: "Aujourd'hui", filters: { dateRange: { start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) } } }],
  combined: [
    { id: 'combined-month', label: 'Ventes du mois', filters: { dateRange: { start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) } } },
    { id: 'combined-low-stock', label: 'Produits en stock faible', filters: { lowStock: 'true' } },
    { id: 'combined-wholesale', label: 'Ventes en gros', filters: { saleType: 'wholesale' } },
  ],
  products: [{ id: 'products-low-stock', label: 'Stock faible', filters: { stockStatus: 'low_stock' } }, { id: 'products-out', label: 'Ruptures', filters: { stockStatus: 'out_of_stock' } }],
  expenses: [{ id: 'expenses-month', label: 'Ce mois', filters: { dateRange: { start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) } } }],
  clients: [{ id: 'clients-debt', label: 'Avec dette', filters: { hasDebt: 'yes' } }], employees: [], bank: [], documents: [],
};
const readRows = payload => { const body = payload?.data ?? payload; if (Array.isArray(body)) return body; if (Array.isArray(body?.data)) return body.data; for (const key of ['sales', 'products', 'expenses', 'clients', 'employees', 'users', 'transactions', 'documents', 'items']) if (Array.isArray(body?.[key])) return body[key]; return []; };
const readMeta = payload => { const body = payload?.data ?? payload; return body?.pagination ? { ...body.pagination, summary: body.summary, variantAttributeFilters: body.variantAttributeFilters } : body?.meta || {}; };
const buildQueryParams = (filters = {}) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return;
    const datePrefixes = {
      dateRange: '', hireDateRange: '', expiryRange: 'expiry', deliveryDateRange: 'delivery',
      paymentDateRange: 'payment', reminderRange: 'reminder', recordedDateRange: 'recorded',
      lastReminderRange: 'lastReminder',
      productCreatedRange: 'productCreated', productUpdatedRange: 'productUpdated',
    };
    if (Object.prototype.hasOwnProperty.call(datePrefixes, key)) {
      const prefix = datePrefixes[key];
      if (value.start) params[prefix ? `${prefix}Start` : 'startDate'] = value.start;
      if (value.end) params[prefix ? `${prefix}End` : 'endDate'] = value.end;
      return;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const rangeNames = {
        amountRange: 'Amount', discountRange: 'Discount', taxRange: 'Tax', profitRange: 'Profit',
        priceRange: 'Price', costPriceRange: 'CostPrice', stockRange: 'Stock',
        minStockLevelRange: 'Threshold', viewsRange: 'Views',
        conversionRateRange: 'ConversionRate', returnsRange: 'Returns', profitMarginRange: 'ProfitMargin',
        paidAmountRange: 'PaidAmount', quantityRange: 'Quantity', linePriceRange: 'LinePrice',
      };
      const rangeName = rangeNames[key];
      if (rangeName) {
        if (value.min !== undefined && value.min !== '') params[`min${rangeName}`] = value.min;
        if (value.max !== undefined && value.max !== '') params[`max${rangeName}`] = value.max;
      }
      return;
    }
    params[key] = Array.isArray(value) ? value.join(',') : value;
  });
  return params;
};
const encodeState = (tab, filters) => encodeURIComponent(JSON.stringify({ tab, filters }));
const decodeState = value => { try { const parsed = JSON.parse(decodeURIComponent(value)); return FILTER_PAGES.some(page => page.id === parsed.tab) ? parsed : null; } catch { return null; } };
const filterCount = filters => Object.values(filters || {}).filter(value => Array.isArray(value) ? value.length : typeof value === 'string' ? value.trim() : typeof value === 'object' && value ? Object.values(value).some(Boolean) : value !== undefined && value !== null).length;

const UltimateFiltersPage = () => {
  const navigate = useNavigate(); const location = useLocation();
  const initialState = useMemo(() => { const value = new URLSearchParams(location.search).get('state'); return value ? decodeState(value) : null; }, [location.search]);
  const [activeTab, setActiveTab] = useState(initialState?.tab || 'sales');
  const [filtersByTab, setFiltersByTab] = useState({ [initialState?.tab || 'sales']: initialState?.filters || {} });
  const [viewRevision, setViewRevision] = useState(0); const [data, setData] = useState([]); const [meta, setMeta] = useState({}); const [loading, setLoading] = useState(false); const [loadError, setLoadError] = useState(null); const [lastUpdated, setLastUpdated] = useState(null); const [pageNumber, setPageNumber] = useState(1);
  const [users, setUsers] = useState([]); const [categories, setCategories] = useState([]); const [suppliers, setSuppliers] = useState([]); const [containers, setContainers] = useState([]); const [warehouses, setWarehouses] = useState([]); const [locations, setLocations] = useState([]); const [variantAttributes, setVariantAttributes] = useState([]); const [optionsLoadError, setOptionsLoadError] = useState(false); const [showSavedViews, setShowSavedViews] = useState(false);
  const [savedViews, setSavedViews] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }); const requestId = useRef(0);
  const activeConfig = FILTER_PAGES.find(page => page.id === activeTab) || FILTER_PAGES[0]; const activeFilters = useMemo(() => filtersByTab[activeTab] || {}, [filtersByTab, activeTab]); const presets = PRESETS[activeTab] || [];
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([platformApi.users(), catalogApi.fieldValues(), attributeApi.list(), platformApi.locations()]).then(results => {
      if (cancelled) return;
      const [usersResult, fieldsResult, attributesResult, locationsResult] = results;
      results.forEach(result => {
        if (result.status === 'rejected') console.error('Error loading filter options:', result.reason);
      });
      setOptionsLoadError(results.some(result => result.status === 'rejected'));
      if (usersResult.status === 'fulfilled') {
        const usersData = Array.isArray(usersResult.value?.data) ? usersResult.value.data : usersResult.value?.data?.users || [];
        setUsers(usersData.map(user => ({ value: user._id, label: user.name })));
      }
      if (fieldsResult.status === 'fulfilled') {
        const fields = fieldsResult.value?.data || {};
        setCategories((fields.categories || []).map(value => ({ value, label: value })));
        setSuppliers((fields.suppliers || []).map(supplier => ({ value: supplier.name, label: supplier.name })));
        setContainers((fields.containers || []).map(value => ({ value, label: value })));
        setWarehouses((fields.warehouses || []).map(value => ({ value, label: value })));
      }
      if (attributesResult.status === 'fulfilled') {
        const attributesData = Array.isArray(attributesResult.value?.data) ? attributesResult.value.data : [];
        setVariantAttributes(attributesData.filter(attribute => attribute.isActive && attribute.filterable && attribute.variantAxis));
      }
      if (locationsResult.status === 'fulfilled') {
        const locationsData = Array.isArray(locationsResult.value?.data) ? locationsResult.value.data : [];
        setLocations(locationsData.map(location => ({ value: location._id, label: location.name })));
      }
    });
    return () => { cancelled = true; };
  }, []);
  const filterConfig = useMemo(() => {
    const config = populateDynamicOptions(activeConfig.config, {
      createdBy: users, updatedBy: users, sellerId: users, locationId: locations, category: categories, supplier: suppliers,
      supplierName: suppliers, container: containers, warehouse: warehouses,
      position: [{ value: 'manager', label: 'Manager' }, { value: 'vendeur', label: 'Vendeur' }, { value: 'caissier', label: 'Caissier' }, { value: 'magasinier', label: 'Magasinier' }],
    });
    if (activeTab !== 'combined') return config;
    const variantFilters = variantAttributes.map(attribute => {
      const options = (attribute.options || []).map(value => ({ value, label: value }));
      if (attribute.dataType === 'boolean') options.push({ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' });
      return {
        key: `variant_${attribute.key}`,
        type: attribute.dataType === 'select' ? 'select' : attribute.dataType === 'multiselect' ? 'multiselect' : attribute.dataType === 'boolean' ? 'select' : 'text',
        label: `Variante · ${attribute.label}`,
        placeholder: attribute.dataType === 'select' || attribute.dataType === 'boolean' ? 'Toutes' : 'Contient…',
        options,
        quick: false,
      };
    });
    return [...config, ...variantFilters];
  }, [activeConfig, activeTab, users, categories, suppliers, containers, warehouses, locations, variantAttributes]);
  const loadData = useCallback(async (tab, filters, selectedPage = pageNumber) => { const pageConfig = FILTER_PAGES.find(item => item.id === tab); if (!pageConfig) return; const currentRequest = ++requestId.current; setLoading(true); setLoadError(null); setMeta({}); try { const params = buildQueryParams(filters); if (tab === 'combined') { params.page = selectedPage; params.limit = 30; } const response = await api.get(pageConfig.endpoint, { params }); if (currentRequest !== requestId.current) return; const rows = readRows(response); setData(tab === 'combined' ? rows.map(item => ({ ...item, name: `${item.product?.name || 'Produit'}${item.reference ? ` · ${item.reference}` : ''}`, category: [item.product?.category, item.quantity ? `Qté ${item.quantity}` : '', item.client?.name, item.seller?.name, item.saleDate ? new Date(item.saleDate).toLocaleDateString('fr-FR') : '', item.status, item.paymentMethod].filter(Boolean).join(' · '), totalAmount: item.lineAmount })) : rows); setMeta(readMeta(response)); setLastUpdated(new Date()); } catch (error) { if (currentRequest === requestId.current) setLoadError(error); } finally { if (currentRequest === requestId.current) setLoading(false); } }, [pageNumber]);
  useEffect(() => { const timeout = window.setTimeout(() => loadData(activeTab, activeFilters, pageNumber), 300); return () => window.clearTimeout(timeout); }, [activeTab, activeFilters, loadData, pageNumber]);
  const updateFilters = nextFilters => { setPageNumber(1); setFiltersByTab(current => ({ ...current, [activeTab]: nextFilters })); window.history.replaceState({}, '', `${location.pathname}?state=${encodeState(activeTab, nextFilters)}`); };
  const switchTab = tab => { setPageNumber(1); setActiveTab(tab); const nextFilters = filtersByTab[tab] || {}; window.history.replaceState({}, '', `${location.pathname}?state=${encodeState(tab, nextFilters)}`); };
  const applyPreset = preset => { updateFilters({ ...preset.filters }); setViewRevision(value => value + 1); toast.success(`Vue « ${preset.label} » appliquée`); }; const resetFilters = () => { updateFilters({}); setViewRevision(value => value + 1); };
  const saveCurrentView = () => { const name = window.prompt('Nom de cette vue'); if (!name?.trim()) return; const view = { id: `${Date.now()}`, name: name.trim(), tab: activeTab, filters: activeFilters, createdAt: new Date().toISOString() }; const next = [view, ...savedViews].slice(0, 20); setSavedViews(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setShowSavedViews(true); toast.success('Vue enregistrée'); };
  const deleteView = id => { const next = savedViews.filter(view => view.id !== id); setSavedViews(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }; const applySavedView = view => { setPageNumber(1); setActiveTab(view.tab); setFiltersByTab(current => ({ ...current, [view.tab]: view.filters })); setViewRevision(value => value + 1); setShowSavedViews(false); window.history.replaceState({}, '', `${location.pathname}?state=${encodeState(view.tab, view.filters)}`); };
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); toast.success('Lien copié'); } catch { toast.error('Impossible de copier le lien'); } };
  const summary = useMemo(() => { const amountKey = activeTab === 'sales' ? 'totalAmount' : activeTab === 'expenses' ? 'amount' : activeTab === 'products' ? 'price' : null; return { count: data.length, total: activeTab === 'combined' ? Number(meta.summary?.lineAmount || 0) : amountKey ? data.reduce((sum, item) => sum + Number(item[amountKey] || 0), 0) : null }; }, [activeTab, data, meta]);
  const getExportRows = () => activeTab === 'combined'
    ? data.map(item => ({
      'Référence vente': item.reference || '',
      'Date vente': item.saleDate ? new Date(item.saleDate).toLocaleDateString('fr-FR') : '',
      'Date d’enregistrement': item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '',
      'Statut vente': item.status || '',
      'Mode de paiement': item.paymentMethod || '',
      'Type de vente': item.saleType || '',
      'Client': item.client?.name || '',
      'Vendeur': item.seller?.name || '',
      'Point de vente': item.location?.name || '',
      'Montant vente (CFA)': item.saleTotalAmount ?? '',
      'Règlements': (item.payments || []).map(payment => `${payment.method || ''} ${payment.amount ?? ''} ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('fr-FR') : ''}`.trim()).join(' | '),
      'Remise (CFA)': item.discountAmount ?? '',
      'Taxe (CFA)': item.taxAmount ?? '',
      'Taux de taxe (%)': item.taxRate ?? '',
      'Taxe incluse': item.taxInclusive ?? '',
      'Libellé de taxe': item.taxLabel || '',
      'Code promotionnel': item.promotionCode || '',
      'Bénéfice (CFA)': item.totalProfit ?? '',
      'Marge bénéficiaire (%)': item.profitMargin ?? '',
      'Catégorie de bénéfice': item.profitCategory || '',
      'Date de livraison': item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString('fr-FR') : '',
      'Note de livraison': item.deliveryNote || '',
      'Stock déduit': item.stockDeducted ?? '',
      'Rappel actif': item.paymentReminder?.isSet ?? '',
      'Date du rappel': item.paymentReminder?.reminderDate ? new Date(item.paymentReminder.reminderDate).toLocaleDateString('fr-FR') : '',
      'Statut du rappel': item.paymentReminder?.status || '',
      'Dernière relance': item.lastRemindedAt ? new Date(item.lastRemindedAt).toLocaleDateString('fr-FR') : '',
      'Issue d’un pro forma': item.hasProforma ?? '',
      'Produit': item.product?.name || '',
      'Catégorie produit': item.product?.category || '',
      'Slug produit': item.product?.slug || '',
      'SKU': item.product?.sku || '',
      'Code-barres': item.product?.barcode || '',
      'Numéro de lot': item.product?.batchNumber || '',
      'Fournisseur': item.product?.supplierName || '',
      'Téléphone fournisseur': item.product?.supplierPhone || '',
      'Entrepôt': item.product?.warehouse || '',
      'Conteneur': item.product?.container || '',
      'Prix catalogue (CFA)': item.product?.price ?? '',
      'Prix de revient (CFA)': item.product?.costPrice ?? '',
      'Quantité': item.quantity ?? '',
      'Prix unitaire (CFA)': item.priceAtSale ?? '',
      'Montant ligne (CFA)': item.lineAmount ?? '',
      'Stock actuel': item.product?.stock ?? '',
      'Seuil de stock': item.product?.minStockLevel ?? '',
      'Actif': item.product?.isActive ?? '',
      'Expiration': item.product?.expiryDate ? new Date(item.product.expiryDate).toLocaleDateString('fr-FR') : '',
      'Vues': item.product?.viewsCount ?? '',
      'Taux de conversion (%)': item.product?.conversionRate ?? '',
      'Retours': item.product?.returnsCount ?? '',
    }))
    : data;
  const exportToExcel = () => { const rows = getExportRows(); if (!rows.length) return toast.error('Aucune donnée à exporter'); const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, activeConfig.title); XLSX.writeFile(workbook, `${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`); };
  const exportToCSV = () => { const rows = getExportRows(); if (!rows.length) return toast.error('Aucune donnée à exporter'); const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => key !== '__v'); const csv = [keys.join(','), ...rows.map(row => keys.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n'); const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); };
  const exportToPDF = () => { const rows = getExportRows(); if (!rows.length) return toast.error('Aucune donnée à exporter'); const doc = new jsPDF(); doc.setFontSize(16); doc.text(`Rapport ${activeConfig.title}`, 14, 18); const keys = Object.keys(rows[0]).filter(key => !['_id', '__v'].includes(key)).slice(0, 6); doc.autoTable({ head: [keys], body: rows.map(row => keys.map(key => String(row[key] ?? ''))), startY: 28, styles: { fontSize: 7 }, headStyles: { fillColor: [41, 128, 185] } }); doc.save(`${activeTab}-${new Date().toISOString().slice(0, 10)}.pdf`); }; const handleExport = format => ({ excel: exportToExcel, csv: exportToCSV, pdf: exportToPDF }[format]?.());
  const combinedOverview = [
    { label: 'Ventes concernées', value: Number(meta.summary?.sales || 0).toLocaleString('fr-FR'), icon: ShoppingCart, detail: 'ventes distinctes' },
    { label: 'Lignes produit', value: Number(meta.total || 0).toLocaleString('fr-FR'), icon: Boxes, detail: 'lignes correspondantes' },
    { label: 'Articles vendus', value: Number(meta.summary?.quantity || 0).toLocaleString('fr-FR'), icon: Package, detail: 'quantité cumulée' },
    { label: 'Somme des lignes filtrées', value: formatCfa(meta.summary?.lineAmount), icon: CircleDollarSign, detail: 'montant des seuls produits filtrés' },
    { label: 'Total des ventes concernées', value: formatCfa(meta.summary?.saleAmount), icon: Receipt, detail: 'chaque vente comptée une fois' },
    { label: 'Panier moyen', value: formatCfa(meta.summary?.averageSaleAmount), icon: TrendingUp, detail: 'sur les ventes concernées' },
    { label: 'Produits trouvés au catalogue', value: Number(meta.summary?.matchedProducts || 0).toLocaleString('fr-FR'), icon: BarChart3, detail: 'selon les filtres produit' },
  ];
  return <Workspace><div className="space-y-5 pb-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-3"><button onClick={() => navigate('/')} className="ms-button ms-button-secondary ms-button-sm shrink-0"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Retour</span></button><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5" style={{ color: 'var(--ms-blue)' }} /><h1 className="fui-title3">Espace d’analyse</h1></div><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Filtrez, enregistrez et partagez une vue exploitable de vos données.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={copyLink} className="ms-button ms-button-secondary ms-button-sm"><Copy className="h-4 w-4" />Partager la vue</button><button onClick={saveCurrentView} className="ms-button ms-button-primary ms-button-sm"><Save className="h-4 w-4" />Enregistrer</button></div></div>
    {activeTab === 'combined' && <section aria-labelledby="combined-overview-title" className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h2 id="combined-overview-title" className="fui-subtitle2">Aperçu des résultats</h2><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Statistiques globales des résultats filtrés, toutes pages confondues.</p></div>{loading && <RefreshCw aria-label="Actualisation des statistiques" className="h-4 w-4 animate-spin" style={{ color: 'var(--ms-blue)' }} />}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{combinedOverview.map(({ label, value, icon: Icon, detail }) => <article key={label} className="fluent-card-filled min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p><p className="mt-2 break-words text-xl font-bold tabular-nums" aria-live="polite">{loading ? '—' : value}</p><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{detail}</p></div><span className="rounded-lg p-2" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}><Icon className="h-5 w-5" aria-hidden="true" /></span></div></article>)}</div></section>}
    <div className="rounded-[var(--radiusLarge)] border p-4" style={{ background: 'var(--ms-blue-soft)', borderColor: 'var(--colorBrandStroke1)' }}><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--colorBrandForeground1)' }} /><div><p className="fui-body1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>Commencez par une question métier</p><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>Choisissez un périmètre, appliquez un modèle, puis ouvrez le module concerné pour agir.</p></div></div></div>
    {optionsLoadError && <p role="alert" className="rounded-[var(--radiusMedium)] border border-[var(--colorStatusWarningStroke1)] px-3 py-2 fui-caption1" style={{ color: 'var(--colorStatusWarningForeground1)' }}>Certaines listes de filtres dynamiques n’ont pas pu être chargées. Les filtres libres restent disponibles ; actualisez la page pour réessayer.</p>}
    <div className="fluent-card-filled p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="h-5 w-5" style={{ color: 'var(--colorBrandForeground1)' }} /><h2 className="fui-subtitle2">Périmètre</h2></div><button onClick={() => setShowSavedViews(value => !value)} className="ms-button ms-button-secondary ms-button-sm"><Clock3 className="h-4 w-4" />Vues enregistrées ({savedViews.length})</button></div><div role="tablist" aria-label="Périmètre des données" className="flex gap-2 overflow-x-auto pb-1">{FILTER_PAGES.map(page => { const Icon = page.icon; const active = page.id === activeTab; return <button key={page.id} role="tab" aria-selected={active} onClick={() => switchTab(page.id)} className={`flex min-w-max items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${active ? 'border-[var(--ms-blue)] bg-[var(--ms-blue)] text-white' : 'border-[var(--colorNeutralStroke2)] hover:bg-[var(--colorNeutralBackground2)]'}`}><Icon className="h-4 w-4" />{page.title}</button>; })}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{activeConfig.description}</p><button onClick={() => navigate(activeConfig.link)} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--colorBrandForeground1)' }}>Ouvrir le module<ChevronRight className="h-4 w-4" /></button></div>{showSavedViews && <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">{savedViews.length === 0 ? <p className="fui-caption1">Aucune vue enregistrée.</p> : savedViews.map(view => <div key={view.id} className="flex items-center justify-between gap-2 rounded-[var(--radiusMedium)] border p-2" style={{ borderColor: 'var(--colorNeutralStroke2)' }}><button onClick={() => applySavedView(view)} className="min-w-0 truncate text-left text-sm font-semibold">{view.name}<span className="ml-2 text-xs font-normal" style={{ color: 'var(--colorNeutralForeground3)' }}>{FILTER_PAGES.find(page => page.id === view.tab)?.title}</span></button><button aria-label={`Supprimer ${view.name}`} onClick={() => deleteView(view.id)} className="rounded p-1 hover:bg-[var(--colorNeutralBackground2)]"><Trash2 className="h-4 w-4" /></button></div>)}</div>}</div>
    <div className="flex flex-wrap items-center gap-2">{presets.map(preset => <button key={preset.id} onClick={() => applyPreset(preset)} className="ms-button ms-button-secondary ms-button-sm"><Check className="h-4 w-4" />{preset.label}</button>)}{filterCount(activeFilters) > 0 && <button onClick={resetFilters} className="ms-button ms-button-ghost ms-button-sm"><X className="h-4 w-4" />Effacer les filtres</button>}</div>
    {activeTab === 'combined' && <div className="flex items-start gap-2 rounded-[var(--radiusMedium)] border p-3" style={{ background: 'var(--colorNeutralBackground2)', borderColor: 'var(--colorNeutralStroke2)' }}><Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--colorBrandForeground1)' }} /><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>Chaque résultat correspond à une ligne produit d’une vente. Les attributs de variante filtrent les variantes actuellement actives du produit : l’historique des ventes ne conserve pas l’identifiant de la variante vendue. L’export concerne la page affichée.</p></div>}
    <AdvancedFilters key={`${activeTab}-${viewRevision}`} filterConfig={filterConfig} initialFilters={activeFilters} onFilterChange={updateFilters} onExport={handleExport} showExport exportFormats={['excel', 'pdf', 'csv']} loading={loading} resultCount={activeTab === 'combined' ? Number(meta.total || data.length) : data.length} />
    <div className="fluent-card-filled p-3 sm:p-4"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="fui-subtitle2">Résultats</h2>{loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'var(--ms-blue)' }} />}<span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>{summary.count.toLocaleString('fr-FR')}</span></div><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{lastUpdated ? `Actualisé à ${lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'En attente de chargement'}{meta.total ? ` · ${Number(meta.total).toLocaleString('fr-FR')} au total` : ''}</p></div>{summary.total !== null && <div className="text-left sm:text-right"><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Valeur filtrée</p><p className="fui-body1-strong">{formatCfa(summary.total)}</p></div>}</div>{loadError && <SectionError title="Données non actualisées" error={loadError} onRetry={() => loadData(activeTab, activeFilters)} />}{!loadError && loading && data.length === 0 && <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin" style={{ color: 'var(--ms-blue)' }} /><span className="ml-3 fui-caption1">Chargement de {activeConfig.title.toLowerCase()}…</span></div>}{!loading && !loadError && data.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center"><AlertCircle className="h-10 w-10" style={{ color: 'var(--colorNeutralForeground3)' }} /><p className="mt-3 fui-body1-strong">Aucun résultat dans ce périmètre</p><p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Essayez un modèle rapide ou retirez un filtre.</p></div>}{data.length > 0 && <div className="space-y-2">{data.slice(0, 30).map((item, index) => <div key={item._id || index} className="flex flex-col gap-2 rounded-[var(--radiusMedium)] border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--colorNeutralStroke2)' }}><div className="min-w-0"><p className="fui-body1-strong truncate">{item.name || item.reference || item.description || item.title || item._id || `Élément ${index + 1}`}</p><p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>{item.category || item.client?.name || item.status || item.type || ''}</p></div>{(item.totalAmount || item.price || item.amount) !== undefined && <p className="fui-body1-strong tabular-nums sm:text-right">{formatCfa(Number(item.totalAmount || item.price || item.amount || 0))}</p>}</div>)}</div>}{data.length > 30 && <p className="mt-3 text-center fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>30 résultats affichés sur {data.length}. Utilisez l’export pour récupérer l’ensemble.</p>}</div>
    {activeTab === 'combined' && Number(meta.pages) > 1 && <div className="flex items-center justify-between gap-3"><p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Page {pageNumber.toLocaleString('fr-FR')} sur {Number(meta.pages).toLocaleString('fr-FR')}</p><div className="flex gap-2"><button type="button" className="ms-button ms-button-secondary ms-button-sm" disabled={loading || pageNumber <= 1} onClick={() => setPageNumber(current => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />Précédent</button><button type="button" className="ms-button ms-button-secondary ms-button-sm" disabled={loading || pageNumber >= Number(meta.pages)} onClick={() => setPageNumber(current => current + 1)}>Suivant<ChevronRight className="h-4 w-4" /></button></div></div>}
  </div></Workspace>;
};
export default UltimateFiltersPage;
