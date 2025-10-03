import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const PaySlipFormEdit = () => {
    const { id, payslipId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        month: '',
        year: '',
        deductions: 0,
        bonuses: 0,
        notes: '',
        status: 'approved'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setNotFound(false);

                // Load employee data
                const employeeRes = await api.get(`/employees/${id}`);
                setEmployee(employeeRes.data);

                try {
                    // Load payslip data
                    const payslipRes = await api.get(`/employees/${id}/payroll/${payslipId}`);
                    setFormData({
                        month: payslipRes.data.month,
                        year: payslipRes.data.year,
                        deductions: payslipRes.data.deductions,
                        bonuses: payslipRes.data.bonuses,
                        notes: payslipRes.data.notes || '',
                        status: payslipRes.data.status
                    });
                } catch (payslipErr) {
                    // Handle payslip errors
                    if (payslipErr.response?.status === 404) {
                        setNotFound(true);
                    } else {
                        setErrors({
                            general: payslipErr.response?.data?.message ||
                                'Error loading payslip data'
                        });
                    }
                }
            } catch (employeeErr) {
                // Handle employee errors
                if (employeeErr.response?.status === 404) {
                    setNotFound(true);
                } else {
                    setErrors({
                        general: employeeErr.response?.data?.message ||
                            'Error loading data'
                    });
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, payslipId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Calculate net salary
            const netSalary = employee.salary +
                (parseFloat(formData.bonuses) || 0) -
                (parseFloat(formData.deductions) || 0);

            const payload = {
                ...formData,
                month: parseInt(formData.month),
                year: parseInt(formData.year),
                baseSalary: employee.salary,
                netSalary: netSalary
            };

            // Update payslip
            await api.put(`/employees/${id}/payroll/${payslipId}`, payload);
            navigate(`/employees/${id}/payroll`);
        } catch (err) {
            setErrors({
                general: err.response?.data?.message ||
                    'Error updating payslip',
                ...err.response?.data?.errors
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear corresponding error
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    // Calculate net salary
    const netSalary = employee
        ? employee.salary + (parseFloat(formData.bonuses) || 0) - (parseFloat(formData.deductions) || 0)
        : 0;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full absolute border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></div>
                    <div className="w-12 h-12 rounded-full absolute border-2 border-gray-100 opacity-20"></div>
                </div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="max-w-2xl mx-auto p-4">
                <div className="flex items-center mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-semibold text-gray-900">Resource Not Found</h1>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
                    <div className="mb-6">
                        <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        Payslip Not Found
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        The payslip with ID "{payslipId.substring(0, 8)}" doesn't exist for the selected employee.
                        It may have been deleted or you don't have the necessary permissions to access it.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 justify-center transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Go Back
                        </button>
                        <button
                            onClick={() => navigate(`/employees/${id}/payroll`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 justify-center transition-colors shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            View Payslips
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4">
            <div className="flex items-center mb-6">
                <button
                    onClick={() => navigate(`/employees/${id}/payroll`)}
                    className="p-2 rounded-full hover:bg-gray-100 mr-2 transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">Edit Payslip</h1>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                {/* Employee Information */}
                {employee && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                        <div className="text-sm font-medium text-gray-500 mb-1">Employee</div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 font-medium text-lg">
                                    {employee.name.charAt(0)}
                                </span>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-900">{employee.name}</div>
                                <div className="text-sm text-gray-600">{employee.position}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-gray-500">Department</div>
                                <div className="text-sm font-medium text-gray-900">{employee.department}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Base Salary</div>
                                <div className="text-sm font-medium text-gray-900">
                                    {employee.salary?.toLocaleString('fr-FR')} CFA
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Payslip ID</div>
                                <div className="text-sm font-mono text-gray-600">{payslipId.substring(0, 8)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {errors.general && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <div className="font-medium">Error</div>
                            <div className="text-sm">{errors.general}</div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Month
                            </label>
                            <select
                                name="month"
                                value={formData.month}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                required
                                disabled={isSubmitting}
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const monthValue = i + 1;
                                    return (
                                        <option key={monthValue} value={monthValue}>
                                            {new Date(0, i).toLocaleDateString('fr-FR', { month: 'long' })}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.month && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.month}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Year
                            </label>
                            <input
                                type="number"
                                name="year"
                                value={formData.year}
                                onChange={handleChange}
                                min="2000"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                required
                                disabled={isSubmitting}
                            />
                            {errors.year && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.year}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Deductions (CFA)
                            </label>
                            <input
                                type="number"
                                name="deductions"
                                value={formData.deductions}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                disabled={isSubmitting}
                            />
                            {errors.deductions && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.deductions}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Bonuses (CFA)
                            </label>
                            <input
                                type="number"
                                name="bonuses"
                                value={formData.bonuses}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                                disabled={isSubmitting}
                            />
                            {errors.bonuses && (
                                <div className="text-red-500 text-sm flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {errors.bonuses}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-colors"
                            placeholder="Add notes about this payslip..."
                            disabled={isSubmitting}
                        />
                        {errors.notes && (
                            <div className="text-red-500 text-sm flex items-center gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                {errors.notes}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Status
                        </label>
                        <div className="flex space-x-4">
                            {[
                                { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
                                { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
                                { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' }
                            ].map((option) => (
                                <label key={option.value} className="flex items-center">
                                    <input
                                        type="radio"
                                        name="status"
                                        value={option.value}
                                        checked={formData.status === option.value}
                                        onChange={handleChange}
                                        className="sr-only"
                                        disabled={isSubmitting}
                                    />
                                    <span className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${formData.status === option.value 
                                        ? option.color 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {option.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Net Salary Calculation */}
                    <div className="bg-gray-50 rounded-xl p-5">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Salary Calculation</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Base Salary</span>
                                <span className="font-medium">
                                    {employee?.salary?.toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">+ Bonuses</span>
                                <span className="text-green-600 font-medium">
                                    + {parseFloat(formData.bonuses || 0).toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">- Deductions</span>
                                <span className="text-red-600 font-medium">
                                    - {parseFloat(formData.deductions || 0).toLocaleString('fr-FR')} CFA
                                </span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 mt-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-800 font-semibold">Net Salary</span>
                                    <span className="text-xl font-bold text-blue-600">
                                        {netSalary.toLocaleString('fr-FR')} CFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => navigate(`/employees/${id}/payroll`)}
                            className="px-5 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 flex items-center gap-2 justify-center transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 justify-center disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Update Payslip
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaySlipFormEdit;