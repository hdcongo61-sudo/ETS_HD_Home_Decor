import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Edit3,
  FileText,
  Filter,
  HandCoins,
  Mail,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import api from '../services/api';
import {
  employeeAdvancesPath,
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

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [payrollFilter, setPayrollFilter] = useState('all');
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
    const totalSalary = employees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0);
    const payrollReady = employees.filter(hasPaySlipForCurrentMonth).length;
    const missingPayroll = Math.max(employees.length - payrollReady, 0);

    return {
      totalEmployees: employees.length,
      totalSalary,
      averageSalary: employees.length ? totalSalary / employees.length : 0,
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
        const payrollDone = hasPaySlipForCurrentMonth(employee);
        const matchesPayroll =
          payrollFilter === 'all' ||
          (payrollFilter === 'ready' && payrollDone) ||
          (payrollFilter === 'missing' && !payrollDone);

        return matchesSearch && matchesDepartment && matchesPayroll;
      })
      .sort((a, b) => {
        if (sortBy === 'salary_desc') return Number(b.salary || 0) - Number(a.salary || 0);
        if (sortBy === 'salary_asc') return Number(a.salary || 0) - Number(b.salary || 0);
        if (sortBy === 'hireDate_desc') return new Date(b.hireDate || 0) - new Date(a.hireDate || 0);
        return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
      });
  }, [employees, searchTerm, departmentFilter, payrollFilter, sortBy]);

  const hasActiveFilters = searchTerm || departmentFilter || payrollFilter !== 'all' || sortBy !== 'name';

  const resetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <UsersRound className="w-6 h-6" />
            </div>
            Gestion des Employés
          </h1>
          <p className="text-gray-600 mt-2">Vue claire des employés, salaires, paie du mois et actions rapides.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Link
            to="/employees/new" 
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvel Employé
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={<UsersRound className="w-5 h-5" />} label="Employés" value={dashboardStats.totalEmployees} />
        <MetricCard icon={<Banknote className="w-5 h-5" />} label="Masse salariale" value={formatCurrency(dashboardStats.totalSalary)} />
        <MetricCard icon={<BriefcaseBusiness className="w-5 h-5" />} label="Salaire moyen" value={formatCurrency(dashboardStats.averageSalary)} />
        <MetricCard icon={<FileText className="w-5 h-5" />} label="Paie créée" value={`${dashboardStats.payrollReady}/${dashboardStats.totalEmployees}`} tone="green" />
        <MetricCard icon={<CalendarClock className="w-5 h-5" />} label="Paie à préparer" value={dashboardStats.missingPayroll} tone={dashboardStats.missingPayroll > 0 ? 'amber' : 'green'} />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
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
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </label>

          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Département</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="">Tous</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[190px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paie du mois</span>
            <select
              value={payrollFilter}
              onChange={(e) => setPayrollFilter(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
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
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
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
                return (
                <tr key={employee._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={employeeBasePath(employee)}
                      className="flex items-center gap-3 text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-blue-50 border border-gray-100 flex items-center justify-center">
                        {employee.photo ? (
                          <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div>{employee.name}</div>
                        <div className="text-xs text-gray-500">{employee.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{employee.position || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{employee.department || 'N/A'}</td>
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
                        className="text-gray-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 inline-flex items-center"
                        title="Créer fiche de paie"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        to={employeeAdvancesPath(employee)}
                        className="text-gray-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 inline-flex items-center"
                        title="Avances"
                      >
                        <HandCoins className="w-4 h-4" />
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
                <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">
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
            return (
            <div key={employee._id} className="bg-white p-5 rounded-2xl border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-blue-50 border border-gray-100 flex items-center justify-center">
                    {employee.photo ? (
                      <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <Link to={employeeBasePath(employee)} className="text-base font-semibold text-gray-900 hover:text-blue-600">
                      {employee.name}
                    </Link>
                    <div className="text-sm text-gray-600 mt-1">{employee.position}</div>
                    <div className="text-sm text-gray-600">{employee.email}</div>
                    <div className="text-sm text-gray-500">{employee.department || 'N/A'}</div>
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      {formatCurrency(employee.salary)}
                    </div>
                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${payrollReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                      Paie du mois : {payrollReady ? 'créée' : 'à préparer'}
                    </span>
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
                <Link
                  to={employeeAdvancesPath(employee)}
                  className="text-sm text-gray-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg hover:bg-indigo-50"
                >
                  <HandCoins className="w-4 h-4" />
                  Avances
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
};

const MetricCard = ({ icon, label, value, tone = 'blue' }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${metricTones[tone] || metricTones.blue}`}>
      {icon}
    </div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
  </div>
);

export default EmployeeList;
