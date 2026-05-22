import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { FormActionsSticky } from './FormLayout';
import AuthContext from '../context/AuthContext';

const toDateTimeLocalValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part) => String(part).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const ExpenseForm = ({ initialData = null, onSubmit, onCancel, submitting = false }) => {
  const { auth } = useContext(AuthContext);
  const manualExpenseDateEnabled = Boolean(auth?.user?.isAdmin) && Boolean(auth?.user?.adminPreferences?.manualExpenseDateEnabled);
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'cash'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: toDateTimeLocalValue(initialData.date),
        description: initialData.description,
        amount: initialData.amount,
        category: initialData.category,
        paymentMethod: initialData.paymentMethod
      });
    } else {
      setFormData({
        date: toDateTimeLocalValue(new Date()),
        description: '',
        amount: '',
        category: '',
        paymentMethod: 'cash'
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || '' : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length === 0) {
      const sanitizedData = {
        ...formData,
        date: manualExpenseDateEnabled ? formData.date : undefined,
        description: DOMPurify.sanitize(formData.description)
      };
      onSubmit(sanitizedData);
      if (!initialData) { // Seulement si c'est une nouvelle dépense
        setFormData({
          description: '',
          amount: '',
          category: '',
          date: toDateTimeLocalValue(new Date()),
          paymentMethod: 'cash'
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
    return errors;
  };

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
              className={`w-full p-2 border rounded-lg ${errors.date ? 'border-red-500' : 'border-gray-200'
                } focus:ring-2 focus:ring-blue-500`}
              required
            />
            <p className="text-xs text-gray-500">
              Utilisez la date et l'heure réelles si la dépense a été notée plus tôt sur papier.
            </p>
            {errors.date && <p className="text-red-500 text-sm">{errors.date}</p>}
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
              className={`w-full p-2 border rounded-lg pr-8 ${errors.amount ? 'border-red-500' : 'border-gray-200'
                } focus:ring-2 focus:ring-blue-500`}
              placeholder="0.00"
              required
            />
            <span className="absolute right-3 top-2.5 text-gray-400">CFA</span>
          </div>
          {errors.amount && <p className="text-red-500 text-sm">{errors.amount}</p>}
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
          className={`w-full p-2 border rounded-lg ${errors.description ? 'border-red-500' : 'border-gray-200'
            } focus:ring-2 focus:ring-blue-500`}
          rows="3"
          placeholder="Détails de la dépense..."
          required
        />
        {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
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
            className={`w-full p-2 border rounded-lg ${errors.category ? 'border-red-500' : 'border-gray-200'
              } focus:ring-2 focus:ring-blue-500`}
            required
          >
            <option value="">Sélectionner une catégorie</option>
            <option value="rent">Loyer</option>
            <option value="utilities">Services publics</option>
            <option value="salaries">Salaires</option>
            <option value="supplies">Fournitures</option>
            <option value="other">Autre</option>
          </select>
          {errors.category && <p className="text-red-500 text-sm">{errors.category}</p>}
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
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="cash">Espèces</option>
            <option value="paymentMethod">Mobile Money</option>
            <option value="check">Chèque</option>
            <option value="bank_transfer">Virement bancaire</option>
          </select>
        </div>
      </div>

      <FormActionsSticky>
        {initialData && (
          <button
            type="button"
            onClick={() => (typeof onCancel === 'function' ? onCancel() : onSubmit(null))}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 text-white rounded-lg transition-colors ${submitting ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'}`}
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
    paymentMethod: PropTypes.string
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  submitting: PropTypes.bool
};

export default ExpenseForm;
