// components/GlobalPaymentModal.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCfa } from '../utils/format';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  User,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useModal } from '../context/ModalContext';
import api from '../services/api';
import Modal from './Modal';
import { PaymentForm } from './PaymentModal';
import { StatusBadge } from './business';
import { getSaleTypeText, getStatusText } from '../utils/saleUtils';
import { confirmDialog } from './ConfirmProvider';

const formatAmount = (value) => formatCfa(value);

const getTotalPaid = (sale) =>
  sale?.payments?.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) || 0;

const calculateBalance = (sale) => {
  const totalPaid = getTotalPaid(sale);
  return Math.max((Number(sale?.totalAmount) || 0) - totalPaid, 0);
};

const formatShortDate = (value) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PaymentModalSkeleton = () => (
  <div className="space-y-4">
    <div className="h-16 animate-pulse rounded-[var(--radiusLarge)] bg-[var(--ms-bg-subtle)]" />
    <div className="h-11 animate-pulse rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)]" />
    {[0, 1, 2].map((item) => (
      <div key={item} className="h-24 animate-pulse rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
    ))}
  </div>
);

const STATUS_TONES = {
  completed: 'success',
  partially_paid: 'warning',
  pending: 'neutral',
  cancelled: 'danger',
};

const lineTotal = (item) =>
  (Number(item?.priceAtSale ?? item?.price ?? 0)) * (Number(item?.quantity) || 0);

