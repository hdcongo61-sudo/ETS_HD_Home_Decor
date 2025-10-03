import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const toLocalDateTimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
};

const toIsoStringOrNull = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const UserForm = ({ user, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        isAdmin: false,
        accessControlEnabled: false,
        accessStart: '',
        accessEnd: ''
    });

    // Pre-fill form in edit mode
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                password: '',
                confirmPassword: '',
                isAdmin: user.isAdmin,
                accessControlEnabled: Boolean(user.accessControlEnabled),
                accessStart: toLocalDateTimeInput(user.accessStart),
                accessEnd: toLocalDateTimeInput(user.accessEnd)
            });
        } else {
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                isAdmin: false,
                accessControlEnabled: false,
                accessStart: '',
                accessEnd: ''
            });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            if (type === 'checkbox') {
                const nextValue = checked;
                if (name === 'accessControlEnabled' && !nextValue) {
                    return {
                        ...prev,
                        accessControlEnabled: false,
                        accessStart: '',
                        accessEnd: ''
                    };
                }
                return {
                    ...prev,
                    [name]: nextValue
                };
            }

            return {
                ...prev,
                [name]: value
            };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (formData.password && formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        const trimmedPhone = (formData.phone || '').trim();
        const phoneRegex = /^[0-9+()\s.-]{6,20}$/;
        if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
            toast.error('Veuillez entrer un numéro de téléphone valide');
            return;
        }

        if (formData.accessControlEnabled) {
            if (!formData.accessStart || !formData.accessEnd) {
                toast.error('Définissez les dates de début et de fin pour la restriction de connexion');
                return;
            }

            const startDate = new Date(formData.accessStart);
            const endDate = new Date(formData.accessEnd);

            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                toast.error('Les dates de restriction sont invalides');
                return;
            }

            if (startDate > endDate) {
                toast.error('La date de fin doit être postérieure à la date de début');
                return;
            }
        }

        // Prepare data to send
        const userData = {
            name: formData.name,
            email: formData.email,
            phone: trimmedPhone,
            isAdmin: formData.isAdmin,
            accessControlEnabled: formData.accessControlEnabled,
            accessStart: formData.accessControlEnabled ? toIsoStringOrNull(formData.accessStart) : null,
            accessEnd: formData.accessControlEnabled ? toIsoStringOrNull(formData.accessEnd) : null
        };

        // Don't send password if empty (in edit mode)
        if (formData.password) {
            userData.password = formData.password;
        }

        onSubmit(userData);
    };

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {user ? 'Edit User' : 'Create New User'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {user ? 'Update user information' : 'Add a new user to the system'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            placeholder="Enter full name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            placeholder="Enter email address"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Téléphone</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            placeholder="Ex: +242 06 000 0000"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            {user ? 'New Password' : 'Password'}
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            minLength="6"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            placeholder={user ? 'Enter new password (optional)' : 'Enter password'}
                        />
                    </div>

                    {formData.password && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                placeholder="Confirm your password"
                            />
                        </div>
                    )}

                    <div className="flex items-center p-3 bg-gray-50 rounded-xl">
                        <input
                            type="checkbox"
                            id="isAdmin"
                            name="isAdmin"
                            checked={formData.isAdmin}
                            onChange={handleChange}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isAdmin" className="ml-3 text-sm text-gray-700">
                            Administrator Access
                        </label>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">Fenêtre de connexion</h3>
                                <p className="text-xs text-gray-500">Limitez la période pendant laquelle cet utilisateur peut se connecter.</p>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    name="accessControlEnabled"
                                    checked={formData.accessControlEnabled}
                                    onChange={handleChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                Activer
                            </label>
                        </div>

                        {formData.accessControlEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Début autorisé</label>
                                    <input
                                        type="datetime-local"
                                        name="accessStart"
                                        value={formData.accessStart}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Fin autorisée</label>
                                    <input
                                        type="datetime-local"
                                        name="accessEnd"
                                        value={formData.accessEnd}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 justify-center transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 justify-center transition-colors shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            {user ? 'Update User' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserForm;
