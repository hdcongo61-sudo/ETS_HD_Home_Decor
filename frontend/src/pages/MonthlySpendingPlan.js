import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Coins,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Target,
  TrendingUp,
} from 'lucide-react';
import api from '../services/api';

const categoryLabels = {
  rent: 'Loyer',
  utilities: 'Services',
  salaries: 'Salaires',
  supplies: 'Fournitures',
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Target size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Objectif mensuel de bénéfice
              </h1>
              <p className="text-sm text-gray-500">
                Suivez vos dépenses du mois et calculez le bénéfice à gagner par jour.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            Mois
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Bénéfice souhaité
            <input
              type="number"
              min="0"
              value={desiredProfit}
              onChange={(event) => setDesiredProfit(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
              className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Progression du mois
              </h2>
              <p className="text-sm text-gray-500">
                Basé sur la marge/profit enregistré dans les ventes.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
              {Math.min(summary.targetProgress, 100).toFixed(1)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
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

          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-semibold text-indigo-900">
              Il reste {formatCFA(summary.remainingProfitTarget)} à générer.
            </p>
            <p className="mt-1 text-sm text-indigo-700">
              Sur {summary.remainingDays} jour(s) restant(s), cela fait{' '}
              <span className="font-bold">{formatCFA(summary.dailyRemainingProfit)}</span>{' '}
              de bénéfice brut par jour.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Coins size={20} className="text-amber-600" />
            Par catégorie
          </h2>
          <div className="space-y-3">
            {Object.entries(summary.categoryTotals).map(([category, total]) => {
              const percentage =
                summary.totalExpenses > 0 ? (total / summary.totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {categoryLabels[category] || category}
                    </span>
                    <span className="text-gray-500">{formatCFA(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(summary.categoryTotals).length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Aucune dépense enregistrée pour ce mois.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <ListChecks size={20} className="text-indigo-600" />
              Liste des dépenses du mois
            </h2>
            <p className="text-sm text-gray-500">
              {sortedExpenses.length} dépense(s) enregistrée(s).
            </p>
          </div>
          <Link
            to="/expenses"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Gérer les dépenses <ArrowRight size={16} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Catégorie</th>
                <th className="px-3 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedExpenses.map((expense) => (
                <tr key={expense._id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {expense.date
                      ? new Date(expense.date).toLocaleDateString('fr-FR')
                      : '-'}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {expense.description}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {categoryLabels[expense.category] || expense.category}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-900">
                    {formatCFA(expense.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && sortedExpenses.length === 0 && (
            <div className="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-500">
              Aucune dépense pour le mois sélectionné.
            </div>
          )}

          {loading && (
            <div className="border-t border-gray-100 px-4 py-8 text-center text-sm text-gray-500">
              Chargement des dépenses...
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ title, value, helper, icon, tone }) => {
  const tones = {
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl border p-2.5 ${tones[tone] || tones.indigo}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {helper && <p className="mt-2 text-xs text-gray-500">{helper}</p>}
    </article>
  );
};

const SmallStat = ({ title, value, negative = false }) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
    <p className="text-xs font-medium text-gray-500">{title}</p>
    <p className={`mt-1 font-bold ${negative ? 'text-red-600' : 'text-gray-900'}`}>
      {value}
    </p>
  </div>
);

export default MonthlySpendingPlan;
