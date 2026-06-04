import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { employeePayrollPath } from '../utils/paths';

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const isSalaryCategory = (category) => {
    const normalized = normalizeText(category);
    return normalized === 'salaries' || normalized === 'salary' || normalized.includes('salaire');
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

const PaySlipForm = () => {
    const { id, payslipId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        deductions: 0,
        bonuses: 0,
        status: 'pending'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [salaryExpenses, setSalaryExpenses] = useState([]);
    const [salaryExpensesLoading, setSalaryExpensesLoading] = useState(false);
    const [salaryExpensesError, setSalaryExpensesError] = useState('');
    const employeeReference = employee || { _id: id };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: employeeData } = await api.get(`/employees/${id}`);
                setEmployee(employeeData);

                if (payslipId) {
                    setIsEditMode(true);
                    const { data: payslipData } = await api.get(`/employees/${id}/payroll/${payslipId}`);
                    setFormData({
                        month: payslipData.month,
                        year: payslipData.year,
                        deductions: payslipData.deductions,
                        bonuses: payslipData.bonuses,
                        status: payslipData.status || 'pending'
                    });
                }
                setErrors({});
            } catch (err) {
                setErrors({ fetch: err.response?.data?.message || 'Erreur de chargement des données' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, payslipId]);

    useEffect(() => {
        if (!employee || isEditMode) return;

        const fetchSalaryExpenses = async () => {
            try {
                setSalaryExpensesLoading(true);
                setSalaryExpensesError('');
                const { data } = await api.get('/expenses', {
                    params: {
                        employee: id,
                        salaryMonth: formData.month,
                        salaryYear: formData.year,
                    },
                });
                const list = Array.isArray(data) ? data.filter((expense) => isSalaryCategory(expense.category)) : [];
                const total = list.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
                setSalaryExpenses(list);
                setFormData((prev) => ({
                    ...prev,
                    deductions: total,
                }));
            } catch (err) {
                setSalaryExpenses([]);
                setSalaryExpensesError(err.response?.data?.message || 'Impossible de charger les dépenses de salaire');
            } finally {
                setSalaryExpensesLoading(false);
            }
        };

        fetchSalaryExpenses();
    }, [employee, formData.month, formData.year, id, isEditMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data = {
                ...formData,
                month: parseInt(formData.month),
                year: parseInt(formData.year),
                baseSalary: employee.salary,
                netSalary: employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0)
            };

            if (isEditMode) {
                await api.put(`/employees/${id}/payroll/${payslipId}`, data);
            } else {
                await api.post(`/employees/${id}/payroll`, data);
            }
            navigate(employeePayrollPath(employeeReference));
        } catch (err) {
            setErrors(err.response?.data?.errors || { general: err.response?.data?.message || 'Erreur de sauvegarde' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full absolute border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></div>
                    <div className="w-12 h-12 rounded-full absolute border-2 border-[var(--ms-border)] opacity-20"></div>
                </div>
            </div>
        );
    }

    const netSalary = employee
        ? employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0)
        : 0;
    const salaryExpensesTotal = salaryExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    return (
        <div className="max-w-3xl mx-auto p-4">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate(employeePayrollPath(employeeReference))}
                    className="p-2 rounded-full hover:bg-[var(--ms-bg-subtle)] mr-2 transition-colors"
                >
                    <svg className="w-5 h-5 text-[var(--ms-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-semibold text-[var(--ms-text-strong)]">
                    {isEditMode ? 'Modifier le bulletin' : 'Nouveau bulletin'}
                </h1>
            </div>

            <div className="bg-[var(--ms-white)] rounded-lg border border-[var(--ms-border)] p-6 shadow-[var(--ms-shadow-sm)]">
                {/* Employee Information */}
                {employee && (
                    <div className="mb-6 p-4 bg-[var(--ms-bg-subtle)] rounded-md">
                        <div className="text-sm font-medium text-[var(--ms-text-muted)] mb-1">Employé</div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-[var(--ms-text)] font-medium text-lg">
                                    {employee.name.charAt(0)}
                                </span>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-[var(--ms-text-strong)]">{employee.name}</div>
                                <div className="text-sm text-[var(--ms-text)]">{employee.position}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-[var(--ms-text-muted)]">Département</div>
                                <div className="text-sm font-medium text-[var(--ms-text-strong)]">{employee.department}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--ms-text-muted)]">Salaire de base</div>
                                <div className="text-sm font-medium text-[var(--ms-text-strong)]">
                                    {employee.salary?.toLocaleString('fr-FR')} CFA
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {errors.general && (
                    <div className="mb-6 p-4 bg-[var(--ms-danger)]/10 text-[var(--ms-danger)] rounded-md flex items-start gap-3 border border-red-100">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--ms-text)]">
                                Mois
                            </label>
                            <select
                                name="month"
                                value={formData.month}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-md border border-[var(--ms-border)] focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                required
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const monthValue = i + 1;
                                    return (
                                        <option key={monthValue} value={monthValue}>
                                            {new Date(0, i).toLocaleDateString('fr-FR', { month: 'long' })}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.month && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.month}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--ms-text)]">
                                Année
                            </label>
                            <input
                                type="number"
                                name="year"
                                value={formData.year}
                                onChange={handleChange}
                                min="2000"
                                className="w-full px-4 py-3 rounded-md border border-[var(--ms-border)] focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                required
                            />
                            {errors.year && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.year}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--ms-text)]">
                                Déductions (CFA)
                            </label>
                            <input
                                type="number"
                                name="deductions"
                                value={formData.deductions}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-3 rounded-md border border-[var(--ms-border)] focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            />
                            {errors.deductions && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.deductions}
                                </div>
                            )}
                            {!isEditMode && (
                                <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]/80 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-[var(--ms-text)]">Dépenses salaire du mois</span>
                                        <span className="font-semibold text-[var(--ms-text-strong)]">{formatCurrency(salaryExpensesTotal)}</span>
                                    </div>
                                    {salaryExpensesLoading && (
                                        <p className="mt-2 text-xs text-[var(--ms-text-muted)]">Chargement des dépenses liées...</p>
                                    )}
                                    {salaryExpensesError && (
                                        <p className="mt-2 text-xs text-[var(--ms-danger)]">{salaryExpensesError}</p>
                                    )}
                                    {!salaryExpensesLoading && !salaryExpensesError && salaryExpenses.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {salaryExpenses.map((expense) => (
                                                <div key={expense._id} className="flex items-start justify-between gap-3 rounded-md bg-[var(--ms-white)] px-3 py-2 border border-[var(--ms-border)]">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-[var(--ms-text-strong)]">{expense.description}</p>
                                                        <p className="text-xs text-[var(--ms-text-muted)]">
                                                            {expense.date ? new Date(expense.date).toLocaleDateString('fr-FR') : 'Date non définie'}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 font-semibold text-[var(--ms-danger)]">
                                                        - {formatCurrency(expense.amount)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!salaryExpensesLoading && !salaryExpensesError && salaryExpenses.length === 0 && (
                                        <p className="mt-2 text-xs text-[var(--ms-text-muted)]">Aucune dépense de salaire liée à ce mois.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--ms-text)]">
                                Primes (CFA)
                            </label>
                            <input
                                type="number"
                                name="bonuses"
                                value={formData.bonuses}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-3 rounded-md border border-[var(--ms-border)] focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            />
                            {errors.bonuses && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.bonuses}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Field (Edit Mode Only) */}
                    {isEditMode && (
                        <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--ms-text)]">
                            Statut
                            </label>
                            <div className="flex space-x-4">
                                {[
                                    { value: 'pending', label: 'En attente', color: 'bg-[var(--ms-warning)]/15 text-amber-800' },
                                    { value: 'paid', label: 'Payé', color: 'bg-[var(--ms-success)]/15 text-green-800' },
                                    { value: 'cancelled', label: 'Annulé', color: 'bg-[var(--ms-danger)]/15 text-red-800' }
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
                                            : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-gray-200'}`}>
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Net Salary Calculation */}
                    <div className="bg-[var(--ms-bg-subtle)] rounded-md p-5">
                        <h3 className="text-lg font-semibold text-[var(--ms-text-strong)] mb-4">Calcul du salaire</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">Salaire de base</span>
                                <span className="font-medium">
                                    {employee?.salary?.toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">+ Primes</span>
                                <span className="text-[var(--ms-success)] font-medium">
                                    + {parseFloat(formData.bonuses || 0).toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">- Déductions</span>
                                <span className="text-[var(--ms-danger)] font-medium">
                                    - {parseFloat(formData.deductions || 0).toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="border-t border-[var(--ms-border)] pt-3 mt-2">
                                <div className="flex justify-between">
                                    <span className="text-[var(--ms-text-strong)] font-semibold">Salaire net</span>
                                    <span className="text-xl font-bold text-[var(--ms-blue)]">
                                        {netSalary.toLocaleString('fr-FR')} CFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-6 border-t border-[var(--ms-border)]">
                    <button
                        type="button"
                        onClick={() => navigate(employeePayrollPath(employeeReference))}
                        className="px-5 py-2.5 rounded-md text-[var(--ms-text)] hover:bg-[var(--ms-bg-subtle)] flex items-center gap-2 justify-center transition-colors"
                    >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-[var(--ms-blue)] hover:bg-blue-700 text-white px-5 py-2.5 rounded-md flex items-center gap-2 justify-center disabled:opacity-50 transition-colors shadow-[var(--ms-shadow-sm)]"
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
                                    {isEditMode ? 'Mettre à jour le bulletin' : 'Créer le bulletin'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaySlipForm;
