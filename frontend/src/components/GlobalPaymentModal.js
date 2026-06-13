// components/GlobalPaymentModal.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { useModal } from '../context/ModalContext';
import api from '../services/api';
import Modal from './Modal';
import { PaymentForm } from './PaymentModal';

const formatAmount = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR').replace(/\s/g, '.')} CFA`;

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
  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
    <div className="space-y-3">
      <div className="h-11 animate-pulse rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)]" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
      ))}
    </div>
    <div className="h-96 animate-pulse rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
  </div>
);

const SaleChoiceCard = ({ sale, active, onSelect }) => {
  const balance = calculateBalance(sale);
  const totalPaid = getTotalPaid(sale);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`fluent-card-filled w-full p-4 text-left transition ${
        active
          ? 'ring-2 ring-[var(--ms-blue)]'
          : 'hover:border-[var(--ms-border-strong)] hover:shadow-[var(--ms-shadow-sm)]'
      }`}
      style={active ? { borderColor: 'var(--ms-blue)', background: 'var(--ms-blue-soft)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
            {sale.client?.name || 'Client non spécifié'}
          </p>
          <p className="fui-caption1 mt-0.5 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Vente #{String(sale._id || '').slice(-6)} · {formatShortDate(sale.saleDate || sale.createdAt)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 fui-caption1-strong"
          style={{ background: active ? 'var(--ms-blue)' : 'var(--colorNeutralBackground3)', color: active ? '#fff' : 'var(--colorNeutralForeground2)' }}
        >
          Solde
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
          <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Restant</span>
          <p className="fui-body1-strong mt-0.5" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{formatAmount(balance)}</p>
        </div>
        <div className="rounded-[var(--radiusMedium)] px-3 py-2" style={{ background: 'var(--colorNeutralBackground1)' }}>
          <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Payé</span>
          <p className="fui-body1-strong mt-0.5" style={{ color: 'var(--colorNeutralForeground1)' }}>{formatAmount(totalPaid)}</p>
        </div>
      </div>
    </button>
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
  const [saleSearch, setSaleSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOpenSales = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const { data } = await api.get('/sales', { params: { summary: 'list' } });
      setSales(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching open sales:', error);
      setSales([]);
      setLoadError(error.response?.data?.message || 'Impossible de charger les ventes à payer.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchOpenSales();
    setSelectedSale('');
    setSaleSearch('');
    setIsSubmitting(false);
  }, [fetchOpenSales, isOpen]);

  const payableSales = useMemo(
    () => sales.filter((sale) => calculateBalance(sale) > 0),
    [sales]
  );

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase();
    if (!search) return payableSales;

    return payableSales.filter((sale) => {
      const clientName = sale.client?.name || '';
      const saleId = sale._id || '';
      return (
        clientName.toLowerCase().includes(search) ||
        saleId.toLowerCase().includes(search)
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
    closeModal();
    window.dispatchEvent(new CustomEvent('paymentCreated'));
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Ajouter un paiement"
      subtitle="Choisissez une vente ouverte, puis encaissez le paiement."
      size="xl"
      mobileFullscreen
      suppressGlobal={false}
      icon={<Wallet size={20} />}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="ms-button ms-button-secondary ms-button-md w-full disabled:opacity-60 sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-payment-form"
            disabled={isSubmitting || loading || !selectedSaleData}
            className="ms-button ms-button-primary ms-button-md w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Check size={18} />
                Enregistrer
              </>
            )}
          </button>
        </>
      }
    >
      {loading ? (
        <PaymentModalSkeleton />
      ) : loadError ? (
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <aside className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatTile icon={<ReceiptText size={14} />} label="Ventes ouvertes" value={paymentStats.count} tone="brand" />
              <StatTile icon={<Banknote size={14} />} label="Solde total" value={formatAmount(paymentStats.outstanding)} tone="success" />
            </div>

            <div className="fluent-card-filled p-3">
              <label htmlFor="global-payment-sale-search" className="sr-only">
                Rechercher une vente
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  id="global-payment-sale-search"
                  type="search"
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  placeholder="Client ou numéro de vente..."
                  className="min-h-[44px] w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 pl-10 text-sm outline-none transition focus:border-[var(--ms-blue)] focus:bg-[var(--ms-white)] focus:ring-2 focus:ring-[var(--ms-blue)]/20"
                  style={{ color: 'var(--colorNeutralForeground1)' }}
                />
              </div>
              <p className="fui-caption1 mt-3 px-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                {paymentStats.filtered} résultat{paymentStats.filtered > 1 ? 's' : ''} disponible{paymentStats.filtered > 1 ? 's' : ''}
              </p>
            </div>

            <div className="max-h-[42dvh] space-y-3 overflow-y-auto pr-1 lg:max-h-[min(62dvh,620px)]">
              {payableSales.length === 0 ? (
                <div className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                  <CreditCard className="mx-auto h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} />
                  <p className="fui-body1-strong mt-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Aucune vente à encaisser</p>
                  <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Toutes les ventes sont soldées.</p>
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                  <Search className="mx-auto h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} />
                  <p className="fui-body1-strong mt-3" style={{ color: 'var(--colorNeutralForeground1)' }}>Aucun résultat</p>
                  <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Essayez un autre nom ou numéro de vente.</p>
                </div>
              ) : (
                filteredSales.map((sale) => (
                  <SaleChoiceCard
                    key={sale._id}
                    sale={sale}
                    active={selectedSale === sale._id}
                    onSelect={() => setSelectedSale(sale._id)}
                  />
                ))
              )}
            </div>
          </aside>

          <section className="min-w-0">
            {selectedSaleData ? (
              <PaymentForm
                sale={selectedSaleData}
                onAddPayment={handleAddPayment}
                formId="global-payment-form"
                onSubmittingChange={setIsSubmitting}
              />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-bg-subtle)] px-6 text-center">
                <Wallet className="h-10 w-10" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <h3 className="fui-subtitle2 mt-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Sélectionnez une vente</h3>
                <p className="fui-body1 mt-2 max-w-sm" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Le formulaire de paiement s'affiche ici avec le solde, l'historique et les options de livraison.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
};

export default GlobalPaymentModal;
