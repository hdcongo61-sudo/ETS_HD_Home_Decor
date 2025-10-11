import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
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
  }, [filter]);

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

  const handleSubmit = async (expenseData) => {
    try {
      setError('');
      setSubmitting(true);

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, expenseData);
        setEditingExpense(null);
      } else {
        await api.post('/expenses', expenseData);
      }

      fetchExpenses();
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
              fetchExpenses();
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Couleurs pour les catégories
  const categoryColors = {
    rent: 'bg-red-500',
    utilities: 'bg-blue-500',
    salaries: 'bg-green-500',
    supplies: 'bg-yellow-500',
    other: 'bg-purple-500'
  };

  const categoryBarColors = {
    rent: '#ef4444',
    utilities: '#3b82f6',
    salaries: '#10b981',
    supplies: '#f59e0b',
    other: '#a855f7'
  };

  // Labels pour les catégories
  const categoryLabels = {
    rent: 'Loyer',
    utilities: 'Services',
    salaries: 'Salaires',
    supplies: 'Fournitures',
    other: 'Autre'
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-500 p-2 rounded-xl">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Gestion des Dépenses</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Tableau de bord */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Tableau de Bord des Dépenses
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white p-6 rounded-2xl border border-gray-200">
          <h3 className="text-gray-600 text-sm font-medium mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
            Répartition par catégorie
          </h3>

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

                    const colors = {
                      rent: '#EF4444',
                      utilities: '#3B82F6',
                      salaries: '#10B981',
                      supplies: '#F59E0B',
                      other: '#8B5CF6'
                    };

                    return (
                      <circle
                        key={category}
                        cx="50"
                        cy="50"
                        r="45"
                        fill="transparent"
                        stroke={colors[category] || '#9CA3AF'}
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
            <div>
              <div className="space-y-3">
                {Object.entries(dashboardData.categoryTotals).map(([category, total]) => {
                  const percentage = (total / dashboardData.total) * 100;

                  return (
                    <div key={category} className="flex items-center">
                      <div className={`w-4 h-4 rounded-full ${categoryColors[category] || 'bg-gray-500'} mr-3`}></div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-900">
                            {categoryLabels[category] || category}
                          </span>
                          <span className="font-semibold text-gray-900">{total.toLocaleString('fr-FR')} CFA</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: categoryBarColors[category] || '#9ca3af'
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {editingExpense ? 'Modifier Dépense' : 'Nouvelle Dépense'}
          </h2>
          <ExpenseForm
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
            submitting={submitting}
            initialData={editingExpense}
          />
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtres
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Rechercher..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={filter.startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={filter.endDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">Toutes catégories</option>
                <option value="rent">Loyer</option>
                <option value="utilities">Services publics</option>
                <option value="salaries">Salaires</option>
                <option value="supplies">Fournitures</option>
                <option value="other">Autre</option>
              </select>
              <button
                onClick={() => setFilter({ search: '', startDate: '', endDate: '', category: '' })}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium w-full"
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
              <div className="mb-4 p-4 bg-blue-50 rounded-xl flex items-center justify-between border border-blue-100">
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
                <div className="text-center py-6 text-gray-500">
                  Aucune dépense trouvée
                </div>
              )}

              <div className="space-y-4 md:hidden">
                {expenses.map((expense) => (
                  <div key={expense._id} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{expense.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(expense.date).toLocaleDateString('fr-FR')} ·{' '}
                          <span className="capitalize">{expense.paymentMethod}</span>
                        </p>
                      </div>
                      <p className="text-base font-semibold text-blue-600">{expense.amount.toLocaleString('fr-FR')} CFA</p>
                    </div>

                    {(expense.createdBy || expense.updatedBy) && (
                      <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs text-gray-500">
                        {expense.createdBy && (
                          <div>
                            Créé par {formatUser(expense.createdBy)}
                            {formatDateTime(expense.createdAt) ? ` · ${formatDateTime(expense.createdAt)}` : ''}
                          </div>
                        )}
                        {expense.updatedBy && (
                          <div className="mt-1">
                            Modifié par {formatUser(expense.updatedBy)}
                            {formatDateTime(expense.updatedAt) ? ` · ${formatDateTime(expense.updatedAt)}` : ''}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${expense.category === 'rent' ? 'bg-red-100 text-red-800' :
                          expense.category === 'salaries' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {categoryLabels[expense.category] || expense.category}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 shadow-sm"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-visible md:overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(expense.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-medium">{expense.description}</div>
                          {(expense.createdBy || expense.updatedBy) && (
                            <div className="mt-1 space-y-0.5 text-xs text-gray-400">
                              {expense.createdBy && (
                                <div>
                                  Créé par {formatUser(expense.createdBy)}
                                  {formatDateTime(expense.createdAt) ? ` · ${formatDateTime(expense.createdAt)}` : ''}
                                </div>
                              )}
                              {expense.updatedBy && (
                                <div>
                                  Modifié par {formatUser(expense.updatedBy)}
                                  {formatDateTime(expense.updatedAt) ? ` · ${formatDateTime(expense.updatedAt)}` : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{expense.amount.toLocaleString('fr-FR')} CFA</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${expense.category === 'rent' ? 'bg-red-100 text-red-800' :
                            expense.category === 'salaries' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {categoryLabels[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 capitalize">{expense.paymentMethod}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(expense)}
                              className="text-gray-600 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(expense._id)}
                              className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            </>
          )}
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
    <div className="bg-white p-5 rounded-2xl border border-gray-200">
      <div className="flex items-center">
        <div className={`p-3 rounded-xl ${colors.bg} mr-4`}>
          <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
