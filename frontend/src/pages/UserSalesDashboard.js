import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

// Fonction utilitaire pour formater les montants en CFA
const formatCFA = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        currencyDisplay: 'code'
    }).format(amount).replace('XOF', 'CFA');
};

const UserSalesDashboard = () => {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [timeFilter, setTimeFilter] = useState('month');
    const { auth } = useContext(AuthContext);

    // Calculer les statistiques
    const calculateStats = () => {
        const stats = {
            totalSales: sales.length,
            totalAmount: 0,
            totalProfit: 0,
            totalPaid: 0,
            pendingSales: 0,
            completedSales: 0,
            cancelledSales: 0,
            topProducts: {},
            paymentMethods: {},
            salesByDay: {},
            salesByMonth: {},
            salesByYear: {}
        };

        sales.forEach(sale => {
            // Convertir en nombres et sécuriser contre les valeurs manquantes
            const totalAmount = Number(sale.totalAmount) || 0;
            stats.totalAmount += totalAmount;

            // Calculer le total encaissé pour cette vente
            let salePaid = 0;
            sale.payments.forEach(payment => {
                const amount = Number(payment.amount) || 0;
                salePaid += amount;
            });
            stats.totalPaid += salePaid;

            // Calculer le profit pour cette vente
            let saleProfit = 0;
            sale.products.forEach(item => {
                const costPrice = Number(item.product?.costPrice) || 0;
                const priceAtSale = Number(item.priceAtSale) || 0;
                const quantity = Number(item.quantity) || 0;

                // Calcul du profit pour ce produit
                const profitPerItem = priceAtSale - costPrice;
                saleProfit += profitPerItem * quantity;
            });
            stats.totalProfit += saleProfit;

            // Compter par statut
            if (sale.status === 'pending') stats.pendingSales++;
            if (sale.status === 'completed') stats.completedSales++;
            if (sale.status === 'cancelled') stats.cancelledSales++;

            // Compter par méthode de paiement
            sale.payments.forEach(payment => {
                const method = payment.method || 'unknown';
                const amount = Number(payment.amount) || 0;

                if (!stats.paymentMethods[method]) {
                    stats.paymentMethods[method] = 0;
                }

                stats.paymentMethods[method] += amount;
            });

            // Top produits
            sale.products.forEach(item => {
                const productId = item.product?._id || 'unknown';
                const productName = item.product?.name || 'Produit inconnu';

                if (!stats.topProducts[productId]) {
                    stats.topProducts[productId] = {
                        name: productName,
                        quantity: 0,
                        totalSales: 0,
                        profit: 0
                    };
                }

                // Sécuriser les valeurs numériques
                const costPrice = Number(item.product?.costPrice) || 0;
                const priceAtSale = Number(item.priceAtSale) || 0;
                const quantity = Number(item.quantity) || 0;

                // Calcul du profit pour ce produit
                const profitPerItem = priceAtSale - costPrice;
                const productProfit = profitPerItem * quantity;

                stats.topProducts[productId].quantity += quantity;
                stats.topProducts[productId].totalSales += priceAtSale * quantity;
                stats.topProducts[productId].profit += productProfit;
            });

            // Ventes par jour/mois/année
            const saleDate = new Date(sale.saleDate);
            const dayKey = saleDate.toISOString().split('T')[0];
            const monthKey = saleDate.getFullYear() + '-' + (saleDate.getMonth() + 1).toString().padStart(2, '0');
            const yearKey = saleDate.getFullYear().toString();

            if (!stats.salesByDay[dayKey]) stats.salesByDay[dayKey] = 0;
            if (!stats.salesByMonth[monthKey]) stats.salesByMonth[monthKey] = 0;
            if (!stats.salesByYear[yearKey]) stats.salesByYear[yearKey] = 0;

            stats.salesByDay[dayKey] += totalAmount;
            stats.salesByMonth[monthKey] += totalAmount;
            stats.salesByYear[yearKey] += totalAmount;
        });

        // Trier les produits les plus vendus
        stats.topProducts = Object.values(stats.topProducts)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        return stats;
    };

    const stats = sales.length > 0 ? calculateStats() : null;

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const salesResponse = await api.get(`/sales/user/${userId}`);
                const { user, sales } = salesResponse.data;

                setUser(user);
                setSales(sales);
                setLoading(false);
            } catch (err) {
                setError('Échec du chargement des données');
                setLoading(false);
            }
        };

        if (auth.isAdmin || auth.user._id === userId) {
            fetchData();
        }
    }, [userId, auth]);

    // Données pour le graphique des ventes
    const getSalesChartData = () => {
        if (!stats) return null;

        let labels = [];
        let data = [];
        let backgroundColors = [];

        switch (timeFilter) {
            case 'day':
                labels = Object.keys(stats.salesByDay).map(date =>
                    format(new Date(date), 'dd MMM', { locale: fr })
                );
                data = Object.values(stats.salesByDay);
                backgroundColors = Array(labels.length).fill('rgba(54, 162, 235, 0.5)');
                break;

            case 'month':
                labels = Object.keys(stats.salesByMonth).map(month =>
                    format(new Date(`${month}-01`), 'MMM yyyy', { locale: fr })
                );
                data = Object.values(stats.salesByMonth);
                backgroundColors = Array(labels.length).fill('rgba(75, 192, 192, 0.5)');
                break;

            case 'year':
                labels = Object.keys(stats.salesByYear);
                data = Object.values(stats.salesByYear);
                backgroundColors = Array(labels.length).fill('rgba(153, 102, 255, 0.5)');
                break;

            default:
                break;
        }

        return {
            labels,
            datasets: [
                {
                    label: `Chiffre d'affaires (${timeFilter === 'day' ? 'par jour' : timeFilter === 'month' ? 'par mois' : 'par an'})`,
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.5', '1')),
                    borderWidth: 1,
                }
            ]
        };
    };

    const salesChartData = getSalesChartData();

    // Données pour le graphique des méthodes de paiement
    const paymentChartData = stats ? {
        labels: Object.keys(stats.paymentMethods),
        datasets: [
            {
                data: Object.values(stats.paymentMethods),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(255, 99, 132, 0.5)',
                ].slice(0, Object.keys(stats.paymentMethods).length),
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(255, 99, 132, 1)',
                ].slice(0, Object.keys(stats.paymentMethods).length),
                borderWidth: 1,
            }
        ]
    } : null;

    // Données pour le graphique des statuts de vente
    const statusChartData = stats ? {
        labels: ['Complétées', 'En attente', 'Annulées'],
        datasets: [
            {
                data: [
                    stats.completedSales,
                    stats.pendingSales,
                    stats.cancelledSales
                ],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(255, 99, 132, 0.5)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1,
            }
        ]
    } : null;

    if (!auth.isAdmin && auth.user._id !== userId) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
                <div className="text-center py-12">
                    <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
                        <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Accès non autorisé</h2>
                    <p className="text-gray-600 mb-6">Vous n'avez pas les permissions nécessaires pour accéder à cette page</p>
                    <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
                <div className="text-center py-12 text-red-500">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Utilisateur introuvable</h2>
                    <Link to="/users/stats" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Retour à la liste des utilisateurs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Tableau de bord des ventes
                </h1>

                <div className="flex items-center gap-2">
                    <Link to={`/users/stats`} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                        Retour aux utilisateurs
                    </Link>
                </div>
            </div>

            {/* Entête utilisateur */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{user.name}</h2>
                        <p className="text-gray-600">{user.email}</p>
                        <p className="text-sm text-gray-500">
                            {user.isAdmin ? 'Administrateur' : 'Utilisateur'} • Inscrit le {format(new Date(user.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-md border border-blue-100">
                    <div className="flex items-center">
                        <div className="p-3 bg-blue-100 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ventes totales</p>
                            <p className="text-2xl font-bold">{stats ? stats.totalSales : 0}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-green-100">
                    <div className="flex items-center">
                        <div className="p-3 bg-green-100 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Chiffre d'affaires</p>
                            <p className="text-2xl font-bold">
                                {stats ? formatCFA(stats.totalAmount) : formatCFA(0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-purple-100">
                    <div className="flex items-center">
                        <div className="p-3 bg-purple-100 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Bénéfice total</p>
                            <p className="text-2xl font-bold">
                                {stats ? formatCFA(stats.totalProfit) : formatCFA(0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md border border-yellow-100">
                    <div className="flex items-center">
                        <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total encaissé</p>
                            <p className="text-2xl font-bold">
                                {stats ? formatCFA(stats.totalPaid) : formatCFA(0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Graphique des ventes */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Évolution des ventes</h3>
                        <div className="flex gap-2">
                            <button
                                className={`px-3 py-1 rounded ${timeFilter === 'day' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
                                onClick={() => setTimeFilter('day')}
                            >
                                Jour
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${timeFilter === 'month' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
                                onClick={() => setTimeFilter('month')}
                            >
                                Mois
                            </button>
                            <button
                                className={`px-3 py-1 rounded ${timeFilter === 'year' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
                                onClick={() => setTimeFilter('year')}
                            >
                                Année
                            </button>
                        </div>
                    </div>
                    {salesChartData ? (
                        <Bar
                            data={salesChartData}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'top',
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function (context) {
                                                return formatCFA(context.parsed.y);
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        ticks: {
                                            callback: function (value) {
                                                return formatCFA(value);
                                            }
                                        }
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Aucune donnée de vente disponible
                        </div>
                    )}
                </div>

                {/* Graphique des méthodes de paiement */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Répartition des paiements</h3>
                    {paymentChartData && Object.keys(stats.paymentMethods).length > 0 ? (
                        <div className="flex flex-col items-center">
                            <div className="w-64 h-64">
                                <Pie
                                    data={paymentChartData}
                                    options={{
                                        plugins: {
                                            tooltip: {
                                                callbacks: {
                                                    label: function (context) {
                                                        return `${context.label}: ${formatCFA(context.raw)}`;
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4 w-full">
                                {Object.entries(stats.paymentMethods).map(([method, amount], index) => (
                                    <div key={index} className="text-center p-2 bg-blue-50 rounded">
                                        <p className="font-medium">{method}</p>
                                        <p>{formatCFA(amount)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Aucune donnée de paiement disponible
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Statut des ventes */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold mb-4">Statut des ventes</h3>
                    {statusChartData ? (
                        <div className="flex flex-col items-center">
                            <div className="w-48 h-48">
                                <Pie data={statusChartData} />
                            </div>
                            <div className="mt-4 w-full">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                                        <span>Complétées</span>
                                    </div>
                                    <span>{stats.completedSales}</span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                                        <span>En attente</span>
                                    </div>
                                    <span>{stats.pendingSales}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                        <span>Annulées</span>
                                    </div>
                                    <span>{stats.cancelledSales}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Aucune donnée de statut disponible
                        </div>
                    )}
                </div>

                {/* Produits les plus vendus */}
                <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Produits les plus vendus</h3>
                    {stats && stats.topProducts.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chiffre d'affaires</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bénéfice</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stats.topProducts.map((product, index) => (
                                        <tr key={index}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{product.quantity}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{formatCFA(product.totalSales)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{formatCFA(product.profit)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Aucun produit vendu
                        </div>
                    )}
                </div>
            </div>

            {/* Dernières ventes */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800">Dernières ventes</h2>
                </div>

                {sales.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune vente trouvée</h3>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produits</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sales.slice(0, 10).map((sale) => (
                                    <tr key={sale._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(sale.saleDate), 'dd/MM/yyyy', { locale: fr })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{sale.client?.name || 'Non spécifié'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{sale.products.length} produits</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatCFA(sale.totalAmount || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                sale.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    sale.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {sale.status === 'completed' ? 'Complétée' :
                                                    sale.status === 'pending' ? 'En attente' :
                                                        sale.status === 'cancelled' ? 'Annulée' : sale.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <Link
                                                to={`/sales/${sale._id}`}
                                                className="text-indigo-600 hover:text-indigo-900"
                                            >
                                                Voir détails
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserSalesDashboard;