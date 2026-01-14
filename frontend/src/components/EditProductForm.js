import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const CATEGORY_OPTIONS = ['Meuble', 'Decoration', 'Recouvrement', 'Electro-menager'];

const EditProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    costPrice: '',
    stock: '',
    category: '',
    image: '',
    supplierName: '',
    supplierPhone: '',
    container: '',
    warehouse: ''
  });
  const [profitMargin, setProfitMargin] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});

  /* ===================================================== */
  /* 🔄 CHARGEMENT DU PRODUIT EXISTANT */
  /* ===================================================== */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/products/${id}`);
        setProduct(response.data);
        setFormData({
          name: response.data.name || '',
          description: response.data.description || '',
          price: response.data.price || '',
          costPrice: response.data.costPrice || '',
          stock: response.data.stock || '',
          category: response.data.category || '',
          image: response.data.image || '',
          supplierName: response.data.supplierName || '',
          supplierPhone: response.data.supplierPhone || '',
          container: response.data.container || '',
          warehouse: response.data.warehouse || ''
        });
      } catch (err) {
        setError('Erreur lors du chargement du produit');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  /* ===================================================== */
  /* 📊 CALCUL AUTOMATIQUE DE LA MARGE */
  /* ===================================================== */
  useEffect(() => {
    if (formData.price && formData.costPrice) {
      const price = parseFloat(formData.price);
      const cost = parseFloat(formData.costPrice);
      const margin = cost > 0 ? ((price - cost) / cost) * 100 : 0;
      setProfitMargin(margin.toFixed(2));
    } else {
      setProfitMargin(0);
    }
  }, [formData.price, formData.costPrice]);

  /* ===================================================== */
  /* 🧩 GESTION DES CHANGEMENTS */
  /* ===================================================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (validationErrors[name]) {
      setValidationErrors({ ...validationErrors, [name]: '' });
    }
  };

  /* ===================================================== */
  /* ✅ VALIDATION */
  /* ===================================================== */
  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Le nom est requis';
    if (!formData.description.trim()) errors.description = 'La description est requise';
    if (!formData.price || parseFloat(formData.price) <= 0)
      errors.price = 'Le prix doit être supérieur à 0';
    if (formData.costPrice && parseFloat(formData.costPrice) < 0)
      errors.costPrice = 'Le prix de revient ne peut pas être négatif';
    if (!formData.stock || parseInt(formData.stock, 10) < 0)
      errors.stock = 'Le stock ne peut pas être négatif';
    if (!formData.category.trim()) errors.category = 'La catégorie est requise';
    if (!formData.supplierName.trim()) errors.supplierName = 'Le nom du fournisseur est requis';
    if (!formData.supplierPhone.trim()) errors.supplierPhone = 'Le téléphone du fournisseur est requis';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ===================================================== */
  /* 💾 SOUMISSION DU FORMULAIRE */
  /* ===================================================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        stock: parseInt(formData.stock, 10),
        category: formData.category.trim(),
        image: formData.image.trim() || null,
        supplierName: formData.supplierName.trim(),
        supplierPhone: formData.supplierPhone.trim(),
        container: formData.container.trim(),
        warehouse: formData.warehouse.trim()
      };

      await api.put(`/products/${id}`, productData);
      navigate('/products');
    } catch (error) {
      console.error('Error updating product:', error);
      setError(error.response?.data?.message || 'Erreur lors de la mise à jour du produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ===================================================== */
  /* 🌀 ÉTATS DE CHARGEMENT / ERREUR */
  /* ===================================================== */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-red-600">{error}</h2>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  /* ===================================================== */
  /* 🧱 FORMULAIRE PRINCIPAL */
  /* ===================================================== */
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Retour
          </button>
          <h1 className="text-xl font-bold">Modifier le Produit</h1>
          <div className="w-24"></div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom et Catégorie */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Nom du Produit</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {validationErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Catégorie</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Sélectionnez...</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {validationErrors.category && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.category}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Conteneur</label>
                <input
                  type="text"
                  name="container"
                  value={formData.container}
                  onChange={handleChange}
                  className="w-full p-2 border rounded border-gray-300"
                  placeholder="Ex: Conteneur A"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Entrepot</label>
                <input
                  type="text"
                  name="warehouse"
                  value={formData.warehouse}
                  onChange={handleChange}
                  className="w-full p-2 border rounded border-gray-300"
                  placeholder="Ex: Depot Central"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-700 font-medium mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={`w-full p-2 border rounded ${
                  validationErrors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                rows="3"
              />
              {validationErrors.description && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
              )}
            </div>

            {/* Prix et Stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Prix de Revient</label>
                <input
                  type="number"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.costPrice ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Prix de Vente</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium mb-1">Marge Bénéficiaire</label>
                <p
                  className={`text-lg font-semibold ${
                    profitMargin > 0
                      ? 'text-green-600'
                      : profitMargin < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {profitMargin}%
                </p>
              </div>
            </div>

            {/* Stock + Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Stock</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.stock ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">URL Image</label>
                <input
                  type="text"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="https://exemple.com/image.jpg"
                />
              </div>
            </div>

            {/* Fournisseur */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Nom du Fournisseur
                </label>
                <input
                  type="text"
                  name="supplierName"
                  value={formData.supplierName}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.supplierName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {validationErrors.supplierName && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.supplierName}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Téléphone du Fournisseur
                </label>
                <input
                  type="text"
                  name="supplierPhone"
                  value={formData.supplierPhone}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded ${
                    validationErrors.supplierPhone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {validationErrors.supplierPhone && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.supplierPhone}</p>
                )}
              </div>
            </div>

            {/* Boutons */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-md text-white flex items-center gap-2 ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    Enregistrement...
                  </>
                ) : (
                  'Enregistrer les modifications'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProductForm;
