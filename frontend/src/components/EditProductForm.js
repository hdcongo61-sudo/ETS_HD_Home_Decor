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
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        costPrice: '',
        stock: '',
        category: '',
        image: ''
    });
    const [profitMargin, setProfitMargin] = useState(0);
    const [validationErrors, setValidationErrors] = useState({});

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
                    image: response.data.image || ''
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

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
        
        // Clear validation error for this field
        if (validationErrors[name]) {
            setValidationErrors({
                ...validationErrors,
                [name]: ''
            });
        }
    };

    const validateForm = () => {
        const errors = {};
        
        if (!formData.name.trim()) errors.name = 'Le nom est requis';
        if (!formData.description.trim()) errors.description = 'La description est requise';
        if (!formData.price || parseFloat(formData.price) <= 0) errors.price = 'Le prix doit être supérieur à 0';
        if (formData.costPrice && parseFloat(formData.costPrice) < 0) errors.costPrice = 'Le prix de revient ne peut pas être négatif';
        if (!formData.stock || parseInt(formData.stock, 10) < 0) errors.stock = 'Le stock ne peut pas être négatif';
        if (!formData.category.trim()) errors.category = 'La catégorie est requise';
        
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        try {
            const productData = {
                name: formData.name.trim(),
                description: formData.description.trim(),
                price: parseFloat(formData.price),
                costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
                stock: parseInt(formData.stock, 10),
                category: formData.category.trim(),
                image: formData.image.trim() || null
            };

            await api.put(`/products/${id}`, productData);
            navigate('/products');
        } catch (error) {
            console.error('Error updating product:', error);
            
            if (error.response?.data?.errors) {
                // Handle server-side validation errors
                const serverErrors = {};
                error.response.data.errors.forEach(err => {
                    serverErrors[err.path] = err.msg;
                });
                setValidationErrors(serverErrors);
            } else {
                setError(error.response?.data?.message || 'Erreur lors de la mise à jour du produit');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error && !product) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                    {error}
                    <button
                        onClick={() => navigate('/products')}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retour à la liste
                    </button>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-8">
                <h2 className="text-xl font-semibold">Produit non trouvé</h2>
                <button
                    onClick={() => navigate('/products')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retour à la liste
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                    <button
                        onClick={() => navigate('/products')}
                        className="flex items-center text-blue-600 hover:text-blue-800"
                    >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="name">
                                    Nom du Produit
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded ${validationErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                                    required
                                />
                                {validationErrors.name && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="category">
                                    Catégorie
                                </label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded ${validationErrors.category ? 'border-red-500' : 'border-gray-300'}`}
                                    required
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
                                {validationErrors.category && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.category}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-700 font-medium mb-2" htmlFor="description">
                                Description
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className={`w-full p-2 border rounded ${validationErrors.description ? 'border-red-500' : 'border-gray-300'}`}
                                rows="4"
                                required
                            />
                            {validationErrors.description && (
                                <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="costPrice">
                                    Prix de Revient (CFA)
                                </label>
                                <input
                                    type="number"
                                    id="costPrice"
                                    name="costPrice"
                                    value={formData.costPrice}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded ${validationErrors.costPrice ? 'border-red-500' : 'border-gray-300'}`}
                                    min="0"
                                    step="0.01"
                                />
                                {validationErrors.costPrice && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.costPrice}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="price">
                                    Prix de Vente (CFA)
                                </label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded ${validationErrors.price ? 'border-red-500' : 'border-gray-300'}`}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                                {validationErrors.price && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.price}</p>
                                )}
                            </div>

                            <div className={`p-4 rounded-lg ${profitMargin > 0 ? 'bg-green-50' : profitMargin < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <label className="block text-sm font-medium mb-1">
                                    Marge Bénéficiaire
                                </label>
                                <div className={`text-xl font-bold ${profitMargin > 0 ? 'text-green-600' : profitMargin < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                    {profitMargin}%
                                </div>
                                {profitMargin < 0 && (
                                    <p className="text-xs text-red-500 mt-1">Prix inférieur au coût!</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="stock">
                                    Stock
                                </label>
                                <input
                                    type="number"
                                    id="stock"
                                    name="stock"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded ${validationErrors.stock ? 'border-red-500' : 'border-gray-300'}`}
                                    required
                                    min="0"
                                />
                                {validationErrors.stock && (
                                    <p className="text-red-500 text-sm mt-1">{validationErrors.stock}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-medium mb-2" htmlFor="image">
                                    URL de l'Image
                                </label>
                                <input
                                    type="text"
                                    id="image"
                                    name="image"
                                    value={formData.image}
                                    onChange={handleChange}
                                    className="w-full p-2 border border-gray-300 rounded"
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                        </div>

                        {product.image && (
                            <div className="flex justify-center">
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-40 object-contain border rounded-lg"
                                />
                            </div>
                        )}

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
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Enregistrer les modifications
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProductForm;
