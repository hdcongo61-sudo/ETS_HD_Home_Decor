import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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

const inputClass = 'form-control text-base';

const PERMISSION_OPTIONS = [
    {
        value: 'view_sensitive_financials',
        label: 'Voir coûts, bénéfices et marges',
        description: 'Autorise les données financières sensibles dans produits et ventes.'
    },
    {
        value: 'view_supplier_contacts',
        label: 'Voir contacts fournisseurs',
        description: 'Autorise le téléphone fournisseur dans les fiches produit.'
    },
    {
        value: 'approve_admin_requests',
        label: 'Valider les demandes admin',
        description: 'Autorise le traitement des demandes sans donner tous les accès administrateur.'
    }
];

const UserForm = ({ user, onSubmit, onCancel, embedded = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        isAdmin: false,
        isActive: true,
        accessControlEnabled: false,
        accessStart: '',
        accessEnd: '',
        photo: '',
        permissions: []
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');

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
                isActive: user.isActive !== false,
                accessControlEnabled: Boolean(user.accessControlEnabled),
                accessStart: toLocalDateTimeInput(user.accessStart),
                accessEnd: toLocalDateTimeInput(user.accessEnd),
                photo: user.photo || '',
                permissions: Array.isArray(user.permissions) ? user.permissions : []
            });
            setPhotoPreview(user.photo || '');
        } else {
            setFormData({
                name: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                isAdmin: false,
                isActive: true,
                accessControlEnabled: false,
                accessStart: '',
                accessEnd: '',
                photo: '',
                permissions: []
            });
            setPhotoPreview('');
        }
    }, [user]);

    useEffect(() => {
        return () => {
            if (photoPreview && photoPreview.startsWith('blob:')) {
                URL.revokeObjectURL(photoPreview);
            }
        };
    }, [photoPreview]);

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

    const handlePermissionChange = (permission, checked) => {
        setFormData(prev => {
            const current = Array.isArray(prev.permissions) ? prev.permissions : [];
            return {
                ...prev,
                permissions: checked
                    ? [...new Set([...current, permission])]
                    : current.filter((item) => item !== permission)
            };
        });
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
        setFormData(prev => ({ ...prev, photo: '' }));
    };

    const handlePhotoRemove = () => {
        if (photoPreview && photoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhotoFile(null);
        setPhotoPreview('');
        setFormData(prev => ({ ...prev, photo: '' }));
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
            isActive: formData.isActive,
            accessControlEnabled: formData.accessControlEnabled,
            accessStart: formData.accessControlEnabled ? toIsoStringOrNull(formData.accessStart) : null,
            accessEnd: formData.accessControlEnabled ? toIsoStringOrNull(formData.accessEnd) : null,
            photo: formData.photo || '',
            permissions: formData.isAdmin ? [] : formData.permissions
        };

        // Don't send password if empty (in edit mode)
        if (formData.password) {
            userData.password = formData.password;
        }

        let payload = userData;
        let config;

        if (photoFile) {
            payload = new FormData();
            Object.entries(userData).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    payload.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
                }
            });
            payload.append('photoFile', photoFile);
            config = {}; // Let browser set multipart headers
        }

        onSubmit({ payload, config });
    };

    const formContent = (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo */}
            <div className="form-panel flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
                <div className="relative shrink-0">
                    {photoPreview ? (
                        <img src={photoPreview} alt={formData.name || 'Utilisateur'} className="w-16 h-16 rounded-md object-cover border border-[var(--ms-border)] shadow-[var(--ms-shadow-sm)]" />
                    ) : (
                        <div className="w-16 h-16 rounded-md bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] flex items-center justify-center border border-dashed border-[var(--ms-border-strong)]">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                    )}
                    {photoPreview && (
                        <button type="button" onClick={handlePhotoRemove} className="absolute -top-2 -right-2 bg-[var(--ms-white)] border border-[var(--ms-border)] text-[var(--ms-text-muted)] rounded-full p-1.5 shadow-[var(--ms-shadow-sm)] hover:bg-[var(--ms-bg-subtle)] min-h-[32px] min-w-[32px] flex items-center justify-center" aria-label="Retirer la photo">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ms-text-strong)]">Photo</p>
                    <p className="text-xs text-[var(--ms-text-muted)] mt-0.5">JPG, PNG ou WEBP (max 5 Mo)</p>
                    <label className="form-button-secondary mt-2 inline-flex cursor-pointer items-center text-sm">
                        <svg className="w-4 h-4 mr-2 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                        Choisir une photo
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </label>
                </div>
            </div>

            <div className="space-y-2">
                <label className="form-label">Nom complet</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="Ex. Jean Dupont" />
            </div>
            <div className="space-y-2">
                <label className="form-label">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required className={inputClass} placeholder="exemple@etshd.com" />
            </div>
            <div className="space-y-2">
                <label className="form-label">Téléphone</label>
                <input type="tel" inputMode="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="+242 06 000 0000" />
            </div>
            <div className="space-y-2">
                <label className="form-label">{user ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'}</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} minLength={6} className={inputClass} placeholder={user ? 'Laisser vide pour ne pas changer' : 'Minimum 6 caractères'} />
            </div>
            {formData.password && (
                <div className="space-y-2">
                    <label className="form-label">Confirmer le mot de passe</label>
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={inputClass} placeholder="Confirmer le mot de passe" />
                </div>
            )}

            <div className="form-panel flex items-center min-h-[48px] p-3">
                <input type="checkbox" id="isAdmin" name="isAdmin" checked={formData.isAdmin} onChange={handleChange} className="form-check rounded" />
                <label htmlFor="isAdmin" className="ml-3 text-sm font-medium text-[var(--ms-text)] cursor-pointer">Accès administrateur</label>
            </div>

            {user && (
                <div className="form-panel flex items-center min-h-[48px] p-3">
                    <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} className="form-check rounded" />
                    <label htmlFor="isActive" className="ml-3 text-sm font-medium text-[var(--ms-text)] cursor-pointer">
                        Compte actif
                        <span className="block text-xs text-[var(--ms-text-muted)] font-normal mt-0.5">
                            {formData.isActive ? 'L\'utilisateur peut se connecter normalement.' : 'L\'utilisateur est bloqué et sera déconnecté de toutes ses sessions.'}
                        </span>
                    </label>
                </div>
            )}

            {!formData.isAdmin && (
                <div className="form-panel p-4 space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ms-text-strong)]">Permissions utilisateur</h3>
                        <p className="text-xs text-[var(--ms-text-muted)] mt-0.5">
                            Donnez uniquement les accès sensibles nécessaires au travail quotidien.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {PERMISSION_OPTIONS.map((permission) => (
                            <label key={permission.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3 transition-colors hover:bg-[var(--ms-bg-subtle)]">
                                <input
                                    type="checkbox"
                                    checked={(formData.permissions || []).includes(permission.value)}
                                    onChange={(event) => handlePermissionChange(permission.value, event.target.checked)}
                                    className="form-check mt-1 rounded"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-[var(--ms-text-strong)]">{permission.label}</span>
                                    <span className="block text-xs text-[var(--ms-text-muted)] mt-0.5">{permission.description}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="form-panel p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--ms-text-strong)]">Fenêtre de connexion</h3>
                        <p className="text-xs text-[var(--ms-text-muted)] mt-0.5">Restreindre les plages horaires de connexion.</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--ms-text)] cursor-pointer min-h-[44px]">
                        <input type="checkbox" name="accessControlEnabled" checked={formData.accessControlEnabled} onChange={handleChange} className="form-check rounded" />
                        Activer
                    </label>
                </div>
                {formData.accessControlEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="form-label text-xs">Début autorisé</label>
                            <input type="datetime-local" name="accessStart" value={formData.accessStart} onChange={handleChange} className={`${inputClass} text-sm`} />
                        </div>
                        <div className="space-y-2">
                            <label className="form-label text-xs">Fin autorisée</label>
                            <input type="datetime-local" name="accessEnd" value={formData.accessEnd} onChange={handleChange} className={`${inputClass} text-sm`} />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4 border-t border-[var(--ms-border)]">
                <button type="button" onClick={onCancel} className="form-button-secondary w-full sm:w-auto">
                    Annuler
                </button>
                <button type="submit" className="form-button-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    {user ? 'Enregistrer les modifications' : 'Créer l\'utilisateur'}
                </button>
            </div>
        </form>
    );

    if (embedded) {
        return formContent;
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="form-shell p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-[var(--ms-text-strong)]">{user ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h2>
                    <p className="text-sm text-[var(--ms-text-muted)] mt-1">{user ? "Mettez à jour les informations du compte." : "Créez un nouveau compte utilisateur."}</p>
                </div>
                {formContent}
            </div>
        </div>
    );
};

export default UserForm;
