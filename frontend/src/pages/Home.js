import React, { useContext, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Workspace } from '../components/business';
import AppLoader from '../components/AppLoader';

const Overview = React.lazy(() => import('../components/Overview'));

const Home = () => {
  const { auth } = useContext(AuthContext);

  // A super-admin who is NOT impersonating belongs on the platform console,
  // not inside a shop dashboard.
  const isImpersonating = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('impersonating');
  if (auth?.isSuperAdmin && !isImpersonating) {
    return <Navigate to="/super-admin" replace />;
  }

  // The home stays an operational hub. Deep analytics live on /dashboard so
  // users are not forced to load and scroll through two dashboards at once.
  return (
    <Workspace className="space-y-6 pb-10">
      <Suspense fallback={<AppLoader />}>
        <Overview />
      </Suspense>
    </Workspace>
  );
};

export default Home;
