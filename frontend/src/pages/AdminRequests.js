import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import AppLoader from '../components/AppLoader';
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from '../components/business';

const REQUEST_LABELS = {
  'sale.delete': 'Suppression vente',
  'sale.edit': 'Modification vente',
  'sale.cancel': 'Annulation vente',
  'payment.delete': 'Suppression paiement',
  'payment.edit': 'Modification paiement',
  'discount.request': 'Remise spéciale',
  'expense.create': 'Création dépense',
  'product.price_change': 'Changement prix',
  'stock.adjustment': 'Ajustement stock',
  'user.password_update': 'Mise à jour mot de passe',
  other: 'Autre demande',
};

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Rejetée',
};

const EXECUTION_STYLES = {
  none: 'bg-slate-100 text-slate-700',
  action_required: 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]',
  executed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

const EXECUTION_LABELS = {
  none: 'Sans action automatique',
  action_required: 'Action manuelle',
  executed: 'Exécutée',
  failed: 'Échec exécution',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

const getTargetLink = (request) => {
  if (!request?.targetId) return null;
  if (request.targetModel === 'Sale') return `/sales/${request.targetId}`;
  if (request.targetModel === 'User') return `/admin/users?user=${request.targetId}`;
  return null;
};

const AdminRequests = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
  const canReview = isAdmin || (Array.isArray(auth?.user?.permissions) && auth.user.permissions.includes('approve_admin_requests'));
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [adminComment, setAdminComment] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin-requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === 'pending').length,
    [requests]
  );

  const handleReview = async (requestId, status) => {
    try {
      setReviewingId(requestId);
      const { data } = await api.put(`/admin-requests/${requestId}/review`, {
        status,
        adminComment,
      });
      setRequests((prev) => prev.map((request) => (request._id === requestId ? data : request)));
      setAdminComment('');
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de traiter la demande');
    } finally {
      setReviewingId('');
    }
  };

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Demandes administrateur"
        description={canReview ? `${pendingCount} demande(s) en attente de validation.` : 'Suivez les demandes envoyees a un administrateur.'}
        actions={<Button variant="secondary" size="sm" onClick={fetchRequests}>Actualiser</Button>}
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          {error}
        </div>
      )}

      {loading ? (
        <AppLoader fullScreen={false} text="Chargement des demandes..." />
      ) : requests.length === 0 ? (
        <EmptyState title="Aucune demande" description="Aucune demande pour le moment." />
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <Surface key={request._id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">
                      {REQUEST_LABELS[request.type] || request.type}
                    </h2>
                    <StatusBadge tone={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}>{STATUS_LABELS[request.status] || request.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Demandé par {request.requestedBy?.name || 'Utilisateur'} · {formatDate(request.createdAt)}
                  </p>
                  {request.targetLabel && getTargetLink(request) ? (
                    <Link
                      to={getTargetLink(request)}
                      className="mt-1 inline-flex text-sm font-medium text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)]"
                    >
                      {request.targetModel === 'User' ? `Ouvrir le profil: ${request.targetLabel}` : request.targetLabel}
                    </Link>
                  ) : request.targetLabel ? (
                    <p className="mt-1 text-sm font-medium text-gray-700">{request.targetLabel}</p>
                  ) : null}
                </div>
              </div>

              {request.type === 'user.password_update' && request.status === 'pending' && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Rappel admin: ouvrez le profil utilisateur, vérifiez son identité, puis mettez à jour son mot de passe.
                </div>
              )}

              <div className="mt-4 rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Raison</p>
                <p className="mt-1 text-sm text-gray-800">{request.reason}</p>
                {request.note && <p className="mt-2 text-sm text-gray-600">{request.note}</p>}
              </div>

              {request.adminComment && (
                <div className="mt-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
                  Réponse admin: {request.adminComment}
                </div>
              )}

              {request.status === 'approved' && request.executionStatus && request.executionStatus !== 'none' && (
                <div className="mt-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
                  <span className={`mr-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${EXECUTION_STYLES[request.executionStatus] || EXECUTION_STYLES.none}`}>
                    {EXECUTION_LABELS[request.executionStatus] || request.executionStatus}
                  </span>
                  {request.executionMessage}
                </div>
              )}

              {canReview && request.status === 'pending' && (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    placeholder="Commentaire admin optionnel"
                    className="min-h-[88px] w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="danger" size="sm" onClick={() => handleReview(request._id, 'rejected')} disabled={reviewingId === request._id}>Rejeter</Button>
                    <Button variant="primary" size="sm" onClick={() => handleReview(request._id, 'approved')} disabled={reviewingId === request._id}>Approuver</Button>
                  </div>
                </div>
              )}
            </Surface>
          ))}
        </div>
      )}
    </Workspace>
  );
};

export default AdminRequests;
