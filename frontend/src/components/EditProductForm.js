import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AppLoader from './AppLoader';

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
  const [lookups, setLookups] = useState({ categories: [], containers: [], warehouses: [], suppliers: [] });

  /* ===================================================== */
  /* 🔄 CHARGEMENT DU PRODUIT EXISTANT + LOOKUPS */
  /* ===================================================== */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productRes, cats, conts, whs, supps] = await Promise.all([
          api.get(`/products/${id}`),
          api.get('/lookups/categories'),
          api.get('/lookups/containers'),
          api.get('/lookups/warehouses'),
          api.get('/lookups/suppliers'),
        ]);
        setProduct(productRes.data);
        setFormData({
          name: productRes.data.name || '',
          description: productRes.data.description || '',
          price: productRes.data.price || '',
          costPrice: productRes.data.costPrice || '',
          stock: productRes.data.stock || '',
          category: productRes.data.category || '',
          image: productRes.data.image || '',
          supplierName: productRes.data.supplierName || '',
          supplierPhone: productRes.data.supplierPhone || '',
          container: productRes.data.container || '',
          warehouse: productRes.data.warehouse || ''
        });
        setLookups({
          categories: cats.data,
          containers: conts.data,
          warehouses: whs.data,
          suppliers: supps.data,
        });
      } catch (err) {
        setError('Erreur lors du chargement du produit');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const handleSupplierChange = (e) => {
    const selectedName = e.target.value;
    const found = lookups.suppliers.find((s) => s.name === selectedName);
    setFormData((prev) => ({
      ...prev,
      supplierName: selectedName,
      supplierPhone: found?.phone || '',
    }));
    if (validationErrors.supplierName) {
      setValidationErrors({ ...validationErrors, supplierName: '' });
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
      navigate('/products', { replace: true, state: { fromProductEdit: true } });
    } catch (error) {
      console.error('Error updating product:', error);
      setError(error.response?.data?.message || 'Erreur lors de la mise à jour du produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-4 py-2.5 text-sm border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition placeholder:text-gray-400 ${
      validationErrors[field] ? 'border-red-500' : 'border-gray-300'
    }`;
  const selectClass = (field) =>
    `w-full px-4 py-2.5 text-sm border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10 ${
      validationErrors[field] ? 'border-red-500' : 'border-gray-300'
    }`;

  /* ===================================================== */
  /* 🌀 ÉTATS DE CHARGEMENT / ERREUR */
  /* ===================================================== */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[320px]">
        <AppLoader fullScreen={false} text="Chargement…" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium"
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Retour
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Modifier le produit</h1>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section: Informations générales */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
                Informations générales
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du produit</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass('name')} />
                  {validationErrors.name && <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
                  <select name="category" value={formData.category} onChange={handleChange} className={selectClass('category')}>
                    <option value="">Sélectionnez...</option>
                    {lookups.categories.map((c) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  {validationErrors.category && <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Conteneur</label>
                  <select name="container" value={formData.container} onChange={handleChange} className={selectClass('container')}>
                    <option value="">Sélectionnez...</option>
                    {lookups.containers.map((c) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Entrepôt</label>
                  <select name="warehouse" value={formData.warehouse} onChange={handleChange} className={selectClass('warehouse')}>
                    <option value="">Sélectionnez...</option>
                    {lookups.warehouses.map((w) => (
                      <option key={w._id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className={`${inputClass('description')} resize-y min-h-[80px]`} />
                {validationErrors.description && <p className="text-red-500 text-xs mt-1">{validationErrors.description}</p>}
              </div>
            </section>

            {/* Section: Prix & stock */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
                Prix & stock
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix de revient (CFA)</label>
                  <input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} min="0" step="0.01" className={inputClass('costPrice')} />
                  {validationErrors.costPrice && <p className="text-red-500 text-xs mt-1">{validationErrors.costPrice}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix de vente (CFA)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} min="0" step="0.01" className={inputClass('price')} />
                  {validationErrors.price && <p className="text-red-500 text-xs mt-1">{validationErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock disponible</label>
                  <input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" className={inputClass('stock')} />
                  {validationErrors.stock && <p className="text-red-500 text-xs mt-1">{validationErrors.stock}</p>}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 flex flex-col justify-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Marge</p>
                  <p className={`text-lg font-semibold tabular-nums ${Number(profitMargin) > 0 ? 'text-green-600' : Number(profitMargin) < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {profitMargin}%
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Fournisseur */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
                Fournisseur
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fournisseur</label>
                  <select name="supplierName" value={formData.supplierName} onChange={handleSupplierChange} className={selectClass('supplierName')}>
                    <option value="">Sélectionnez...</option>
                    {lookups.suppliers.map((s) => (
                      <option key={s._id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {validationErrors.supplierName && <p className="text-red-500 text-xs mt-1">{validationErrors.supplierName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                  <input type="text" name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} className={inputClass('supplierPhone')} readOnly />
                  {validationErrors.supplierPhone && <p className="text-red-500 text-xs mt-1">{validationErrors.supplierPhone}</p>}
                </div>
              </div>
            </section>

            {/* Section: Image */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-2">
                Image
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de l'image</label>
                <input type="text" name="image" value={formData.image} onChange={handleChange} className={inputClass('image')} placeholder="https://..." />
              </div>
            </section>

            {/* Footer actions */}
            <div className="pt-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="min-h-[44px] px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 font-medium transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
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
