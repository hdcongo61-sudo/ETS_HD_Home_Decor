import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { clientPath, productPath } from '../utils/paths';
import { getSaleTypeClass, getSaleTypeText } from '../utils/saleUtils';
import PaymentModal from '../components/PaymentModal';
import Modal from './Modal';
import { Bar } from 'react-chartjs-2';
import AuthContext from '../context/AuthContext';
import useAutoClearMessage from '../hooks/useAutoClearMessage';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

import AppLoader from './AppLoader';

// Enregistrer les composants de Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const SaleDetailPage = () => {
    const { id } = useParams();
    const { auth } = useContext(AuthContext);
    const isAdmin = auth.user?.isAdmin || false;
    const navigate = useNavigate();
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [mobileHistoryTab, setMobileHistoryTab] = useState('payments');
    const [message, setMessage] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
    const [showProfitSections, setShowProfitSections] = useState(true);

    useAutoClearMessage(message, setMessage);
    const [reminderDate, setReminderDate] = useState('');
    const [reminderNote, setReminderNote] = useState('');
    const [deliveryStatus, setDeliveryStatus] = useState('pending');
    const [deliveryNote, setDeliveryNote] = useState('');
    const [productNames, setProductNames] = useState({});

    useEffect(() => {
        const fetchSale = async () => {
            try {
                setLoading(true);
                const response = await api.get(`/sales/${id}`);
                const saleData = response.data;
                setSale(saleData);

                // Set reminder data if it exists
                if (saleData.paymentReminder?.reminderDate) {
                    setReminderDate(new Date(saleData.paymentReminder.reminderDate).toISOString().slice(0, 16));
                }
                if (saleData.paymentReminder?.reminderNote) {
                    setReminderNote(saleData.paymentReminder.reminderNote);
                }

                // Set delivery data if it exists
                if (saleData.deliveryStatus) {
                    setDeliveryStatus(saleData.deliveryStatus);
                }
                if (saleData.deliveryNote) {
                    setDeliveryNote(saleData.deliveryNote);
                }

                // Extract product IDs and user IDs from modification history
                if (saleData.modificationHistory) {
                    const productIds = new Set();

                    saleData.modificationHistory.forEach(history => {
                        if (history.changes && history.changes.products) {
                            history.changes.products.forEach(productChange => {
                                const productId = productChange.product?._id || productChange.product;
                                if (productId) {
                                    productIds.add(productId);
                                }
                            });
                        }
                    });

                    if (productIds.size > 0) {
                        fetchProductNames(Array.from(productIds));
                    }
                }
            } catch (err) {
                setError('Erreur de chargement de la vente');
                console.error('Error fetching sale:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSale();
    }, [id]);

    // Calculate total profit for the sale
    const calculateTotalProfit = () => {
        if (!sale?.products) return 0;
        
        return sale.products.reduce((total, item) => {
            const costPrice = item.product?.costPrice || 0;
            const sellingPrice = item.priceAtSale || 0;
            const quantity = item.quantity || 0;
            const profitPerItem = sellingPrice - costPrice;
            return total + (profitPerItem * quantity);
        }, 0);
    };

    // Calculate profit margin percentage
    const calculateProfitMargin = () => {
        const totalProfit = calculateTotalProfit();
        const totalRevenue = sale?.totalAmount || 0;
        
        if (totalRevenue === 0) return 0;
        return (totalProfit / totalRevenue) * 100;
    };

    // Calculate profit per product
    const getProductProfit = (item) => {
        const costPrice = item.product?.costPrice || 0;
        const sellingPrice = item.priceAtSale || 0;
        const quantity = item.quantity || 0;
        const profitPerItem = sellingPrice - costPrice;
        return {
            perItem: profitPerItem,
            total: profitPerItem * quantity,
            margin: costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0
        };
    };

    const mergeSaleState = (incomingSale) => {
        const resolveId = (value) => {
            if (!value) return null;
            if (typeof value === 'string') return value;
            return value._id || null;
        };

        const previousProducts = Array.isArray(sale?.products) ? sale.products : [];
        const mergedProducts = Array.isArray(incomingSale?.products)
            ? incomingSale.products.map((item) => {
                const productId = resolveId(item?.product);
                const previousItem = previousProducts.find((entry) => resolveId(entry?.product) === productId);
                return {
                    ...previousItem,
                    ...item,
                    product: typeof item?.product === 'object' ? item.product : previousItem?.product
                };
            })
            : previousProducts;

        const previousPayments = new Map(
            (Array.isArray(sale?.payments) ? sale.payments : []).map((payment) => [String(payment._id), payment])
        );
        const mergedPayments = (Array.isArray(incomingSale?.payments) ? incomingSale.payments : (sale?.payments || [])).map((payment) => {
            const previousPayment = previousPayments.get(String(payment._id));
            return {
                ...previousPayment,
                ...payment,
                user: typeof payment?.user === 'object' ? payment.user : previousPayment?.user,
                formattedDate: payment?.paymentDate
                    ? new Date(payment.paymentDate).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : previousPayment?.formattedDate
            };
        });

        const totalAmount = Number(incomingSale?.totalAmount ?? sale?.totalAmount ?? 0);
        const totalPaid = mergedPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

        return {
            ...sale,
            ...incomingSale,
            client: typeof incomingSale?.client === 'object' ? { ...(sale?.client || {}), ...incomingSale.client } : sale?.client,
            products: mergedProducts,
            payments: mergedPayments,
            totalPaid,
            balance: totalAmount - totalPaid,
            formattedDate: incomingSale?.saleDate
                ? new Date(incomingSale.saleDate).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : sale?.formattedDate
        };
    };

    const fetchProductNames = async (productIds) => {
        try {
            const namesMap = {};
            
            // Fetch each product's details
            for (const rawId of productIds) {
                const productId = typeof rawId === 'object'
                    ? (rawId._id || rawId.toString?.() || '')
                    : rawId;

                if (!productId) {
                    continue;
                }

                const key = productId.toString();

                try {
                    const response = await api.get(`/products/${key}`);
                    namesMap[key] = response.data.name;
                } catch (error) {
                    console.error(`Error fetching product ${key}:`, error);
                    namesMap[key] = "Produit inconnu";
                }
            }
            
            setProductNames(namesMap);
        } catch (error) {
            console.error('Error fetching product names:', error);
        }
    };

    const handleAddPayment = async (paymentData) => {
        try {
            const { data } = await api.post(`/sales/${id}/payments`, paymentData);
            setSale(mergeSaleState(data));
            setMessage('Paiement ajouté avec succès!');
            setShowPaymentModal(false);
        } catch (error) {
            console.error('Payment error:', error.response?.data);
            setMessage('Erreur: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce paiement ?")) {
            try {
                setIsDeleting(true);
                const { data } = await api.delete(`/sales/${id}/payments/${paymentId}`);
                setSale(mergeSaleState(data.sale));
                setMessage('Paiement supprimé avec succès!');
            } catch (error) {
                console.error('Delete payment error:', error.response?.data);
                setMessage('Erreur: ' + (error.response?.data?.message || error.message));
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleSetReminder = async () => {
        try {
            const response = await api.put(`/sales/${id}/reminder`, {
                reminderDate: reminderDate ? new Date(reminderDate) : null,
                reminderNote: reminderNote || '',
                isSet: !!reminderDate
            });

            setSale(mergeSaleState(response.data));
            setMessage('Rappel mis à jour avec succès!');
            setShowReminderModal(false);
        } catch (error) {
            console.error('Set reminder error:', error.response?.data);
            setMessage('Erreur: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleSendReminder = async () => {
        if (window.confirm("Envoyer le rappel de paiement au client maintenant ?")) {
            try {
                const response = await api.post(`/sales/${id}/send-reminder`);
                setSale(mergeSaleState(response.data));
                setMessage('Rappel envoyé avec succès!');
            } catch (error) {
                console.error('Send reminder error:', error.response?.data);
                setMessage('Erreur: ' + (error.response?.data?.message || error.message));
            }
        }
    };

    const handleDeleteReminder = async () => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce rappel ?")) {
            try {
                const { data } = await api.delete(`/sales/${id}/reminder`);

                setSale(mergeSaleState(data));
                setReminderDate('');
                setReminderNote('');
                setMessage('Rappel supprimé avec succès!');
            } catch (error) {
                console.error('Delete reminder error:', error.response?.data);
                setMessage('Erreur: ' + (error.response?.data?.message || error.message));
            }
        }
    };

    const handleUpdateDelivery = async () => {
        try {
            setMessage('Mise à jour en cours...');
            setIsUpdatingDelivery(true);

            const payload = {
                deliveryStatus,
                deliveryNote: deliveryNote || '',
                deliveryDate: deliveryStatus === 'delivered' ? new Date().toISOString() : null
            };

            const { data } = await api.put(`/sales/${id}/delivery`, payload);
            const nextDeliveryState = {
                deliveryStatus: data?.deliveryStatus ?? payload.deliveryStatus,
                deliveryNote: data?.deliveryNote ?? payload.deliveryNote,
                deliveryDate: data?.deliveryDate ?? payload.deliveryDate,
                updatedAt: data?.updatedAt
            };

            setSale(mergeSaleState(nextDeliveryState));
            setMessage('✅ Statut de livraison mis à jour avec succès!');
            setShowDeliveryModal(false);
        } catch (error) {
            console.error('Erreur:', error);
            setMessage('❌ Erreur: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsUpdatingDelivery(false);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
            case 'pending': return 'bg-blue-100 text-blue-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'completed': return 'Payée';
            case 'partially_paid': return 'Partiellement payée';
            case 'pending': return 'En attente';
            case 'cancelled': return 'Annulée';
            default: return status;
        }
    };

    const getDeliveryStatusClass = (status) => {
        switch (status) {
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'not_delivered': return 'bg-red-100 text-red-800';
            case 'pending':
            default: return 'bg-blue-100 text-blue-800';
        }
    };

    const getDeliveryStatusText = (status) => {
        switch (status) {
            case 'delivered': return 'Livrée';
            case 'not_delivered': return 'Non livrée';
            case 'pending':
            default: return 'En attente de livraison';
        }
    };

    const getUserRole = (user) => {
        if (!user) return null;
        if (user.isAdmin) return 'admin';
        return user.role || 'user';
    };

    const getPaymentUser = (payment) => {
        if (payment?.user && typeof payment.user === 'object') {
            return payment.user;
        }
        if (sale?.user && typeof sale.user === 'object') {
            return sale.user;
        }
        return null;
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Admin</span>;
            case 'manager': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Manager</span>;
            case 'cashier': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Caissier</span>;
            case 'user': return <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full">Utilisateur</span>;
            default: return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Utilisateur</span>;
        }
    };

    const isReminderOverdue = () => {
        if (!sale?.paymentReminder?.isSet || sale.paymentReminder.status === 'cancelled') {
            return false;
        }
        return new Date() > new Date(sale.paymentReminder.reminderDate) &&
            sale.paymentReminder.status === 'pending';
    };

    const isReminderDueToday = () => {
        if (!sale?.paymentReminder?.isSet || sale.paymentReminder.status !== 'pending') {
            return false;
        }
        const today = new Date();
        const reminderDate = new Date(sale.paymentReminder.reminderDate);
        return today.toDateString() === reminderDate.toDateString();
    };

    const formatReminderDate = (date) => {
        return new Date(date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatModificationDate = (date) => {
        return new Date(date).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getHistoryProductName = (change) => {
        const productId = change.product && typeof change.product === 'object'
            ? (change.product._id || change.product.toString?.())
            : change.product;
        return (change.product && change.product.name)
            || (productId ? productNames[productId.toString()] : null)
            || 'Produit inconnu';
    };

    const formatHistoryPrice = (value) =>
        `${(Number(value) || 0).toLocaleString('fr-FR')} CFA`;

    const getHistoryProductStatus = (change) => {
        const oldQuantity = Number(change.oldQuantity || 0);
        const newQuantity = Number(change.newQuantity || 0);
        if (oldQuantity > 0 && newQuantity === 0) return 'removed';
        if (oldQuantity === 0 && newQuantity > 0) return 'added';
        if (
            oldQuantity !== newQuantity ||
            Number(change.oldPrice || 0) !== Number(change.newPrice || 0)
        ) {
            return 'changed';
        }
        return 'unchanged';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[16rem]">
                <AppLoader fullScreen={false} text="Chargement de la vente…" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 mx-4 mt-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">Vente non trouvée</div>
        );
    }

    const totalProfit = calculateTotalProfit();
    const profitMargin = calculateProfitMargin();

    // Chart data for payment history
    const paymentChartData = {
        labels: sale.payments.map((_, index) => `Paiement ${index + 1}`),
        datasets: [
            {
                label: 'Montant (CFA)',
                data: sale.payments.map(p => p.amount),
                backgroundColor: 'rgba(0, 122, 255, 0.8)',
                borderRadius: 6,
            }
        ]
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
            <div className="max-w-6xl mx-auto px-4 sm:px-5 md:px-6 py-5 sm:py-6 space-y-5 sm:space-y-6">
                {/* Back + Page title */}
                <header className="flex flex-col gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/sales')}
                        className="inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-3.5 py-2 text-sm font-medium text-indigo-600 shadow-sm ring-1 ring-indigo-100 transition hover:text-indigo-700 hover:ring-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour aux ventes
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </span>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Détails de la vente</h1>
                    </div>
                </header>

                {message && (
                    <div
                        role="alert"
                        className={`p-4 rounded-xl flex items-center gap-3 ${message.includes('succès') || message.includes('✅') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}
                    >
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {message.includes('succès') || message.includes('✅') ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            )}
                        </svg>
                        <span className="text-sm sm:text-base">{message}</span>
                    </div>
                )}

                {/* Sale header card */}
                <section className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:justify-between sm:items-start">
                            <div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                                        Vente #{sale._id?.substring(18) || 'N/A'}
                                    </h2>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass(sale.status)}`}>
                                        {getStatusText(sale.status)}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getSaleTypeClass(sale.saleType)}`}>
                                        {getSaleTypeText(sale.saleType)}
                                    </span>
                                    {Array.isArray(sale.modificationHistory) && sale.modificationHistory.length > 0 && (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                            Modifiée
                                        </span>
                                    )}
                                    {sale.status === 'completed' && (
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getDeliveryStatusClass(sale.deliveryStatus)}`}>
                                            {getDeliveryStatusText(sale.deliveryStatus)}
                                        </span>
                                    )}
                                </div>
                                <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 0 002 2z" />
                                    </svg>
                                    {sale.formattedDate || new Date(sale.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end">
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setShowProfitSections((prev) => !prev)}
                                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-gray-700 sm:col-span-1 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {showProfitSections ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.004-3.196 3.565-5.675 6.73-6.588M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.364 6.364L3.636 5.636" />
                                            ) : (
                                                <>
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </>
                                            )}
                                        </svg>
                                        <span className="sm:hidden">{showProfitSections ? 'Masquer marge' : 'Afficher marge'}</span>
                                        <span className="hidden sm:inline">{showProfitSections ? 'Masquer bénéfice' : 'Afficher bénéfice'}</span>
                                    </button>
                                )}
                                {isAdmin && sale.status !== 'cancelled' && (
                                    <Link
                                        to={`/sales/${sale._id}/edit`}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Modifier
                                    </Link>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(true)}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    disabled={sale.status === 'completed' || sale.status === 'cancelled'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h6m-6 0H6" />
                                    </svg>
                                    <span className="sm:hidden">Paiement</span>
                                    <span className="hidden sm:inline">Ajouter paiement</span>
                                </button>
                                {(sale.status === 'pending' || sale.status === 'partially_paid') && (
                                    <button
                                        type="button"
                                        onClick={() => setShowReminderModal(true)}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-amber-500/20 transition hover:opacity-95 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="sm:hidden">{sale.paymentReminder?.isSet ? 'Rappel' : 'Rappel'}</span>
                                        <span className="hidden sm:inline">{sale.paymentReminder?.isSet ? 'Modifier rappel' : 'Définir rappel'}</span>
                                    </button>
                                )}
                                {sale.status === 'completed' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryModal(true)}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span className="sm:hidden">Livraison</span>
                                        <span className="hidden sm:inline">Statut livraison</span>
                                    </button>
                                )}
                                {sale.modificationHistory && sale.modificationHistory.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowHistoryModal(true)}
                                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-gray-900/15 transition hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 sm:col-span-1 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Historique
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Reminder Section */}
                    {sale.paymentReminder?.isSet && (
                        <div className={`mx-4 sm:mx-6 mb-6 p-4 rounded-xl border ${isReminderOverdue()
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : sale.paymentReminder.status === 'sent'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : isReminderDueToday()
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                            }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </span>
                                    <div className="min-w-0">
                                        <h4 className="font-medium text-gray-900 dark:text-white">Rappel de paiement</h4>
                                        <p className="text-sm mt-0.5">
                                            {sale.paymentReminder.status === 'sent' ? (
                                                <span className="text-green-600 dark:text-green-400">
                                                    Envoyé le {formatReminderDate(sale.paymentReminder.sentAt)}
                                                </span>
                                            ) : isReminderOverdue() ? (
                                                <span className="text-red-600 dark:text-red-400 font-medium">
                                                    En retard – {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            ) : isReminderDueToday() ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                    Aujourd'hui – {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            ) : (
                                                <span className="text-indigo-600 dark:text-indigo-400">
                                                    Programmé pour {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            )}
                                        </p>
                                        {sale.paymentReminder.reminderNote && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sale.paymentReminder.reminderNote}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {sale.paymentReminder.status === 'pending' && (
                                        <button
                                            type="button"
                                            onClick={handleSendReminder}
                                            className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                                            title="Envoyer le rappel maintenant"
                                        >
                                            Envoyer
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowReminderModal(true)}
                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                        title="Modifier le rappel"
                                        aria-label="Modifier le rappel"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteReminder}
                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:text-red-700 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                        title="Supprimer le rappel"
                                        aria-label="Supprimer le rappel"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delivery Status Section */}
                    {sale.status === 'completed' && (
                        <div className={`mx-4 sm:mx-6 mb-6 p-4 rounded-xl border ${sale.deliveryStatus === 'delivered'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : sale.deliveryStatus === 'not_delivered'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                            }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2M5 8a2 2 0 011-2h12a2 2 0 011 2m-2 6h.01M17 16h.01" />
                                        </svg>
                                    </span>
                                    <div className="min-w-0">
                                        <h4 className="font-medium text-gray-900 dark:text-white">Statut de livraison</h4>
                                        <p className="text-sm mt-0.5">
                                            {sale.deliveryStatus === 'delivered' ? (
                                                <span className="text-green-600 dark:text-green-400 font-medium">
                                                    Livré le {sale.deliveryDate ? new Date(sale.deliveryDate).toLocaleDateString('fr-FR') : '—'}
                                                </span>
                                            ) : sale.deliveryStatus === 'not_delivered' ? (
                                                <span className="text-red-600 dark:text-red-400 font-medium">Non livré</span>
                                            ) : (
                                                <span className="text-indigo-600 dark:text-indigo-400">En attente de livraison</span>
                                            )}
                                        </p>
                                        {sale.deliveryNote && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{sale.deliveryNote}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowDeliveryModal(true)}
                                    className="min-w-[44px] min-h-[44px] w-fit flex items-center justify-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors px-3"
                                    title="Modifier le statut de livraison"
                                    aria-label="Modifier le statut de livraison"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="text-sm font-medium sm:hidden">Modifier</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Note Section */}
                    {sale.note && (
                        <div className="mx-4 sm:mx-6 mb-6">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700">
                                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </span>
                                Note
                            </h3>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                                <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{sale.note}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-4 sm:px-6">
                        {/* Informations client */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                Client
                            </h3>

                            {sale.client ? (
                                <div className="space-y-2">
                                    <div className="flex items-start">
                                        <span className="font-medium text-sm w-20">Nom:</span>
                                        {isAdmin ? (
                                            <Link
                                                to={clientPath(sale.client)}
                                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center transition-colors"
                                            >
                                                {sale.client.name}
                                                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </Link>
                                        ) : (
                                            <span className="text-sm">{sale.client.name}</span>
                                        )}
                                    </div>
                                    {sale.client.email && (
                                        <div className="flex items-start">
                                            <span className="font-medium text-sm w-20">Email:</span>
                                            <a
                                                href={`mailto:${sale.client.email}`}
                                                className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                                            >
                                                {sale.client.email}
                                            </a>
                                        </div>
                                    )}
                                    {sale.client.phone && (
                                        <div className="flex items-start">
                                            <span className="font-medium text-sm w-20">Téléphone:</span>
                                            <a
                                                href={`tel:${sale.client.phone}`}
                                                className="text-blue-600 hover:text-blue-800 text-sm transition-colors"
                                            >
                                                {sale.client.phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">Aucun client associé</p>
                            )}
                        </div>

                        {/* Informations vendeur */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                Vendeur
                            </h3>

                            <div className="space-y-2">
                                <div className="flex items-start">
                                    <span className="font-medium text-sm w-20">Nom:</span>
                                    <span className="text-sm">{sale.user?.name || "Non spécifié"}</span>
                                </div>
                                {sale.user?.email && (
                                    <div className="flex items-start">
                                        <span className="font-medium text-sm w-20">Email:</span>
                                        <span className="text-sm">{sale.user.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Résumé financier */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                Résumé Financier
                            </h3>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm">Total de la vente:</span>
                                    <span className="text-sm font-semibold">{(Number(sale.totalAmount) || 0).toFixed(0)} CFA</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Total payé:</span>
                                    <span className="text-sm font-semibold text-green-600">{(Number(sale.totalPaid) || 0).toFixed(0)} CFA</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="text-sm font-medium">Solde restant:</span>
                                    <span className={`text-sm font-semibold ${Number(sale.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Math.abs(Number(sale.balance) || 0).toFixed(0)} CFA
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section Bénéfices */}
                        {isAdmin && showProfitSections && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40">
                                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                Bénéfices
                            </h3>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm">Bénéfice total:</span>
                                    <span className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalProfit?.toFixed(0)} CFA
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Marge bénéficiaire:</span>
                                    <span className={`text-sm font-semibold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {profitMargin?.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="text-sm font-medium">Coût total:</span>
                                    <span className="text-sm font-semibold text-gray-600">
                                        {(sale.totalAmount - totalProfit)?.toFixed(0)} CFA
                                    </span>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>

                    {/* Produits vendus avec bénéfices */}
                    <div className="mb-6 px-4 sm:px-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                </span>
                                {isAdmin && showProfitSections ? 'Produits vendus avec bénéfices' : 'Produits vendus'}
                            </h3>
                            <span className="text-sm text-gray-500">{sale.products.length} {sale.products.length > 1 ? 'lignes' : 'ligne'}</span>
                        </div>

                        <div className="space-y-4">
                            <div className="md:hidden space-y-3">
                                {sale.products.map((item, index) => {
                                    const profit = getProductProfit(item);
                                    const costPrice = item.product?.costPrice || 0;
                                    const product = item.product;
                                    return (
                                        <div key={`mobile-product-${index}`} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    {product?._id ? (
                                                        <Link
                                                            to={productPath(product)}
                                                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                                                        >
                                                            {product.name || 'Produit'}
                                                        </Link>
                                                    ) : (
                                                        <p className="text-sm font-semibold text-gray-900">Produit supprimé</p>
                                                    )}
                                                    <p className="text-xs text-gray-500">
                                                        Prix unitaire : <span className="font-medium text-gray-900">{item.priceAtSale?.toFixed(0)} CFA</span>
                                                    </p>
                                                </div>
                                                <span className="text-sm text-gray-600">{item.quantity}×</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-500">
                                                {isAdmin && showProfitSections && (
                                                    <div>
                                                        <div>Profit unitaire</div>
                                                        <div className={`font-semibold ${profit.perItem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {costPrice > 0 ? `${profit.perItem?.toFixed(0)} CFA` : 'N/A'}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <div>Total</div>
                                                    <div className="font-semibold text-gray-900">
                                                        {(item.quantity * item.priceAtSale)?.toFixed(0)} CFA
                                                    </div>
                                                </div>
                                                {isAdmin && showProfitSections && (
                                                    <>
                                                        <div>
                                                            <div>Profit total</div>
                                                            <div className={`font-semibold ${profit.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {costPrice > 0 ? `${profit.total?.toFixed(0)} CFA` : 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div>Marge</div>
                                                            <div className={`font-semibold ${profit.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {costPrice > 0 ? `${profit.margin?.toFixed(1)}%` : 'N/A'}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="hidden md:block">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                                                {isAdmin && showProfitSections && (
                                                    <>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coût unitaire</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bénéfice unit.</th>
                                                    </>
                                                )}
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                                {isAdmin && showProfitSections && (
                                                    <>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bénéfice total</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marge</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {sale.products.map((item, index) => {
                                                const profit = getProductProfit(item);
                                                const costPrice = item.product?.costPrice || 0;
                                                const product = item.product;
                                                return (
                                                    <tr key={index}>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            {product?._id ? (
                                                                <Link
                                                                    to={productPath(product)}
                                                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                                                >
                                                                    {product.name || 'Produit'}
                                                                </Link>
                                                            ) : (
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    Produit supprimé
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {item.priceAtSale?.toFixed(0)} CFA
                                                        </td>
                                                        {isAdmin && showProfitSections && (
                                                            <>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                    {costPrice > 0 ? `${costPrice?.toFixed(0)} CFA` : 'N/A'}
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                                    <span className={profit.perItem >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                        {costPrice > 0 ? `${profit.perItem?.toFixed(0)} CFA` : 'N/A'}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                            {(item.quantity * item.priceAtSale)?.toFixed(0)} CFA
                                                        </td>
                                                        {isAdmin && showProfitSections && (
                                                            <>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                                    <span className={profit.total >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                        {costPrice > 0 ? `${profit.total?.toFixed(0)} CFA` : 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                                    <span className={profit.margin >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                        {costPrice > 0 ? `${profit.margin?.toFixed(1)}%` : 'N/A'}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="md:hidden mb-4">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                                    mobileHistoryTab === 'payments'
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white text-gray-700 border-gray-200'
                                }`}
                                onClick={() => setMobileHistoryTab('payments')}
                            >
                                Paiements
                            </button>
                            <button
                                type="button"
                                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                                    mobileHistoryTab === 'history'
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white text-gray-700 border-gray-200'
                                }`}
                                onClick={() => setMobileHistoryTab('history')}
                            >
                                Historique
                            </button>
                        </div>
                    </div>

                    {/* Historique des paiements */}
                    <div className={`${mobileHistoryTab === 'payments' ? 'block' : 'hidden'} md:block`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <div className="bg-green-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                Historique des Paiements
                            </h3>

                            <div className="text-sm text-gray-500">
                                {sale.payments?.length || 0} paiement(s) effectué(s)
                            </div>
                        </div>

                        {sale.payments && sale.payments.length > 0 ? (
                            <div className="space-y-6">
                                {/* Graphique des paiements */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                    <Bar
                                        data={paymentChartData}
                                        options={{
                                            responsive: true,
                                            plugins: {
                                                legend: {
                                                    position: 'top',
                                                },
                                                title: {
                                                    display: true,
                                                    text: 'Montant des paiements'
                                                },
                                            },
                                        }}
                                    />
                                </div>

                                {/* Liste des paiements */}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enregistré par</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                                                {isAdmin && (
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {sale.payments.map((payment, index) => {
                                                const paymentUser = getPaymentUser(payment);
                                                return (
                                                <tr key={index}>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{payment.formattedDate}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                        {payment.method === 'MobileMoney' ? 'Mobile Money' : payment.method}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                                        {payment.amount?.toFixed(0)} CFA
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {paymentUser?.name || "Inconnu"}
                                                            </span>
                                                            {paymentUser?.email && (
                                                                <span className="text-xs text-gray-500">
                                                                    {paymentUser.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        {paymentUser ? getRoleBadge(getUserRole(paymentUser)) : "Non spécifié"}
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                            <button
                                                                onClick={() => handleDeletePayment(payment._id)}
                                                                disabled={isDeleting}
                                                                className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                                                                title="Supprimer ce paiement"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="mt-4 text-gray-500 text-sm">Aucun paiement enregistré pour cette vente</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Modal de paiement */}
                <PaymentModal
                    show={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    sale={sale}
                    onAddPayment={handleAddPayment}
                />

                {/* Modal de rappel */}
                <Modal
                    isOpen={showReminderModal}
                    onClose={() => setShowReminderModal(false)}
                    title={sale.paymentReminder?.isSet ? 'Modifier le rappel' : 'Définir un rappel'}
                    size="sm"
                    footer={
                        <>
                            <button type="button" onClick={() => setShowReminderModal(false)} className="min-h-[44px] w-full sm:w-auto px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium touch-manipulation">
                                Annuler
                            </button>
                            <button type="button" onClick={handleSetReminder} className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium touch-manipulation">
                                {sale.paymentReminder?.isSet ? 'Modifier' : 'Définir'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="reminder-datetime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date et heure du rappel</label>
                            <input
                                id="reminder-datetime"
                                type="datetime-local"
                                value={reminderDate}
                                onChange={(e) => setReminderDate(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 touch-manipulation"
                            />
                        </div>
                        <div>
                            <label htmlFor="reminder-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Note du rappel (optionnelle)</label>
                            <textarea
                                id="reminder-note"
                                value={reminderNote}
                                onChange={(e) => setReminderNote(e.target.value)}
                                placeholder="Message pour le rappel..."
                                className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 resize-y touch-manipulation"
                                rows={3}
                                maxLength={200}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{reminderNote.length}/200 caractères</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                Ce rappel sera affiché sur le tableau de bord et pourra être utilisé pour envoyer des notifications de suivi au client.
                            </p>
                        </div>
                    </div>
                </Modal>

                {/* Modal de statut de livraison */}
                <Modal
                    isOpen={showDeliveryModal}
                    onClose={() => setShowDeliveryModal(false)}
                    title="Statut de livraison"
                    size="sm"
                    footer={
                        <>
                            <button type="button" onClick={() => setShowDeliveryModal(false)} disabled={isUpdatingDelivery} className="min-h-[44px] w-full sm:w-auto px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed">
                                Annuler
                            </button>
                            <button type="button" onClick={handleUpdateDelivery} disabled={isUpdatingDelivery} className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed">
                                {isUpdatingDelivery ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="delivery-status-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Statut de livraison</label>
                            <select
                                id="delivery-status-select"
                                value={deliveryStatus}
                                onChange={(e) => setDeliveryStatus(e.target.value)}
                                className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 touch-manipulation"
                            >
                                <option value="pending">En attente</option>
                                <option value="delivered">Livré</option>
                                <option value="not_delivered">Non livré</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="delivery-note-ta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Note de livraison (optionnelle)</label>
                            <textarea
                                id="delivery-note-ta"
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value)}
                                placeholder="Notes sur la livraison..."
                                className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 resize-y touch-manipulation"
                                rows={3}
                                maxLength={500}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{deliveryNote.length}/500 caractères</p>
                        </div>
                    </div>
                </Modal>

                {/* Modal d'historique des modifications */}
                <Modal
                    isOpen={showHistoryModal}
                    onClose={() => setShowHistoryModal(false)}
                    title="Historique des modifications"
                    size="lg"
                    footer={
                        <button
                            type="button"
                            onClick={() => setShowHistoryModal(false)}
                            className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium touch-manipulation"
                        >
                            Fermer
                        </button>
                    }
                >
                    <div className="p-0 overflow-y-auto min-h-0">
                                {sale.modificationHistory && sale.modificationHistory.length > 0 ? (
                                    <div className="space-y-6 pb-2">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Historique ({sale.modificationHistory.length} entrée{sale.modificationHistory.length > 1 ? 's' : ''})
                                        </p>
                                        {sale.modificationHistory.map((history, index) => {
                                            const historyUser = history.user;
                                            const userName = historyUser && typeof historyUser === 'object'
                                                ? (historyUser.name || 'Utilisateur inconnu')
                                                : 'Utilisateur inconnu';
                                            const userRole = historyUser && typeof historyUser === 'object'
                                                ? (historyUser.isAdmin ? 'admin' : historyUser.role || 'user')
                                                : 'user';
                                            const changeTypeLabel = history.changeType === 'products_updated'
                                                ? 'Modification des produits'
                                                : history.changeType === 'sale_updated'
                                                    ? 'Modification de la vente'
                                                    : 'Modification';
                                            const hasProducts = history.changes?.products?.length > 0;
                                            const hasNote = history.note && String(history.note).trim() !== '';

                                            return (
                                                <article
                                                    key={index}
                                                    className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 overflow-hidden"
                                                >
                                                    {/* Header: date, user, type */}
                                                    <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-gray-800/50">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                                                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                                                                    {formatModificationDate(history.date)}
                                                                </span>
                                                                <span className="text-gray-400 dark:text-gray-500">·</span>
                                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{userName}</span>
                                                                <span>{getRoleBadge(userRole)}</span>
                                                            </div>
                                                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg">
                                                                {changeTypeLabel}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 sm:p-5 space-y-4">
                                                        {/* Section: Note */}
                                                        <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50 p-4">
                                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                                                Note
                                                            </h4>
                                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                                                {hasNote ? history.note : <span className="italic text-gray-500 dark:text-gray-400">Aucune note</span>}
                                                            </p>
                                                        </section>

                                                        {/* Section: Modifications produits */}
                                                        <section className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50 p-4">
                                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                                                Modifications produits
                                                            </h4>
                                                            {hasProducts ? (() => {
                                                                const productChanges = history.changes.products;
                                                                const removedProducts = productChanges.filter(
                                                                    (change) => getHistoryProductStatus(change) === 'removed'
                                                                );
                                                                const activeProducts = productChanges.filter(
                                                                    (change) => getHistoryProductStatus(change) !== 'removed'
                                                                );
                                                                const renderChangeCard = (change, idx, mode) => {
                                                                    const status = getHistoryProductStatus(change);
                                                                    const productName = getHistoryProductName(change);
                                                                    const oldQuantity = Number(change.oldQuantity || 0);
                                                                    const newQuantity = Number(change.newQuantity || 0);
                                                                    const oldPrice = Number(change.oldPrice || 0);
                                                                    const newPrice = Number(change.newPrice || 0);
                                                                    const statusLabel =
                                                                        status === 'removed'
                                                                            ? 'Retiré'
                                                                            : status === 'added'
                                                                                ? 'Ajouté'
                                                                                : status === 'changed'
                                                                                    ? 'Modifié'
                                                                                    : 'Inchangé';
                                                                    const statusClass =
                                                                        status === 'removed'
                                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                            : status === 'added'
                                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                                : status === 'changed'
                                                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

                                                                    return (
                                                                        <div
                                                                            key={`${mode}-${idx}`}
                                                                            className={`rounded-lg border p-3 sm:p-4 ${
                                                                                mode === 'removed'
                                                                                    ? 'border-red-200 bg-red-50/80 dark:border-red-900/60 dark:bg-red-900/15'
                                                                                    : 'border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-700/50'
                                                                            }`}
                                                                        >
                                                                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                                                                                <p className={`text-sm font-semibold ${
                                                                                    mode === 'removed'
                                                                                        ? 'text-red-700 dark:text-red-300'
                                                                                        : 'text-blue-600 dark:text-blue-400'
                                                                                }`}>
                                                                                    {productName}
                                                                                </p>
                                                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                                                                                    {statusLabel}
                                                                                </span>
                                                                            </div>

                                                                            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                                                                <div className="rounded-lg bg-white/80 p-3 dark:bg-gray-800/60">
                                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                                        Avant
                                                                                    </p>
                                                                                    <div className="mt-2 space-y-1 tabular-nums text-gray-900 dark:text-white">
                                                                                        <p>Qté: <span className="font-semibold">{oldQuantity}</span></p>
                                                                                        <p>Prix: <span className="font-semibold">{formatHistoryPrice(oldPrice)}</span></p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className={`rounded-lg p-3 ${
                                                                                    mode === 'removed'
                                                                                        ? 'bg-red-100/70 dark:bg-red-900/25'
                                                                                        : 'bg-green-50 dark:bg-green-900/15'
                                                                                }`}>
                                                                                    <p className={`text-xs font-semibold uppercase tracking-wide ${
                                                                                        mode === 'removed'
                                                                                            ? 'text-red-600 dark:text-red-300'
                                                                                            : 'text-green-600 dark:text-green-300'
                                                                                    }`}>
                                                                                        Après
                                                                                    </p>
                                                                                    <div className="mt-2 space-y-1 tabular-nums text-gray-900 dark:text-white">
                                                                                        <p>Qté: <span className="font-semibold">{newQuantity}</span></p>
                                                                                        <p>Prix: <span className="font-semibold">{formatHistoryPrice(newPrice)}</span></p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                };

                                                                return (
                                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                                        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/60 dark:bg-red-900/10">
                                                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                                                <h5 className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                                                                                    Produits retirés
                                                                                </h5>
                                                                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-gray-800 dark:text-red-300">
                                                                                    {removedProducts.length}
                                                                                </span>
                                                                            </div>
                                                                            {removedProducts.length > 0 ? (
                                                                                <div className="space-y-3">
                                                                                    {removedProducts.map((change, idx) => renderChangeCard(change, idx, 'removed'))}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="rounded-lg border border-dashed border-red-200 bg-white/70 p-3 text-sm text-red-600/80 dark:border-red-900/50 dark:bg-gray-800/40 dark:text-red-300/80">
                                                                                    Aucun produit retiré.
                                                                                </p>
                                                                            )}
                                                                        </div>

                                                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                                                                            <div className="mb-3 flex items-center justify-between gap-2">
                                                                                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                                                                    Produits après modification
                                                                                </h5>
                                                                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-gray-800 dark:text-emerald-300">
                                                                                    {activeProducts.length}
                                                                                </span>
                                                                            </div>
                                                                            {activeProducts.length > 0 ? (
                                                                                <div className="space-y-3">
                                                                                    {activeProducts.map((change, idx) => renderChangeCard(change, idx, 'active'))}
                                                                                </div>
                                                                            ) : (
                                                                                <p className="rounded-lg border border-dashed border-emerald-200 bg-white/70 p-3 text-sm text-emerald-700/80 dark:border-emerald-900/50 dark:bg-gray-800/40 dark:text-emerald-300/80">
                                                                                    Aucun produit restant dans cette modification.
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })() : (
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">Aucun détail de modification produit pour cette entrée.</p>
                                                            )}
                                                        </section>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                                        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 mb-4">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </span>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 px-4">Aucune modification enregistrée pour cette vente</p>
                                    </div>
                                )}
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default SaleDetailPage;
