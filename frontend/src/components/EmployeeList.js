import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Edit3,
  FileText,
  Filter,
  Mail,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  UsersRound,
} from 'lucide-react';
import api from '../services/api';
import {
  employeeBasePath,
  employeeEditPath,
  employeePayrollPath,
  employeePayrollNewPath,
} from '../utils/paths';
import AppLoader from './AppLoader';

const formatCurrency = (value) =>
  `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} CFA`;

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const hasPaySlipForCurrentMonth = (employee) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return (employee.paySlips || []).some((slip) => slip.month === month && slip.year === year);
};

const isEmployeeActive = (employee) => employee.isActive !== false;

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [payrollFilter, setPayrollFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await api.get('/employees');
        setEmployees(data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur de chargement des employés');
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Confirmer la suppression de cet employé ?')) {
      try {
        await api.delete(`/employees/${id}`);
        setEmployees(employees.filter(emp => emp._id !== id));
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const departments = useMemo(
    () =>
      [...new Set(employees.map((employee) => employee.department).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [employees]
  );

  const dashboardStats = useMemo(() => {
    const activeEmployees = employees.filter(isEmployeeActive);
    const inactiveEmployees = employees.length - activeEmployees.length;
    const totalSalary = activeEmployees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0);
    const payrollReady = activeEmployees.filter(hasPaySlipForCurrentMonth).length;
    const missingPayroll = Math.max(activeEmployees.length - payrollReady, 0);

    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      inactiveEmployees,
      totalSalary,
      averageSalary: activeEmployees.length ? totalSalary / activeEmployees.length : 0,
      payrollReady,
      missingPayroll,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const search = normalizeText(searchTerm);

    return employees
      .filter((employee) => {
        const matchesSearch =
          !search ||
          normalizeText(employee.name).includes(search) ||
          normalizeText(employee.position).includes(search) ||
          normalizeText(employee.email).includes(search) ||
          normalizeText(employee.phone).includes(search);
        const matchesDepartment =
          !departmentFilter || employee.department === departmentFilter;
        const active = isEmployeeActive(employee);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && active) ||
          (statusFilter === 'inactive' && !active);
        const payrollDone = hasPaySlipForCurrentMonth(employee);
        const matchesPayroll =
          payrollFilter === 'all' ||
          (payrollFilter === 'ready' && payrollDone) ||
          (payrollFilter === 'missing' && !payrollDone);

        return matchesSearch && matchesDepartment && matchesStatus && matchesPayroll;
      })
      .sort((a, b) => {
        if (sortBy === 'salary_desc') return Number(b.salary || 0) - Number(a.salary || 0);
        if (sortBy === 'salary_asc') return Number(a.salary || 0) - Number(b.salary || 0);
        if (sortBy === 'hireDate_desc') return new Date(b.hireDate || 0) - new Date(a.hireDate || 0);
        return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
      });
  }, [employees, searchTerm, departmentFilter, statusFilter, payrollFilter, sortBy]);

  const hasActiveFilters = searchTerm || departmentFilter || statusFilter !== 'active' || payrollFilter !== 'all' || sortBy !== 'name';

  const resetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('');
    setStatusFilter('active');
    setPayrollFilter('all');
    setSortBy('name');
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <AppLoader fullScreen={false} text="Chargement…" />
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        {error}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
            <div className="bg-gray-950 p-2 rounded-2xl text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]">
              <UsersRound className="w-6 h-6" />
            </div>
            Gestion des employés
          </h1>
          <p className="text-gray-600 mt-2">Vue claire des employés, salaires, paie du mois et actions rapides.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link
            to="/employees/new" 
            className="form-button-primary flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel Employé
          </Link>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={<UserCheck className="w-5 h-5" />} label="Actifs" value={dashboardStats.activeEmployees} tone="dark" />
        <MetricCard icon={<UserX className="w-5 h-5" />} label="Inactifs" value={dashboardStats.inactiveEmployees} tone="neutral" />
        <MetricCard icon={<Banknote className="w-5 h-5" />} label="Masse active" value={formatCurrency(dashboardStats.totalSalary)} />
        <MetricCard icon={<BriefcaseBusiness className="w-5 h-5" />} label="Salaire moyen" value={formatCurrency(dashboardStats.averageSalary)} />
        <MetricCard icon={<FileText className="w-5 h-5" />} label="Paie créée" value={`${dashboardStats.payrollReady}/${dashboardStats.activeEmployees}`} tone="green" />
        <MetricCard icon={<CalendarClock className="w-5 h-5" />} label="Paie à préparer" value={dashboardStats.missingPayroll} tone={dashboardStats.missingPayroll > 0 ? 'amber' : 'green'} />
      </div>

      <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1 min-w-[220px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recherche</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Nom, poste, email, téléphone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control pl-10 text-sm"
              />
            </div>
          </label>

          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Département</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="form-control mt-1 text-sm"
            >
              <option value="">Tous</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[170px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Statut</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control mt-1 text-sm"
            >
              <option value="active">Actifs</option>
              <option value="inactive">Ne travaillent plus</option>
              <option value="all">Tous</option>
            </select>
          </label>

          <label className="min-w-[190px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paie du mois</span>
            <select
              value={payrollFilter}
              onChange={(e) => setPayrollFilter(e.target.value)}
              className="form-control mt-1 text-sm"
            >
              <option value="all">Tous</option>
              <option value="missing">À préparer</option>
              <option value="ready">Créée</option>
            </select>
          </label>

          <label className="min-w-[190px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tri</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="form-control mt-1 text-sm"
            >
              <option value="name">Nom A-Z</option>
              <option value="hireDate_desc">Plus récent</option>
              <option value="salary_desc">Salaire élevé</option>
              <option value="salary_asc">Salaire bas</option>
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="form-button-secondary inline-flex items-center justify-center gap-2 text-sm"
            >
              <Filter className="w-4 h-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Version desktop */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Nom
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Poste
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Département
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Salaire
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paie</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map(employee => {
                const payrollReady = hasPaySlipForCurrentMonth(employee);
                const active = isEmployeeActive(employee);
                return (
                <tr key={employee._id} className={`transition-colors hover:bg-gray-50 ${active ? '' : 'bg-gray-50/60'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={employeeBasePath(employee)}
                      className="flex items-center gap-3 text-sm font-medium text-gray-900 hover:text-gray-700"
                    >
                      <div className={`w-10 h-10 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center ${active ? 'bg-gray-100' : 'bg-gray-200 grayscale'}`}>
                        {employee.photo ? (
                          <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className={active ? '' : 'text-gray-500'}>{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{employee.position || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{employee.department || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {active ? 'Actif' : 'Ne travaille plus'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatCurrency(employee.salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${payrollReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                      {payrollReady ? 'Créée' : 'À préparer'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={employeeBasePath(employee)}
                        className="text-gray-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 inline-flex items-center"
                        title="Profil"
                      >
                        <UserRound className="w-4 h-4" />
                      </Link>
                      <Link
                        to={employeePayrollNewPath(employee)}
                        className={`p-2 rounded-lg inline-flex items-center ${active ? 'text-gray-600 hover:text-green-700 hover:bg-green-50' : 'pointer-events-none text-gray-300'}`}
                        title="Créer fiche de paie"
                        aria-disabled={!active}
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        to={employeeEditPath(employee)}
                        className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 inline-flex items-center"
                        title="Modifier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(employee._id)}
                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 inline-flex items-center"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Aucun employé trouvé
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Version mobile */}
      <div className="md:hidden space-y-4">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map(employee => {
            const payrollReady = hasPaySlipForCurrentMonth(employee);
            const active = isEmployeeActive(employee);
            return (
            <div key={employee._id} className={`rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm ${active ? '' : 'bg-gray-50/90'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className={`w-12 h-12 rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center ${active ? 'bg-gray-100' : 'bg-gray-200 grayscale'}`}>
                    {employee.photo ? (
                      <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <Link to={employeeBasePath(employee)} className="text-base font-semibold text-gray-900 hover:text-gray-700">
                      {employee.name}
                    </Link>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {active ? 'Actif' : 'Ne travaille plus'}
                    </span>
                    <div className="text-sm text-gray-600 mt-1">{employee.position}</div>
                    <div className="text-sm text-gray-600">{employee.email}</div>
                    <div className="text-sm text-gray-500">{employee.department || 'N/A'}</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      {formatCurrency(employee.salary)}
                    </div>
                    {active && <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${payrollReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                      Paie du mois : {payrollReady ? 'créée' : 'à préparer'}
                    </span>}
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Link
                    to={employeeEditPath(employee)}
                    className="text-gray-600 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 inline-flex items-center"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(employee._id)}
                    className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 inline-flex items-center"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-100">
                <Link
                  to={employeeBasePath(employee)}
                  className="text-sm text-gray-600 hover:text-blue-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg hover:bg-blue-50"
                >
                  <UserRound className="w-4 h-4" />
                  Profil
                </Link>
                <Link
                  to={employeePayrollPath(employee)}
                  className="text-sm text-gray-600 hover:text-green-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg hover:bg-green-50"
                >
                  <FileText className="w-4 h-4" />
                  Paie
                </Link>
                <a
                  href={`mailto:${employee.email}`}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              </div>
            </div>
          );
          })
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center text-gray-500">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Aucun employé trouvé
          </div>
        )}
      </div>
    </div>
  );
};

const metricTones = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  dark: 'bg-gray-950 text-white',
  neutral: 'bg-gray-100 text-gray-700',
};

const MetricCard = ({ icon, label, value, tone = 'blue' }) => (
  <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${metricTones[tone] || metricTones.blue}`}>
      {icon}
    </div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
  </div>
);

export default EmployeeList;
