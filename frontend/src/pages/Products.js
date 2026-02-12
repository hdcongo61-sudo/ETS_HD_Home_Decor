// src/pages/Products.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import LoaderOverlay from '../components/LoaderOverlay';
import AppLoader from '../components/AppLoader';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { productPath } from '../utils/paths';
import Modal from '../components/Modal';

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

  useEffect(() => {
    fetchProducts();
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
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
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  };

  useEffect(() => {
    if (location.state?.fromProductEdit) {
      fetchProducts({ showLoading: false });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.fromProductEdit]);

  useEffect(() => {
    document.body.style.overflow = isFormOpen ? 'hidden' : 'auto';
  }, [isFormOpen]);

  const fetchProducts = async (options = {}) => {
    const { showLoading = true } = options;
    try {
      if (showLoading) setLoading(true);
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

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
        setIsFormOpen(false);
        setEditingProduct(null);
        await fetchProducts({ showLoading: false });
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
        toast.success('Produit supprimé ✅');
        await fetchProducts({ showLoading: false });
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
const ProductList = ({ products, loading, onDelete, onEdit, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState('');
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

  const desktopLinkProps = isDesktop
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AppLoader fullScreen={false} text="Chargement des produits…" />
      </div>
    );
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.container || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.warehouse || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div>
        <div className="p-4 lg:p-6 bg-gray-50/80 border-b border-gray-100 touch-manipulation">
          <div className="max-w-xl">
            <label htmlFor="search-products" className="sr-only">Rechercher un produit</label>
            <input
              id="search-products"
              type="text"
              placeholder="Rechercher par nom, catégorie, fournisseur, conteneur ou entrepôt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[44px] px-4 py-2.5 lg:px-5 lg:py-3 text-sm lg:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white touch-manipulation"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100 bg-white lg:divide-y-0 lg:p-6 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {filtered.map((p) => (
            <Link
              key={p._id}
              to={productPath(p)}
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
      {/* Search bar — desktop: full width, larger; mobile: reliable focus, blur on tap outside */}
      <div className="p-4 lg:p-6 bg-gray-50/80 border-b border-gray-100 touch-manipulation">
        <label htmlFor="admin-product-search" className="sr-only">Rechercher un produit</label>
        <input
          id="admin-product-search"
          type="text"
          placeholder="Rechercher par nom, catégorie, fournisseur, conteneur ou entrepôt..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-2xl min-h-[44px] px-4 py-2.5 lg:px-5 lg:py-3 text-sm lg:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white touch-manipulation"
          autoComplete="off"
        />
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
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((p) => (
              <tr key={p._id} className="hover:bg-indigo-50/50 transition-colors" onClick={() => document.activeElement?.blur?.()}>
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex flex-col gap-2 items-center">
                    <Link
                      to={productPath(p)}
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
        {filtered.map((p) => (
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
const inputBaseClass = 'w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-400';
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
