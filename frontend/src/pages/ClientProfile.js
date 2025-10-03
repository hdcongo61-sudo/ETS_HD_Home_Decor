import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import ExportSalesPdf from '../components/ExportSalesPdf';

const ClientProfile = () => {
    const { id } = useParams();
    const [client, setClient] = useState(null);
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({
        totalSpent: 0,
        purchaseCount: 0,
        lastPurchaseDate: null,
        averagePurchase: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch client details
                const clientResponse = await api.get(`/clients/${id}`);
                const clientData = clientResponse.data;
                setClient(clientData);

                // Fetch client purchases
                const purchasesResponse = await api.get(`/sales?client=${id}`);
                const purchasesData = purchasesResponse.data;
                setPurchases(purchasesData);

                // Calculate statistics
                const totalSpent = purchasesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
                const purchaseCount = purchasesData.length;
                const lastPurchaseDate = purchaseCount > 0
                    ? new Date(Math.max(...purchasesData.map(s => new Date(s.saleDate))))
                    : null;
                const averagePurchase = purchaseCount > 0 ? totalSpent / purchaseCount : 0;

                setStats({
                    totalSpent,
                    purchaseCount,
                    lastPurchaseDate,
                    averagePurchase
                });

            } catch (error) {
                console.error('Error fetching client data:', error);
                setError('Erreur de chargement des données du client');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const formatDate = (dateString) => {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500">Chargement...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-full">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-medium text-red-800">Erreur</p>
                        <p className="text-red-600 mt-1">{error}</p>
                        <Link to="/clients" className="inline-block mt-3 text-blue-500 hover:text-blue-600 font-medium">
                            ← Retour à la liste des clients
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="text-center py-12">
                    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-gray-900">Client non trouvé</h2>
                    <p className="mt-2 text-gray-500">Le client que vous recherchez n'existe pas ou a été supprimé.</p>
                    <Link to="/clients" className="mt-6 inline-flex items-center text-blue-500 hover:text-blue-600 font-medium">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour à la liste des clients
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                <div className="flex items-center">
                    <Link to="/clients" className="mr-4 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-semibold text-gray-900">Profil du client</h1>
                </div>
                
                <div className="flex items-center mt-4 md:mt-0 space-x-2">
                    <Link
                        to={`/clients/edit/${client._id}`}
                        className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Modifier
                    </Link>
                    <button
                        onClick={() => window.print()}
                        className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Client Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center">
                    <div className="flex items-center mb-4 md:mb-0 md:flex-1">
                        <div className="bg-gray-100 w-16 h-16 rounded-xl flex items-center justify-center mr-4">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900">{client.name}</h2>
                            <p className="text-gray-500">{client.email}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 md:w-auto">
                        <div className="bg-blue-50 p-3 rounded-xl">
                            <p className="text-xs text-blue-600 font-medium">ACHATS</p>
                            <p className="text-xl font-semibold text-gray-900">{stats.purchaseCount}</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-xl">
                            <p className="text-xs text-green-600 font-medium">TOTAL</p>
                            <p className="text-xl font-semibold text-gray-900">{stats.totalSpent.toLocaleString('fr-FR')} CFA</p>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 font-medium">TÉLÉPHONE</p>
                            <p className="text-gray-900">{client.phone || 'Non renseigné'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">ADRESSE</p>
                            <p className="text-gray-900">{client.address || 'Non renseignée'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">INSCRIT LE</p>
                            <p className="text-gray-900">{new Date(client.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Moyenne par achat</h3>
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900">
                        {stats.averagePurchase.toLocaleString('fr-FR')} CFA
                    </p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Dernier achat</h3>
                        <div className="bg-green-100 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-medium text-gray-900">
                        {stats.lastPurchaseDate ? formatDate(stats.lastPurchaseDate) : 'Aucun achat'}
                    </p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Statut</h3>
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-medium text-gray-900">
                        {stats.purchaseCount > 0 ? 'Client actif' : 'Nouveau client'}
                    </p>
                </div>
            </div>

            {/* Purchase History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Historique des achats</h2>
                    <p className="text-sm text-gray-500 mt-1">{purchases.length} achat{purchases.length !== 1 ? 's' : ''}</p>
                </div>
                
                {purchases.length === 0 ? (
                    <div className="py-12 px-6 text-center">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-gray-900 font-medium">Aucun achat</h3>
                        <p className="mt-1 text-gray-500">Ce client n'a effectué aucun achat pour le moment.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {purchases.map((sale) => (
                            <div key={sale._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center">
                                            <p className="text-sm font-medium text-gray-900">
                                                {formatDate(sale.saleDate)}
                                            </p>
                                            <span className={`ml-3 px-2 py-0.5 text-xs rounded-full ${sale.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                sale.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {sale.status === 'completed' ? 'Complété' :
                                                    sale.status === 'cancelled' ? 'Annulé' :
                                                        'En cours'}
                                            </span>
                                        </div>
                                        
                                        <div className="mt-2 text-sm text-gray-500">
                                            {sale.products.map((item, index) => (
                                                <span key={index}>
                                                    {item.product?.name || "Produit supprimé"}
                                                    {index < sale.products.length - 1 ? ', ' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 md:mt-0 flex items-center justify-between md:justify-end md:space-x-4">
                                        <p className="text-lg font-semibold text-gray-900">
                                            {sale.totalAmount?.toLocaleString('fr-FR')} CFA
                                        </p>
                                        
                                        <div className="flex space-x-2">
                                            <Link
                                                to={`/sales/${sale._id}`}
                                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                title="Voir les détails"
                                            >
                                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                            </Link>

                                            <ExportSalesPdf sale={sale} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientProfile;