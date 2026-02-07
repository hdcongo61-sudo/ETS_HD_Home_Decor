import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { Users, BarChart3, LogIn, UserCog, RefreshCw, ChevronLeft } from 'lucide-react';
import AppLoader from '../components/AppLoader';

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
            // eslint-disable-next-line react-hooks/exhaustive-deps -- intended run on timeRange only
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
            <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
                        Statistiques des ventes par utilisateur
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="min-h-[44px] px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 text-sm"
                            aria-label="Période"
                        >
                            <option value="7days">7 derniers jours</option>
                            <option value="30days">30 derniers jours</option>
                            <option value="90days">90 derniers jours</option>
                            <option value="all">Toutes périodes</option>
                        </select>
                        <button
                            type="button"
                            onClick={fetchSalesStats}
                            className="flex items-center gap-2 min-h-[44px] px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium"
                        >
                            <RefreshCw className="w-4 h-4" /> Actualiser
                        </button>
                    </div>
                </div>

                {salesError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-800 text-sm">
                        <UserCog className="w-5 h-5 shrink-0" />
                        {salesError}
                    </div>
                )}

                {salesLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <AppLoader fullScreen={false} text="Chargement des stats…" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                            <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                                    Performance des vendeurs
                                </h3>
                                <div className="h-64 sm:h-80">
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
                            </section>

                            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 sm:p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                                    <div className="text-xl sm:text-2xl font-bold text-blue-800 dark:text-blue-300 tabular-nums">
                                        {formatCFA(salesStats.reduce((sum, stat) => sum + stat.totalAmount, 0))}
                                    </div>
                                    <div className="text-sm text-blue-600 dark:text-blue-400 mt-0.5">Chiffre d'affaires total</div>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 sm:p-5 rounded-2xl border border-green-100 dark:border-green-800">
                                    <div className="text-xl sm:text-2xl font-bold text-green-800 dark:text-green-300 tabular-nums">
                                        {formatCFA(calculateTotalProfit())}
                                    </div>
                                    <div className="text-sm text-green-600 dark:text-green-400 mt-0.5">Bénéfice total généré</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 sm:p-5 rounded-2xl border border-purple-100 dark:border-purple-800">
                                    <div className="text-xl sm:text-2xl font-bold text-purple-800 dark:text-purple-300 tabular-nums">
                                        {salesStats.reduce((sum, stat) => sum + stat.salesCount, 0)}
                                    </div>
                                    <div className="text-sm text-purple-600 dark:text-purple-400 mt-0.5">Transactions totales</div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile: user cards */}
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
                                    <Link
                                        key={stat.userId}
                                        to={`/sales/user/${stat.userId}`}
                                        className="block rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">{stat.userName.charAt(0)}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-gray-900 dark:text-white truncate">{stat.userName}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{stat.userEmail}</div>
                                                </div>
                                            </div>
                                            <span className="text-xs rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-gray-600 dark:text-gray-400 shrink-0">
                                                {stat.clientsCount} clients
                                            </span>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3">
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Transactions</div>
                                                <div className="font-semibold text-gray-900 dark:text-white mt-0.5">{stat.salesCount}</div>
                                            </div>
                                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                                                <div className="text-xs text-blue-600 dark:text-blue-400">Chiffre d'affaires</div>
                                                <div className="font-semibold text-blue-700 dark:text-blue-300 mt-0.5">{formatCFA(stat.totalAmount)}</div>
                                            </div>
                                            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 col-span-2">
                                                <div className="text-xs text-green-600 dark:text-green-400">Bénéfice</div>
                                                <div className={`font-semibold mt-0.5 ${profit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
                                                    {formatCFA(profit)}
                                                </div>
                                            </div>
                                            <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3 col-span-2">
                                                <div className="text-xs text-purple-600 dark:text-purple-400">Vente moyenne</div>
                                                <div className="font-semibold text-purple-700 dark:text-purple-300 mt-0.5">{formatCFA(stat.averageSale)}</div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Desktop: table */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hidden md:block">
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
            <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-6 sm:p-8 text-center">
                    <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-2xl inline-flex justify-center mb-4 w-16 h-16">
                        <UserCog className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Accès administrateur requis
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Vous n'avez pas la permission d'accéder à cette page.
                    </p>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium text-sm"
                    >
                        <ChevronLeft size={18} /> Retour à l'accueil
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
        <div className="min-h-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
                {/* Header — mobile/desktop */}
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                            aria-label="Retour à l'accueil"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </Link>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate sm:text-2xl">
                                    Dashboard administrateur
                                </h1>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    Utilisateurs, ventes et connexions
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Mode Admin
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'dashboard') fetchStats();
                            }}
                            className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Actualiser</span>
                        </button>
                    </div>
                </header>

                {/* Tabs — scrollable on mobile */}
                <nav
                    className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin sm:flex-wrap sm:overflow-visible sm:border-b sm:border-gray-200 dark:sm:border-gray-700"
                    aria-label="Sections du tableau de bord"
                >
                    {[
                        { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
                        { id: 'salesStats', label: 'Stats ventes', icon: BarChart3 },
                        { id: 'loginStats', label: 'Connexions', icon: LogIn },
                        { id: 'users', label: 'Utilisateurs', icon: UserCog },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </nav>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-sm flex items-center gap-3">
                    <UserCog className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {loading && activeTab === 'dashboard' ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20">
                    <AppLoader fullScreen={false} text="Chargement du tableau de bord…" />
                </div>
            ) : activeTab === 'dashboard' ? (
                <div className="space-y-6">
                    {/* KPI cards */}
                    <motion.section
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        aria-label="Indicateurs utilisateurs"
                    >
                        <StatCard title="Utilisateurs totaux" value={stats.totalUsers} color="blue" />
                        <StatCard title="Utilisateurs actifs" value={stats.activeUsers} color="green" />
                        <StatCard title="Administrateurs" value={stats.admins} color="purple" />
                        <StatCard title="Inscriptions récentes" value={stats.recentUsers.length} color="orange" />
                    </motion.section>

                    {/* Charts */}
                    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                        <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                                Répartition des rôles
                            </h3>
                            <div className="h-56 sm:h-64">
                                <Pie data={userRoleData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        </section>
                        <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                                Activité récente
                            </h3>
                            <div className="h-56 sm:h-64">
                                <Bar
                                    data={recentActivityData}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                            y: { beginAtZero: true },
                                            x: {},
                                        },
                                    }}
                                />
                            </div>
                        </section>
                    </div>

                    {/* Recent users — card on mobile, table on desktop */}
                    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Utilisateurs récemment inscrits
                            </h3>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                Inscrits dans les 30 derniers jours
                            </p>
                        </div>
                        {/* Mobile: cards */}
                        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                            {stats.recentUsers.length === 0 ? (
                                <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">Aucun utilisateur récent</p>
                            ) : (
                                stats.recentUsers.map((user) => (
                                    <div key={user._id} className="px-4 py-4 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                                                {user.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${user.isAdmin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                                            {user.isAdmin ? 'Admin' : 'User'}
                                        </span>
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Desktop: table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nom</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rôle</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inscrit le</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {stats.recentUsers.map((user) => (
                                        <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">{user.name.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 sm:px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                                            <td className="px-4 sm:px-6 py-3">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${user.isAdmin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                                                    {user.isAdmin ? 'Admin' : 'Utilisateur'}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

            ) : activeTab === 'salesStats' ? (
                <SalesStatsDashboard />
            ) : activeTab === 'loginStats' ? (
                <ResumeConnexions />
            ) : (
                <UserManagement />
            )}
            </div>
        </div>
    );
};

// StatCard — KPI card with icon by color (mobile/desktop)
const StatCard = ({ title, value, color = 'blue' }) => {
    const colorClasses = {
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Users },
        green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: BarChart3 },
        purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: UserCog },
        orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: Users },
    };
    const style = colorClasses[color] || colorClasses.blue;
    const Icon = style.icon;

    return (
        <article className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${style.bg}`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${style.text}`} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
                </div>
            </div>
        </article>
    );
};

export default DashboardAdmin;
