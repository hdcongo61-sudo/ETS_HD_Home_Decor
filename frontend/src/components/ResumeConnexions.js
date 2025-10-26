import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ResumeConnexions = () => {
    const [loginStats, setLoginStats] = useState({
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        recentLogins: []
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchLoginStats();
    }, []);

    const fetchLoginStats = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users/login-stats');
            setLoginStats(data);
            setLoading(false);
        } catch (err) {
            const errorMessage = err.response?.data?.message ||
                err.message ||
                'Échec du chargement des statistiques de connexion';
            setError(errorMessage);
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Format invalide';

            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error('Erreur de formatage de date:', e);
            return 'Date invalide';
        }
    };

    return (
        <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
                Résumé des connexions
            </h2>
            <button
                onClick={fetchLoginStats}
                className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full md:w-auto"
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

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                    <svg
                        className="w-6 h-6 mr-3"
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

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="bg-white p-6 rounded-lg shadow border border-blue-100">
                            <div className="text-3xl font-bold text-blue-800 mb-2">
                                {loginStats.totalLogins}
                            </div>
                            <div className="text-lg text-blue-600">
                                Connexions totales
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border border-green-100">
                            <div className="text-3xl font-bold text-green-800 mb-2">
                                {loginStats.successfulLogins}
                            </div>
                            <div className="text-lg text-green-600">
                                Connexions réussies (30j)
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border border-red-100">
                            <div className="text-3xl font-bold text-red-800 mb-2">
                                {loginStats.failedLogins}
                            </div>
                            <div className="text-lg text-red-600">
                                Échecs de connexion (30j)
                            </div>
                        </div>
                    </div>

                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">
                                Activité de connexion récente
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Les 10 dernières tentatives de connexion
                            </p>
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Utilisateur
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email utilisé
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Statut
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Adresse IP
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Appareil
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loginStats.recentLogins.map((login) => (
                                        <tr
                                            key={login._id}
                                            onClick={() => navigate(`/users/login-activity/${login._id}`)}
                                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {login.user?.name || 'N/A'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {login.user?._id ? `ID: ${login.user._id.substring(0, 8)}...` : 'Compte inexistant'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {login.attemptedEmail || login.user?.email || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${login.success
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {login.success ? 'Réussi' : 'Échoué'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {login.ipAddress}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="truncate max-w-xs">
                                                    {login.device || 'Inconnu'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(login.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="md:hidden space-y-4 p-4">
                            {loginStats.recentLogins.map((login) => (
                                <div
                                    key={login._id}
                                    className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm"
                                    onClick={() => navigate(`/users/login-activity/${login._id}`)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-base font-semibold text-gray-900">
                                                {login.user?.name || 'N/A'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {login.attemptedEmail || login.user?.email || 'N/A'}
                                            </p>
                                        </div>
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-semibold ${login.success
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {login.success ? 'Réussi' : 'Échoué'}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                                        <p>IP : {login.ipAddress || 'N/A'}</p>
                                        <p>Appareil : {login.device || 'Inconnu'}</p>
                                        <p>Date : {formatDate(login.createdAt)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ResumeConnexions;
