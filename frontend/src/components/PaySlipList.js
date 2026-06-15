import { confirmDialog } from './ConfirmProvider';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {  employeeBasePath,
  employeePayrollNewPath,
  employeePayrollPayslipEditPath,
  employeePayrollPayslipPrintPath,
} from '../utils/paths';
import AppLoader from './AppLoader';

const PaySlipList = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [paySlips, setPaySlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [employee, setEmployee] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [showSummary, setShowSummary] = useState(true);
    const [reloadToken, setReloadToken] = useState(0);
    const employeeReference = employee || { _id: id };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: employeeData } = await api.get(`/employees/${id}`);
                setEmployee(employeeData);

                const { data: paySlipsData } = await api.get(`/employees/${id}/payroll`);
                setPaySlips(paySlipsData);
                setError('');
            } catch (err) {
                setError(err.response?.data?.message || 'Erreur de chargement des fiches de paie');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, reloadToken]);

    const handleEdit = (payslipId) => {
        navigate(employeePayrollPayslipEditPath(employeeReference, payslipId));
    };

    const handleDelete = async (payslipId) => {
        if (await confirmDialog('Confirmer la suppression de cette fiche de paie ?')) {
            try {
                await api.delete(`/employees/${id}/payroll/${payslipId}`);
                setPaySlips(paySlips.filter(slip => slip._id !== payslipId));
            } catch (err) {
                setError(err.response?.data?.message || 'Erreur lors de la suppression');
            }
        }
    };

    const handlePrint = (payslipId) => {
        navigate(employeePayrollPayslipPrintPath(employeeReference, payslipId));
    };

    const filteredPaySlips = paySlips.filter((slip) => {
        const matchesMonth = selectedMonth === 'all' || slip.month === selectedMonth;
        const matchesYear = slip.year === selectedYear;
        const matchesStatus = selectedStatus === 'all' || slip.status === selectedStatus;
        return matchesMonth && matchesYear && matchesStatus;
    });

    const statusStyles = {
        pending: { label: 'En attente', classes: 'bg-[var(--ms-warning)]/15 text-amber-800' },
        paid: { label: 'Payé', classes: 'bg-[var(--ms-success)]/15 text-green-800' },
        cancelled: { label: 'Annulé', classes: 'bg-[var(--ms-danger)]/15 text-red-800' }
    };

    const formatPeriod = (month, year) =>
        new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
            {/* Header */}
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate(employeeBasePath(employeeReference))}
                    className="p-2 rounded-full hover:bg-[var(--ms-bg-subtle)] mr-2 transition-colors"
                >
                    <svg className="w-5 h-5 text-[var(--ms-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-semibold text-[var(--ms-text-strong)]">Fiches de paie</h1>
            </div>

            {/* Employee Info */}
            <div className="bg-[var(--ms-white)] rounded-lg shadow-[var(--ms-shadow-sm)] border border-[var(--ms-border)] p-6 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-md">
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-[var(--ms-text-strong)]">{employee?.name}</h2>
                        <p className="text-[var(--ms-text)]">{employee?.position} • {employee?.department}</p>
                    </div>
                </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-[var(--ms-white)] rounded-lg shadow-[var(--ms-shadow-sm)] border border-[var(--ms-border)] p-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">Filtrer par période</h3>
                    
                    <div className="flex w-full flex-col sm:flex-row sm:flex-wrap gap-3">
                        <button
                            onClick={() => setShowSummary(!showSummary)}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[var(--ms-bg-subtle)] px-4 py-2.5 text-sm text-[var(--ms-text)] transition-colors hover:bg-gray-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {showSummary ? 'Masquer résumé' : 'Afficher résumé'}
                        </button>
                        <Link
                            to={employeePayrollNewPath(employeeReference)}
                            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[var(--ms-blue-soft)]0 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--ms-blue)]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Nouvelle fiche
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--ms-text)] mb-2">Mois</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="w-full p-3 border border-[var(--ms-border-strong)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Tous les mois</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>
                                    {new Date(2000, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--ms-text)] mb-2">Année</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full p-3 border border-[var(--ms-border-strong)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--ms-text)] mb-2">Statut</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full p-3 border border-[var(--ms-border-strong)] rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="pending">En attente</option>
                            <option value="paid">Payé</option>
                            <option value="cancelled">Annulé</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Monthly Summary */}
            {showSummary && filteredPaySlips.length > 0 && (
                <div className="bg-[var(--ms-white)] rounded-lg shadow-[var(--ms-shadow-sm)] border border-[var(--ms-border)] p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-[var(--ms-text-strong)] text-lg">Résumé du mois</h3>
                        <div className="text-sm text-[var(--ms-text)]">
                            {selectedMonth === 'all'
                                ? selectedYear
                                : new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[var(--ms-bg-subtle)] p-5 rounded-md border border-[var(--ms-border)]">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-[var(--ms-text)]">Total salaire brut</div>
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-xl font-semibold text-[var(--ms-text-strong)] mt-2">
                                {new Intl.NumberFormat('fr-FR').format(
                                    filteredPaySlips.reduce((sum, slip) => sum + slip.baseSalary, 0)
                                )} CFA
                            </div>
                        </div>
                        <div className="bg-[var(--ms-bg-subtle)] p-5 rounded-md border border-[var(--ms-border)]">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-[var(--ms-text)]">Total déductions</div>
                                <div className="bg-[var(--ms-danger)]/15 p-2 rounded-lg">
                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-xl font-semibold text-[var(--ms-danger)] mt-2">
                                {new Intl.NumberFormat('fr-FR').format(
                                    filteredPaySlips.reduce((sum, slip) => sum + slip.deductions, 0)
                                )} CFA
                            </div>
                        </div>
                        <div className="bg-[var(--ms-bg-subtle)] p-5 rounded-md border border-[var(--ms-border)]">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-[var(--ms-text)]">Total salaire net</div>
                                <div className="bg-[var(--ms-success)]/15 p-2 rounded-lg">
                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-xl font-semibold text-[var(--ms-success)] mt-2">
                                {new Intl.NumberFormat('fr-FR').format(
                                    filteredPaySlips.reduce((sum, slip) => sum + slip.netSalary, 0)
                                )} CFA
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Slips List */}
            <div className="bg-[var(--ms-white)] rounded-lg shadow-[var(--ms-shadow-sm)] border border-[var(--ms-border)] overflow-hidden">
                <div className="p-6 border-b border-[var(--ms-border)]">
                    <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">
                        Fiches de paie ({filteredPaySlips.length})
                    </h3>
                </div>

                {filteredPaySlips.length === 0 ? (
                    <div className="p-10 text-center">
                        <div className="max-w-md">
                            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h4 className="mt-4 text-[var(--ms-text)] font-medium">Aucune fiche de paie</h4>
                            <p className="text-[var(--ms-text-muted)] mt-2">
                                Aucune fiche de paie trouvée pour {selectedMonth === 'all'
                                    ? `l'année ${selectedYear}`
                                    : new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                            </p>
                            <Link
                                to={employeePayrollNewPath(employeeReference)}
                                className="mt-4 inline-flex items-center px-4 py-2.5 bg-[var(--ms-blue-soft)]0 hover:bg-[var(--ms-blue)] text-white rounded-md text-sm transition-colors"
                            >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Créer une nouvelle fiche
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 md:hidden">
                            {filteredPaySlips.map((slip) => {
                                const status = statusStyles[slip.status] || statusStyles.pending;
                                return (
                                    <div key={slip._id} className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]/70 p-4 shadow-[var(--ms-shadow-sm)]">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
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
                                                    + {new Intl.NumberFormat('fr-FR').format(slip.bonuses)} CFA
                                                </p>
                                            </div>
                                            <div className="rounded-md bg-white/80 p-3 shadow-inner">
                                                <p className="font-medium text-[var(--ms-text-muted)]">Déductions</p>
                                                <p className="mt-1 text-sm font-semibold text-red-500">
                                                    - {new Intl.NumberFormat('fr-FR').format(slip.deductions)} CFA
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
                                            <button
                                                onClick={() => handleEdit(slip._id)}
                                                className="flex-1 rounded-md border border-blue-200 bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-blue)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-blue-soft)]"
                                            >
                                                Modifier
                                            </button>
                                            <button
                                                onClick={() => handlePrint(slip._id)}
                                                className="flex-1 rounded-md border border-green-200 bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-success)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-success)]/10"
                                            >
                                                Imprimer
                                            </button>
                                            <button
                                                onClick={() => handleDelete(slip._id)}
                                                className="flex-1 rounded-md border border-red-200 bg-[var(--ms-white)] px-3 py-2 text-xs font-semibold text-[var(--ms-danger)] shadow-[var(--ms-shadow-sm)] transition-colors hover:bg-[var(--ms-danger)]/10"
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-[var(--ms-bg-subtle)]">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Période</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Salaire de base</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Déductions</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Bonus</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Salaire net</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-[var(--ms-text-muted)] uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[var(--ms-white)] divide-y divide-gray-200">
                                {filteredPaySlips.map((slip) => {
                                    const status = statusStyles[slip.status] || statusStyles.pending;
                                    return (
                                        <tr key={slip._id} className="hover:bg-[var(--ms-bg-subtle)] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--ms-text-strong)] capitalize">
                                                {formatPeriod(slip.month, slip.year)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ms-text)]">
                                                {new Intl.NumberFormat('fr-FR').format(slip.baseSalary)} CFA
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                                                - {new Intl.NumberFormat('fr-FR').format(slip.deductions)} CFA
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ms-success)]">
                                                + {new Intl.NumberFormat('fr-FR').format(slip.bonuses)} CFA
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[var(--ms-text-strong)]">
                                                {new Intl.NumberFormat('fr-FR').format(slip.netSalary)} CFA
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.classes}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--ms-text-muted)]">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(slip._id)}
                                                        className="text-blue-500 hover:text-[var(--ms-blue)] p-1.5 rounded-lg hover:bg-[var(--ms-blue-soft)] inline-flex items-center transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(slip._id)}
                                                        className="text-red-500 hover:text-[var(--ms-danger)] p-1.5 rounded-lg hover:bg-[var(--ms-danger)]/10 inline-flex items-center transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrint(slip._id)}
                                                        className="text-green-500 hover:text-[var(--ms-success)] p-1.5 rounded-lg hover:bg-[var(--ms-success)]/10 inline-flex items-center transition-colors"
                                                        title="Imprimer"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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
                    </>
                )}
            </div>

            <div className="mt-8 text-center text-sm text-[var(--ms-text-muted)]">
                <p>© {new Date().getFullYear()} Système de Gestion des Fiches de Paie</p>
            </div>
        </div>
    );
};

export default PaySlipList;
