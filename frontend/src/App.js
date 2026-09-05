import React, { Suspense, lazy, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AuthContext, { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmProvider from './components/ConfirmProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { FEATURE_KEYS } from './config/features';
import Navigation from './components/Navigation';
import { ModalProvider } from './context/ModalContext';
import GlobalModals from './components/GlobalModals';
import OfflineIndicator from './components/OfflineIndicator';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import SiteFooter from './components/SiteFooter';
import PushNotificationManager from './components/PushNotificationManager';
import AppLayout from './components/AppLayout';
import BottomTabBar from './components/BottomTabBar';
import AppLoader from './components/AppLoader';
import RouteProgressBar from './components/RouteProgressBar';
import ScrollToTop from './components/ScrollToTop';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { DashboardDataProvider } from './context/DashboardDataContext';
import { LocationProvider } from './context/LocationContext';
import DesktopNavRail from './components/DesktopNavRail';
import ServerWakeup from './components/ServerWakeup';
import TrialBanner from './components/TrialBanner';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const AdminModules = lazy(() => import('./pages/AdminModules'));
const Security = lazy(() => import('./pages/Security'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const InventoryV2 = lazy(() => import('./pages/InventoryV2'));
const ReturnsRefunds = lazy(() => import('./pages/ReturnsRefunds'));
const Cutover = lazy(() => import('./pages/Cutover'));
const EmployeeList = lazy(() => import('./components/EmployeeList'));
const EmployeeForm = lazy(() => import('./components/EmployeeForm'));
const EmployeeDetails = lazy(() => import('./components/EmployeeDetail'));
const PaySlipList = lazy(() => import('./components/PaySlipList'));
const PaySlipForm = lazy(() => import('./components/PaySlipForm'));
const PaySlipPrint = lazy(() => import('./components/PaySlipPrint'));
const PaySlipFormEdit = lazy(() => import('./components/PaySlipFormEdit'));
const NeverSoldProducts = lazy(() => import('./pages/NeverSoldProducts'));
const SlowProductSuggestions = lazy(() => import('./pages/SlowProductSuggestions'));
const StockLossReport = lazy(() => import('./pages/StockLossReport'));
const TopSellingProducts = lazy(() => import('./pages/TopSellingProducts'));
const CriticalStockProducts = lazy(() => import('./pages/CriticalStockProducts'));
const OutOfStockProducts = lazy(() => import('./pages/OutOfStockProducts'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ClientLoyalty = lazy(() => import('./pages/ClientLoyalty'));
const PartiallyPaidPurchases = lazy(() => import('./pages/PartiallyPaidPurchases'));
const Bank = lazy(() => import('./pages/Bank'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));

const Home = lazy(() => import('./pages/Home'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales.js'));
const SalesArchive = lazy(() => import('./pages/SalesArchive'));
const DeletedSales = lazy(() => import('./pages/DeletedSales'));
const Clients = lazy(() => import('./pages/Clients'));
const Expenses = lazy(() => import('./pages/Expenses'));
const MonthlySpendingPlan = lazy(() => import('./pages/MonthlySpendingPlan'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const ProductDashboard = lazy(() => import('./pages/ProductDashboard'));
const SupplierProducts = lazy(() => import('./pages/SupplierProducts'));
const ContainerProducts = lazy(() => import('./pages/ContainerProducts'));
const WarehouseProducts = lazy(() => import('./pages/WarehouseProducts'));
const CategoryProducts = lazy(() => import('./pages/CategoryProducts'));
const SupplierProfile = lazy(() => import('./pages/SupplierProfile'));
const EditProductForm = lazy(() => import('./components/EditProductForm'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const DashboardAdmin = lazy(() => import('./pages/DashboardAdmin'));
const UserSalesDashboard = lazy(() => import('./pages/UserSalesDashboard'));
const SaleDetailPage = lazy(() => import('./components/SaleDetailPage'));
const ResumeConnexions = lazy(() => import('./components/ResumeConnexions'));
const LoginActivityDetail = lazy(() => import('./components/LoginActivityDetail'));
const AccessRestricted = lazy(() => import('./pages/AccessRestricted'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings = lazy(() => import('./pages/Settings'));
const Support = lazy(() => import('./pages/Support'));
const AdminRequests = lazy(() => import('./pages/AdminRequests'));
const TenantRegister = lazy(() => import('./pages/TenantRegister'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const ImpersonationBanner = lazy(() => import('./components/ImpersonationBanner'));
const UltimateFilters = lazy(() => import('./pages/UltimateFilters'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PageGuide = lazy(() => import('./components/PageGuide'));
const AttributeManager = lazy(() => import('./components/AttributeManager'));

const PUBLIC_ROUTES = new Set(['/login', '/access-restricted']);

function ApplicationShell() {
  const location = useLocation();
  const { auth } = useContext(AuthContext);
  const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);
  const showAuthenticatedShell = !isPublicRoute && auth.isAuthenticated && !auth.isLoading;
  const useBareLayout = !showAuthenticatedShell;

  return (
    <div className="app-root-shell min-h-screen flex flex-col">
      <ServerWakeup />
      <RouteProgressBar />
      {showAuthenticatedShell && (
        <>
          <TrialBanner />
          <Suspense fallback={null}><ImpersonationBanner /></Suspense>
          <Navigation />
          <OfflineIndicator />
          <DesktopNavRail />
        </>
      )}
      <div className={`flex-1 flex flex-col min-h-0 ${showAuthenticatedShell ? 'app-main-with-sidebar' : ''}`}>
        <Suspense fallback={<AppLoader />}>
          <main className={`flex-1 min-h-0 ${showAuthenticatedShell ? 'main-with-tab-bar' : ''}`}>
            {useBareLayout ? (
              <ApplicationRoutes />
            ) : (
              <AppLayout>
                <ApplicationRoutes />
              </AppLayout>
            )}
          </main>
        </Suspense>
        {showAuthenticatedShell && <SiteFooter />}
      </div>
      {showAuthenticatedShell && (
        <>
          <GlobalModals />
          <PageGuide />
          <PushNotificationManager />
          <PwaInstallPrompt />
          <BottomTabBar />
        </>
      )}
    </div>
  );
}

function ApplicationRoutes() {
  return (
    <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<TenantRegister />} />
                <Route path="/super-admin" element={<SuperAdmin />} />
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
                  path="/dashboard"
                  element={
                    <ProtectedRoute permission="view_dashboard">
                      <Dashboard />
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
                    <ProtectedRoute>
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
                  path="/products/slow-movers"
                  element={
                    <ProtectedRoute adminOnly>
                      <SlowProductSuggestions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/losses"
                  element={
                    <ProtectedRoute adminOnly>
                      <StockLossReport />
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
                  path="/products/by-container"
                  element={
                    <ProtectedRoute adminOnly>
                      <ContainerProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/by-warehouse"
                  element={
                    <ProtectedRoute adminOnly>
                      <WarehouseProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/by-category"
                  element={
                    <ProtectedRoute adminOnly>
                      <CategoryProducts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suppliers/:name"
                  element={
                    <ProtectedRoute adminOnly>
                      <SupplierProfile />
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
                  path="/products/:id/:slug?"
                  element={
                    <ProtectedRoute>
                      <ProductDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/edit/:id/:slug?"
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
                  path="/bank"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.BANK}>
                      <Bank />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/comptabilite"
                  element={
                    <ProtectedRoute adminOnly feature={FEATURE_KEYS.COMPTABILITE}>
                      <Comptabilite />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/all"
                  element={
                    <ProtectedRoute>
                      <SalesArchive />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales/deleted"
                  element={
                    <ProtectedRoute adminOnly>
                      <DeletedSales />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchasing"
                  element={
                    <ProtectedRoute adminOnly>
                      <PurchaseOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inventory-v2"
                  element={
                    <ProtectedRoute adminOnly>
                      <InventoryV2 />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/returns"
                  element={
                    <ProtectedRoute adminOnly>
                      <ReturnsRefunds />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cutover"
                  element={
                    <ProtectedRoute adminOnly>
                      <Cutover />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/attributes"
                  element={
                    <ProtectedRoute adminOnly>
                      <AttributeManager />
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
                  path="/clients/loyalty"
                  element={
                    <ProtectedRoute adminOnly feature={FEATURE_KEYS.LOYALTY}>
                      <ClientLoyalty />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients/:id/:slug?"
                  element={
                    <ProtectedRoute>
                      <ClientProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute permission="use_expenses">
                      <Expenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/expenses/monthly-plan"
                  element={
                    <ProtectedRoute adminOnly feature={FEATURE_KEYS.MONTHLY_SPENDING_PLAN}>
                      <MonthlySpendingPlan />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute adminOnly feature={FEATURE_KEYS.DOCUMENTS}>
                      <Documents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute adminOnly>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/security"
                  element={
                    <ProtectedRoute>
                      <Security />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin-modules"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminModules />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <ProtectedRoute adminOnly>
                      <Support />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin-requests"
                  element={
                    <ProtectedRoute>
                      <AdminRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ultimate-filters"
                  element={
                    <ProtectedRoute adminOnly>
                      <UltimateFilters />
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
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <EmployeeList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/new"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <EmployeeForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <EmployeeDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?/edit"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <EmployeeForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?/payroll"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <PaySlipList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?/payroll/new"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <PaySlipForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?/payroll/:payslipId/edit"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <PaySlipFormEdit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employees/:id/:slug?/payroll/:payslipId/print"
                  element={
                    <ProtectedRoute feature={FEATURE_KEYS.EMPLOYEES_PAYROLL}>
                      <PaySlipPrint />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ModalProvider>
        <AppSettingsProvider>
          <AuthProvider>
            <LocationProvider>
              <DashboardDataProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <ScrollToTop />
                  <Toaster
                    position="top-right"
                    containerStyle={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
                    toastOptions={{ duration: 4000 }}
                  />
                  <ConfirmProvider />
                  <ApplicationShell />
                </Router>
              </DashboardDataProvider>
            </LocationProvider>
          </AuthProvider>
        </AppSettingsProvider>
      </ModalProvider>
    </ErrorBoundary>
  );
}

export default App;
