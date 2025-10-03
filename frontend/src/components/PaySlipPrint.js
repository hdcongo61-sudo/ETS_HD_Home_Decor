import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PaySlipPrint = () => {
    const { id, payslipId } = useParams();
    const navigate = useNavigate();
    const [paySlip, setPaySlip] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
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
        if (!loading && !error) {
            window.print();
        }
    }, [loading, error]);

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

            const monthName = new Date(paySlip.year, paySlip.month - 1, 1)
                .toLocaleDateString('fr-FR', { month: 'long' });

            pdf.save(`fiche-paie-${employee.name}-${monthName}-${paySlip.year}.pdf`);
            setLoading(false);
        }).catch(err => {
            console.error('Erreur lors de la génération du PDF:', err);
            setError('Erreur lors de la génération du PDF');
            setLoading(false);
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 mx-4">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
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
                        .payslip-container {
                            padding: 1.5rem !important;
                            border: none !important;
                            box-shadow: none !important;
                        }
                    }
                `}
            </style>

            {/* Bouton Retour et actions */}
            <div className="no-print mb-6 flex flex-wrap justify-between items-center gap-4">
                <button
                    onClick={() => navigate(`/employees/${id}/payroll`)}
                    className="flex items-center text-blue-600 hover:text-blue-800 px-4 py-2 bg-blue-50 rounded-lg"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Retour aux fiches de paie
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center text-purple-600 hover:text-purple-800 px-4 py-2 bg-purple-50 rounded-lg"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Télécharger PDF
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="flex items-center text-green-600 hover:text-green-800 px-4 py-2 bg-green-50 rounded-lg"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimer
                    </button>
                </div>
            </div>

            {/* Contenu de la fiche de paie */}
            <div className="payslip-container bg-white border border-gray-200 rounded-lg shadow-sm p-8">
                {/* En-tête avec informations de la boutique */}
                <div className="mb-8 text-center border-b pb-4">
                    <div className="flex justify-center mb-2">
                        <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />
                    </div>
                    <h1 className="text-xl font-bold">ETS HD Home Decor</h1>
                    <div className="flex flex-col md:flex-row justify-center gap-3 md:gap-6 mt-2 text-sm text-gray-600">
                        <div className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>+242 06 982 2930</span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>hdcongo61@gmail.com</span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>61 rue Lénine, Moungali</span>
                        </div>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold">FICHE DE PAIE</h1>
                    <div className="text-sm text-gray-600">
                        {new Date(paySlip.year, paySlip.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <h2 className="font-bold mb-2 border-b pb-1">INFORMATIONS EMPLOYÉ</h2>
                        <div className="space-y-2">
                            <div><span className="font-medium">Nom:</span> {employee.name}</div>
                            <div><span className="font-medium">Poste:</span> {employee.position}</div>
                            <div><span className="font-medium">Département:</span> {employee.department}</div>
                            <div><span className="font-medium">Date d'embauche:</span> {new Date(employee.hireDate).toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>

                    <div>
                        <h2 className="font-bold mb-2 border-b pb-1">INFORMATIONS PAIE</h2>
                        <div className="space-y-2">
                            <div><span className="font-medium">Date de paiement:</span> {new Date(paySlip.paymentDate).toLocaleDateString('fr-FR')}</div>
                            <div><span className="font-medium">Période:</span> Du 1er au {new Date(paySlip.year, paySlip.month, 0).getDate()} {new Date(paySlip.year, paySlip.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}</div>
                            <div><span className="font-medium">Référence:</span> {paySlip._id.slice(-8).toUpperCase()}</div>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="font-bold mb-2 border-b pb-1">DÉTAILS DE LA PAIE</h2>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2 text-left border">Description</th>
                                <th className="p-2 text-right border">Montant (CFA)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-2 border">Salaire de base</td>
                                <td className="p-2 border text-right">{new Intl.NumberFormat('fr-FR').format(paySlip.baseSalary)}</td>
                            </tr>

                            {paySlip.bonuses > 0 && (
                                <tr className="border-b">
                                    <td className="p-2 border">Bonus</td>
                                    <td className="p-2 border text-right text-green-600">+ {new Intl.NumberFormat('fr-FR').format(paySlip.bonuses)}</td>
                                </tr>
                            )}

                            {paySlip.deductions > 0 && (
                                <tr className="border-b">
                                    <td className="p-2 border">Déductions</td>
                                    <td className="p-2 border text-right text-red-600">- {new Intl.NumberFormat('fr-FR').format(paySlip.deductions)}</td>
                                </tr>
                            )}

                            <tr className="bg-gray-50 font-bold">
                                <td className="p-2 border">Salaire net</td>
                                <td className="p-2 border text-right">{new Intl.NumberFormat('fr-FR').format(paySlip.netSalary)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {paySlip.notes && (
                    <div className="mb-8">
                        <h2 className="font-bold mb-2 border-b pb-1">NOTES</h2>
                        <div className="p-3 bg-gray-50 rounded border border-gray-200">{paySlip.notes}</div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <div className="text-center">
                        <div className="border-t border-gray-300 pt-4 mt-8 mx-8">
                            <div className="text-sm text-gray-500">Signature employé</div>
                            <div className="mt-2 text-xs text-gray-400">Date: {new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-gray-300 pt-4 mt-8 mx-8">
                            <div className="text-sm text-gray-500">Signature employeur</div>
                            <div className="mt-2 text-xs text-gray-400">Date: {new Date().toLocaleDateString('fr-FR')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="no-print mt-8 text-center text-sm text-gray-500">
                <p>Document généré le {new Date().toLocaleDateString('fr-FR')} - © {new Date().getFullYear()} Système de Gestion des Fiches de Paie</p>
            </div>
        </div>
    );
};

export default PaySlipPrint;