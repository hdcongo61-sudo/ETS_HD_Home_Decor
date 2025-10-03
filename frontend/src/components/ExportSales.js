import React, { useState, useEffect } from 'react';
import api from '../services/api';
import useAutoClearMessage from '../hooks/useAutoClearMessage';

const ExportSales = () => {
  const [period, setPeriod] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentWeekDates, setCurrentWeekDates] = useState({});

  useAutoClearMessage(success, setSuccess);

  const statusOptions = [
    { value: 'all', label: 'Tous statuts' },
    { value: 'pending', label: 'En attente' },
    { value: 'partially_paid', label: 'Partiellement payé' },
    { value: 'completed', label: 'Payé' },
    { value: 'cancelled', label: 'Annulé' }
  ];

  // Calculer les dates de la semaine actuelle
  useEffect(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Lundi de cette semaine
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche de cette semaine

    setCurrentWeekDates({
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    });

    if (period === 'weekly') {
      setStartDate(startOfWeek.toISOString().split('T')[0]);
      setEndDate(endOfWeek.toISOString().split('T')[0]);
    }
  }, [period]);

  const validateDates = () => {
    if (period === 'custom') {
      if (!startDate || !endDate) {
        setError('Veuillez sélectionner les deux dates');
        return false;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        setError('La date de début doit être avant la date de fin');
        return false;
      }

      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        setError('La période ne peut pas dépasser 1 an');
        return false;
      }
    }
    return true;
  };

  const handleExport = async () => {
    try {
      setError('');
      setSuccess('');

      if (!validateDates()) return;

      setLoading(true);

      // Pour la période hebdomadaire, utiliser les dates calculées
      let exportStartDate = startDate;
      let exportEndDate = endDate;

      if (period === 'weekly') {
        exportStartDate = currentWeekDates.start;
        exportEndDate = currentWeekDates.end;
      }

      const response = await api.get('/exports/sales-export', {
        params: {
          period,
          startDate: period === 'custom' ? startDate : exportStartDate,
          endDate: period === 'custom' ? endDate : exportEndDate,
          status: statusFilter
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Générer un nom de fichier significatif
      let filename = `ventes_${period}`;
      if (period === 'custom' && startDate && endDate) {
        filename = `ventes_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}`;
      }
      if (statusFilter !== 'all') {
        const statusLabel = statusOptions.find(s => s.value === statusFilter)?.label || statusFilter;
        filename += `_${statusLabel.replace(/\s+/g, '_')}`;
      }

      link.setAttribute('download', `${filename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Export réussi! Téléchargement démarré');
    } catch (error) {
      let errorMsg = 'Erreur lors de l\'export';

      if (error.response) {
        // Erreur spécifique du backend
        if (error.response.status === 404) {
          errorMsg = 'Aucune donnée trouvée pour cette période et ce statut';
        } else {
          errorMsg = error.response.data?.message || errorMsg;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'daily': return "d'aujourd'hui";
      case 'weekly': return "de la semaine en cours";
      case 'monthly': return "du mois en cours";
      case 'custom': return "personnalisée";
      default: return "";
    }
  };

  const getStatusLabel = () => {
    const status = statusOptions.find(opt => opt.value === statusFilter);
    return status ? status.label : '';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter les ventes
          </h2>
          <p className="mt-1 text-gray-600 text-sm">
            Générez des rapports Excel détaillés avec filtres avancés
          </p>
        </div>
        <div className="bg-blue-50 rounded-full px-3 py-1 flex items-center">
          <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-blue-700 text-sm font-medium">Export Excel</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtres d'export
          </h3>

          <div className="space-y-4">
            {/* Filtre par période */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Période</label>
              <select
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 pr-8"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setError('');
                  setSuccess('');

                  // Réinitialiser les dates pour les périodes non personnalisées
                  if (e.target.value !== 'custom') {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
              >
                <option value="daily">Journalier</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
                <option value="custom">Personnalisé</option>
              </select>
              <svg className="w-5 h-5 absolute right-2.5 bottom-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>

            {/* Filtre par statut */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 pr-8"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setError('');
                  setSuccess('');
                }}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <svg className="w-5 h-5 absolute right-2.5 bottom-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>

            {/* Dates personnalisées */}
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">De</label>
                  <input
                    type="date"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setError('');
                    }}
                    max={endDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">À</label>
                  <input
                    type="date"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setError('');
                    }}
                    min={startDate}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            )}

            {period === 'weekly' && currentWeekDates.start && (
              <div className="bg-blue-100 p-3 rounded-lg text-blue-800 text-sm">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Semaine du {new Date(currentWeekDates.start).toLocaleDateString('fr-FR')} au {new Date(currentWeekDates.end).toLocaleDateString('fr-FR')}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 p-5 rounded-lg flex flex-col">
          <div className="flex items-center mb-4">
            <svg className="w-6 h-6 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-md font-semibold">Résumé de l'export</h3>
          </div>

          <div className="flex-grow space-y-3">
            <div className="flex justify-between pb-2 border-b">
              <span className="text-gray-600">Période:</span>
              <span className="font-medium">{getPeriodLabel()}</span>
            </div>

            <div className="flex justify-between pb-2 border-b">
              <span className="text-gray-600">Statut:</span>
              <span className="font-medium">{getStatusLabel()}</span>
            </div>

            {period === 'custom' && startDate && endDate && (
              <div className="flex justify-between pb-2 border-b">
                <span className="text-gray-600">Dates:</span>
                <span className="font-medium">
                  {new Date(startDate).toLocaleDateString('fr-FR')} - {new Date(endDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}

            {period === 'weekly' && currentWeekDates.start && (
              <div className="flex justify-between pb-2 border-b">
                <span className="text-gray-600">Dates:</span>
                <span className="font-medium">
                  {new Date(currentWeekDates.start).toLocaleDateString('fr-FR')} - {new Date(currentWeekDates.end).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}

            <div className="pt-3">
              <p className="text-sm text-gray-600 mb-2">Contenu inclus:</p>
              <ul className="text-sm space-y-1">
                <li className="flex items-start">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Produits et quantités vendus</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Statut de paiement et soldes</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Historique des paiements</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Informations clients et vendeurs</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center text-sm text-blue-700">
              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {period === 'custom' && 'Sélectionnez une période ≤ 1 an'}
              {period !== 'custom' && 'Export optimisé pour les grandes périodes'}
            </div>
          </div>
        </div>
      </div>

      {/* Messages d'état */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-red-800">Erreur d'export</h4>
            <p className="text-red-700 mt-1 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-green-800">Export réussi!</h4>
            <p className="text-green-700 mt-1 text-sm">
              {success} Votre fichier Excel devrait commencer à télécharger automatiquement.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExport}
          disabled={loading || (period === 'custom' && (!startDate || !endDate))}
          className={`
            bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg
            transition-colors flex items-center justify-center gap-2 flex-1
            disabled:bg-gray-400 disabled:cursor-not-allowed
            ${loading ? 'animate-pulse' : ''}
          `}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Génération en cours...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Générer l'export Excel
            </>
          )}
        </button>

        <button
          onClick={() => {
            setPeriod('daily');
            setStartDate('');
            setEndDate('');
            setStatusFilter('all');
            setError('');
            setSuccess('');
          }}
          className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Réinitialiser
        </button>
      </div>

      <div className="mt-8 pt-6 border-t">
        <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          À propos de cet export
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Format du rapport
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Fichier Excel (.xlsx) compatible</li>
              <li>• Feuille unique nommée "Ventes"</li>
              <li>• 14 colonnes de données détaillées</li>
              <li>• Format monétaire en CFA</li>
              <li>• En-têtes gelés pour le défilement</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Bonnes pratiques
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Vérifiez les dates avant l'export</li>
              <li>• Exportez régulièrement vos données</li>
              <li>• Conservez une copie des exports</li>
              <li>• Limitez les périodes longues (≤1 an)</li>
              <li>• Utilisez des filtres pour des rapports précis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportSales;
