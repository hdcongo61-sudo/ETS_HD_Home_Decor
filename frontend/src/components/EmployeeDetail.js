import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Edit3, FileText, Mail, Phone, Plus, UserRound, UserX } from 'lucide-react';
import api from '../services/api';
import AppLoader from './AppLoader';
import {
  employeeEditPath,
  employeePayrollNewPath,
  employeePayrollPath,
  employeePayrollPayslipEditPath,
} from '../utils/paths';

const statusStyles = {
  pending: { label: 'En attente', classes: 'bg-[var(--ms-warning)]/15 text-amber-800' },
  paid: { label: 'Payé', classes: 'bg-[var(--ms-success)]/15 text-green-800' },
  cancelled: { label: 'Annulé', classes: 'bg-[var(--ms-danger)]/15 text-red-800' }
};

const formatPeriod = (month, year) =>
  new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [paySlips, setPaySlips] = useState([]);
  const [stats, setStats] = useState({
    totalPaid: 0,
    balance: 0
  });
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const employeeReference = employee || { _id: id };
  const employeeActive = employee?.isActive !== false;

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

        // Calculate stats
        const totalPaid = paySlipsData.reduce((sum, slip) => sum + slip.netSalary, 0);

        setStats({
          totalPaid,
          balance: totalPaid
        });

        setError('');
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur de chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, reloadToken]);

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
        <AppLoader fullScreen={false} text="Chargement des données de l'employé…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-[var(--ms-danger)]/10 p-6 rounded-lg flex items-start gap-4">
          <div className="bg-[var(--ms-danger)]/15 p-2 rounded-full">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">Erreur de chargement</h3>
            <p className="text-[var(--ms-text)] mt-1">{error}</p>
            <button
              onClick={() => setReloadToken((value) => value + 1)}
              className="mt-3 px-4 py-2 bg-[var(--ms-bg-subtle)] hover:bg-gray-200 text-[var(--ms-text)] rounded-md text-sm inline-flex items-center transition-colors"
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
    <div className="p-6">
      {isPhotoOpen && employee.photo && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-md"
          onClick={() => setIsPhotoOpen(false)}
        >
          <div
            className="relative w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPhotoOpen(false)}
            className="absolute -top-3 -right-3 bg-[var(--ms-white)] text-[var(--ms-text)] rounded-lg p-2 shadow-[var(--ms-shadow)] hover:bg-[var(--ms-bg-subtle)]"
              aria-label="Fermer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={employee.photo}
              alt={employee.name}
              className="w-full max-h-[80vh] object-contain rounded-lg bg-[var(--ms-white)] shadow-[0_28px_90px_rgba(15,23,42,0.28)]"
            />
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/employees')}
          className="p-2 rounded-full hover:bg-[var(--ms-bg-subtle)] mr-2 transition-colors"
        >
          <svg className="w-5 h-5 text-[var(--ms-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-[var(--ms-text-strong)]">Détails de l'employé</h1>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        {/* Profile Header */}
        <div className="p-6 sm:p-8 flex flex-col gap-6 border-b border-[var(--ms-border)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => employee.photo && setIsPhotoOpen(true)}
            className={`w-16 h-16 rounded-lg overflow-hidden border border-[var(--ms-border)] flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-gray-900/10 ${employeeActive ? 'bg-[var(--ms-bg-subtle)]' : 'bg-gray-200 grayscale'}`}
            aria-label="Afficher la photo en grand"
          >
            {employee.photo ? (
              <img
                src={employee.photo}
                alt={employee.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-8 h-8 text-[var(--ms-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-[var(--ms-text-strong)]">{employee.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${employeeActive ? 'bg-[var(--ms-success)]/10 text-[var(--ms-success)]' : 'bg-[var(--ms-bg-subtle)] text-[var(--ms-text)]'}`}>
                {employeeActive ? 'Actif dans la boutique' : 'Ne travaille plus ici'}
              </span>
              {!employeeActive && employee.leftDate && (
                <span className="inline-flex rounded-full bg-[var(--ms-bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--ms-text)]">
                  Départ le {new Date(employee.leftDate).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
            <p className="text-[var(--ms-text)] flex items-center gap-1 mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {employee.position}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ms-text)]">
              {employee.department && (
                <span className="inline-flex items-center rounded-full bg-[var(--ms-bg-subtle)] px-3 py-1 font-medium">
                  {employee.department}
                </span>
              )}
              {employee.email && (
                <a href={`mailto:${employee.email}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--ms-blue-soft)] px-3 py-1 font-medium text-[var(--ms-blue)] hover:bg-blue-100">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </a>
              )}
              {employee.phone && (
                <a href={`tel:${employee.phone}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--ms-success)]/10 px-3 py-1 font-medium text-[var(--ms-success)] hover:bg-[var(--ms-success)]/15">
                  <Phone className="w-3.5 h-3.5" />
                  Appeler
                </a>
              )}
              {!employeeActive && employee.inactiveReason && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ms-bg-subtle)] px-3 py-1 font-medium text-[var(--ms-text)]">
                  <UserX className="h-3.5 w-3.5" />
                  {employee.inactiveReason}
                </span>
              )}
            </div>
          </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <Link
              to={employeePayrollNewPath(employeeReference)}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${employeeActive ? 'bg-gray-950 text-white hover:bg-black' : 'pointer-events-none bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]'}`}
              aria-disabled={!employeeActive}
            >
              <Plus className="w-4 h-4" />
              Fiche de paie
            </Link>
            <Link
              to={employeePayrollPath(employeeReference)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ms-bg-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ms-text)] hover:bg-gray-200"
            >
              <FileText className="w-4 h-4" />
              Paie
            </Link>
            <Link
              to={employeeEditPath(employeeReference)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ms-bg-subtle)] px-4 py-2.5 text-sm font-semibold text-[var(--ms-text)] hover:bg-gray-200"
            >
              <Edit3 className="w-4 h-4" />
              Modifier
            </Link>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-6 sm:p-8 bg-[var(--ms-bg-subtle)]/80 border-b border-[var(--ms-border)]">
          <h3 className="text-lg font-semibold text-[var(--ms-text-strong)] mb-4">Résumé financier</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--ms-white)] p-5 rounded-lg border border-[var(--ms-border)] flex items-center gap-4">
              <div className="bg-[var(--ms-blue-soft)] p-3 rounded-md">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-[var(--ms-text-muted)]">Salaire mensuel</div>
                <div className="text-lg font-semibold text-[var(--ms-text-strong)]">
                  {new Intl.NumberFormat('fr-FR').format(employee.salary)} CFA
                </div>
              </div>
            </div>

            <div className="bg-[var(--ms-white)] p-5 rounded-lg border border-[var(--ms-border)] flex items-center gap-4">
              <div className="bg-[var(--ms-success)]/10 p-3 rounded-md">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-[var(--ms-text-muted)]">Total payé</div>
                <div className="text-lg font-semibold text-[var(--ms-text-strong)]">
                  {new Intl.NumberFormat('fr-FR').format(stats.totalPaid)} CFA
                </div>
              </div>
            </div>

            <div className="bg-[var(--ms-white)] p-5 rounded-lg border border-[var(--ms-border)] flex items-center gap-4">
              <div className={`p-3 rounded-md ${stats.balance >= 0 ? 'bg-[var(--ms-success)]/10' : 'bg-[var(--ms-danger)]/10'}`}>
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
                <div className="text-sm text-[var(--ms-text-muted)]">Solde</div>
                <div className={`text-lg font-semibold ${stats.balance >= 0 ? 'text-[var(--ms-success)]' : 'text-[var(--ms-danger)]'}`}>
                  {new Intl.NumberFormat('fr-FR').format(stats.balance)} CFA
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[var(--ms-border)] px-8">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-6 flex shrink-0 items-center gap-2 font-medium text-sm ${activeTab === 'details'
                ? 'text-[var(--ms-text-strong)] border-b-2 border-gray-950'
                : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'
                }`}
            >
              <UserRound className="w-5 h-5" />
              Détails
            </button>

            <button
              onClick={() => setActiveTab('payslips')}
              className={`py-4 px-6 flex shrink-0 items-center gap-2 font-medium text-sm ${activeTab === 'payslips'
                ? 'text-[var(--ms-text-strong)] border-b-2 border-gray-950'
                : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
              </svg>
              Fiches de paie ({paySlips.length})
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
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                label="Email"
                value={employee.email}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
                label="Téléphone"
                value={employee.phone}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
                label="Poste"
                value={employee.position}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="Salaire"
                value={`${new Intl.NumberFormat('fr-FR').format(employee.salary)} CFA`}
              />

              <DetailItem
                icon={
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                label="Département"
                value={employee.department}
              />
              <DetailItem
                icon={<UserX className="h-5 w-5 text-[var(--ms-text-muted)]" />}
                label="Statut boutique"
                value={
                  employeeActive
                    ? 'Travaille encore dans la boutique'
                    : `Ne travaille plus${employee.leftDate ? ` depuis le ${new Date(employee.leftDate).toLocaleDateString('fr-FR')}` : ''}`
                }
              />
              {!employeeActive && employee.inactiveReason && (
                <DetailItem
                  icon={
                    <svg className="w-5 h-5 text-[var(--ms-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h8m-8 4h6M5 5h14v14H5z" />
                    </svg>
                  }
                  label="Note de départ"
                  value={employee.inactiveReason}
                />
              )}
            </div>
          )}

          {/* Pay Slips Tab */}
          {activeTab === 'payslips' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">Historique des fiches de paie</h3>
                <Link
                  to={employeePayrollNewPath(employeeReference)}
                  className={`rounded-lg px-4 py-2.5 flex items-center gap-2 transition-colors ${employeeActive ? 'bg-gray-950 text-white hover:bg-black' : 'pointer-events-none bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]'}`}
                  aria-disabled={!employeeActive}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle fiche
                </Link>
              </div>

              {paySlips.length > 0 ? (
                <>
                  <div className="space-y-4 md:hidden">
                    {paySlips.map((slip) => {
                      const status = statusStyles[slip.status] || statusStyles.pending;
                      return (
                        <div key={slip._id} className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]/70 p-4 shadow-[var(--ms-shadow-sm)]">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[var(--ms-text-strong)] capitalize">
                                {formatPeriod(slip.month, slip.year)}
                              </p>
                              <p className="text-xs text-[var(--ms-text-muted)]">
                                Salaire net :
                                <span className="ml-1 font-semibold text-[var(--ms-blue)]">
                                  {new Intl.NumberFormat('fr-FR').format(slip.netSalary)} CFA
                                </span>
                              </p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.classes}`}>
                              {status.label}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--ms-text)]">
                            <div className="rounded-md bg-white/80 p-3 shadow-inner">
                              <p className="font-medium text-[var(--ms-text-muted)]">Salaire de base</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ms-text-strong)]">
                                {new Intl.NumberFormat('fr-FR').format(slip.baseSalary)} CFA
                              </p>
                            </div>
                            <div className="rounded-md bg-white/80 p-3 shadow-inner">
                              <p className="font-medium text-[var(--ms-text-muted)]">Primes</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ms-success)]">
                                + {new Intl.NumberFormat('fr-FR').format(slip.bonuses || 0)} CFA
                              </p>
                            </div>
                            <div className="rounded-md bg-white/80 p-3 shadow-inner">
                              <p className="font-medium text-[var(--ms-text-muted)]">Déductions</p>
                              <p className="mt-1 text-sm font-semibold text-red-500">
                                - {new Intl.NumberFormat('fr-FR').format(slip.deductions || 0)} CFA
                              </p>
                            </div>
                            <div className="rounded-md bg-white/80 p-3 shadow-inner">
                              <p className="font-medium text-[var(--ms-text-muted)]">Créé le</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ms-text-strong)]">
                                {slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Link
                              to={employeePayrollPath(employeeReference)}
                              className="flex-1 rounded-md border border-blue-200 bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-blue)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-blue-soft)]"
                            >
                              Voir la liste
                            </Link>
                            <Link
                              to={employeePayrollPayslipEditPath(employeeReference, slip._id)}
                              className="flex-1 rounded-md border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-text)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-bg-subtle)]"
                            >
                              Modifier
                            </Link>
                            <button
                              onClick={() => handleDeletePaySlip(slip._id)}
                              className="flex-1 rounded-md border border-red-200 bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-danger)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-danger)]/10"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block">
                    <div className="overflow-hidden border border-[var(--ms-border)] rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[var(--ms-bg-subtle)]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Période</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Salaire net</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Statut</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-[var(--ms-white)] divide-y divide-gray-200">
                          {paySlips.map((slip) => {
                            const status = statusStyles[slip.status] || statusStyles.pending;
                            return (
                              <tr key={slip._id} className="hover:bg-[var(--ms-bg-subtle)] transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-[var(--ms-text-strong)] capitalize">
                                    {formatPeriod(slip.month, slip.year)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ms-text-muted)]">
                                  {new Intl.NumberFormat('fr-FR').format(slip.netSalary)} CFA
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.classes}`}>
                                    {status.label}
                                  </span>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex gap-3">
                                    <Link
                                      to={employeePayrollPath(employeeReference)}
                                      className="text-blue-500 hover:text-[var(--ms-blue)] p-1.5 rounded-md hover:bg-[var(--ms-blue-soft)] transition-colors"
                                      title="Voir la liste"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </Link>

                                    <Link
                                      to={employeePayrollPayslipEditPath(employeeReference, slip._id)}
                                      className="text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] p-1.5 rounded-md hover:bg-[var(--ms-bg-subtle)] transition-colors"
                                      title="Modifier"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </Link>

                                    <button
                                      onClick={() => handleDeletePaySlip(slip._id)}
                                      className="text-red-500 hover:text-[var(--ms-danger)] p-1.5 rounded-md hover:bg-[var(--ms-danger)]/10 transition-colors"
                                      title="Supprimer"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 border border-dashed border-[var(--ms-border-strong)] rounded-lg">
                  <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="mt-4 text-[var(--ms-text)] font-medium">Aucune fiche de paie</h4>
                  <p className="text-[var(--ms-text-muted)] mt-2 mb-4">Aucune fiche de paie trouvée pour cet employé</p>
                  <Link
                    to={employeePayrollNewPath(employeeReference)}
                    className={`inline-flex items-center rounded-lg px-4 py-2 text-sm transition-colors ${employeeActive ? 'bg-gray-950 text-white hover:bg-black' : 'pointer-events-none bg-[var(--ms-bg-subtle)] text-[var(--ms-text-muted)]'}`}
                    aria-disabled={!employeeActive}
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

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-[var(--ms-bg-subtle)] border-t border-[var(--ms-border)] flex flex-col sm:flex-row gap-3 justify-between">
          <Link
            to="/employees"
            className="form-button-secondary flex items-center gap-2 justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour à la liste
          </Link>
          <div className="flex gap-3">
            <Link
            to={employeeEditPath(employeeReference)}
              className="form-button-primary flex items-center gap-2 justify-center"
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
  <div className="flex items-start gap-4 p-4 bg-[var(--ms-white)] rounded-md border border-[var(--ms-border)]">
    <div className="mt-0.5 text-[var(--ms-text-muted)]">
      {icon}
    </div>
    <div>
      <div className="text-sm font-medium text-[var(--ms-text-muted)] mb-1">{label}</div>
      <div className="text-[var(--ms-text-strong)] font-medium">{value}</div>
    </div>
  </div>
);

export default EmployeeDetail;
