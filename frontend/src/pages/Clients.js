import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { clientPath } from '../utils/paths';
import {
  Button,
  ChartCard,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  RightDetailPanel,
  SearchBox,
  StatusBadge,
  Workspace,
} from '../components/business';
import {
  BarChart3,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';

const COLORS = ['#0078D4', '#107C10', '#FFB900', '#D13438', '#605E5C'];
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
  male: '#0078D4',
  female: '#D13438',
  other: '#107C10',
  unknown: '#605E5C'
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
    <DataTable>
      <h2 className="sr-only">Liste des clients</h2>
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : clients.length > 0 ? (
        <>
          {/* Mobile: card list (touch-friendly, no table) */}
          <div className="space-y-3 p-3 md:hidden">
            {clients.map((c) => (
              <article
                key={c._id}
                className="overflow-hidden rounded-lg border border-[var(--ms-border)] bg-white shadow-[var(--ms-shadow-sm)] transition-colors active:bg-[var(--ms-bg-subtle)]"
              >
                <button
                  type="button"
                  className="flex min-h-[44px] w-full flex-col gap-1 p-4 text-left touch-manipulation"
                  onClick={() => openClientDetails(c)}
                >
                  <span className="text-base font-semibold text-[var(--ms-text-strong)]">{c.name}</span>
                  <span className="truncate text-sm text-[var(--ms-text-muted)]">{c.email || '—'}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--ms-text-muted)]">
                    <StatusBadge tone="neutral">{formatGender(c.gender)}</StatusBadge>
                    <span>{c.phone || '—'}</span>
                  </div>
                </button>
                {isAdmin && (
                  <div className="flex gap-2 border-t border-[var(--ms-border)] bg-[var(--ms-bg)] px-4 py-3">
                    <Button
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
                      className="flex-1"
                    >
                      <Edit3 className="h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => handleDelete(c._id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto w-full min-w-0">
            <table ref={tableRef}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Genre</th>
                  <th>Téléphone</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c._id}>
                    <td
                      className="cursor-pointer font-semibold text-[var(--ms-text-strong)] hover:text-[var(--ms-blue)]"
                      onClick={() => openClientDetails(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClientDetails(c); } }}
                    >
                      {c.name}
                    </td>
                    <td>{c.email || '—'}</td>
                    <td><StatusBadge tone="neutral">{formatGender(c.gender)}</StatusBadge></td>
                    <td>{c.phone || '—'}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
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
                          >
                            <Edit3 className="h-4 w-4" />
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
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
        <EmptyState title="Aucun client trouvé" description="Utilisez la recherche ou ajoutez un nouveau client." />
      )}
    </DataTable>
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

  return (
    <Workspace>
      <Toaster position="top-center" />

      <PageHeader
        eyebrow="Relation client"
        title="Clients"
        description="Recherchez, gérez et suivez les profils clients."
        meta={`${clients.length} client${clients.length > 1 ? 's' : ''} affiché${clients.length > 1 ? 's' : ''}`}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setIsFormOpen(true);
              setEditingClient(null);
              setFormData({ name: '', email: '', phone: '', address: '', gender: 'other' });
            }}
          >
            <Plus className="h-4 w-4" />
            Nouveau client
          </Button>
        }
      />

      {isAdmin && stats && (
        <div ref={printRef} className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard title="Total clients" value={stats.totalClients} context="Portefeuille client" icon={<Users className="h-4 w-4" />} />
            <KPICard title="Achats cumulés" value={formatCurrency(stats.totalSpent)} context="Historique global" icon={<BarChart3 className="h-4 w-4" />} tone="success" />
            <KPICard title="Dépense moyenne" value={formatCurrency(stats.avgSpent)} context="Par client" icon={<BarChart3 className="h-4 w-4" />} />
            <KPICard title="Nouveaux" value={stats.newThisMonth} context="Ce mois" icon={<Users className="h-4 w-4" />} tone="warning" />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            {stats.topClients?.length > 0 && (
              <ChartCard title="Top 5 clients" description="Classement par achats cumulés">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.topClients} dataKey="totalSpent" nameKey="name" cx="50%" cy="50%" outerRadius={82} label>
                        {stats.topClients.map((entry, i) => (
                          <Cell key={entry.clientId || entry._id || i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString('fr-FR')} CFA`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {stats.topClients.map((client, index) => (
                    <Link
                      key={`${client.clientId || client._id || index}-link`}
                      to={`${clientPath({ _id: client.clientId || client._id, slug: client.slug })}?returnToClients=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                      state={{ returnToClients: `${location.pathname}${location.search}` }}
                      className="flex min-h-[40px] items-center justify-between rounded-md border border-[var(--ms-border)] px-3 py-2 text-sm transition hover:border-[var(--ms-blue)] hover:bg-[var(--ms-bg)]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <StatusBadge tone={index === 0 ? 'success' : 'neutral'}>#{index + 1}</StatusBadge>
                        <span className="truncate font-semibold text-[var(--ms-text-strong)]">{client.name}</span>
                      </div>
                      <span className="ml-2 shrink-0 text-[var(--ms-text-muted)]">{client.totalSpent?.toLocaleString('fr-FR')} CFA</span>
                    </Link>
                  ))}
                </div>
              </ChartCard>
            )}

            {genderStats.length > 0 && (
              <ChartCard
                title="Répartition par genre"
                description={`${totalGenderClients} client${totalGenderClients > 1 ? 's' : ''}`}
              >
                <div className="grid gap-4 md:grid-cols-[160px_1fr] md:items-center">
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderStats}
                          dataKey="count"
                          nameKey="gender"
                          cx="50%"
                          cy="50%"
                          innerRadius={34}
                          outerRadius={58}
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
                  <div className="grid gap-2 sm:grid-cols-2">
                    {genderStats.map((entry) => (
                      <div
                        key={entry.gender}
                        className="flex min-h-[44px] items-center justify-between rounded-md border border-[var(--ms-border)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--ms-text-muted)]">{formatGender(entry.gender)}</p>
                          <p className="font-semibold text-[var(--ms-text-strong)]">{entry.count} clients</p>
                        </div>
                        <span className="shrink-0 text-sm text-[var(--ms-text-muted)]">{formatPercentage(entry.percentage)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            )}
          </div>
        </div>
      )}

      <CommandBar>
        <div className="min-w-0 flex-1">
          <SearchBox
            label="Rechercher un client"
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => fetchClients()}>
            <RefreshCw className="h-4 w-4" />
            Rechercher
          </Button>
          {isAdmin && (
            <>
              <Button type="button" size="sm" onClick={handleExportPdf}>
                <Download className="h-4 w-4" />
                Exporter PDF
              </Button>
              <Link to="/clients/dashboard" className="ms-button ms-button-secondary ms-button-sm">
                <BarChart3 className="h-4 w-4" />
                Tableau de bord
              </Link>
            </>
          )}
        </div>
      </CommandBar>

      {renderClientList()}

      <RightDetailPanel
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingClient(null);
        }}
        title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        subtitle={editingClient ? 'Mettez à jour le profil client.' : 'Ajoutez un nouveau profil client au portefeuille.'}
        footer={
          <>
            <Button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingClient(null);
              }}
            >
              Annuler
            </Button>
            <Button type="submit" form="client-form" variant="primary">
              {editingClient ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <form id="client-form" onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="form-label mb-1.5 block">Nom</span>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="form-label mb-1.5 block">Email</span>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="form-label mb-1.5 block">Téléphone</span>
            <input
              type="text"
              inputMode="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="form-label mb-1.5 block">Adresse</span>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="form-control"
            />
          </label>
          <label className="block">
            <span className="form-label mb-1.5 block">Genre</span>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              required
              className="form-control"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>
      </RightDetailPanel>
    </Workspace>
  );
};

export default Clients;
