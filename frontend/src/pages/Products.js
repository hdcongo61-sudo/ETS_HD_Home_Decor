// src/pages/Products.jsx
import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import LoaderOverlay from '../components/LoaderOverlay';
import AppLoader from '../components/AppLoader';
import toast, { Toaster } from 'react-hot-toast';
import { productPath } from '../utils/paths';
import Modal from '../components/Modal';

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
  const [editingProduct, setEditingProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
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
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
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

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 relative">
        <Toaster position="top-right" />

        <LoaderOverlay
          show={formSubmitting}
          text={editingProduct ? 'Modification produit...' : 'Création du produit...'}
        />

        {/* ===== Header (desktop-optimized) ===== */}
        <header className="mb-8 lg:mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl lg:text-4xl tracking-tight">
                Produits
              </h1>
              <p className="mt-1 text-sm text-gray-500 lg:text-base">
                Gérez votre catalogue et vos stocks
              </p>
              {!loading && products.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{products.length}</span> produit{products.length > 1 ? 's' : ''} au catalogue
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-95 active:opacity-90 transition shadow-lg shadow-indigo-500/25 lg:px-6 lg:py-3 lg:text-base lg:rounded-2xl"
              >
                <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouveau produit
              </button>
            )}
          </div>
        </header>

        {/* ===== Liste des produits ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden lg:shadow-md lg:rounded-3xl">
          <ProductList
            products={products}
            loading={loading}
            onDelete={handleDelete}
            onEdit={handleEdit}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* ===== Modal Form ===== */}
      {isAdmin && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
          }}
          title={editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
          subtitle={editingProduct ? 'Mettez à jour les informations du produit.' : 'Renseignez les informations du nouveau produit.'}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingProduct(null);
                }}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 font-medium transition"
                disabled={formSubmitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                form="product-form"
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition disabled:opacity-50"
                disabled={formSubmitting}
              >
                {editingProduct ? 'Enregistrer les modifications' : 'Créer le produit'}
              </button>
            </>
          }
        >
          <ProductForm
            product={editingProduct}
            onSubmit={handleCreate}
            loading={formSubmitting}
            lookups={lookups}
          />
        </Modal>
      )}
    </div>
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
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Informations générales
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Nom du produit" name="name" value={formData.name} onChange={handleChange} required />
          <Select label="Catégorie" name="category" value={formData.category} onChange={handleChange} options={categories.map((c) => c.name)} />
          <Select label="Conteneur" name="container" value={formData.container} onChange={handleChange} options={containers.map((c) => c.name)} />
          <Select label="Entrepôt" name="warehouse" value={formData.warehouse} onChange={handleChange} options={warehouses.map((w) => w.name)} />
        </div>
        <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} rows={3} />
      </section>

      {/* Section: Prix & stock */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Prix & stock
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Prix de revient (CFA)" name="costPrice" type="number" min="0" step="0.01" value={formData.costPrice} onChange={handleChange} />
          <Input label="Prix de vente (CFA)" name="price" type="number" min="0" step="0.01" value={formData.price} onChange={handleChange} />
          <Input label="Stock disponible" name="stock" type="number" min="0" value={formData.stock} onChange={handleChange} />
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Marge</p>
            <p className={`text-lg font-semibold tabular-nums ${profitMargin > 0 ? 'text-green-600' : profitMargin < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              {Number(profitMargin).toFixed(1)}%
            </p>
          </div>
        </div>
      </section>

      {/* Section: Fournisseur */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Fournisseur
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Fournisseur" name="supplierName" value={formData.supplierName} onChange={handleSupplierChange} options={suppliers.map((s) => s.name)} />
          <Input label="Téléphone" name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} readOnly />
        </div>
      </section>

      {/* Section: Image */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
          Image
        </h3>
        <Input label="URL de l'image" name="image" value={formData.image} onChange={handleChange} placeholder="https://..." />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Importer une image</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:transition-colors"
            />
            {previewUrl && (
              <img src={previewUrl} alt="Aperçu" className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Upload déclenche un envoi automatique vers Cloudinary.</p>
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

const ProductList = ({ products, loading, onDelete, onEdit, isAdmin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => readProductFiltersFromSearch(location.search));
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

  const hasActiveFilters = Object.values(filters).some((value) => String(value).trim() !== '');
  const filterInputClass = 'w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';
  const actionButtonClass = 'inline-flex items-center justify-center min-h-[40px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50';
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

    return products.filter((product) => {
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
  }, [filters, products]);

  useEffect(() => {
    setVisibleCount(PRODUCT_PAGE_SIZE);
  }, [filters, products.length]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMoreProducts = visibleCount < filtered.length;

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
      doc.text('Export des produits', 40, 40);

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
      <label htmlFor={`${operatorKey}-operator`} className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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

  const renderFilterPanel = () => (
    <div className="p-4 lg:p-6 bg-gray-50/80 border-b border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label htmlFor="product-filter-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Produit
          </label>
          <input
            id="product-filter-name"
            type="text"
            placeholder="Nom du produit"
            value={filters.product}
            onChange={(e) => handleFilterChange('product', e.target.value)}
            className={filterInputClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="product-filter-category" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
          <label htmlFor="product-filter-container" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
          <label htmlFor="product-filter-warehouse" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
          <label htmlFor="product-filter-supplier" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="w-full min-h-[40px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-gray-600">
          {filtered.length} produit{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            {exporting === 'excel' ? 'Export Excel…' : 'Exporter Excel'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            {exporting === 'pdf' ? 'Export PDF…' : 'Exporter PDF'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderLoadMore = () =>
    hasMoreProducts ? (
      <div className="border-t border-gray-100 bg-white px-4 py-4 text-center">
        <p className="mb-3 text-sm text-gray-500">
          {visibleProducts.length} sur {filtered.length} produits affichés
        </p>
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PRODUCT_PAGE_SIZE)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          Afficher plus de produits
        </button>
      </div>
    ) : null;

  if (!isAdmin) {
    return (
      <div>
        {renderFilterPanel()}

        <div className="divide-y divide-gray-100 bg-white lg:divide-y-0 lg:p-6 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {visibleProducts.map((p) => (
            <Link
              key={p._id}
              to={productPath(p)}
              state={productLinkState}
              {...desktopLinkProps}
              onClick={() => typeof document !== 'undefined' && document.activeElement?.blur?.()}
              className="block p-4 flex flex-col gap-1 hover:bg-gray-50 transition-colors lg:p-5 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-sm lg:hover:shadow-md lg:hover:border-indigo-200"
            >
              <p className="text-base font-semibold text-gray-900 lg:text-lg">{p.name}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {p.container?.trim() || 'Non défini'}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {p.warehouse?.trim() || 'Non défini'}
                </span>
              </div>
              <p className={`text-sm font-medium mt-2 ${p.stock < 5 ? 'text-red-600' : 'text-gray-700'}`}>
                Stock : <span className="font-semibold">{p.stock}</span>
              </p>
            </Link>
          ))}
        </div>

        {renderLoadMore()}

        {filtered.length === 0 && (
          <div className="text-center py-12 lg:py-16 text-gray-500">
            <p className="text-base lg:text-lg">Aucun produit trouvé.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="hidden md:flex items-center justify-between gap-4 px-4 py-4 lg:px-6 border-b border-gray-100 bg-gray-50/70">
        <div className="text-sm text-gray-600">
          {filtered.length} produit{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            {exporting === 'excel' ? 'Export Excel…' : 'Exporter Excel'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null || filtered.length === 0}
            className={actionButtonClass}
          >
            {exporting === 'pdf' ? 'Export PDF…' : 'Exporter PDF'}
          </button>
        </div>
      </div>
      <div className="md:hidden">
        {renderFilterPanel()}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm lg:text-base">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Catégorie
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Conteneur
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Entrepôt
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Fournisseur
              </th>
              <th className="px-4 py-3 lg:px-6 lg:py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                  <span className="text-xs text-gray-500">
                    {filtered.length} produit{filtered.length > 1 ? 's' : ''}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleProducts.map((p) => (
              <tr key={p._id} className="hover:bg-indigo-50/50 transition-colors" onClick={() => document.activeElement?.blur?.()}>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex flex-col gap-2 items-center">
                    <Link
                      to={productPath(p)}
                      state={productLinkState}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition line-clamp-2 text-center w-full"
                      {...desktopLinkProps}
                    >
                      {p.name}
                    </Link>
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl object-cover border border-gray-100 mx-auto" />
                    ) : (
                      <div className="w-14 h-14 lg:w-16 lg:h-16 bg-gray-100 flex items-center justify-center rounded-xl border border-gray-100 text-2xl mx-auto">📦</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-gray-600">{p.category}</td>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    {p.container?.trim() || 'Non défini'}
                  </span>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {p.warehouse?.trim() || 'Non défini'}
                  </span>
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-right font-semibold text-gray-900 tabular-nums">
                  {p.price?.toLocaleString('fr-FR')} CFA
                </td>
                <td className={`px-4 py-3 lg:px-6 lg:py-4 text-right font-medium tabular-nums ${p.stock < 5 ? 'text-red-600' : 'text-gray-800'}`}>
                  {p.stock}
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-gray-700">
                  <div className="font-medium">{p.supplierName || '—'}</div>
                  {p.supplierPhone && <div className="text-xs text-gray-500 mt-0.5">{p.supplierPhone}</div>}
                </td>
                <td className="px-4 py-3 lg:px-6 lg:py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                      aria-label="Modifier le produit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDelete(p._id)}
                        className="p-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition"
                        aria-label="Supprimer le produit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
          <div key={p._id} className="border border-gray-200 rounded-2xl p-4 shadow-sm bg-white" onClick={() => document.activeElement?.blur?.()}>
            <div className="flex gap-3">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded-xl shrink-0">📦</div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  to={productPath(p)}
                  state={productLinkState}
                  className="text-base font-semibold text-indigo-600 hover:underline"
                  {...desktopLinkProps}
                >
                  {p.name}
                </Link>
                <p className="text-sm text-gray-500">{p.category || '—'}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {p.container?.trim() || 'Non défini'}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {p.warehouse?.trim() || 'Non défini'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {p.price?.toLocaleString('fr-FR')} CFA
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mt-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Stock</p>
                <p className={`font-semibold ${p.stock < 5 ? 'text-red-600' : 'text-gray-900'}`}>{p.stock}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Fournisseur</p>
                <p className="font-medium text-gray-900">{p.supplierName || '—'}</p>
                {p.supplierPhone && <p className="text-xs text-gray-500">{p.supplierPhone}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => onEdit(p)}
                className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition text-sm font-medium"
              >
                Modifier
              </button>
              {isAdmin && (
                <button
                  onClick={() => onDelete(p._id)}
                  className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition text-sm font-medium"
                >
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
          <p className="text-base lg:text-lg">Aucun produit trouvé.</p>
        </div>
      )}
    </div>
  );
};

/* ===================================================== */
/* 🧱 INPUTS */
/* ===================================================== */
const inputBaseClass = 'w-full px-4 py-2.5 text-base sm:text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-400';
const Input = ({ label, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input {...props} className={inputBaseClass} />
  </div>
);

const Textarea = ({ label, rows = 3, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <textarea rows={rows} {...props} className={`${inputBaseClass} resize-y min-h-[80px]`} />
  </div>
);

const Select = ({ label, options, className = '', ...props }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <select {...props} className={`${inputBaseClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-10`}>
      <option value="">Sélectionnez...</option>
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export default Products;
