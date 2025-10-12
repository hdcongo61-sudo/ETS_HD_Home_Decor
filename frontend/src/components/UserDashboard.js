import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import UserForm from './UserForm';
import { toast } from 'react-toastify';
import useResponsiveTable from '../hooks/useResponsiveTable';

// Icônes SVG réutilisables
const PencilIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
);

const TrashIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const PlusIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
);

const ChartIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const UserIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const ActivityIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const CONNECTED_THRESHOLD_MINUTES = 15;

const formatDateTime = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
        date: date.toLocaleDateString('fr-FR'),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
};

const UserDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const { auth } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({
        totalUsers: 0,
        adminCount: 0,
        activeToday: 0,
        newestUser: null,
        connectedNow: 0
    });
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get('/users');
                setUsers(data);

                // Calculer les statistiques
                const today = new Date();
                const activeToday = data.filter(u => {
                    // Check if user was active today (either last login or created today)
                    const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
                    const createdDate = new Date(u.createdAt);
                    
                    return (lastLoginDate && lastLoginDate.toDateString() === today.toDateString()) ||
                           (createdDate.toDateString() === today.toDateString());
                }).length;

                const newestUser = data.length > 0
                    ? data.reduce((newest, user) =>
                        new Date(user.createdAt) > new Date(newest.createdAt) ? user : newest
                    )
                    : null;

                const thresholdMs = CONNECTED_THRESHOLD_MINUTES * 60 * 1000;
                const nowMs = Date.now();
                const connectedNow = data.filter(user => {
                    if (!user.lastLogin) return false;
                    const lastLoginDate = new Date(user.lastLogin);
                    if (Number.isNaN(lastLoginDate.getTime())) return false;
                    return (nowMs - lastLoginDate.getTime()) <= thresholdMs;
                }).length;

                setStats({
                    totalUsers: data.length,
                    adminCount: data.filter(u => u.isAdmin).length,
                    activeToday,
                    newestUser,
                    connectedNow
                });

                setLoading(false);
            } catch (err) {
                setError('Échec du chargement des utilisateurs');
                setLoading(false);
                toast.error('Échec du chargement des utilisateurs');
            }
        };

        if (auth.isAdmin) {
            fetchUsers();
        }
    }, [auth]);

    const handleDelete = async (userId) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            try {
                await api.delete(`/users/${userId}`);
                setUsers(users.filter((user) => user._id !== userId));
                toast.success('Utilisateur supprimé avec succès');
            } catch (err) {
                setError('Échec de la suppression de l\'utilisateur');
                toast.error('Échec de la suppression de l\'utilisateur');
            }
        }
    };

    const handleFormSubmit = async (userData) => {
        try {
            if (selectedUser) {
                // Mettre à jour un utilisateur existant
                const { data } = await api.put(`/users/${selectedUser._id}`, userData);
                setUsers(users.map((u) => (u._id === data._id ? data : u)));
                toast.success('Utilisateur mis à jour avec succès');
            } else {
                // Créer un nouvel utilisateur
                const { data } = await api.post('/users/admin', userData);
                setUsers([...users, data]);
                toast.success('Utilisateur créé avec succès');
            }
            setShowForm(false);
            setSelectedUser(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Opération échouée');
            toast.error(err.response?.data?.message || 'Opération échouée');
        }
    };

    const formatRemainingTime = (ms) => {
        if (ms <= 0) return 'quelques instants';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (minutes === 0) {
            return `${seconds}s`;
        }
        if (minutes < 5) {
            const paddedSeconds = String(seconds).padStart(2, '0');
            return `${minutes}min ${paddedSeconds}s`;
        }
        return `${minutes}min`;
    };

    const connectedUsers = useMemo(() => {
        const thresholdMs = CONNECTED_THRESHOLD_MINUTES * 60 * 1000;
        const nowMs = Date.now();
        return users.filter(user => {
            if (!user.lastLogin) return false;
            const lastLoginDate = new Date(user.lastLogin);
            if (Number.isNaN(lastLoginDate.getTime())) return false;
            return (nowMs - lastLoginDate.getTime()) <= thresholdMs;
        });
    }, [users]);

    const baseUsers = activeTab === 'connected' ? connectedUsers : users;

    const filteredUsers = baseUsers.filter(user => {
        const target = searchTerm.toLowerCase();
        return (
            user.name.toLowerCase().includes(target) ||
            user.email.toLowerCase().includes(target) ||
            (user.phone && user.phone.toLowerCase().includes(target))
        );
    });

    const totalUsersCount = users.length;
    const connectedUsersCount = connectedUsers.length;

    const usersTableRef = useRef(null);
    useResponsiveTable(usersTableRef, [filteredUsers]);

    if (!auth.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl mt-10">
                <div className="text-center py-12">
                    <div className="bg-red-100 p-4 rounded-full inline-flex items-center justify-center mb-4 w-16 h-16">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Accès administrateur requis</h2>
                    <p className="text-gray-600 mb-6">Vous n'avez pas la permission d'accéder à cette page</p>
                    <Link to="/" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* En-tête avec cartes de statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Utilisateurs totaux"
                    value={stats.totalUsers}
                    icon={<UserIcon className="w-5 h-5" />}
                    color="blue"
                />

                <StatCard
                    title="Administrateurs"
                    value={stats.adminCount}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    }
                    color="green"
                />

                <StatCard
                    title={`Connectés (${CONNECTED_THRESHOLD_MINUTES} min)`}
                    value={`${stats.connectedNow} connectés • ${stats.activeToday} actifs aujourd'hui`}
                    icon={<ActivityIcon className="w-5 h-5" />}
                    color="purple"
                />

                <StatCard
                    title="Nouvel utilisateur"
                    value={stats.newestUser ? stats.newestUser.name : 'Aucun'}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    }
                    color="orange"
                    isName={true}
                />
            </div>

            {/* Recherche et bouton d'ajout */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                        <UserIcon className="w-7 h-7 text-blue-600 mr-3" />
                        Gestion des utilisateurs
                    </h1>
                    <p className="text-gray-600 mt-2">Gérez tous les utilisateurs et leurs permissions</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Rechercher des utilisateurs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedUser(null);
                            setShowForm(true);
                        }}
                        disabled={stats.totalUsers >= 3}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                    >
                        <PlusIcon className="w-4 h-4 text-white" />
                        {stats.totalUsers >= 3 ? 'Limite atteinte' : 'Ajouter un utilisateur'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center border border-red-100">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div className="inline-flex rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Tous les utilisateurs
                        <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {totalUsersCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('connected')}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${activeTab === 'connected' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Connectés
                        <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === 'connected' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {connectedUsersCount}
                        </span>
                    </button>
                </div>
                <p className="text-xs text-gray-500">
                    Un utilisateur est considéré comme connecté s'il s'est authentifié au cours des {CONNECTED_THRESHOLD_MINUTES} dernières minutes.
                </p>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {selectedUser ? "Modifier l'utilisateur" : "Ajouter un nouvel utilisateur"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setSelectedUser(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <UserForm
                            user={selectedUser}
                            onCancel={() => {
                                setShowForm(false);
                                setSelectedUser(null);
                            }}
                            onSubmit={handleFormSubmit}
                        />
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-600">Chargement des utilisateurs...</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {filteredUsers.length > 0 ? (
                        <div className="overflow-visible md:overflow-x-auto">
                            <table ref={usersTableRef} className="w-full responsive-table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activité</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fenêtre d'accès</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modifications</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredUsers.map((user) => {
                                        const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
                                        const disconnectDate = lastLoginDate
                                            ? new Date(lastLoginDate.getTime() + CONNECTED_THRESHOLD_MINUTES * 60 * 1000)
                                            : null;
                                        const remainingMs = disconnectDate ? disconnectDate.getTime() - Date.now() : null;
                                        const lastLoginDisplay = lastLoginDate ? formatDateTime(lastLoginDate) : null;
                                        const lastModifiedDisplay = formatDateTime(user.lastModifiedAt);
                                        const passwordModifiedDisplay = formatDateTime(user.passwordModifiedAt);
                                        const accessStartDisplay = formatDateTime(user.accessStart);
                                        const accessEndDisplay = formatDateTime(user.accessEnd);

                                        return (
                                        <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="bg-blue-100 rounded-xl p-2 mr-3">
                                                        <UserIcon className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                        {user.phone && (
                                                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h1.5a1 1 0 01.95.684l1.2 3.6a1 1 0 01-.54 1.236l-1.1.48a12.042 12.042 0 006.13 6.13l.48-1.1a1 1 0 011.236-.54l3.6 1.2a1 1 0 01.684.95V19a2 2 0 01-2 2H17c-7.18 0-13-5.82-13-13V5z" />
                                                                </svg>
                                                                <span>{user.phone}</span>
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-400 mt-1">ID: {user._id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {user.isAdmin ? 'Admin' : 'Utilisateur'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                                                <div className="text-xs text-gray-400">
                                                    {new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {lastLoginDate ? (
                                                    <div className="text-sm text-gray-900">
                                                        Dernière connexion: {lastLoginDisplay?.date}
                                                        <div className="text-xs text-gray-400">
                                                            {lastLoginDisplay?.time}
                                                        </div>
                                                        {activeTab === 'connected' && (
                                                            <div className="text-xs text-green-600 mt-1">
                                                                Déconnexion prévue à {disconnectDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                <span className="text-gray-400">
                                                                    {' '}
                                                                    · dans {formatRemainingTime(remainingMs)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-500">Jamais connecté</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.accessControlEnabled ? (
                                                    <div className="text-xs text-gray-700 space-y-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Restriction active</span>
                                                        <div>
                                                            <span className="font-medium text-gray-800">Depuis :</span>{' '}
                                                            {accessStartDisplay
                                                                ? `${accessStartDisplay.date}${accessStartDisplay.time ? ` à ${accessStartDisplay.time}` : ''}`
                                                                : 'Non défini'}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-800">Jusqu'à :</span>{' '}
                                                            {accessEndDisplay
                                                                ? `${accessEndDisplay.date}${accessEndDisplay.time ? ` à ${accessEndDisplay.time}` : ''}`
                                                                : 'Sans limite'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Accès libre</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-gray-600 space-y-2">
                                                    <div>
                                                        <span className="font-medium text-gray-800">Profil :</span>{' '}
                                                        {user.lastModifiedBy ? (
                                                            <span>
                                                                {user.lastModifiedBy.name || 'Utilisateur inconnu'}
                                                                {lastModifiedDisplay && (
                                                                    <span className="text-gray-400">
                                                                        {' '}• {lastModifiedDisplay.date}
                                                                        {lastModifiedDisplay.time && ` à ${lastModifiedDisplay.time}`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">Jamais modifié</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-gray-800">Mot de passe :</span>{' '}
                                                        {user.passwordModifiedBy ? (
                                                            <span>
                                                                {user.passwordModifiedBy.name || 'Utilisateur inconnu'}
                                                                {passwordModifiedDisplay && (
                                                                    <span className="text-gray-400">
                                                                        {' '}• {passwordModifiedDisplay.date}
                                                                        {passwordModifiedDisplay.time && ` à ${passwordModifiedDisplay.time}`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">Jamais modifié</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex space-x-2">
                                                    <Link
                                                        to={`/sales/user/${user._id}`}
                                                        className="flex items-center text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
                                                        title="Voir le tableau de bord des ventes"
                                                    >
                                                        <ChartIcon className="w-4 h-4 mr-1" />
                                                        Ventes
                                                    </Link>

                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setShowForm(true);
                                                        }}
                                                        className="flex items-center text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
                                                    >
                                                        <PencilIcon className="w-4 h-4 mr-1" />
                                                        Modifier
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(user._id)}
                                                        className="flex items-center text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
                                                    >
                                                        <TrashIcon className="w-4 h-4 mr-1" />
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="bg-gray-100 p-4 rounded-xl inline-flex items-center justify-center mb-4 w-12 h-12">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-gray-900 mb-1">Aucun utilisateur trouvé</h3>
                            <p className="text-gray-500 mb-4 text-sm">
                                {searchTerm
                                    ? 'Essayez un autre terme de recherche'
                                    : activeTab === 'connected'
                                        ? 'Aucun utilisateur connecté actuellement'
                                        : 'Commencez par ajouter votre premier utilisateur'}
                            </p>
                            <button
                                onClick={() => setShowForm(true)}
                                disabled={stats.totalUsers >= 3}
                                className="flex items-center gap-2 mx-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                            >
                                <PlusIcon className="w-4 h-4 text-white" />
                                {stats.totalUsers >= 3 ? 'Limite atteinte' : 'Ajouter un utilisateur'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// StatCard Component with Apple Design
const StatCard = ({ title, value, icon, color = 'blue', isName = false }) => {
    const colorClasses = {
        blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
        green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
        purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
        orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`bg-white p-5 rounded-2xl border ${colors.border}`}>
            <div className="flex items-center">
                <div className={`p-2.5 rounded-xl ${colors.bg} mr-3`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className={`text-lg font-semibold ${isName ? 'truncate max-w-[120px]' : ''}`}>{value}</p>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
