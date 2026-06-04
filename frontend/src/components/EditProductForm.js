import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../services/api';
import {
  Button,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  Surface,
  Workspace,
} from './business';

const EditProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const returnTo = location.state?.returnTo || '/products';

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
      navigate(returnTo, { replace: true, state: { fromProductEdit: true } });
    } catch (error) {
      console.error('Error updating product:', error);
      setError(error.response?.data?.message || 'Erreur lors de la mise à jour du produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `form-control ${
      validationErrors[field] ? 'border-[var(--ms-danger)]' : ''
    }`;
  const selectClass = (field) =>
    `form-control ${
      validationErrors[field] ? 'border-[var(--ms-danger)]' : ''
    }`;

  /* ===================================================== */
  /* 🌀 ÉTATS DE CHARGEMENT / ERREUR */
  /* ===================================================== */
  if (loading) {
    return (
      <Workspace>
        <LoadingSkeleton rows={5} />
      </Workspace>
    );
  }

  if (error && !product) {
    return (
      <Workspace>
        <EmptyState
          title="Produit indisponible"
          description={error}
          action={<Button onClick={() => navigate(returnTo)}>Retour à la liste</Button>}
        />
      </Workspace>
    );
  }

  /* ===================================================== */
  /* 🧱 FORMULAIRE PRINCIPAL */
  /* ===================================================== */
  return (
    <Workspace>
      <PageHeader
        eyebrow="Inventaire"
        title="Modifier le produit"
        description={product?.name ? `Mise à jour de ${product.name}` : 'Mettez à jour les informations du produit.'}
        actions={
          <Button type="button" onClick={() => navigate(returnTo)}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      <Surface className="max-w-5xl">
          {error && (
            <div className="mb-6 border border-[var(--ms-danger)] bg-[rgba(209,52,56,0.08)] px-4 py-3 text-sm font-medium text-[var(--ms-danger)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section: Informations générales */}
            <section className="space-y-4">
              <h2 className="ms-section-title border-b border-[var(--ms-border)] pb-2">
                Informations générales
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du produit</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass('name')} />
                  {validationErrors.name && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
                  <select name="category" value={formData.category} onChange={handleChange} className={selectClass('category')}>
                    <option value="">Sélectionnez...</option>
                    {lookups.categories.map((c) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  {validationErrors.category && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.category}</p>}
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
                {validationErrors.description && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.description}</p>}
              </div>
            </section>

            {/* Section: Prix & stock */}
            <section className="space-y-4">
              <h2 className="ms-section-title border-b border-[var(--ms-border)] pb-2">
                Prix & stock
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix de revient (CFA)</label>
                  <input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} min="0" step="0.01" className={inputClass('costPrice')} />
                  {validationErrors.costPrice && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.costPrice}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix de vente (CFA)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} min="0" step="0.01" className={inputClass('price')} />
                  {validationErrors.price && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock disponible</label>
                  <input type="number" name="stock" value={formData.stock} onChange={handleChange} min="0" className={inputClass('stock')} />
                  {validationErrors.stock && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.stock}</p>}
                </div>
                <div className="flex flex-col justify-center border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3">
                  <p className="ms-kpi-title">Marge</p>
                  <p className={`text-lg font-semibold tabular-nums ${Number(profitMargin) > 0 ? 'text-[var(--ms-success)]' : Number(profitMargin) < 0 ? 'text-[var(--ms-danger)]' : 'text-[var(--ms-text)]'}`}>
                    {profitMargin}%
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Fournisseur */}
            <section className="space-y-4">
              <h2 className="ms-section-title border-b border-[var(--ms-border)] pb-2">
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
                  {validationErrors.supplierName && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.supplierName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                  <input type="text" name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} className={inputClass('supplierPhone')} readOnly />
                  {validationErrors.supplierPhone && <p className="mt-1 text-xs text-[var(--ms-danger)]">{validationErrors.supplierPhone}</p>}
                </div>
              </div>
            </section>

            {/* Section: Image */}
            <section className="space-y-4">
              <h2 className="ms-section-title border-b border-[var(--ms-border)] pb-2">
                Image
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de l'image</label>
                <input type="text" name="image" value={formData.image} onChange={handleChange} className={inputClass('image')} placeholder="https://..." />
              </div>
            </section>

            {/* Footer actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-[var(--ms-border)] pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={() => navigate(returnTo)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
              >
                {isSubmitting ? (
                  <>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer les modifications
                  </>
                )}
              </Button>
            </div>
          </form>
      </Surface>
    </Workspace>
  );
};

export default EditProductForm;
