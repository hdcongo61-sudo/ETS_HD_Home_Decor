// src/pages/Products.jsx
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import LoaderOverlay from '../components/LoaderOverlay';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { productPath } from '../utils/paths';

const CATEGORY_OPTIONS = ['Meuble', 'Decoration', 'Recouvrement', 'Electro-menager'];

const Products = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isFormOpen ? 'hidden' : 'auto';
  }, [isFormOpen]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
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
        fetchProducts();
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
        setLoading(true);
        await api.delete(`/products/${productId}`);
        toast.success('Produit supprimé ✅');
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Erreur lors de la suppression ❌');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 relative">
        <Toaster position="top-right" />

        <LoaderOverlay
          show={formSubmitting}
          text={editingProduct ? 'Mise à jour du produit...' : 'Création du produit...'}
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
          show={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
          }}
          title={editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
        >
          <ProductForm
            product={editingProduct}
            onSubmit={handleCreate}
            loading={formSubmitting}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setIsFormOpen(false);
                setEditingProduct(null);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
              disabled={formSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="product-form"
              className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:opacity-90 transition"
              disabled={formSubmitting}
            >
              {editingProduct ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
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

const ProductForm = ({ product, onSubmit, loading }) => {
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
      const margin = ((price - cost) / cost) * 100;
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
    if (name === 'image') {
      setImageFile(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
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
    <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Input label="Nom du produit" name="name" value={formData.name} onChange={handleChange} />
        <Select
          label="Catégorie"
          name="category"
          value={formData.category}
          onChange={handleChange}
          options={CATEGORY_OPTIONS}
        />
        <Input label="Conteneur" name="container" value={formData.container} onChange={handleChange} />
        <Input label="Entrepot" name="warehouse" value={formData.warehouse} onChange={handleChange} required />
      </div>

      <Textarea
        label="Description"
        name="description"
        value={formData.description}
        onChange={handleChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Input label="Prix de revient (CFA)" name="costPrice" type="number" value={formData.costPrice} onChange={handleChange} />
        <Input label="Prix de vente (CFA)" name="price" type="number" value={formData.price} onChange={handleChange} />
        <div
          className={`p-4 rounded-xl text-center ${
            profitMargin > 0 ? 'bg-green-50' : profitMargin < 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}
        >
          <p className="text-sm text-gray-600">Marge bénéficiaire</p>
          <p
            className={`text-lg font-bold ${
              profitMargin > 0 ? 'text-green-600' : profitMargin < 0 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            {profitMargin.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Input label="Stock disponible" name="stock" type="number" value={formData.stock} onChange={handleChange} />
        <Input label="Nom fournisseur" name="supplierName" value={formData.supplierName} onChange={handleChange} />
        <Input label="Téléphone fournisseur" name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} />
      </div>

      <Input label="URL de l'image" name="image" value={formData.image} onChange={handleChange} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Importer une image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
        />
        <p className="text-xs text-gray-500 mt-1">
          Un téléchargement déclenchera un upload Cloudinary automatique.
        </p>
      </div>

      {previewUrl && (
        <div className="flex justify-center mt-4">
          <img src={previewUrl} alt="Aperçu" className="w-32 h-32 rounded-xl object-cover border border-gray-200 shadow-sm" />
        </div>
      )}
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
        <div className="w-10 h-10 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 text-sm">Chargement des produits...</p>
      </div>
    );
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.container || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.warehouse || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div>
        <div className="p-4 lg:p-6 bg-gray-50/80 border-b border-gray-100">
          <div className="max-w-xl">
            <label htmlFor="search-products" className="sr-only">Rechercher un produit</label>
            <input
              id="search-products"
              type="text"
              placeholder="Rechercher par nom, catégorie, conteneur ou entrepôt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 lg:px-5 lg:py-3 text-sm lg:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100 bg-white lg:divide-y-0 lg:p-6 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {filtered.map((p) => (
            <Link
              key={p._id}
              to={productPath(p)}
              {...desktopLinkProps}
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
      {/* Search bar — desktop: full width, larger */}
      <div className="p-4 lg:p-6 bg-gray-50/80 border-b border-gray-100">
        <label htmlFor="admin-product-search" className="sr-only">Rechercher un produit</label>
        <input
          id="admin-product-search"
          type="text"
          placeholder="Rechercher par nom, catégorie, conteneur ou entrepôt..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-2xl px-4 py-2.5 lg:px-5 lg:py-3 text-sm lg:text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
              <tr key={p._id} className="hover:bg-indigo-50/50 transition-colors">
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gray-100 flex items-center justify-center rounded-xl shrink-0 text-lg">📦</div>
                    )}
                    <Link
                      to={productPath(p)}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition"
                      {...desktopLinkProps}
                    >
                      {p.name}
                    </Link>
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
                      onClick={() => onEdit(p)}
                      className="px-3 py-2 lg:px-4 lg:py-2 text-sm font-medium bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition"
                    >
                      Modifier
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => onDelete(p._id)}
                        className="px-3 py-2 lg:px-4 lg:py-2 text-sm font-medium bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition"
                      >
                        Supprimer
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
          <div key={p._id} className="border border-gray-200 rounded-2xl p-4 shadow-sm bg-white">
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
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <input {...props} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <textarea {...props} rows={3} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500" />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <select {...props} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500">
      <option value="">Sélectionnez...</option>
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

/* ===================================================== */
/* 🪟 MODAL ANIMÉ */
/* ===================================================== */
const Modal = ({ show, onClose, title, children }) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{
              opacity: 0,
              scale: isMobile ? 1 : 0.92,
              y: isMobile ? 40 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: isMobile ? 1 : 0.95,
              y: isMobile ? 40 : 0,
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto my-6 sm:my-12 flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div
              className="p-5 sm:p-6 overflow-y-auto"
              style={{ maxHeight: 'calc(90vh - 72px)' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Products;
