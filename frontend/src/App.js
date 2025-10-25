import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import UserProfile from './components/UserProfile';
import EmployeeList from './components/EmployeeList';
import EmployeeForm from './components/EmployeeForm';
import EmployeeDetails from './components/EmployeeDetail';
import PaySlipList from './components/PaySlipList';
import PaySlipForm from './components/PaySlipForm';
import AdvanceList from './components/AdvanceList';
import AdvanceForm from './components/AdvanceForm';
import PaySlipPrint from './components/PaySlipPrint';
import PaySlipFormEdit from './components/PaySlipFormEdit';
import { ModalProvider } from './context/ModalContext';
import GlobalModals from './components/GlobalModals';
import OfflineIndicator from './components/OfflineIndicator';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import SiteFooter from './components/SiteFooter';
import NeverSoldProducts from './pages/NeverSoldProducts';
import TopSellingProducts from './pages/TopSellingProducts';
import CriticalStockProducts from './pages/CriticalStockProducts';
import OutOfStockProducts from './pages/OutOfStockProducts';
import ClientDashboard from './pages/ClientDashboard';
import PartiallyPaidPurchases from "./pages/PartiallyPaidPurchases";

const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales'));
const Clients = lazy(() => import('./pages/Clients'));
const Expenses = lazy(() => import('./pages/Expenses'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const ProductDashboard = lazy(() => import('./pages/ProductDashboard'));
const SupplierProducts = lazy(() => import('./pages/SupplierProducts'));
const EditProductForm = lazy(() => import('./components/EditProductForm'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin'));
const UserSalesDashboard = lazy(() => import('./pages/UserSalesDashboard'));
const SaleDetailPage = lazy(() => import('./components/SaleDetailPage'));
const ResumeConnexions = lazy(() => import('./components/ResumeConnexions'));
const LoginActivityDetail = lazy(() => import('./components/LoginActivityDetail'));
const EditSalePage = lazy(() => import('./pages/EditSalePage'));
const AccessRestricted = lazy(() => import('./pages/AccessRestricted'));

function App() {
  return (
    <ModalProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-gray-50">
            <Navigation />
            <OfflineIndicator />
            <Suspense fallback={<div className="p-8 text-center text-gray-500">Chargement...</div>}>
              <main className="flex-1">
                <div className="container mx-auto px-4 py-8">
                  <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/access-restricted" element={<AccessRestricted />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute>
                      <Products />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users/stats"
                  element={
                    <ProtectedRoute adminOnly>
                      <DashboardAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/user/:userId"
                  element={
                    <ProtectedRoute adminOnly>
                      <UserSalesDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/users/login-stats"
                  element={
                    <ProtectedRoute adminOnly>
                      <ResumeConnexions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users/login-activity/:id"
                  element={
                    <ProtectedRoute adminOnly>
                      <LoginActivityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute adminOnly>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/product-dashboard"
                  element={
                    <ProtectedRoute adminOnly>
                      <ProductDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/never-sold"
                  element={
                    <ProtectedRoute adminOnly>
                      <NeverSoldProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/top-sellers"
                  element={
                    <ProtectedRoute adminOnly>
                      <TopSellingProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/by-supplier"
                  element={
                    <ProtectedRoute adminOnly>
                      <SupplierProducts />
                    </ProtectedRoute>
                  }
                />
                                <Route
                  path="/products/critical"
                  element={
                    <ProtectedRoute adminOnly>
                      <CriticalStockProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/out-of-stock"
                  element={
                    <ProtectedRoute adminOnly>
                      <OutOfStockProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/:id"
                  element={
                    <ProtectedRoute adminOnly>
                      <ProductDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/edit/:id"
                  element={
                    <ProtectedRoute adminOnly>
                      <EditProductForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales"
                  element={
                    <ProtectedRoute>
                      <Sales />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/partially-paid"
                  element={
                    <ProtectedRoute>
                      <PartiallyPaidPurchases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/:id"
                  element={
                    <ProtectedRoute>
                      <SaleDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditSalePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients/dashboard"
                  element={
                    <ProtectedRoute>
                      <ClientDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients/:id"
                  element={
                    <ProtectedRoute>
                      <ClientProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute>
                      <Expenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <UserProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees"
                  element={
                    <ProtectedRoute>
                      <EmployeeList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/new"
                  element={
                    <ProtectedRoute>
                      <EmployeeForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id"
                  element={
                    <ProtectedRoute>
                      <EmployeeDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EmployeeForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/payroll"
                  element={
                    <ProtectedRoute>
                      <PaySlipList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/payroll/new"
                  element={
                    <ProtectedRoute>
                      <PaySlipForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/advances"
                  element={
                    <ProtectedRoute>
                      <AdvanceList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/advances/new"
                  element={
                    <ProtectedRoute>
                      <AdvanceForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/payroll/:payslipId/edit"
                  element={
                    <ProtectedRoute>
                      <PaySlipFormEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/payroll/:payslipId/print"
                  element={
                    <ProtectedRoute>
                      <PaySlipPrint />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </main>
        </Suspense>
        <SiteFooter />
        <GlobalModals />
        <PwaInstallPrompt />
      </div>
        </Router>
      </AuthProvider>
    </ModalProvider>
  );
}

export default App;
