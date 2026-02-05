import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { clientPath } from '../utils/paths';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const GENDER_OPTIONS = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other', label: 'Autre' }
];
const GENDER_LABELS = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
  unknown: 'Non renseigné'
};
const GENDER_COLORS = {
  male: '#2563eb',
  female: '#ec4899',
  other: '#10b981',
  unknown: '#94a3b8'
};
const GENDER_ORDER = ['male', 'female', 'other', 'unknown'];

const Clients = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth.user?.isAdmin || false;
  const navigate = useNavigate();

  const printRef = useRef();
  const tableRef = useRef(null);

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  // eslint-disable-next-line no-unused-vars -- setFilters reserved for future filter UI
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minSpent: '',
    maxSpent: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars -- filtering state for applyFilters
  const [filtering, setFiltering] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    gender: 'other',
  });
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  });

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

  // --- Apply filters --- (kept for future use / UI)
  // eslint-disable-next-line no-unused-vars
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
    if (isAdmin) {
      fetchStats();
    }
    return () => controller.abort();
  }, [fetchClients, fetchStats, isAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = () => setIsDesktop(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const formatCurrency = (value) => {
    if (!value) return '0 CFA';
    return `${Number(value).toLocaleString('fr-FR')} CFA`;
  };

  const formatGender = (gender) => {
    if (!gender) return GENDER_LABELS.unknown;
    return GENDER_LABELS[gender] || GENDER_LABELS.other;
  };

  const getGenderColor = (gender) => GENDER_COLORS[gender] || GENDER_COLORS.other;

  const getGenderOrder = (gender) => {
    const index = GENDER_ORDER.indexOf(gender);
    return index === -1 ? GENDER_ORDER.length : index;
  };

  const formatPercentage = (value) =>
    typeof value === 'number' && !Number.isNaN(value) ? `${value.toFixed(1)}%` : '—';

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
      setFormData({ name: '', email: '', phone: '', address: '', gender: 'other' });
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

  const openClientDetails = (client) => {
    const path = clientPath(client);
    if (isDesktop && typeof window !== 'undefined') {
      window.open(path, '_blank', 'noopener,noreferrer');
    } else {
      navigate(path);
    }
  };

  useResponsiveTable(tableRef, [clients]);

  const renderClientList = () => (
    <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 md:p-6">
      <h2 className="sr-only">Liste des clients</h2>
      {loading ? (
        <div className="flex justify-center py-12 min-h-[200px] items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-200 border-t-blue-600" aria-hidden />
        </div>
      ) : clients.length > 0 ? (
        <>
          {/* Mobile: card list (touch-friendly, no table) */}
          <div className="md:hidden space-y-3">
            {clients.map((c) => (
              <article
                key={c._id}
                className="rounded-xl border border-gray-200 bg-gray-50/50 shadow-sm overflow-hidden active:bg-gray-100 transition-colors"
              >
                <button
                  type="button"
                  className="w-full text-left p-4 min-h-[44px] flex flex-col gap-1 touch-manipulation"
                  onClick={() => openClientDetails(c)}
                >
                  <span className="font-semibold text-gray-900 text-base">{c.name}</span>
                  <span className="text-sm text-gray-600 truncate">{c.email || '—'}</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-500 mt-0.5">
                    <span>{formatGender(c.gender)}</span>
                    <span>{c.phone || '—'}</span>
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex border-t border-gray-200 bg-white px-4 py-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClient(c);
                        setFormData({
                          name: c.name,
                          email: c.email,
                          phone: c.phone,
                          address: c.address,
                          gender: c.gender || 'other',
                        });
                        setIsFormOpen(true);
                      }}
                      className="flex-1 min-h-[44px] py-2.5 text-sm font-medium text-amber-800 bg-amber-50 rounded-xl active:bg-amber-100 touch-manipulation"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c._id)}
                      className="flex-1 min-h-[44px] py-2.5 text-sm font-medium text-red-700 bg-red-50 rounded-xl active:bg-red-100 touch-manipulation"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto w-full min-w-0">
            <table ref={tableRef} className="responsive-table w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700 font-medium text-sm">Nom</th>
                  <th className="px-4 py-3 text-left text-gray-700 font-medium text-sm">Email</th>
                  <th className="px-4 py-3 text-left text-gray-700 font-medium text-sm">Genre</th>
                  <th className="px-4 py-3 text-left text-gray-700 font-medium text-sm">Téléphone</th>
                  {isAdmin && <th className="px-4 py-3 text-right text-gray-700 font-medium text-sm">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td
                      className="px-4 py-3 cursor-pointer text-blue-600 hover:underline font-medium"
                      onClick={() => openClientDetails(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClientDetails(c); } }}
                    >
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatGender(c.gender)}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingClient(c);
                              setFormData({
                                name: c.name,
                                email: c.email,
                                phone: c.phone,
                                address: c.address,
                                gender: c.gender || 'other',
                              });
                              setIsFormOpen(true);
                            }}
                            className="px-3 py-2 text-sm bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 font-medium"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                            className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-12 px-4 text-gray-500">
          <p className="text-base">Aucun client trouvé</p>
          <p className="text-sm mt-1">Utilisez la recherche ou ajoutez un nouveau client.</p>
        </div>
      )}
    </section>
  );

  // --- Export to PDF (client-side capture) ---
  const handleExportPdf = async () => {
    if (!printRef.current) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let position = 0;
      let heightLeft = pdfHeight;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`Rapport_Clients_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF généré avec succès');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de générer le PDF');
    }
  };


  useEffect(() => {
    document.body.style.overflow = isFormOpen ? 'hidden' : 'auto';
  }, [isFormOpen]);

  const genderStats = stats?.genderDistribution
    ? [...stats.genderDistribution].sort(
        (a, b) => getGenderOrder(a.gender) - getGenderOrder(b.gender)
      )
    : [];
  const totalGenderClients = genderStats.reduce((acc, item) => acc + (item.count || 0), 0);

  // --- UI (mobile-first) ---
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4 sm:px-6 sm:py-6 md:p-6">
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto space-y-5 md:space-y-8">
        {/* Header: compact on mobile */}
        <header className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2 sm:text-2xl md:text-3xl">
              <div className="bg-blue-500 p-1.5 rounded-lg sm:p-2 sm:rounded-xl shrink-0">
                <svg className="w-5 h-5 text-white sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="truncate">Clients</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 sm:mt-1">Recherchez et gérez vos clients</p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:w-auto">
            <button
              onClick={() => {
                setIsFormOpen(true);
                setEditingClient(null);
                setFormData({ name: '', email: '', phone: '', address: '', gender: 'other' });
              }}
              className="min-h-[44px] w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-4 py-3 rounded-xl touch-manipulation sm:py-2"
            >
              + Nouveau client
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={handleExportPdf}
                  className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 active:bg-gray-100 font-medium touch-manipulation sm:py-2"
                >
                  Exporter PDF
                </button>
                <Link
                  to="/clients/dashboard"
                  className="min-h-[44px] w-full sm:w-auto flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-95 active:opacity-90 touch-manipulation sm:py-2"
                >
                  Tableau de bord
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Stats sections (admin only) — before search bar */}
        {isAdmin && stats && (
          <div ref={printRef} className="space-y-5 md:space-y-8">
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {[
                { label: 'Total clients', value: stats.totalClients },
                { label: 'Achats cumulés', value: formatCurrency(stats.totalSpent) },
                { label: 'Dépense moy.', value: formatCurrency(stats.avgSpent) },
                { label: 'Nouveaux (mois)', value: stats.newThisMonth },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm md:p-4">
                  <p className="text-xs text-gray-500 truncate md:text-sm">{stat.label}</p>
                  <p className="text-lg font-semibold text-gray-900 mt-0.5 truncate md:text-2xl md:mt-1">{String(stat.value)}</p>
                </div>
              ))}
            </section>

            {stats.topClients?.length > 0 && (
              <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 md:p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-3 md:text-lg md:mb-4">Top 5 clients</h2>
                <div className="h-56 sm:h-64 md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.topClients} dataKey="totalSpent" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {stats.topClients.map((entry, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString('fr-FR')} CFA`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 md:mt-6">
                  {stats.topClients.map((client, index) => (
                    <Link
                      key={`${client.clientId || client._id || index}-link`}
                      to={clientPath({ _id: client.clientId || client._id, slug: client.slug })}
                      className="flex items-center justify-between min-h-[44px] px-3 py-2.5 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 active:bg-blue-100 transition touch-manipulation"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-gray-400 shrink-0">#{index + 1}</span>
                        <span
                          className={`font-semibold truncate ${
                            index === 0 ? 'text-emerald-600' : index === 1 ? 'text-indigo-600' : index === 2 ? 'text-amber-600' : 'text-gray-800'
                          }`}
                        >
                          {client.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600 shrink-0 ml-2">{client.totalSpent?.toLocaleString('fr-FR')} CFA</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {genderStats.length > 0 && (
              <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 md:text-sm">Répartition par genre</p>
                    <h3 className="text-lg font-semibold text-gray-900 mt-0.5 md:text-2xl md:mt-1">
                      {totalGenderClients} client{totalGenderClients > 1 ? 's' : ''}
                    </h3>
                    <p className="text-xs text-gray-600 truncate md:text-sm">
                      {genderStats.map((entry) => formatGender(entry.gender)).join(' · ')}
                    </p>
                  </div>
                  <div className="w-28 h-28 shrink-0 md:w-40 md:h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderStats}
                          dataKey="count"
                          nameKey="gender"
                          cx="50%"
                          cy="50%"
                          innerRadius={24}
                          outerRadius={40}
                          paddingAngle={3}
                        >
                          {genderStats.map((entry) => (
                            <Cell key={entry.gender} fill={getGenderColor(entry.gender)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value} clients`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 md:gap-3 md:mt-6">
                  {genderStats.map((entry) => (
                    <div
                      key={entry.gender}
                      className="flex items-center justify-between min-h-[44px] border border-gray-100 rounded-xl px-3 py-2.5 md:px-4 md:py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 md:text-sm">{formatGender(entry.gender)}</p>
                        <p className="text-base font-semibold text-gray-900 md:text-lg">{entry.count} clients</p>
                      </div>
                      <span className="text-xs text-gray-600 shrink-0 md:text-sm">{formatPercentage(entry.percentage)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Search: full width, touch-friendly */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] sm:min-h-0 py-3 sm:py-2 px-4 border border-gray-300 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
          />
          <button
            onClick={() => fetchClients()}
            className="min-h-[44px] w-full sm:w-auto py-3 sm:py-2 px-4 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-xl touch-manipulation"
          >
            Rechercher
          </button>
        </div>

        {/* Client list */}
        <div className="space-y-5 md:space-y-8">
          {renderClientList()}
        </div>

        {/* Modal: mobile-first form */}
        <Modal
          show={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingClient(null);
          }}
          title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="sr-only">Nom</span>
              <input
                type="text"
                placeholder="Nom"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full min-h-[44px] py-3 px-4 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              />
            </label>
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full min-h-[44px] py-3 px-4 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              />
            </label>
            <label className="block">
              <span className="sr-only">Téléphone</span>
              <input
                type="text"
                inputMode="tel"
                placeholder="Téléphone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full min-h-[44px] py-3 px-4 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              />
            </label>
            <label className="block">
              <span className="sr-only">Adresse</span>
              <input
                type="text"
                placeholder="Adresse"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full min-h-[44px] py-3 px-4 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              />
            </label>
            <label className="block">
              <span className="sr-only">Genre</span>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
                className="w-full min-h-[44px] py-3 px-4 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white touch-manipulation"
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingClient(null);
                }}
                className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 active:bg-gray-300 font-medium touch-manipulation"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl touch-manipulation"
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

/* Modal: mobile-first (full height on small screens, centered on desktop) */
const Modal = ({ show, onClose, title, children }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md sm:max-h-[85vh]"
        >
          <div className="sticky top-0 bg-white flex justify-between items-center px-4 py-3 border-b border-gray-200 sm:px-6 sm:py-4 z-10">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-gray-500 hover:text-gray-700 active:text-gray-900 rounded-xl touch-manipulation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 pb-8 sm:p-6">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Clients;
