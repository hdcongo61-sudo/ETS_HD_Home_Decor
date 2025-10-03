import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import QRCode from 'react-qr-code';

const buildStatsSkeleton = (baseProduct = {}) => {
    const stock = Number(baseProduct.stock) || 0;
    const price = Number(baseProduct.price) || 0;

    return {
        salesThisPeriod: 0,
        ordersThisPeriod: 0,
        revenueThisPeriod: 0,
        profitThisPeriod: 0,
        avgSellingPrice: 0,
        avgProfitPerUnit: 0,
        avgCostPerUnit: 0,
        totalUnitsSold: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        lifetimeAvgSellingPrice: 0,
        lifetimeAvgProfitPerUnit: 0,
        stock: {
            currentStock: stock,
            stockValue: stock * price,
            coverageDays: null,
            sellThroughRate: 0
        },
        views: Number(baseProduct.viewsCount) || 0,
        conversionRate: Number(baseProduct.conversionRate) || 0,
        returns: Number(baseProduct.returnsCount) || 0,
        activities: Array.isArray(baseProduct.activities)
            ? baseProduct.activities
            : Array.isArray(baseProduct.recentActivities)
                ? baseProduct.recentActivities
                : []
    };
};

const mergeStatsWithProduct = (baseProduct = {}, statsFromApi = {}) => {
    const skeleton = buildStatsSkeleton(baseProduct);

    if (!statsFromApi || typeof statsFromApi !== 'object') {
        return skeleton;
    }

    return {
        ...skeleton,
        ...statsFromApi,
        stock: {
            ...skeleton.stock,
            ...(statsFromApi.stock || {})
        },
        activities: Array.isArray(statsFromApi.activities)
            ? statsFromApi.activities
            : skeleton.activities
    };
};

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [stats, setStats] = useState(() => buildStatsSkeleton());
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [showQRCode, setShowQRCode] = useState(false);
    const [shareOptions, setShareOptions] = useState(false);
    const [statsRange, setStatsRange] = useState('month');
    const qrCodeRef = useRef();

    const toNumber = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    };

    const formatNumber = (value) => toNumber(value).toLocaleString('fr-FR');

    const formatDecimal = (value, digits = 2) => {
        const numeric = toNumber(value);
        return numeric.toLocaleString('fr-FR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    };

    const formatCurrency = (value) => {
        const numeric = toNumber(value);
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
            maximumFractionDigits: 0
        }).format(numeric);
    };

    const getRangeLabel = () => {
        switch (statsRange) {
            case 'day':
                return "aujourd'hui";
            case 'week':
                return 'cette semaine';
            case 'year':
                return 'cette année';
            default:
                return 'ce mois';
        }
    };

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/products/${id}`);
                setProduct(response.data);
                setError('');
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
        if (product) {
            setStats((prev) => mergeStatsWithProduct(product, prev));
        }
    }, [product]);

    useEffect(() => {
        const fetchProductStats = async () => {
            if (!product) return;
            
            try {
                setStatsLoading(true);
                const response = await api.get(`/products/${id}/stats?range=${statsRange}`);
                setStats(mergeStatsWithProduct(product, response.data));
            } catch (err) {
                console.error('Error fetching product stats:', err);
                // Fallback to basic stats if the endpoint doesn't exist
                setStats(buildStatsSkeleton(product));
            } finally {
                setStatsLoading(false);
            }
        };

        fetchProductStats();
    }, [id, product, statsRange]);

    const handleDelete = async () => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
            try {
                await api.delete(`/products/${id}`);
                navigate('/products');
            } catch (err) {
                console.error('Error deleting product:', err);
                setError('Erreur lors de la suppression');
            }
        }
    };

    const downloadQRCode = () => {
        const svg = qrCodeRef.current;
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `qrcode-${product.name.replace(/\s+/g, '-').toLowerCase()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const shareProduct = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: product.name,
                    text: product.description,
                    url: window.location.href,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Lien copié dans le presse-papier');
            });
        }
        setShareOptions(false);
    };

    const getActivityIcon = (type) => {
        switch (type) {
            case 'stock_update':
                return (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                );
            case 'price_update':
                return (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case 'sale':
                return (
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                );
            case 'return':
                return (
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                    </svg>
                );
            case 'view':
                return (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                );
            case 'creation':
                return (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    const getActivityColor = (type) => {
        switch (type) {
            case 'stock_update': return 'bg-blue-100';
            case 'price_update': return 'bg-green-100';
            case 'sale': return 'bg-purple-100';
            case 'return': return 'bg-red-100';
            case 'view': return 'bg-gray-100';
            case 'creation': return 'bg-green-100';
            default: return 'bg-gray-100';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-400"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4 mx-4">
                {error}
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-8 px-4">
                <h2 className="text-xl font-semibold text-gray-800">Produit non trouvé</h2>
                <button
                    onClick={() => navigate('/products')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    Retour à la liste
                </button>
            </div>
        );
    }

    // Calculer la marge bénéficiaire si costPrice est disponible
    const profitMargin = product.costPrice
        ? ((product.price - product.costPrice) / product.costPrice * 100).toFixed(2)
        : null;

    // Calculer le bénéfice absolu
    const absoluteProfit = product.costPrice
        ? (product.price - product.costPrice).toFixed(0)
        : null;

    // Generate product URL for QR code
    const productUrl = `${window.location.origin}/products/${product._id}`;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header with navigation and actions */}
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={() => navigate('/products')}
                        className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour
                    </button>
                    
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setShareOptions(!shareOptions)}
                            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                            title="Partager"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={() => setShowQRCode(true)}
                            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                            title="QR Code"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0v1m-6-2v1m2 3h8M9 6h6m-6 4h6m-2 8v-4m0 0l3-3m-3 3l-3-3" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={() => navigate(`/products/edit/${product._id}`)}
                            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                            title="Modifier"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={handleDelete}
                            className="p-2 rounded-full hover:bg-red-100 text-red-600 transition-colors"
                            title="Supprimer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Share options dropdown */}
                {shareOptions && (
                    <div className="absolute right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                        <button
                            onClick={shareProduct}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                            Partager le produit
                        </button>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                setShareOptions(false);
                            }}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                        >
                            Copier le lien
                        </button>
                    </div>
                )}

                {/* Main content */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* Product header with image and basic info */}
                    <div className="p-6 flex flex-col md:flex-row">
                        <div className="md:w-2/5 flex justify-center items-start">
                            {product.image ? (
                                <div className="relative">
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full max-w-md rounded-xl object-cover shadow-sm"
                                    />
                                    {absoluteProfit > 0 && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                            +{profitMargin}%
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-gray-100 border border-dashed border-gray-300 rounded-xl w-full h-64 flex items-center justify-center text-gray-400">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        <div className="md:w-3/5 md:pl-8 mt-6 md:mt-0">
                            <div className="mb-4">
                                <h1 className="text-3xl font-semibold text-gray-900">{product.name}</h1>
                                <div className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-medium text-gray-700 mt-2">
                                    {product.category}
                                </div>
                            </div>

                            <p className="text-gray-600 mb-6">{product.description}</p>

                            <div className="flex items-center mb-6">
                                <div className="text-2xl font-semibold text-gray-900">{product.price.toFixed(0)} CFA</div>
                                {product.costPrice && (
                                    <div className="ml-4 text-sm text-gray-500">
                                        Coût: {product.costPrice.toFixed(0)} CFA
                                    </div>
                                )}
                            </div>

                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${product.stock < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {product.stock < 10 ? (
                                    <>
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Stock faible: {product.stock} unités
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        En stock: {product.stock} unités
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tab navigation */}
                    <div className="border-t border-gray-200">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'overview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                Aperçu
                            </button>
                            <button
                                onClick={() => setActiveTab('financial')}
                                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'financial' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                Analyse financière
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                Historique
                            </button>
                        </nav>
                    </div>

                    {/* Tab content */}
                    <div className="p-6">
                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-5 rounded-xl">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Détails du produit</h3>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Catégorie</dt>
                                            <dd className="text-sm text-gray-900">{product.category}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">SKU</dt>
                                            <dd className="text-sm text-gray-900 font-mono">{product.sku || product._id.substring(18, 24).toUpperCase()}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Statut</dt>
                                            <dd className="text-sm">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {product.stock > 0 ? 'Disponible' : 'Rupture de stock'}
                                                </span>
                                            </dd>
                                        </div>
                                        {product.costPrice && (
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500">Prix de revient</dt>
                                                <dd className="text-sm text-gray-900">{product.costPrice.toFixed(0)} CFA</dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>

                                <div className="bg-gray-50 p-5 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-semibold text-gray-800">Statistiques</h3>
                                        <select 
                                            value={statsRange}
                                            onChange={(e) => setStatsRange(e.target.value)}
                                            className="text-xs border border-gray-300 rounded-md px-2 py-1"
                                        >
                                            <option value="day">Aujourd'hui</option>
                                            <option value="week">Cette semaine</option>
                                            <option value="month">Ce mois</option>
                                            <option value="year">Cette année</option>
                                        </select>
                                    </div>
                                    {statsLoading ? (
                                        <div className="flex justify-center items-center h-32">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500">Unités vendues {getRangeLabel()}</p>
                                                    <p className="text-lg font-semibold text-gray-900">{formatNumber(stats.salesThisPeriod)}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500">Commandes {getRangeLabel()}</p>
                                                    <p className="text-lg font-semibold text-gray-900">{formatNumber(stats.ordersThisPeriod)}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500">Chiffre d'affaires</p>
                                                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.revenueThisPeriod)}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500">Bénéfice estimé</p>
                                                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(stats.profitThisPeriod)}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 mt-4">
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500 mb-1">Prix moyens</p>
                                                    <div className="flex justify-between text-xs text-gray-600">
                                                        <span>Prix de vente</span>
                                                        <span>{`${formatDecimal(stats.avgSellingPrice, 0)} CFA`}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                                                        <span>Coût</span>
                                                        <span>{`${formatDecimal(stats.avgCostPerUnit, 0)} CFA`}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                                                        <span>Bénéfice unitaire</span>
                                                        <span>{`${formatDecimal(stats.avgProfitPerUnit, 0)} CFA`}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500 mb-1">Couverture de stock</p>
                                                    <p className="text-lg font-semibold text-gray-900">
                                                        {stats.stock?.coverageDays ? `${formatDecimal(stats.stock.coverageDays, 1)} jours` : 'Non estimé'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">Taux d'écoulement: {formatDecimal(stats.stock?.sellThroughRate ?? 0)}%</p>
                                                </div>

                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <p className="text-xs text-gray-500 mb-1">Historique</p>
                                                    <div className="flex justify-between text-sm text-gray-700">
                                                        <span>{formatNumber(stats.totalUnitsSold)} unités</span>
                                                        <span>{formatCurrency(stats.totalRevenue)}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">Profit cumulé: {formatCurrency(stats.totalProfit)}</p>
                                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                                        <span>Vues</span>
                                                        <span>{formatNumber(stats.views)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                        <span>Conversion</span>
                                                        <span>{`${formatDecimal(stats.conversionRate)}%`}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'financial' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-600 mb-1">Prix de revient</h3>
                                        <p className="text-2xl font-semibold text-gray-800">
                                            {product.costPrice ? `${product.costPrice.toFixed(0)} CFA` : 'Non spécifié'}
                                        </p>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-600 mb-1">Prix de vente</h3>
                                        <p className="text-2xl font-semibold text-blue-600">
                                            {product.price.toFixed(0)} CFA
                                        </p>
                                    </div>

                                    {profitMargin && (
                                        <div className={`p-4 rounded-xl border ${profitMargin > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                            <h3 className="text-sm font-medium text-gray-600 mb-1">
                                                {profitMargin > 0 ? 'Bénéfice' : 'Perte'} par unité
                                            </h3>
                                            <p className={`text-2xl font-semibold ${profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {absoluteProfit > 0 ? '+' : ''}{absoluteProfit} CFA
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {profitMargin && (
                                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-sm font-medium text-gray-600">Marge bénéficiaire</h3>
                                            <span className={`text-lg font-semibold ${profitMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {profitMargin}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full ${profitMargin > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {product.costPrice && product.stock > 0 && absoluteProfit > 0 && (
                                    <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                                        <h3 className="text-lg font-semibold text-indigo-800 mb-3">Rentabilité du stock</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-white p-4 rounded-lg border border-indigo-100">
                                                <p className="text-sm text-gray-600">Bénéfice total potentiel</p>
                                                <p className="text-xl font-semibold text-indigo-600">
                                                    {(absoluteProfit * product.stock).toFixed(0)} CFA
                                                </p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg border border-indigo-100">
                                                <p className="text-sm text-gray-600">Valeur du stock</p>
                                                <p className="text-xl font-semibold text-indigo-600">
                                                    {(product.price * product.stock).toFixed(0)} CFA
                                                </p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg border border-indigo-100">
                                                <p className="text-sm text-gray-600">Coût total du stock</p>
                                                <p className="text-xl font-semibold text-indigo-600">
                                                    {(product.costPrice * product.stock).toFixed(0)} CFA
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Dates importantes</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Créé le:</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {new Date(product.createdAt).toLocaleDateString()} à{' '}
                                                {new Date(product.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Dernière modification:</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {new Date(product.updatedAt).toLocaleDateString()} à{' '}
                                                {new Date(product.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Activité récente</h3>
                                    {statsLoading ? (
                                        <div className="flex justify-center items-center h-32">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {stats.activities && stats.activities.length > 0 ? (
                                                stats.activities.map((activity, index) => (
                                                    <div key={index} className="flex items-start">
                                                        <div className="flex-shrink-0">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                                                                {getActivityIcon(activity.type)}
                                                            </div>
                                                        </div>
                                                        <div className="ml-3">
                                                            <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                                                            {activity.oldValue !== undefined && activity.newValue !== undefined && (
                                                                <p className="text-sm text-gray-500">
                                                                    De {activity.oldValue} à {activity.newValue}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-400">
                                                                {new Date(activity.timestamp).toLocaleDateString()} à{' '}
                                                                {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500">Aucune activité récente</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* QR Code Modal */}
            {showQRCode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">QR Code du produit</h3>
                            <button
                                onClick={() => setShowQRCode(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="flex justify-center my-4">
                            <div ref={qrCodeRef} className="p-4 bg-white">
                                <QRCode value={productUrl} size={200} />
                            </div>
                        </div>
                        
                        <p className="text-sm text-gray-500 text-center mb-4">
                            Scannez ce code pour accéder directement à ce produit
                        </p>
                        
                        <div className="flex justify-center space-x-3">
                            <button
                                onClick={downloadQRCode}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Télécharger
                            </button>
                            <button
                                onClick={() => setShowQRCode(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetails;
