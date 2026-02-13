import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import Dashboard from '../components/Dashboard';

const Home = () => {
  const { auth } = useContext(AuthContext);

  if (auth?.isAdmin) {
    return <Dashboard />;
  }

  if (auth?.user?._id) {
    return <Navigate to={`/sales/user/${auth.user._id}`} replace />;
  }

  return <Dashboard />;
};

export default Home;
