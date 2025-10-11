import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import useResponsiveTable from '../hooks/useResponsiveTable';

const ProductDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('month');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await api.get(`/products/dashboard?range=${timeRange}`);
                setDashboardData(response.data);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                setError('Erreur lors du chargement des données du tableau de bord');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [timeRange]);

    // Préparer les données pour les graphiques
    const CATEGORY_ORDER = ['Meuble', 'Decoration', 'Recouvrement', 'Electro-menager'];
    const CATEGORY_COLORS = {
        Meuble: '#007AFF',
        Decoration: '#34C759',
        Recouvrement: '#FF9500',
        'Electro-menager': '#FF2D55',
        Autre: '#AF52DE'
    };

    const STOCK_LEVEL_COLORS = ['#FF3B30', '#FF9500', '#34C759'];
    const normalizeCategory = (rawCategory) => {
        if (!rawCategory || typeof rawCategory !== 'string') return 'autre';
        return rawCategory.normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z-]/g, '');
    };

    const resolveCategory = (rawCategory) => {
        const cleaned = normalizeCategory(rawCategory);

        if (cleaned === 'meuble') return 'Meuble';
        if (cleaned === 'decoration' || cleaned === 'decor') return 'Decoration';
        if (cleaned === 'recouvrement') return 'Recouvrement';
        if (['electro-menager', 'electromenager', 'electromenage'].includes(cleaned)) {
            return 'Electro-menager';
        }

        return 'Autre';
    };

    // Données pour le graphique des niveaux de stock
    const stockLevelData = [
        { name: 'Stock Critique', value: dashboardData?.lowStockCount ?? 0 },
        { name: 'Stock Moyen', value: dashboardData?.mediumStockCount ?? 0 },
        { name: 'Stock Suffisant', value: dashboardData?.goodStockCount ?? 0 }
    ];

    const categoryDistributionMap = (dashboardData?.categoryDistribution || []).reduce((acc, entry) => {
        const label = resolveCategory(entry.category);
        if (!acc[label]) {
            acc[label] = { category: label, count: 0 };
        }
        acc[label].count += entry.count || 0;
        return acc;
    }, {});

    const categoryDistribution = CATEGORY_ORDER
        .filter((label) => categoryDistributionMap[label])
        .map((label) => categoryDistributionMap[label]);

    if (categoryDistributionMap.Autre) {
        categoryDistribution.push(categoryDistributionMap.Autre);
    }

    // Données pour les produits à stock zéro
    const outOfStockProducts = dashboardData?.outOfStockProducts || [];

    // Données pour les produits avec stock à 1
    const criticalStockProducts = dashboardData?.criticalStockProducts || [];

    // Données pour les produits les plus chers
    const mostExpensiveProducts = dashboardData?.mostExpensiveProducts || [];

    // Données pour les produits les plus vendus
    const topSellingProducts = dashboardData?.topSellingProducts || [];

    // Données pour les produits jamais vendus
    const neverSoldProducts = dashboardData?.neverSoldProducts || [];

    const neverSoldTableRef = useRef(null);
    const outOfStockTableRef = useRef(null);
    const criticalStockTableRef = useRef(null);
    const lowStockTableRef = useRef(null);

    useResponsiveTable(neverSoldTableRef, [neverSoldProducts]);
    useResponsiveTable(outOfStockTableRef, [outOfStockProducts]);
    useResponsiveTable(criticalStockTableRef, [criticalStockProducts]);
    useResponsiveTable(lowStockTableRef, [dashboardData?.lowStockProducts || []]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
                {error}
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="text-center py-8">
                <h2 className="text-xl font-semibold">Aucune donnée disponible</h2>
                <p className="text-gray-600">Le tableau de bord des produits est vide</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                <h2 className="text-2xl font-semibold mb-4 md:mb-0">Tableau de Bord des Produits</h2>
                <div className="flex space-x-2">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm"
                    >
                        <option value="day">Aujourd'hui</option>
                        <option value="week">Cette semaine</option>
                        <option value="month">Ce mois</option>
                        <option value="year">Cette année</option>
                    </select>
                </div>
            </div>

            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <StatCard
                    title="Produits Totaux"
                    value={dashboardData.totalProducts}
                    icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    color="blue"
                />

                <StatCard
                    title="Valeur du Stock"
                    value={`${dashboardData.totalStockValue?.toLocaleString() || '0'} CFA`}
                    icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    color="green"
                />

                <StatCard
                    title="Stock Critique"
                    value={dashboardData.lowStockCount}
                    icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    color="yellow"
                />

                <StatCard
                    title="Jamais Vendus"
                    value={neverSoldProducts.length}
                    icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    color="purple"
                />
            </div>

            {/* Graphiques et visualisations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Répartition par catégorie */}
                <ChartCard title="Répartition par Catégorie">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={categoryDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                                nameKey="category"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                                {categoryDistribution.map((entry, index) => (
                                    <Cell
                                        key={`cell-${entry.category}-${index}`}
                                        fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Autre}
                                    />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} produits`, 'Quantité']} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Niveaux de stock */}
                <ChartCard title="Niveaux de Stock">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={stockLevelData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                                {stockLevelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STOCK_LEVEL_COLORS[index % STOCK_LEVEL_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Meilleures ventes */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
                <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-semibold">Produits les Plus Vendus</h2>
                        <p className="text-sm text-gray-500">Classement basé sur les quantités vendues pour la période sélectionnée</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{topSellingProducts.length} produit(s) en tête</span>
                    </div>
                </div>

                {topSellingProducts.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topSellingProducts} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip formatter={(value) => [`${value}`, 'Quantité vendue']} />
                                    <Legend />
                                    <Bar dataKey="sold" name="Quantité" fill="#FF9500" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="space-y-3">
                            {topSellingProducts.map((product, index) => (
                                <div key={product.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold">
                                            #{index + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{product.name}</p>
                                            <p className="text-xs text-gray-500">{product.sold} unité(s) vendue(s)</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <p className="text-gray-500">Aucune donnée de vente pour cette période</p>
                    </div>
                )}
            </div>

            {/* Nouveaux graphiques pour les données ajoutées */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top produits par marge */}
                <ChartCard title="Top Produits par Marge">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={dashboardData.topMarginProducts}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip
                                formatter={(value) => [`${value}%`, 'Marge']}
                                labelFormatter={(value) => `Produit: ${value}`}
                            />
                            <Legend />
                            <Bar
                                dataKey="margin"
                                name="Marge bénéficiaire"
                                fill="#007AFF"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Produits les plus chers */}
                <ChartCard title="Produits les Plus Chers">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={mostExpensiveProducts}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip
                                formatter={(value) => [`${value.toLocaleString()} CFA`, 'Prix']}
                                labelFormatter={(value) => `Produit: ${value}`}
                            />
                            <Legend />
                            <Bar
                                dataKey="price"
                                name="Prix"
                                fill="#34C759"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Produits jamais vendus - NOUVELLE SECTION */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <h2 className="text-xl font-semibold mb-2 md:mb-0">Produits Jamais Vendus</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                            {neverSoldProducts.length} produit(s) sans vente
                        </span>
                        <button
                            onClick={() => navigate('/products')}
                            className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                        >
                            Voir tous les produits
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {neverSoldProducts.length > 0 ? (
                    <div className="overflow-visible md:overflow-x-auto">
                        <table ref={neverSoldTableRef} className="min-w-full divide-y divide-gray-200 responsive-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {neverSoldProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {product.image ? (
                                                    <img
                                                        className="h-10 w-10 rounded-lg object-cover mr-3"
                                                        src={product.image}
                                                        alt={product.name}
                                                    />
                                                ) : (
                                                    <div className="bg-gray-100 rounded-lg w-10 h-10 mr-3 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {resolveCategory(product.category)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {product.price?.toLocaleString()} CFA
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className={`text-sm font-medium ${
                                                    product.stock === 0 ? 'text-red-600' : 
                                                    product.stock < 5 ? 'text-yellow-600' : 'text-green-600'
                                                }`}>
                                                    {product.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                                Jamais vendu
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => navigate(`/products/${product._id}`)}
                                                className="text-blue-600 hover:text-blue-900 font-medium mr-3"
                                            >
                                                Voir
                                            </button>
                                            <button
                                                onClick={() => navigate(`/products/edit/${product._id}`)}
                                                className="text-green-600 hover:text-green-900 font-medium"
                                            >
                                                Modifier
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <div className="flex flex-col items-center">
                            <svg className="w-12 h-12 text-green-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-gray-600">Tous les produits ont été vendus au moins une fois</p>
                            <p className="text-sm text-gray-500 mt-1">Excellent travail !</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Produits en rupture de stock */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <h2 className="text-xl font-semibold mb-2 md:mb-0">Produits en Rupture de Stock</h2>
                    <button
                        onClick={() => navigate('/products')}
                        className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                    >
                        Voir tous les produits
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {outOfStockProducts.length > 0 ? (
                    <div className="overflow-visible md:overflow-x-auto">
                        <table ref={outOfStockTableRef} className="min-w-full divide-y divide-gray-200 responsive-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {outOfStockProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {product.image ? (
                                                    <img
                                                        className="h-10 w-10 rounded-lg object-cover mr-3"
                                                        src={product.image}
                                                        alt={product.name}
                                                    />
                                                ) : (
                                                    <div className="bg-gray-100 rounded-lg w-10 h-10 mr-3 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {resolveCategory(product.category)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {product.price?.toLocaleString()} CFA
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Rupture
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => navigate(`/products/edit/${product._id}`)}
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                            >
                                                Réapprovisionner
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Aucun produit en rupture de stock</p>
                    </div>
                )}
            </div>

            {/* Produits à stock critique (stock = 1) */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <h2 className="text-xl font-semibold mb-2 md:mb-0">Produits à Stock Très Critique (1 unité)</h2>
                    <p className="text-sm text-red-500 font-medium">{criticalStockProducts.length} produit(s) en rupture</p>
                    <button
                        onClick={() => navigate('/products')}
                        className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                    >
                        Voir tous les produits
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {criticalStockProducts.length > 0 ? (
                    <div className="overflow-visible md:overflow-x-auto">
                        <table ref={criticalStockTableRef} className="min-w-full divide-y divide-gray-200 responsive-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {criticalStockProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {product.image ? (
                                                    <img
                                                        className="h-10 w-10 rounded-lg object-cover mr-3"
                                                        src={product.image}
                                                        alt={product.name}
                                                    />
                                                ) : (
                                                    <div className="bg-gray-100 rounded-lg w-10 h-10 mr-3 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {resolveCategory(product.category)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="text-sm font-medium text-red-600">
                                                    {product.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                Très critique
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => navigate(`/products/edit/${product._id}`)}
                                                className="text-blue-600 hover:text-blue-900 font-medium"
                                            >
                                                Réapprovisionner
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Aucun produit avec un stock de 1 unité</p>
                    </div>
                )}
            </div>

            {/* Produits à faible stock */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <h2 className="text-xl font-semibold mb-2 md:mb-0">Produits à Stock Critique</h2>
                    <button
                        onClick={() => navigate('/products')}
                        className="text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                    >
                        Voir tous les produits
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {dashboardData.lowStockProducts?.length > 0 ? (
                    <div className="overflow-visible md:overflow-x-auto">
                        <table ref={lowStockTableRef} className="min-w-full divide-y divide-gray-200 responsive-table">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niveau</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dashboardData.lowStockProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {product.image ? (
                                                    <img
                                                        className="h-10 w-10 rounded-lg object-cover mr-3"
                                                        src={product.image}
                                                        alt={product.name}
                                                    />
                                                ) : (
                                                    <div className="bg-gray-100 rounded-lg w-10 h-10 mr-3 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {resolveCategory(product.category)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className={`text-sm font-medium ${product.stock < 5 ? 'text-red-600' : 'text-yellow-600'
                                                    }`}>
                                                    {product.stock}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.stock < 3
                                                ? 'bg-red-100 text-red-800'
                                                : product.stock < 10
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                {product.stock < 3 ? 'Très critique' : product.stock < 10 ? 'Critique' : 'Faible'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => navigate(`/products/${product._id}`)}
                                                className="text-blue-600 hover:text-blue-900 mr-3 font-medium"
                                            >
                                                Voir
                                            </button>
                                            <button
                                                onClick={() => navigate(`/products/edit/${product._id}`)}
                                                className="text-green-600 hover:text-green-900 font-medium"
                                            >
                                                Réapprovisionner
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Aucun produit en stock critique</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Composant de carte statistique réutilisable
const StatCard = ({ title, value, icon, color = 'blue' }) => {
    const colorClasses = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-600' },
        green: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-600' },
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-600' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600' },
        red: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-600' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`rounded-lg p-4 border-l-4 ${colors.border} ${colors.bg}`}>
            <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
            <div className="flex justify-between items-end">
                <p className="text-2xl font-bold">{value}</p>
                <div className={`p-2 rounded-full ${colors.bg.replace('50', '100')}`}>
                    <svg className={`w-6 h-6 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                </div>
            </div>
        </div>
    );
};

// Composant de carte de graphique réutilisable
const ChartCard = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-md p-6 h-full">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        {children}
    </div>
);

export default ProductDashboard;
