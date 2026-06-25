import { confirmDialog } from '../components/ConfirmProvider';
// src/pages/Products.jsx
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity } from '../utils/appBranding';
import LoaderOverlay from '../components/LoaderOverlay';
import AppLoader from '../components/AppLoader';
import toast from 'react-hot-toast';
import { productPath } from '../utils/paths';
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  PageHeader,
  RightDetailPanel,
  StatusBadge,
  Workspace,
} from '../components/business';
import {
  Download,
  Copy,
  Edit3,
  FileSpreadsheet,
  Package,
  PackageMinus,
  PackageCheck,
  Boxes,
  Wallet,
  AlertTriangle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import ProductImportModal from '../components/ProductImportModal';
import Modal from '../components/Modal';
import FeatureGate, { LockedFeatureButton } from '../components/FeatureGate';
import { FEATURE_KEYS } from '../config/features';

const sortProductsByName = (items) =>
  [...items].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'fr', { sensitivity: 'base' }));

const PRODUCT_PAGE_SIZE = 80;

const DEFAULT_PRODUCT_FILTERS = {
  product: '',
  category: '',
  container: '',
  warehouse: '',
  priceOperator: '',
  price: '',
  priceMax: '',
  stockOperator: '',
  stock: '',
  stockMax: '',
  supplier: '',
};

const PRODUCT_FILTER_QUERY_KEYS = Object.keys(DEFAULT_PRODUCT_FILTERS);

const readProductFiltersFromSearch = (search) => {
  const params = new URLSearchParams(search || '');
  return PRODUCT_FILTER_QUERY_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: params.get(key) || '',
    }),
    { ...DEFAULT_PRODUCT_FILTERS }
  );
};