const SaleChoiceCard = ({ sale, active, expanded, onSelect, onToggleExpand }) => {
  const balance = calculateBalance(sale);
  const totalPaid = getTotalPaid(sale);
  const products = Array.isArray(sale.products) ? sale.products : [];
  const itemCount = products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const sellerName = sale.user?.name || '';
  const paymentCount = Array.isArray(sale.payments) ? sale.payments.length : 0;
  const saleReference = sale.reference || String(sale._id || '').slice(-6);

  return (
    <div
      className={`fluent-card-filled overflow-hidden transition-colors duration-200 ${
        active ? 'ring-2 ring-[var(--ms-blue)]' : 'hover:border-[var(--ms-border-strong)]'
      }`}
      style={active ? { borderColor: 'var(--ms-blue)' } : undefined}
    >
      {/* Selectable summary */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="w-full cursor-pointer p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ms-blue)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
              {sale.client?.name || 'Client non spécifié'}
            </p>
            <p className="fui-caption1 mt-0.5 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Vente {saleReference} · {formatShortDate(sale.saleDate || sale.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active && <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--ms-blue)' }} aria-hidden="true" />}
            <StatusBadge tone={STATUS_TONES[sale.status] || 'neutral'}>{getStatusText(sale.status)}</StatusBadge>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
            <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Total</span>
            <p className="fui-body1-strong mt-0.5" style={{ color: 'var(--colorNeutralForeground1)' }}>{formatAmount(sale.totalAmount)}</p>
          </div>
          <div className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
            <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Payé</span>
            <p className="fui-body1-strong mt-0.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>{formatAmount(totalPaid)}</p>
          </div>
          <div className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
            <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Restant</span>
            <p className="fui-body1-strong mt-0.5" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{formatAmount(balance)}</p>
          </div>
        </div>
      </button>

      {/* Expand toggle */}
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--ms-border)' }}>
        <span className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
          {itemCount} article{itemCount > 1 ? 's' : ''}{sellerName ? ` · ${sellerName}` : ''}
        </span>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radiusMedium)] px-2 py-1 fui-caption1-strong transition-colors hover:bg-[var(--ms-bg-subtle)]"
          style={{ color: 'var(--colorBrandForeground1)' }}
        >
          {expanded ? 'Masquer' : 'Détails'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 border-t px-4 py-3" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-white)' }}>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 fui-caption1-strong uppercase" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.04em' }}>
              <Package className="h-3.5 w-3.5" /> Produits
            </p>
            {products.length > 0 ? (
              <ul className="space-y-1">
                {products.map((p, i) => (
                  <li key={p._id || i} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                      {p.product?.name || 'Produit'}
                      <span className="ml-1" style={{ color: 'var(--colorNeutralForeground3)' }}>×{p.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{formatAmount(lineTotal(p))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun détail produit.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2.5 fui-caption1" style={{ borderColor: 'var(--ms-border)', color: 'var(--colorNeutralForeground3)' }}>
            <span className="inline-flex items-center gap-1">
              <ReceiptText className="h-3.5 w-3.5" /> {getSaleTypeText(sale.saleType)}
            </span>
            {sellerName && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {sellerName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> {paymentCount} paiement{paymentCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const StatTile = ({ icon, label, value, tone = 'neutral' }) => {
  const tones = {
    brand:   { bg: 'var(--ms-blue-soft)',                  fg: 'var(--colorBrandForeground1)' },
    success: { bg: 'var(--colorStatusSuccessBackground1)', fg: 'var(--colorStatusSuccessForeground1)' },
    neutral: { bg: 'var(--colorNeutralBackground3)',       fg: 'var(--colorNeutralForeground2)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div className="fluent-card-filled p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radiusMedium)]" style={{ background: t.bg, color: t.fg }}>
          {icon}
        </span>
        <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</span>
      </div>
      <p className="fui-subtitle2 mt-1.5" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
    </div>
  );
};

const GlobalPaymentModal = () => {
  const { activeModal, closeModal } = useModal();
  const isOpen = activeModal === 'payment';
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [step, setStep] = useState(1);
  const [saleSearch, setSaleSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasSalesData, setHasSalesData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const dataRequestRef = useRef(null);
  const hasSalesDataRef = useRef(false);

  const requestClose = useCallback(async () => {
    if (isSubmitting) return;
    if (isDirty) {
      const discard = await confirmDialog('Le montant et les options de paiement saisis seront perdus.', {
        title: 'Abandonner ce paiement ?',
        confirmLabel: 'Abandonner',
        danger: true,
      });
      if (!discard) return;
    }
    setIsDirty(false);
    closeModal();
  }, [closeModal, isDirty, isSubmitting]);

  const fetchOpenSales = useCallback(async () => {
    if (dataRequestRef.current) return dataRequestRef.current;
    setLoading(true);
    setLoadError('');

    dataRequestRef.current = (async () => {
      try {
        const { data } = await api.get('/sales', { params: { summary: 'list' } });
        hasSalesDataRef.current = true;
        setHasSalesData(true);
        setSales(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching open sales:', error);
        setLoadError(error.response?.data?.message || 'Impossible de charger les ventes à payer.');
      } finally {
        setLoading(false);
        dataRequestRef.current = null;
      }
    })();

    return dataRequestRef.current;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchOpenSales();
    setSelectedSale('');
    setExpandedSaleId(null);
    setSaleSearch('');
    setStep(1);
    setIsSubmitting(false);
  }, [fetchOpenSales, isOpen]);

  useEffect(() => {
    if (isOpen) return undefined;
    let timeoutId;
    let idleId;
    const prefetch = () => {
      if (!hasSalesDataRef.current) fetchOpenSales();
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(prefetch, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(prefetch, 250);
    }
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [fetchOpenSales, isOpen]);

  const payableSales = useMemo(
    () => sales.filter((sale) => sale.status !== 'cancelled' && calculateBalance(sale) > 0),
    [sales]
  );

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase();
    if (!search) return payableSales;

    return payableSales.filter((sale) => {
      const clientName = String(sale.client?.name || '').toLowerCase();
      const clientPhone = String(sale.client?.phone || '').toLowerCase();
      const reference = String(sale.reference || '').toLowerCase();
      const sellerName = String(sale.user?.name || '').toLowerCase();
      const saleId = String(sale._id || '').toLowerCase();
      return (
        clientName.includes(search) ||
        clientPhone.includes(search) ||
        reference.includes(search) ||
        sellerName.includes(search) ||
        saleId.includes(search)
      );
    });
  }, [payableSales, saleSearch]);

  const selectedSaleData = payableSales.find((sale) => sale._id === selectedSale) || null;

  const paymentStats = useMemo(() => {
    const outstanding = payableSales.reduce((sum, sale) => sum + calculateBalance(sale), 0);
    return {
      count: payableSales.length,
      outstanding,
      filtered: filteredSales.length,
    };
  }, [filteredSales.length, payableSales]);

  const handleAddPayment = async (payload) => {
    if (!selectedSaleData) {
      throw new Error('Veuillez sélectionner une vente');
    }

    await api.post(`/sales/${selectedSaleData._id}/payments`, payload);
    setIsDirty(false);
    closeModal();
    toast.success('Paiement enregistré — données à jour.');
  };

  const returnToSales = async () => {
    if (isSubmitting) return;
    if (isDirty) {
      const discard = await confirmDialog('Le montant et les options de paiement saisis seront perdus.', {
        title: 'Changer de vente ?',
        confirmLabel: 'Changer de vente',
        danger: true,
      });
      if (!discard) return;
    }
    setIsDirty(false);
    setStep(1);
  };

  const continueToPayment = () => {
    if (!selectedSaleData) return;
    setIsDirty(false);
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title={step === 1 ? 'Choisir une vente à encaisser' : 'Saisir le paiement'}
      subtitle={step === 1
        ? 'Sélectionnez une vente avec un solde restant.'
        : selectedSaleData
          ? `${selectedSaleData.client?.name || 'Client non spécifié'} · Vente ${selectedSaleData.reference || `#${String(selectedSaleData._id).slice(-6)}`}`
          : 'Renseignez le montant et confirmez les modalités d’encaissement.'}
      size="xl"
      mobileFullscreen
      suppressGlobal={false}
      icon={<Wallet size={20} />}
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={isSubmitting}
            className="ms-button ms-button-secondary ms-button-md w-full disabled:opacity-60 sm:w-auto"
          >
            Fermer
          </button>
          {step === 2 && (
            <button
              type="button"
              onClick={returnToSales}
              disabled={isSubmitting}
              className="ms-button ms-button-secondary ms-button-md w-full disabled:opacity-60 sm:w-auto"
            >
              Choisir une autre vente
            </button>
          )}
          <button
            type={step === 1 ? 'button' : 'submit'}
            form={step === 2 ? 'global-payment-form' : undefined}
            onClick={step === 1 ? continueToPayment : undefined}
            disabled={step === 1
              ? (loading && !hasSalesData) || !selectedSaleData
              : isSubmitting || (loading && !hasSalesData) || !selectedSaleData}
            className="ms-button ms-button-primary ms-button-md w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {step === 1 ? (
              <>
                Continuer vers le paiement
                <ArrowRight size={16} aria-hidden="true" />
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Check size={18} />
                Enregistrer le paiement
              </>
            )}
          </button>
        </>
      }
    >
      {loading && !hasSalesData ? (
        <PaymentModalSkeleton />
      ) : loadError && !hasSalesData ? (
        <div className="fluent-card-filled p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)' }}>
            <AlertCircle size={22} />
          </div>
          <h3 className="fui-subtitle2 mt-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Chargement impossible</h3>
          <p className="fui-body1 mx-auto mt-2 max-w-sm" style={{ color: 'var(--colorNeutralForeground2)' }}>{loadError}</p>
          <button
            type="button"
            onClick={fetchOpenSales}
            className="ms-button ms-button-primary ms-button-md mx-auto mt-5"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {loading && <p role="status" className="text-xs text-[var(--ms-text-muted)]">Actualisation des ventes à encaisser…</p>}
          {loadError && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radiusMedium)] bg-[var(--colorStatusWarningBackground1)] px-3 py-2 text-xs text-[var(--colorStatusWarningForeground1)]">
              <span>Les ventes affichées n’ont pas pu être actualisées.</span>
              <button type="button" onClick={fetchOpenSales} className="font-semibold underline underline-offset-2">Réessayer</button>
            </div>
          )}
          <ol aria-label="Étapes de l’encaissement" className="grid grid-cols-2 gap-3">
            {[
              { number: 1, title: 'Vente', description: 'Choisir la créance' },
              { number: 2, title: 'Paiement', description: 'Saisir l’encaissement' },
            ].map(({ number, title: stepTitle, description }) => {
              const isComplete = step > number;
              const isCurrent = step === number;
              return (
                <li
                  key={number}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-w-0 items-center gap-3 rounded-[var(--radiusLarge)] border p-3 ${
                    isCurrent
                      ? 'border-[var(--ms-blue)] bg-[var(--ms-blue-soft)]'
                      : 'border-[var(--ms-border)] bg-[var(--ms-white)]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isCurrent || isComplete ? 'bg-[var(--ms-blue)] text-white' : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]'
                    }`}
                  >
                    {isComplete ? <Check size={17} aria-label="Terminé" /> : number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--ms-text-strong)]">{stepTitle}</span>
                    <span className="block truncate text-xs text-[var(--ms-text-muted)]">{description}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatTile icon={<ReceiptText size={14} />} label="Ventes à encaisser" value={paymentStats.count} tone="brand" />
                <StatTile icon={<Banknote size={14} />} label="Solde restant total" value={formatAmount(paymentStats.outstanding)} tone="success" />
              </div>

              <div className="fluent-card-filled p-3">
                <label htmlFor="global-payment-sale-search" className="sr-only">
                  Rechercher par client, téléphone, vendeur ou référence de vente
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--colorNeutralForeground3)' }} />
                  <input
                    id="global-payment-sale-search"
                    type="search"
                    value={saleSearch}
                    onChange={(e) => setSaleSearch(e.target.value)}
                    placeholder="Client, téléphone, vendeur ou référence..."
                    className="min-h-[44px] w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 pl-10 text-sm outline-none transition focus:border-[var(--ms-blue)] focus:bg-[var(--ms-white)] focus:ring-2 focus:ring-[var(--ms-blue)]/20"
                    style={{ color: 'var(--colorNeutralForeground1)' }}
                  />
                </div>
                <p className="fui-caption1 mt-3 px-1" aria-live="polite" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {paymentStats.filtered} vente{paymentStats.filtered > 1 ? 's' : ''} correspondante{paymentStats.filtered > 1 ? 's' : ''}
                </p>
              </div>

              <div className="max-h-[52dvh] space-y-3 overflow-y-auto pr-1">
                {payableSales.length === 0 ? (
                  <div className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                    <CreditCard className="mx-auto h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} aria-hidden="true" />
                    <p className="fui-body1-strong mt-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Aucune vente à encaisser</p>
                    <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Toutes les ventes actives sont soldées.</p>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                    <Search className="mx-auto h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} aria-hidden="true" />
                    <p className="fui-body1-strong mt-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Aucun résultat</p>
                    <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Essayez un autre nom, téléphone ou numéro de vente.</p>
                  </div>
                ) : (
                  filteredSales.map((sale) => (
                    <SaleChoiceCard
                      key={sale._id}
                      sale={sale}
                      active={selectedSale === sale._id}
                      expanded={expandedSaleId === sale._id}
                      onSelect={() => setSelectedSale(sale._id)}
                      onToggleExpand={() => setExpandedSaleId((prev) => (prev === sale._id ? null : sale._id))}
                    />
                  ))
                )}
              </div>
            </div>
          ) : selectedSaleData ? (
            <section className="min-w-0 space-y-4" aria-label="Détails du paiement">
              <div className="flex items-start justify-between gap-3 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                <div className="min-w-0">
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Vente sélectionnée</p>
                  <p className="mt-1 truncate fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    {selectedSaleData.client?.name || 'Client non spécifié'}
                  </p>
                  <p className="mt-0.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                    Vente {selectedSaleData.reference || `#${String(selectedSaleData._id).slice(-6)}`}
                    {' · '}{formatShortDate(selectedSaleData.saleDate || selectedSaleData.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>À encaisser</p>
                  <p className="mt-1 fui-body1-strong tabular-nums" style={{ color: 'var(--colorStatusDangerForeground1)' }}>
                    {formatAmount(calculateBalance(selectedSaleData))}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="min-w-0">
                {/* Selected sale — product breakdown (complements the totals/history in the form below) */}
                {Array.isArray(selectedSaleData.products) && selectedSaleData.products.length > 0 && (
                  <div className="fluent-card-filled p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 fui-caption1-strong uppercase" style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.04em' }}>
                        <Package className="h-3.5 w-3.5" /> Produits de la vente
                      </p>
                      <Link
                        to={`/sales/${selectedSaleData._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-[var(--radiusMedium)] px-2 py-1 fui-caption1-strong transition-colors hover:bg-[var(--ms-bg-subtle)]"
                        style={{ color: 'var(--colorBrandForeground1)' }}
                        title="Voir le détail de la vente"
                      >
                        Voir la vente
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {selectedSaleData.products.map((p, i) => (
                        <li key={p._id || i} className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                            {p.product?.name || 'Produit'}
                            <span className="ml-1" style={{ color: 'var(--colorNeutralForeground3)' }}>×{p.quantity}</span>
                          </span>
                          <span className="shrink-0 tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>{formatAmount(lineTotal(p))}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2.5 fui-caption1" style={{ borderColor: 'var(--ms-border)', color: 'var(--colorNeutralForeground3)' }}>
                      <span className="inline-flex items-center gap-1">
                        <ReceiptText className="h-3.5 w-3.5" /> {getSaleTypeText(selectedSaleData.saleType)}
                      </span>
                      {selectedSaleData.user?.name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {selectedSaleData.user.name}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                </div>

                <div>
                  <PaymentForm
                    sale={selectedSaleData}
                    onAddPayment={handleAddPayment}
                    formId="global-payment-form"
                    onSubmittingChange={setIsSubmitting}
                    onDirtyChange={setIsDirty}
                  />
                </div>
              </div>
            </section>
          ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-bg-subtle)] px-6 text-center">
                <Wallet className="h-10 w-10" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <h3 className="fui-subtitle2 mt-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Sélectionnez une vente</h3>
                <p className="fui-body1 mt-2 max-w-sm" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Revenez à la première étape et choisissez une vente avec un solde restant.
                </p>
              </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default GlobalPaymentModal;
