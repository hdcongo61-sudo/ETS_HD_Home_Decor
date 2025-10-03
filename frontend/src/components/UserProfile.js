import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import ErrorModal from './ErrorModal';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/connexion');
        return;
      }

      const response = await fetch(`${API_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Échec de la récupération du profil');
      }

      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err.message || 'Échec du chargement du profil');
      if (err.message.includes('401') || err.message.includes('403')) {
        localStorage.removeItem('token');
        navigate('/connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line
  }, [navigate]);

  const handleRetry = () => {
    setError('');
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="relative">
          <div className="w-12 h-12 rounded-full absolute border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></div>
          <div className="w-12 h-12 rounded-full absolute border-2 border-gray-100 opacity-20"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorModal
        message={error}
        onRetry={handleRetry}
        onClose={() => setError('')}
      />
    );
  }

  const membershipDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
      })
    : '—';

  const accountCreatedAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Non disponible';

  const lastLoginDisplay = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Non disponible';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Mon Profil</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {/* En-tête avec les informations utilisateur */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-4 border-white shadow-sm">
                <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 3.58-8 8h16c0-4.42-3.58-8-8-8Z" />
                </svg>
              </div>
              {user?.isAdmin && (
                <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs font-medium py-1 px-2 rounded-full">
                  Admin
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">{user?.name}</h2>
              <p className="text-gray-600 mb-2">{user?.email}</p>
              <p className="text-sm text-gray-500 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                  <path d="M13 7h-2v6h6v-2h-4z" />
                </svg>
                Membre depuis {membershipDate}
              </p>
            </div>
          </div>

          {/* Grille des détails du profil */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <DetailCard
              title="Informations Personnelles"
              icon={
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            >
              <DetailItem label="Nom Complet" value={user?.name} />
              <DetailItem label="Email" value={user?.email} isEmail />
              <DetailItem label="Téléphone" value={user?.phone || 'Non renseigné'} isPhone={Boolean(user?.phone)} />
              <DetailItem
                label="Type de Compte"
                value={user?.isAdmin ? 'Administrateur' : 'Utilisateur Standard'}
                badgeColor={user?.isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}
              />
            </DetailCard>

            <DetailCard
              title="Statistiques du Compte"
              icon={
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            >
              <DetailItem
                label="Date d'Inscription"
                value={accountCreatedAt}
              />
              <DetailItem
                label="Dernière Connexion"
                value={lastLoginDisplay}
              />
              <DetailItem
                label="Statut"
                value="Actif"
                badgeColor="bg-green-100 text-green-800"
              />
            </DetailCard>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-gray-100">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 justify-center transition-colors"
            >
              Retour à l'Accueil
            </button>
            {/* <button
              onClick={() => navigate('/parametres')}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 justify-center transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Paramètres du Compte
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour les cartes de détails
const DetailCard = ({ title, icon, children }) => (
  <div className="border border-gray-200 rounded-xl bg-white p-5">
    <div className="flex items-center mb-4">
      <div className="mr-2">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-800">{title}</h3>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

// Composant pour les éléments de détail
const DetailItem = ({ label, value, isEmail = false, isPhone = false, badgeColor = '' }) => {
  const renderValue = () => {
    if (badgeColor) {
      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
          {value}
        </span>
      );
    }

    if (isEmail && value) {
      return (
        <a href={`mailto:${value}`} className='text-blue-600 hover:underline break-all'>
          {value}
        </a>
      );
    }

    if (isPhone && value) {
      const telValue = typeof value === 'string' ? value.replace(/[^+\d]/g, '') : value;
      return (
        <a href={`tel:${telValue}`} className='text-blue-600 hover:underline'>
          {value}
        </a>
      );
    }

    return <span className='text-gray-900'>{value}</span>;
  };

  return (
    <div>
      <dt className='text-sm font-medium text-gray-500 mb-1'>{label}</dt>
      <dd className={`${isEmail ? 'break-all' : ''}`}>
        {renderValue()}
      </dd>
    </div>
  );
};

export default UserProfile;
