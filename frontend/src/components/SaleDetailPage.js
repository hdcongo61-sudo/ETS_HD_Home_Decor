import { confirmDialog } from './ConfirmProvider';
import React, { useState, useEffect, useContext, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { clientPath, productPath } from '../utils/paths';
import { getSaleTypeClass, getSaleTypeText } from '../utils/saleUtils';
import { buildReminderMessage, whatsAppLink, canWhatsApp, recordReminder, formatReminderAgo, REMINDER_CHANNEL_LABEL } from '../utils/clientReminder';
import PaymentModal from '../components/PaymentModal';
import Modal from './Modal';
import { ExternalLink } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import AuthContext from '../context/AuthContext';
import useAutoClearMessage from '../hooks/useAutoClearMessage';
import {    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

import {
    EmptyState,
    LoadingSkeleton,
    PageHeader,
    StatusBadge,
    Workspace,
} from './business';

const ExportSalesPdf = lazy(() => import('./ExportSalesPdf'));
const EditSaleForm = lazy(() => import('./EditSaleForm'));

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
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const returnToSales = location.state?.returnToSales || queryParams.get('returnToSales') || '/sales';
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [mobileHistoryTab, setMobileHistoryTab] = useState('payments');
    const [message, setMessage] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
    const [showProfitSections, setShowProfitSections] = useState(true);
    const [paymentStartDate, setPaymentStartDate] = useState('');
    const [paymentEndDate, setPaymentEndDate] = useState('');
    const [requestModal, setRequestModal] = useState(null);
    const [requestReason, setRequestReason] = useState('');
    const [requestNote, setRequestNote] = useState('');
    const [requestSubmitting, setRequestSubmitting] = useState(false);

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
        if (await confirmDialog("Êtes-vous sûr de vouloir supprimer ce paiement ?")) {
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
        if (await confirmDialog("Envoyer le rappel de paiement au client maintenant ?")) {
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
        if (await confirmDialog("Êtes-vous sûr de vouloir supprimer ce rappel ?")) {
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

    const openAdminRequest = (payload) => {
        setRequestModal(payload);
        setRequestReason('');
        setRequestNote('');
    };

    const handleSubmitAdminRequest = async () => {
        if (!requestModal || requestSubmitting) return;
        if (!requestReason.trim()) {
            setMessage('Erreur: la raison est requise pour envoyer une demande');
            return;
        }

        try {
            setRequestSubmitting(true);
            await api.post('/admin-requests', {
                ...requestModal,
                reason: requestReason.trim(),
                note: requestNote.trim()
            });
            setRequestModal(null);
            setRequestReason('');
            setRequestNote('');
            setMessage('✅ Demande envoyée à l’administrateur');
        } catch (error) {
            console.error('Admin request error:', error.response?.data || error);
            setMessage('Erreur: ' + (error.response?.data?.message || error.message));
        } finally {
            setRequestSubmitting(false);
        }
    };

    const openEditModal = () => {
        setDeleteReason('');
        setDeleteError('');
        setShowEditModal(true);
    };

    const handleUpdateSale = async (updateData) => {
        try {
            const { data } = await api.put(`/sales/${sale._id}`, {
                products: updateData.products,
                note: updateData.note,
                saleDate: updateData.saleDate
            });
            setSale(mergeSaleState(data));
            setShowEditModal(false);
            setMessage('✅ Vente mise à jour avec succès');
        } catch (err) {
            console.error('Update error:', err.response?.data || err.message);
            throw err; // EditSaleForm surfaces the message inline
        }
    };

    const handleDeleteSale = async () => {
        const reason = deleteReason.trim();
        if (!reason) {
            setDeleteError('Une raison est requise pour supprimer la vente.');
            return;
        }

        const confirmed = await confirmDialog(
            'Voulez-vous vraiment supprimer cette vente ? Cette action est irréversible.'
        );
        if (!confirmed) return;

        try {
            setIsDeleting(true);
            setDeleteError('');
            await api.delete(`/sales/${sale._id}`, { data: { reason } });
            navigate('/sales', { state: { message: 'Vente supprimée avec succès' } });
        } catch (deleteErr) {
            setDeleteError(deleteErr.response?.data?.message || 'Erreur lors de la suppression.');
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
            case 'pending': return 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]';
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
            default: return 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)]';
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
            case 'manager': return <span className="bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)] text-xs px-2 py-1 rounded-full">Manager</span>;
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

    // Resolve a navigable target for a history product change (prefers the full
    // object so the URL gets a slug; falls back to the raw id, or null if absent).
    const getHistoryProductLinkTarget = (change) => {
        if (change.product && typeof change.product === 'object' && change.product._id) {
            return change.product;
        }
        const productId = typeof change.product === 'object'
            ? (change.product?._id || change.product?.toString?.())
            : change.product;
        return productId || null;
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
            <Workspace>
                <PageHeader eyebrow="Vente" title="Détails de la vente" description="Chargement de la fiche vente." />
                <LoadingSkeleton rows={6} />
            </Workspace>
        );
    }

    if (error) {
        return (
            <Workspace>
                <PageHeader eyebrow="Vente" title="Détails de la vente" description="Une erreur est survenue." />
                <EmptyState title="Impossible de charger la vente" description={error} />
            </Workspace>
        );
    }

    if (!sale) {
        return (
            <Workspace>
                <EmptyState title="Vente non trouvée" description="La fiche demandée n’existe pas ou n’est plus disponible." />
            </Workspace>
        );
    }

    const totalProfit = calculateTotalProfit();
    const profitMargin = calculateProfitMargin();
    const payments = Array.isArray(sale.payments) ? sale.payments : [];

    // Cash-basis profit: recognized in proportion to money actually collected.
    const saleTotalAmount = Number(sale.totalAmount) || 0;
    const totalPaidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const profitRatio = saleTotalAmount > 0 ? totalProfit / saleTotalAmount : 0;
    const realizedProfit = totalPaidAmount * profitRatio;
    const outstandingProfit = totalProfit - realizedProfit;

    // WhatsApp reminder for an unpaid balance.
    const saleBalance = Math.max(Number(sale.balance) || 0, 0);
    const lastPaymentRaw = (sale.payments || []).slice(-1)[0]?.paymentDate;
    const daysSinceLastPayment = lastPaymentRaw
        ? Math.max(0, Math.floor((Date.now() - new Date(lastPaymentRaw).getTime()) / 86400000))
        : null;
    const whatsappReminderHref = (saleBalance > 0 && canWhatsApp(sale.client?.phone))
        ? whatsAppLink(
            sale.client?.phone,
            auth?.tenant?.dialCode || '',
            buildReminderMessage({
                clientName: sale.client?.name,
                shopName: auth?.tenant?.name || '',
                balance: saleBalance,
                lastPaymentLabel: lastPaymentRaw ? new Date(lastPaymentRaw).toLocaleDateString('fr-FR') : '',
                daysSince: daysSinceLastPayment,
            })
        )
        : '';
    const reminderLog = Array.isArray(sale.reminderLog) ? sale.reminderLog : [];
    const logReminder = (channel) => {
        recordReminder(id, channel);
        setSale((prev) => prev ? {
            ...prev,
            lastRemindedAt: new Date().toISOString(),
            reminderLog: [...(prev.reminderLog || []), { channel, userName: auth?.user?.name || '', createdAt: new Date().toISOString() }],
        } : prev);
    };
    const filteredPayments = payments.filter((payment) => {
        const rawDate = payment?.paymentDate || payment?.createdAt;
        if (!rawDate) return !paymentStartDate && !paymentEndDate;

        const paymentDate = new Date(rawDate);
        if (Number.isNaN(paymentDate.getTime())) return !paymentStartDate && !paymentEndDate;

        if (paymentStartDate) {
            const start = new Date(`${paymentStartDate}T00:00:00`);
            if (paymentDate < start) return false;
        }

        if (paymentEndDate) {
            const end = new Date(`${paymentEndDate}T23:59:59.999`);
            if (paymentDate > end) return false;
        }

        return true;
    });
    const filteredPaymentsTotal = filteredPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const formatCfa = (value) => `${(Number(value) || 0).toLocaleString('fr-FR')} CFA`;
    const mobileSummaryCards = [
        {
            label: 'Total',
            value: formatCfa(sale.totalAmount),
            tone: 'bg-[var(--ms-blue-soft)] text-[var(--ms-blue-dark)] border-[var(--ms-blue-soft)]'
        },
        {
            label: 'Payé',
            value: formatCfa(sale.totalPaid),
            tone: 'bg-emerald-50 text-emerald-700 border-emerald-100'
        },
        {
            label: 'Reste',
            value: formatCfa(Math.max(Number(sale.balance) || 0, 0)),
            tone: Number(sale.balance) > 0
                ? 'bg-rose-50 text-rose-700 border-rose-100'
                : 'bg-slate-50 text-slate-700 border-slate-100'
        }
    ];

    // Chart data for payment history
    const paymentChartData = {
        labels: filteredPayments.map((_, index) => `Paiement ${index + 1}`),
        datasets: [
            {
                label: 'Montant (CFA)',
                data: filteredPayments.map(p => p.amount),
                backgroundColor: 'rgba(0, 122, 255, 0.8)',
                borderRadius: 6,
            }
        ]
    };
    const hasPaymentDateFilter = Boolean(paymentStartDate || paymentEndDate);
    const handlePaymentStartDateChange = (value) => {
        setPaymentStartDate(value);
        if (value && paymentEndDate && paymentEndDate < value) {
            setPaymentEndDate(value);
        }
    };
    const handlePaymentEndDateChange = (value) => {
        setPaymentEndDate(value);
        if (value && paymentStartDate && paymentStartDate > value) {
            setPaymentStartDate(value);
        }
    };

    return (
        <div className="ms-workspace text-[var(--ms-text)]">
            <div className="space-y-4 sm:space-y-6">
                {/* Back + Page title */}
                <header className="rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(returnToSales)}
                        className="inline-flex w-fit min-h-[42px] items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white hover:text-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour aux ventes
                    </button>
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] border border-gray-200 bg-gray-100 text-gray-700 shadow-inner dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Détails de la vente</p>
                            <h1 className="truncate text-xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-2xl">Vente #{sale._id?.substring(18) || 'N/A'}</h1>
                            <p className="mt-0.5 text-sm text-gray-500">{sale.formattedDate || new Date(sale.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                    </div>
                </header>

                <nav className="sticky top-[72px] z-20 -mx-3 overflow-x-auto border-y border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
                    <div className="flex min-w-max gap-2">
                        <a href="#resume-vente" className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">Résumé</a>
                        <a href="#produits-vente" className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">Produits</a>
                        <button
                            type="button"
                            onClick={() => {
                                setMobileHistoryTab('payments');
                                setTimeout(() => {
                                    document.getElementById('paiements-vente')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 0);
                            }}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                        >
                            Paiements
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMobileHistoryTab('history');
                                setTimeout(() => {
                                    document.getElementById('historique-vente')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 0);
                            }}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                        >
                            Historique
                        </button>
                    </div>
                </nav>

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
                <section id="resume-vente" className="scroll-mt-24 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_16px_50px_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-gray-900/95">
                    <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:justify-between sm:items-start">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                    <h2 className="hidden text-lg sm:block sm:text-xl font-semibold text-gray-900 dark:text-white">
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
                            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => setShowProfitSections((prev) => !prev)}
                                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:col-span-1 sm:min-h-[44px] sm:px-4 sm:py-2.5"
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
                                    <button
                                        type="button"
                                        onClick={openEditModal}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30 sm:min-h-[44px] sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Modifier
                                    </button>
                                )}
                                {!isAdmin && sale.status !== 'cancelled' && (
                                    <button
                                        type="button"
                                        onClick={() => openAdminRequest({
                                            type: 'sale.edit',
                                            targetModel: 'Sale',
                                            targetId: sale._id,
                                            targetLabel: `Vente #${sale._id?.slice(-6) || ''}`
                                        })}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        Demander modification
                                    </button>
                                )}
                                {!isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => openAdminRequest({
                                            type: 'sale.delete',
                                            targetModel: 'Sale',
                                            targetId: sale._id,
                                            targetLabel: `Vente #${sale._id?.slice(-6) || ''}`
                                        })}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2.5"
                                    >
                                        Demander suppression
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(true)}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-50 sm:min-h-[44px] sm:px-4 sm:py-2.5"
                                    disabled={sale.status === 'completed' || sale.status === 'cancelled'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h6m-6 0H6" />
                                    </svg>
                                    <span className="sm:hidden">Paiement</span>
                                    <span className="hidden sm:inline">Ajouter paiement</span>
                                </button>
                                {/* Télécharger la facture PDF — uniquement pour les ventes payées */}
                                {sale.status === 'completed' && (
                                    <Suspense fallback={null}>
                                        <ExportSalesPdf sale={sale} />
                                    </Suspense>
                                )}
                                {(sale.status === 'pending' || sale.status === 'partially_paid') && (
                                    <button
                                        type="button"
                                        onClick={() => setShowReminderModal(true)}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 sm:min-h-[44px] sm:px-4 sm:py-2.5"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="sm:hidden">{sale.paymentReminder?.isSet ? 'Rappel' : 'Rappel'}</span>
                                        <span className="hidden sm:inline">{sale.paymentReminder?.isSet ? 'Modifier rappel' : 'Définir rappel'}</span>
                                    </button>
                                )}
                                {(sale.status === 'pending' || sale.status === 'partially_paid') && whatsappReminderHref && (
                                    <a
                                        href={whatsappReminderHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => logReminder('whatsapp')}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 sm:min-h-[44px] sm:px-4 sm:py-2.5"
                                        style={{ background: '#25D366' }}
                                        title="Envoyer un rappel WhatsApp au client"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.985z" />
                                        </svg>
                                        <span className="sm:hidden">WhatsApp</span>
                                        <span className="hidden sm:inline">Rappel WhatsApp</span>
                                    </a>
                                )}
                                {sale.status === 'completed' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeliveryModal(true)}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 sm:min-h-[44px] sm:px-4 sm:py-2.5"
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
                                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 sm:col-span-1 sm:min-h-[44px] sm:px-4 sm:py-2.5"
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

                    <div className="grid grid-cols-3 gap-2 p-4 sm:hidden">
                        {mobileSummaryCards.map((card) => (
                            <div key={card.label} className={`rounded-2xl border p-3 ${card.tone}`}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
                                <p className="mt-1 break-words text-sm font-bold leading-tight text-gray-950">{card.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Payment Reminder Section */}
                    {sale.paymentReminder?.isSet && (
                        <div className={`mx-4 sm:mx-6 mb-6 p-4 rounded-xl border ${isReminderOverdue()
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : sale.paymentReminder.status === 'sent'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : isReminderDueToday()
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    : 'bg-[var(--ms-blue-soft)] dark:bg-[var(--ms-blue-dark)] border-[var(--ms-blue-soft)] dark:border-[var(--ms-blue-dark)]'
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
                                                <span className="text-[var(--ms-blue)] dark:text-[var(--ms-blue)]">
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
                                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] dark:text-[var(--ms-blue)] rounded-xl hover:bg-[var(--ms-blue-soft)] dark:hover:bg-[var(--ms-blue-dark)] transition-colors"
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

                    {/* Reminder history (collection follow-ups) */}
                    {reminderLog.length > 0 && (
                        <div className="mx-4 sm:mx-6 mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Relances</h4>
                                {sale.lastRemindedAt && (
                                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                        Dernière : {formatReminderAgo(sale.lastRemindedAt)}
                                    </span>
                                )}
                            </div>
                            <ul className="space-y-1.5">
                                {[...reminderLog].reverse().slice(0, 8).map((r, i) => (
                                    <li key={r._id || i} className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <span className="font-medium">
                                            {REMINDER_CHANNEL_LABEL[r.channel] || r.channel}
                                            {r.userName ? ` · ${r.userName}` : ''}
                                        </span>
                                        <span className="text-gray-400">
                                            {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Delivery Status Section */}
                    {sale.status === 'completed' && (
                        <div className={`mx-4 sm:mx-6 mb-6 p-4 rounded-xl border ${sale.deliveryStatus === 'delivered'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : sale.deliveryStatus === 'not_delivered'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-[var(--ms-blue-soft)] dark:bg-[var(--ms-blue-dark)] border-[var(--ms-blue-soft)] dark:border-[var(--ms-blue-dark)]'
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
                                                <span className="text-[var(--ms-blue)] dark:text-[var(--ms-blue)]">En attente de livraison</span>
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
                                    className="min-w-[44px] min-h-[44px] w-fit flex items-center justify-center gap-2 text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] dark:text-[var(--ms-blue)] rounded-xl hover:bg-[var(--ms-blue-soft)] dark:hover:bg-[var(--ms-blue-dark)] transition-colors px-3"
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 mb-6 px-4 sm:px-6">
                        {/* Informations client */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--ms-blue-soft)] dark:bg-[var(--ms-blue-dark)]">
                                    <svg className="w-4 h-4 text-[var(--ms-blue)] dark:text-[var(--ms-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                Client
                            </h3>

                            {sale.client ? (
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                                        <span className="font-medium text-xs uppercase tracking-wide text-gray-500 sm:w-20 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-900">Nom</span>
                                        {isAdmin ? (
                                            <Link
                                                to={clientPath(sale.client)}
                                                className="text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] text-sm font-medium flex items-center transition-colors"
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
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                                            <span className="font-medium text-xs uppercase tracking-wide text-gray-500 sm:w-20 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-900">Email</span>
                                            <a
                                                href={`mailto:${sale.client.email}`}
                                                className="break-all text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] text-sm transition-colors"
                                            >
                                                {sale.client.email}
                                            </a>
                                        </div>
                                    )}
                                    {sale.client.phone && (
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                                            <span className="font-medium text-xs uppercase tracking-wide text-gray-500 sm:w-20 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-900">Téléphone</span>
                                            <a
                                                href={`tel:${sale.client.phone}`}
                                                className="text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] text-sm font-medium transition-colors"
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
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                Vendeur
                            </h3>

                            <div className="space-y-3">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                                    <span className="font-medium text-xs uppercase tracking-wide text-gray-500 sm:w-20 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-900">Nom</span>
                                    <span className="text-sm">{sale.user?.name || "Non spécifié"}</span>
                                </div>
                                {sale.user?.email && (
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                                        <span className="font-medium text-xs uppercase tracking-wide text-gray-500 sm:w-20 sm:text-sm sm:normal-case sm:tracking-normal sm:text-gray-900">Email</span>
                                        <span className="break-all text-sm">{sale.user.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Résumé financier */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                Résumé Financier
                            </h3>

                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-sm">Total de la vente:</span>
                                    <span className="text-right text-sm font-semibold">{(Number(sale.totalAmount) || 0).toFixed(0)} CFA</span>
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-sm">Total payé:</span>
                                    <span className="text-right text-sm font-semibold text-green-600">{(Number(sale.totalPaid) || 0).toFixed(0)} CFA</span>
                                </div>
                                <div className="flex items-start justify-between gap-3 border-t pt-2">
                                    <span className="text-sm font-medium">Solde restant:</span>
                                    <span className={`text-right text-sm font-semibold ${Number(sale.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Math.abs(Number(sale.balance) || 0).toFixed(0)} CFA
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section Bénéfices */}
                        {isAdmin && showProfitSections && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/40">
                                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                Bénéfices
                            </h3>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2">
                                    <span className="text-sm font-medium">Bénéfice encaissé:</span>
                                    <span className={`text-base font-bold ${realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {realizedProfit?.toFixed(0)} CFA
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Bénéfice total attendu:</span>
                                    <span className={`text-sm font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {totalProfit?.toFixed(0)} CFA
                                    </span>
                                </div>
                                {outstandingProfit > 0.5 && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">Bénéfice restant à encaisser:</span>
                                        <span className="text-sm font-semibold text-amber-600">
                                            {outstandingProfit?.toFixed(0)} CFA
                                        </span>
                                    </div>
                                )}
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
                    <div id="produits-vente" className="scroll-mt-20 mb-6 px-4 sm:px-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
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
                                                <div className="flex items-start gap-3 min-w-0">
                                                    {product?.image && (
                                                        <img
                                                            src={product.image}
                                                            alt=""
                                                            loading="lazy"
                                                            className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover"
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        {product?._id ? (
                                                            <Link
                                                                to={productPath(product)}
                                                                className="text-sm font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] hover:underline"
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
                                                            <div className="flex items-center gap-3">
                                                                {product?.image && (
                                                                    <img
                                                                        src={product.image}
                                                                        alt=""
                                                                        loading="lazy"
                                                                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                                                                    />
                                                                )}
                                                                {product?._id ? (
                                                                    <Link
                                                                        to={productPath(product)}
                                                                        className="text-sm font-medium text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] hover:underline"
                                                                    >
                                                                        {product.name || 'Produit'}
                                                                    </Link>
                                                                ) : (
                                                                    <div className="text-sm font-medium text-gray-900">
                                                                        Produit supprimé
                                                                    </div>
                                                                )}
                                                            </div>
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


                    <div id="paiements-vente" className="scroll-mt-20 md:hidden mb-4 px-4">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                                    mobileHistoryTab === 'payments'
                                        ? 'bg-[var(--ms-blue)] text-white border-[var(--ms-blue)]'
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
                                        ? 'bg-[var(--ms-blue)] text-white border-[var(--ms-blue)]'
                                        : 'bg-white text-gray-700 border-gray-200'
                                }`}
                                onClick={() => setMobileHistoryTab('history')}
                            >
                                Historique
                            </button>
                        </div>
                    </div>

                    {/* Historique des paiements */}
                    <div className={`${mobileHistoryTab === 'payments' ? 'block' : 'hidden'} md:block px-4 sm:px-6`}>
                        <div className="mb-4 space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <div className="bg-green-100 p-1.5 rounded-lg">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    Historique des Paiements
                                </h3>

                                <div className="text-sm text-gray-500">
                                    {filteredPayments.length} / {payments.length} paiement(s) · {filteredPaymentsTotal.toLocaleString('fr-FR')} CFA
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Date début</span>
                                    <input
                                        type="date"
                                        value={paymentStartDate}
                                        max={paymentEndDate || undefined}
                                        onChange={(e) => handlePaymentStartDateChange(e.target.value)}
                                        className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Date fin</span>
                                    <input
                                        type="date"
                                        value={paymentEndDate}
                                        min={paymentStartDate || undefined}
                                        onChange={(e) => handlePaymentEndDateChange(e.target.value)}
                                        className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPaymentStartDate('');
                                        setPaymentEndDate('');
                                    }}
                                    disabled={!hasPaymentDateFilter}
                                    className="min-h-[42px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Réinitialiser
                                </button>
                            </div>
                        </div>

                        {payments.length > 0 ? (
                            <div className="space-y-6">
                                {filteredPayments.length > 0 ? (
                                    <>
                                <div className="hidden bg-white p-4 rounded-xl border border-gray-200 sm:block">
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

                                    <div className="space-y-3 md:hidden">
                                        {filteredPayments.map((payment, index) => {
                                            const paymentUser = getPaymentUser(payment);
                                            return (
                                                <article key={`mobile-payment-${payment._id || index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{payment.formattedDate || 'Date non définie'}</p>
                                                            <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCfa(payment.amount)}</p>
                                                            {isAdmin && showProfitSections && profitRatio > 0 && (
                                                                <p className="mt-0.5 text-xs font-medium text-[var(--ms-blue)]">
                                                                    Bénéfice : {formatCfa((Number(payment.amount) || 0) * profitRatio)}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700">
                                                            {payment.method === 'MobileMoney' ? 'Mobile Money' : payment.method}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                                                        <div>
                                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Enregistré par</span>
                                                            <p className="mt-0.5 font-medium text-gray-900">{paymentUser?.name || 'Inconnu'}</p>
                                                            {paymentUser?.email && <p className="break-all text-xs text-gray-500">{paymentUser.email}</p>}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Rôle</span>
                                                            {paymentUser ? getRoleBadge(getUserRole(paymentUser)) : <span className="text-xs text-gray-500">Non spécifié</span>}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3">
                                                        {isAdmin ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeletePayment(payment._id)}
                                                                disabled={isDeleting}
                                                                className="min-h-[42px] w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                                            >
                                                                Supprimer ce paiement
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAdminRequest({
                                                                    type: 'payment.delete',
                                                                    targetModel: 'Sale',
                                                                    targetId: sale._id,
                                                                    targetLabel: `Paiement ${(Number(payment.amount) || 0).toLocaleString('fr-FR')} CFA`,
                                                                    metadata: {
                                                                        paymentId: payment._id,
                                                                        amount: payment.amount,
                                                                        saleId: sale._id
                                                                    }
                                                                })}
                                                                className="min-h-[42px] w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                                                            >
                                                                Demander suppression
                                                            </button>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>

                                    <div className="hidden overflow-x-auto md:block">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Méthode</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                                                {isAdmin && showProfitSections && (
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bénéfice</th>
                                                )}
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enregistré par</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredPayments.map((payment, index) => {
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
                                                    {isAdmin && showProfitSections && (
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-[var(--ms-blue)]">
                                                            {profitRatio > 0 ? `${((Number(payment.amount) || 0) * profitRatio).toFixed(0)} CFA` : '—'}
                                                        </td>
                                                    )}
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
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                                        {isAdmin ? (
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
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAdminRequest({
                                                                    type: 'payment.delete',
                                                                    targetModel: 'Sale',
                                                                    targetId: sale._id,
                                                                    targetLabel: `Paiement ${(Number(payment.amount) || 0).toLocaleString('fr-FR')} CFA`,
                                                                    metadata: {
                                                                        paymentId: payment._id,
                                                                        amount: payment.amount,
                                                                        saleId: sale._id
                                                                    }
                                                                })}
                                                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                                            >
                                                                Demander suppression
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                                        <p className="text-gray-500 text-sm">Aucun paiement pour les dates choisies</p>
                                    </div>
                                )}
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

                    <div id="historique-vente" className={`${mobileHistoryTab === 'history' ? 'block' : 'hidden'} scroll-mt-20 px-4 pb-6 md:hidden`}>
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Historique des modifications</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {sale.modificationHistory?.length || 0} entrée{(sale.modificationHistory?.length || 0) > 1 ? 's' : ''} enregistrée{(sale.modificationHistory?.length || 0) > 1 ? 's' : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryModal(true)}
                                    disabled={!sale.modificationHistory || sale.modificationHistory.length === 0}
                                    className="min-h-[42px] rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                    Ouvrir
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Modal de paiement */}
                <PaymentModal
                    show={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    sale={sale}
                    onAddPayment={handleAddPayment}
                />

                <Modal
                    isOpen={Boolean(requestModal)}
                    onClose={() => setRequestModal(null)}
                    title="Demande administrateur"
                    size="sm"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={() => setRequestModal(null)}
                                disabled={requestSubmitting}
                                className="min-h-[44px] w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 font-medium disabled:opacity-60"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitAdminRequest}
                                disabled={requestSubmitting || !requestReason.trim()}
                                className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-[var(--ms-blue)] hover:bg-[var(--ms-blue-dark)] text-white rounded-xl font-medium disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {requestSubmitting ? 'Envoi...' : 'Envoyer'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Cette action sera envoyée à un administrateur avec votre raison avant validation.
                        </p>
                        <div>
                            <label htmlFor="admin-request-reason" className="mb-2 block text-sm font-medium text-gray-700">
                                Raison obligatoire
                            </label>
                            <textarea
                                id="admin-request-reason"
                                value={requestReason}
                                onChange={(event) => setRequestReason(event.target.value)}
                                rows={4}
                                maxLength={600}
                                placeholder="Expliquez pourquoi cette action est nécessaire..."
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]"
                            />
                            <p className="mt-1 text-xs text-gray-500">{requestReason.length}/600 caractères</p>
                        </div>
                        <div>
                            <label htmlFor="admin-request-note" className="mb-2 block text-sm font-medium text-gray-700">
                                Note optionnelle
                            </label>
                            <input
                                id="admin-request-note"
                                value={requestNote}
                                onChange={(event) => setRequestNote(event.target.value)}
                                maxLength={200}
                                placeholder="Ex: erreur de montant, doublon, client incorrect"
                                className="min-h-[44px] w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[var(--ms-blue)] focus:ring-2 focus:ring-[var(--ms-blue)]"
                            />
                        </div>
                    </div>
                </Modal>

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
                                className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[var(--ms-blue)] touch-manipulation"
                            />
                        </div>
                        <div>
                            <label htmlFor="reminder-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Note du rappel (optionnelle)</label>
                            <textarea
                                id="reminder-note"
                                value={reminderNote}
                                onChange={(e) => setReminderNote(e.target.value)}
                                placeholder="Message pour le rappel..."
                                className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[var(--ms-blue)] resize-y touch-manipulation"
                                rows={3}
                                maxLength={200}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{reminderNote.length}/200 caractères</p>
                        </div>
                        <div className="bg-[var(--ms-blue-soft)] dark:bg-[var(--ms-blue-dark)] p-3 rounded-xl border border-[var(--ms-blue-soft)] dark:border-[var(--ms-blue-dark)]">
                            <p className="text-sm text-[var(--ms-blue-dark)] dark:text-[var(--ms-blue)]">
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
                            <button type="button" onClick={handleUpdateDelivery} disabled={isUpdatingDelivery} className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-[var(--ms-blue)] hover:bg-[var(--ms-blue-dark)] text-white rounded-xl font-medium touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed">
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
                                className="w-full min-h-[44px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[var(--ms-blue)] touch-manipulation"
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
                                className="w-full min-h-[88px] px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-[var(--ms-blue)] resize-y touch-manipulation"
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
                            className="min-h-[44px] w-full sm:w-auto px-4 py-3 bg-[var(--ms-blue)] hover:bg-[var(--ms-blue-dark)] text-white rounded-xl font-medium touch-manipulation"
                        >
                            Fermer
                        </button>
                    }
                >
                    <div className="p-0 overflow-y-auto min-h-0">
                                {sale.modificationHistory && sale.modificationHistory.length > 0 ? (
                                    <div className="space-y-6 pb-2">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">
                                            {sale.modificationHistory.length} entrée{sale.modificationHistory.length > 1 ? 's' : ''} enregistrée{sale.modificationHistory.length > 1 ? 's' : ''}
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
                                                    className="ms-surface overflow-hidden"
                                                >
                                                    {/* Header: date, user, type */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-semibold text-[var(--ms-text-strong)] tabular-nums">
                                                                {formatModificationDate(history.date)}
                                                            </span>
                                                            <span className="text-[var(--ms-text-muted)]">·</span>
                                                            <span className="text-sm text-[var(--ms-text)]">{userName}</span>
                                                            {getRoleBadge(userRole)}
                                                        </div>
                                                        <StatusBadge tone="neutral">{changeTypeLabel}</StatusBadge>
                                                    </div>

                                                    <div className="space-y-4 p-4">
                                                        {/* Note */}
                                                        {hasNote && (
                                                            <div className="rounded-[var(--radiusLarge)] border px-3.5 py-2.5 text-sm" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}>
                                                                <span className="font-semibold text-[var(--ms-text-muted)]">Note : </span>
                                                                <span className="text-[var(--ms-text)]">{history.note}</span>
                                                            </div>
                                                        )}

                                                        {/* Produits concernés */}
                                                        <section className="space-y-3">
                                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">
                                                                Produits concernés
                                                            </h4>
                                                            {hasProducts ? (
                                                                <div className="space-y-2.5">
                                                                    {history.changes.products.map((change, idx) => {
                                                                        const status = getHistoryProductStatus(change);
                                                                        const productName = getHistoryProductName(change);
                                                                        const linkTarget = getHistoryProductLinkTarget(change);
                                                                        const oldQuantity = Number(change.oldQuantity || 0);
                                                                        const newQuantity = Number(change.newQuantity || 0);
                                                                        const oldPrice = Number(change.oldPrice || 0);
                                                                        const newPrice = Number(change.newPrice || 0);
                                                                        const isRemoved = status === 'removed';
                                                                        const statusMeta = ({
                                                                            removed: { label: 'Retiré', tone: 'danger' },
                                                                            added: { label: 'Ajouté', tone: 'success' },
                                                                            changed: { label: 'Modifié', tone: 'warning' },
                                                                            unchanged: { label: 'Inchangé', tone: 'neutral' },
                                                                        })[status] || { label: 'Inchangé', tone: 'neutral' };

                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="rounded-[var(--radiusLarge)] border p-3"
                                                                                style={isRemoved
                                                                                    ? { borderColor: 'var(--colorStatusDangerStroke1)', background: 'var(--colorStatusDangerBackground1)' }
                                                                                    : { borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    {linkTarget ? (
                                                                                        <Link
                                                                                            to={productPath(linkTarget)}
                                                                                            onClick={() => setShowHistoryModal(false)}
                                                                                            className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)]"
                                                                                            title={`Voir la fiche de ${productName}`}
                                                                                        >
                                                                                            <span className="truncate">{productName}</span>
                                                                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                                                                        </Link>
                                                                                    ) : (
                                                                                        <span className="truncate text-sm font-semibold text-[var(--ms-text-strong)]">{productName}</span>
                                                                                    )}
                                                                                    <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
                                                                                </div>

                                                                                <div className="mt-2.5 grid grid-cols-2 gap-2 text-sm">
                                                                                    <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-white)' }}>
                                                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Avant</p>
                                                                                        <p className="mt-1 tabular-nums text-[var(--ms-text)]">Qté <span className="font-semibold">{oldQuantity}</span></p>
                                                                                        <p className="tabular-nums text-[var(--ms-text)]">{formatHistoryPrice(oldPrice)}</p>
                                                                                    </div>
                                                                                    <div className="rounded-lg px-3 py-2" style={isRemoved
                                                                                        ? { background: 'var(--colorStatusDangerBackground1)' }
                                                                                        : { background: 'var(--colorStatusSuccessBackground1)' }}>
                                                                                        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: isRemoved ? 'var(--ms-danger)' : 'var(--ms-success)' }}>Après</p>
                                                                                        <p className="mt-1 tabular-nums text-[var(--ms-text)]">Qté <span className="font-semibold">{newQuantity}</span></p>
                                                                                        <p className="tabular-nums text-[var(--ms-text)]">{formatHistoryPrice(newPrice)}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-[var(--ms-text-muted)]">Aucun détail de modification produit pour cette entrée.</p>
                                                            )}
                                                        </section>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                                        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </span>
                                        <p className="px-4 text-sm text-[var(--ms-text-muted)]">Aucune modification enregistrée pour cette vente</p>
                                    </div>
                                )}
                    </div>
                </Modal>

                <Modal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    title="Modifier la vente"
                    subtitle="Ajustez les lignes, corrigez la date réelle si besoin et enregistrez une note de modification."
                    size="xl"
                >
                    {showEditModal && (
                        <div className="space-y-6">
                            <Suspense fallback={<LoadingSkeleton rows={6} />}>
                                <EditSaleForm
                                    sale={sale}
                                    clients={[]}
                                    onUpdate={handleUpdateSale}
                                    onCancel={() => setShowEditModal(false)}
                                />
                            </Suspense>

                            {isAdmin && (
                                <section className="overflow-hidden rounded-lg border border-[rgba(209,52,56,0.22)] bg-[#FDF3F4]" aria-labelledby="delete-heading">
                                    <div className="border-b border-[rgba(209,52,56,0.22)] bg-white px-4 py-3">
                                        <h2 id="delete-heading" className="text-sm font-semibold text-red-800">
                                            Zone dangereuse — Supprimer la vente
                                        </h2>
                                    </div>
                                    <div className="p-4 md:p-5">
                                        <p className="text-sm text-gray-700">
                                            La suppression supprime définitivement la vente et réintègre les quantités au stock. Cette action est irréversible.
                                        </p>
                                        <div className="mt-4">
                                            <label htmlFor="delete-reason" className="block text-sm font-medium text-gray-700 mb-1">
                                                Raison de suppression <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                id="delete-reason"
                                                value={deleteReason}
                                                onChange={(e) => {
                                                    setDeleteReason(e.target.value);
                                                    if (deleteError) setDeleteError('');
                                                }}
                                                rows={3}
                                                className="form-control"
                                                placeholder="Expliquez pourquoi cette vente est supprimée…"
                                                aria-invalid={!!deleteError}
                                                aria-describedby={deleteError ? 'delete-error' : undefined}
                                            />
                                        </div>
                                        {deleteError && (
                                            <p id="delete-error" className="mt-2 text-sm text-red-600" role="alert">
                                                {deleteError}
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleDeleteSale}
                                            disabled={isDeleting}
                                            className="ms-button ms-button-danger ms-button-md mt-4"
                                        >
                                            {isDeleting ? 'Suppression…' : 'Supprimer définitivement la vente'}
                                        </button>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    );
};

export default SaleDetailPage;
