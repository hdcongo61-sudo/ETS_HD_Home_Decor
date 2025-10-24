import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Clients = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth.user?.isAdmin || false;
  const navigate = useNavigate();

  const printRef = useRef();

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minSpent: '',
    maxSpent: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });

  // --- Fetch stats ---
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/clients/stats');
      setStats(data);
    } catch (err) {
      console.error('Erreur stats:', err);
      toast.error("Impossible de charger les statistiques");
    }
  }, []);

  // --- Fetch clients ---
  const fetchClients = useCallback(async (signal) => {
    try {
      setLoading(true);
      const { data } = await api.get('/clients', { params: { search: searchTerm }, signal });
      setClients(data.clients || []);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Erreur clients:', err);
        toast.error('Erreur lors du chargement des clients');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [searchTerm]);

  // --- Apply filters ---
  const applyFilters = async () => {
    try {
      setFiltering(true);
      const { data } = await api.get('/clients/filter', { params: filters });
      setClients(data);
      toast.success('Filtres appliqués');
    } catch (err) {
      console.error('Erreur filtre:', err);
      toast.error('Erreur lors du filtrage');
    } finally {
      setFiltering(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchClients(controller.signal);
    fetchStats();
    return () => controller.abort();
  }, [fetchClients, fetchStats]);

  const formatCurrency = (value) => {
    if (!value) return '0 CFA';
    return `${Number(value).toLocaleString('fr-FR')} CFA`;
  };

  // --- Add or Edit client ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient._id}`, formData);
        toast.success('✅ Client mis à jour avec succès');
      } else {
        await api.post('/clients', formData);
        toast.success('✅ Client ajouté avec succès');
      }
      setIsFormOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '' });
      setEditingClient(null);
      fetchClients();
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde du client');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce client ?')) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success('🗑️ Client supprimé avec succès');
      fetchClients();
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  // --- Export to PDF ---
 const handleExportPdf = async () => {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/export/clients`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      }
    );

    if (!response.ok) throw new Error('Erreur lors de la génération du PDF');

    // Convert the response into a Blob (binary)
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    // Create a hidden link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rapport_Clients_${new Date()
      .toLocaleDateString('fr-FR')
      .replace(/\//g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();

    // Clean up
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert('Impossible de télécharger le rapport PDF');
  }
};


  useEffect(() => {
    document.body.style.overflow = isFormOpen ? 'hidden' : 'auto';
  }, [isFormOpen]);

  // --- UI ---
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2">
              <div className="bg-blue-500 p-2 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              Gestion des Clients
            </h1>
            <p className="text-gray-600 mt-1">Recherchez, filtrez et gérez vos clients.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <button
                onClick={() => {
                  setIsFormOpen(true);
                  setEditingClient(null);
                  setFormData({ name: '', email: '', phone: '', address: '' });
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                + Nouveau Client
              </button>
            )}
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow hover:opacity-90 transition"
            >
              Exporter PDF
            </button>
            <Link
              to="/clients/dashboard"
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow hover:opacity-90 transition"
            >
              Voir le Tableau de Bord
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3 border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={() => fetchClients()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Rechercher
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div ref={printRef} className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Clients', value: stats.totalClients },
                { label: 'Achats Cumulés', value: formatCurrency(stats.totalSpent) },
                { label: 'Dépense Moyenne', value: formatCurrency(stats.avgSpent) },
                { label: 'Nouveaux (mois)', value: stats.newThisMonth },
              ].map((stat, i) => (
                <div key={i} className="bg-white border rounded-xl p-4 text-center shadow-sm">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <h3 className="text-2xl font-semibold text-gray-900 mt-1">{stat.value}</h3>
                </div>
              ))}
            </div>

            {/* Top clients pie */}
            {stats.topClients?.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Clients</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={stats.topClients} dataKey="totalSpent" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {stats.topClients.map((entry, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toLocaleString('fr-FR')} CFA`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              ) : clients.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-700 font-medium">Nom</th>
                      <th className="px-4 py-3 text-left text-gray-700 font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-gray-700 font-medium">Téléphone</th>
                      {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clients.map((c) => (
                      <tr key={c._id} className="hover:bg-gray-50">
                        <td
                          className="px-4 py-3 cursor-pointer text-blue-600 hover:underline"
                          onClick={() => navigate(`/clients/${c._id}`)}
                        >
                          {c.name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingClient(c);
                                setFormData({
                                  name: c.name,
                                  email: c.email,
                                  phone: c.phone,
                                  address: c.address,
                                });
                                setIsFormOpen(true);
                              }}
                              className="px-2 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(c._id)}
                              className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Supprimer
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-10 text-gray-500">Aucun client trouvé</div>
              )}
            </div>
          </div>
        )}

        {/* ✅ Animated Modal Form */}
        <Modal
          show={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingClient(null);
          }}
          title={editingClient ? 'Modifier Client' : 'Nouveau Client'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nom"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Téléphone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Adresse"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingClient(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white rounded-lg"
              >
                {editingClient ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};

/* ===================================================== */
/* 🪟 MODAL ANIMÉ (Framer Motion) */
/* ===================================================== */
const Modal = ({ show, onClose, title, children }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{
            opacity: 0,
            scale: window.innerWidth < 768 ? 1 : 0.9,
            y: window.innerWidth < 768 ? 40 : 0,
          }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{
            opacity: 0,
            scale: window.innerWidth < 768 ? 1 : 0.9,
            y: window.innerWidth < 768 ? 40 : 0,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
            >
              &times;
            </button>
          </div>
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Clients;
