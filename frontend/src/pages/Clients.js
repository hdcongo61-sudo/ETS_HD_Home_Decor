import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const Clients = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth.user.isAdmin;

  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [editingClient, setEditingClient] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientStats, setClientStats] = useState({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const navigate = useNavigate();

  const fetchClients = useCallback(async (abortSignal) => {
    try {
      setLoading(true);
      const response = await api.get('/clients', {
        params: { search: searchTerm },
        signal: abortSignal
      });

      const data = response.data || {};
      setClients(data.clients || []);
      setError('');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching clients:', error);
        setError('Erreur de chargement des clients');
        setClients([]);
      }
    } finally {
      if (!abortSignal?.aborted) setLoading(false);
    }
  }, [searchTerm]);

//   const fetchClientStats = async (clientId) => {
//     try {
//       const response = await api.get(`/clients/${clientId}`);
      
//       // Vérifiez la structure des données ici
//       console.log("Données reçues:", response.data);
      
//       // Si la structure est différente, transformez-la
//       const formattedData = {
//         totalPurchases: response.data.total_purchases, // adapter selon la réponse
//         totalSpent: response.data.total_amount,
//         recentPurchases: response.data.recent_purchases.map(purchase => ({
//           date: purchase.purchase_date,
//           amount: purchase.purchase_amount
//         }))
//       };
      
//       setClientStats(formattedData);
//       setShowStatsModal(true);
//     } catch (error) {
//       setError('Erreur de chargement des statistiques');
//     }
// };

  useEffect(() => {
    const controller = new AbortController();
    fetchClients(controller.signal);
    return () => controller.abort();
  }, [fetchClients]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingClient) {
        if (!isAdmin) {
          setError('Action non autorisée');
          return;
        }
        await api.put(`/clients/${editingClient._id}`, formData);
      } else {
        await api.post('/clients', formData);
      }
      await fetchClients();
      setIsFormOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '' });
      setEditingClient(null);
    } catch (error) {
      setError(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (client) => {
    if (!isAdmin) return;
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (clientId) => {
    if (!isAdmin) return;
    if (!window.confirm('Confirmer la suppression ?')) return;

    try {
      await api.delete(`/clients/${clientId}`);
      await fetchClients();
    } catch (error) {
      setError(error.response?.data?.message || 'Échec de la suppression');
    }
  };

  const handleViewPurchases = (clientId) => {
    if (!isAdmin) return;
    navigate(`/clients/${clientId}`);
  };

  const handleQuickActions = (client, action) => {
    setSelectedClient(client);
    switch (action) {
      
      case 'email':
        window.open(`mailto:${client.email}`, '_blank');
        break;
      case 'phone':
        window.open(`tel:${client.phone}`, '_blank');
        break;
      default:
        break;
    }
  };

  const formatCurrency = (amount) => {
    return `${amount?.toFixed(0) || 0} CFA`;
  };

  const formatUserDisplay = (user) => {
    if (!user) return '—';
    return user.name || user.email || '—';
  };

  const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 flex items-center gap-2">
              <div className="bg-blue-500 p-2 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              Gestion des Clients
            </h1>
            <p className="text-gray-600 mt-1">Gérez vos clients et consultez leurs statistiques</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => { setEditingClient(null); setIsFormOpen(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Nouveau
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-200">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {/* Client Form */}
            {isFormOpen && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  {editingClient ? 'Modifier le client' : 'Nouveau client'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['name', 'email', 'phone', 'address'].map((field) => (
                      <div key={field} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {{
                            name: 'Nom complet',
                            email: 'Adresse email',
                            phone: 'Téléphone',
                            address: 'Adresse'
                          }[field]}
                        </label>
                        <input
                          type={field === 'email' ? 'email' : 'text'}
                          name={field}
                          value={formData[field]}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          required={field === 'name' || field === 'email'}
                          placeholder={field === 'phone' ? '+242 00 000 00 00' : ''}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      {editingClient ? 'Mettre à jour' : 'Créer le client'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Clients List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {clients.length > 0 ? (
                <>
                  {/* Desktop view */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Client</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Contact</th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Statut</th>
                          {isAdmin && (
                            <th className="px-6 py-4 text-right text-sm font-medium text-gray-700">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {clients.map((client) => (
                          <tr key={client._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{client.name}</div>
                                  {client.address && (
                                    <div className="text-sm text-gray-500">{client.address}</div>
                                  )}
                                  {isAdmin && (
                                    <div className="mt-1 space-y-0.5 text-xs text-gray-400">
                                      <div>
                                        Créé par {formatUserDisplay(client.createdBy)}
                                        {formatTimestamp(client.createdAt) ? ` · ${formatTimestamp(client.createdAt)}` : ''}
                                      </div>
                                      {(client.updatedBy || formatTimestamp(client.updatedAt)) && (
                                        <div>
                                          Modifié par {formatUserDisplay(client.updatedBy)}
                                          {formatTimestamp(client.updatedAt) ? ` · ${formatTimestamp(client.updatedAt)}` : ''}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="text-sm text-gray-900">{client.email}</div>
                                {client.phone && (
                                  <div className="text-sm text-gray-500">{client.phone}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  Actif
                                </span>
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Quick Actions */}
                                  <div className="flex items-center gap-1">
                                    {client.email && (
                                      <button
                                        onClick={() => handleQuickActions(client, 'email')}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Envoyer un email"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    )}
                                    {client.phone && (
                                      <button
                                        onClick={() => handleQuickActions(client, 'phone')}
                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                        title="Appeler"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                      </button>
                                    )}
                                    
                                  </div>

                                  {/* Main Actions */}
                                  <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-2">
                                    <button
                                      onClick={() => handleEdit(client)}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Modifier"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>

                                    <button
                                      onClick={() => handleViewPurchases(client._id)}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Voir les achats"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </button>

                                    <button
                                      onClick={() => handleDelete(client._id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Supprimer"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile view */}
                  <div className="md:hidden">
                    {clients.map((client) => (
                      <div key={client._id} className="p-4 border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="bg-blue-100 p-1.5 rounded-lg">
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{client.name}</div>
                                <div className="text-sm text-gray-500">{client.email}</div>
                              </div>
                            </div>
                            {client.phone && (
                              <div className="text-sm text-gray-600 mb-2">{client.phone}</div>
                            )}
                            {client.address && (
                              <div className="text-sm text-gray-500">{client.address}</div>
                            )}
                            {isAdmin && (
                              <div className="mt-2 space-y-0.5 text-xs text-gray-400">
                                <div>
                                  Créé par {formatUserDisplay(client.createdBy)}
                                  {formatTimestamp(client.createdAt) ? ` · ${formatTimestamp(client.createdAt)}` : ''}
                                </div>
                                {(client.updatedBy || formatTimestamp(client.updatedAt)) && (
                                  <div>
                                    Modifié par {formatUserDisplay(client.updatedBy)}
                                    {formatTimestamp(client.updatedAt) ? ` · ${formatTimestamp(client.updatedAt)}` : ''}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                            {client.email && (
                              <button
                                onClick={() => handleQuickActions(client, 'email')}
                                className="flex-1 py-1.5 px-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Email
                              </button>
                            )}
                            {client.phone && (
                              <button
                                onClick={() => handleQuickActions(client, 'phone')}
                                className="flex-1 py-1.5 px-2 bg-green-50 text-green-600 rounded-lg text-sm hover:bg-green-100 transition-colors flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Appeler
                              </button>
                            )}
                            <button
                              onClick={() => handleViewPurchases(client._id)}
                              className="flex-1 py-1.5 px-2 bg-gray-50 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                            >
                              Achats
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center">
                  <div className="bg-gray-100 p-4 rounded-2xl inline-block mb-4">
                    <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client trouvé</h3>
                  <p className="text-gray-500 mb-4">Commencez par ajouter votre premier client</p>
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter un client
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Statistics Modal */}
        {showStatsModal && selectedClient && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl w-full max-w-md border border-gray-200 shadow-xl">
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Statistiques du client</h2>
        <button
          onClick={() => setShowStatsModal(false)}
          className="text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
    </div>
  </div>
)}
      </div>
    </div>
  );
};

export default Clients;
