import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

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
    address: '',
    city: '',
    country: '',
    postalCode: '',
    department: '',
    photo: ''
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
            address: data.address || '',
            city: data.city || '',
            country: data.country || '',
            postalCode: data.postalCode || '',
            department: data.department || '',
            photo: data.photo || ''
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
        hireDate: new Date(formData.hireDate).toISOString()
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
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
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
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/employees')}
          className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{isEditMode ? 'Modifier' : 'Nouvel'} Employé</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-red-800">Erreur</h3>
              <p className="text-red-700 text-sm mt-1">{errors.general}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt={`Photo de ${formData.name || "l'employé"}`}
                  className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-dashed border-blue-200">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15.5 21h-7A2.5 2.5 0 016 18.5v0A5.5 5.5 0 0111.5 13h1A5.5 5.5 0 0118 18.5v0A2.5 2.5 0 0115.5 21z" />
                  </svg>
                </div>
              )}
              {photoPreview && (
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  className="absolute -top-2 -right-2 bg-white border border-gray-200 text-gray-500 rounded-full p-1 shadow-sm hover:bg-gray-50"
                  aria-label="Retirer la photo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Photo de l'employé</p>
              <p className="text-xs text-gray-500 mt-1">Formats acceptés : JPG, PNG, WEBP (max 5 Mo).</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <label className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition">
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
                    className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              {errors.photo && <div className="text-red-500 text-xs mt-2">{errors.photo}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Section Informations personnelles */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="space-y-4">
                  <FormField
                    label="Nom complet"
                    name="name"
                    value={formData.name}
                    error={errors.name}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations professionnelles</h3>
                <div className="space-y-4">
                  <FormField
                    label="Poste"
                    name="position"
                    value={formData.position}
                    error={errors.position}
                    onChange={handleChange}
                    icon={
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 flex items-center gap-2 justify-center transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 justify-center disabled:opacity-50 transition-colors"
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
          </div>
        </form>
      </div>
    </div>
  );
};

const FormField = ({ label, type = 'text', name, value, error, onChange, icon, required }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
      {icon}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full p-3 border rounded-xl focus:ring-2 focus:outline-none transition-colors ${
        error 
          ? 'border-red-500 focus:ring-red-100' 
          : 'border-gray-300 focus:ring-blue-100 focus:border-blue-500'
      }`}
    />
    {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
  </div>
);

export default EmployeeForm;
