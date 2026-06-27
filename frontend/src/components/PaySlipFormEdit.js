import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, FileText, Loader2 } from 'lucide-react';
import api from '../services/api';
import { employeePayrollPath } from '../utils/paths';
import { Button, EmptyState, PageHeader, Surface, Workspace } from './business';

const fmt = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;

const FieldError = ({ children }) =>
  children ? (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ms-danger)]">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {children}
    </p>
  ) : null;

const PaySlipFormEdit = () => {
  const { id, payslipId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ month: '', year: '', deductions: 0, bonuses: 0, status: 'pending' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const employeeReference = employee || { _id: id };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setNotFound(false);
        const employeeRes = await api.get(`/employees/${id}`);
        setEmployee(employeeRes.data);
        try {
          const payslipRes = await api.get(`/employees/${id}/payroll/${payslipId}`);
          setFormData({
            month: payslipRes.data.month,
            year: payslipRes.data.year,
            deductions: payslipRes.data.deductions,
            bonuses: payslipRes.data.bonuses,
            status: payslipRes.data.status,
          });
        } catch (payslipErr) {
          if (payslipErr.response?.status === 404) setNotFound(true);
          else setErrors({ general: payslipErr.response?.data?.message || 'Erreur de chargement du bulletin' });
        }
      } catch (employeeErr) {
        if (employeeErr.response?.status === 404) setNotFound(true);
        else setErrors({ general: employeeErr.response?.data?.message || 'Erreur de chargement des données' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, payslipId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const netSalary = employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0);
      const payload = {
        ...formData,
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        baseSalary: employee.salary,
        netSalary,
      };
      await api.put(`/employees/${id}/payroll/${payslipId}`, payload);
      navigate(employeePayrollPath(employeeReference));
    } catch (err) {
      setErrors({
        general: err.response?.data?.message || 'Erreur lors de la mise à jour du bulletin',
        ...err.response?.data?.errors,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const netSalary = employee
    ? employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0)
    : 0;

  if (loading) {
    return (
      <Workspace className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ms-blue)]" />
      </Workspace>
    );
  }

  if (notFound) {
    return (
      <Workspace className="space-y-5">
        <PageHeader
          eyebrow="Paie"
          title="Ressource introuvable"
          actions={
            <Button variant="secondary" size="md" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          }
        />
        <Surface className="p-6">
          <EmptyState
            title="Bulletin introuvable"
            description={`Le bulletin "${payslipId.substring(0, 8)}" n'existe pas pour cet employé. Il a peut-être été supprimé ou vous n'avez pas les autorisations nécessaires.`}
            action={
              <button onClick={() => navigate(employeePayrollPath(employeeReference))} className="ms-button ms-button-primary ms-button-md">
                <FileText className="h-4 w-4" /> Voir les bulletins
              </button>
            }
          />
        </Surface>
      </Workspace>
    );
  }

  return (
    <Workspace className="space-y-5 max-w-3xl">
      <PageHeader
        eyebrow="Paie"
        title="Modifier le bulletin"
        description={employee ? `${employee.name}${employee.position ? ` · ${employee.position}` : ''}` : undefined}
        actions={
          <Button variant="secondary" size="md" onClick={() => navigate(employeePayrollPath(employeeReference))}>
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
        }
      />

      <Surface className="p-5 sm:p-6">
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
            <div className="flex gap-6 sm:text-right">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--ms-text-muted)]">Bulletin</div>
                <div className="font-mono text-sm text-[var(--ms-text)]">{payslipId.substring(0, 8)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--ms-text-muted)]">Salaire de base</div>
                <div className="text-lg font-semibold text-[var(--ms-text-strong)]">{fmt(employee.salary)}</div>
              </div>
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
              <select name="month" value={formData.month} onChange={handleChange} className="form-control" required disabled={isSubmitting}>
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
              <input type="number" name="year" value={formData.year} onChange={handleChange} min="2000" className="form-control" required disabled={isSubmitting} />
              <FieldError>{errors.year}</FieldError>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Déductions (CFA)</label>
              <input type="number" name="deductions" value={formData.deductions} onChange={handleChange} min="0" className="form-control" disabled={isSubmitting} />
              <FieldError>{errors.deductions}</FieldError>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Primes (CFA)</label>
              <input type="number" name="bonuses" value={formData.bonuses} onChange={handleChange} min="0" className="form-control" disabled={isSubmitting} />
              <FieldError>{errors.bonuses}</FieldError>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--ms-text)]">Statut</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'pending', label: 'En attente', active: 'bg-[var(--colorStatusWarningBackground1)] text-[var(--colorStatusWarningForeground1)]' },
                { value: 'paid', label: 'Payé', active: 'bg-[var(--colorStatusSuccessBackground1)] text-[var(--colorStatusSuccessForeground1)]' },
                { value: 'cancelled', label: 'Annulé', active: 'bg-[var(--colorStatusDangerBackground1)] text-[var(--colorStatusDangerForeground1)]' },
              ].map((option) => (
                <label key={option.value} className="cursor-pointer">
                  <input type="radio" name="status" value={option.value} checked={formData.status === option.value} onChange={handleChange} className="sr-only" disabled={isSubmitting} />
                  <span className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition-colors ${formData.status === option.value ? option.active : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-[var(--ms-surface-muted)]'}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

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

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--ms-border)] pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="md" className="justify-center" disabled={isSubmitting} onClick={() => navigate(employeePayrollPath(employeeReference))}>
              Annuler
            </Button>
            <button type="submit" disabled={isSubmitting} className="ms-button ms-button-primary ms-button-md justify-center disabled:opacity-50">
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Mise à jour...</>
              ) : (
                <><Check className="h-4 w-4" /> Mettre à jour le bulletin</>
              )}
            </button>
          </div>
        </form>
      </Surface>
    </Workspace>
  );
};

export default PaySlipFormEdit;
