import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import UserManagement from '../components/UserDashboard';
import ResumeConnexions from '../components/ResumeConnexions';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import useResponsiveTable from '../hooks/useResponsiveTable';

ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    ArcElement
);

const DashboardAdmin = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        admins: 0,
        recentUsers: []
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('dashboard');
    const { auth } = useContext(AuthContext);

    useEffect(() => {
        if (auth.isAdmin) {
            fetchStats();
        }
    }, [auth]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users/stats');
            setStats(data);
            setLoading(false);
        } catch (err) {
            setError('Échec du chargement des données du tableau de bord');
            setLoading(false);
        }
    };

    const SalesStatsDashboard = () => {
        const [salesStats, setSalesStats] = useState([]);
        const [salesLoading, setSalesLoading] = useState(true);
        const [salesError, setSalesError] = useState('');
        const [timeRange, setTimeRange] = useState('30days');

        useEffect(() => {
            fetchSalesStats();
        }, [timeRange]);

        const fetchSalesStats = async () => {
            try {
                setSalesLoading(true);
                const { data } = await api.get(`/sales/user-stats?range=${timeRange}`);
                setSalesStats(data);
                setSalesLoading(false);
            } catch (err) {
                setSalesError('Échec du chargement des statistiques de ventes');
                setSalesLoading(false);
            }
        };

        const formatCFA = (amount) => {
            return new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'XOF',
                minimumFractionDigits: 0
            }).format(amount);
        };

        const calculateTotalProfit = () => {
            return salesStats.reduce((total, stat) => {
                if (stat.totalProfit !== undefined) {
                    return total + stat.totalProfit;
                }

                if (stat.products) {
                    return total + stat.products.reduce(
                        (sum, product) =>
                            sum + ((product.priceAtSale - (product.product?.costPrice || 0)) * product.quantity),
                        0
                    );
                }

                return total + (stat.totalAmount * 0.2);
            }, 0);
        };

        const tableRef = useRef(null);
        useResponsiveTable(tableRef, [salesStats]);

        const topSellersData = {
            labels: salesStats.map(stat => stat.userName),
            datasets: [
                {
                    label: 'Total des ventes (CFA)',
                    data: salesStats.map(stat => stat.totalAmount),
                    backgroundColor: 'rgba(0, 122, 255, 0.7)',
                    borderColor: 'rgba(0, 122, 255, 1)',
                    borderWidth: 1,
                },
                {
                    label: 'Bénéfice (CFA)',
                    data: salesStats.map(stat =>
                        stat.totalProfit !== undefined
                            ? stat.totalProfit
                            : stat.products
                                ? stat.products.reduce(
                                    (sum, p) =>
                                        sum + (p.priceAtSale - (p.product?.costPrice || 0)) * p.quantity,
                                    0
                                )
                                : stat.totalAmount * 0.2
                    ),
                    backgroundColor: 'rgba(52, 199, 89, 0.7)',
                    borderColor: 'rgba(52, 199, 89, 1)',
                    borderWidth: 1,
                },
            ],
        };

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Statistiques des ventes par utilisateur
                    </h2>

                    <div className="flex space-x-2">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                            <option value="7days">7 derniers jours</option>
                            <option value="30days">30 derniers jours</option>
                            <option value="90days">90 derniers jours</option>
                            <option value="all">Toutes périodes</option>
                        </select>

                        <button
                            onClick={fetchSalesStats}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm"
                        >
                            <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Actualiser
                        </button>
                    </div>
                </div>

                {salesError && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center border border-red-100">
                        <svg
                            className="w-5 h-5 mr-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        {salesError}
                    </div>
                )}

                {salesLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="bg-white p-6 rounded-2xl border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    Performance des vendeurs
                                </h3>
                                <div className="h-80">
                                    <Bar
                                        data={topSellersData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    ticks: {
                                                        callback: function (value) {
                                                            return formatCFA(value);
                                                        }
                                                    }
                                                }
                                            },
                                            plugins: {
                                                tooltip: {
                                                    callbacks: {
                                                        label: function (context) {
                                                            return `${context.dataset.label}: ${formatCFA(context.raw)}`;
                                                        }
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                                    <div className="text-2xl font-semibold text-blue-800 mb-2">
                                        {formatCFA(
                                            salesStats.reduce((sum, stat) => sum + stat.totalAmount, 0)
                                        )}
                                    </div>
                                    <div className="text-sm text-blue-600">
                                        Chiffre d'affaires total
                                    </div>
                                </div>

                                <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                                    <div className="text-2xl font-semibold text-green-800 mb-2">
                                        {formatCFA(calculateTotalProfit())}
                                    </div>
                                    <div className="text-sm text-green-600">
                                        Bénéfice total généré
                                    </div>
                                </div>

                                <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
                                    <div className="text-2xl font-semibold text-purple-800 mb-2">
                                        {salesStats.reduce((sum, stat) => sum + stat.salesCount, 0)}
                                    </div>
                                    <div className="text-sm text-purple-600">
                                        Transactions totales
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:hidden space-y-4">
                            {salesStats.map((stat) => {
                                const profit = stat.totalProfit ||
                                    (stat.products
                                        ? stat.products.reduce(
                                            (sum, p) => sum + (p.priceAtSale - (p.product?.costPrice || 0)) * p.quantity,
                                            0
                                        )
                                        : stat.totalAmount * 0.2);

                                return (
                                    <div key={stat.userId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <span className="text-blue-600 font-semibold text-sm">
                                                        {stat.userName.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{stat.userName}</div>
                                                    <div className="text-xs text-gray-500">{stat.userEmail}</div>
                                                </div>
                                            </div>
                                            <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                                {stat.clientsCount} clients
                                            </span>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
                                            <div className="rounded-xl bg-gray-50 p-3">
                                                <div className="text-xs text-gray-500">Transactions</div>
                                                <div className="font-semibold text-gray-900 mt-1">{stat.salesCount}</div>
                                            </div>
                                            <div className="rounded-xl bg-blue-50 p-3">
                                                <div className="text-xs text-blue-600">Chiffre d'affaires</div>
                                                <div className="font-semibold text-blue-700 mt-1">{formatCFA(stat.totalAmount)}</div>
                                            </div>
                                            <div className="rounded-xl bg-green-50 p-3 col-span-2">
                                                <div className="text-xs text-green-600">Bénéfice</div>
                                                <div className={`font-semibold mt-1 ${profit > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                    {formatCFA(profit)}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-purple-50 p-3 col-span-2">
                                                <div className="text-xs text-purple-600">Vente moyenne</div>
                                                <div className="font-semibold text-purple-700 mt-1">{formatCFA(stat.averageSale)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-4 md:hidden">
                            {salesStats.map((stat) => {
                                const profit = stat.totalProfit ||
                                    (stat.products
                                        ? stat.products.reduce(
                                            (sum, p) => sum + (p.priceAtSale - (p.product?.costPrice || 0)) * p.quantity,
                                            0
                                        )
                                        : stat.totalAmount * 0.2);

                                return (
                                    <div key={stat.userId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                                                    {stat.userName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{stat.userName}</div>
                                                    <div className="text-xs text-gray-500">{stat.userEmail}</div>
                                                </div>
                                            </div>
                                            <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                                                {stat.clientsCount} clients
                                            </span>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
                                            <div className="rounded-xl bg-gray-50 p-3">
                                                <div className="text-xs text-gray-500">Transactions</div>
                                                <div className="font-semibold text-gray-900 mt-1">{stat.salesCount}</div>
                                            </div>
                                            <div className="rounded-xl bg-blue-50 p-3">
                                                <div className="text-xs text-blue-600">Chiffre d'affaires</div>
                                                <div className="font-semibold text-blue-700 mt-1">{formatCFA(stat.totalAmount)}</div>
                                            </div>
                                            <div className="rounded-xl bg-green-50 p-3 col-span-2">
                                                <div className="text-xs text-green-600">Bénéfice</div>
                                                <div className={`font-semibold mt-1 ${profit > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                    {formatCFA(profit)}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-purple-50 p-3 col-span-2">
                                                <div className="text-xs text-purple-600">Vente moyenne</div>
                                                <div className="font-semibold text-purple-700 mt-1">{formatCFA(stat.averageSale)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hidden md:block">
                            <table ref={tableRef} className="w-full responsive-table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Vendeur
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Transactions
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Chiffre d'affaires
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Bénéfice
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Clients
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Vente moyenne
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {salesStats.map((stat) => {
                                        const profit = stat.totalProfit ||
                                            (stat.products ?
                                                stat.products.reduce(
                                                    (sum, p) => sum + (p.priceAtSale - (p.product?.costPrice || 0)) * p.quantity
                                                    , 0) :
                                                stat.totalAmount * 0.2);

                                        return (
                                            <tr key={stat.userId} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-9 w-9">
                                                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <span className="text-blue-600 font-medium text-sm">
                                                                    {stat.userName.charAt(0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {stat.userName}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {stat.userEmail}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {stat.salesCount}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                    {formatCFA(stat.totalAmount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                                    <span className={`${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCFA(profit)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {stat.clientsCount}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatCFA(stat.averageSale)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        );
    };

    if (!auth.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl mt-10">
                <div className="text-center py-12">
                    <div className="bg-red-100 p-4 rounded-full inline-flex items-center justify-center mb-4 w-16 h-16">
                        <svg
                            className="w-8 h-8 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Accès administrateur requis
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Vous n'avez pas la permission d'accéder à cette page
                    </p>
                    <Link
                        to="/"
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        );
    }

    const userRoleData = {
        labels: ['Administrateurs', 'Utilisateurs standard'],
        datasets: [
            {
                label: 'Rôles des utilisateurs',
                data: [stats.admins, stats.totalUsers - stats.admins],
                backgroundColor: ['rgba(0, 122, 255, 0.7)', 'rgba(52, 199, 89, 0.7)'],
                borderColor: ['rgba(0, 122, 255, 1)', 'rgba(52, 199, 89, 1)'],
                borderWidth: 1,
            },
        ],
    };

    const recentActivityData = {
        labels: stats.recentUsers.map(user => user.name),
        datasets: [
            {
                label: 'Inscriptions récentes',
                data: stats.recentUsers.map(user => {
                    const daysAgo = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
                    return Math.max(1, 30 - daysAgo);
                }),
                backgroundColor: 'rgba(88, 86, 214, 0.7)',
                borderColor: 'rgba(88, 86, 214, 1)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord administrateur</h1>
                </div>
                <div className="flex items-center space-x-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Mode Admin
                    </span>
                    <button
                        onClick={() => {
                            if (activeTab === 'dashboard') fetchStats();
                        }}
                        className="flex items-center text-gray-500 hover:text-gray-700 text-sm"
                    >
                        <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Actualiser
                    </button>
                </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex flex-wrap gap-2 sm:flex-nowrap sm:space-x-6 overflow-x-auto pb-2 scrollbar-thin">
                    {['dashboard', 'salesStats', 'loginStats', 'users'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 sm:flex-none whitespace-nowrap py-2 px-3 rounded-lg sm:rounded-none border sm:border-b-2 text-sm font-medium transition-colors ${activeTab === tab
                                ? 'border-blue-500 bg-blue-50 text-blue-600 sm:bg-transparent'
                                : 'border-transparent bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            {tab === 'dashboard' && 'Tableau de bord'}
                            {tab === 'salesStats' && 'Statistiques des ventes'}
                            {tab === 'loginStats' && 'Résumé des connexions'}
                            {tab === 'users' && 'Gestion des utilisateurs'}
                        </button>
                    ))}
                </nav>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center border border-red-100">
                    <svg
                        className="w-5 h-5 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    {error}
                </div>
            )}

            {loading && activeTab === 'dashboard' ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : activeTab === 'dashboard' ? (
                <div className="space-y-6">
                    {/* Cartes de statistiques */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            title="Utilisateurs totaux"
                            value={stats.totalUsers}
                            icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            color="blue"
                        />

                        <StatCard
                            title="Utilisateurs actifs"
                            value={stats.activeUsers}
                            icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            color="green"
                        />

                        <StatCard
                            title="Administrateurs"
                            value={stats.admins}
                            icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            color="purple"
                        />

                        <StatCard
                            title="Inscriptions récentes"
                            value={stats.recentUsers.length}
                            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            color="orange"
                        />
                    </div>

                    {/* Graphiques */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Répartition des rôles
                            </h3>
                            <div className="h-64">
                                <Pie data={userRoleData} />
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Activité récente
                            </h3>
                            <div className="h-64">
                                <Bar
                                    data={recentActivityData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                title: {
                                                    display: true,
                                                    text: "Score d'activité",
                                                },
                                            },
                                            x: {
                                                title: {
                                                    display: true,
                                                    text: 'Utilisateurs',
                                                },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tableau des utilisateurs récents */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Utilisateurs récemment inscrits
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Utilisateurs ayant rejoint dans les 30 derniers jours
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Nom
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rôle
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Inscrit le
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {stats.recentUsers.map((user) => (
                                        <tr key={user._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-9 w-9">
                                                        <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <span className="text-blue-600 font-medium text-sm">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            ID: {user._id.substring(0, 8)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {user.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 py-1 text-xs font-medium rounded-full ${user.isAdmin
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-green-100 text-green-800'
                                                        }`}
                                                >
                                                    {user.isAdmin ? 'Admin' : 'Utilisateur'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            ) : activeTab === 'salesStats' ? (
                <SalesStatsDashboard />
            ) : activeTab === 'loginStats' ? (
                <ResumeConnexions />
            ) : (
                <UserManagement />
            )}
        </div>
    );
};

// StatCard Component with Apple Design
const StatCard = ({ title, value, icon, color = 'blue' }) => {
    const colorClasses = {
        blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
        green: { bg: 'bg-green-100', text: 'text-green-600' },
        purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
        orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
            <div className="flex items-center">
                <div className={`p-3 rounded-xl ${colors.bg} mr-4`}>
                    <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                </div>
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-xl font-semibold text-gray-900">{value}</p>
                </div>
            </div>
        </div>
    );
};

export default DashboardAdmin;
