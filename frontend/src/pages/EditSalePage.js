import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EditSaleForm from '../components/EditSaleForm';
import AuthContext from '../context/AuthContext';
import AppLoader from '../components/AppLoader';

const EditSalePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { auth } = useContext(AuthContext);
    const isAdmin = Boolean(auth?.user?.isAdmin);
    const [sale, setSale] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                const [saleRes, clientsRes] = await Promise.all([
                    api.get(`/sales/${id}`),
                    api.get('/clients')
                ]);
                setSale(saleRes.data);
                const clientsData = clientsRes.data;
                setClients(Array.isArray(clientsData) ? clientsData : []);
            } catch (err) {
                setError(err.response?.data?.message || 'Impossible de charger la vente');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleUpdateSale = async (updateData) => {
        try {
            await api.put(`/sales/${sale._id}`, {
                products: updateData.products,
                note: updateData.note,
                saleDate: updateData.saleDate
            });
            navigate(`/sales/${sale._id}`, {
                state: { message: 'Vente mise à jour avec succès' }
            });
        } catch (err) {
            console.error('Update error:', err.response?.data || err.message);
            throw err;
        }
    };

    const handleDeleteSale = async () => {
        const reason = deleteReason.trim();
        if (!reason) {
            setDeleteError('Une raison est requise pour supprimer la vente.');
            return;
        }

        const confirmed = window.confirm(
            'Voulez-vous vraiment supprimer cette vente ? Cette action est irréversible.'
        );
        if (!confirmed) return;

        try {
            setIsDeleting(true);
            setDeleteError('');
            await api.delete(`/sales/${sale._id}`, {
                data: { reason }
            });
            navigate('/sales', {
                state: { message: 'Vente supprimée avec succès' }
            });
        } catch (deleteErr) {
            setDeleteError(deleteErr.response?.data?.message || 'Erreur lors de la suppression.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center p-6">
                <AppLoader fullScreen={false} text="Chargement de la vente…" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto p-4 md:p-6">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 md:p-5 flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-red-800">Erreur</p>
                        <p className="text-sm text-red-700 mt-0.5">{error}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/sales')}
                            className="mt-3 text-sm font-medium text-red-600 hover:text-red-800"
                        >
                            Retour aux ventes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="max-w-2xl mx-auto p-4 md:p-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Vente introuvable</h2>
                    <p className="text-gray-600 mb-6">La vente demandée n’a pas été trouvée.</p>
                    <button
                        type="button"
                        onClick={() => navigate('/sales')}
                        className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                    >
                        Retour aux ventes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 md:px-6 md:py-8">
            {/* Header */}
            <header className="mb-6 md:mb-8">
                <button
                    type="button"
                    onClick={() => navigate(`/sales/${id}`)}
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 min-h-[44px] md:min-h-0 py-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Retour à la fiche vente"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="font-medium">Retour à la vente</span>
                </button>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                    Modifier la vente
                </h1>
                <p className="mt-1 text-gray-500 text-sm md:text-base">
                    Ajustez les lignes, corrigez la date reelle si besoin et enregistrez une note de modification.
                </p>
            </header>

            {/* Form card */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 lg:p-8">
                    <EditSaleForm
                        sale={sale}
                        clients={clients}
                        onUpdate={handleUpdateSale}
                        onCancel={() => navigate(`/sales/${id}`)}
                    />
                </div>
            </div>

            {/* Delete section (admin only) */}
            {isAdmin && (
                <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/50 overflow-hidden" aria-labelledby="delete-heading">
                    <div className="px-4 py-3 border-b border-red-200 bg-white/80">
                        <h2 id="delete-heading" className="text-sm font-semibold text-red-800">
                            Zone dangereuse — Supprimer la vente
                        </h2>
                    </div>
                    <div className="p-4 md:p-5">
                        <p className="text-sm text-gray-700">
                            La suppression supprime définitivement la vente et réintègre les quantités au stock. Cette action est irréversible.
                        </p>
                        <div className="mt-4">
                            <label htmlFor="delete-reason" className="block text-sm font-medium text-gray-700 mb-1">
                                Raison de suppression <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="delete-reason"
                                value={deleteReason}
                                onChange={(e) => {
                                    setDeleteReason(e.target.value);
                                    if (deleteError) setDeleteError('');
                                }}
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 placeholder-gray-400"
                                placeholder="Expliquez pourquoi cette vente est supprimée…"
                                aria-invalid={!!deleteError}
                                aria-describedby={deleteError ? 'delete-error' : undefined}
                            />
                        </div>
                        {deleteError && (
                            <p id="delete-error" className="mt-2 text-sm text-red-600" role="alert">
                                {deleteError}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={handleDeleteSale}
                            disabled={isDeleting}
                            className="mt-4 min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                            {isDeleting ? 'Suppression…' : 'Supprimer définitivement la vente'}
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
};

export default EditSalePage;
