import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import usePushNotifications from '../hooks/usePushNotifications';

const PushNotificationManager = () => {
  const { auth } = useContext(AuthContext);
  usePushNotifications(auth?.isAuthenticated);
  return null;
};

export default PushNotificationManager;
