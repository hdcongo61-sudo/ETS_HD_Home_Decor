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
      <div className="h-11 animate-pulse rounded-lg bg-[var(--ms-bg-subtle)]" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
      ))}
    </div>
    <div className="h-96 animate-pulse rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
  </div>
);

const SaleChoiceCard = ({ sale, active, onSelect }) => {
  const balance = calculateBalance(sale);
  const totalPaid = getTotalPaid(sale);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active
          ? 'border-gray-950 bg-gray-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
          : 'border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text-strong)] hover:border-[var(--ms-border-strong)] hover:shadow-[var(--ms-shadow-sm)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {sale.client?.name || 'Client non spécifié'}
          </p>
          <p className={`mt-1 text-xs ${active ? 'text-white/62' : 'text-[var(--ms-text-muted)]'}`}>
            Vente #{String(sale._id || '').slice(-6)} · {formatShortDate(sale.saleDate || sale.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-white/12 text-white' : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)]'}`}>
          Solde
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded-lg px-3 py-2 ${active ? 'bg-white/10' : 'bg-[var(--ms-bg-subtle)]'}`}>
          <span className={active ? 'text-white/60' : 'text-[var(--ms-text-muted)]'}>Restant</span>
          <p className="mt-1 text-sm font-semibold">{formatAmount(balance)}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${active ? 'bg-white/10' : 'bg-[var(--ms-bg-subtle)]'}`}>
          <span className={active ? 'text-white/60' : 'text-[var(--ms-text-muted)]'}>Payé</span>
          <p className="mt-1 text-sm font-semibold">{formatAmount(totalPaid)}</p>
        </div>
      </div>
    </button>
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
      icon={<Wallet size={20} />}
      contentClassName="bg-[var(--ms-bg-subtle)]/80"
      footerClassName="bg-white/96"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="min-h-[44px] w-full rounded-lg border border-[var(--ms-border-strong)] bg-[var(--ms-white)] px-4 py-3 font-semibold text-[var(--ms-text)] transition-colors hover:bg-[var(--ms-bg-subtle)] disabled:opacity-60 sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-payment-form"
            disabled={isSubmitting || loading || !selectedSaleData}
            className="min-h-[44px] w-full rounded-lg bg-gray-950 px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-[var(--ms-text)] flex items-center justify-center gap-2 sm:w-auto"
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
        <div className="rounded-3xl border border-red-200 bg-[var(--ms-white)] p-6 text-center shadow-[var(--ms-shadow-sm)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--ms-danger)]/10 text-[var(--ms-danger)]">
            <AlertCircle size={22} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[var(--ms-text-strong)]">Chargement impossible</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ms-text)]">{loadError}</p>
          <button
            type="button"
            onClick={fetchOpenSales}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <aside className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 shadow-[var(--ms-shadow-sm)]">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--ms-text-muted)]">
                  <ReceiptText size={14} />
                  Ventes ouvertes
                </div>
                <p className="mt-1 text-xl font-semibold text-[var(--ms-text-strong)]">{paymentStats.count}</p>
              </div>
              <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-4 shadow-[var(--ms-shadow-sm)]">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--ms-text-muted)]">
                  <Banknote size={14} />
                  Solde total
                </div>
                <p className="mt-1 text-lg font-semibold text-[var(--ms-text-strong)]">{formatAmount(paymentStats.outstanding)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 shadow-[var(--ms-shadow-sm)]">
              <label htmlFor="global-payment-sale-search" className="sr-only">
                Rechercher une vente
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ms-text-muted)]" />
                <input
                  id="global-payment-sale-search"
                  type="search"
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  placeholder="Client ou numéro de vente..."
                  className="min-h-[44px] w-full rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-3 pl-10 text-sm text-[var(--ms-text-strong)] outline-none transition focus:border-gray-400 focus:bg-[var(--ms-white)] focus:ring-4 focus:ring-gray-900/5"
                />
              </div>
              <p className="mt-3 px-1 text-xs text-[var(--ms-text-muted)]">
                {paymentStats.filtered} résultat{paymentStats.filtered > 1 ? 's' : ''} disponible{paymentStats.filtered > 1 ? 's' : ''}
              </p>
            </div>

            <div className="max-h-[42dvh] space-y-3 overflow-y-auto pr-1 lg:max-h-[min(62dvh,620px)]">
              {payableSales.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                  <CreditCard className="mx-auto h-8 w-8 text-[var(--ms-text-muted)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--ms-text-strong)]">Aucune vente à encaisser</p>
                  <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Toutes les ventes sont soldées.</p>
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-white)] p-6 text-center">
                  <Search className="mx-auto h-8 w-8 text-[var(--ms-text-muted)]" />
                  <p className="mt-3 text-sm font-semibold text-[var(--ms-text-strong)]">Aucun résultat</p>
                  <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Essayez un autre nom ou numéro de vente.</p>
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
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--ms-border-strong)] bg-[var(--ms-bg-subtle)] px-6 text-center">
                <Wallet className="h-10 w-10 text-[var(--ms-text-muted)]" />
                <h3 className="mt-4 text-base font-semibold text-[var(--ms-text-strong)]">Sélectionnez une vente</h3>
                <p className="mt-2 max-w-sm text-sm text-[var(--ms-text-muted)]">
                  Le formulaire de paiement s’affiche ici avec le solde, l’historique et les options de livraison.
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
