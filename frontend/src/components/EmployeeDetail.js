import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [paySlips, setPaySlips] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [stats, setStats] = useState({
    totalPaid: 0,
    totalAdvances: 0,
    balance: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch employee data
        const { data: employeeData } = await api.get(`/employees/${id}`);
        setEmployee(employeeData);

        // Fetch pay slips
        const { data: paySlipsData } = await api.get(`/employees/${id}/payroll`);
        setPaySlips(paySlipsData);

        // Fetch advances
        const { data: advancesData } = await api.get(`/employees/${id}/advances`);
        setAdvances(advancesData);

        // Calculate stats
        const totalPaid = paySlipsData.reduce((sum, slip) => sum + slip.netSalary, 0);
        const totalAdvances = advancesData
          .filter(adv => adv.status === 'approved')
          .reduce((sum, adv) => sum + adv.amount, 0);

        setStats({
          totalPaid,
          totalAdvances,
          balance: totalPaid - totalAdvances
        });

        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDeleteAdvance = async (advanceId) => {
    if (window.confirm('Confirmer la suppression de cette avance ?')) {
      try {
        await api.delete(`/employees/${id}/advances/${advanceId}`);
        setAdvances(advances.filter(adv => adv._id !== advanceId));

        // Update stats
        const advance = advances.find(a => a._id === advanceId);
        if (advance && advance.status === 'approved') {
          setStats(prev => ({
            ...prev,
            totalAdvances: prev.totalAdvances - advance.amount,
            balance: prev.balance + advance.amount
          }));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleDeletePaySlip = async (payslipId) => {
    if (window.confirm('Confirmer la suppression de cette fiche de paie ?')) {
      try {
        await api.delete(`/employees/${id}/payroll/${payslipId}`);
        setPaySlips(paySlips.filter(slip => slip._id !== payslipId));

        // Update stats
        const slip = paySlips.find(s => s._id === payslipId);
        if (slip) {
          setStats(prev => ({
            ...prev,
            totalPaid: prev.totalPaid - slip.netSalary,
            balance: prev.balance - slip.netSalary
          }));
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-300 mx-auto"></div>
          <p className="mt-4 text-gray-500">Chargement des données de l'employé...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 p-6 rounded-2xl flex items-start gap-4">
          <div className="bg-red-100 p-2 rounded-full">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Erreur de chargement</h3>
            <p className="text-gray-600 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm inline-flex items-center transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header Section */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/employees')}
          className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Détails de l'employé</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Profile Header */}
        <div className="p-8 flex items-center gap-6 border-b border-gray-100">
          <div className="bg-blue-500 p-4 rounded-2xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{employee.name}</h2>
            <p className="text-gray-600 flex items-center gap-1 mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {employee.position}
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-8 bg-gray-50 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé financier</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Salaire mensuel</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Intl.NumberFormat('fr-FR').format(employee.salary)} CFA
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-xl">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total payé</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Intl.NumberFormat('fr-FR').format(stats.totalPaid)} CFA
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stats.balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <svg
                  className={`w-6 h-6 ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stats.balance >= 0
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Solde</div>
                <div className={`text-lg font-semibold ${stats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('fr-FR').format(stats.balance)} CFA
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 px-8">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-6 flex items-center gap-2 font-medium text-sm ${activeTab === 'details'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Détails
            </button>

            <button
              onClick={() => setActiveTab('payslips')}
              className={`py-4 px-6 flex items-center gap-2 font-medium text-sm ${activeTab === 'payslips'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
              Fiches de paie ({paySlips.length})
            </button>

            <button
              onClick={() => setActiveTab('advances')}
              className={`py-4 px-6 flex items-center gap-2 font-medium text-sm ${activeTab === 'advances'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Avances ({advances.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                label="Email"
                value={employee.email}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
                label="Téléphone"
                value={employee.phone}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                label="Poste"
                value={employee.position}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="Salaire"
                value={`${new Intl.NumberFormat('fr-FR').format(employee.salary)} CFA`}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                label="Date d'embauche"
                value={new Date(employee.hireDate).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                label="Département"
                value={employee.department}
              />
            </div>
          )}

          {/* Pay Slips Tab */}
          {activeTab === 'payslips' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Historique des fiches de paie</h3>
                <Link
                  to={`/employees/${id}/payroll/new`}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle fiche
                </Link>
              </div>

              {paySlips.length > 0 ? (
                <div className="overflow-hidden border border-gray-200 rounded-2xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salaire net</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paySlips.map((slip) => (
                        <tr key={slip._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {new Date(slip.year, slip.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Intl.NumberFormat('fr-FR').format(slip.netSalary)} CFA
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-3">
                              <Link
                                to={`/employees/${id}/payroll`}
                                className="text-blue-500 hover:text-blue-700 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Link>

                              <Link
                                to={`/employees/${id}/payroll/${slip._id}/edit`}
                                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </Link>

                              <button
                                onClick={() => handleDeletePaySlip(slip._id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl">
                  <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="mt-4 text-gray-700 font-medium">Aucune fiche de paie</h4>
                  <p className="text-gray-500 mt-2 mb-4">Aucune fiche de paie trouvée pour cet employé</p>
                  <Link
                    to={`/employees/${id}/payroll/new`}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Créer une fiche de paie
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Advances Tab */}
          {activeTab === 'advances' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Historique des avances</h3>
                <Link
                  to={`/employees/${id}/advances/new`}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle avance
                </Link>
              </div>

              {advances.length > 0 ? (
                <div className="overflow-hidden border border-gray-200 rounded-2xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raison</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {advances.map((advance) => (
                        <tr key={advance._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(advance.date).toLocaleDateString('fr-FR')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {new Intl.NumberFormat('fr-FR').format(advance.amount)} CFA
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {advance.reason || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              advance.status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : advance.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {advance.status === 'approved' ? 'Approuvé' : advance.status === 'pending' ? 'En attente' : 'Rejeté'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteAdvance(advance._id)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-gray-300 rounded-2xl">
                  <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="mt-4 text-gray-700 font-medium">Aucune avance</h4>
                  <p className="text-gray-500 mt-2 mb-4">Aucune avance trouvée pour cet employé</p>
                  <Link
                    to={`/employees/${id}/advances/new`}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Créer une avance
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
          <Link
            to="/employees"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour à la liste
          </Link>
          <div className="flex gap-3">
            <Link
              to={`/employees/${id}/edit`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Modifier l'employé
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailItem = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200">
    <div className="mt-0.5 text-gray-400">
      {icon}
    </div>
    <div>
      <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-gray-900 font-medium">{value}</div>
    </div>
  </div>
);

export default EmployeeDetail;