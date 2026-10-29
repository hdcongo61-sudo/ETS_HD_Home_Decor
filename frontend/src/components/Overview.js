import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useDashboardData } from '../context/DashboardDataContext';
import { useModal } from '../context/ModalContext';
import { FEATURE_KEYS } from '../config/features';
import { formatCfa } from '../utils/format';
import { KPICard, LoadingSkeleton, EmptyState } from './business';
import SectionError from './SectionError';

const money = (value) => (value != null && Number.isFinite(Number(value)) ? formatCfa(value) : '—');

export default function Overview() {
  const { auth, hasFeature } = useContext(AuthContext);
  const { fetchOverviewData } = useDashboardData();
  const { openModal } = useModal();
  const fetchRef = useRef(fetchOverviewData);
  fetchRef.current = fetchOverviewData;
  const requestRef = useRef(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('30days');

  const isAdmin = Boolean(auth?.user?.isAdmin);
  const userId = auth?.user?._id;
  const permissions = auth?.user?.permissions || [];
  const canViewDashboard = isAdmin || permissions.includes('view_dashboard');
  const canUseExpenses = isAdmin || permissions.includes('use_expenses');
  const canUsePayroll = isAdmin && (typeof hasFeature !== 'function' || hasFeature(FEATURE_KEYS.EMPLOYEES_PAYROLL));

  const load = useCallback(async (force = false, requestedRange = range) => {
    const request = ++requestRef.current;
    setRefreshing(true);
    setError(null);
    try {
      const next = await fetchRef.current(requestedRange, force);
      if (request === requestRef.current) setData(next);
    } catch (failure) {
      if (request === requestRef.current) setError(failure);
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    load(false, range);
    return () => { requestRef.current += 1; };
  }, [load, userId, isAdmin, range]);

  useEffect(() => {
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => load(true), 400);
    };
    const events = ['saleCreated', 'paymentCreated', 'expenseCreated', 'app:data-changed'];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, refresh));
    };
  }, [load]);

  const incomplete = Boolean(error || data?.errors || !data || data?.freshness?.offline);

  const tasks = [];
  const addTask = (key, label, value, to, urgent = false) => {
    if (Number(value) > 0) tasks.push({ key, label, count: Number(value), to, urgent });
  };
  if (isAdmin) {
    const reminders = data?.reminders;
    // Categories overlap: category counts must never be added into a total.
    addTask('overdue', 'Relancer les paiements en retard', reminders?.overdue?.length, '/sales/partially-paid', true);
    addTask('unpaid', 'Examiner les ventes sans paiement', reminders?.neverPaid?.length, '/sales/partially-paid', true);
    const stock = data?.products;
    addTask(
      'out',
      'Réapprovisionner les produits en rupture',
      Array.isArray(stock?.outOfStockProducts) ? stock.outOfStockProducts.length : stock?.outOfStockCount,
      '/products/out-of-stock',
      true
    );
    addTask('failed', 'Reprendre les livraisons non effectuées', data?.delivery?.not_delivered?.count, '/sales?delivery=not_delivered', true);
    addTask(
      'low',
      'Vérifier le stock critique',
      Array.isArray(stock?.lowStockProducts) ? stock.lowStockProducts.length : stock?.lowStockCount,
      '/products/critical'
    );
    addTask('delivery', 'Préparer les livraisons en attente', data?.delivery?.pending?.count, '/sales?delivery=pending');
    addTask('upcoming', 'Préparer les prochaines échéances', reminders?.upcoming?.length, '/sales/partially-paid');
    if (canUsePayroll) addTask('salary', 'Préparer les salaires', reminders?.salaryReminders?.length, '/employees');
  }

  const summary = data?.sales?.summary;
  const daily = isAdmin ? { total: summary?.today, count: summary?.todayCount } : data?.todaySales;
  const mySalesPath = userId ? `/sales/user/${userId}` : '/sales';
  const rangeLabel = { '7days': '7 derniers jours', '30days': '30 derniers jours', '90days': '90 derniers jours' }[range];
  const priorityCount = tasks.reduce((total, task) => total + task.count, 0);
  const firstTask = tasks[0];
  const stockAlertCount = Number(data?.products?.outOfStockCount || 0) + Number(data?.products?.lowStockCount || 0);

  // A brand-new shop with no sales yet shouldn't see "Donnée indisponible"
  // everywhere — only once data has actually loaded without errors.
  const isFirstRun = isAdmin && !incomplete && !firstTask && !summary?.today && !summary?.todayCount && !stockAlertCount;

  const decisionCards = isAdmin
    ? [
        { label: 'Ventes aujourd’hui', value: money(daily?.total), context: daily?.count != null ? `${daily.count} vente(s)` : 'Ventes indisponibles', icon: ClipboardList },
        { label: 'Encaissements', value: money(data?.paymentsToday?.total), context: data?.paymentsToday?.count != null ? `${data.paymentsToday.count} paiement(s)` : 'Paiements indisponibles', icon: WalletCards },
        { label: 'Alertes stock', value: stockAlertCount ? stockAlertCount.toLocaleString('fr-FR') : '0', context: stockAlertCount ? 'À examiner' : 'Aucune alerte détectée', icon: Package },
      ]
    : [
        { label: 'Mes ventes aujourd’hui', value: money(daily?.total), context: daily?.count != null ? `${daily.count} vente(s)` : 'Ventes indisponibles', icon: ClipboardList },
        { label: 'Paiements reçus', value: money(data?.paymentsToday?.total), context: data?.paymentsToday?.count != null ? `${data.paymentsToday.count} paiement(s)` : 'Paiements indisponibles', icon: WalletCards },
      ];

  const workflowLinks = isAdmin
    ? [
        { label: 'Ventes à suivre', description: 'Paiements, livraisons et historique', to: '/sales', icon: ClipboardList },
        { label: 'Santé du stock', description: 'Ruptures, seuils et mouvements', to: '/products/critical', icon: Package },
        { label: 'Clients', description: 'Retrouver un client ou une dette', to: '/clients', icon: Users },
        { label: 'Trésorerie', description: 'Encaissements et dépenses', to: '/bank', icon: WalletCards },
      ]
    : [
        { label: 'Mes ventes', description: 'Reprendre une vente ou un paiement', to: mySalesPath, icon: ClipboardList },
        { label: 'Clients', description: 'Créer ou retrouver un client', to: '/clients', icon: Users },
        { label: 'Catalogue', description: 'Vérifier un prix ou un stock', to: '/products', icon: Package },
      ];

  return (
    <>
      <header className="ms-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-xs text-[var(--ms-text-muted)]">
            {isAdmin ? 'Pilotage de la boutique' : 'Mon espace de vente'}
            {auth?.tenant?.name ? ` · ${auth.tenant.name}` : ''}
          </p>
          <h1 className="ms-page-title mt-1">Bonjour{auth?.user?.name ? `, ${auth.user.name}` : ''}</h1>
          <p className="mt-2 text-sm text-[var(--ms-text-muted)]">
            {isAdmin ? 'Traitez les urgences, puis suivez l’activité du jour.' : 'Enregistrez une vente ou reprenez le suivi de vos clients.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => openModal('sale')} className="ms-button ms-button-primary ms-button-md w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvelle vente
          </button>
          {isAdmin && (
            <Link to="/dashboard" className="ms-button ms-button-secondary ms-button-md w-full sm:w-auto">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Voir les analyses
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ms-text-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>{rangeLabel}</span>
          <label className="sr-only" htmlFor="overview-range">Période de l’accueil</label>
          <select
            id="overview-range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-md border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 py-1.5 text-xs font-semibold text-[var(--ms-text)]"
          >
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="90days">90 derniers jours</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span role="status">
            {refreshing
              ? 'Actualisation en cours…'
              : data?.freshness?.offline
              ? 'Données enregistrées sur cet appareil — connexion à rétablir'
              : data?.freshness?.at
              ? `Données chargées le ${new Date(data.freshness.at).toLocaleString('fr-FR')}`
              : 'Données de la boutique'}
          </span>
          <button type="button" disabled={refreshing} onClick={() => load(true)} className="ms-button ms-button-secondary ms-button-sm min-h-[44px]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </div>

      {(error || data?.errors > 0) && (
        <SectionError
          title="Certaines données sont indisponibles"
          error={error || { response: { status: 503, data: { message: 'La liste des priorités et les chiffres peuvent être incomplets. Actualisez pour réessayer.' } } }}
          onRetry={() => load(true)}
        />
      )}

      {loading ? (
        <div className="ms-surface p-5" role="status" aria-label="Chargement de vos tâches">
          <LoadingSkeleton rows={5} />
        </div>
      ) : (
        <>
          {isAdmin && firstTask ? (
            <section className="ms-surface overflow-hidden" aria-labelledby="home-next-action-title">
              <div
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: 'linear-gradient(135deg, var(--ms-blue-soft), var(--ms-white))' }}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--ms-blue)' }}>
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p id="home-next-action-title" className="text-xs font-bold uppercase tracking-wide text-[var(--ms-blue)]">Prochaine meilleure action</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--ms-text-strong)]">{firstTask.label}</p>
                    <p className="mt-1 text-sm text-[var(--ms-text-muted)]">
                      {firstTask.count.toLocaleString('fr-FR')} élément(s) concerné(s)
                      {priorityCount > firstTask.count ? ` · ${(priorityCount - firstTask.count).toLocaleString('fr-FR')} autre(s) dans la liste` : ''}
                    </p>
                  </div>
                </div>
                <Link to={firstTask.to} className="ms-button ms-button-primary ms-button-md shrink-0">
                  Traiter maintenant
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          ) : isAdmin && isFirstRun ? (
            <section className="ms-surface" aria-labelledby="home-first-run-title">
              <EmptyState
                title="Bienvenue — votre boutique est prête"
                description="Aucune activité à traiter pour l’instant. Enregistrez votre première vente ou ajoutez vos produits pour commencer."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => openModal('sale')} className="ms-button ms-button-primary ms-button-md">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nouvelle vente
                    </button>
                    <Link to="/products" className="ms-button ms-button-secondary ms-button-md">Ajouter des produits</Link>
                  </div>
                }
              />
              <h2 id="home-first-run-title" className="sr-only">Démarrage</h2>
            </section>
          ) : null}

          <section className="ms-surface p-4 sm:p-5" aria-labelledby="home-tasks-title">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="home-tasks-title" className="ms-section-title">{isAdmin ? 'À traiter en priorité' : 'Votre prochaine action'}</h2>
                <p className="mt-1 text-sm text-[var(--ms-text-muted)]">
                  {isAdmin ? 'Les éléments qui peuvent bloquer les encaissements ou les livraisons.' : 'Commencez par le parcours qui correspond à votre objectif.'}
                </p>
              </div>
              {isAdmin && priorityCount > 0 && (
                <span className="ms-status-badge ms-status-danger">{priorityCount.toLocaleString('fr-FR')} élément(s)</span>
              )}
            </div>

            {isAdmin ? (
              tasks.length ? (
                <ul className="mt-3 divide-y divide-[var(--ms-border)]">
                  {tasks.map((task) => (
                    <li key={task.key}>
                      <Link
                        to={task.to}
                        className="flex min-h-[64px] items-center gap-3 rounded-md px-2 py-3 hover:bg-[var(--ms-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-blue)]"
                      >
                        <span className="min-w-0 flex-1 text-sm font-semibold">
                          {task.label}
                          <span className="mt-1 block text-xs font-normal text-[var(--ms-text-muted)]">{task.urgent ? 'À examiner en priorité' : 'À planifier'}</span>
                        </span>
                        <span
                          className="ms-status-badge shrink-0"
                          style={{
                            background: task.urgent ? 'var(--colorStatusDangerBackground1)' : 'var(--colorStatusWarningBackground1)',
                            color: task.urgent ? 'var(--colorStatusDangerForeground1)' : 'var(--colorStatusWarningForeground1)',
                          }}
                        >
                          {task.count.toLocaleString('fr-FR')}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm" role="status">
                  {incomplete
                    ? 'Les priorités ne peuvent pas être confirmées avec les données disponibles.'
                    : 'Aucune alerte à traiter dans les catégories suivies. Vous pouvez poursuivre les ventes.'}
                </p>
              )
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--ms-text-muted)]">Retrouvez vos ventes pour vérifier un solde, enregistrer un paiement ou suivre une livraison.</p>
                <Link to={mySalesPath} className="ms-button ms-button-secondary ms-button-md">
                  Reprendre mes ventes
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {incomplete && <p className="text-sm text-[var(--ms-text-muted)]">Votre activité n’a pas pu être chargée complètement.</p>}
              </div>
            )}
          </section>

          <section aria-labelledby="home-workflows-title" className="space-y-3">
            <div>
              <h2 id="home-workflows-title" className="ms-section-title">Accès par objectif</h2>
              <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Ouvrez directement le parcours dont vous avez besoin.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workflowLinks.map(({ label, description, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="ms-surface flex min-h-[108px] items-start gap-3 p-4 transition-colors hover:bg-[var(--ms-bg-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-blue)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ms-blue-soft)] text-[var(--ms-blue)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--ms-text)]">{label}</span>
                    <span className="mt-1 block text-xs text-[var(--ms-text-muted)]">{description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ms-text-muted)]" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="home-today-title" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="home-today-title" className="ms-section-title">Aujourd’hui · activité de la boutique</h2>
                <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Un aperçu rapide pour décider où agir ensuite.</p>
              </div>
              {canViewDashboard && (
                <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--ms-blue)]">
                  Voir le détail
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decisionCards.map(({ label, value, context, icon: Icon }) => (
                <KPICard key={label} title={label} value={value} context={context} icon={<Icon className="h-5 w-5" aria-hidden="true" />} tone="brand" />
              ))}
              {canUseExpenses && !isAdmin && (
                <KPICard
                  title="Dépenses du jour"
                  value={money(data?.todayExpenses?.total)}
                  context="Boutique · aujourd’hui"
                  icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}
                  tone="warning"
                />
              )}
            </div>
          </section>

          <section className="ms-surface p-4 sm:p-5" aria-labelledby="home-actions-title">
            <h2 id="home-actions-title" className="ms-section-title">Actions courantes</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={() => openModal('payment')} className="ms-button ms-button-secondary ms-button-md">Encaisser un paiement</button>
              <Link to="/products" className="ms-button ms-button-secondary ms-button-md">Consulter le stock</Link>
              <Link to="/clients" className="ms-button ms-button-secondary ms-button-md">Rechercher un client</Link>
              {canUseExpenses && (
                <button type="button" onClick={() => openModal('expense')} className="ms-button ms-button-secondary ms-button-md">Saisir une dépense</button>
              )}
            </div>
          </section>

          {canViewDashboard && (
            <Link to="/dashboard" className="ms-button ms-button-secondary ms-button-md w-full sm:w-auto">
              Ouvrir les analyses détaillées
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </>
      )}
    </>
  );
}
