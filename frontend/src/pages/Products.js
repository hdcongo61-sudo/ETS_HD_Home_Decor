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
  Trash2,
} from 'lucide-react';
import ProductImportModal from '../components/ProductImportModal';

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

  useEffect(() => {
    if (!isAdmin || !isFormOpen || lookupsLoaded) return;
    fetchLookups();
  }, [fetchLookups, isAdmin, isFormOpen, lookupsLoaded]);

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

  const totalStock = products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0);
  const inStockCount = products.filter((product) => Number(product.stock) > 0).length;
  const lowStockCount = products.filter((product) => Number(product.stock) > 0 && Number(product.stock) < 5).length;
  const outOfStockCount = products.filter((product) => Number(product.stock) <= 0).length;
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
      </div>

      {isAdmin && (
        <CommandBar>
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
            <Button variant="secondary" size="sm" form="product-list-export-excel" disabled>
              <Edit3 className="h-4 w-4" />
              Modifier
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(true)}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importer Excel
            </Button>
          </div>
          <div className="text-sm text-[var(--ms-text-muted)]">
            Sélectionnez une ligne pour ouvrir les détails produit.
          </div>
        </CommandBar>
      )}

      <DataTable>
        <ProductList
          products={products}
          loading={loading}
          onDelete={handleDelete}
          onEdit={handleEdit}
          isAdmin={isAdmin}
          lossMap={lossMap}
        />
      </DataTable>

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

