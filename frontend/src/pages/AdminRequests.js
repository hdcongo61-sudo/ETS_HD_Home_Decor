import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import AppLoader from '../components/AppLoader';

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
  action_required: 'bg-blue-100 text-blue-800',
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Demandes administrateur</h1>
          <p className="mt-1 text-sm text-gray-500">
            {canReview
              ? `${pendingCount} demande(s) en attente de validation.`
              : 'Suivez les demandes envoyées à un administrateur.'}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Actualiser
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <AppLoader fullScreen={false} text="Chargement des demandes..." />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          Aucune demande pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request._id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">
                      {REQUEST_LABELS[request.type] || request.type}
                    </h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[request.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[request.status] || request.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Demandé par {request.requestedBy?.name || 'Utilisateur'} · {formatDate(request.createdAt)}
                  </p>
                  {request.targetLabel && getTargetLink(request) ? (
                    <Link
                      to={getTargetLink(request)}
                      className="mt-1 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-800"
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
                    className="min-h-[88px] w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => handleReview(request._id, 'rejected')}
                      disabled={reviewingId === request._id}
                      className="min-h-[44px] rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(request._id, 'approved')}
                      disabled={reviewingId === request._id}
                      className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approuver
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRequests;
