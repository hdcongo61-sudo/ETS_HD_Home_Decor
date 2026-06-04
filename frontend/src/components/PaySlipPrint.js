import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { employeePayrollPath } from '../utils/paths';

const PaySlipPrint = () => {
    const { id, payslipId } = useParams();
    const navigate = useNavigate();
    const [paySlip, setPaySlip] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const employeeReference = employee || { _id: id };
    const formatMoney = (value) => `${new Intl.NumberFormat('fr-FR').format(Number(value) || 0)} CFA`;
    const periodLabel = paySlip
        ? new Date(paySlip.year, paySlip.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        : '';

    useEffect(() => {
        const fetchData = async () => {
            if (!payslipId || payslipId === 'undefined') {
                setError("Cette fiche de paie est introuvable. L'identifiant de la fiche est manquant.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data: employeeData } = await api.get(`/employees/${id}`);
                setEmployee(employeeData);

                const { data: payslipData } = await api.get(`/employees/${id}/payroll/${payslipId}`);
                setPaySlip(payslipData);
                setError('');
            } catch (err) {
                setError(err.response?.data?.message || 'Erreur de chargement des données');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, payslipId]);

    useEffect(() => {
        if (!loading && !error && paySlip) {
            window.print();
        }
    }, [loading, error, paySlip]);

    const handleDownloadPDF = () => {
        const input = document.querySelector('.payslip-container');
        if (!input) return;

        setLoading(true);

        html2canvas(input, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#FFFFFF'
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`fiche-paie-${employee.name}-${periodLabel}-${paySlip.year}.pdf`);
            setLoading(false);
        }).catch(err => {
            console.error('Erreur lors de la génération du PDF:', err);
            setError('Erreur lors de la génération du PDF');
            setLoading(false);
        });
    };

    if (loading) {
        return (
            <div className="flex min-h-[55vh] items-center justify-center bg-[#f6f7f9]">
                <svg className="h-8 w-8 animate-spin text-[var(--ms-text)]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-8 rounded-lg border border-red-100 bg-[var(--ms-danger)]/10 p-5 text-[var(--ms-danger)] shadow-[var(--ms-shadow-sm)]">
                <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                    <div className="min-w-0">
                        <p className="font-semibold">Impossible d'ouvrir la fiche de paie</p>
                        <p className="mt-1 text-sm">{error}</p>
                        <button
                            type="button"
                            onClick={() => navigate(employeePayrollPath(employeeReference))}
                            className="mt-4 inline-flex min-h-[42px] items-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Retour aux fiches
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f7f9] px-3 py-4 sm:px-5 lg:px-8">
            {/* Global print styles */}
            <style>
                {`
                    @media print {
                        body {
                            background: white !important;
                            font-size: 12pt;
                            padding: 0;
                            margin: 0;
                        }
                        .no-print {
                            display: none !important;
                        }
                        @page {
                            margin: 1cm;
                        }
                        .print-shell {
                            padding: 0 !important;
                            background: white !important;
                        }
                        .payslip-container {
                            padding: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                        }
                    }
                `}
            </style>

            {/* Bouton Retour et actions */}
            <div className="no-print mb-5 flex flex-col gap-3 rounded-lg border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <button
                    onClick={() => navigate(employeePayrollPath(employeeReference))}
                    className="inline-flex min-h-[44px] w-fit items-center rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-4 py-2 text-sm font-semibold text-[var(--ms-text)] transition hover:bg-[var(--ms-white)] hover:text-[var(--ms-text-strong)]"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Retour aux fiches de paie
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-2 text-sm font-semibold text-[var(--ms-text)] shadow-[var(--ms-shadow-sm)] transition hover:bg-[var(--ms-bg-subtle)]"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Télécharger PDF
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="inline-flex min-h-[44px] items-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-gray-800"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimer
                    </button>
                </div>
            </div>

            {/* Contenu de la fiche de paie */}
            <div className="print-shell max-w-5xl">
            <div className="payslip-container overflow-hidden rounded-lg border border-white/80 bg-[var(--ms-white)] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                {/* En-tête avec informations de la boutique */}
                <div className="border-b border-[var(--ms-border)] bg-gray-950 px-6 py-6 text-white sm:px-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">Bulletin de salaire</p>
                            <h1 className="mt-2 text-2xl font-bold tracking-tight">ETS HD Home Decor</h1>
                            <p className="mt-1 text-sm text-gray-300">Document officiel de paie</p>
                        </div>
                        <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-left text-sm text-gray-200">
                            <p className="font-semibold text-white">Période</p>
                            <p className="capitalize">{periodLabel}</p>
                            <p className="mt-1 text-xs">Réf. {paySlip._id.slice(-8).toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-2 text-sm text-gray-300 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>+242 06 982 2930</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>hdcongo61@gmail.com</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>61 rue Lénine, Moungali</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8">
                <div className="mb-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Salaire net</p>
                        <p className="mt-2 text-2xl font-bold text-[var(--ms-text-strong)]">{formatMoney(paySlip.netSalary)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Salaire de base</p>
                        <p className="mt-2 text-xl font-semibold text-[var(--ms-text-strong)]">{formatMoney(paySlip.baseSalary)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Date paiement</p>
                        <p className="mt-2 text-xl font-semibold text-[var(--ms-text-strong)]">{new Date(paySlip.paymentDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="rounded-lg border border-[var(--ms-border)] p-5">
                        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--ms-text-strong)]">Informations employé</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Nom</span><span className="font-semibold text-[var(--ms-text-strong)]">{employee.name}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Poste</span><span className="font-semibold text-[var(--ms-text-strong)]">{employee.position || '—'}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Département</span><span className="font-semibold text-[var(--ms-text-strong)]">{employee.department || '—'}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Date d'embauche</span><span className="font-semibold text-[var(--ms-text-strong)]">{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : '—'}</span></div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-[var(--ms-border)] p-5">
                        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--ms-text-strong)]">Informations paie</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Date de paiement</span><span className="font-semibold text-[var(--ms-text-strong)]">{new Date(paySlip.paymentDate).toLocaleDateString('fr-FR')}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Période</span><span className="font-semibold text-[var(--ms-text-strong)]">Du 1er au {new Date(paySlip.year, paySlip.month, 0).getDate()} {new Date(paySlip.year, paySlip.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Référence</span><span className="font-mono font-semibold text-[var(--ms-text-strong)]">{paySlip._id.slice(-8).toUpperCase()}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-[var(--ms-text-muted)]">Statut</span><span className="font-semibold capitalize text-[var(--ms-text-strong)]">{paySlip.status || '—'}</span></div>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--ms-text-strong)]">Détails de la paie</h2>
                    <table className="w-full overflow-hidden rounded-lg border border-[var(--ms-border)] text-sm">
                        <thead>
                            <tr className="bg-[var(--ms-bg-subtle)]">
                                <th className="p-3 text-left font-semibold text-[var(--ms-text)]">Description</th>
                                <th className="p-3 text-right font-semibold text-[var(--ms-text)]">Montant</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td className="p-3 text-[var(--ms-text)]">Salaire de base</td>
                                <td className="p-3 text-right font-semibold text-[var(--ms-text-strong)]">{formatMoney(paySlip.baseSalary)}</td>
                            </tr>

                            {paySlip.bonuses > 0 && (
                                <tr className="border-b">
                                    <td className="p-3 text-[var(--ms-text)]">Bonus</td>
                                    <td className="p-3 text-right font-semibold text-[var(--ms-success)]">+ {formatMoney(paySlip.bonuses)}</td>
                                </tr>
                            )}

                            {paySlip.deductions > 0 && (
                                <tr className="border-b">
                                    <td className="p-3 text-[var(--ms-text)]">Déductions</td>
                                    <td className="p-3 text-right font-semibold text-[var(--ms-danger)]">- {formatMoney(paySlip.deductions)}</td>
                                </tr>
                            )}

                            <tr className="bg-gray-950 font-bold text-white">
                                <td className="p-3">Salaire net</td>
                                <td className="p-3 text-right">{formatMoney(paySlip.netSalary)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {paySlip.notes && (
                    <div className="mb-8">
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--ms-text-strong)]">Notes</h2>
                        <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 text-sm text-[var(--ms-text)]">{paySlip.notes}</div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <div className="text-center">
                        <div className="border-t border-[var(--ms-border-strong)] pt-4 mt-8 mx-8">
                            <div className="text-sm text-[var(--ms-text-muted)]">Signature employé</div>
                            <div className="mt-2 text-xs text-[var(--ms-text-muted)]">Date: {new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-[var(--ms-border-strong)] pt-4 mt-8 mx-8">
                            <div className="text-sm text-[var(--ms-text-muted)]">Signature employeur</div>
                            <div className="mt-2 text-xs text-[var(--ms-text-muted)]">Date: {new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                </div>
                </div>
            </div>
            </div>

            <div className="no-print mt-8 text-center text-sm text-[var(--ms-text-muted)]">
                <p>Document généré le {new Date().toLocaleDateString('fr-FR')} - © {new Date().getFullYear()} Système de Gestion des Fiches de Paie</p>
            </div>
        </div>
    );
};

export default PaySlipPrint;
