import React, { useContext } from 'react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const DayDetailsModal = ({ date, sales = [], expenses = [], payments = [], onClose }) => {
    const { auth } = useContext(AuthContext);
    const isAdmin = Boolean(auth?.user?.isAdmin);

    const formatCurrency = (value) => {
        if (value === null || value === undefined) return "0 CFA";
        const num = typeof value === 'number' ? value : Number(value);
        if (isNaN(num)) return "0 CFA";
        return `${num.toLocaleString('fr-FR')} CFA`;
    };

    const safeFormatDate = (dateString, formatStr = 'dd MMMM yyyy') => {
        try {
            const dateObj = new Date(dateString);
            return isValid(dateObj) ? format(dateObj, formatStr, { locale: fr }) : 'Date invalide';
        } catch (error) {
            return 'Date invalide';
        }
    };

    const safeFormatTime = (dateString) => {
        return safeFormatDate(dateString, 'HH:mm');
    };

    const getDaySalesTotal = () => {
        if (!sales || !Array.isArray(sales)) return 0;
        return sales.reduce((sum, sale) => {
            const amount = sale?.totalAmount || 0;
            return sum + (typeof amount === 'number' ? amount : 0);
        }, 0);
    };

    const getDayExpensesTotal = () => {
        if (!expenses || !Array.isArray(expenses)) return 0;
        return expenses.reduce((sum, expense) => {
            const amount = expense?.amount || 0;
            return sum + (typeof amount === 'number' ? amount : 0);
        }, 0);
    };

    const getDayPaymentsTotal = () => {
        if (!payments || !Array.isArray(payments)) return 0;
        return payments.reduce((sum, payment) => {
            const amount = payment?.amount || 0;
            return sum + (typeof amount === 'number' ? amount : 0);
        }, 0);
    };

    const formatDateForLink = (dateString) => {
        try {
            const d = new Date(dateString);
            return isValid(d) 
                ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                : '';
        } catch (error) {
            return '';
        }
    };

    const generateUniqueKey = (item, type, index) => {
        return item._id || `${type}-${item.saleNumber || item.description || index}-${item.createdAt || Date.now()}`;
    };

    // Calculs sécurisés
    const salesTotal = getDaySalesTotal();
    const expensesTotal = getDayExpensesTotal();
    const paymentsTotal = getDayPaymentsTotal();
    const profit = paymentsTotal - expensesTotal;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/80">
                {/* En-tête */}
                <div className="flex justify-between items-center p-6 bg-gray-50/50 border-b border-gray-200">
                    <div>
                        <h2 id="modal-title" className="text-2xl font-semibold text-gray-900">
                            Détails du {safeFormatDate(date)}
                        </h2>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true"></div>
                                <span className="text-gray-700">
                                    Ventes: <span className="font-medium text-gray-900">{formatCurrency(salesTotal)}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true"></div>
                                <span className="text-gray-700">
                                    Encaissements: <span className="font-medium text-gray-900">{formatCurrency(paymentsTotal)}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></div>
                                <span className="text-gray-700">
                                    Dépenses: <span className="font-medium text-gray-900">{formatCurrency(expensesTotal)}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-purple-500" aria-hidden="true"></div>
                                <span className="text-gray-700">
                                    Profit: <span className="font-medium text-gray-900">{formatCurrency(profit)}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:bg-gray-200/50 p-2 rounded-full transition-colors"
                        aria-label="Fermer la modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Contenu */}
                <div className="overflow-auto flex-grow p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Section Ventes */}
                        <div>
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                    <div className="p-1.5 bg-green-100 rounded-lg" aria-hidden="true">
                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    Ventes ({(sales || []).length})
                                </h3>
                                <Link
                                    to={`/sales?date=${formatDateForLink(date)}`}
                                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                                >
                                    <span>Toutes les ventes</span>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>

                            {(!sales || sales.length === 0) ? (
                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-gray-200">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                    </svg>
                                    <p className="text-gray-500">Aucune vente pour cette journée</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sales.map((sale, index) => {
                                        const paidAmount = sale.payments?.reduce(
                                            (sum, payment) => sum + (payment.amount || 0),
                                            0
                                        ) || 0;

                                        return (
                                            <div key={generateUniqueKey(sale, 'sale', index)} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            Vente #{sale.saleNumber || `T${index + 1}`}
                                                        </div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {sale.client?.name || 'Client non spécifié'}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-green-600 font-semibold">
                                                            {formatCurrency(sale.totalAmount || 0)}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {safeFormatTime(sale.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Affichage des produits */}
                                                {sale.products && sale.products.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <div className="text-xs font-medium text-gray-600 mb-2">Produits vendus:</div>
                                                        <ul className="space-y-2">
                                                            {sale.products.map((item, i) => {
                                                                const productName = item.product?.name ||
                                                                    (item.productId?.name ? item.productId.name : 'Produit sans nom');
                                                                const price = item.priceAtSale || item.sellingPrice || 0;
                                                                const quantity = item.quantity || 1;

                                                                return (
                                                                    <li key={`product-${i}-${item.productId || i}`} className="flex justify-between text-sm">
                                                                        <div className="truncate max-w-[70%] text-gray-700">
                                                                            {quantity} × {productName}
                                                                        </div>
                                                                        <div className="font-medium text-gray-900">
                                                                            {formatCurrency(price * quantity)}
                                                                        </div>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Paiements */}
                                                {sale.payments?.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <div className="flex justify-between items-center">
                                                            <div className="text-xs font-medium text-gray-600">Paiements:</div>
                                                            <div className="text-xs">
                                                                <span className="text-green-600">Payé: {formatCurrency(paidAmount)}</span>
                                                                {sale.totalAmount && paidAmount < sale.totalAmount && (
                                                                    <span className="text-orange-600 ml-2">
                                                                        Reste: {formatCurrency(sale.totalAmount - paidAmount)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <ul className="space-y-2 mt-2">
                                                            {sale.payments.map((payment, i) => (
                                                                <li key={`payment-${i}-${payment._id || i}`} className="flex justify-between text-sm">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="capitalize text-gray-700">{payment.method || 'Non spécifié'}</span>
                                                                        {payment.reference && (
                                                                            <span className="text-xs text-gray-400">({payment.reference})</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="font-medium text-gray-900">
                                                                        {formatCurrency(payment.amount || 0)}
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Notes */}
                                                {sale.notes && (
                                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                                        <div className="text-xs font-medium text-gray-600 mb-1">Notes:</div>
                                                        <p className="text-sm text-gray-700">{sale.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section Dépenses */}
                        <div>
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                    <div className="p-1.5 bg-red-100 rounded-lg" aria-hidden="true">
                                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    Dépenses ({(expenses || []).length})
                                </h3>
                                {isAdmin ? (
                                    <Link
                                        to={`/expenses?date=${formatDateForLink(date)}`}
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <span>Toutes les dépenses</span>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                ) : (
                                    <span
                                        className="text-gray-400 text-sm flex items-center gap-1 cursor-not-allowed"
                                        role="link"
                                        aria-disabled="true"
                                    >
                                        <span>Toutes les dépenses</span>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </span>
                                )}
                            </div>

                            {(!expenses || expenses.length === 0) ? (
                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-gray-200">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-gray-500">Aucune dépense pour cette journée</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {expenses.map((expense, index) => (
                                        <div key={generateUniqueKey(expense, 'expense', index)} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        {expense.description || 'Dépense sans description'}
                                                    </div>
                                                    <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                                                        <span className="bg-gray-100 px-2 py-1 rounded-lg text-xs capitalize">
                                                            {expense.category || 'Non catégorisé'}
                                                        </span>
                                                        {expense.supplier && (
                                                            <span className="text-xs">Fourn.: {expense.supplier}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-red-600 font-semibold">
                                                        {formatCurrency(expense.amount || 0)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {safeFormatTime(expense.createdAt)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            {expense.notes && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="text-xs font-medium text-gray-600 mb-1">Notes:</div>
                                                    <p className="text-sm text-gray-700">{expense.notes}</p>
                                                </div>
                                            )}

                                            {/* Documents */}
                                            {expense.documentUrl && (
                                                <div className="mt-3 pt-3 border-t border-gray-100">
                                                    <div className="text-xs font-medium text-gray-600 mb-1">Document:</div>
                                                    <a
                                                        href={expense.documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        Voir le document
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Section Encaissements */}
                        <div>
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                    <div className="p-1.5 bg-blue-100 rounded-lg" aria-hidden="true">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016" />
                                        </svg>
                                    </div>
                                    Encaissements ({(payments || []).length})
                                </h3>
                            </div>

                            {(!payments || payments.length === 0) ? (
                                <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-gray-200">
                                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <p className="text-gray-500">Aucun encaissement pour cette journée</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {payments.map((payment, index) => (
                                        <div key={generateUniqueKey(payment, 'payment', index)} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-gray-900">
                                                        Paiement #{index + 1}
                                                    </div>
                                                    <div className="text-sm text-gray-600 mt-1">
                                                        {payment.client?.name || 'Client non spécifié'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {payment.saleId ? (
                                                            <Link
                                                                to={`/sales/${payment.saleId}`}
                                                                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                                            >
                                                                <span>
                                                                    {`Vente #${payment.saleNumber || String(payment.saleId).slice(-6) || 'N/A'}`}
                                                                </span>
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                </svg>
                                                            </Link>
                                                        ) : (
                                                            <span>Vente #{payment.saleNumber || 'N/A'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-blue-600 font-semibold">
                                                        {formatCurrency(payment.amount || 0)}
                                                    </div>
                                                    <div className="text-xs text-gray-500 capitalize">
                                                        {payment.method}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {safeFormatTime(payment.paymentDate)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="text-xs font-medium text-gray-600 mb-2">Détails:</div>
                                                <div className="text-sm text-gray-700">
                                                    <span className="font-medium">Date vente:</span> {safeFormatDate(payment.createdAt, 'dd/MM/yyyy')}
                                                </div>
                                                <div className="text-sm text-gray-700 mt-1">
                                                    <span className="font-medium">Date paiement:</span> {safeFormatDate(payment.paymentDate, 'dd/MM/yyyy')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pied de page */}
                <div className="border-t border-gray-200 p-6 bg-gray-50/50 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        {((sales?.length || 0) + (expenses?.length || 0) + (payments?.length || 0))} transactions au total
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to={`/sales?date=${formatDateForLink(date)}`}
                            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-300 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Ventes
                        </Link>
                        {isAdmin ? (
                            <Link
                                to={`/expenses?date=${formatDateForLink(date)}`}
                                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-300 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Dépenses
                            </Link>
                        ) : (
                            <span
                                className="bg-white text-gray-400 px-4 py-2.5 rounded-xl border border-gray-200 transition-colors flex items-center gap-2 cursor-not-allowed"
                                aria-disabled="true"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Dépenses
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-xl transition-colors"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DayDetailsModal;
