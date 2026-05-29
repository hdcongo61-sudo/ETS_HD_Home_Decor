import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { FormActionsSticky } from './FormLayout';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

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

const ExpenseForm = ({ initialData = null, onSubmit, onCancel, submitting = false }) => {
  const { auth } = useContext(AuthContext);
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
    const fetchEmployees = async () => {
      try {
        const { data } = await api.get('/employees');
        setEmployees(Array.isArray(data) ? data : []);
      } catch {
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, []);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || '' : value,
      ...(name === 'category' && !isSalaryCategory(value) ? { employee: '' } : {})
    }));
  };

  const handleSubmit = (e) => {
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
      onSubmit(sanitizedData);
      if (!initialData) { // Seulement si c'est une nouvelle dépense
        setFormData({
          description: '',
          amount: '',
          category: '',
          date: toDateTimeLocalValue(new Date()),
          paymentMethod: 'cash',
          employee: '',
          salaryPeriod: toMonthValue()
        });
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {manualExpenseDateEnabled && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Date réelle de dépense <span className="text-red-500">*</span>
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

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Montant (CFA) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              className={`${controlClass(errors.amount)} pr-12`}
              aria-invalid={Boolean(errors.amount)}
              placeholder="0.00"
              required
            />
            <span className="absolute right-3 top-2.5 text-gray-400">CFA</span>
          </div>
          {errors.amount && <p className="form-error">{errors.amount}</p>}
        </div>
      </div>

      {/* Description Field */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className={controlClass(errors.description)}
          aria-invalid={Boolean(errors.description)}
          rows="3"
          placeholder="Détails de la dépense..."
          required
        />
        {errors.description && <p className="form-error">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Field */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Catégorie <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={controlClass(errors.category)}
            aria-invalid={Boolean(errors.category)}
            required
          >
            <option value="">Sélectionner une catégorie</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {legacyCategoryLabels[category] || category}
              </option>
            ))}
          </select>
          {categoryOptions.length === 0 && (
            <p className="text-xs text-amber-600">
              Ajoutez les catégories dans Paramètres &gt; Catégories dépenses.
            </p>
          )}
          {errors.category && <p className="form-error">{errors.category}</p>}
        </div>

        {/* Payment Method Field */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Méthode de paiement <span className="text-red-500">*</span>
          </label>
          <select
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleChange}
            className="form-control"
            required
          >
            <option value="cash">Espèces</option>
            <option value="paymentMethod">Mobile Money</option>
            <option value="check">Chèque</option>
            <option value="bank_transfer">Virement bancaire</option>
          </select>
        </div>
      </div>

      {salaryCategorySelected && (
        <div className="form-panel p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Paiement de salaire</h3>
            <p className="form-help mt-1">
              Le montant sera déduit du salaire mensuel restant de l'employé pour le mois choisi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Employé <span className="text-red-500">*</span>
              </label>
              <select
                name="employee"
                value={formData.employee}
                onChange={handleChange}
                className={controlClass(errors.employee)}
                aria-invalid={Boolean(errors.employee)}
                required
              >
                <option value="">Sélectionner un employé</option>
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
                Mois du salaire <span className="text-red-500">*</span>
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

      <FormActionsSticky>
        {initialData && (
          <button
            type="button"
            onClick={() => (typeof onCancel === 'function' ? onCancel() : onSubmit(null))}
            className="form-button-secondary"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="form-button-primary"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Enregistrement...
            </span>
          ) : initialData ? (
            'Mettre à jour'
          ) : (
            'Ajouter Dépense'
          )}
        </button>
      </FormActionsSticky>
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
  submitting: PropTypes.bool
};

export default ExpenseForm;
