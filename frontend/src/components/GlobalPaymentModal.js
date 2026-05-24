// components/GlobalPaymentModal.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useModal } from '../context/ModalContext';
import api from '../services/api';
import Modal from './Modal';
import { PaymentForm } from './PaymentModal';

const formatAmount = (value) => `${Number(value || 0).toFixed(0)} CFA`;

const calculateBalance = (sale) => {
  const totalPaid = sale?.payments?.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) || 0;
  return Math.max((Number(sale?.totalAmount) || 0) - totalPaid, 0);
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
      subtitle="Même formulaire que les détails de vente: date réelle, méthode, solde et livraison automatique."
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors touch-manipulation disabled:opacity-70"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-payment-form"
            disabled={isSubmitting || loading || !selectedSaleData}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Traitement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-600">Chargement des ventes…</span>
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={fetchOpenSales}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Vente à régler
            </label>
            <input
              type="search"
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
              placeholder="Rechercher par client ou numéro de vente…"
              className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
            <select
              value={selectedSale}
              onChange={(e) => setSelectedSale(e.target.value)}
              className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">Sélectionner une vente...</option>
              {filteredSales.map((sale) => (
                <option key={sale._id} value={sale._id}>
                  {sale.client?.name || 'Client non spécifié'} - Vente #{sale._id.slice(-6)} - Solde: {formatAmount(calculateBalance(sale))}
                </option>
              ))}
            </select>
            {payableSales.length === 0 && (
              <p className="text-sm text-gray-500">Aucune vente avec solde restant.</p>
            )}
          </div>

          {selectedSaleData ? (
            <PaymentForm
              sale={selectedSaleData}
              onAddPayment={handleAddPayment}
              formId="global-payment-form"
              onSubmittingChange={setIsSubmitting}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Sélectionnez une vente pour afficher le formulaire de paiement.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default GlobalPaymentModal;
