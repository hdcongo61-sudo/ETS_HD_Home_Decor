import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const Bank = () => {
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

  useEffect(() => {
    fetchTransactions();
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
      await api.post('/bank', {
        type: formData.type,
        amount,
        label: formData.label.trim()
      });
      setFormData({ type: 'deposit', amount: '', label: '' });
      fetchTransactions();
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-500 p-2 rounded-xl">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Caisse personnelle</h1>
          <p className="text-sm text-gray-500">Depots et retraits visibles uniquement par vous.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Depots" value={`${stats.deposits.toLocaleString('fr-FR')} CFA`} color="emerald" />
        <StatCard title="Retraits" value={`${stats.withdrawals.toLocaleString('fr-FR')} CFA`} color="rose" />
        <StatCard title="Solde" value={`${stats.balance.toLocaleString('fr-FR')} CFA`} color="indigo" />
        <StatCard title="Mouvements" value={stats.count.toLocaleString('fr-FR')} color="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau mouvement</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="deposit">Depot</option>
              <option value="withdraw">Retrait</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="0"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Libelle</label>
            <input
              type="text"
              name="label"
              value={formData.label}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: Approvisionnement caisse"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-xl text-white ${
                submitting ? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Historique</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Rechercher un libelle..."
              className="px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tous</option>
              <option value="deposit">Depots</option>
              <option value="withdraw">Retraits</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-gray-500 py-10">Aucun mouvement enregistre.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-emerald-50 text-emerald-700 uppercase text-xs">
                <tr>
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Libelle</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t._id} className="border-b last:border-0 hover:bg-emerald-50/40">
                    <td className="py-2 px-3 text-gray-600">{formatDateTime(t.createdAt)}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">{t.label}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          t.type === 'deposit'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {t.type === 'deposit' ? 'Depot' : 'Retrait'}
                      </span>
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        t.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {Number(t.amount || 0).toLocaleString('fr-FR')} CFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color }) => {
  const colorMap = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    indigo: 'text-indigo-600',
    amber: 'text-amber-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-xl font-semibold ${colorMap[color] || 'text-gray-700'}`}>
        {value}
      </p>
    </div>
  );
};

export default Bank;
