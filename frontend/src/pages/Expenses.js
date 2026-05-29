import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

const legacyCategoryLabels = {
  rent: 'Loyer',
  utilities: 'Services',
  salaries: 'Salaires',
  supplies: 'Fournitures',
  delivery: 'Livraison',
  other: 'Autre'
};
const categoryPalette = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#a855f7', '#14b8a6', '#f97316'];
const categoryDotClasses = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500'];
const categoryBadgeClasses = ['bg-red-100 text-red-800', 'bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-amber-100 text-amber-800', 'bg-indigo-100 text-indigo-800', 'bg-purple-100 text-purple-800', 'bg-teal-100 text-teal-800', 'bg-orange-100 text-orange-800'];
const categoryIndex = (category) => {
  const normalized = String(category || '');
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash + normalized.charCodeAt(i)) % categoryPalette.length;
  }
  return hash;
};
const getCategoryLabel = (category) => legacyCategoryLabels[category] || category || 'Non catégorisé';
const getCategoryColor = (category) => categoryPalette[categoryIndex(category)];
const getCategoryDotClass = (category) => categoryDotClasses[categoryIndex(category)];
const getCategoryBadgeClass = (category) => categoryBadgeClasses[categoryIndex(category)] || 'bg-gray-100 text-gray-800';
const formatSalaryPeriod = (expense) => {
  if (!expense?.salaryMonth || !expense?.salaryYear) return '';
  return new Date(expense.salaryYear, expense.salaryMonth - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
};

const Expenses = () => {
  const tableRef = useRef(null);
  const formSectionRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [filter, setFilter] = useState({
    search: '',
    startDate: '',
    endDate: '',
    category: ''
  });
  const [editingExpense, setEditingExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchExpenses uses filter
  }, [filter]);

  useEffect(() => {
    const fetchExpenseCategories = async () => {
      try {
        const { data } = await api.get('/lookups/expense-categories');
        setExpenseCategories(Array.isArray(data) ? data : []);
      } catch {
        setExpenseCategories([]);
      }
    };

    fetchExpenseCategories();
  }, []);

  const fetchExpenses = async () => {
    try {
      if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) {
        setError('La date de début doit être avant la date de fin');
        return;
      }

      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        search: filter.search,
        startDate: filter.startDate,
        endDate: filter.endDate,
        category: filter.category
      });

      const response = await api.get(`/expenses?${params.toString()}`);
      setExpenses(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de chargement des dépenses');
    } finally {
      setLoading(false);
    }
  };

  const matchesExpenseFilter = (expense) => {
    if (!expense) return false;
    const expenseDate = expense.date ? new Date(expense.date) : null;
    const startDate = filter.startDate ? new Date(filter.startDate) : null;
    const endDate = filter.endDate ? new Date(filter.endDate) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);
    const search = filter.search.trim().toLowerCase();
    const searchMatch = !search || [expense.description, expense.paymentMethod, expense.employee?.name, expense.employee?.position]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
    const categoryMatch = !filter.category || expense.category === filter.category;
    const startMatch = !startDate || (expenseDate && expenseDate >= startDate);
    const endMatch = !endDate || (expenseDate && expenseDate <= endDate);
    return searchMatch && categoryMatch && startMatch && endMatch;
  };

  const handleSubmit = async (expenseData) => {
    try {
      setError('');
      setSubmitting(true);

      if (editingExpense) {
        const { data } = await api.put(`/expenses/${editingExpense._id}`, expenseData);
        setExpenses((prev) => {
          const next = prev.filter((expense) => expense._id !== editingExpense._id);
          if (matchesExpenseFilter(data)) {
            next.unshift(data);
          }
          return next.sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime());
        });
        setEditingExpense(null);
      } else {
        const { data } = await api.post('/expenses', expenseData);
        if (matchesExpenseFilter(data)) {
          setExpenses((prev) =>
            [data, ...prev].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
          );
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    confirmAlert({
      title: 'Confirmer la suppression',
      message: 'Êtes-vous sûr de vouloir supprimer cette dépense ?',
      buttons: [
        {
          label: 'Oui',
          onClick: async () => {
            try {
              setError('');
              await api.delete(`/expenses/${id}`);
              setExpenses((prev) => prev.filter((expense) => expense._id !== id));
            } catch (err) {
              setError(err.response?.data?.message || 'Erreur de suppression');
            }
          }
        },
        { label: 'Non' }
      ]
    });
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Calcul des données pour le tableau de bord
  const dashboardData = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    const mostExpensive = expenses.length
      ? expenses.reduce((max, expense) =>
        expense.amount > max.amount ? expense : max
      )
      : null;

    return {
      total,
      categoryTotals,
      mostExpensive,
      count: expenses.length,
      average: expenses.length ? total / expenses.length : 0
    };
  }, [expenses]);

  const formatUser = (user) => {
    if (!user) return '—';
    return user.name || user.email || '—';
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('fr-FR');
  };

  const categoryFilterOptions = useMemo(() => {
    const names = expenseCategories.map((category) => category.name).filter(Boolean);
    const usedCategories = expenses.map((expense) => expense.category).filter(Boolean);
    return [...new Set([...names, ...usedCategories])].sort((a, b) =>
      getCategoryLabel(a).localeCompare(getCategoryLabel(b), 'fr', { sensitivity: 'base' })
    );
  }, [expenseCategories, expenses]);

  useResponsiveTable(tableRef, [expenses]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] border border-red-100 bg-red-50 text-red-700 shadow-inner">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Caisse & charges</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">Gestion des dépenses</h1>
              <p className="mt-1 text-sm text-gray-500">Suivi des sorties, salaires, catégories et historique de paiement.</p>
            </div>
          </div>
          <a
            href="#expense-form-section"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-gray-800"
          >
            Nouvelle dépense
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 shadow-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Tableau de bord */}
      <section className="rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-950 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Tableau de bord
        </h2>
          <p className="text-sm text-gray-500">Vue rapide des dépenses correspondant aux filtres actifs.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Carte: Total dépensé */}
          <StatCard
            title="Total dépensé"
            value={`${dashboardData.total.toLocaleString('fr-FR')} CFA`}
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            color="blue"
          />

          {/* Carte: Nombre de dépenses */}
          <StatCard
            title="Nombre de dépenses"
            value={dashboardData.count}
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            color="green"
          />

          {/* Carte: Dépense moyenne */}
          <StatCard
            title="Dépense moyenne"
            value={`${dashboardData.average.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} CFA`}
            icon="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
            color="orange"
          />

          {/* Carte: Dépense la plus élevée */}
          <StatCard
            title="Dépense max"
            value={dashboardData.mostExpensive ? `${dashboardData.mostExpensive.amount.toLocaleString('fr-FR')} CFA` : 'Aucune'}
            icon="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
            color="red"
          />
        </div>

        {/* Graphique de répartition */}
        <div className="mt-5 rounded-[24px] border border-gray-200 bg-gray-50/80 p-4 sm:p-5">
          <h3 className="text-gray-700 text-sm font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Répartition par catégorie
          </h3>

          {dashboardData.total > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Diagramme circulaire */}
            <div className="flex justify-center">
              <div className="relative w-56 h-56">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {Object.entries(dashboardData.categoryTotals).map(([category, total], index, arr) => {
                    const percentage = (total / dashboardData.total) * 100;
                    const offset = arr.slice(0, index).reduce((sum, [, val]) =>
                      sum + (val / dashboardData.total) * 100, 0
                    );

                    return (
                      <circle
                        key={category}
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                        stroke={getCategoryColor(category)}
                        strokeWidth="10"
                        strokeDasharray={`${percentage} ${100 - percentage}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 50 50)"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-semibold text-gray-900">
                    {dashboardData.total > 0
                      ? `${Math.round(dashboardData.total / 1000)}K CFA`
                      : '0 CFA'}
                  </span>
                </div>
              </div>
            </div>

            {/* Légende et détails */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="space-y-3">
                {Object.entries(dashboardData.categoryTotals).map(([category, total]) => {
                  const percentage = (total / dashboardData.total) * 100;

                  return (
                    <div key={category} className="flex items-center">
                      <div className={`w-4 h-4 rounded-full ${getCategoryDotClass(category)} mr-3`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-900">
                            {getCategoryLabel(category)}
                          </span>
                          <span className="font-semibold text-gray-900">{total.toLocaleString('fr-FR')} CFA</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: getCategoryColor(category)
                            }}
                          ></div>
                        </div>
                        <div className="text-right text-xs text-gray-500 mt-1">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-700">Aucune donnée à répartir</p>
              <p className="mt-1 text-sm text-gray-500">Ajoutez une dépense ou élargissez vos filtres.</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section ref={formSectionRef} id="expense-form-section" className="scroll-mt-24 rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-5">
          <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-gray-950 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
          </h2>
            <p className="text-sm text-gray-500">
              {editingExpense ? 'Mettez à jour les informations enregistrées.' : 'Ajoutez une sortie avec sa catégorie et son mode de paiement.'}
            </p>
          </div>
          <ExpenseForm
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
            submitting={submitting}
            initialData={editingExpense}
          />
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-5 lg:col-span-2">
          <div className="mb-6">
            <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-gray-950 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Historique des dépenses
            </h2>
              <p className="text-sm text-gray-500">Filtrez par texte, période ou catégorie.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-[24px] border border-gray-200 bg-gray-50/80 p-3 md:grid-cols-5">
              <input
                type="text"
                placeholder="Rechercher..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="min-h-[44px] rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
              />
              <input
                type="date"
                value={filter.startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="min-h-[44px] rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
              />
              <input
                type="date"
                value={filter.endDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="min-h-[44px] rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
              />
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="min-h-[44px] rounded-2xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-gray-400 focus:ring-4 focus:ring-gray-900/5"
              >
                <option value="">Toutes catégories</option>
                {categoryFilterOptions.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setFilter({ search: '', startDate: '', endDate: '', category: '' })}
                className="min-h-[44px] rounded-2xl bg-gray-950 px-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="font-semibold text-sm">Total dépensé :</span>
                </div>
                <span className="text-lg font-semibold text-blue-600">
                  {dashboardData.total.toLocaleString('fr-FR')} CFA
                </span>
              </div>

              {expenses.length === 0 && !loading && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-700">Aucune dépense trouvée</p>
                  <p className="mt-1 text-sm text-gray-500">Ajustez les filtres ou créez une nouvelle dépense.</p>
                </div>
              )}

              {expenses.length > 0 && (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table ref={tableRef} className="responsive-table w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="transition-colors hover:bg-gray-50">
                        <td data-title="Date" className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                          {formatDateTime(expense.date)}
                        </td>
                        <td data-title="Description" className="px-4 sm:px-6 py-4">
                          <div className="text-sm sm:text-base text-gray-900 font-medium">{expense.description}</div>
                          {(expense.createdBy || expense.updatedBy) && (
                            <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                              {expense.createdBy && (
                                <div>Créé par {formatUser(expense.createdBy)}{formatDateTime(expense.createdAt) ? ` · ${formatDateTime(expense.createdAt)}` : ''}</div>
                              )}
                              {expense.updatedBy && (
                                <div>Modifié par {formatUser(expense.updatedBy)}{formatDateTime(expense.updatedAt) ? ` · ${formatDateTime(expense.updatedAt)}` : ''}</div>
                              )}
                            </div>
                          )}
                          {expense.employee && (
                            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
                              <span className="font-semibold">Salaire :</span> {expense.employee.name}
                              {formatSalaryPeriod(expense) ? ` · ${formatSalaryPeriod(expense)}` : ''}
                            </div>
                          )}
                        </td>
                        <td data-title="Montant" className="px-4 sm:px-6 py-4 text-base sm:text-sm font-semibold text-gray-900 tabular-nums">
                          {expense.amount.toLocaleString('fr-FR')} CFA
                        </td>
                        <td data-title="Catégorie" className="px-4 sm:px-6 py-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryBadgeClass(expense.category)}`}>
                            {getCategoryLabel(expense.category)}
                          </span>
                        </td>
                        <td data-title="Paiement" className="px-4 sm:px-6 py-4 text-sm text-gray-900 capitalize">
                          {expense.paymentMethod}
                        </td>
                        <td data-title="Actions" className="px-4 sm:px-6 py-4">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleEdit(expense)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 hover:text-gray-900 rounded-2xl hover:bg-gray-100 touch-manipulation"
                              aria-label="Modifier"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(expense._id)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-600 hover:text-red-800 rounded-2xl hover:bg-red-50 touch-manipulation"
                              aria-label="Supprimer"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </section>
      </div>
      </div>
    </div>
  );
};

// StatCard Component with Apple Design
const StatCard = ({ title, value, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colors.bg}`}>
          <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
          <p className="mt-1 break-words text-lg font-semibold text-gray-950">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