const buildSearchFromProductFilters = (currentSearch, filters) => {
  const params = new URLSearchParams(currentSearch || '');

  PRODUCT_FILTER_QUERY_KEYS.forEach((key) => {
    const value = String(filters[key] || '').trim();
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  const next = params.toString();
  return next ? `?${next}` : '';
};

const Products = () => {
  const { auth } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const [products, setProducts] = useState([]);
  const [lossMap, setLossMap] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lookups, setLookups] = useState({ categories: [], containers: [], warehouses: [], suppliers: [] });
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchLookups = useCallback(async () => {
    try {
      const [cats, conts, whs, supps] = await Promise.all([
        api.get('/lookups/categories'),
        api.get('/lookups/containers'),
        api.get('/lookups/warehouses'),
        api.get('/lookups/suppliers'),
      ]);
      setLookups({
        categories: cats.data,
        containers: conts.data,
        warehouses: whs.data,
        suppliers: supps.data,
      });
      setLookupsLoaded(true);
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/products/loss-map').then(({ data }) => setLossMap(data.map || {})).catch(() => setLossMap({}));
  }, [isAdmin]);

  const fetchProducts = useCallback(async (options = {}) => {
    const { showLoading = true } = options;
    try {
      if (showLoading) setLoading(true);
      const response = await api.get('/products?summary=list');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // A sale created from the global modal decrements stock — refresh silently.
  useEffect(() => {
    const refresh = () => fetchProducts({ showLoading: false });
    window.addEventListener('saleCreated', refresh);
    return () => window.removeEventListener('saleCreated', refresh);
  }, [fetchProducts]);

  useEffect(() => {
    if (!isAdmin || !(isFormOpen || bulkOpen) || lookupsLoaded) return;
    fetchLookups();
  }, [fetchLookups, isAdmin, isFormOpen, bulkOpen, lookupsLoaded]);

  useEffect(() => {
    if (location.state?.fromProductEdit) {
      fetchProducts({ showLoading: false });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [fetchProducts, location.pathname, location.state?.fromProductEdit, navigate]);

  useEffect(() => {
    document.body.style.overflow = isFormOpen ? 'hidden' : 'auto';
  }, [isFormOpen]);

  const handleCreate = async (productData, imageFile) => {
    try {
      setFormSubmitting(true);
      let payload = productData;
      let config = { headers: { 'Content-Type': 'application/json' } };

      if (imageFile) {
        payload = new FormData();
        Object.entries(productData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            payload.append(key, value);
          }
        });
        payload.append('imageFile', imageFile);
        config = {};
      }

      const { data } = editingProduct
        ? await api.put(`/products/${editingProduct._id}`, payload, config)
        : await api.post('/products', payload, config);

      if (data) {
        toast.success(
          editingProduct ? 'Produit mis à jour avec succès 🎉' : 'Produit créé avec succès 🚀'
        );
        setProducts((prev) => {
          const next = editingProduct
            ? prev.map((product) => (product._id === data._id ? data : product))
            : [data, ...prev];
          return sortProductsByName(next);
        });
        setIsFormOpen(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error:', error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || 'Échec de l’opération ❌');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDelete = async (productId) => {
    if (await confirmDialog('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        await api.delete(`/products/${productId}`);
        setProducts((prev) => prev.filter((product) => product._id !== productId));
        toast.success('Produit supprimé ✅');
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Erreur lors de la suppression ❌');
      }
    }
  };

  const handleDuplicate = async (product) => {
    if (!product?._id) return;
    if (!(await confirmDialog(`Dupliquer le produit « ${product.name} » ?`))) return;

    try {
      const { data } = await api.post(`/products/${product._id}/duplicate`);
      if (data) {
        setProducts((prev) => sortProductsByName([data, ...prev]));
      } else {
        fetchProducts({ showLoading: false });
      }
      toast.success('Produit dupliqué ✅');
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la duplication ❌');
    }
  };

  const totalStock = products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0);
  const inStockCount = products.filter((product) => Number(product.stock) > 0).length;
  const lowStockCount = products.filter((product) => Number(product.stock) > 0 && Number(product.stock) < 5).length;
  const outOfStockCount = products.filter((product) => Number(product.stock) <= 0).length;
  const stockValue = products.reduce((sum, product) => sum + ((Number(product.stock) || 0) * (Number(product.price) || 0)), 0);
  const formatCfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} CFA`;

  return (
    <Workspace>

      <LoaderOverlay
        show={formSubmitting}
        text={editingProduct ? 'Modification produit...' : 'Création du produit...'}
      />

      <PageHeader
        eyebrow="Catalogue"
        title="Produits"
        description="Gérez le catalogue, les stocks, les prix et les fournisseurs."
        meta={!loading && products.length > 0 ? `${products.length} produit${products.length > 1 ? 's' : ''} au catalogue` : null}
        actions={isAdmin && (
          <Button
            variant="primary"
            onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Nouveau produit
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Articles en stock"
          value={loading ? '...' : inStockCount.toLocaleString('fr-FR')}
          context={`${products.length.toLocaleString('fr-FR')} au catalogue`}
          icon={<PackageCheck className="h-4 w-4" />}
          tone="success"
        />
        <KPICard
          title="Stock total"
          value={loading ? '...' : totalStock.toLocaleString('fr-FR')}
          context="Unités disponibles"
          icon={<Boxes className="h-4 w-4" />}
        />
        <KPICard
          title="À surveiller"
          value={loading ? '...' : (lowStockCount + outOfStockCount).toLocaleString('fr-FR')}
          context={`${lowStockCount} bas · ${outOfStockCount} rupture`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <KPICard
          title="Valeur du stock"
          value={loading ? '...' : formatCfa(stockValue)}
          context="Prix de vente potentiel"
          icon={<Wallet className="h-4 w-4" />}
          tone="brand"
        />
      </div>

      {isAdmin && (
        <CommandBar>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="fui-caption1-strong uppercase" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
              Actions catalogue
            </p>
            <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
            <FeatureGate
              feature={FEATURE_KEYS.BULK_EDIT}
              locked={<LockedFeatureButton feature={FEATURE_KEYS.BULK_EDIT} icon={<Edit3 className="h-4 w-4" />}>Modifier</LockedFeatureButton>}
            >
              <Button variant="secondary" size="sm" disabled={selectedIds.length === 0} onClick={() => setBulkOpen(true)}>
                <Edit3 className="h-4 w-4" />
                Modifier{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </Button>
            </FeatureGate>
            <FeatureGate
              feature={FEATURE_KEYS.PRODUCT_IMPORT}
              locked={<LockedFeatureButton feature={FEATURE_KEYS.PRODUCT_IMPORT} icon={<FileSpreadsheet className="h-4 w-4" />}>Importer Excel</LockedFeatureButton>}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowImportModal(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Importer Excel
              </Button>
            </FeatureGate>
            </div>
          </div>
          <div className="rounded-[var(--radiusMedium)] px-3 py-2 text-sm" style={{ background: selectedIds.length ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground2)', color: selectedIds.length ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground3)' }}>
            {selectedIds.length > 0
              ? `${selectedIds.length} produit(s) sélectionné(s) — cliquez « Modifier » pour les éditer en lot.`
              : 'Cochez des produits pour les modifier en lot.'}
          </div>
        </CommandBar>
      )}

      <DataTable>
        <ProductList
          products={products}
          loading={loading}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          isAdmin={isAdmin}
          lossMap={lossMap}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      </DataTable>

      {isAdmin && (
        <BulkEditModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          count={selectedIds.length}
          lookups={lookups}
          onApply={async (updates) => {
            const { data } = await api.put('/products/bulk', { ids: selectedIds, updates });
            const updatedProducts = Array.isArray(data.products) ? data.products : [];
            const updatedById = new Map(updatedProducts.map((product) => [product._id, product]));
            setProducts((currentProducts) =>
              sortProductsByName(
                currentProducts.map((product) => updatedById.get(product._id) || product)
              )
            );
            toast.success(`${data.modified} produit(s) modifié(s).`);
            setBulkOpen(false);
            setSelectedIds([]);
          }}
        />
      )}

      {isAdmin && (
        <RightDetailPanel
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
          }}
          title={editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
          subtitle={editingProduct ? 'Mettez à jour les informations du produit.' : 'Renseignez les informations du nouveau produit.'}
          footer={
            <>
              <Button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingProduct(null);
                }}
                disabled={formSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="product-form"
                variant="primary"
                disabled={formSubmitting}
              >
                {editingProduct ? 'Enregistrer les modifications' : 'Créer le produit'}
              </Button>
            </>
          }
        >
          <ProductForm
            product={editingProduct}
            onSubmit={handleCreate}
            loading={formSubmitting}
            lookups={lookups}
          />
        </RightDetailPanel>
      )}

      <ProductImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          fetchProducts();
        }}
      />
    </Workspace>
  );
};

/* ===================================================== */
/* 🧾 FORMULAIRE PRODUIT */
/* ===================================================== */
const getProductFormDefaults = (product) => ({
  name: product?.name || '',
  description: product?.description || '',
  price: product?.price || '',
  costPrice: product?.costPrice || '',
  stock: product?.stock || '',
  category: product?.category || '',
  image: product?.image || '',
  supplierName: product?.supplierName || '',
  supplierPhone: product?.supplierPhone || '',
  container: product?.container || '',
  warehouse: product?.warehouse || '',
});

const ProductForm = ({ product, onSubmit, loading, lookups = {} }) => {
  const { categories = [], containers = [], warehouses = [], suppliers = [] } = lookups;
  const [formData, setFormData] = useState(() => getProductFormDefaults(product));
  const [profitMargin, setProfitMargin] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(product?.image || '');

  useEffect(() => {
    setFormData(getProductFormDefaults(product));
    setImageFile(null);
    setPreviewUrl(product?.image || '');
  }, [product]);

  useEffect(() => {
    if (formData.price && formData.costPrice) {
      const price = parseFloat(formData.price);
      const cost = parseFloat(formData.costPrice);
      const margin = cost > 0 ? ((price - cost) / cost) * 100 : 0;
      setProfitMargin(isNaN(margin) ? 0 : margin);
    } else {
      setProfitMargin(0);
    }
  }, [formData.price, formData.costPrice]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(formData.image || product?.image || '');
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, formData.image, product?.image]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'image') setImageFile(null);
  };

  const handleSupplierChange = (e) => {
    const selectedName = e.target.value;
    const found = suppliers.find((s) => s.name === selectedName);
    setFormData((prev) => ({
      ...prev,
      supplierName: selectedName,
      supplierPhone: found?.phone || '',
    }));
  };

  const handleFileChange = (e) => {
    setImageFile(e.target.files?.[0] || null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const processedData = {
      ...formData,
      price: parseFloat(formData.price),
      costPrice: parseFloat(formData.costPrice),
      stock: parseInt(formData.stock, 10),
    };
    onSubmit(processedData, imageFile);
  };

  return (
    <form id="product-form" onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Section: Informations générales */}
      <section className="space-y-4">
        <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-950 uppercase">
          Informations générales
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Nom du produit" name="name" value={formData.name} onChange={handleChange} required />
          <Select label="Catégorie" name="category" value={formData.category} onChange={handleChange} options={categories.map((c) => c.name)} emptyHint="Catégories produits" />
          <Select label="Conteneur" name="container" value={formData.container} onChange={handleChange} options={containers.map((c) => c.name)} emptyHint="Conteneurs" />
          <Select label="Entrepôt" name="warehouse" value={formData.warehouse} onChange={handleChange} options={warehouses.map((w) => w.name)} emptyHint="Entrepôts" />
        </div>
        <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} rows={3} />
      </section>

      {/* Section: Prix & stock */}
      <section className="space-y-4">
        <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-950 uppercase">
          Prix & stock
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Prix de revient (CFA)" name="costPrice" type="number" min="0" step="0.01" value={formData.costPrice} onChange={handleChange} />
          <Input label="Prix de vente (CFA)" name="price" type="number" min="0" step="0.01" value={formData.price} onChange={handleChange} />
          <Input label="Stock disponible" name="stock" type="number" min="0" value={formData.stock} onChange={handleChange} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500 uppercase">Marge</p>
            <p className={`text-lg font-semibold tabular-nums ${profitMargin > 0 ? 'text-emerald-700' : profitMargin < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
              {Number(profitMargin).toFixed(1)}%
            </p>
          </div>
        </div>
      </section>

      {/* Section: Fournisseur */}
      <section className="space-y-4">
        <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-950 uppercase">
          Fournisseur
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Fournisseur" name="supplierName" value={formData.supplierName} onChange={handleSupplierChange} options={suppliers.map((s) => s.name)} emptyHint="Fournisseurs" />
          <Input label="Téléphone" name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} readOnly />
        </div>
      </section>

      {/* Section: Image */}
      <section className="space-y-4">
        <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-950 uppercase">
          Image
        </h3>
        <Input label="URL de l'image" name="image" value={formData.image} onChange={handleChange} placeholder="https://..." />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Importer une image</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-[var(--ms-text-muted)] file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 file:transition-colors"
            />
            {previewUrl && (
              <img src={previewUrl} alt="Aperçu" className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Upload déclenche un envoi automatique vers Cloudinary.</p>
        </div>
      </section>
    </form>
  );
};

/* ===================================================== */
/* 🧮 LISTE DES PRODUITS */
/* ===================================================== */
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const parseNumericValue = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const getEffectiveNumericOperator = (operator, primaryValue, secondaryValue) => {
  if (operator) return operator;
  const primary = parseNumericValue(primaryValue);
  const secondary = parseNumericValue(secondaryValue);
  if (primary !== null || secondary !== null) {
    return secondary !== null ? 'between' : 'eq';
  }
  return '';
};
const formatNumberForExport = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return '0';
  const rounded = Math.round(numeric * 100) / 100;
  const [integerPart, decimalPart] = String(rounded).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimalPart ? `${groupedInteger}.${decimalPart}` : groupedInteger;
};
const matchesNumericFilter = (value, operator, primaryValue, secondaryValue) => {
  const effectiveOperator = getEffectiveNumericOperator(operator, primaryValue, secondaryValue);
  if (!effectiveOperator) return true;
  const numericValue = parseNumericValue(value);
  if (numericValue === null) return false;

  const primary = parseNumericValue(primaryValue);
  const secondary = parseNumericValue(secondaryValue);

  if (effectiveOperator === 'between') {
    if (primary === null && secondary === null) return true;
    if (primary !== null && secondary === null) return numericValue >= primary;
    if (primary === null && secondary !== null) return numericValue <= secondary;
    return numericValue >= Math.min(primary, secondary) && numericValue <= Math.max(primary, secondary);
  }

  if (primary === null) return true;

  switch (effectiveOperator) {
    case 'eq':
      return numericValue === primary;
    case 'gt':
      return numericValue > primary;
    case 'gte':
      return numericValue >= primary;
    case 'lt':
      return numericValue < primary;
    case 'lte':
      return numericValue <= primary;
    default:
      return true;
  }
};
const getFilterOptions = (items, accessor) =>
  [...new Set(items.map(accessor).map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

const getProductStockStatus = (stock) => {
  const numericStock = Number(stock) || 0;
  if (numericStock <= 0) return { tone: 'danger', label: 'Rupture' };
  if (numericStock < 5) return { tone: 'warning', label: 'Stock bas' };
  return { tone: 'success', label: 'Disponible' };
};

const renderLossChip = (lossMap, p) => {
  const l = lossMap?.[p._id];
  if (!l || !l.units) return null;
  const parts = [];
  if (l.casse) parts.push(`${l.casse} cassé${l.casse > 1 ? 's' : ''}`);
  if (l.cadeau) parts.push(`${l.cadeau} offert${l.cadeau > 1 ? 's' : ''}`);
  if (l.autres) parts.push(`${l.autres} sortie${l.autres > 1 ? 's' : ''}`);
  return (
    <span className="ms-status-badge ms-status-warning mt-1 inline-flex items-center gap-1" title="Sorties hors vente (casse / cadeau)">
      <PackageMinus className="h-3 w-3" /> {parts.join(' · ')}
    </span>
  );
};

const ProductList = ({ products, loading, onDelete, onEdit, onDuplicate, isAdmin, lossMap = {}, selectedIds = [], setSelectedIds = () => {} }) => {
  const { appSettings } = useAppSettings();
  const company = getCompanyIdentity(appSettings.branding);
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => readProductFiltersFromSearch(location.search));
  const [sortBy, setSortBy] = useState('name');
  const [exporting, setExporting] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    setFilters(readProductFiltersFromSearch(location.search));
  }, [location.search]);

  const updateFiltersInUrl = useCallback(
    (nextFilters) => {
      const nextSearch = buildSearchFromProductFilters(location.search, nextFilters);
      if (nextSearch !== location.search) {
        navigate(
          {
            pathname: location.pathname,
            search: nextSearch,
          },
          { replace: true }
        );
      }
    },
    [location.pathname, location.search, navigate]
  );

  const desktopLinkProps = isDesktop
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  const categoryOptions = useMemo(
    () => getFilterOptions(products, (product) => product.category),
    [products]
  );
  const containerOptions = useMemo(
    () => getFilterOptions(products, (product) => product.container),
    [products]
  );
  const warehouseOptions = useMemo(
    () => getFilterOptions(products, (product) => product.warehouse),
    [products]
  );
  const supplierOptions = useMemo(
    () => getFilterOptions(products, (product) => product.supplierName),
    [products]
  );

  const handleFilterChange = (name, value) => {
    setFilters((prev) => {
      let nextFilters;
      if (name === 'priceOperator') {
        nextFilters = {
          ...prev,
          priceOperator: value,
          priceMax: value === 'between' ? prev.priceMax : '',
        };
        updateFiltersInUrl(nextFilters);
        return nextFilters;
      }
      if (name === 'stockOperator') {
        nextFilters = {
          ...prev,
          stockOperator: value,
          stockMax: value === 'between' ? prev.stockMax : '',
        };
        updateFiltersInUrl(nextFilters);
        return nextFilters;
      }
      nextFilters = { ...prev, [name]: value };
      updateFiltersInUrl(nextFilters);
      return nextFilters;
    });
  };

  const resetFilters = () => {
    setFilters({ ...DEFAULT_PRODUCT_FILTERS });
    updateFiltersInUrl(DEFAULT_PRODUCT_FILTERS);
  };

  // Apply several filter keys at once (used by removable chips) with a single URL sync.
  const setManyFilters = (patch) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      updateFiltersInUrl(next);
      return next;
    });
  };

  // Quick stock-status presets that drive the numeric stock filter.
  const STOCK_PRESETS = {
    all:      { stockOperator: '', stock: '', stockMax: '' },
    inStock:  { stockOperator: 'gte', stock: '1', stockMax: '' },
    low:      { stockOperator: 'between', stock: '1', stockMax: '4' },
    out:      { stockOperator: 'eq', stock: '0', stockMax: '' },
  };
  const activeStockPreset = (() => {
    const { stockOperator, stock, stockMax } = filters;
    if (!stockOperator && !stock && !stockMax) return 'all';
    if (stockOperator === 'gte' && String(stock) === '1' && !stockMax) return 'inStock';
    if (stockOperator === 'between' && String(stock) === '1' && String(stockMax) === '4') return 'low';
    if (stockOperator === 'eq' && String(stock) === '0') return 'out';
    return null; // custom numeric filter
  })();
  const applyStockPreset = (key) => {
    const preset = STOCK_PRESETS[key];
    const next = { ...filters, ...preset };
    setFilters(next);
    updateFiltersInUrl(next);
  };

  const hasActiveFilters = Object.values(filters).some((value) => String(value).trim() !== '');
  const filterInputClass = 'form-control';
  const actionButtonClass = 'ms-button ms-button-secondary ms-button-sm';
  const comparisonOptions = [
    { value: '', label: 'Toutes' },
    { value: 'eq', label: '=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'between', label: 'Entre' },
  ];
  const comparisonLabels = {
    eq: '=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    between: 'entre',
  };

  const filtered = useMemo(() => {
    const productFilter = normalizeText(filters.product);
    const categoryFilter = normalizeText(filters.category);
    const containerFilter = normalizeText(filters.container);
    const warehouseFilter = normalizeText(filters.warehouse);
    const supplierFilter = normalizeText(filters.supplier);

    const matched = products.filter((product) => {
      const normalizedProductName = normalizeText(product.name);
      const normalizedCategory = normalizeText(product.category);
      const normalizedContainer = normalizeText(product.container);
      const normalizedWarehouse = normalizeText(product.warehouse);
      const normalizedSupplier = normalizeText(product.supplierName);

      return (
        (!productFilter || normalizedProductName.includes(productFilter)) &&
        (!categoryFilter || normalizedCategory === categoryFilter) &&
        (!containerFilter || normalizedContainer === containerFilter) &&
        (!warehouseFilter || normalizedWarehouse === warehouseFilter) &&
        matchesNumericFilter(product.price, filters.priceOperator, filters.price, filters.priceMax) &&
        matchesNumericFilter(product.stock, filters.stockOperator, filters.stock, filters.stockMax) &&
        (!supplierFilter || normalizedSupplier === supplierFilter)
      );
    });

    const byName = (a, b) => (a?.name || '').localeCompare(b?.name || '', 'fr', { sensitivity: 'base' });
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const sorters = {
      name: byName,
      name_desc: (a, b) => byName(b, a),
      stock_desc: (a, b) => num(b.stock) - num(a.stock) || byName(a, b),
      stock_asc: (a, b) => num(a.stock) - num(b.stock) || byName(a, b),
      price_desc: (a, b) => num(b.price) - num(a.price) || byName(a, b),
      price_asc: (a, b) => num(a.price) - num(b.price) || byName(a, b),
    };
    return [...matched].sort(sorters[sortBy] || byName);
  }, [filters, products, sortBy]);

  useEffect(() => {
    setVisibleCount(PRODUCT_PAGE_SIZE);
  }, [filters, products.length]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMoreProducts = visibleCount < filtered.length;

  // Bulk selection (admin) — select-all targets the whole filtered set.
  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p._id));
  const toggleSelectAllFiltered = () =>
    setSelectedIds(allFilteredSelected ? [] : filtered.map((p) => p._id));

  // Summary stats for the current filtered/searched results.
  const resultStats = useMemo(() => {
    let units = 0, sellValue = 0, costValue = 0, inStock = 0, low = 0, out = 0;
    filtered.forEach((p) => {
      const s = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      const cost = Number(p.costPrice) || 0;
      units += s;
      sellValue += s * price;
      costValue += s * cost;
      if (s <= 0) out += 1;
      else if (s < 5) low += 1;
      else inStock += 1;
    });
    return { count: filtered.length, units, sellValue, costValue, potentialMargin: sellValue - costValue, inStock, low, out };
  }, [filtered]);

  // Click a column header to sort by it (toggles desc/asc).
  const toggleSort = (field) => {
    setSortBy((cur) => {
      if (field === 'name') return cur === 'name' ? 'name_desc' : 'name';
      if (field === 'stock') return cur === 'stock_desc' ? 'stock_asc' : 'stock_desc';
      if (field === 'price') return cur === 'price_desc' ? 'price_asc' : 'price_desc';
      return cur;
    });
  };
  const sortArrow = (field) => {
    if (field === 'name') return sortBy === 'name' ? '↑' : sortBy === 'name_desc' ? '↓' : '';
    if (field === 'stock') return sortBy === 'stock_asc' ? '↑' : sortBy === 'stock_desc' ? '↓' : '';
    if (field === 'price') return sortBy === 'price_asc' ? '↑' : sortBy === 'price_desc' ? '↓' : '';
    return '';
  };

  const exportRows = useMemo(() => filtered.map((product, index) => ({
    '#': index + 1,
    Produit: product.name || '—',
    Catégorie: product.category || '—',
    Conteneur: product.container?.trim() || 'Non défini',
    Entrepôt: product.warehouse?.trim() || 'Non défini',
    Prix: product.price || 0,
    Stock: product.stock || 0,
    Fournisseur: product.supplierName || '—',
    Téléphone: product.supplierPhone || '—',
    Description: product.description || '—',
  })), [filtered]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AppLoader fullScreen={false} text="Chargement des produits…" />
      </div>
    );
  }

  const activeFilterEntries = [
    ['Produit', filters.product],
    ['Catégorie', filters.category],
    ['Conteneur', filters.container],
    ['Entrepôt', filters.warehouse],
    [
      'Prix',
      getEffectiveNumericOperator(filters.priceOperator, filters.price, filters.priceMax)
        ? `${comparisonLabels[getEffectiveNumericOperator(filters.priceOperator, filters.price, filters.priceMax)] || ''} ${filters.price}${getEffectiveNumericOperator(filters.priceOperator, filters.price, filters.priceMax) === 'between' && filters.priceMax ? ` et ${filters.priceMax}` : ''}`.trim()
        : '',
    ],
    [
      'Stock',
      getEffectiveNumericOperator(filters.stockOperator, filters.stock, filters.stockMax)
        ? `${comparisonLabels[getEffectiveNumericOperator(filters.stockOperator, filters.stock, filters.stockMax)] || ''} ${filters.stock}${getEffectiveNumericOperator(filters.stockOperator, filters.stock, filters.stockMax) === 'between' && filters.stockMax ? ` et ${filters.stockMax}` : ''}`.trim()
        : '',
    ],
    ['Fournisseur', filters.supplier],
  ].filter(([, value]) => String(value || '').trim() !== '');

  const filterSummary = activeFilterEntries.length > 0
    ? activeFilterEntries.map(([label, value]) => `${label}: ${value}`).join(' | ')
    : 'Aucun filtre appliqué';

  const productsReturnPath = `${location.pathname}${location.search}`;
  const productLinkState = { returnToProducts: productsReturnPath };

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      toast.error('Aucun produit à exporter');
      return;
    }

    try {
      setExporting('excel');
      const exportDate = new Date();
      const fileDateStamp = exportDate.toISOString().split('T')[0];
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const filterSheet = XLSX.utils.json_to_sheet([
        {
          Filtres: filterSummary,
          'Produits exportés': filtered.length,
          'Exporté le': exportDate.toLocaleString('fr-FR'),
        },
      ]);
      const dataSheet = XLSX.utils.json_to_sheet(
        exportRows.map((row) => ({
          ...row,
          Prix: formatNumberForExport(row.Prix),
          Stock: formatNumberForExport(row.Stock),
        }))
      );
      XLSX.utils.book_append_sheet(workbook, filterSheet, 'Filtres');
      XLSX.utils.book_append_sheet(workbook, dataSheet, 'Produits');
      XLSX.writeFile(workbook, `produits-filtres-${fileDateStamp}.xlsx`);
      toast.success('Export Excel généré');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Impossible de générer le fichier Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (filtered.length === 0) {
      toast.error('Aucun produit à exporter');
      return;
    }

    try {
      setExporting('pdf');
      const exportDate = new Date();
      const fileDateStamp = exportDate.toISOString().split('T')[0];
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      doc.setFontSize(18);
      doc.setTextColor(31, 41, 55);
      doc.text(`${company.name} — Export des produits`, 40, 40);

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Exporté le : ${exportDate.toLocaleString('fr-FR')}`, 40, 60);

      const filterLines = doc.splitTextToSize(`Filtres : ${filterSummary}`, 760);
      doc.text(filterLines, 40, 78);
      doc.text(`Produits exportés : ${filtered.length}`, 40, 78 + (filterLines.length * 14));

      autoTableModule.default(doc, {
        startY: 110 + (filterLines.length * 10),
        head: [[
          'Produit',
          'Catégorie',
          'Conteneur',
          'Entrepôt',
          'Prix (CFA)',
          'Stock',
          'Fournisseur',
        ]],
        body: filtered.map((product) => [
          product.name || '—',
          product.category || '—',
          product.container?.trim() || 'Non défini',
          product.warehouse?.trim() || 'Non défini',
          formatNumberForExport(product.price),
          formatNumberForExport(product.stock),
          product.supplierName || '—',
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: [31, 41, 55],
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 40, left: 40, right: 40, bottom: 40 },
      });

      doc.save(`produits-filtres-${fileDateStamp}.pdf`);
      toast.success('Export PDF généré');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Impossible de générer le PDF');
    } finally {
      setExporting(null);
    }
  };

  const renderNumericFilter = ({ label, operatorKey, valueKey, maxKey, valuePlaceholder, maxPlaceholder }) => (
    <div>
      <label htmlFor={`${operatorKey}-operator`} className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
        {label}
      </label>
      <div className="space-y-2">
        <select
          id={`${operatorKey}-operator`}
          value={filters[operatorKey]}
          onChange={(e) => handleFilterChange(operatorKey, e.target.value)}
          className={filterInputClass}
        >
          {comparisonOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          placeholder={filters[operatorKey] === 'between' ? valuePlaceholder : 'Valeur'}
          value={filters[valueKey]}
          onChange={(e) => handleFilterChange(valueKey, e.target.value)}
          className={filterInputClass}
        />
        {filters[operatorKey] === 'between' && (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder={maxPlaceholder}
            value={filters[maxKey]}
            onChange={(e) => handleFilterChange(maxKey, e.target.value)}
            className={filterInputClass}
          />
        )}
      </div>
    </div>
  );

  const stockChips = [
    { key: 'all', label: 'Tous' },
    { key: 'inStock', label: 'En stock' },
    { key: 'low', label: 'Stock bas' },
    { key: 'out', label: 'Rupture' },
  ];

  // Removable chips summarising each active filter (text + numeric groups).
  const priceChipOp = getEffectiveNumericOperator(filters.priceOperator, filters.price, filters.priceMax);
  const stockChipOp = getEffectiveNumericOperator(filters.stockOperator, filters.stock, filters.stockMax);
  const activeFilterChips = [
    filters.product && { key: 'product', label: `Produit : ${filters.product}`, onRemove: () => setManyFilters({ product: '' }) },
    filters.category && { key: 'category', label: `Catégorie : ${filters.category}`, onRemove: () => setManyFilters({ category: '' }) },
    filters.container && { key: 'container', label: `Conteneur : ${filters.container}`, onRemove: () => setManyFilters({ container: '' }) },
    filters.warehouse && { key: 'warehouse', label: `Entrepôt : ${filters.warehouse}`, onRemove: () => setManyFilters({ warehouse: '' }) },
    filters.supplier && { key: 'supplier', label: `Fournisseur : ${filters.supplier}`, onRemove: () => setManyFilters({ supplier: '' }) },
    priceChipOp && { key: 'price', label: `Prix ${comparisonLabels[priceChipOp] || ''} ${filters.price}${priceChipOp === 'between' && filters.priceMax ? ` et ${filters.priceMax}` : ''}`.trim(), onRemove: () => setManyFilters({ priceOperator: '', price: '', priceMax: '' }) },
    stockChipOp && { key: 'stock', label: `Stock ${comparisonLabels[stockChipOp] || ''} ${filters.stock}${stockChipOp === 'between' && filters.stockMax ? ` et ${filters.stockMax}` : ''}`.trim(), onRemove: () => setManyFilters({ stockOperator: '', stock: '', stockMax: '' }) },
  ].filter(Boolean);

  // Compact toolbar: inline search, stock presets, filter-drawer trigger, sort + export, active chips.
  const renderToolbar = () => (
    <div className="border-b p-3 sm:p-4 flex flex-col gap-3" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="product-filter-name"
              type="text"
              placeholder="Rechercher un produit…"
              value={filters.product}
              onChange={(e) => handleFilterChange('product', e.target.value)}
              className={`${filterInputClass} pl-9`}
              autoComplete="off"
              aria-label="Rechercher un produit"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="ms-button ms-button-secondary ms-button-md shrink-0"
            aria-label="Ouvrir les filtres"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterChips.length > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold" style={{ background: 'var(--ms-blue)', color: '#fff' }}>
                {activeFilterChips.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2">
            <span className="fui-caption1 whitespace-nowrap" style={{ color: 'var(--colorNeutralForeground3)' }}>Trier&nbsp;:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-h-[36px] rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-2.5 text-sm outline-none focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]/20"
              style={{ color: 'var(--colorNeutralForeground1)' }}
              aria-label="Trier les produits"
            >
              <option value="name">Nom (A→Z)</option>
              <option value="stock_desc">Quantité (haut → bas)</option>
              <option value="stock_asc">Quantité (bas → haut)</option>
              <option value="price_desc">Prix (haut → bas)</option>
              <option value="price_asc">Prix (bas → haut)</option>
            </select>
          </label>
          {isAdmin && (
            <>
              <button type="button" onClick={handleExportExcel} disabled={exporting !== null || filtered.length === 0} className={actionButtonClass}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{exporting === 'excel' ? 'Export Excel…' : 'Excel'}</span>
              </button>
              <button type="button" onClick={handleExportPdf} disabled={exporting !== null || filtered.length === 0} className={actionButtonClass}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{exporting === 'pdf' ? 'Export PDF…' : 'PDF'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick stock-status chips + result count */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="fui-caption1-strong uppercase mr-1" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>Stock</span>
        {stockChips.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => applyStockPreset(key)}
            className={`ms-button ms-button-sm ${activeStockPreset === key ? 'ms-button-primary' : 'ms-button-secondary'}`}
          >
            {label}
          </button>
        ))}
        <span className="fui-caption1 ml-auto" style={{ color: 'var(--colorNeutralForeground3)' }}>
          <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{filtered.length}</span> produit{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Active filter chips (removable) */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition"
              style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}
              title="Retirer ce filtre"
            >
              {chip.label}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
          <button type="button" onClick={resetFilters} className="ms-button ms-button-secondary ms-button-sm">
            <RotateCcw className="h-4 w-4" />
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );

  // Filtered-results summary — shown only while filters are active (the KPI row covers the full catalog).
  const renderResultStats = () => {
    if (loading || !hasActiveFilters) return null;
    const stats = [
      { label: 'Produits trouvés', value: resultStats.count.toLocaleString('fr-FR'), tone: 'brand' },
      { label: 'Unités en stock', value: resultStats.units.toLocaleString('fr-FR'), tone: 'neutral' },
      { label: 'En stock', value: resultStats.inStock.toLocaleString('fr-FR'), tone: 'success' },
      { label: 'Stock faible', value: resultStats.low.toLocaleString('fr-FR'), tone: 'warning' },
      { label: 'Rupture', value: resultStats.out.toLocaleString('fr-FR'), tone: 'danger' },
      ...(isAdmin ? [
        { label: 'Valeur (prix de vente)', value: `${resultStats.sellValue.toLocaleString('fr-FR')} CFA`, tone: 'neutral' },
        { label: 'Marge potentielle', value: `${resultStats.potentialMargin.toLocaleString('fr-FR')} CFA`, tone: 'success' },
      ] : []),
    ];
    const toneColors = {
      brand: 'var(--colorBrandForeground1)',
      success: 'var(--colorStatusSuccessForeground1)',
      warning: 'var(--colorStatusWarningForeground1)',
      danger: 'var(--colorStatusDangerForeground1)',
      neutral: 'var(--colorNeutralForeground1)',
    };
    return (
      <div className="border-b p-3 flex flex-wrap gap-2" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)' }}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[var(--radiusMedium)] px-3 py-1.5"
            style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
          >
            <span className="fui-caption2 block" style={{ color: 'var(--colorNeutralForeground3)' }}>{s.label}</span>
            <span className="fui-caption1-strong tabular-nums" style={{ color: toneColors[s.tone] }}>{s.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // Slide-in drawer holding the detailed filters (category / container / warehouse / supplier / price / stock).
  const renderFiltersDrawer = () => (
    <RightDetailPanel
      isOpen={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      title="Filtres"
      subtitle="Affinez le catalogue par catégorie, stock, prix et fournisseur."
      labelledBy="products-filter-panel-title"
      footer={
        <>
          <Button type="button" onClick={resetFilters} disabled={!hasActiveFilters}>
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
          <Button type="button" variant="primary" onClick={() => setFiltersOpen(false)}>
            Voir {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label htmlFor="product-filter-category" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Catégorie
          </label>
          <select id="product-filter-category" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} className={filterInputClass}>
            <option value="">Toutes les catégories</option>
            {categoryOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="product-filter-container" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Conteneur
          </label>
          <select id="product-filter-container" value={filters.container} onChange={(e) => handleFilterChange('container', e.target.value)} className={filterInputClass}>
            <option value="">Tous les conteneurs</option>
            {containerOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="product-filter-warehouse" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Entrepôt
          </label>
          <select id="product-filter-warehouse" value={filters.warehouse} onChange={(e) => handleFilterChange('warehouse', e.target.value)} className={filterInputClass}>
            <option value="">Tous les entrepôts</option>
            {warehouseOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="product-filter-supplier" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Fournisseur
          </label>
          <select id="product-filter-supplier" value={filters.supplier} onChange={(e) => handleFilterChange('supplier', e.target.value)} className={filterInputClass}>
            <option value="">Tous les fournisseurs</option>
            {supplierOptions.map((option) => (<option key={option} value={option}>{option}</option>))}
          </select>
        </div>
        {renderNumericFilter({
          label: 'Prix',
          operatorKey: 'priceOperator',
          valueKey: 'price',
          maxKey: 'priceMax',
          valuePlaceholder: 'Prix min',
          maxPlaceholder: 'Prix max',
        })}
        {renderNumericFilter({
          label: 'Stock',
          operatorKey: 'stockOperator',
          valueKey: 'stock',
          maxKey: 'stockMax',
          valuePlaceholder: 'Stock min',
          maxPlaceholder: 'Stock max',
        })}
      </div>
    </RightDetailPanel>
  );

  const renderLoadMore = () =>
    hasMoreProducts ? (
      <div className="border-t border-slate-100 bg-white px-4 py-4 text-center">
        <p className="mb-3 text-sm text-slate-500">
          {visibleProducts.length} sur {filtered.length} produits affichés
        </p>
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PRODUCT_PAGE_SIZE)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          Afficher plus de produits
        </button>
      </div>
    ) : null;

  if (!isAdmin) {
    return (
      <div>
        {renderToolbar()}
        {renderResultStats()}
        {renderFiltersDrawer()}

        <div className="divide-y divide-slate-100 bg-white lg:divide-y-0 lg:p-6 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {visibleProducts.map((p) => (
            <Link
              key={p._id}
              to={productPath(p)}
              state={productLinkState}
              {...desktopLinkProps}
              onClick={() => typeof document !== 'undefined' && document.activeElement?.blur?.()}
              className="block p-4 transition-colors hover:bg-slate-50 lg:p-5 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm lg:hover:border-slate-300"
            >
              <div className="flex gap-3">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-20 w-20 shrink-0 rounded-2xl border border-slate-100 object-cover bg-slate-50 sm:h-24 sm:w-24"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-2xl border border-slate-100 bg-slate-100 flex items-center justify-center text-slate-500 sm:h-24 sm:w-24">
                    <Package className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-950 lg:text-lg line-clamp-2">{p.name}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <StatusBadge tone="neutral">
                      {p.container?.trim() || 'Non défini'}
                    </StatusBadge>
                    <StatusBadge tone="success">
                      {p.warehouse?.trim() || 'Non défini'}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="font-medium text-[var(--ms-text)]">
                      Stock : <StatusBadge tone={getProductStockStatus(p.stock).tone}>{getProductStockStatus(p.stock).label}</StatusBadge>
                    </p>
                    <p className="text-right font-semibold text-slate-950 tabular-nums">
                      {p.price?.toLocaleString('fr-FR')} CFA
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {renderLoadMore()}

        {filtered.length === 0 && (
          <div className="text-center py-12 lg:py-16 text-slate-500">
            <EmptyState title="Aucun produit trouvé" description="Ajustez les filtres pour afficher le catalogue." />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {renderToolbar()}
      {renderResultStats()}
      {renderFiltersDrawer()}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm lg:text-base">
          <thead className="bg-[var(--colorNeutralBackground2)] md:sticky md:top-0 z-10">
            <tr>
              <th className="px-3 py-3 lg:px-4 lg:py-4 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 cursor-pointer accent-[var(--ms-blue)]"
                  title="Tout sélectionner (résultats filtrés)"
                  aria-label="Tout sélectionner"
                />
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-slate-500 uppercase">
                <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase hover:text-[var(--ms-blue)]">
                  Produit <span className="text-[var(--ms-blue)]">{sortArrow('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-slate-500 uppercase">
                Catégorie
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-slate-500 uppercase">
                Conteneur
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-slate-500 uppercase">
                Entrepôt
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-slate-500 uppercase">
                <button type="button" onClick={() => toggleSort('price')} className="inline-flex items-center gap-1 uppercase hover:text-[var(--ms-blue)]">
                  Prix <span className="text-[var(--ms-blue)]">{sortArrow('price')}</span>
                </button>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-slate-500 uppercase">
                <button type="button" onClick={() => toggleSort('stock')} className="inline-flex items-center gap-1 uppercase hover:text-[var(--ms-blue)]">
                  Stock <span className="text-[var(--ms-blue)]">{sortArrow('stock')}</span>
                </button>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-slate-500 uppercase">
                Fournisseur
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-slate-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {visibleProducts.map((p) => (
              <tr key={p._id} className={`transition-colors ${selectedIds.includes(p._id) ? 'bg-[var(--ms-blue-soft)]' : 'hover:bg-[var(--colorNeutralBackground2)]'}`} onClick={() => document.activeElement?.blur?.()}>
                <td className="px-3 py-3 lg:px-4 lg:py-4 align-top">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p._id)}
                    onChange={() => toggleSelect(p._id)}
                    className="mt-1 h-4 w-4 cursor-pointer accent-[var(--ms-blue)]"
                    aria-label={`Sélectionner ${p.name}`}
                  />
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex min-w-[260px] items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-14 w-14 shrink-0 rounded-[var(--radiusLarge)] border border-slate-100 object-cover bg-slate-50 lg:h-16 lg:w-16" loading="lazy" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radiusLarge)] border border-slate-100 bg-slate-100 text-slate-500 lg:h-16 lg:w-16"><Package className="h-6 w-6" /></div>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={productPath(p)}
                        state={productLinkState}
                        className="line-clamp-2 font-semibold text-slate-950 transition hover:text-[var(--colorBrandForeground1)]"
                        {...desktopLinkProps}
                      >
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={getProductStockStatus(p.stock).tone}>{getProductStockStatus(p.stock).label}</StatusBadge>
                        {renderLossChip(lossMap, p)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-slate-600">{p.category}</td>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <StatusBadge tone="neutral">
                    {p.container?.trim() || 'Non défini'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <StatusBadge tone="success">
                    {p.warehouse?.trim() || 'Non défini'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-right font-semibold text-slate-950 tabular-nums">
                  {p.price?.toLocaleString('fr-FR')} CFA
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums lg:px-6 lg:py-4">
                  <div className="flex flex-col items-end gap-1">
                    <span>{p.stock}</span>
                    <StatusBadge tone={getProductStockStatus(p.stock).tone}>{getProductStockStatus(p.stock).label}</StatusBadge>
                  </div>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-slate-700">
                  <div className="font-medium">{p.supplierName || '—'}</div>
                  {p.supplierPhone && <div className="text-xs text-slate-500 mt-0.5">{p.supplierPhone}</div>}
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      aria-label="Modifier le produit"
                    >
                      <Edit3 className="h-5 w-5" aria-hidden />
                    </button>
                    {isAdmin && (
                      <>
                        <FeatureGate
                          feature={FEATURE_KEYS.PRODUCT_DUPLICATE}
                          locked={<LockedFeatureButton feature={FEATURE_KEYS.PRODUCT_DUPLICATE} icon={<Copy className="h-4 w-4" />}>Dupliquer</LockedFeatureButton>}
                        >
                          <button
                            type="button"
                            onClick={() => onDuplicate(p)}
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                            aria-label="Dupliquer le produit"
                            title="Dupliquer le produit"
                          >
                            <Copy className="h-5 w-5" aria-hidden />
                          </button>
                        </FeatureGate>
                        <button
                          type="button"
                          onClick={() => onDelete(p._id)}
                          className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                          aria-label="Supprimer le produit"
                        >
                          <Trash2 className="h-5 w-5" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (admin) */}
      <div className="md:hidden space-y-4 p-4">
        {visibleProducts.map((p) => (
          <div key={p._id} className={`rounded-2xl p-4 shadow-sm ${selectedIds.includes(p._id) ? 'border-2 border-[var(--ms-blue)] bg-[var(--ms-blue-soft)]' : 'border border-slate-200 bg-white'}`} onClick={() => document.activeElement?.blur?.()}>
            <div className="flex gap-3">
              <input
                type="checkbox"
                checked={selectedIds.includes(p._id)}
                onChange={() => toggleSelect(p._id)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--ms-blue)]"
                aria-label={`Sélectionner ${p.name}`}
              />
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-100" />
              ) : (
                <div className="w-16 h-16 bg-slate-100 text-slate-500 flex items-center justify-center rounded-xl shrink-0"><Package className="h-6 w-6" /></div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  to={productPath(p)}
                  state={productLinkState}
                  className="text-base font-semibold text-slate-950 hover:text-slate-700"
                  {...desktopLinkProps}
                >
                  {p.name}
                </Link>
                <p className="text-sm text-slate-500">{p.category || '—'}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <StatusBadge tone="neutral">
                    {p.container?.trim() || 'Non défini'}
                  </StatusBadge>
                  <StatusBadge tone="success">
                    {p.warehouse?.trim() || 'Non défini'}
                  </StatusBadge>
                  {renderLossChip(lossMap, p)}
                </div>
                <p className="text-sm font-semibold text-slate-950 mt-1">
                  {p.price?.toLocaleString('fr-FR')} CFA
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-[var(--ms-text-muted)] mt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Stock</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{p.stock}</p>
                  <StatusBadge tone={getProductStockStatus(p.stock).tone}>{getProductStockStatus(p.stock).label}</StatusBadge>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Fournisseur</p>
                <p className="font-medium text-slate-950">{p.supplierName || '—'}</p>
                {p.supplierPhone && <p className="text-xs text-slate-500">{p.supplierPhone}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => onEdit(p)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                <Edit3 className="h-4 w-4" />
                Modifier
              </button>
              {isAdmin && (
                <>
                  <FeatureGate
                    feature={FEATURE_KEYS.PRODUCT_DUPLICATE}
                    locked={<LockedFeatureButton feature={FEATURE_KEYS.PRODUCT_DUPLICATE} className="w-full justify-center" icon={<Copy className="h-4 w-4" />}>Dupliquer</LockedFeatureButton>}
                  >
                    <button
                      onClick={() => onDuplicate(p)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Copy className="h-4 w-4" />
                      Dupliquer
                    </button>
                  </FeatureGate>
                  <button
                    onClick={() => onDelete(p._id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {renderLoadMore()}

      {filtered.length === 0 && (
        <div className="text-center py-12 lg:py-16 text-gray-500">
          <EmptyState title="Aucun produit trouvé" description="Ajustez les filtres pour afficher le catalogue." />
        </div>
      )}
    </div>
  );
};

/* ===================================================== */
/* 🧱 INPUTS */
/* ===================================================== */
const inputBaseClass = 'form-control text-base sm:text-sm';
const Input = ({ label, className = '', ...props }) => (
  <div className={className}>
    <label className="form-label mb-1.5 block">{label}</label>
    <input {...props} className={inputBaseClass} />
  </div>
);

const Textarea = ({ label, rows = 3, className = '', ...props }) => (
  <div className={className}>
    <label className="form-label mb-1.5 block">{label}</label>
    <textarea rows={rows} {...props} className={`${inputBaseClass} resize-y min-h-[80px]`} />
  </div>
);

const Select = ({ label, options, className = '', emptyHint, ...props }) => (
  <div className={className}>
    <label className="form-label mb-1.5 block">{label}</label>
    <select {...props} className={`${inputBaseClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-10`}>
      <option value="">Sélectionnez...</option>
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
    {emptyHint && options.length === 0 && (
      <p className="mt-1.5 text-xs" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Aucun élément. <Link to="/settings" className="font-medium hover:underline" style={{ color: 'var(--colorBrandForeground1)' }}>Créez-en dans Paramètres → {emptyHint}</Link>
      </p>
    )}
  </div>
);

/* ─── Bulk edit modal ─────────────────────────────────── */
const BULK_FIELDS = [
  { key: 'category', label: 'Catégorie', type: 'select', source: 'categories' },
  { key: 'container', label: 'Conteneur', type: 'select', source: 'containers' },
  { key: 'warehouse', label: 'Entrepôt', type: 'select', source: 'warehouses' },
  { key: 'supplierName', label: 'Fournisseur', type: 'select', source: 'suppliers' },
  { key: 'price', label: 'Prix de vente (CFA)', type: 'number' },
  { key: 'costPrice', label: 'Prix de revient (CFA)', type: 'number' },
  { key: 'minStockLevel', label: 'Stock minimum', type: 'number' },
];

const BulkEditModal = ({ open, onClose, count, lookups = {}, onApply }) => {
  const [enabled, setEnabled] = useState({});
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setEnabled({}); setValues({}); } }, [open]);

  const sources = {
    categories: lookups.categories || [],
    containers: lookups.containers || [],
    warehouses: lookups.warehouses || [],
    suppliers: lookups.suppliers || [],
  };

  const apply = async (e) => {
    e.preventDefault();
    const updates = {};
    BULK_FIELDS.forEach((f) => {
      if (!enabled[f.key]) return;
      const v = values[f.key];
      if (f.type === 'number') { if (v !== '' && v != null) updates[f.key] = Number(v); }
      else { updates[f.key] = v ?? ''; }
    });
    if (Object.keys(updates).length === 0) { toast.error('Cochez au moins un champ à modifier.'); return; }
    setSubmitting(true);
    try { await onApply(updates); }
    catch (err) { toast.error(err.response?.data?.message || 'Erreur lors de la modification.'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Modifier en lot" subtitle={`${count} produit(s) sélectionné(s)`} size="md" mobileFullscreen>
      <form onSubmit={apply} className="space-y-3">
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          Cochez les champs à modifier. Seuls les champs cochés seront appliqués aux {count} produit(s).
          <br />Changer le <strong>conteneur</strong> met aussi à jour le nom des produits.
        </p>
        {BULK_FIELDS.map((f) => {
          const on = !!enabled[f.key];
          return (
            <div key={f.key} className="rounded-[var(--radiusMedium)] p-3" style={{ border: '1px solid var(--colorNeutralStroke2)', background: on ? 'var(--ms-blue-soft)' : 'var(--colorNeutralBackground1)' }}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => setEnabled((p) => ({ ...p, [f.key]: !on }))} className="h-4 w-4 accent-[var(--ms-blue)]" />
                <span className="form-label">{f.label}</span>
              </label>
              {on && (
                f.type === 'select' ? (
                  <select className="form-control mt-2" value={values[f.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">— Vider / non défini —</option>
                    {sources[f.source].map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}
                  </select>
                ) : (
                  <input type="number" min="0" inputMode="numeric" className="form-control mt-2" value={values[f.key] ?? ''} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} placeholder="Nouvelle valeur" />
                )
              )}
            </div>
          );
        })}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
          <button type="submit" disabled={submitting} className="ms-button ms-button-primary ms-button-md disabled:opacity-60">
            {submitting ? 'Application…' : `Appliquer à ${count}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default Products;
