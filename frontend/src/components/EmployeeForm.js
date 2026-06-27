import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';
import AppLoader from './AppLoader';
import { FormActionsSticky } from './FormLayout';
import { Button, PageHeader, Workspace } from './business';

const EmployeeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    salary: '',
    hireDate: new Date().toISOString().split('T')[0],
    department: '',
    photo: '',
    isActive: true,
    leftDate: '',
    inactiveReason: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [isEditMode, setIsEditMode] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    if (id) {
      const fetchEmployee = async () => {
        try {
          setLoading(true);
          const { data } = await api.get(`/employees/${id}`);

          // Format date for input field
          const hireDate = new Date(data.hireDate);
          const formattedDate = hireDate.toISOString().split('T')[0];

          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            position: data.position || '',
            salary: data.salary || '',
            hireDate: formattedDate,
            department: data.department || '',
            photo: data.photo || '',
            isActive: data.isActive !== false,
            leftDate: data.leftDate ? new Date(data.leftDate).toISOString().split('T')[0] : '',
            inactiveReason: data.inactiveReason || ''
          });
          setPhotoPreview(data.photo || '');
          setIsEditMode(true);
          setErrors({});
        } catch (err) {
          setErrors({ fetch: err.response?.data?.message || 'Failed to load employee' });
        } finally {
          setLoading(false);
        }
      };
      fetchEmployee();
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{8,15}$/;

    if (!formData.name.trim()) newErrors.name = 'Le nom est requis';
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Le téléphone est requis';
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Numéro de téléphone invalide';
    }
    if (!formData.position.trim()) newErrors.position = 'Le poste est requis';
    if (!formData.salary) {
      newErrors.salary = 'Le salaire est requis';
    } else if (isNaN(formData.salary) || formData.salary <= 0) {
      newErrors.salary = 'Salaire invalide';
    }
    if (!formData.hireDate) newErrors.hireDate = 'La date d\'embauche est requise';
    if (!formData.isActive && formData.leftDate) {
      const hireDate = new Date(formData.hireDate);
      const leftDate = new Date(formData.leftDate);
      if (!Number.isNaN(hireDate.getTime()) && !Number.isNaN(leftDate.getTime()) && leftDate < hireDate) {
        newErrors.leftDate = 'La date de départ doit être après la date d’embauche';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const dataToSend = {
        ...formData,
        salary: parseFloat(formData.salary),
        hireDate: new Date(formData.hireDate).toISOString(),
        leftDate: formData.isActive || !formData.leftDate ? '' : new Date(formData.leftDate).toISOString(),
        inactiveReason: formData.isActive ? '' : formData.inactiveReason
      };

      let payload = dataToSend;
      let config = { headers: { 'Content-Type': 'application/json' } };

      if (photoFile) {
        payload = new FormData();
        Object.entries(dataToSend).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            payload.append(key, value);
          }
        });
        payload.append('photoFile', photoFile);
        config = {};
      }

      if (isEditMode) {
        await api.put(`/employees/${id}`, payload, config);
      } else {
        await api.post('/employees', payload, config);
      }
      navigate('/employees');
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      setErrors({
        ...errors,
        ...apiErrors,
        general: err.response?.data?.message || 'Erreur de sauvegarde'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'isActive' && checked ? { leftDate: '', inactiveReason: '' } : {})
    });
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
    setFormData((prev) => ({ ...prev, photo: '' }));

    if (errors.photo) {
      setErrors({ ...errors, photo: '' });
    }
  };

  const handlePhotoRemove = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview('');
    setFormData((prev) => ({ ...prev, photo: '' }));
  };

  if (loading) return (
    <Workspace className="flex items-center justify-center min-h-[60vh]">
      <AppLoader fullScreen={false} text="Chargement…" />
    </Workspace>
  );

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Ressources humaines"
        title={`${isEditMode ? 'Modifier' : 'Nouvel'} employé`}
        description="Informations RH, statut de présence et données de paie."
        actions={
          <Button variant="secondary" size="md" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" /> Employés
          </Button>
        }
      />

      <div className="form-shell p-5 sm:p-8">
        {errors.general && (
          <div className="mb-6 p-4 bg-[var(--ms-danger)]/10 rounded-md flex items-start gap-3">
            <div className="bg-[var(--ms-danger)]/15 p-2 rounded-full">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-red-800">Erreur</h3>
              <p className="text-[var(--ms-danger)] text-sm mt-1">{errors.general}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="form-panel flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={formData.name || "Employé"}
                  className="w-20 h-20 rounded-lg object-cover border border-[var(--ms-border)] shadow-[var(--ms-shadow-sm)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] flex items-center justify-center border border-dashed border-[var(--ms-border-strong)]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15.5 21h-7A2.5 2.5 0 016 18.5v0A5.5 5.5 0 0111.5 13h1A5.5 5.5 0 0118 18.5v0A2.5 2.5 0 0115.5 21z" />
                  </svg>
                </div>
              )}
              {photoPreview && (
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  className="absolute -top-2 -right-2 bg-[var(--ms-white)] border border-[var(--ms-border)] text-[var(--ms-text-muted)] rounded-full p-1 shadow-[var(--ms-shadow-sm)] hover:bg-[var(--ms-bg-subtle)]"
                  aria-label="Retirer la photo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--ms-text-strong)]">Photo de l'employé</p>
              <p className="text-xs text-[var(--ms-text-muted)] mt-1">Formats acceptés : JPG, PNG, WEBP (max 5 Mo).</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <label className="form-button-secondary inline-flex cursor-pointer items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V8a2 2 0 00-2-2h-3l-1.447-1.894A2 2 0 0011.382 4H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium">Choisir une photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    className="form-button-secondary text-sm"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              {errors.photo && <div className="text-red-500 text-xs mt-2">{errors.photo}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
            {/* Section Informations personnelles */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ms-text-strong)] mb-4">Informations personnelles</h3>
                <div className="space-y-4">
                  <FormField
                    label="Nom complet"
                    name="name"
                    value={formData.name}
                    error={errors.name}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                    required
                  />

                  <FormField
                    label="Email"
                    type="email"
                    name="email"
                    value={formData.email}
                    error={errors.email}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    }
                    required
                  />

                  <FormField
                    label="Téléphone"
                    type="text"
                    name="phone"
                    value={formData.phone}
                    error={errors.phone}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    }
                    required
                  />

                  <FormField
                    label="Date d'embauche"
                    type="date"
                    name="hireDate"
                    value={formData.hireDate}
                    error={errors.hireDate}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section Emploi */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ms-text-strong)] mb-4">Informations professionnelles</h3>
                <div className="space-y-4">
                  <FormField
                    label="Poste"
                    name="position"
                    value={formData.position}
                    error={errors.position}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    }
                    required
                  />

                  <FormField
                    label="Salaire (CFA)"
                    type="number"
                    name="salary"
                    value={formData.salary}
                    error={errors.salary}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    required
                  />

                  <FormField
                    label="Département"
                    name="department"
                    value={formData.department}
                    error={errors.department}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <section className="form-panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">Statut dans la boutique</h3>
                <p className="mt-1 text-sm text-[var(--ms-text-muted)]">
                  Désactivez ce statut quand l’employé ne travaille plus dans votre boutique.
                </p>
              </div>
              <label className="inline-flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-2.5 shadow-[var(--ms-shadow-sm)]">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="form-check rounded"
                />
                <span className="text-sm font-semibold text-[var(--ms-text-strong)]">
                  Travaille encore ici
                </span>
              </label>
            </div>

            {!formData.isActive && (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  label="Date de départ"
                  type="date"
                  name="leftDate"
                  value={formData.leftDate}
                  error={errors.leftDate}
                  onChange={handleChange}
                  icon={
                    <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
                <FormField
                  label="Raison / note"
                  name="inactiveReason"
                  value={formData.inactiveReason}
                  error={errors.inactiveReason}
                  onChange={handleChange}
                  placeholder="Ex. Fin de contrat, départ volontaire..."
                  icon={
                    <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h8m-8 4h6M5 5h14v14H5z" />
                    </svg>
                  }
                />
              </div>
            )}
          </section>

          <FormActionsSticky>
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="form-button-secondary flex flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="form-button-primary flex flex-1 items-center justify-center gap-2 sm:flex-none"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isEditMode ? 'Mettre à jour' : 'Créer'}
            </button>
          </FormActionsSticky>
        </form>
      </div>
    </Workspace>
  );
};

const FormField = ({ label, type = 'text', name, value, error, onChange, icon, required, placeholder = '' }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-[var(--ms-text)] flex items-center gap-2">
      {icon}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputMode={type === 'number' ? 'decimal' : type === 'tel' ? 'tel' : undefined}
      className={`form-control ${
        error
          ? 'form-control-error'
          : ''
      }`}
      aria-invalid={Boolean(error)}
    />
    {error && <div className="form-error mt-1 text-xs">{error}</div>}
  </div>
);

export default EmployeeForm;
