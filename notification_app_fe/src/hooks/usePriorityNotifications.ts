import { useState, useEffect } from 'react';
import { getPriorityNotifications } from '../api/notificationApi';
import { logInfo, logError } from '@/lib/log';

export const usePriorityNotifications = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      logInfo('frontend', 'hook', 'usePriorityNotifications hook: fetching data');
      try {
        const response = await getPriorityNotifications();
        setData(response.data);
        logInfo('frontend', 'hook', 'usePriorityNotifications hook: state updated');
      } catch (err: any) {
        setError(err.message || 'Error fetching priority notifications');
        logError('frontend', 'hook', `usePriorityNotifications hook error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error };
};
