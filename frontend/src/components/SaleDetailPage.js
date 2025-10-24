import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import PaymentModal from '../components/PaymentModal';
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
    const [message, setMessage] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

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
            await api.post(`/sales/${id}/payments`, paymentData);
            // Recharger les détails de la vente
            const response = await api.get(`/sales/${id}`);
            setSale(response.data);
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
                await api.delete(`/sales/${id}/payments/${paymentId}`);

                // Recharger les détails de la vente
                const response = await api.get(`/sales/${id}`);
                setSale(response.data);
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

            setSale(response.data);
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
                setSale(response.data);
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

                setSale(data);
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

            const payload = {
                deliveryStatus,
                deliveryNote: deliveryNote || '',
                deliveryDate: deliveryStatus === 'delivered' ? new Date().toISOString() : null
            };

            // 1. Mettre à jour le statut de livraison
            await api.put(`/sales/${id}/delivery`, payload);
            
            // 2. Recharger TOUTES les données de la vente avec les relations
            const updatedResponse = await api.get(`/sales/${id}`);
            
            // 3. Vérifier que les données sont complètes
            if (updatedResponse.data) {
                setSale(updatedResponse.data);
                setMessage('✅ Statut de livraison mis à jour avec succès!');
                
                setTimeout(() => {
                    setShowDeliveryModal(false);
                }, 2000);
            }

        } catch (error) {
            console.error('Erreur:', error);
            setMessage('❌ Erreur: ' + (error.response?.data?.message || error.message));
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

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">Admin</span>;
            case 'manager': return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Manager</span>;
            case 'cashier': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Caissier</span>;
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 mx-4 border border-red-200">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
            </div>
        );
    }

    if (!sale) {
        return <div className="p-4">Vente non trouvée</div>;
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/sales`)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Retour aux ventes
                        </button>
                    </div>
                </div>

                {/* Page Title */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-500 p-2 rounded-xl">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">Détails de la Vente</h1>
                </div>

                {/* Message de notification */}
                {message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${message.includes('succès') || message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {message.includes('succès') || message.includes('✅') ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            )}
                        </svg>
                        {message}
                    </div>
                )}

                {/* En-tête de la vente */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Vente #{sale._id?.substring(18) || 'N/A'}
                                </h2>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(sale.status)}`}>
                                    {getStatusText(sale.status)}
                                </span>
                                {sale.status === 'completed' && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDeliveryStatusClass(sale.deliveryStatus)}`}>
                                        {getDeliveryStatusText(sale.deliveryStatus)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center text-gray-500 text-sm">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 0 002 2z" />
                                </svg>
                                {sale.formattedDate || new Date(sale.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {isAdmin && sale.status !== 'cancelled' && (
                                <Link
                                    to={`/sales/${sale._id}/edit`}
                                    className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl border border-gray-300 flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Modifier
                                </Link>
                            )}
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                                disabled={sale.status === 'completed' || sale.status === 'cancelled'}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h6m-6 0H6" />
                                </svg>
                                Ajouter Paiement
                            </button>
                            {(sale.status === 'pending' || sale.status === 'partially_paid') && (
                                <button
                                    onClick={() => setShowReminderModal(true)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {sale.paymentReminder?.isSet ? 'Modifier Rappel' : 'Définir Rappel'}
                                </button>
                            )}
                            {sale.status === 'completed' && (
                                <button
                                    onClick={() => setShowDeliveryModal(true)}
                                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Statut Livraison
                                </button>
                            )}
                            {sale.modificationHistory && sale.modificationHistory.length > 0 && (
                                <button
                                    onClick={() => setShowHistoryModal(true)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Historique
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Payment Reminder Section */}
                    {sale.paymentReminder?.isSet && (
                        <div className={`mb-6 p-4 rounded-xl border ${isReminderOverdue()
                            ? 'bg-red-50 border-red-200'
                            : sale.paymentReminder.status === 'sent'
                                ? 'bg-green-50 border-green-200'
                                : isReminderDueToday()
                                    ? 'bg-orange-50 border-orange-200'
                                    : 'bg-blue-50 border-blue-200'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">Rappel de paiement</h4>
                                        <p className="text-sm">
                                            {sale.paymentReminder.status === 'sent' ? (
                                                <span className="text-green-600">
                                                    ✅ Envoyé le {formatReminderDate(sale.paymentReminder.sentAt)}
                                                </span>
                                            ) : isReminderOverdue() ? (
                                                <span className="text-red-600 font-medium">
                                                    ⚠️ EN RETARD - {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            ) : isReminderDueToday() ? (
                                                <span className="text-orange-600 font-medium">
                                                    ⏰ AUJOURD'HUI - {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            ) : (
                                                <span className="text-blue-600">
                                                    📅 Programmé pour {formatReminderDate(sale.paymentReminder.reminderDate)}
                                                </span>
                                            )}
                                        </p>
                                        {sale.paymentReminder.reminderNote && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                Note: {sale.paymentReminder.reminderNote}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {sale.paymentReminder.status === 'pending' && (
                                        <button
                                            onClick={handleSendReminder}
                                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
                                            title="Envoyer le rappel maintenant"
                                        >
                                            Envoyer
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowReminderModal(true)}
                                        className="text-blue-600 hover:text-blue-800 p-1.5 transition-colors"
                                        title="Modifier le rappel"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleDeleteReminder}
                                        className="text-red-600 hover:text-red-800 p-1.5 transition-colors"
                                        title='Supprimer le rappel'
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
                        <div className={`mb-6 p-4 rounded-xl border ${sale.deliveryStatus === 'delivered'
                            ? 'bg-green-50 border-green-200'
                            : sale.deliveryStatus === 'not_delivered'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">Statut de livraison</h4>
                                        <p className="text-sm">
                                            {sale.deliveryStatus === 'delivered' ? (
                                                <span className="text-green-600 font-medium">
                                                    ✅ Livré le {sale.deliveryDate ? new Date(sale.deliveryDate).toLocaleDateString('fr-FR') : 'Date non spécifiée'}
                                                </span>
                                            ) : sale.deliveryStatus === 'not_delivered' ? (
                                                <span className="text-red-600 font-medium">
                                                    ❌ Non livré
                                                </span>
                                            ) : (
                                                <span className="text-blue-600">
                                                    ⏳ En attente de livraison
                                                </span>
                                            )}
                                        </p>
                                        {sale.deliveryNote && (
                                            <p className="text-sm text-gray-600 mt-1">
                                                Note: {sale.deliveryNote}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowDeliveryModal(true)}
                                        className="text-blue-600 hover:text-blue-800 p-1.5 transition-colors"
                                        title="Modifier le statut de livraison"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Note Section */}
                    {sale.note && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <div className="bg-gray-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                Note
                            </h3>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <p className="text-gray-700 whitespace-pre-wrap">{sale.note}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                        {/* Informations client */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <div className="bg-blue-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                Client
                            </h3>

                            {sale.client ? (
                                <div className="space-y-2">
                                    <div className="flex items-start">
                                        <span className="font-medium text-sm w-20">Nom:</span>
                                        {isAdmin ? (
                                            <Link
                                                to={`/clients/${sale.client._id}`}
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
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <div className="bg-green-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="CurrentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
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
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <div className="bg-purple-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                Résumé Financier
                            </h3>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm">Total de la vente:</span>
                                    <span className="text-sm font-semibold">{sale.totalAmount?.toFixed(0)} CFA</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Total payé:</span>
                                    <span className="text-sm font-semibold text-green-600">{sale.totalPaid?.toFixed(0)} CFA</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="text-sm font-medium">Solde restant:</span>
                                    <span className={`text-sm font-semibold ${sale.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Math.abs(sale.balance)?.toFixed(0)} CFA
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section Bénéfices */}
                        {isAdmin && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <div className="bg-green-100 p-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
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

                    {/* Liste des produits avec bénéfices */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                            <div className="bg-yellow-100 p-1.5 rounded-lg">
                                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                            {isAdmin ? 'Produits vendus avec bénéfices' : 'Produits vendus'}
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix unitaire</th>
                                        {isAdmin && (
                                            <>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coût unitaire</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bénéfice unit.</th>
                                            </>
                                        )}
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        {isAdmin && (
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
                                        
                                        return (
                                            <tr key={index}>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {item.product?.name || "Produit supprimé"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {item.priceAtSale?.toFixed(0)} CFA
                                                </td>
                                                {isAdmin && (
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
                                                {isAdmin && (
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
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={isAdmin ? 5 : 3} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                            Totaux:
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                            {sale.totalAmount?.toFixed(0)} CFA
                                        </td>
                                        {isAdmin && (
                                            <>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {totalProfit?.toFixed(0)} CFA
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold">
                                                    <span className={profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {profitMargin?.toFixed(1)}%
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Historique des paiements */}
                    <div>
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
                                            {sale.payments.map((payment, index) => (
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
                                                                {payment.user?.name || "Inconnu"}
                                                            </span>
                                                            {payment.user?.email && (
                                                                <span className="text-xs text-gray-500">
                                                                    {payment.user.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        {payment.user ? getRoleBadge(payment.user.role) : "Non spécifié"}
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
                                            ))}
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
                </div>

                {/* Modal de paiement */}
                <PaymentModal
                    show={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    sale={sale}
                    onAddPayment={handleAddPayment}
                />

                {/* Modal de rappel */}
                {showReminderModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <div className="bg-orange-100 p-1.5 rounded-lg">
                                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    {sale.paymentReminder?.isSet ? 'Modifier le rappel' : 'Définir un rappel'}
                                </h3>
                                <button
                                    onClick={() => setShowReminderModal(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date et heure du rappel
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={reminderDate}
                                        onChange={(e) => setReminderDate(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Note du rappel (optionnelle)
                                    </label>
                                    <textarea
                                        value={reminderNote}
                                        onChange={(e) => setReminderNote(e.target.value)}
                                        placeholder="Message pour le rappel..."
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        rows="3"
                                        maxLength="200"
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        {reminderNote.length}/200 caractères
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                                    <p className="text-sm text-blue-700">
                                        Ce rappel sera affiché sur le tableau de bord et pourra être utilisé pour envoyer
                                        des notifications de suivi au client.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        onClick={() => setShowReminderModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleSetReminder}
                                        className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
                                    >
                                        {sale.paymentReminder?.isSet ? 'Modifier' : 'Définir'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de statut de livraison */}
                {showDeliveryModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <div className="bg-blue-100 p-1.5 rounded-lg">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    Statut de livraison
                                </h3>
                                <button
                                    onClick={() => setShowDeliveryModal(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Statut de livraison
                                    </label>
                                    <select
                                        value={deliveryStatus}
                                        onChange={(e) => setDeliveryStatus(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    >
                                        <option value="pending">En attente</option>
                                        <option value="delivered">Livré</option>
                                        <option value="not_delivered">Non livré</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Note de livraison (optionnelle)
                                    </label>
                                    <textarea
                                        value={deliveryNote}
                                        onChange={(e) => setDeliveryNote(e.target.value)}
                                        placeholder="Notes sur la livraison..."
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        rows="3"
                                        maxLength="500"
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        {deliveryNote.length}/500 caractères
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        onClick={() => setShowDeliveryModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleUpdateDelivery}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                                    >
                                        Enregistrer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal d'historique des modifications */}
                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-4xl border border-gray-200 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <div className="bg-gray-100 p-1.5 rounded-lg">
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    Historique des modifications
                                </h3>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1 rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {sale.modificationHistory && sale.modificationHistory.length > 0 ? (
                                    <div className="overflow-y-auto max-h-96">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modifications</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {sale.modificationHistory.map((history, index) => {
                                                    const historyUser = history.user;
                                                    const userName = historyUser && typeof historyUser === 'object'
                                                        ? (historyUser.name || 'Utilisateur inconnu')
                                                        : 'Utilisateur inconnu';
                                                    const userRole = historyUser && typeof historyUser === 'object'
                                                        ? (historyUser.isAdmin ? 'admin' : historyUser.role || 'user')
                                                        : 'user';

                                                    return (
                                                        <tr key={index}>
                                                            <td className="px-4 py-4 whitespace-nowrap">
                                                                <div className="text-sm text-gray-900">
                                                                    {formatModificationDate(history.date)}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 whitespace-nowrap">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-gray-900">
                                                                        {userName}
                                                                    </span>
                                                                    <span className="text-xs mt-1">
                                                                        {getRoleBadge(userRole)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                <div className="text-sm text-gray-500">
                                                                    {history.note || "Aucune note"}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4">
                                                                {history.changes && history.changes.products && history.changes.products.length > 0 ? (
                                                                    <div className="text-sm space-y-2">
                                                                        {history.changes.products.map((change, idx) => {
                                                                        const productId = change.product && typeof change.product === 'object'
                                                                            ? (change.product._id || change.product.toString?.())
                                                                            : change.product;
                                                                        const productName = (change.product && change.product.name)
                                                                            || (productId ? productNames[productId.toString()] : null)
                                                                            || "Produit inconnu";
                                                                            return (
                                                                                <div key={idx} className="mb-3 p-2 bg-gray-50 rounded-lg">
                                                                                    <div className="font-medium text-blue-600 mb-1">{productName}</div>
                                                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                        {change.oldQuantity !== undefined && change.newQuantity !== undefined && (
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-gray-500">Quantité:</span>
                                                                                                <span>
                                                                                                    {change.oldQuantity} → <span className="font-semibold text-green-600">{change.newQuantity}</span>
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                        {change.oldPrice !== undefined && change.newPrice !== undefined && (
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-gray-500">Prix:</span>
                                                                                                <span>
                                                                                                    {change.oldPrice?.toFixed(0)} CFA → <span className="font-semibold text-green-600">{change.newPrice?.toFixed(0)} CFA</span>
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">Aucun détail de modification</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="mt-4 text-gray-500 text-sm">Aucune modification enregistrée pour cette vente</p>
                                    </div>
                                )}

                                <div className="flex justify-end mt-6">
                                    <button
                                        onClick={() => setShowHistoryModal(false)}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SaleDetailPage;
