import { confirmDialog } from './ConfirmProvider';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Printer,
  Trash2,
  BarChart3,
  Banknote,
  Minus,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import {
  employeeBasePath,
  employeePayrollNewPath,
  employeePayrollPayslipEditPath,
  employeePayrollPayslipPrintPath,
} from '../utils/paths';
import AppLoader from './AppLoader';
import {
  Button,
  CommandBar,
  DataTable,
  EmptyState,
  KPICard,
  PageHeader,
  StatusBadge,
  Surface,
  Workspace,
} from './business';

const STATUS_TONE = { pending: 'warning', paid: 'success', cancelled: 'danger' };
const STATUS_LABEL = { pending: 'En attente', paid: 'Payé', cancelled: 'Annulé' };

const fmt = (v) => new Intl.NumberFormat('fr-FR').format(Number(v) || 0);
const formatPeriod = (month, year) =>
  new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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

  const handleEdit = (payslipId) => navigate(employeePayrollPayslipEditPath(employeeReference, payslipId));
  const handlePrint = (payslipId) => navigate(employeePayrollPayslipPrintPath(employeeReference, payslipId));
  const handleDelete = async (payslipId) => {
    if (await confirmDialog('Confirmer la suppression de cette fiche de paie ?')) {
      try {
        await api.delete(`/employees/${id}/payroll/${payslipId}`);
        setPaySlips((prev) => prev.filter((slip) => slip._id !== payslipId));
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const filteredPaySlips = paySlips.filter((slip) => {
    const matchesMonth = selectedMonth === 'all' || slip.month === selectedMonth;
    const matchesYear = slip.year === selectedYear;
    const matchesStatus = selectedStatus === 'all' || slip.status === selectedStatus;
    return matchesMonth && matchesYear && matchesStatus;
  });

  const totals = filteredPaySlips.reduce(
    (acc, slip) => ({
      base: acc.base + (slip.baseSalary || 0),
      deductions: acc.deductions + (slip.deductions || 0),
      net: acc.net + (slip.netSalary || 0),
    }),
    { base: 0, deductions: 0, net: 0 }
  );

  const periodLabel =
    selectedMonth === 'all'
      ? `Année ${selectedYear}`
      : new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <Workspace className="flex items-center justify-center min-h-[60vh]">
        <AppLoader fullScreen={false} text="Chargement des fiches de paie…" />
      </Workspace>
    );
  }

  if (error) {
    return (
      <Workspace>
        <EmptyState
          title="Erreur de chargement"
          description={error}
          action={
            <Button variant="secondary" size="md" onClick={() => setReloadToken((v) => v + 1)}>
              <RefreshCw className="h-4 w-4" /> Réessayer
            </Button>
          }
        />
      </Workspace>
    );
  }

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Paie"
        title="Fiches de paie"
        description={[employee?.name, [employee?.position, employee?.department].filter(Boolean).join(' · ')]
          .filter(Boolean)
          .join(' — ')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={() => navigate(employeeBasePath(employeeReference))}>
              <ArrowLeft className="h-4 w-4" /> Profil
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowSummary((v) => !v)}>
              <BarChart3 className="h-4 w-4" /> {showSummary ? 'Masquer résumé' : 'Afficher résumé'}
            </Button>
            <Link to={employeePayrollNewPath(employeeReference)} className="ms-button ms-button-primary ms-button-md">
              <Plus className="h-4 w-4" /> Nouvelle fiche
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <CommandBar>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1 min-w-[160px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Mois</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
              className="form-control mt-1 text-sm"
            >
              <option value="all">Tous les mois</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[140px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Année</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="form-control mt-1 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-[160px]">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Statut</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-control mt-1 text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="paid">Payé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </label>
        </div>
      </CommandBar>

      {/* Monthly summary */}
      {showSummary && filteredPaySlips.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--ms-text-strong)]">Résumé — {periodLabel}</h3>
            <span className="text-xs text-[var(--ms-text-muted)]">{filteredPaySlips.length} fiche(s)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KPICard title="Total salaire brut" value={`${fmt(totals.base)} CFA`} tone="brand" icon={<Banknote className="h-4 w-4" />} />
            <KPICard title="Total déductions" value={`${fmt(totals.deductions)} CFA`} tone="danger" icon={<Minus className="h-4 w-4" />} />
            <KPICard title="Total salaire net" value={`${fmt(totals.net)} CFA`} tone="success" icon={<Wallet className="h-4 w-4" />} />
          </div>
        </div>
      )}

      {/* Pay slips */}
      <Surface className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--ms-border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--ms-text-strong)]">
            Fiches de paie ({filteredPaySlips.length})
          </h3>
        </div>

        {filteredPaySlips.length === 0 ? (
          <EmptyState
            title="Aucune fiche de paie"
            description={`Aucune fiche trouvée pour ${periodLabel.toLowerCase()}.`}
            action={
              <Link to={employeePayrollNewPath(employeeReference)} className="ms-button ms-button-primary ms-button-md">
                <Plus className="h-4 w-4" /> Créer une fiche
              </Link>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filteredPaySlips.map((slip) => (
                <div key={slip._id} className="ms-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ms-text-strong)] capitalize">
                        {formatPeriod(slip.month, slip.year)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ms-text-muted)]">
                        Net : <span className="font-semibold text-[var(--ms-blue)]">{fmt(slip.netSalary)} CFA</span>
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_TONE[slip.status] || 'neutral'}>
                      {STATUS_LABEL[slip.status] || slip.status}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)] p-2.5">
                      <p className="text-[var(--ms-text-muted)]">Salaire de base</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-text-strong)]">{fmt(slip.baseSalary)} CFA</p>
                    </div>
                    <div className="rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)] p-2.5">
                      <p className="text-[var(--ms-text-muted)]">Primes</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-success)]">+ {fmt(slip.bonuses)} CFA</p>
                    </div>
                    <div className="rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)] p-2.5">
                      <p className="text-[var(--ms-text-muted)]">Déductions</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-danger)]">- {fmt(slip.deductions)} CFA</p>
                    </div>
                    <div className="rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)] p-2.5">
                      <p className="text-[var(--ms-text-muted)]">Créé le</p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--ms-text-strong)]">
                        {slip.createdAt ? new Date(slip.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button variant="secondary" size="sm" className="justify-center" onClick={() => handleEdit(slip._id)}>
                      <Pencil className="h-4 w-4" /> Modifier
                    </Button>
                    <Button variant="secondary" size="sm" className="justify-center" onClick={() => handlePrint(slip._id)}>
                      <Printer className="h-4 w-4" /> Imprimer
                    </Button>
                    <button
                      onClick={() => handleDelete(slip._id)}
                      className="ms-button ms-button-secondary ms-button-sm justify-center text-[var(--ms-danger)]"
                    >
                      <Trash2 className="h-4 w-4" /> Suppr.
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <DataTable>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th>Salaire de base</th>
                      <th>Déductions</th>
                      <th>Primes</th>
                      <th>Salaire net</th>
                      <th>Statut</th>
                      <th className="!text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPaySlips.map((slip) => (
                      <tr key={slip._id}>
                        <td className="font-medium text-[var(--ms-text-strong)] capitalize">{formatPeriod(slip.month, slip.year)}</td>
                        <td className="text-[var(--ms-text)]">{fmt(slip.baseSalary)} CFA</td>
                        <td className="text-[var(--ms-danger)]">- {fmt(slip.deductions)} CFA</td>
                        <td className="text-[var(--ms-success)]">+ {fmt(slip.bonuses)} CFA</td>
                        <td className="font-semibold text-[var(--ms-text-strong)]">{fmt(slip.netSalary)} CFA</td>
                        <td>
                          <StatusBadge tone={STATUS_TONE[slip.status] || 'neutral'}>
                            {STATUS_LABEL[slip.status] || slip.status}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEdit(slip._id)} className="ms-icon-button" title="Modifier"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handlePrint(slip._id)} className="ms-icon-button" title="Imprimer"><Printer className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(slip._id)} className="ms-icon-button text-[var(--ms-danger)]" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </div>
          </>
        )}
      </Surface>
    </Workspace>
  );
};

export default PaySlipList;
