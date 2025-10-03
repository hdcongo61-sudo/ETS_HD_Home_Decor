import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

const EditSaleForm = ({ sale, clients, onUpdate, onCancel }) => {
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [modificationNote, setModificationNote] = useState('');
    const [errors, setErrors] = useState([]);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockInfos, setStockInfos] = useState({});

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get('/products');
                setProducts(response.data);

                // Créer un objet pour un accès rapide aux infos stock
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

        // Pré-remplir avec les produits existants
        if (sale) {
            setSelectedProducts(sale.products.map(p => ({
                product: p.product._id,
                quantity: p.quantity,
                price: p.priceAtSale,
                originalQuantity: p.quantity // Garder trace de la quantité originale
            })));
        }
    }, [sale]);

    const validateForm = () => {
        const newErrors = selectedProducts.map((item, index) => {
            if (!item.product) return 'Sélectionnez un produit';

            const product = products.find(p => p._id === item.product);
            if (!product) return 'Produit invalide';

            // Validation quantité
            if (isNaN(item.quantity) || item.quantity <= 0) {
                return "Quantité doit être positive";
            }

            // Calcul du stock disponible (stock actuel + quantité originale)
            const availableStock = (stockInfos[item.product]?.stock || 0) + (item.originalQuantity || 0);

            if (item.quantity > availableStock) {
                return `Stock insuffisant (max: ${availableStock})`;
            }

            // Validation prix
            if (isNaN(item.price) || item.price <= 0) {
                return "Prix doit être positif";
            }

            if (item.price < (stockInfos[item.product]?.costPrice || 0)) {
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
            quantity: newProducts[index].quantity || 1,
            price: product?.price || newProducts[index].price || 0,
            originalQuantity: newProducts[index].originalQuantity || 0
        };

        setSelectedProducts(newProducts);
    };

    const handleQuantityChange = (index, quantity) => {
        const newProducts = [...selectedProducts];
        const numQuantity = parseInt(quantity, 10) || 1;
        newProducts[index].quantity = Math.max(1, numQuantity);
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
            { product: '', quantity: 1, price: 0, originalQuantity: 0 }
        ]);
    };

    const removeProduct = (index) => {
        setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return selectedProducts.reduce((total, item) => {
            return total + (item.quantity * (item.price || 0));
        }, 0).toFixed(0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!validateForm()) {
            setFormError('Corrigez les erreurs dans le formulaire');
            setIsSubmitting(false);
            return;
        }

        if (!modificationNote) {
            setFormError('Une note explicative est obligatoire pour les modifications');
            setIsSubmitting(false);
            return;
        }

        try {
            await onUpdate({
                products: selectedProducts.map(item => ({
                    product: item.product,
                    quantity: item.quantity,
                    price: item.price
                })),
                note: modificationNote
            });
        } catch (error) {
            setFormError(error.response?.data?.message || 'Erreur lors de la mise à jour de la vente');
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-6 border-b pb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modification de la vente #{sale._id.substring(18)}
                </h2>

                <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-start">
                        <span className="font-medium w-32">Client:</span>
                        <span className="font-semibold">{sale.client?.name || 'Aucun client'}</span>
                    </div>
                    <div className="flex items-start mt-2">
                        <span className="font-medium w-32">Date originale:</span>
                        <span>{new Date(sale.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-start mt-2">
                        <span className="font-medium w-32">Montant original:</span>
                        <span className="font-bold">{sale.totalAmount?.toFixed(0)} CFA</span>
                    </div>
                    <div className="flex items-start mt-2">
                        <span className="font-medium w-32">Nouveau montant:</span>
                        <span className="font-bold text-green-600">{calculateTotal()} CFA</span>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-gray-700 text-lg font-semibold mb-3">
                    Raison de la modification *
                </label>
                <textarea
                    value={modificationNote}
                    onChange={(e) => setModificationNote(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 min-h-[100px]"
                    placeholder="Expliquez pourquoi vous modifiez cette vente..."
                    required
                />
            </div>

            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-700">
                    Produits
                </h3>

                {selectedProducts.map((item, index) => (
                    <div key={index} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-600">Produit</label>
                                <select
                                    className={`w-full px-3 py-2 border rounded-lg ${errors[index] ? 'border-red-500' : 'border-gray-200'} focus:ring-2 focus:ring-blue-200`}
                                    value={item.product}
                                    onChange={(e) => handleProductChange(index, e.target.value)}
                                >
                                    <option value="">Sélectionner...</option>
                                    {products.map(product => (
                                        <option
                                            key={product._id}
                                            value={product._id}
                                            className={product.stock < 1 ? 'text-red-500' : ''}
                                        >
                                            {product.name}
                                            <span className="text-gray-500 ml-1">
                                                (Stock: {product.stock} | Revient: {product.costPrice} CFA)
                                            </span>
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-600">Quantité</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-200"
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-600">Prix unitaire</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-200 pr-8"
                                        value={item.price || ''}
                                        onChange={(e) => handlePriceChange(index, e.target.value)}
                                        placeholder="0.00"
                                        step="0.01"
                                        min={stockInfos[item.product]?.costPrice || 0}
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm">CFA</span>
                                </div>
                            </div>

                            <div className="flex items-end justify-end">
                                <button
                                    type="button"
                                    onClick={() => removeProduct(index)}
                                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {errors[index] && (
                            <div className="text-red-600 text-sm flex items-center gap-2 mt-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {errors[index]}
                            </div>
                        )}
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addProduct}
                    className="w-full md:w-auto px-4 py-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ajouter un produit
                </button>
            </div>

            <div className="flex justify-end gap-4 mt-8">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 ${isSubmitting
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        }`}
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            En cours...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Mettre à jour la vente
                        </>
                    )}
                </button>
            </div>

            {formError && (
                <div className="mt-4 text-red-600 text-center flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {formError}
                </div>
            )}
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