import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import EditSaleForm from '../components/EditSaleForm';
import AuthContext from '../context/AuthContext';

const EditSalePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { auth } = useContext(AuthContext);
    const [sale, setSale] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [saleRes, clientsRes] = await Promise.all([
                    api.get(`/sales/${id}`),
                    api.get('/clients')
                ]);

                setSale(saleRes.data);

                // Correction: garantir que clients est un tableau
                const clientsData = clientsRes.data;
                setClients(Array.isArray(clientsData) ? clientsData : []);
            } catch (err) {
                setError('Error loading data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleUpdateSale = async (updateData) => {
        try {
            // Utiliser l'ID de la vente actuelle
            await api.put(`/sales/${sale._id}`, {
                products: updateData.products,
                note: updateData.note
            });

            navigate(`/sales/${sale._id}`, {
                state: { message: 'Sale updated successfully' }
            });
        } catch (error) {
            console.error('Update error:', {
                error: error.response?.data || error.message,
                request: {
                    url: `/sales/${sale?._id}/edit`,
                    data: updateData
                }
            });

            setError(error.response?.data?.message ||
                `Update error: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full absolute border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></div>
                    <div className="w-12 h-12 rounded-full absolute border-2 border-gray-100 opacity-20"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-red-50 text-red-700 rounded-xl flex items-start gap-3 p-4 border border-red-100">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                        <div className="font-medium">Error</div>
                        <div className="text-sm">{error}</div>
                    </div>
                    <button
                        onClick={() => setError('')}
                        className="text-red-500 hover:text-red-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="max-w-4xl mx-auto p-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Sale Not Found</h3>
                    <p className="text-gray-600 mb-4">The requested sale could not be found.</p>
                    <button
                        onClick={() => navigate('/sales')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
                    >
                        Back to Sales
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate(`/sales/${id}`)}
                    className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">Edit Sale</h1>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <EditSaleForm
                    sale={sale}
                    clients={clients}
                    onUpdate={handleUpdateSale}
                    onCancel={() => navigate(`/sales/${id}`)}
                />
            </div>
        </div>
    );
};

export default EditSalePage;