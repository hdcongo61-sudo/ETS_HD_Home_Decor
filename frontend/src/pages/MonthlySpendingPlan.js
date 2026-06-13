import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useResponsiveTable from '../hooks/useResponsiveTable';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  PiggyBank,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import api from '../services/api';
import {
  ChartCard,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  PageHeader,
  Workspace,
} from '../components/business';

const categoryLabels = {
  rent: 'Loyer',
  utilities: 'Services',
  salaries: 'Salaires',
  supplies: 'Fournitures',
  delivery: 'Livraison',
  other: 'Autre',
};

const formatCFA = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString('fr-FR')} CFA`;

const getMonthValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthBounds = (monthValue) => {
  const [year, month] = String(monthValue || getMonthValue()).split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end, year, monthIndex: month - 1 };
};

const getSaleProfit = (sale) => {
  const profitFromData = Number(sale?.profitData?.totalProfit);
  if (Number.isFinite(profitFromData) && profitFromData !== 0) {
    return profitFromData;
  }

  return (sale?.products || []).reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const salePrice = Number(item.priceAtSale ?? item.product?.price ?? 0);
    const costPrice = Number(item.product?.costPrice ?? 0);
    return sum + (salePrice - costPrice) * quantity;
  }, 0);
};

const MonthlySpendingPlan = () => {
  const [month, setMonth] = useState(getMonthValue());
  const [desiredProfit, setDesiredProfit] = useState(0);
  const [targetMargin, setTargetMargin] = useState(25);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { start, end } = getMonthBounds(month);

      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });

        const [expensesRes, salesRes] = await Promise.all([
          api.get(`/expenses?${params.toString()}`),
          api.get(`/sales?${params.toString()}&summary=list`),
        ]);

        setExpenses(expensesRes.data || []);
        setSales(salesRes.data || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            'Impossible de charger les dépenses mensuelles.'
        );
        setExpenses([]);
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month]);

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

  const getCategoryLabel = (category) => {
    if (!category) return 'Non catégorisé';
    const configured = expenseCategories.find((item) => item.name === category);
    return configured?.name || categoryLabels[category] || category;
  };

  const summary = useMemo(() => {
    const { start, end } = getMonthBounds(month);
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === start.getFullYear() &&
      today.getMonth() === start.getMonth();
    const daysInMonth = end.getDate();
    const elapsedDays = isCurrentMonth
      ? Math.min(today.getDate(), daysInMonth)
      : today > end
      ? daysInMonth
      : 0;
    const remainingDays = isCurrentMonth
      ? Math.max(daysInMonth - today.getDate() + 1, 1)
      : today > end
      ? 0
      : daysInMonth;

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + (Number(expense.amount) || 0),
      0
    );
    const monthlyTarget = totalExpenses + (Number(desiredProfit) || 0);
    const dailyProfitTarget = monthlyTarget / Math.max(daysInMonth, 1);
    const currentGrossProfit = sales.reduce(
      (sum, sale) => sum + getSaleProfit(sale),
      0
    );
    const currentRevenue = sales.reduce(
      (sum, sale) => sum + (Number(sale.totalAmount) || 0),
      0
    );
    const currentNetProfit = currentGrossProfit - totalExpenses;
    const targetProgress =
      monthlyTarget > 0 ? (currentGrossProfit / monthlyTarget) * 100 : 0;
    const remainingProfitTarget = Math.max(monthlyTarget - currentGrossProfit, 0);
    const dailyRemainingProfit =
      remainingDays > 0 ? remainingProfitTarget / remainingDays : 0;
    const marginRatio = Math.max(Number(targetMargin) || 0, 1) / 100;
    const dailySalesNeeded = dailyRemainingProfit / marginRatio;

    const categoryTotals = expenses.reduce((acc, expense) => {
      const key = expense.category || 'other';
      acc[key] = (acc[key] || 0) + (Number(expense.amount) || 0);
      return acc;
    }, {});

    return {
      daysInMonth,
      elapsedDays,
      remainingDays,
      totalExpenses,
      monthlyTarget,
      dailyProfitTarget,
      currentGrossProfit,
      currentRevenue,
      currentNetProfit,
      targetProgress,
      remainingProfitTarget,
      dailyRemainingProfit,
      dailySalesNeeded,
      categoryTotals,
    };
  }, [desiredProfit, expenses, month, sales, targetMargin]);

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ),
    [expenses]
  );

  const tableRef = useRef(null);
  useResponsiveTable(tableRef, [sortedExpenses]);

  return (
    <Workspace>
      <PageHeader
        eyebrow="Caisse & charges"
        title="Objectif mensuel de bénéfice"
        description="Suivez vos dépenses du mois et calculez le bénéfice à gagner par jour."
        actions={
          <Link to="/expenses" className="ms-button ms-button-secondary ms-button-md">
            Gérer les dépenses <ArrowRight size={16} />
          </Link>
        }
      />

      <CommandBar>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Mois
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="form-control mt-1 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Bénéfice souhaité
            <input
              type="number"
              min="0"
              value={desiredProfit}
              onChange={(event) => setDesiredProfit(event.target.value)}
              className="form-control mt-1 text-sm"
              placeholder="0"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Marge estimée %
            <input
              type="number"
              min="1"
              max="100"
              value={targetMargin}
              onChange={(event) => setTargetMargin(event.target.value)}
              className="form-control mt-1 text-sm"
            />
          </label>
        </div>
      </CommandBar>

      {error && (
        <div className="flex items-center gap-2 border border-[var(--ms-danger)] bg-[rgba(209,52,56,0.08)] px-4 py-3 text-sm text-[var(--ms-danger)]">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Dépenses du mois"
          value={formatCFA(summary.totalExpenses)}
          icon={<ReceiptText size={22} />}
          tone="rose"
        />
        <MetricCard
          title="Objectif total"
          value={formatCFA(summary.monthlyTarget)}
          helper="Dépenses + bénéfice souhaité"
          icon={<PiggyBank size={22} />}
          tone="indigo"
        />
        <MetricCard
          title="À gagner par jour"
          value={formatCFA(summary.dailyProfitTarget)}
          helper={`${summary.daysInMonth} jours dans le mois`}
          icon={<CalendarDays size={22} />}
          tone="emerald"
        />
        <MetricCard
          title="Ventes/jour estimées"
          value={formatCFA(summary.dailySalesNeeded)}
          helper={`Avec ${Number(targetMargin) || 0}% de marge`}
          icon={<TrendingUp size={22} />}
          tone="amber"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Progression du mois"
          description="Basé sur la marge/profit enregistré dans les ventes."
          className="lg:col-span-2"
          actions={
            <span className="ms-status-badge ms-status-info">
              {Math.min(summary.targetProgress, 100).toFixed(1)}%
            </span>
          }
        >
          <div className="h-3 overflow-hidden bg-[var(--ms-bg-muted)]">
            <div
              className="h-full bg-[var(--ms-primary)] transition-all"
              style={{ width: `${Math.min(summary.targetProgress, 100)}%` }}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SmallStat title="Ventes du mois" value={formatCFA(summary.currentRevenue)} />
            <SmallStat title="Bénéfice brut actuel" value={formatCFA(summary.currentGrossProfit)} />
            <SmallStat
              title="Bénéfice net actuel"
              value={formatCFA(summary.currentNetProfit)}
              negative={summary.currentNetProfit < 0}
            />
          </div>

          <div className="mt-5 border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
            <p className="text-sm font-semibold text-[var(--ms-text)]">
              Il reste {formatCFA(summary.remainingProfitTarget)} à générer.
            </p>
            <p className="mt-1 text-sm text-[var(--ms-text-muted)]">
              Sur {summary.remainingDays} jour(s) restant(s), cela fait{' '}
              <span className="font-bold">{formatCFA(summary.dailyRemainingProfit)}</span>{' '}
              de bénéfice brut par jour.
            </p>
          </div>
        </ChartCard>

        <ChartCard title="Par catégorie" description="Répartition des charges du mois.">
          <div className="space-y-3">
            {Object.entries(summary.categoryTotals).map(([category, total]) => {
              const percentage =
                summary.totalExpenses > 0 ? (total / summary.totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--ms-text)]">
                      {getCategoryLabel(category)}
                    </span>
                    <span className="text-[var(--ms-text-muted)]">{formatCFA(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden bg-[var(--ms-bg-muted)]">
                    <div
                      className="h-full bg-[var(--ms-warning)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(summary.categoryTotals).length === 0 && (
              <EmptyState title="Aucune dépense" description="Aucune dépense enregistrée pour ce mois." />
            )}
          </div>
        </ChartCard>
      </section>

      <ChartCard
        title="Liste des dépenses du mois"
        description={`${sortedExpenses.length} dépense(s) enregistrée(s).`}
      >
        <DataTable>
          <table ref={tableRef} className="responsive-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Catégorie</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.map((expense) => (
                <tr key={expense._id}>
                  <td className="whitespace-nowrap">
                    {expense.date
                      ? new Date(expense.date).toLocaleDateString('fr-FR')
                      : '-'}
                  </td>
                  <td className="font-medium text-[var(--ms-text)]">
                    {expense.description}
                  </td>
                  <td>
                    {getCategoryLabel(expense.category)}
                  </td>
                  <td className="whitespace-nowrap text-right font-semibold">
                    {formatCFA(expense.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>

          {!loading && sortedExpenses.length === 0 && (
            <EmptyState title="Aucune dépense" description="Aucune dépense pour le mois sélectionné." />
          )}

          {loading && (
            <div className="border-t border-[var(--ms-border)] px-4 py-8 text-center text-sm text-[var(--ms-text-muted)]">
              Chargement des dépenses...
            </div>
          )}
      </ChartCard>
    </Workspace>
  );
};

const MetricCard = ({ title, value, helper, icon, tone }) => {
  const tones = {
    rose: 'danger',
    indigo: 'info',
    emerald: 'success',
    amber: 'warning',
  };

  return (
    <KPICard title={title} value={value} context={helper} icon={icon} tone={tones[tone] || 'info'} />
  );
};

const SmallStat = ({ title, value, negative = false }) => (
  <div className="border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
    <p className="text-xs font-medium text-[var(--ms-text-muted)]">{title}</p>
    <p className={`mt-1 font-bold ${negative ? 'text-[var(--ms-danger)]' : 'text-[var(--ms-text)]'}`}>
      {value}
    </p>
  </div>
);

export default MonthlySpendingPlan;
