import React, { useContext, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Workspace } from '../components/business';
import AppLoader from '../components/AppLoader';

const Overview = React.lazy(() => import('../components/Overview'));
const Dashboard = React.lazy(() => import('../components/Dashboard'));

const Home = () => {
  const { auth } = useContext(AuthContext);

  // A super-admin who is NOT impersonating belongs on the platform console,
  // not inside a shop dashboard.
  const isImpersonating = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonating');
  if (auth?.isSuperAdmin && !isImpersonating) {
    return <Navigate to="/super-admin" replace />;
  }

  const isAdmin = Boolean(auth?.isAdmin);

  // Both admins and sellers land on the overview hub (role-aware content inside).
  // Admins also get the full analytics dashboard shown by default, right below.
  return (
    <Workspace>
      <Suspense fallback={<AppLoader />}>
        <Overview />
      </Suspense>
      {isAdmin && (
        <div id="tableau-de-bord" className="scroll-mt-[var(--app-nav-offset)]">
          <Suspense fallback={<AppLoader />}>
            <Dashboard />
          </Suspense>
        </div>
      )}
    </Workspace>
  );
};

export default Home;
