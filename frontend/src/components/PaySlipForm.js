import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import api from '../services/api';
import { employeePayrollPath } from '../utils/paths';
import { Button, PageHeader, Surface, Workspace } from './business';

const FieldError = ({ children }) =>
  children ? (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ms-danger)]">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </p>
  ) : null;

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
            <Workspace className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--ms-blue)]" />
            </Workspace>
        );
    }

    const netSalary = employee
        ? employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0)
        : 0;
    const salaryExpensesTotal = salaryExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    return (
        <Workspace className="space-y-5 max-w-3xl">
            <PageHeader
                eyebrow="Paie"
                title={isEditMode ? 'Modifier le bulletin' : 'Nouveau bulletin'}
                description={employee ? `${employee.name}${employee.position ? ` · ${employee.position}` : ''}` : undefined}
                actions={
                    <Button variant="secondary" size="md" onClick={() => navigate(employeePayrollPath(employeeReference))}>
                        <ArrowLeft className="h-4 w-4" /> Retour
                    </Button>
                }
            />

            <Surface className="p-5 sm:p-6">
                {/* Employee Information */}
                {employee && (
                    <div className="mb-6 flex flex-col gap-4 rounded-[var(--radiusLarge)] bg-[var(--ms-bg-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ms-blue-soft)] text-lg font-semibold text-[var(--ms-blue)]">
                                {employee.name.charAt(0)}
                            </div>
                            <div>
                                <div className="font-semibold text-[var(--ms-text-strong)]">{employee.name}</div>
                                <div className="text-sm text-[var(--ms-text-muted)]">
                                    {[employee.position, employee.department].filter(Boolean).join(' · ')}
                                </div>
                            </div>
                        </div>
                        <div className="sm:text-right">
                            <div className="text-xs uppercase tracking-wide text-[var(--ms-text-muted)]">Salaire de base</div>
                            <div className="text-lg font-semibold text-[var(--ms-text-strong)]">{formatCurrency(employee.salary)}</div>
                        </div>
                    </div>
                )}

                {errors.general && (
                    <div className="mb-6 flex items-start gap-3 rounded-[var(--radiusLarge)] border border-[var(--colorStatusDangerStroke1)] bg-[var(--colorStatusDangerBackground1)] p-4 text-[var(--ms-danger)]">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <div className="font-semibold">Erreur</div>
                            <div className="text-sm">{errors.general}</div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Mois</label>
                            <select name="month" value={formData.month} onChange={handleChange} className="form-control" required>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((monthValue) => (
                                    <option key={monthValue} value={monthValue}>
                                        {new Date(0, monthValue - 1).toLocaleDateString('fr-FR', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                            <FieldError>{errors.month}</FieldError>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Année</label>
                            <input type="number" name="year" value={formData.year} onChange={handleChange} min="2000" className="form-control" required />
                            <FieldError>{errors.year}</FieldError>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Déductions (CFA)</label>
                            <input type="number" name="deductions" value={formData.deductions} onChange={handleChange} min="0" className="form-control" />
                            <FieldError>{errors.deductions}</FieldError>
                            {!isEditMode && (
                                <div className="mt-3 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]/80 p-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-[var(--ms-text)]">Dépenses salaire du mois</span>
                                        <span className="font-semibold text-[var(--ms-text-strong)]">{formatCurrency(salaryExpensesTotal)}</span>
                                    </div>
                                    {salaryExpensesLoading && <p className="mt-2 text-xs text-[var(--ms-text-muted)]">Chargement des dépenses liées...</p>}
                                    {salaryExpensesError && <p className="mt-2 text-xs text-[var(--ms-danger)]">{salaryExpensesError}</p>}
                                    {!salaryExpensesLoading && !salaryExpensesError && salaryExpenses.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {salaryExpenses.map((expense) => (
                                                <div key={expense._id} className="flex items-start justify-between gap-3 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-[var(--ms-text-strong)]">{expense.description}</p>
                                                        <p className="text-xs text-[var(--ms-text-muted)]">
                                                            {expense.date ? new Date(expense.date).toLocaleDateString('fr-FR') : 'Date non définie'}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 font-semibold text-[var(--ms-danger)]">- {formatCurrency(expense.amount)}</span>
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

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Primes (CFA)</label>
                            <input type="number" name="bonuses" value={formData.bonuses} onChange={handleChange} min="0" className="form-control" />
                            <FieldError>{errors.bonuses}</FieldError>
                        </div>
                    </div>

                    {/* Status Field (Edit Mode Only) */}
                    {isEditMode && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Statut</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'pending', label: 'En attente', active: 'bg-[var(--colorStatusWarningBackground1)] text-[var(--colorStatusWarningForeground1)]' },
                                    { value: 'paid', label: 'Payé', active: 'bg-[var(--colorStatusSuccessBackground1)] text-[var(--colorStatusSuccessForeground1)]' },
                                    { value: 'cancelled', label: 'Annulé', active: 'bg-[var(--colorStatusDangerBackground1)] text-[var(--colorStatusDangerForeground1)]' },
                                ].map((option) => (
                                    <label key={option.value} className="cursor-pointer">
                                        <input type="radio" name="status" value={option.value} checked={formData.status === option.value} onChange={handleChange} className="sr-only" />
                                        <span className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition-colors ${formData.status === option.value ? option.active : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-[var(--ms-surface-muted)]'}`}>
                                            {option.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Net Salary Calculation */}
                    <div className="rounded-[var(--radiusLarge)] bg-[var(--ms-bg-subtle)] p-5">
                        <h3 className="mb-4 text-base font-semibold text-[var(--ms-text-strong)]">Calcul du salaire</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">Salaire de base</span>
                                <span className="font-medium text-[var(--ms-text-strong)]">{employee?.salary?.toLocaleString('fr-FR')} CFA</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">+ Primes</span>
                                <span className="font-medium text-[var(--ms-success)]">+ {parseFloat(formData.bonuses || 0).toLocaleString('fr-FR')} CFA</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--ms-text)]">- Déductions</span>
                                <span className="font-medium text-[var(--ms-danger)]">- {parseFloat(formData.deductions || 0).toLocaleString('fr-FR')} CFA</span>
                            </div>
                            <div className="mt-2 flex justify-between border-t border-[var(--ms-border)] pt-3">
                                <span className="font-semibold text-[var(--ms-text-strong)]">Salaire net</span>
                                <span className="text-xl font-bold text-[var(--ms-blue)]">{netSalary.toLocaleString('fr-FR')} CFA</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse gap-3 border-t border-[var(--ms-border)] pt-6 sm:flex-row sm:justify-end">
                        <Button type="button" variant="secondary" size="md" className="justify-center" onClick={() => navigate(employeePayrollPath(employeeReference))}>
                            Annuler
                        </Button>
                        <button type="submit" disabled={isSubmitting} className="ms-button ms-button-primary ms-button-md justify-center disabled:opacity-50">
                            {isSubmitting ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Traitement...</>
                            ) : (
                                <><Check className="h-4 w-4" /> {isEditMode ? 'Mettre à jour le bulletin' : 'Créer le bulletin'}</>
                            )}
                        </button>
                    </div>
                </form>
            </Surface>
        </Workspace>
    );
};

export default PaySlipForm;
