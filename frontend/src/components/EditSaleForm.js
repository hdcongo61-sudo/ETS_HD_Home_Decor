import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import { FormActionsSticky } from './FormLayout';
import { getSaleTypeText } from '../utils/saleUtils';

const EditSaleForm = ({ sale, clients, onUpdate, onCancel }) => {
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [modificationNote, setModificationNote] = useState('');
    const [errors, setErrors] = useState([]);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockInfos, setStockInfos] = useState({});
    const [productSearchTerms, setProductSearchTerms] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get('/products');
                setProducts(response.data);
                const stockData = {};
                response.data.forEach(product => {
                    stockData[product._id] = {
                        stock: product.stock,
                        costPrice: product.costPrice
                    };
                });
                setStockInfos(stockData);
            } catch (error) {
                setFormError('Échec du chargement des produits');
                console.error('Error fetching products:', error);
            }
        };

        fetchProducts();

        if (sale) {
            const prefilledProducts = sale.products.map(p => ({
                product: p.product._id,
                quantity: p.quantity,
                price: p.priceAtSale,
                originalQuantity: p.quantity
            }));
            setSelectedProducts(prefilledProducts);
            setProductSearchTerms(prefilledProducts.map(() => ''));
            setErrors(prefilledProducts.map(() => null));
        }
    }, [sale]);

    const getFilteredProducts = (searchTerm) => {
        const safeTerm = (searchTerm || '').toLowerCase();
        return products.filter((product) => {
            const containerValue = (product.container || '').toLowerCase();
            return (
                product.name.toLowerCase().includes(safeTerm) ||
                containerValue.includes(safeTerm)
            );
        });
    };

    const validateForm = () => {
        const newErrors = selectedProducts.map((item) => {
            if (!item.product) return 'Sélectionnez un produit';
            const product = products.find(p => p._id === item.product);
            if (!product) return 'Produit invalide';
            if (item.quantity === '' || item.quantity === null) return "Quantité requise";
            const quantityValue = Number(item.quantity);
            if (!Number.isFinite(quantityValue)) return "Quantité invalide";
            if (quantityValue <= 0) return "Quantité doit être positive";
            const availableStock = (stockInfos[item.product]?.stock || 0) + (item.originalQuantity || 0);
            if (quantityValue > availableStock) return `Stock insuffisant (max: ${availableStock})`;
            const priceValue = Number(item.price);
            if (!Number.isFinite(priceValue) || priceValue <= 0) return "Prix doit être positif";
            if (priceValue < (stockInfos[item.product]?.costPrice || 0)) {
                return `Prix trop bas (min: ${stockInfos[item.product]?.costPrice} CFA)`;
            }
            return null;
        });
        setErrors(newErrors);
        return newErrors.every(error => !error);
    };

    const handleProductChange = (index, productId) => {
        const newProducts = [...selectedProducts];
        const product = products.find(p => p._id === productId);
        newProducts[index] = {
            product: productId,
            quantity: newProducts[index]?.quantity ?? '',
            price: product?.price || newProducts[index].price || 0,
            originalQuantity: newProducts[index].originalQuantity || 0
        };
        setSelectedProducts(newProducts);
        const newSearchTerms = [...productSearchTerms];
        newSearchTerms[index] = '';
        setProductSearchTerms(newSearchTerms);
    };

    const handleQuantityChange = (index, quantity) => {
        const newProducts = [...selectedProducts];
        if (quantity === '') {
            newProducts[index].quantity = '';
        } else {
            const numQuantity = parseInt(quantity, 10);
            if (Number.isNaN(numQuantity)) {
                newProducts[index].quantity = '';
            } else {
                newProducts[index].quantity = Math.max(1, numQuantity);
            }
        }
        setSelectedProducts(newProducts);
    };

    const handlePriceChange = (index, price) => {
        const newProducts = [...selectedProducts];
        const numericPrice = Math.max(0, parseFloat(price) || 0);
        newProducts[index].price = numericPrice;
        setSelectedProducts(newProducts);
    };

    const addProduct = () => {
        setSelectedProducts([
            ...selectedProducts,
            { product: '', quantity: '', price: 0, originalQuantity: 0 }
        ]);
        setProductSearchTerms([...productSearchTerms, '']);
        setErrors([...errors, null]);
    };

    const removeProduct = (index) => {
        setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
        setProductSearchTerms(productSearchTerms.filter((_, i) => i !== index));
        setErrors(errors.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return selectedProducts.reduce((total, item) => {
            const quantity = Number(item.quantity);
            const price = Number(item.price);
            const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
            const safePrice = Number.isFinite(price) ? price : 0;
            return total + safeQuantity * safePrice;
        }, 0).toFixed(0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError('');
        if (!validateForm()) {
            setFormError('Corrigez les erreurs dans le formulaire');
            setIsSubmitting(false);
            return;
        }
        if (!modificationNote.trim()) {
            setFormError('Une note explicative est obligatoire pour les modifications');
            setIsSubmitting(false);
            return;
        }
        try {
            await onUpdate({
                products: selectedProducts.map(item => ({
                    product: item.product,
                    quantity: Number(item.quantity),
                    price: Number(item.price) || 0
                })),
                note: modificationNote.trim()
            });
        } catch (error) {
            setFormError(error.response?.data?.message || 'Erreur lors de la mise à jour de la vente');
            setIsSubmitting(false);
        }
    };

    const saleRef = sale?._id ? `#${sale._id.slice(-6).toUpperCase()}` : '';

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {formError && (
                <div
                    role="alert"
                    className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm"
                >
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{formError}</span>
                </div>
            )}

            {/* Summary card */}
            <section className="rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Vente {saleRef}
                    </h2>
                </div>
                <div className="p-4 md:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client</p>
                            <p className="mt-0.5 font-semibold text-gray-900">{sale.client?.name || '—'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date originale</p>
                            <p className="mt-0.5 text-gray-700">{new Date(sale.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Montant original</p>
                            <p className="mt-0.5 font-semibold text-gray-700">{Number(sale.totalAmount || 0).toLocaleString('fr-FR')} CFA</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nouveau total</p>
                            <p className="mt-0.5 font-semibold text-emerald-600">{Number(calculateTotal()).toLocaleString('fr-FR')} CFA</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type de vente</p>
                            <p className="mt-0.5 font-semibold text-gray-700">{getSaleTypeText(sale.saleType)}</p>
                            <p className="mt-1 text-xs text-gray-500">Non modifiable après création</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Modification reason */}
            <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/70">
                    <h3 className="text-sm font-semibold text-gray-700">Raison de la modification <span className="text-red-500">*</span></h3>
                </div>
                <div className="p-4 md:p-5">
                    <textarea
                        value={modificationNote}
                        onChange={(e) => setModificationNote(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-h-[120px] text-gray-900 placeholder-gray-400"
                        placeholder="Expliquez pourquoi vous modifiez cette vente (quantités, prix, produits…)"
                        required
                        aria-describedby="modification-note-hint"
                    />
                    <p id="modification-note-hint" className="mt-2 text-xs text-gray-500">Cette note sera enregistrée dans l’historique de la vente.</p>
                </div>
            </section>

            {/* Products */}
            <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/70 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-700">Lignes de produits</h3>
                    <button
                        type="button"
                        onClick={addProduct}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Ajouter un produit
                    </button>
                </div>
                <div className="p-4 md:p-5 space-y-4">
                    {selectedProducts.map((item, index) => {
                        const selectedProduct = products.find((p) => p._id === item.product);
                        return (
                            <div
                                key={index}
                                className={`rounded-xl border p-4 transition-colors ${errors[index] ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'}`}
                            >
                                <div className="flex flex-col gap-4">
                                    {/* Search filter - full width */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Filtrer la liste</label>
                                        <input
                                            type="text"
                                            placeholder="Nom ou conteneur..."
                                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                                            value={productSearchTerms[index] || ''}
                                            onChange={(e) => {
                                                const newTerms = [...productSearchTerms];
                                                newTerms[index] = e.target.value;
                                                setProductSearchTerms(newTerms);
                                            }}
                                            aria-label={`Filtrer les produits pour la ligne ${index + 1}`}
                                        />
                                    </div>

                                    {/* Row: product select, quantity, price, remove */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
                                        <div className="md:col-span-5">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Produit</label>
                                            <select
                                                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[index] ? 'border-red-500' : 'border-gray-300'}`}
                                                value={item.product}
                                                onChange={(e) => handleProductChange(index, e.target.value)}
                                                aria-invalid={!!errors[index]}
                                                aria-describedby={errors[index] ? `product-error-${index}` : undefined}
                                            >
                                                <option value="">Sélectionner un produit</option>
                                                {getFilteredProducts(productSearchTerms[index] || '').map(product => (
                                                    <option
                                                        key={product._id}
                                                        value={product._id}
                                                        className={product.stock < 1 ? 'text-red-600' : ''}
                                                    >
                                                        {product.name} — {product.container?.trim() || 'Non défini'} (Stock: {product.stock})
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedProduct && (
                                                <p className="mt-1.5 text-xs text-gray-500">Revient à {Number(selectedProduct.costPrice || 0).toLocaleString('fr-FR')} CFA</p>
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Quantité</label>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min="1"
                                                step="1"
                                                className={`w-full px-3 py-2.5 border rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[index] ? 'border-red-500' : 'border-gray-300'}`}
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                aria-invalid={!!errors[index]}
                                            />
                                        </div>

                                        <div className="md:col-span-3">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Prix unitaire (CFA)</label>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                value={item.price || ''}
                                                onChange={(e) => handlePriceChange(index, e.target.value)}
                                                placeholder="0"
                                                step="1"
                                                min={stockInfos[item.product]?.costPrice || 0}
                                            />
                                        </div>

                                        <div className="md:col-span-2 flex items-end">
                                            <button
                                                type="button"
                                                onClick={() => removeProduct(index)}
                                                className="w-full md:w-auto min-h-[44px] md:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
                                                aria-label={`Supprimer la ligne ${index + 1}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                <span className="md:hidden">Retirer</span>
                                            </button>
                                        </div>
                                    </div>

                                    {errors[index] && (
                                        <p id={`product-error-${index}`} className="text-sm text-red-600 flex items-center gap-2" role="alert">
                                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {errors[index]}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <FormActionsSticky>
                <button
                    type="button"
                    onClick={onCancel}
                    className="min-h-[44px] px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl font-semibold inline-flex items-center gap-2 transition-colors ${isSubmitting
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                    }`}
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Enregistrement…
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Enregistrer les modifications
                        </>
                    )}
                </button>
            </FormActionsSticky>
        </form>
    );
};

EditSaleForm.propTypes = {
    sale: PropTypes.object.isRequired,
    clients: PropTypes.array,
    onUpdate: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default EditSaleForm;
