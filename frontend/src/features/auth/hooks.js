/**
 * features/auth — hooks réutilisables (sessions + MFA).
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import authApi from './api';

export const clearSessionStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('tenantId');
  localStorage.removeItem('userId');
  sessionStorage.removeItem('impersonating');
  sessionStorage.removeItem('superAdminToken');
  sessionStorage.removeItem('superAdminTenantId');
};

export const useSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authApi.listSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (sessionId) => {
    setRevoking(sessionId);
    try {
      await authApi.revokeSession(sessionId);
      await load();
      return true;
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    try {
      await authApi.logoutAll();
      clearSessionStorage();
      window.location.replace('/login');
    } finally {
      setRevokingAll(false);
    }
  };

  return { sessions, loading, revoking, revokingAll, load, revoke, revokeAll };
};

export const useMfa = () => {
  const { auth } = useContext(AuthContext);
  const [enabled, setEnabled] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(auth?.user?.mfaEnabled));
  }, [auth?.user?.mfaEnabled]);

  const setup = async () => {
    setLoading(true);
    try {
      const { data } = await authApi.mfaSetup();
      setSetupData(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code) => {
    setLoading(true);
    try {
      await authApi.mfaVerify(code);
      setEnabled(true);
      setSetupData(null);
      if (auth?.user) auth.user.mfaEnabled = true;
    } finally {
      setLoading(false);
    }
  };

  const disable = async (password) => {
    setLoading(true);
    try {
      await authApi.mfaDisable(password);
      setEnabled(false);
      if (auth?.user) auth.user.mfaEnabled = false;
    } finally {
      setLoading(false);
    }
  };

  return { enabled, setupData, loading, setup, verify, disable };
};
