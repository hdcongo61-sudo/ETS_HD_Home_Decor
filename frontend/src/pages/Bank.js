import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import useResponsiveTable from '../hooks/useResponsiveTable';
import AppLoader from '../components/AppLoader';
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  SearchBox,
  StatusBadge,
  Workspace,
} from '../components/business';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Landmark,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';

const Bank = () => {
  const tableRef = useRef(null);
  const [transactions, setTransactions] = useState([]);
  const [formData, setFormData] = useState({
    type: 'deposit',
    amount: '',
    label: ''
  });
  const [filters, setFilters] = useState({
    search: '',
    type: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.type) params.append('type', filters.type);
      const res = await api.get(`/bank?${params.toString()}`);
      setTransactions(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors du chargement des mouvements");
    } finally {
      setLoading(false);
    }
  };

  const matchesTransactionFilter = (transaction) => {
    if (!transaction) return false;
    const search = filters.search.trim().toLowerCase();
    const searchMatch = !search || String(transaction.label || '').toLowerCase().includes(search);
    const typeMatch = !filters.type || transaction.type === filters.type;
    return searchMatch && typeMatch;
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch on filters change only
  }, [filters]);

  const stats = useMemo(() => {
    const base = transactions.reduce(
      (acc, t) => {
        if (t.type === 'deposit') acc.deposits += t.amount || 0;
        if (t.type === 'withdraw') acc.withdrawals += t.amount || 0;
        acc.count += 1;
        return acc;
      },
      { deposits: 0, withdrawals: 0, count: 0 }
    );
    return {
      ...base,
      balance: base.deposits - base.withdrawals
    };
  }, [transactions]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amount = Number(formData.amount);
    if (!formData.label.trim()) {
      setError('Le libelle est requis');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Le montant doit etre superieur a 0');
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await api.post('/bank', {
        type: formData.type,
        amount,
        label: formData.label.trim()
      });
      setFormData({ type: 'deposit', amount: '', label: '' });
      if (matchesTransactionFilter(data)) {
        setTransactions((prev) =>
          [data, ...prev].sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  useResponsiveTable(tableRef, [transactions]);

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Caisse personnelle"
        description="Dépôts et retraits visibles uniquement par vous"
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Dépôts"
          value={`${stats.deposits.toLocaleString('fr-FR')} CFA`}
          tone="success"
          icon={<ArrowDownCircle className="h-4 w-4" />}
        />
        <KPICard
          title="Retraits"
          value={`${stats.withdrawals.toLocaleString('fr-FR')} CFA`}
          tone="danger"
          icon={<ArrowUpCircle className="h-4 w-4" />}
        />
        <KPICard
          title="Solde"
          value={`${stats.balance.toLocaleString('fr-FR')} CFA`}
          tone={stats.balance >= 0 ? 'neutral' : 'danger'}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KPICard
          title="Mouvements"
          value={stats.count.toLocaleString('fr-FR')}
          tone="neutral"
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      {/* New Transaction Form */}
      <section className="ms-surface p-5">
        <h2 className="ms-section-title mb-4">Nouveau mouvement</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label block mb-1">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="form-control"
            >
              <option value="deposit">Dépôt</option>
              <option value="withdraw">Retrait</option>
            </select>
          </div>
          <div>
            <label className="form-label block mb-1">Montant</label>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={handleChange}
              className="form-control"
              placeholder="0"
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label block mb-1">Libellé</label>
            <input
              type="text"
              name="label"
              value={formData.label}
              onChange={handleChange}
              className="form-control"
              placeholder="Ex: Approvisionnement caisse"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Enregistrement...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </section>

      {/* History */}
      <section className="ms-surface">
        <CommandBar>
          <h2 className="ms-section-title">Historique</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBox
              label="Rechercher un libellé"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Rechercher un libellé..."
            />
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              className="form-control max-w-[160px]"
            >
              <option value="">Tous</option>
              <option value="deposit">Dépôts</option>
              <option value="withdraw">Retraits</option>
            </select>
          </div>
        </CommandBar>

        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="Aucun mouvement enregistré"
            description="Ajoutez votre premier dépôt ou retrait ci-dessus."
          />
        ) : (
          <DataTable>
            <table ref={tableRef} className="responsive-table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Type</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id}>
                    <td className="text-[var(--ms-text-muted)] text-xs">{formatDateTime(t.createdAt)}</td>
                    <td className="font-medium">{t.label}</td>
                    <td>
                      <StatusBadge tone={t.type === 'deposit' ? 'success' : 'danger'}>
                        {t.type === 'deposit' ? 'Dépôt' : 'Retrait'}
                      </StatusBadge>
                    </td>
                    <td className={`text-right font-semibold ${t.type === 'deposit' ? 'text-[var(--ms-success)]' : 'text-[var(--ms-danger)]'}`}>
                      {Number(t.amount || 0).toLocaleString('fr-FR')} CFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        )}
      </section>
    </Workspace>
  );
};

export default Bank;
