import React, { useState, useEffect } from 'react';

const PaymentModal = ({ show, onClose, sale, onAddPayment }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [error, setError] = useState('');

    // Reset form when modal is opened
    useEffect(() => {
        if (show) {
            setAmount('');
            setMethod('cash');
            setError('');
        }
    }, [show]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const paymentAmount = parseFloat(amount);

        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            setError('Montant invalide');
            return;
        }

        if (paymentAmount > sale.balance) {
            setError(`Le montant ne peut pas dépasser le solde restant (${sale.balance.toFixed(2)} CFA)`);
            return;
        }

        onAddPayment({
            amount: paymentAmount,
            method
        });
    };

    if (!show || !sale) return null;

    // Calculate payment info directly
    const totalPaid = sale.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const balance = sale.totalAmount - totalPaid;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md border border-gray-200 shadow-xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Ajouter un paiement
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {/* Payment Summary */}
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-sm text-gray-600">Client:</div>
                            <div className="text-sm font-medium text-gray-900">{sale.client?.name || 'Non spécifié'}</div>

                            <div className="text-sm text-gray-600">Total:</div>
                            <div className="text-sm font-semibold text-gray-900">{sale.totalAmount?.toFixed()} CFA</div>

                            <div className="text-sm text-gray-600">Déjà payé:</div>
                            <div className="text-sm font-medium text-green-600">{totalPaid.toFixed()} CFA</div>

                            <div className="text-sm text-gray-600">Solde restant:</div>
                            <div className={`text-sm font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {balance.toFixed()} CFA
                            </div>
                        </div>

                        {sale.payments?.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700 mb-3">Historique des paiements:</h3>
                                <div className="space-y-3 max-h-40 overflow-y-auto">
                                    {sale.payments.map((payment, index) => (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${
                                                    payment.method === 'cash' ? 'bg-blue-100' :
                                                    payment.method === 'MobileMoney' ? 'bg-green-100' :
                                                    'bg-purple-100'
                                                }`}>
                                                    <svg className="w-3.5 h-3.5 ${
                                                        payment.method === 'cash' ? 'text-blue-600' :
                                                        payment.method === 'MobileMoney' ? 'text-green-600' :
                                                        'text-purple-600'
                                                    }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2  11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <span className="capitalize">
                                                    {payment.method === 'MobileMoney' ? 'Mobile Money' : payment.method}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                    {new Date(payment.paymentDate).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                            <div className="font-medium text-green-600">
                                                {payment.amount.toFixed()} CFA
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-5">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Montant à payer</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={balance}
                                    value={amount}
                                    onChange={(e) => {
                                        setAmount(e.target.value);
                                        setError('');
                                    }}
                                    className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="0.00"
                                    required
                                />
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-sm">CFA</span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Méthode de paiement</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['cash', 'MobileMoney', 'credit'].map((methodOption) => (
                                    <button
                                        key={methodOption}
                                        type="button"
                                        onClick={() => setMethod(methodOption)}
                                        className={`p-3 rounded-xl border transition-all duration-200 ${
                                            method === methodOption
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                                : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className={`p-2 rounded-lg ${
                                                methodOption === 'cash' ? 'bg-blue-100' :
                                                methodOption === 'MobileMoney' ? 'bg-green-100' :
                                                'bg-purple-100'
                                            }`}>
                                                <svg className="w-4 h-4 ${
                                                    methodOption === 'cash' ? 'text-blue-600' :
                                                    methodOption === 'MobileMoney' ? 'text-green-600' :
                                                    'text-purple-600'
                                                }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                            <span className="text-xs font-medium">
                                                {methodOption === 'cash' ? 'Espèces' :
                                                 methodOption === 'MobileMoney' ? 'Mobile Money' :
                                                 'Crédit'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="mb-5 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;