const ProductList = ({ products, loading, onDelete, onEdit, isAdmin, lossMap = {} }) => {
  const { appSettings } = useAppSettings();
  const company = getCompanyIdentity(appSettings.branding);
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => readProductFiltersFromSearch(location.search));
  const [sortBy, setSortBy] = useState('name');
  const [exporting, setExporting] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);
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

  const renderFilterPanel = () => (
    <div className="border-b p-4 lg:p-5" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground2)' }}>
      {/* Statistiques des résultats — toujours affichées en haut, reflètent les résultats courants (filtrés ou non) */}
      {!loading && (
        <div className="mb-4 rounded-[var(--radiusLarge)] p-3" style={{ background: 'var(--ms-blue-soft)', border: '1px solid var(--colorNeutralStroke2)' }}>
          <p className="fui-caption1-strong mb-2 uppercase" style={{ color: 'var(--colorBrandForeground1)', letterSpacing: '0.06em' }}>
            {hasActiveFilters ? 'Résultats du filtre' : 'Statistiques du catalogue'}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Produits trouvés', value: resultStats.count.toLocaleString('fr-FR'), tone: 'brand' },
              { label: 'Unités en stock', value: resultStats.units.toLocaleString('fr-FR'), tone: 'neutral' },
              { label: 'En stock', value: resultStats.inStock.toLocaleString('fr-FR'), tone: 'success' },
              { label: 'Stock faible', value: resultStats.low.toLocaleString('fr-FR'), tone: 'warning' },
              { label: 'Rupture', value: resultStats.out.toLocaleString('fr-FR'), tone: 'danger' },
              ...(isAdmin ? [
                { label: 'Valeur (prix de vente)', value: `${resultStats.sellValue.toLocaleString('fr-FR')} CFA`, tone: 'neutral' },
                { label: 'Marge potentielle', value: `${resultStats.potentialMargin.toLocaleString('fr-FR')} CFA`, tone: 'success' },
              ] : []),
            ].map((s) => {
              const toneColor = {
                brand: 'var(--colorBrandForeground1)',
                success: 'var(--colorStatusSuccessForeground1)',
                warning: 'var(--colorStatusWarningForeground1)',
                danger: 'var(--colorStatusDangerForeground1)',
                neutral: 'var(--colorNeutralForeground1)',
              }[s.tone];
              return (
                <div
                  key={s.label}
                  className="rounded-[var(--radiusMedium)] px-3 py-1.5"
                  style={{ background: 'var(--colorNeutralBackground1)', border: '1px solid var(--colorNeutralStroke2)' }}
                >
                  <span className="fui-caption2 block" style={{ color: 'var(--colorNeutralForeground3)' }}>{s.label}</span>
                  <span className="fui-caption1-strong tabular-nums" style={{ color: toneColor }}>{s.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick stock-status chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label htmlFor="product-filter-name" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Produit
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="product-filter-name"
              type="text"
              placeholder="Nom du produit"
              value={filters.product}
              onChange={(e) => handleFilterChange('product', e.target.value)}
              className={`${filterInputClass} pl-9`}
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label htmlFor="product-filter-category" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Catégorie
          </label>
          <select
            id="product-filter-category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className={filterInputClass}
          >
            <option value="">Toutes les catégories</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product-filter-container" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Conteneur
          </label>
          <select
            id="product-filter-container"
            value={filters.container}
            onChange={(e) => handleFilterChange('container', e.target.value)}
            className={filterInputClass}
          >
            <option value="">Tous les conteneurs</option>
            {containerOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product-filter-warehouse" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Entrepôt
          </label>
          <select
            id="product-filter-warehouse"
            value={filters.warehouse}
            onChange={(e) => handleFilterChange('warehouse', e.target.value)}
            className={filterInputClass}
          >
            <option value="">Tous les entrepôts</option>
            {warehouseOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
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
        <div>
          <label htmlFor="product-filter-supplier" className="mb-1.5 block text-xs font-semibold uppercase text-[var(--ms-text-muted)]">
            Fournisseur
          </label>
          <select
            id="product-filter-supplier"
            value={filters.supplier}
            onChange={(e) => handleFilterChange('supplier', e.target.value)}
            className={filterInputClass}
          >
            <option value="">Tous les fournisseurs</option>
            {supplierOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className="ms-button ms-button-secondary ms-button-sm w-full justify-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{filtered.length}</span> produit{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
          </p>
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
        </div>
        {isAdmin && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting !== null || filtered.length === 0}
              className={actionButtonClass}
            >
              <Download className="h-4 w-4" />
              {exporting === 'excel' ? 'Export Excel…' : 'Exporter Excel'}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting !== null || filtered.length === 0}
              className={actionButtonClass}
            >
              <Download className="h-4 w-4" />
              {exporting === 'pdf' ? 'Export PDF…' : 'Exporter PDF'}
            </button>
          </div>
        )}
      </div>

    </div>
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
        {renderFilterPanel()}

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
      <div className="hidden md:flex items-center justify-between gap-4 px-4 py-4 lg:px-6 border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]">
        <div className="text-sm text-[var(--ms-text-muted)]">
          {filtered.length} produit{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            <Download className="h-4 w-4" />
            {exporting === 'excel' ? 'Export Excel…' : 'Exporter Excel'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            <Download className="h-4 w-4" />
            {exporting === 'pdf' ? 'Export PDF…' : 'Exporter PDF'}
          </button>
        </div>
      </div>
      <div className="md:hidden">
        {renderFilterPanel()}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm lg:text-base">
          <thead className="bg-slate-50 md:sticky md:top-0 z-10">
            <tr>
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
            <tr className="bg-white align-top">
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <input
                  type="text"
                  placeholder="Filtrer"
                  value={filters.product}
                  onChange={(e) => handleFilterChange('product', e.target.value)}
                  className={filterInputClass}
                  aria-label="Filtrer par produit"
                  autoComplete="off"
                />
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className={filterInputClass}
                  aria-label="Filtrer par catégorie"
                >
                  <option value="">Toutes</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <select
                  value={filters.container}
                  onChange={(e) => handleFilterChange('container', e.target.value)}
                  className={filterInputClass}
                  aria-label="Filtrer par conteneur"
                >
                  <option value="">Tous</option>
                  {containerOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <select
                  value={filters.warehouse}
                  onChange={(e) => handleFilterChange('warehouse', e.target.value)}
                  className={filterInputClass}
                  aria-label="Filtrer par entrepôt"
                >
                  <option value="">Tous</option>
                  {warehouseOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <div className="space-y-2">
                  <select
                    value={filters.priceOperator}
                    onChange={(e) => handleFilterChange('priceOperator', e.target.value)}
                    className={filterInputClass}
                    aria-label="Comparer le prix"
                  >
                    {comparisonOptions.map((option) => (
                      <option key={`price-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder={filters.priceOperator === 'between' ? 'Prix min' : 'Valeur'}
                    value={filters.price}
                    onChange={(e) => handleFilterChange('price', e.target.value)}
                    className={filterInputClass}
                    aria-label="Valeur du filtre prix"
                  />
                  {filters.priceOperator === 'between' && (
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="Prix max"
                      value={filters.priceMax}
                      onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                      className={filterInputClass}
                      aria-label="Valeur maximale du filtre prix"
                    />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <div className="space-y-2">
                  <select
                    value={filters.stockOperator}
                    onChange={(e) => handleFilterChange('stockOperator', e.target.value)}
                    className={filterInputClass}
                    aria-label="Comparer le stock"
                  >
                    {comparisonOptions.map((option) => (
                      <option key={`stock-${option.value || 'all'}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder={filters.stockOperator === 'between' ? 'Stock min' : 'Valeur'}
                    value={filters.stock}
                    onChange={(e) => handleFilterChange('stock', e.target.value)}
                    className={filterInputClass}
                    aria-label="Valeur du filtre stock"
                  />
                  {filters.stockOperator === 'between' && (
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      placeholder="Stock max"
                      value={filters.stockMax}
                      onChange={(e) => handleFilterChange('stockMax', e.target.value)}
                      className={filterInputClass}
                      aria-label="Valeur maximale du filtre stock"
                    />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4">
                <select
                  value={filters.supplier}
                  onChange={(e) => handleFilterChange('supplier', e.target.value)}
                  className={filterInputClass}
                  aria-label="Filtrer par fournisseur"
                >
                  <option value="">Tous</option>
                  {supplierOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right">
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className={actionButtonClass}
                  >
                    Réinitialiser
                  </button>
                  <span className="text-xs text-slate-500">
                    {filtered.length} produit{filtered.length > 1 ? 's' : ''}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {visibleProducts.map((p) => (
              <tr key={p._id} className="hover:bg-slate-50 transition-colors" onClick={() => document.activeElement?.blur?.()}>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex flex-col gap-2 items-center">
                    <Link
                      to={productPath(p)}
                      state={productLinkState}
                      className="font-medium text-slate-950 hover:text-slate-700 transition line-clamp-2 text-center w-full"
                      {...desktopLinkProps}
                    >
                      {p.name}
                    </Link>
                    {renderLossChip(lossMap, p)}
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl object-cover border border-slate-100 mx-auto" />
                    ) : (
                      <div className="w-14 h-14 lg:w-16 lg:h-16 bg-slate-100 flex items-center justify-center rounded-xl border border-slate-100 text-slate-500 mx-auto"><Package className="h-6 w-6" /></div>
                    )}
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
                      <button
                        type="button"
                        onClick={() => onDelete(p._id)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                        aria-label="Supprimer le produit"
                      >
                        <Trash2 className="h-5 w-5" aria-hidden />
                      </button>
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
          <div key={p._id} className="border border-slate-200 rounded-2xl p-4 shadow-sm bg-white" onClick={() => document.activeElement?.blur?.()}>
            <div className="flex gap-3">
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
                <button
                  onClick={() => onDelete(p._id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
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

export default Products;
