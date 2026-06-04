import React, { useContext, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Workspace } from '../components/business';
import AppLoader from '../components/AppLoader';

const Dashboard = React.lazy(() => import('../components/Dashboard'));

const Home = () => {
  const { auth } = useContext(AuthContext);

  if (auth?.isAdmin) {
    return (
      <Workspace>
        <Suspense fallback={<AppLoader />}>
          <Dashboard />
        </Suspense>
      </Workspace>
    );
  }

  if (auth?.user?._id) {
    return <Navigate to={`/sales/user/${auth.user._id}`} replace />;
  }

  return (
    <Workspace>
      <Suspense fallback={<AppLoader />}>
        <Dashboard />
      </Suspense>
    </Workspace>
  );
};

export default Home;
