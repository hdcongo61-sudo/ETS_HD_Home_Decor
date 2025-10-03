import React, { useContext, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const storeRestrictionInfo = (payload) => {
  try {
    sessionStorage.setItem('accessRestrictionInfo', JSON.stringify(payload));
  } catch (error) {
    console.error('Unable to persist restriction info', error);
  }
};

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { auth } = useContext(AuthContext);

  const restrictedPayload = useMemo(() => {
    if (!auth.user?.accessControlEnabled) {
      return null;
    }

    const now = new Date();
    const start = auth.user.accessStart ? new Date(auth.user.accessStart) : null;
    const end = auth.user.accessEnd ? new Date(auth.user.accessEnd) : null;

    const beforeStart = start && now < start;
    const afterEnd = end && now > end;

    if (!(beforeStart || afterEnd)) {
      return null;
    }

    return {
      message: 'Votre accès est restreint en dehors des horaires autorisés. Veuillez contacter un administrateur.',
      accessStart: start ? start.toISOString() : null,
      accessEnd: end ? end.toISOString() : null,
    };
  }, [auth.user?.accessControlEnabled, auth.user?.accessStart, auth.user?.accessEnd]);

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (restrictedPayload) {
    storeRestrictionInfo(restrictedPayload);
    return <Navigate to="/access-restricted" state={restrictedPayload} replace />;
  }

  if (adminOnly && !auth.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
