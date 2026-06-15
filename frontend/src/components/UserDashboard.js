import { confirmDialog } from './ConfirmProvider';
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import UserForm from './UserForm';
import Modal from './Modal';
import toast from 'react-hot-toast';
import useResponsiveTable from '../hooks/useResponsiveTable';
import AppLoader from './AppLoader';
import { PageHeader, Workspace, KPICard, StatusBadge, Button, DataTable } from './business';
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

const CONNECTED_THRESHOLD_MINUTES = 5;

const PERMISSION_LABELS = {
    view_sensitive_financials: 'Données sensibles',
    view_supplier_contacts: 'Contacts fournisseurs',
    approve_admin_requests: 'Validation demandes',
};

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
    const location = useLocation();
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
    const openedUserLinkRef = useRef('');

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
                    const activity = user.lastActivity || user.lastLogin;
                    if (!activity) return false;
                    const activityDate = new Date(activity);
                    if (Number.isNaN(activityDate.getTime())) return false;
                    return (nowMs - activityDate.getTime()) <= thresholdMs;
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

    useEffect(() => {
        const requestedUserId = new URLSearchParams(location.search).get('user');
        if (!requestedUserId) {
            openedUserLinkRef.current = '';
            return;
        }
        if (openedUserLinkRef.current === requestedUserId || users.length === 0) return;

        const matchedUser = users.find((user) => String(user._id) === requestedUserId);
        if (matchedUser) {
            openedUserLinkRef.current = requestedUserId;
            setSelectedUser(matchedUser);
            setShowForm(true);
            setActiveTab('all');
        }
    }, [location.search, users]);

    const handleDelete = async (userId) => {
        if (await confirmDialog('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
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

    const handleToggleActive = async (user) => {
        const action = user.isActive !== false ? 'désactiver' : 'activer';
        if (!await confirmDialog(`Êtes-vous sûr de vouloir ${action} le compte de ${user.name || user.email} ?`)) return;
        try {
            const { data } = await api.put(`/users/${user._id}/toggle-active`);
            setUsers(users.map((u) => (u._id === user._id ? { ...u, isActive: data.user.isActive } : u)));
            toast.success(data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Échec de la modification');
        }
    };

    const handleFormSubmit = async ({ payload, config }) => {
        try {
            const requestConfig = config || { headers: { 'Content-Type': 'application/json' } };
            if (selectedUser) {
                // Mettre à jour un utilisateur existant
                const { data } = await api.put(`/users/${selectedUser._id}`, payload, requestConfig);
                setUsers(users.map((u) => (u._id === data._id ? data : u)));
                toast.success('Utilisateur mis à jour avec succès');
            } else {
                // Créer un nouvel utilisateur
                const { data } = await api.post('/users/admin', payload, requestConfig);
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


    const connectedUsers = useMemo(() => {
        const thresholdMs = CONNECTED_THRESHOLD_MINUTES * 60 * 1000;
        const nowMs = Date.now();
        return users.filter(user => {
            const activity = user.lastActivity || user.lastLogin;
            if (!activity) return false;
            const activityDate = new Date(activity);
            if (Number.isNaN(activityDate.getTime())) return false;
            return (nowMs - activityDate.getTime()) <= thresholdMs;
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
            <div className="p-6 bg-[var(--ms-white)] rounded-lg mt-10">
                <div className="text-center py-12">
                    <div className="bg-[var(--ms-danger)]/15 p-4 rounded-full inline-flex items-center justify-center mb-4 w-16 h-16">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--ms-text-strong)] mb-2">Accès administrateur requis</h2>
                    <p className="text-[var(--ms-text)] mb-6">Vous n'avez pas la permission d'accéder à cette page</p>
                    <Link to="/" className="px-5 py-2.5 bg-[var(--ms-blue)] text-white rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Retour à l'accueil
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8">
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
                    title="En ligne"
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
                    <h1 className="text-2xl font-semibold text-[var(--ms-text-strong)] flex items-center">
                        <UserIcon className="w-7 h-7 text-[var(--ms-blue)] mr-3" />
                        Gestion des utilisateurs
                    </h1>
                    <p className="text-[var(--ms-text)] mt-2">Gérez tous les utilisateurs et leurs permissions</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Rechercher des utilisateurs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-[var(--ms-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <svg className="w-4 h-4 text-[var(--ms-text-muted)] absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedUser(null);
                            setShowForm(true);
                        }}
                        disabled={stats.totalUsers >= 4}
                        className="flex items-center justify-center gap-2 bg-[var(--ms-blue)] hover:bg-blue-700 text-white px-4 py-2.5 rounded-md transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--ms-blue)]"
                    >
                        <PlusIcon className="w-4 h-4 text-white" />
                        {stats.totalUsers >= 3 ? 'Limite atteinte' : 'Ajouter un utilisateur'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-[var(--ms-danger)]/10 text-[var(--ms-danger)] rounded-md flex items-center border border-red-100">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div className="inline-flex rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)]'}`}
                    >
                        Tous les utilisateurs
                        <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)]'}`}>
                            {totalUsersCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('connected')}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-l border-[var(--ms-border)] ${activeTab === 'connected' ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)]'}`}
                    >
                        Connectés
                        <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${activeTab === 'connected' ? 'bg-white/20 text-white' : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)]'}`}>
                            {connectedUsersCount}
                        </span>
                    </button>
                </div>
                <p className="text-xs text-[var(--ms-text-muted)]">
                    Un utilisateur est considéré comme connecté s'il s'est authentifié au cours des {CONNECTED_THRESHOLD_MINUTES} dernières minutes.
                </p>
            </div>

            <Modal
                show={showForm}
                onClose={() => { setShowForm(false); setSelectedUser(null); }}
                title={selectedUser ? "Modifier l'utilisateur" : "Ajouter un nouvel utilisateur"}
                subtitle={selectedUser ? "Mettez à jour les informations du compte." : "Créez un nouveau compte utilisateur."}
                size="lg"
            >
                <UserForm
                    user={selectedUser}
                    embedded
                    onCancel={() => { setShowForm(false); setSelectedUser(null); }}
                    onSubmit={handleFormSubmit}
                />
            </Modal>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--ms-white)] rounded-lg border border-[var(--ms-border)]">
                    <AppLoader fullScreen={false} text="Chargement des utilisateurs…" />
                </div>
            ) : (
                <div className="bg-[var(--ms-white)] rounded-lg border border-[var(--ms-border)] overflow-hidden">
                    {filteredUsers.length > 0 ? (
                        <>
                        <div className="hidden md:block overflow-visible md:overflow-x-auto">
                            <table ref={usersTableRef} className="w-full responsive-table">
                                <thead className="bg-[var(--ms-bg-subtle)]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Utilisateur</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Rôle</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Créé le</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Activité</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Fenêtre d'accès</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Modifications</th>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredUsers.map((user) => {
                                        const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
                                        const activityDate = user.lastActivity ? new Date(user.lastActivity) : null;
                                        const lastLoginDisplay = lastLoginDate ? formatDateTime(lastLoginDate) : null;
                                        const lastModifiedDisplay = formatDateTime(user.lastModifiedAt);
                                        const passwordModifiedDisplay = formatDateTime(user.passwordModifiedAt);
                                        const accessStartDisplay = formatDateTime(user.accessStart);
                                        const accessEndDisplay = formatDateTime(user.accessEnd);

                                        return (
                                        <tr key={user._id} className="hover:bg-[var(--ms-bg-subtle)] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--ms-blue-soft)] border border-[var(--ms-border)] flex items-center justify-center mr-3">
                                                        {user.photo ? (
                                                            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserIcon className="w-5 h-5 text-[var(--ms-blue)]" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-[var(--ms-text-strong)]">{user.name}</div>
                                                        <div className="text-sm text-[var(--ms-text-muted)]">{user.email}</div>
                                                        {user.phone && (
                                                            <div className="text-sm text-[var(--ms-text-muted)] flex items-center gap-1 mt-1">
                                                                <svg className="w-3.5 h-3.5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h1.5a1 1 0 01.95.684l1.2 3.6a1 1 0 01-.54 1.236l-1.1.48a12.042 12.042 0 006.13 6.13l.48-1.1a1 1 0 011.236-.54l3.6 1.2a1 1 0 01.684.95V19a2 2 0 01-2 2H17c-7.18 0-13-5.82-13-13V5z" />
                                                                </svg>
                                                                <span>{user.phone}</span>
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-[var(--ms-text-muted)] mt-1">ID: {user._id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${user.isAdmin ? 'bg-[var(--ms-success)]/15 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {user.isAdmin ? 'Admin' : 'Utilisateur'}
                                                </span>
                                                {!user.isAdmin && Array.isArray(user.permissions) && user.permissions.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {user.permissions.map((permission) => (
                                                            <span key={permission} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[var(--ms-text)]">
                                                                {PERMISSION_LABELS[permission] || permission}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge tone={user.isActive !== false ? 'success' : 'danger'}>
                                                        {user.isActive !== false ? 'Actif' : 'Inactif'}
                                                    </StatusBadge>
                                                    <button
                                                        onClick={() => handleToggleActive(user)}
                                                        className="text-[11px] font-medium text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] underline underline-offset-2 transition-colors"
                                                        title={user.isActive !== false ? 'Désactiver le compte' : 'Activer le compte'}
                                                    >
                                                        {user.isActive !== false ? 'Désactiver' : 'Activer'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[var(--ms-text-muted)]">
                                                {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                                                <div className="text-xs text-[var(--ms-text-muted)]">
                                                    {new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {lastLoginDate ? (
                                                    <div className="text-sm text-[var(--ms-text)]">
                                                        <div className="flex items-center gap-1.5">
                                                            {user.lastActivity && (new Date() - new Date(user.lastActivity)) <= CONNECTED_THRESHOLD_MINUTES * 60 * 1000 && (
                                                                <StatusBadge tone="success">En ligne</StatusBadge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-[var(--ms-text-muted)]">
                                                            {lastLoginDisplay?.date} {lastLoginDisplay?.time}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-[var(--ms-text-muted)]">Jamais connecté</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.accessControlEnabled ? (
                                                    <div className="text-xs text-[var(--ms-text)] space-y-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ms-warning)]/15 text-[var(--ms-warning)]">Restriction active</span>
                                                        <div>
                                                            <span className="font-medium text-[var(--ms-text-strong)]">Depuis :</span>{' '}
                                                            {accessStartDisplay
                                                                ? `${accessStartDisplay.date}${accessStartDisplay.time ? ` à ${accessStartDisplay.time}` : ''}`
                                                                : 'Non défini'}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-[var(--ms-text-strong)]">Jusqu'à :</span>{' '}
                                                            {accessEndDisplay
                                                                ? `${accessEndDisplay.date}${accessEndDisplay.time ? ` à ${accessEndDisplay.time}` : ''}`
                                                                : 'Sans limite'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-[var(--ms-text-muted)]">Accès libre</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-[var(--ms-text)] space-y-2">
                                                    <div>
                                                        <span className="font-medium text-[var(--ms-text-strong)]">Profil :</span>{' '}
                                                        {user.lastModifiedBy ? (
                                                            <span>
                                                                {user.lastModifiedBy.name || 'Utilisateur inconnu'}
                                                                {lastModifiedDisplay && (
                                                                    <span className="text-[var(--ms-text-muted)]">
                                                                        {' '}• {lastModifiedDisplay.date}
                                                                        {lastModifiedDisplay.time && ` à ${lastModifiedDisplay.time}`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--ms-text-muted)]">Jamais modifié</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-[var(--ms-text-strong)]">Mot de passe :</span>{' '}
                                                        {user.passwordModifiedBy ? (
                                                            <span>
                                                                {user.passwordModifiedBy.name || 'Utilisateur inconnu'}
                                                                {passwordModifiedDisplay && (
                                                                    <span className="text-[var(--ms-text-muted)]">
                                                                        {' '}• {passwordModifiedDisplay.date}
                                                                        {passwordModifiedDisplay.time && ` à ${passwordModifiedDisplay.time}`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--ms-text-muted)]">Jamais modifié</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex space-x-2">
                                                    <Link
                                                        to={`/sales/user/${user._id}`}
                                                        className="flex items-center text-[var(--ms-blue)] hover:text-blue-800 bg-[var(--ms-blue-soft)] hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
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
                                                        className="flex items-center text-[var(--ms-text)] hover:text-[var(--ms-text-strong)] bg-[var(--ms-bg-subtle)] hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
                                                    >
                                                        <PencilIcon className="w-4 h-4 mr-1" />
                                                        Modifier
                                                    </button>

                                                    <button
                                                        onClick={() => handleDelete(user._id)}
                                                        className="flex items-center text-[var(--ms-danger)] hover:text-red-800 bg-[var(--ms-danger)]/10 hover:bg-[var(--ms-danger)]/15 px-2.5 py-1.5 rounded-lg transition-colors text-sm"
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

                        <div className="md:hidden space-y-4 p-4">
                          {filteredUsers.map((user) => {
                            const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
                            const lastLoginDisplay = lastLoginDate ? formatDateTime(lastLoginDate) : null;
                            const lastModifiedDisplay = formatDateTime(user.lastModifiedAt);
                            const passwordModifiedDisplay = formatDateTime(user.passwordModifiedAt);
                            const accessStartDisplay = formatDateTime(user.accessStart);
                            const accessEndDisplay = formatDateTime(user.accessEnd);

                            return (
                              <div key={user._id} className="border border-[var(--ms-border)] rounded-lg p-4 bg-[var(--ms-white)] shadow-[var(--ms-shadow-sm)] space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex gap-3">
                                    <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--ms-blue-soft)] border border-[var(--ms-border)] flex items-center justify-center">
                                      {user.photo ? (
                                        <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <UserIcon className="w-6 h-6 text-[var(--ms-blue)]" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-base font-semibold text-[var(--ms-text-strong)]">{user.name}</p>
                                      <p className="text-sm text-[var(--ms-text-muted)]">{user.email}</p>
                                      {user.phone && <p className="text-sm text-[var(--ms-text-muted)]">📞 {user.phone}</p>}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.isAdmin ? 'bg-[var(--ms-success)]/15 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                      {user.isAdmin ? 'Admin' : 'Utilisateur'}
                                    </span>
                                    <StatusBadge tone={user.isActive !== false ? 'success' : 'danger'}>
                                      {user.isActive !== false ? 'Actif' : 'Inactif'}
                                    </StatusBadge>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleToggleActive(user)}
                                  className="text-[12px] font-medium text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] underline underline-offset-2 transition-colors"
                                >
                                  {user.isActive !== false ? 'Désactiver le compte' : 'Activer le compte'}
                                </button>
                                {!user.isAdmin && Array.isArray(user.permissions) && user.permissions.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {user.permissions.map((permission) => (
                                      <span key={permission} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[var(--ms-text)]">
                                        {PERMISSION_LABELS[permission] || permission}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-sm text-[var(--ms-text)]">
                                  <span className="font-medium text-[var(--ms-text-strong)]">Créé le :</span>{' '}
                                  {new Date(user.createdAt).toLocaleDateString('fr-FR')} • {new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-sm text-[var(--ms-text)]">
                                  <span className="font-medium text-[var(--ms-text-strong)]">Dernière connexion :</span>{' '}
                                  {lastLoginDisplay
                                    ? `${lastLoginDisplay.date}${lastLoginDisplay.time ? ` à ${lastLoginDisplay.time}` : ''}`
                                    : 'Jamais connecté'}
                                  {user.lastActivity && (new Date() - new Date(user.lastActivity)) <= CONNECTED_THRESHOLD_MINUTES * 60 * 1000 && (
                                    <span className="ml-2"><StatusBadge tone="success">En ligne</StatusBadge></span>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--ms-text)] space-y-1">
                                  <div>
                                    <span className="font-medium text-[var(--ms-text-strong)]">Accès :</span>{' '}
                                    {user.accessControlEnabled ? 'Restriction active' : 'Accès libre'}
                                  </div>
                                  {user.accessControlEnabled && (
                                    <>
                                      <div>
                                        <span className="font-medium text-[var(--ms-text-strong)]">Depuis :</span>{' '}
                                        {accessStartDisplay ? `${accessStartDisplay.date}${accessStartDisplay.time ? ` à ${accessStartDisplay.time}` : ''}` : '—'}
                                      </div>
                                      <div>
                                        <span className="font-medium text-[var(--ms-text-strong)]">Jusqu'à :</span>{' '}
                                        {accessEndDisplay ? `${accessEndDisplay.date}${accessEndDisplay.time ? ` à ${accessEndDisplay.time}` : ''}` : 'Sans limite'}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="text-xs text-[var(--ms-text)] space-y-1">
                                  <div>
                                    <span className="font-medium text-[var(--ms-text-strong)]">Modifié par :</span>{' '}
                                    {user.lastModifiedBy ? (
                                      <span>
                                        {user.lastModifiedBy.name || 'Utilisateur inconnu'}
                                        {lastModifiedDisplay && (
                                          <span className="text-[var(--ms-text-muted)]">{' '}• {lastModifiedDisplay.date}{lastModifiedDisplay.time && ` à ${lastModifiedDisplay.time}`}</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--ms-text-muted)]">Jamais modifié</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="font-medium text-[var(--ms-text-strong)]">Mot de passe :</span>{' '}
                                    {user.passwordModifiedBy ? (
                                      <span>
                                        {user.passwordModifiedBy.name || 'Utilisateur inconnu'}
                                        {passwordModifiedDisplay && (
                                          <span className="text-[var(--ms-text-muted)]">{' '}• {passwordModifiedDisplay.date}{passwordModifiedDisplay.time && ` à ${passwordModifiedDisplay.time}`}</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--ms-text-muted)]">Jamais modifié</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                  <Link
                                    to={`/sales/user/${user._id}`}
                                    className="flex-1 min-w-[120px] text-center text-[var(--ms-blue)] hover:text-blue-800 bg-[var(--ms-blue-soft)] hover:bg-blue-100 px-3 py-2 rounded-md text-sm font-medium"
                                  >
                                    Tableau des ventes
                                  </Link>
                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowForm(true);
                                    }}
                                    className="flex-1 min-w-[120px] text-center text-[var(--ms-text)] hover:text-[var(--ms-text-strong)] bg-[var(--ms-bg-subtle)] hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => handleDelete(user._id)}
                                    className="flex-1 min-w-[120px] text-center text-[var(--ms-danger)] hover:text-red-800 bg-[var(--ms-danger)]/10 hover:bg-[var(--ms-danger)]/15 px-3 py-2 rounded-md text-sm font-medium"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <div className="bg-[var(--ms-bg-subtle)] p-4 rounded-md inline-flex items-center justify-center mb-4 w-12 h-12">
                                <svg className="w-6 h-6 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-medium text-[var(--ms-text-strong)] mb-1">Aucun utilisateur trouvé</h3>
                            <p className="text-[var(--ms-text-muted)] mb-4 text-sm">
                                {searchTerm
                                    ? 'Essayez un autre terme de recherche'
                                    : activeTab === 'connected'
                                        ? 'Aucun utilisateur connecté actuellement'
                                        : 'Commencez par ajouter votre premier utilisateur'}
                            </p>
                            <button
                                onClick={() => setShowForm(true)}
                                disabled={stats.totalUsers >= 3}
                                className="flex items-center gap-2 bg-[var(--ms-blue)] hover:bg-blue-700 text-white px-4 py-2.5 rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--ms-blue)]"
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
        blue: { bg: 'bg-blue-100', text: 'text-[var(--ms-blue)]', border: 'border-blue-200' },
        green: { bg: 'bg-[var(--ms-success)]/15', text: 'text-[var(--ms-success)]', border: 'border-green-200' },
        purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
        orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    return (
        <div className={`bg-[var(--ms-white)] p-5 rounded-lg border ${colors.border}`}>
            <div className="flex items-center">
                <div className={`p-2.5 rounded-md ${colors.bg} mr-3`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-[var(--ms-text)]">{title}</p>
                    <p className={`text-lg font-semibold ${isName ? 'truncate max-w-[120px]' : ''}`}>{value}</p>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
