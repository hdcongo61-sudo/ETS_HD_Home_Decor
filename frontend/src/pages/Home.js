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

  // Both admins and sellers land on the overview hub (role-aware content inside).
  return (
    <Workspace>
      <Suspense fallback={<AppLoader />}>
        <Overview />
      </Suspense>
    </Workspace>
  );
};

export default Home;
