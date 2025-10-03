import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const CATEGORY_OPTIONS = ['Meuble', 'Decoration', 'Recouvrement', 'Electro-menager'];

const Products = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const navigate = useNavigate();
  
  useEffect(() => {
    fetchProducts();
  }, []);

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

  const handleCreate = async (productData) => {
    try {
      setFormSubmitting(true);
      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const { data } = editingProduct
        ? await api.put(`/products/${editingProduct._id}`, productData, config)
        : await api.post('/products', productData, config);

      if (data) {
        fetchProducts();
        setIsFormOpen(false);
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error:', error.response?.data?.message || error.message);
      alert('Operation failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    navigate(`/products/edit/${product._id}`);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      try {
        await api.delete(`/products/${productId}`);
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center">
          <h1 className="text-3xl font-semibold text-gray-900">Produits</h1>
          {!loading && products.length > 0 && (
            <span className="ml-3 bg-gray-100 text-gray-600 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {products.length}
            </span>
          )}
        </div>
        
        <button
          onClick={() => {
            setEditingProduct(null);
            setIsFormOpen(true);
          }}
          className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau produit
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </h2>
          </div>
          <div className="p-6">
            <ProductForm
              product={editingProduct}
              onSubmit={handleCreate}
              loading={formSubmitting}
            />
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingProduct(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors"
                disabled={formSubmitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                form="product-form"
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center min-w-[120px]"
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {editingProduct ? 'Mise à jour...' : 'Création...'}
                  </>
                ) : (
                  editingProduct ? 'Mettre à jour' : 'Créer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <ProductList
          products={products}
          loading={loading}
          onDelete={handleDelete}
          onEdit={handleEdit}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
};

const ProductList = ({ products, loading, onDelete, onEdit, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const formatUser = (user) => {
    if (!user) return null;
    return user.name || user.email || 'Utilisateur';
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  const renderAuditInfo = (entity) => {
    if (!isAdmin) return null;

    const lines = [];
    const createdLineUser = formatUser(entity.createdBy);
    const createdLineDate = formatDateTime(entity.createdAt);
    if (createdLineUser || createdLineDate) {
      lines.push(`Créé par ${createdLineUser || '—'}${createdLineDate ? ` · ${createdLineDate}` : ''}`);
    }

    const updatedLineUser = formatUser(entity.updatedBy);
    const updatedLineDate = formatDateTime(entity.updatedAt);
    if (updatedLineUser || updatedLineDate) {
      lines.push(`Modifié par ${updatedLineUser || '—'}${updatedLineDate ? ` · ${updatedLineDate}` : ''}`);
    }

    if (!lines.length) {
      return null;
    }

    return (
      <div className="mt-1 space-y-0.5 text-xs text-gray-400">
        {lines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    );
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (productId) => {
    setDeletingId(productId);
    try {
      await onDelete(productId);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500">Chargement des produits...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="p-5 border-b border-gray-200">
        <div className="relative">
          <svg
            className="w-5 h-5 absolute left-3 top-3 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Catégorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/products/${product._id}`} className="flex items-center group">
                    {product.image ? (
                      <img
                        className="h-10 w-10 rounded-lg object-cover"
                        src={product.image}
                        alt={product.name}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {product.description}
                      </div>
                      {renderAuditInfo(product)}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {product.price.toLocaleString('fr-FR')} CFA
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-medium ${product.stock < 5 ? 'text-red-600' : 'text-gray-900'}`}>
                    {product.stock}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onEdit(product)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center w-8 h-8"
                      aria-label="Delete"
                      disabled={deletingId === product._id}
                    >
                      {deletingId === product._id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile List */}
      <div className="md:hidden divide-y divide-gray-100">
        {filteredProducts.map((product) => (
          <div key={product._id} className="p-5">
            <Link to={`/products/${product._id}`} className="group">
              <div className="flex items-start justify-between">
                <div className="flex-1 flex items-start">
                  {product.image ? (
                    <img
                      className="h-14 w-14 rounded-lg object-cover mr-4"
                      src={product.image}
                      alt={product.name}
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-gray-100 flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                    <div className="mt-2 flex items-center">
                      <span className="text-sm font-medium text-gray-900 mr-3">
                        {product.price.toLocaleString('fr-FR')} CFA
                      </span>
                      <span className={`text-sm ${product.stock < 5 ? 'text-red-600' : 'text-gray-500'}`}>
                        Stock: {product.stock}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.category}
                      </span>
                    </div>
                    {renderAuditInfo(product)}
                  </div>
                </div>
                <div className="ml-4 flex flex-col items-center space-y-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(product._id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center w-8 h-8"
                    aria-label="Delete"
                    disabled={deletingId === product._id}
                  >
                    {deletingId === product._id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && !loading && (
        <div className="p-8 text-center">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-16M9 13h6m-6 4h6" />
            </svg>
          </div>
          <h3 className="mt-4 text-gray-900 font-medium">Aucun produit</h3>
          <p className="mt-1 text-gray-500">Aucun produit ne correspond à votre recherche.</p>
        </div>
      )}
    </div>
  );
};

const ProductForm = ({ product, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    costPrice: product?.costPrice || '',
    stock: product?.stock || '',
    category: product?.category || '',
    image: product?.image || '',
  });

  const [profitMargin, setProfitMargin] = useState(0);

  useEffect(() => {
    if (formData.price && formData.costPrice) {
      const price = parseFloat(formData.price);
      const cost = parseFloat(formData.costPrice);
      const margin = ((price - cost) / cost) * 100;
      setProfitMargin(margin);
    } else {
      setProfitMargin(0);
    }
  }, [formData.price, formData.costPrice]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const processedData = {
      ...formData,
      category: formData.category.trim(),
      price: parseFloat(formData.price),
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
      stock: parseInt(formData.stock, 10),
    };

    onSubmit(processedData);
  };

  return (
    <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="name">
            Nom du produit
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="category">
            Catégorie
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={loading}
          >
            <option value="" disabled>
              Sélectionnez une catégorie
            </option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {formData.category && !CATEGORY_OPTIONS.includes(formData.category) && (
              <option value={formData.category}>{formData.category}</option>
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="costPrice">
            Prix de revient (CFA)
          </label>
          <input
            type="number"
            id="costPrice"
            name="costPrice"
            value={formData.costPrice}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min="0"
            step="0.01"
            placeholder="0.00"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="price">
            Prix de vente (CFA)
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            min="0"
            step="0.01"
            placeholder="0.00"
            disabled={loading}
          />
        </div>

        <div className={`p-4 rounded-xl flex flex-col justify-center ${
          profitMargin > 0 ? 'bg-green-50' : profitMargin < 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <div className="text-sm font-medium text-gray-700 mb-1">Marge bénéficiaire</div>
          <div className={`text-xl font-semibold ${
            profitMargin > 0 ? 'text-green-600' : profitMargin < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {profitMargin.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="stock">
            Stock disponible
          </label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            min="0"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="image">
            URL de l'image
          </label>
          <input
            type="url"
            id="image"
            name="image"
            value={formData.image}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/image.jpg"
            disabled={loading}
          />
        </div>
      </div>

      {formData.image && (
        <div className="flex justify-center">
          <div className="w-32 h-32 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden">
            <img
              src={formData.image}
              alt="Aperçu"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </form>
  );
};

export default Products;
