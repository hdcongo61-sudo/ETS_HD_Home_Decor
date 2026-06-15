import { confirmDialog } from '../components/ConfirmProvider';
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EditSaleForm from '../components/EditSaleForm';
import AuthContext from '../context/AuthContext';
import {
    Button,
    EmptyState,
    LoadingSkeleton,
    PageHeader,
    Surface,
    Workspace,
} from '../components/business';

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

        const confirmed = await confirmDialog(
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
            <Workspace>
                <PageHeader eyebrow="Vente" title="Modifier la vente" description="Chargement de la fiche vente." />
                <LoadingSkeleton rows={6} />
            </Workspace>
        );
    }

    if (error) {
        return (
            <Workspace>
                <PageHeader eyebrow="Vente" title="Modifier la vente" description="Une erreur est survenue." />
                <EmptyState
                    title="Impossible de charger la vente"
                    description={error}
                    action={<Button onClick={() => navigate('/sales')}>Retour aux ventes</Button>}
                />
            </Workspace>
        );
    }

    if (!sale) {
        return (
            <Workspace>
                <EmptyState
                    title="Vente introuvable"
                    description="La vente demandée n’a pas été trouvée."
                    action={<Button variant="primary" onClick={() => navigate('/sales')}>Retour aux ventes</Button>}
                />
            </Workspace>
        );
    }

    return (
        <Workspace>
            <PageHeader
                eyebrow="Vente"
                title="Modifier la vente"
                description="Ajustez les lignes, corrigez la date réelle si besoin et enregistrez une note de modification."
                actions={<Button onClick={() => navigate(`/sales/${id}`)}>Retour à la vente</Button>}
            />

            {/* Form card */}
            <Surface>
                <div className="p-4 md:p-6 lg:p-8">
                    <EditSaleForm
                        sale={sale}
                        clients={clients}
                        onUpdate={handleUpdateSale}
                        onCancel={() => navigate(`/sales/${id}`)}
                    />
                </div>
            </Surface>

            {/* Delete section (admin only) */}
            {isAdmin && (
                <section className="overflow-hidden rounded-lg border border-[rgba(209,52,56,0.22)] bg-[#FDF3F4]" aria-labelledby="delete-heading">
                    <div className="border-b border-[rgba(209,52,56,0.22)] bg-white px-4 py-3">
                        <h2 id="delete-heading" className="text-sm font-semibold text-red-800">
                            Zone dangereuse - Supprimer la vente
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
                                className="form-control"
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
                        <Button
                            type="button"
                            onClick={handleDeleteSale}
                            disabled={isDeleting}
                            variant="danger"
                            className="mt-4"
                        >
                            {isDeleting ? 'Suppression…' : 'Supprimer définitivement la vente'}
                        </Button>
                    </div>
                </section>
            )}
        </Workspace>
    );
};

export default EditSalePage;
