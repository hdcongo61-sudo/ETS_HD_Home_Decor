import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, ReceiptText, RefreshCcw, Trash2 } from 'lucide-react';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import {
  Button,
  ChartCard,
  CommandBar,
  DataTable,
  EmptyState,
  IconButton,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  RightDetailPanel,
  SearchBox,
  StatusBadge,
  Workspace,
} from '../components/business';

const legacyCategoryLabels = {
  rent: 'Loyer',
  utilities: 'Services',
  salaries: 'Salaires',
  supplies: 'Fournitures',
  delivery: 'Livraison',
  other: 'Autre'
};
const categoryPalette = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#a855f7', '#14b8a6', '#f97316'];
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
const formatSalaryPeriod = (expense) => {
  if (!expense?.salaryMonth || !expense?.salaryYear) return '';
  return new Date(expense.salaryYear, expense.salaryMonth - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
};

const Expenses = () => {
  const tableRef = useRef(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [filter, setFilter] = useState({
    search: '',
    startDate: '',
    endDate: '',
    category: ''
  });
  const [editingExpense, setEditingExpense] = useState(null);
  const [formPanelOpen, setFormPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchExpenses uses filter
  }, [filter]);

  // Refresh when an expense is created elsewhere (e.g. the global expense modal).
  useEffect(() => {
    const onExpenseCreated = () => fetchExpenses();
    window.addEventListener('expenseCreated', onExpenseCreated);
    return () => window.removeEventListener('expenseCreated', onExpenseCreated);
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
        setFormPanelOpen(false);
      } else {
        const { data } = await api.post('/expenses', expenseData);
        if (matchesExpenseFilter(data)) {
          setExpenses((prev) =>
            [data, ...prev].sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
          );
        }
        setFormPanelOpen(false);
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
    setFormPanelOpen(false);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormPanelOpen(true);
  };

  const handleCreate = () => {
    setEditingExpense(null);
    setFormPanelOpen(true);
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
    <Workspace>
      <PageHeader
        eyebrow="Caisse & charges"
        title="Gestion des dépenses"
        description="Suivi des sorties, salaires, catégories et historique de paiement."
        actions={
          <>
            <Button type="button" onClick={handleCreate} variant="primary">
              <Plus className="h-4 w-4" />
              Nouvelle dépense
            </Button>
            <Link to="/expenses/monthly-plan" className="ms-button ms-button-secondary ms-button-md">
              Plan mensuel
            </Link>
          </>
        }
      />

      <CommandBar>
        <SearchBox
          label="Rechercher une dépense"
          placeholder="Rechercher..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="min-w-[240px] flex-1"
        />
        <input
          type="date"
          value={filter.startDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
          className="form-control w-auto text-sm"
        />
        <input
          type="date"
          value={filter.endDate}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
          className="form-control w-auto text-sm"
        />
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="form-control w-auto min-w-[190px] text-sm"
        >
          <option value="">Toutes catégories</option>
          {categoryFilterOptions.map((category) => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>
        <Button onClick={() => setFilter({ search: '', startDate: '', endDate: '', category: '' })}>
          <RefreshCcw className="h-4 w-4" />
          Réinitialiser
        </Button>
      </CommandBar>

      {error && (
        <div className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1 flex items-center gap-2" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total dépensé"
          value={`${dashboardData.total.toLocaleString('fr-FR')} CFA`}
          tone="info"
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <KPICard title="Nombre de dépenses" value={dashboardData.count} tone="success" />
        <KPICard
          title="Dépense moyenne"
          value={`${dashboardData.average.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} CFA`}
          tone="neutral"
        />
        <KPICard
          title="Dépense max"
          value={dashboardData.mostExpensive ? `${dashboardData.mostExpensive.amount.toLocaleString('fr-FR')} CFA` : 'Aucune'}
          tone="danger"
        />
      </div>

      <ChartCard
        title="Répartition par catégorie"
        description="Vue rapide des dépenses correspondant aux filtres actifs."
      >
        {dashboardData.total > 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex justify-center">
              <div className="relative h-56 w-56">
                <svg viewBox="0 0 100 100" className="h-full w-full">
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
                  <span className="text-xl font-semibold text-[var(--ms-text)]">
                    {`${Math.round(dashboardData.total / 1000)}K CFA`}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(dashboardData.categoryTotals).map(([category, total]) => {
                const percentage = (total / dashboardData.total) * 100;

                return (
                  <div key={category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-[var(--ms-text)]">{getCategoryLabel(category)}</span>
                      <span className="font-semibold text-[var(--ms-text)]">{total.toLocaleString('fr-FR')} CFA</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--ms-bg-muted)]">
                      <div
                        className="h-2"
                        style={{ width: `${percentage}%`, backgroundColor: getCategoryColor(category) }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs text-[var(--ms-text-muted)]">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="Aucune donnée à répartir" description="Ajoutez une dépense ou élargissez vos filtres." />
        )}
      </ChartCard>

      <ChartCard
        title="Historique des dépenses"
        description="Liste Excel des sorties filtrées."
        actions={
          <Button onClick={handleCreate} variant="primary">
            <Plus className="h-4 w-4" />
            Nouvelle dépense
          </Button>
        }
      >
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <>
              {expenses.length === 0 && !loading && (
                <EmptyState title="Aucune dépense trouvée" description="Ajustez les filtres ou créez une nouvelle dépense." />
              )}

              {expenses.length > 0 && (
              <DataTable>
                <table ref={tableRef} className="responsive-table w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Montant</th>
                      <th>Catégorie</th>
                      <th>Paiement</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense._id}>
                        <td data-title="Date" className="text-sm">
                          {formatDateTime(expense.date)}
                        </td>
                        <td data-title="Description">
                          <div className="text-sm font-semibold text-[var(--ms-text)]">{expense.description}</div>
                          {(expense.createdBy || expense.updatedBy) && (
                            <div className="mt-1.5 space-y-0.5 text-xs text-[var(--ms-text-muted)]">
                              {expense.createdBy && (
                                <div>Créé par {formatUser(expense.createdBy)}{formatDateTime(expense.createdAt) ? ` · ${formatDateTime(expense.createdAt)}` : ''}</div>
                              )}
                              {expense.updatedBy && (
                                <div>Modifié par {formatUser(expense.updatedBy)}{formatDateTime(expense.updatedAt) ? ` · ${formatDateTime(expense.updatedAt)}` : ''}</div>
                              )}
                            </div>
                          )}
                          {expense.employee && (
                            <div className="mt-2 border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-3 py-2 text-xs text-[var(--ms-text)]">
                              <span className="font-semibold">Salaire :</span> {expense.employee.name}
                              {formatSalaryPeriod(expense) ? ` · ${formatSalaryPeriod(expense)}` : ''}
                            </div>
                          )}
                        </td>
                        <td data-title="Montant" className="font-semibold tabular-nums">
                          {expense.amount.toLocaleString('fr-FR')} CFA
                        </td>
                        <td data-title="Catégorie">
                          <StatusBadge>{getCategoryLabel(expense.category)}</StatusBadge>
                        </td>
                        <td data-title="Paiement" className="text-sm capitalize">
                          {expense.paymentMethod}
                        </td>
                        <td data-title="Actions">
                          <div className="flex gap-2 flex-wrap">
                            <IconButton
                              type="button"
                              onClick={() => handleEdit(expense)}
                              label="Modifier"
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              type="button"
                              onClick={() => handleDelete(expense._id)}
                              label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              )}
            </>
          )}
      </ChartCard>

      <RightDetailPanel
        isOpen={formPanelOpen}
        onClose={handleCancelEdit}
        title={editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
        subtitle={editingExpense ? 'Mettez à jour les informations enregistrées.' : 'Ajoutez une sortie avec sa catégorie et son mode de paiement.'}
      >
        <ExpenseForm
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
          submitting={submitting}
          initialData={editingExpense}
        />
      </RightDetailPanel>
    </Workspace>
  );
};

export default Expenses;
