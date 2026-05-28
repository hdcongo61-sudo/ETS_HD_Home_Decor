import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { clientPath } from '../utils/paths';
import Modal from '../components/Modal';
import {
  BarChart3,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

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
const sortClientsByCreatedAt = (list) =>
  [...list].sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
const isCanceledRequest = (err) =>
  err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';
const readClientSearchFromUrl = (search) => new URLSearchParams(search || '').get('search') || '';
const buildClientSearchUrl = (currentSearch, searchTerm) => {
  const params = new URLSearchParams(currentSearch || '');
  const value = String(searchTerm || '').trim();
  if (value) {
    params.set('search', value);
  } else {
    params.delete('search');
  }
  const next = params.toString();
  return next ? `?${next}` : '';
};

const Clients = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = auth.user?.isAdmin || false;
  const navigate = useNavigate();
  const location = useLocation();

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
  const [searchTerm, setSearchTerm] = useState(() => readClientSearchFromUrl(location.search));
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
      setStats(data && typeof data === 'object' ? data : null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Erreur stats:', err);
      const msg = err.isHtmlResponse ? err.message : "Impossible de charger les statistiques";
      toast.error(msg);
    }
  }, []);

  // --- Fetch clients ---
  const fetchClients = useCallback(async (signal, options = {}) => {
    const { showLoading = true } = options;
    try {
      if (showLoading) setLoading(true);
      const { data } = await api.get('/clients', { params: { search: searchTerm }, signal });
      const list = data && (Array.isArray(data.clients) ? data.clients : Array.isArray(data) ? data : []);
      setClients(list);
    } catch (err) {
      if (!isCanceledRequest(err)) {
        console.error('Erreur clients:', err);
        const msg = err.isHtmlResponse ? err.message : 'Erreur lors du chargement des clients';
        toast.error(msg);
      }
    } finally {
      if (showLoading && !signal?.aborted) setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const nextSearchTerm = readClientSearchFromUrl(location.search);
    setSearchTerm((current) => (current === nextSearchTerm ? current : nextSearchTerm));
  }, [location.search]);

  useEffect(() => {
    const nextSearch = buildClientSearchUrl(location.search, searchTerm);
    if (nextSearch !== location.search) {
      navigate(
        { pathname: location.pathname, search: nextSearch },
        { replace: true, state: location.state }
      );
    }
  }, [location.pathname, location.search, location.state, navigate, searchTerm]);

  // --- Apply filters --- (kept for future use / UI)
  // eslint-disable-next-line no-unused-vars
  const applyFilters = async () => {
    try {
      setFiltering(true);
      const { data } = await api.get('/clients/filter', { params: filters });
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.clients) ? data.clients : []);
      setClients(list);
      toast.success('Filtres appliqués');
    } catch (err) {
      console.error('Erreur filtre:', err);
      setClients([]);
      const msg = err.isHtmlResponse ? err.message : 'Erreur lors du filtrage';
      toast.error(msg);
    } finally {
      setFiltering(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchTimeoutId = window.setTimeout(() => {
      fetchClients(controller.signal, { showLoading: !searchTerm.trim() });
    }, searchTerm.trim() ? 250 : 0);
    let statsTimeoutId = null;
    if (isAdmin) {
      statsTimeoutId = window.setTimeout(() => {
        fetchStats();
      }, 250);
    }
    return () => {
      window.clearTimeout(fetchTimeoutId);
      controller.abort();
      if (statsTimeoutId !== null) {
        window.clearTimeout(statsTimeoutId);
      }
    };
  }, [fetchClients, fetchStats, isAdmin, searchTerm]);

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

  const matchesClientSearch = useCallback((client) => {
    const target = searchTerm.trim().toLowerCase();
    if (!target) return true;
    return [client?.name, client?.email, client?.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(target));
  }, [searchTerm]);

  // --- Add or Edit client ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        const { data } = await api.put(`/clients/${editingClient._id}`, formData);
        setClients((prev) => {
          const next = prev.filter((client) => client._id !== editingClient._id);
          if (matchesClientSearch(data)) {
            next.unshift(data);
          }
          return sortClientsByCreatedAt(next);
        });
        toast.success('✅ Client mis à jour avec succès');
      } else {
        const { data } = await api.post('/clients', formData);
        if (matchesClientSearch(data)) {
          setClients((prev) => sortClientsByCreatedAt([data, ...prev]));
        }
        toast.success('✅ Client ajouté avec succès');
      }
      setIsFormOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '', gender: 'other' });
      setEditingClient(null);
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
      setClients((prev) => prev.filter((client) => client._id !== id));
      toast.success('🗑️ Client supprimé avec succès');
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const openClientDetails = (client) => {
    const path = clientPath(client);
    const returnToClients = `${location.pathname}${location.search}`;
    const detailSearch = `?returnToClients=${encodeURIComponent(returnToClients)}`;
    if (isDesktop && typeof window !== 'undefined') {
      window.open(`${path}${detailSearch}`, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`${path}${detailSearch}`, { state: { returnToClients } });
    }
  };

  useResponsiveTable(tableRef, [clients]);

  const renderClientList = () => (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
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
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-colors active:bg-slate-100"
              >
                <button
                  type="button"
                  className="flex min-h-[44px] w-full flex-col gap-1 p-4 text-left touch-manipulation"
                  onClick={() => openClientDetails(c)}
                >
                  <span className="text-base font-semibold text-slate-950">{c.name}</span>
                  <span className="truncate text-sm text-slate-600">{c.email || '—'}</span>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-500">
                    <span>{formatGender(c.gender)}</span>
                    <span>{c.phone || '—'}</span>
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex gap-2 border-t border-slate-200 bg-white px-4 py-3">
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
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-slate-100 py-2.5 text-sm font-medium text-slate-700 touch-manipulation active:bg-slate-200"
                    >
                      <Edit3 className="h-4 w-4" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c._id)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-rose-50 py-2.5 text-sm font-medium text-rose-700 touch-manipulation active:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
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
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Nom</th>
                  <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Email</th>
                  <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Genre</th>
                  <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Téléphone</th>
                  {isAdmin && <th className="px-4 py-3 text-right text-slate-600 font-medium text-sm">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                    <td
                      className="px-4 py-3 cursor-pointer text-slate-950 hover:text-slate-700 font-medium"
                      onClick={() => openClientDetails(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClientDetails(c); } }}
                    >
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatGender(c.gender)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
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
                            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >
                            <Edit3 className="h-4 w-4" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                            className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
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
        <div className="px-4 py-12 text-center text-slate-500">
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
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
    <div className="min-h-screen bg-[#f6f7f9] px-3 py-4 sm:px-5 sm:py-6 md:p-6">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-7xl space-y-5 md:space-y-6">
        {/* Header: compact on mobile */}
        <header className="flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-slate-500">Relation client</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
              <div className="shrink-0 rounded-2xl bg-slate-100 p-2 text-slate-700">
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <span className="truncate">Clients</span>
            </h1>
            <p className="mt-1 text-sm text-slate-600">Recherchez, gérez et suivez les profils clients.</p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:w-auto">
            <button
              onClick={() => {
                setIsFormOpen(true);
                setEditingClient(null);
                setFormData({ name: '', email: '', phone: '', address: '', gender: 'other' });
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 font-medium text-white touch-manipulation transition hover:bg-slate-700 sm:w-auto sm:py-2"
            >
              <Plus className="h-4 w-4" />
              Nouveau client
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={handleExportPdf}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 touch-manipulation transition hover:bg-slate-50 sm:w-auto sm:py-2"
                >
                  <Download className="h-4 w-4" />
                  Exporter PDF
                </button>
                <Link
                  to="/clients/dashboard"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 touch-manipulation transition hover:bg-slate-50 sm:w-auto sm:py-2"
                >
                  <BarChart3 className="h-4 w-4" />
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
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm md:p-4">
                  <p className="truncate text-xs text-slate-500 md:text-sm">{stat.label}</p>
                  <p className="mt-0.5 truncate text-lg font-semibold text-slate-950 md:mt-1 md:text-2xl">{String(stat.value)}</p>
                </div>
              ))}
            </section>

            {stats.topClients?.length > 0 && (
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <h2 className="mb-3 text-base font-semibold text-slate-950 md:mb-4 md:text-lg">Top 5 clients</h2>
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
                      to={`${clientPath({ _id: client.clientId || client._id, slug: client.slug })}?returnToClients=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                      state={{ returnToClients: `${location.pathname}${location.search}` }}
                      className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 transition touch-manipulation hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-xs font-semibold text-slate-400">#{index + 1}</span>
                        <span
                          className={`font-semibold truncate ${
                            index === 0 ? 'text-emerald-700' : index === 1 ? 'text-slate-900' : index === 2 ? 'text-amber-700' : 'text-slate-800'
                          }`}
                        >
                          {client.name}
                        </span>
                      </div>
                      <span className="ml-2 shrink-0 text-sm text-slate-600">{client.totalSpent?.toLocaleString('fr-FR')} CFA</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {genderStats.length > 0 && (
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 md:text-sm">Répartition par genre</p>
                    <h3 className="mt-0.5 text-lg font-semibold text-slate-950 md:mt-1 md:text-2xl">
                      {totalGenderClients} client{totalGenderClients > 1 ? 's' : ''}
                    </h3>
                    <p className="truncate text-xs text-slate-600 md:text-sm">
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
                      className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 md:px-4 md:py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 md:text-sm">{formatGender(entry.gender)}</p>
                        <p className="text-base font-semibold text-slate-950 md:text-lg">{entry.count} clients</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-600 md:text-sm">{formatPercentage(entry.percentage)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Search: full width, touch-friendly */}
        <div className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-3 pl-9 text-base text-slate-950 outline-none placeholder:text-slate-400 touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 sm:min-h-0 sm:py-2"
            />
          </div>
          <button
            onClick={() => fetchClients()}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 font-medium text-white touch-manipulation transition hover:bg-slate-700 sm:w-auto sm:py-2"
          >
            <RefreshCw className="h-4 w-4" />
            Rechercher
          </button>
        </div>

        {/* Client list */}
        <div className="space-y-5 md:space-y-8">
          {renderClientList()}
        </div>

        {/* Modal: mobile-first form */}
        <Modal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingClient(null);
          }}
          title={editingClient ? 'Modifier le client' : 'Nouveau client'}
          size="sm"
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
                className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="sr-only">Adresse</span>
              <input
                type="text"
                placeholder="Adresse"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="sr-only">Genre</span>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none touch-manipulation transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                className="min-h-[44px] w-full rounded-full bg-slate-100 px-4 py-3 font-medium text-slate-700 touch-manipulation hover:bg-slate-200 active:bg-slate-300 sm:w-auto"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-full bg-slate-900 px-4 py-3 font-medium text-white touch-manipulation hover:bg-slate-700 active:bg-slate-800 sm:w-auto"
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

export default Clients;
