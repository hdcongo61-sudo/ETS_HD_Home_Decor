import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const LoginActivityDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loginActivity, setLoginActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [location, setLocation] = useState(null);
    const [isLocationLoading, setIsLocationLoading] = useState(false);

    useEffect(() => {
        const fetchLoginActivity = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/users/login-activity/${id}`);
                setLoginActivity(data);
                setLoading(false);
            } catch (err) {
                setError('Échec du chargement des détails de connexion');
                setLoading(false);
            }
        };

        fetchLoginActivity();
    }, [id]);

    const fetchLocation = async () => {
        if (!loginActivity?.ipAddress) return;

        try {
            setIsLocationLoading(true);
            const response = await fetch(`https://ipapi.co/${loginActivity.ipAddress}/json/`);
            const data = await response.json();
            setLocation(data);
        } catch (err) {
            console.error('Erreur de géolocalisation:', err);
        } finally {
            setIsLocationLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr });
        } catch (e) {
            return 'Date invalide';
        }
    };

    const getStatusBadge = (success) => (
        <span
            className={`px-3 py-1 inline-flex text-sm font-medium rounded-full ${success
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}
        >
            {success ? 'Réussi' : 'Échoué'}
        </span>
    );

    const getRiskLevel = () => {
        if (!loginActivity) return 'faible';

        if (loginActivity.success) {
            return location?.country_code === 'FR' ? 'faible' : 'moyen';
        }

        return 'élevé';
    };

    const getRiskColor = () => {
        const level = getRiskLevel();
        return level === 'faible' ? 'bg-green-100 text-green-800'
            : level === 'moyen' ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
                <div className="text-center py-12">
                    <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
                        <svg
                            className="w-16 h-16 text-red-500"
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
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Erreur de chargement
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {error}
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retour à la liste
                    </button>
                </div>
            </div>
        );
    }

    if (!loginActivity) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Activité de connexion introuvable
                    </h2>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retour à la liste
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
                <button
                    onClick={() => navigate(`/users/stats`)}
                    className="flex items-center text-blue-600 hover:text-blue-800"
                >
                    <svg
                        className="w-5 h-5 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                    </svg>
                    Retour aux activités de connexion
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                Détails de l'activité de connexion
                            </h1>
                            <p className="text-gray-600">
                                ID: {loginActivity._id}
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex flex-col items-end">
                                <span className="text-sm text-gray-500">Statut</span>
                                {getStatusBadge(loginActivity.success)}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-sm text-gray-500">Niveau de risque</span>
                                <span className={`px-3 py-1 inline-flex text-sm font-medium rounded-full ${getRiskColor()}`}>
                                    {getRiskLevel()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                    {/* Informations utilisateur */}
                    <div className="bg-gray-50 p-6 rounded-lg">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                            Informations utilisateur
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-500">Nom</p>
                                <p className="font-medium">
                                    {loginActivity.user?.name || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Email</p>
                                <p className="font-medium">
                                    {loginActivity.user?.email || loginActivity.attemptedEmail || 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">ID utilisateur</p>
                                <p className="font-medium">
                                    {loginActivity.user?._id || 'Compte non identifié'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Rôle</p>
                                <p className="font-medium">
                                    {loginActivity.user?.isAdmin ? 'Administrateur' : 'Utilisateur'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Informations technique */}
                    <div className="bg-gray-50 p-6 rounded-lg">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                            Informations techniques
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-500">Adresse IP</p>
                                <div className="flex items-center">
                                    <p className="font-medium mr-2">
                                        {loginActivity.ipAddress || 'N/A'}
                                    </p>
                                    <button
                                        onClick={fetchLocation}
                                        disabled={!loginActivity.ipAddress || isLocationLoading}
                                        className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                    >
                                        {isLocationLoading ? 'Chargement...' : 'Localiser'}
                                    </button>
                                </div>
                            </div>

                            {location && (
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-500">Localisation approximative</p>
                                    <p className="font-medium">
                                        {location.city ? `${location.city}, ${location.region}` : 'Inconnue'}
                                    </p>
                                    <p className="text-sm">
                                        {location.country_name} ({location.country_code})
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Fournisseur: {location.org || 'Inconnu'}
                                    </p>
                                </div>
                            )}

                            <div>
                                <p className="text-sm text-gray-500">Appareil</p>
                                <p className="font-medium">
                                    {loginActivity.device || 'Inconnu'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Date et heure</p>
                                <p className="font-medium">
                                    {formatDate(loginActivity.createdAt)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Type de connexion</p>
                                <p className="font-medium">
                                    {loginActivity.user ? 'Compte existant' : 'Tentative sur compte inexistant'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section d'erreur pour les tentatives échouées */}
                {!loginActivity.success && (
                    <div className="bg-red-50 border-t border-red-100 p-6">
                        <h2 className="text-lg font-semibold text-red-800 mb-2">
                            Détails de l'échec
                        </h2>
                        <div className="space-y-2">
                            <div>
                                <p className="text-sm text-red-700">
                                    {loginActivity.error || 'Email ou mot de passe incorrect'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">
                                    Cette tentative a été effectuée avec l'email: <span className="font-medium">{loginActivity.attemptedEmail}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={() => navigate(`/users/login-stats`)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                    >
                        Retour
                    </button>
                    {loginActivity.user && (
                        <button
                            onClick={() => navigate(`/sales/user/${loginActivity.user._id}`)}
                            className="ml-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Voir le profil utilisateur
                        </button>
                    )}
                </div>
            </div>

            {/* Analyse de sécurité */}
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Analyse de sécurité
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium text-gray-800 mb-2">Contexte de la connexion</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li>• {loginActivity.success ? 'Connexion réussie' : 'Tentative échouée'}</li>
                            <li>• {loginActivity.user ? 'Compte existant' : 'Pas de compte associé'}</li>
                            <li>• Risque: {getRiskLevel()}</li>
                        </ul>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium text-gray-800 mb-2">Recommandations</h3>
                        <ul className="text-sm text-gray-600 space-y-1">
                            {!loginActivity.success && (
                                <>
                                    <li>• Vérifier les tentatives répétées depuis cette IP</li>
                                    <li>• Surveiller les activités suspectes sur le compte</li>
                                </>
                            )}
                            {location && location.country_code !== 'FR' && (
                                <li>• Connexion inhabituelle depuis {location.country_name}</li>
                            )}
                            <li>• Vérifier l'appareil: {loginActivity.device || 'Inconnu'}</li>
                        </ul>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-medium text-gray-800 mb-2">Actions</h3>
                        <div className="space-y-2">
                            {!loginActivity.success && (
                                <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800">
                                    Bloquer cette adresse IP
                                </button>
                            )}
                            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800">
                                Exporter les détails
                            </button>
                            <button className="w-full text-left text-sm text-blue-600 hover:text-blue-800">
                                Signaler comme suspect
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginActivityDetail;