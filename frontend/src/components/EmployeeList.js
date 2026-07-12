import { confirmDialog } from './ConfirmProvider';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileText,
  Filter,
  HandCoins,
  Mail,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRound,
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
import { formatCfa } from '../utils/format';
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  PageHeader,
  StatusBadge,
  Workspace,
} from './business';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const isEmployeeActive = (employee) => employee.isActive !== false;

// Fiche de paie du mois en cours (les fiches annulées ne comptent pas).
const getCurrentMonthSlip = (employee) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return (employee.paySlips || []).find(
    (slip) => slip.month === month && slip.year === year && slip.status !== 'cancelled'
  );
};

// État de paie du mois : payé / à payer (fiche créée, salaire non versé) / à créer.
const PAY_STATES = {
  paid: { key: 'paid', label: 'Payée', tone: 'success' },
  due: { key: 'due', label: 'À payer', tone: 'danger' },
  todo: { key: 'todo', label: 'Fiche à créer', tone: 'warning' },
};

const getPayState = (employee) => {
  const slip = getCurrentMonthSlip(employee);
  if (!slip) return { ...PAY_STATES.todo, amount: Number(employee.salary) || 0, slip: null };
  const amount = Number(slip.netSalary) || 0;
  if (slip.status === 'paid') return { ...PAY_STATES.paid, amount, slip };
  return { ...PAY_STATES.due, amount, slip };
};

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
    if (await confirmDialog('Confirmer la suppression de cet employé ?')) {
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

  // ----- Paie du mois : qui doit être payé ? -----
  const payroll = useMemo(() => {
    const active = employees.filter(isEmployeeActive);
    const withState = active.map((employee) => ({ employee, state: getPayState(employee) }));
    const due = withState.filter(({ state }) => state.key === 'due');
    const todo = withState.filter(({ state }) => state.key === 'todo');
    const paid = withState.filter(({ state }) => state.key === 'paid');
    const sum = (list) => list.reduce((total, { state }) => total + state.amount, 0);

    return {
      active,
      due: [...due].sort((a, b) => b.state.amount - a.state.amount),
      todo: [...todo].sort((a, b) => b.state.amount - a.state.amount),
      paid,
      dueTotal: sum(due),
      todoTotal: sum(todo),
      paidTotal: sum(paid),
    };
  }, [employees]);

  const dashboardStats = useMemo(() => {
    const inactiveEmployees = employees.length - payroll.active.length;
    const totalSalary = payroll.active.reduce((sum, employee) => sum + Number(employee.salary || 0), 0);
    return {
      inactiveEmployees,
      totalSalary,
      averageSalary: payroll.active.length ? totalSalary / payroll.active.length : 0,
    };
  }, [employees, payroll]);

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
        const matchesPayroll =
          payrollFilter === 'all' || getPayState(employee).key === payrollFilter;

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

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const toPayCount = payroll.due.length + payroll.todo.length;

  if (loading) return (
    <Workspace className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
      <AppLoader fullScreen={false} text="Chargement..." />
    </Workspace>
  );

  if (error) return (
    <Workspace>
      <div className="rounded-[var(--radiusLarge)] px-4 py-3 fui-body1" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
        {error}
      </div>
    </Workspace>
  );

  return (
    <Workspace className="space-y-5">
      <PageHeader
        title="Gestion des employés"
        description="Employés, salaires, et suivi de la paie du mois."
        actions={
          <Button variant="primary" onClick={() => window.location.href = '/employees/new'}>
            <Plus className="h-4 w-4" /> Nouvel Employé
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <KPICard title="Actifs" value={payroll.active.length} context={`${dashboardStats.inactiveEmployees} inactif(s)`} tone="success" icon={<UserCheck className="h-4 w-4" />} />
        <KPICard title="Masse salariale" value={formatCfa(dashboardStats.totalSalary)} context={`Moyenne : ${formatCfa(dashboardStats.averageSalary)}`} tone="neutral" icon={<Banknote className="h-4 w-4" />} />
        <KPICard title="Salaires payés" value={`${payroll.paid.length}/${payroll.active.length}`} context={formatCfa(payroll.paidTotal)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <KPICard title="À payer" value={formatCfa(payroll.dueTotal)} context={`${payroll.due.length} fiche(s) en attente`} tone={payroll.due.length > 0 ? 'danger' : 'success'} icon={<HandCoins className="h-4 w-4" />} />
        <KPICard title="Fiches à créer" value={payroll.todo.length} context={`≈ ${formatCfa(payroll.todoTotal)}`} tone={payroll.todo.length > 0 ? 'warning' : 'success'} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      {/* ===== Paie du mois — qui doit être payé ===== */}
      <section className="ms-surface p-5" aria-label="Paie du mois">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="fui-subtitle1 flex items-center gap-2 capitalize" style={{ color: 'var(--colorNeutralForeground1)' }}>
              <UsersRound size={16} /> Paie de {monthLabel}
            </h2>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {toPayCount > 0
                ? `${toPayCount} salaire(s) à traiter — ${formatCfa(payroll.dueTotal + payroll.todoTotal)} au total`
                : 'Tous les salaires du mois sont réglés.'}
            </p>
          </div>
          {toPayCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {payroll.due.length > 0 && (
                <StatusBadge tone="danger">{payroll.due.length} à payer · {formatCfa(payroll.dueTotal)}</StatusBadge>
              )}
              {payroll.todo.length > 0 && (
                <StatusBadge tone="warning">{payroll.todo.length} fiche(s) à créer</StatusBadge>
              )}
            </div>
          )}
        </div>

        {toPayCount === 0 ? (
          <div
            className="mt-4 flex items-center gap-3 rounded-[var(--radiusLarge)] p-4"
            style={{ background: 'var(--colorStatusSuccessBackground1)', border: '1px solid var(--colorStatusSuccessStroke1)' }}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
            <p className="fui-caption1-strong" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
              {payroll.active.length > 0
                ? `Les ${payroll.paid.length} salaire(s) de ${monthLabel} sont payés.`
                : 'Aucun employé actif.'}
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y" style={{ borderColor: 'var(--colorNeutralStroke3)' }}>
            {[...payroll.due, ...payroll.todo].map(({ employee, state }) => (
              <li key={employee._id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link to={employeeBasePath(employee)} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border" style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}>
                    {employee.photo
                      ? <img src={employee.photo} alt={employee.name} className="h-full w-full object-cover" />
                      : <UserRound className="h-4 w-4" style={{ color: 'var(--colorNeutralForeground3)' }} />}
                  </div>
                  <span className="min-w-0">
                    <span className="fui-body1-strong block truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{employee.name}</span>
                    <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {employee.position || '—'}{employee.department ? ` · ${employee.department}` : ''}
                    </span>
                  </span>
                </Link>
                <span className="fui-body1-strong tabular-nums shrink-0" style={{ color: state.key === 'due' ? 'var(--colorStatusDangerForeground1)' : 'var(--colorNeutralForeground1)' }}>
                  {state.key === 'todo' ? '≈ ' : ''}{formatCfa(state.amount)}
                </span>
                <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                {state.key === 'due' ? (
                  <Link to={employeePayrollPath(employee)} className="ms-button ms-button-primary ms-button-sm shrink-0">
                    <HandCoins className="h-3.5 w-3.5" /> Payer
                  </Link>
                ) : (
                  <Link to={employeePayrollNewPath(employee)} className="ms-button ms-button-secondary ms-button-sm shrink-0">
                    <FileText className="h-3.5 w-3.5" /> Créer la fiche
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
              <option value="due">À payer</option>
              <option value="todo">Fiche à créer</option>
              <option value="paid">Payée</option>
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
                <th>Paie du mois</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(employee => {
                  const payState = getPayState(employee);
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
                    <td className="font-semibold text-[var(--ms-text)]">{formatCfa(employee.salary)}</td>
                    <td>{active ? <StatusBadge tone={payState.tone}>{payState.label}</StatusBadge> : <span className="text-[var(--ms-text-muted)]">—</span>}</td>
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
            const payState = getPayState(employee);
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
                    <div className="flex flex-wrap gap-2 mt-1">
                      <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Actif' : 'Ne travaille plus'}</StatusBadge>
                      {active && <StatusBadge tone={payState.tone}>{payState.label}</StatusBadge>}
                    </div>
                    <div className="text-sm text-[var(--ms-text-muted)] mt-1">{employee.position}</div>
                    <div className="text-sm text-[var(--ms-text-muted)]">{employee.email}</div>
                    <div className="text-sm text-[var(--ms-text-muted)]">{employee.department || 'N/A'}</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--ms-text)]">{formatCfa(employee.salary)}</div>
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
