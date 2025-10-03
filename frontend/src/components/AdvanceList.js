// src/components/AdvanceList.js
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const AdvanceList = () => {
    const { id } = useParams();
    const [advances, setAdvances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [employee, setEmployee] = useState(null);

    useEffect(() => {
        const fetchAdvances = async () => {
            try {
                setLoading(true);
                const { data: employeeData } = await api.get(`/employees/${id}`);
                setEmployee(employeeData);

                const { data: advancesData } = await api.get(`/employees/${id}/advances`);
                setAdvances(advancesData);
                setError('');
            } catch (err) {
                setError(err.response?.data?.message || 'Erreur de chargement des avances');
            } finally {
                setLoading(false);
            }
        };
        fetchAdvances();
    }, [id]);

    const handleDelete = async (advanceId) => {
        if (window.confirm('Confirmer la suppression de cette demande d\'avance ?')) {
            try {
                await api.delete(`/employees/${id}/advances/${advanceId}`);
                setAdvances(advances.filter(adv => adv._id !== advanceId));
            } catch (err) {
                setError(err.response?.data?.message || 'Erreur lors de la suppression');
            }
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
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Avances sur Salaire</h1>
                        <p className="text-gray-500 mt-1">pour {employee?.name}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Link
                            to={`/employees/${id}`}
                            className="bg-white text-gray-700 px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Retour au Profil
                        </Link>
                        <Link
                            to={`/employees/${id}/advances/new`}
                            className="bg-blue-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center hover:bg-blue-600 transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Nouvelle Avance
                        </Link>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {advances.length > 0 ? (
                        <div className="overflow-hidden">
                            <div className="grid grid-cols-1 divide-y divide-gray-100">
                                {advances.map((advance) => (
                                    <div key={advance._id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="text-lg font-semibold text-gray-900">
                                                        {new Intl.NumberFormat('fr-FR').format(advance.amount)} CFA
                                                    </div>
                                                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${advance.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        advance.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {advance.status === 'approved' ? 'Approuvée' : advance.status === 'pending' ? 'En Attente' : 'Rejetée'}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-500 mb-1">
                                                    {advance.reason}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {new Date(advance.date).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDelete(advance._id)}
                                                    className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune avance trouvée</h3>
                            <p className="text-gray-500">Commencez par créer une nouvelle demande d'avance sur salaire.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdvanceList;