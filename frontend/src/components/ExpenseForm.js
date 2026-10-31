import React, { useState, useEffect, useContext, useId } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { ChevronDown, Save } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { Button } from './business';

const toDateTimeLocalValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const legacyCategoryLabels = {
  rent: 'Loyer',
  utilities: 'Services publics',
  salaries: 'Salaires',
  supplies: 'Fournitures',
  delivery: 'Livraison',
  other: 'Autre',
};

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

const toMonthValue = (month, year, fallbackDate) => {
  if (month && year) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  const date = fallbackDate ? new Date(fallbackDate) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const ExpenseForm = ({ initialData = null, onSubmit, onCancel, submitting = false, formId, hideSubmit = false }) => {
  const { t } = useTranslation();
  const { auth } = useContext(AuthContext);
  const detailsId = useId();
  const manualExpenseDateEnabled = Boolean(auth?.user?.isAdmin) && Boolean(auth?.user?.adminPreferences?.manualExpenseDateEnabled);
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'cash',
    employee: '',
    salaryPeriod: toMonthValue()
  });

  const [errors, setErrors] = useState({});
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initialData || manualExpenseDateEnabled));

  useEffect(() => {
    const fetchExpenseCategories = async () => {
      try {
        const { data } = await api.get('/lookups/expense-categories');
        setExpenseCategories(Array.isArray(data) ? data : []);
      } catch {
        setExpenseCategories([]);
      }
    };

    fetchExpenseCategories();
  }, []);

  useEffect(() => {
    // La liste des employés est réservée aux admins et aux membres avec la
    // permission `use_expenses` : on évite tout appel voué à un 401 (qui
    // déconnecterait l'utilisateur via l'intercepteur global).
    const canSeeEmployees =
      Boolean(auth?.user?.isAdmin) ||
      (Array.isArray(auth?.user?.permissions) && auth.user.permissions.includes('use_expenses'));
    if (!canSeeEmployees) {
      setEmployees([]);
      return;
    }

    const fetchEmployees = async () => {
      try {
        const { data } = await api.get('/employees');
        setEmployees(Array.isArray(data) ? data : []);
      } catch {
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, [auth]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: toDateTimeLocalValue(initialData.date),
        description: initialData.description,
        amount: initialData.amount,
        category: initialData.category,
        paymentMethod: initialData.paymentMethod,
        employee: initialData.employee?._id || initialData.employee || '',
        salaryPeriod: toMonthValue(initialData.salaryMonth, initialData.salaryYear, initialData.date)
      });
    } else {
      setFormData({
        date: toDateTimeLocalValue(new Date()),
        description: '',
        amount: '',
        category: '',
        paymentMethod: 'cash',
        employee: '',
        salaryPeriod: toMonthValue()
      });
    }
  }, [initialData]);

  useEffect(() => {
    setDetailsOpen(Boolean(initialData || manualExpenseDateEnabled));
  }, [initialData, manualExpenseDateEnabled]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || '' : value,
      ...(name === 'category' && !isSalaryCategory(value) ? { employee: '' } : {})
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length === 0) {
      const [salaryYear, salaryMonth] = String(formData.salaryPeriod || '').split('-').map(Number);
      const sanitizedData = {
        ...formData,
        date: manualExpenseDateEnabled ? formData.date : undefined,
        description: DOMPurify.sanitize(formData.description),
        employee: isSalaryCategory(formData.category) ? formData.employee : undefined,
        salaryMonth: isSalaryCategory(formData.category) ? salaryMonth : undefined,
        salaryYear: isSalaryCategory(formData.category) ? salaryYear : undefined
      };
      delete sanitizedData.salaryPeriod;
      const submitted = await onSubmit(sanitizedData);
      if (submitted === false) return;
      if (!initialData) {
        setFormData({
          description: '',
          amount: '',
          category: '',
          date: toDateTimeLocalValue(new Date()),
          paymentMethod: 'cash',
          employee: '',
          salaryPeriod: toMonthValue()
        });
        setErrors({});
        setDetailsOpen(Boolean(manualExpenseDateEnabled));
      }
    } else {
      setErrors(validationErrors);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (manualExpenseDateEnabled && !formData.date) errors.date = 'La date est requise';
    if (!formData.description.trim()) errors.description = 'La description est requise';
    if (!formData.amount || formData.amount <= 0) errors.amount = 'Montant invalide';
    if (!formData.category) errors.category = 'Catégorie requise';
    if (isSalaryCategory(formData.category)) {
      if (!formData.employee) errors.employee = 'Sélectionnez un employé';
      if (!formData.salaryPeriod) errors.salaryPeriod = 'Sélectionnez le mois concerné';
    }
    return errors;
  };

  const categoryOptions = expenseCategories.map((category) => category.name).filter(Boolean);
  const selectedCategory = formData.category;
  const salaryCategorySelected = isSalaryCategory(selectedCategory);
  const selectedEmployee = employees.find((employee) => employee._id === formData.employee);
  if (selectedCategory && !categoryOptions.includes(selectedCategory)) {
    categoryOptions.push(selectedCategory);
  }
  const controlClass = (error) => `form-control ${error ? 'form-control-error' : ''}`;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {t('expenses.amount', 'Montant (CFA)')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              className={`${controlClass(errors.amount)} pr-12`}
              aria-invalid={Boolean(errors.amount)}
              placeholder="0"
              required
            />
            <span className="absolute right-3 top-2.5 text-gray-400">CFA</span>
          </div>
          {errors.amount && <p className="form-error">{errors.amount}</p>}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            {t('expenses.category', 'Catégorie')} <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={controlClass(errors.category)}
            aria-invalid={Boolean(errors.category)}
            required
          >
            <option value="">{t('expenses.selectCategory', 'Sélectionner une catégorie')}</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {legacyCategoryLabels[category] || category}
              </option>
            ))}
          </select>
          {categoryOptions.length === 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Aucune catégorie. <Link to="/settings" className="font-medium hover:underline" style={{ color: 'var(--colorBrandForeground1)' }}>Créez-en dans Paramètres → Catégories dépenses</Link>
            </p>
          )}
          {errors.category && <p className="form-error">{errors.category}</p>}
        </div>

        {manualExpenseDateEnabled && (
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              {t('expenses.realDate', 'Date réelle de dépense')} <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={controlClass(errors.date)}
              aria-invalid={Boolean(errors.date)}
              required
            />
            <p className="form-help">
              Utilisez la date et l'heure réelles si la dépense a été notée plus tôt sur papier.
            </p>
            {errors.date && <p className="form-error">{errors.date}</p>}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {t('expenses.whatFor', 'À quoi correspond cette dépense ?')} <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className={controlClass(errors.description)}
          aria-invalid={Boolean(errors.description)}
          rows="2"
          placeholder="Ex. achat de fournitures, transport..."
          required
        />
        {errors.description && <p className="form-error">{errors.description}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <button
          type="button"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        >
          <span>{t('expenses.options', 'Options complémentaires')}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {detailsOpen && (
          <div id={detailsId} className="border-t border-gray-200 p-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.paymentMethod', 'Mode de paiement')}
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="form-control"
              >
                <option value="cash">{t('expenses.cash', 'Espèces')}</option>
                <option value="paymentMethod">{t('expenses.mobileMoney', 'Mobile Money')}</option>
                <option value="check">{t('expenses.check', 'Chèque')}</option>
                <option value="bank_transfer">{t('expenses.bankTransfer', 'Virement bancaire')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {salaryCategorySelected && (
        <div className="form-panel p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('expenses.salaryPayment', 'Paiement de salaire')}</h3>
            <p className="form-help mt-1">
              Le montant sera déduit du salaire mensuel restant de l'employé pour le mois choisi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.employee', 'Employé')} <span className="text-red-500">*</span>
              </label>
              <select
                name="employee"
                value={formData.employee}
                onChange={handleChange}
                className={controlClass(errors.employee)}
                aria-invalid={Boolean(errors.employee)}
                required
              >
                <option value="">{t('expenses.selectEmployee', 'Sélectionner un employé')}</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name} {employee.position ? `- ${employee.position}` : ''}
                  </option>
                ))}
              </select>
              {employees.length === 0 && (
                <p className="text-xs text-amber-600">Aucun employé disponible.</p>
              )}
              {errors.employee && <p className="form-error">{errors.employee}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {t('expenses.salaryMonth', 'Mois du salaire')} <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                name="salaryPeriod"
                value={formData.salaryPeriod}
                onChange={handleChange}
                className={controlClass(errors.salaryPeriod)}
                aria-invalid={Boolean(errors.salaryPeriod)}
                required
              />
              {errors.salaryPeriod && <p className="form-error">{errors.salaryPeriod}</p>}
            </div>
          </div>

          {selectedEmployee && (
            <div className="rounded-2xl bg-white/85 p-3 text-sm text-gray-700 border border-gray-200/80">
              Salaire mensuel :
              <span className="ml-1 font-semibold text-gray-900">
                {Number(selectedEmployee.salary || 0).toLocaleString('fr-FR')} CFA
              </span>
            </div>
          )}
        </div>
      )}

      {!hideSubmit && (
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--ms-border)] pt-4 sm:flex-row sm:justify-end">
          {initialData && (
            <Button
              type="button"
              onClick={() => (typeof onCancel === 'function' ? onCancel() : onSubmit(null))}
            >
              Annuler
            </Button>
          )}
          <Button
            type="submit"
            disabled={submitting}
            variant="primary"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                Enregistrement...
              </span>
            ) : initialData ? (
              <>
                <Save className="h-4 w-4" />
                Mettre à jour
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Ajouter dépense
              </>
            )}
          </Button>
        </div>
      )}
    </form>
  );
};

ExpenseForm.propTypes = {
  initialData: PropTypes.shape({
    _id: PropTypes.string,
    date: PropTypes.string,
    description: PropTypes.string,
    amount: PropTypes.number,
    category: PropTypes.string,
    paymentMethod: PropTypes.string,
    employee: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        _id: PropTypes.string,
        name: PropTypes.string,
        position: PropTypes.string,
        salary: PropTypes.number
      })
    ]),
    salaryMonth: PropTypes.number,
    salaryYear: PropTypes.number
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  submitting: PropTypes.bool,
  formId: PropTypes.string,
  hideSubmit: PropTypes.bool
};

export default ExpenseForm;
