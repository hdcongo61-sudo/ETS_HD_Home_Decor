// src/components/AdvanceForm.js
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { employeeAdvancesPath } from '../utils/paths';

const AdvanceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        amount: '',
        reason: '',
        status: 'pending',
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [maxAdvance, setMaxAdvance] = useState(0);
    const employeeReference = employee || { _id: id };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data } = await api.get(`/employees/${id}`);
                setEmployee(data);
                setMaxAdvance(data.salary * 0.5); // Max 50% du salaire
                setErrors({});
            } catch (err) {
                setErrors({ fetch: err.response?.data?.message || 'Erreur de chargement des données' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (parseFloat(formData.amount) > maxAdvance) {
            setErrors({ amount: `L'avance ne peut pas dépasser ${new Intl.NumberFormat('fr-FR').format(maxAdvance)} CFA (50% du salaire)` });
            setIsSubmitting(false);
            return;
        }

        try {
            const data = {
                ...formData,
                amount: parseFloat(formData.amount),
            };

            await api.post(`/employees/${id}/advances`, data);
            navigate(employeeAdvancesPath(employeeReference));
        } catch (err) {
            setErrors(err.response?.data?.errors || { general: err.response?.data?.message || 'Erreur de sauvegarde' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setErrors({ ...errors, [e.target.name]: '' });
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

    return (
        <div className="max-w-2xl mx-auto p-4">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate(employeeAdvancesPath(employeeReference))}
                    className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">Nouvelle Demande d'Avance</h1>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                {employee && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                        <div className="text-sm font-medium text-gray-500 mb-1">Employé</div>
                        <div className="text-lg font-semibold text-gray-900 mb-2">{employee.name}</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-gray-500">Salaire Mensuel</div>
                                <div className="text-sm font-medium text-gray-900">{new Intl.NumberFormat('fr-FR').format(employee.salary)} CFA</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Avance Maximum</div>
                                <div className="text-sm font-medium text-blue-600">{new Intl.NumberFormat('fr-FR').format(maxAdvance)} CFA</div>
                            </div>
                        </div>
                    </div>
                )}

                {errors.general && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <div className="font-medium">Erreur</div>
                            <div className="text-sm">{errors.general}</div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <FormField
                        label="Montant (CFA)"
                        type="number"
                        name="amount"
                        value={formData.amount}
                        error={errors.amount}
                        onChange={handleChange}
                        min="0"
                        max={maxAdvance}
                        required
                        placeholder="Saisir le montant"
                    />

                    <FormField
                        label="Motif"
                        type="text"
                        name="reason"
                        value={formData.reason}
                        error={errors.reason}
                        onChange={handleChange}
                        required
                        placeholder="Raison de la demande d'avance"
                    />

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Statut
                        </label>
                        <div className="flex space-x-4">
                            {[
                                { value: 'pending', label: 'En Attente', color: 'bg-amber-100 text-amber-800' },
                                { value: 'approved', label: 'Approuvée', color: 'bg-green-100 text-green-800' },
                                { value: 'rejected', label: 'Rejetée', color: 'bg-red-100 text-red-800' }
                            ].map((option) => (
                                <label key={option.value} className="flex items-center">
                                    <input
                                        type="radio"
                                        name="status"
                                        value={option.value}
                                        checked={formData.status === option.value}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <span className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${formData.status === option.value 
                                        ? option.color 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {option.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => navigate(employeeAdvancesPath(employeeReference))}
                            className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 justify-center transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 justify-center disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Traitement...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Créer l'Avance
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FormField = ({ label, type = 'text', name, value, error, onChange, min, max, required, placeholder }) => (
    <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            placeholder={placeholder}
            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors ${error ? 'border-red-500' : 'border-gray-200'}`}
        />
        {error && (
            <div className="text-red-500 text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        )}
    </div>
);

export default AdvanceForm;
