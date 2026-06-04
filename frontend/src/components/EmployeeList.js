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
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
  Workspace,
} from './business';

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
    <Workspace className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
      <AppLoader fullScreen={false} text="Chargement..." />
    </Workspace>
  );

  if (error) return (
    <Workspace>
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
        {error}
      </div>
    </Workspace>
  );

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Gestion des employés"
        description="Vue claire des employés, salaires, paie du mois et actions rapides."
        actions={
          <Button variant="primary" onClick={() => window.location.href = '/employees/new'}>
            <Plus className="h-4 w-4" /> Nouvel Employé
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <KPICard title="Actifs" value={dashboardStats.activeEmployees} tone="success" icon={<UserCheck className="h-4 w-4" />} />
        <KPICard title="Inactifs" value={dashboardStats.inactiveEmployees} tone="neutral" icon={<UserX className="h-4 w-4" />} />
        <KPICard title="Masse active" value={formatCurrency(dashboardStats.totalSalary)} tone="neutral" icon={<Banknote className="h-4 w-4" />} />
        <KPICard title="Salaire moyen" value={formatCurrency(dashboardStats.averageSalary)} tone="neutral" icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <KPICard title="Paie créée" value={`${dashboardStats.payrollReady}/${dashboardStats.activeEmployees}`} tone="success" icon={<FileText className="h-4 w-4" />} />
        <KPICard title="Paie à préparer" value={dashboardStats.missingPayroll} tone={dashboardStats.missingPayroll > 0 ? 'warning' : 'success'} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <CommandBar>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end w-full">
          <label className="flex-1 min-w-[220px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Recherche</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--ms-text-muted)]" />
              <input type="text" placeholder="Nom, poste, email, telephone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-control pl-10 text-sm" />
            </div>
          </label>
          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Departement</span>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="form-control mt-1 text-sm">
              <option value="">Tous</option>
              {departments.map((department) => (<option key={department} value={department}>{department}</option>))}
            </select>
          </label>
          <label className="min-w-[170px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Statut</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-control mt-1 text-sm">
              <option value="active">Actifs</option>
              <option value="inactive">Ne travaillent plus</option>
              <option value="all">Tous</option>
            </select>
          </label>
          <label className="min-w-[190px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Paie du mois</span>
            <select value={payrollFilter} onChange={(e) => setPayrollFilter(e.target.value)} className="form-control mt-1 text-sm">
              <option value="all">Tous</option>
              <option value="missing">A preparer</option>
              <option value="ready">Creee</option>
            </select>
          </label>
          <label className="min-w-[190px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Tri</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="form-control mt-1 text-sm">
              <option value="name">Nom A-Z</option>
              <option value="hireDate_desc">Plus recent</option>
              <option value="salary_desc">Salaire eleve</option>
              <option value="salary_asc">Salaire bas</option>
            </select>
          </label>
          {hasActiveFilters && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              <Filter className="w-4 h-4" /> Reinitialiser
            </Button>
          )}
        </div>
      </CommandBar>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable>
          <table className="w-full">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Poste</th>
                <th>Departement</th>
                <th>Statut</th>
                <th>Salaire</th>
                <th>Paie</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(employee => {
                  const payrollReady = hasPaySlipForCurrentMonth(employee);
                  const active = isEmployeeActive(employee);
                  return (
                  <tr key={employee._id} className={active ? '' : 'opacity-60'}>
                    <td>
                      <Link to={employeeBasePath(employee)} className="flex items-center gap-3 font-medium text-[var(--ms-text)] hover:text-[var(--ms-blue)]">
                        <div className={`w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center ${active ? 'bg-[var(--ms-bg-subtle)]' : 'bg-[var(--ms-surface-muted)]'}`}>
                          {employee.photo ? <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" /> :
                            <UserRound className="w-4 h-4 text-[var(--ms-text-muted)]" />}
                        </div>
                        <div>
                          <div>{employee.name}</div>
                          <div className="text-xs text-[var(--ms-text-muted)]">{employee.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="text-[var(--ms-text)]">{employee.position || 'N/A'}</td>
                    <td className="text-[var(--ms-text-muted)]">{employee.department || 'N/A'}</td>
                    <td><StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Actif' : 'Ne travaille plus'}</StatusBadge></td>
                    <td className="font-semibold text-[var(--ms-text)]">{formatCurrency(employee.salary)}</td>
                    <td><StatusBadge tone={payrollReady ? 'success' : 'warning'}>{payrollReady ? 'Creee' : 'A preparer'}</StatusBadge></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={employeeBasePath(employee)} className="ms-icon-button" title="Profil"><UserRound className="h-4 w-4" /></Link>
                        <Link to={employeePayrollNewPath(employee)} className={`ms-icon-button ${!active ? 'opacity-40 pointer-events-none' : ''}`} title="Fiche de paie" aria-disabled={!active}><FileText className="h-4 w-4" /></Link>
                        <Link to={employeeEditPath(employee)} className="ms-icon-button" title="Modifier"><Edit3 className="h-4 w-4" /></Link>
                        <button onClick={() => handleDelete(employee._id)} className="ms-icon-button text-[var(--ms-danger)] hover:bg-[#FDF3F4]" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
                })
              ) : (
                <tr><td colSpan="7"><EmptyState title="Aucun employe trouve" /></td></tr>
              )}
            </tbody>
          </table>
        </DataTable>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map(employee => {
            const payrollReady = hasPaySlipForCurrentMonth(employee);
            const active = isEmployeeActive(employee);
            return (
            <div key={employee._id} className={`ms-surface p-4 ${!active ? 'opacity-70' : ''}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center ${active ? 'bg-[var(--ms-bg-subtle)]' : 'bg-[var(--ms-surface-muted)]'}`}>
                    {employee.photo ? <img src={employee.photo} alt={employee.name} className="w-full h-full object-cover" /> :
                      <UserRound className="w-5 h-5 text-[var(--ms-text-muted)]" />}
                  </div>
                  <div>
                    <Link to={employeeBasePath(employee)} className="text-base font-semibold text-[var(--ms-text)]">{employee.name}</Link>
                    <div className="flex gap-2 mt-1">
                      <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Actif' : 'Ne travaille plus'}</StatusBadge>
                      {active && <StatusBadge tone={payrollReady ? 'success' : 'warning'}>Paie: {payrollReady ? 'creee' : 'a preparer'}</StatusBadge>}
                    </div>
                    <div className="text-sm text-[var(--ms-text-muted)] mt-1">{employee.position}</div>
                    <div className="text-sm text-[var(--ms-text-muted)]">{employee.email}</div>
                    <div className="text-sm text-[var(--ms-text-muted)]">{employee.department || 'N/A'}</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--ms-text)]">{formatCurrency(employee.salary)}</div>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Link to={employeeEditPath(employee)} className="ms-icon-button" title="Modifier"><Edit3 className="h-4 w-4" /></Link>
                  <button onClick={() => handleDelete(employee._id)} className="ms-icon-button text-[var(--ms-danger)]" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--ms-border)]">
                <Link to={employeeBasePath(employee)} className="ms-button ms-button-secondary ms-button-sm justify-center"><UserRound className="h-4 w-4" /> Profil</Link>
                <Link to={employeePayrollPath(employee)} className="ms-button ms-button-secondary ms-button-sm justify-center"><FileText className="h-4 w-4" /> Paie</Link>
                <a href={`mailto:${employee.email}`} className="ms-button ms-button-secondary ms-button-sm justify-center col-span-2"><Mail className="h-4 w-4" /> Email</a>
              </div>
            </div>
          );
          })
        ) : (
          <EmptyState title="Aucun employe trouve" />
        )}
      </div>
    </Workspace>
  );
};

export default EmployeeList;
