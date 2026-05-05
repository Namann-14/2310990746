import { useState, useEffect } from 'react';
import { getNotifications } from '../api/notificationApi';
import { logInfo, logError } from '@/lib/log';

export const useNotifications = (page: number, limit: number, type: string) => {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      logInfo('frontend', 'hook', 'useNotifications hook: fetching data');
      try {
        const response = await getNotifications(page, limit, type);
        setData(response.data);
        setTotal(response.total);
        logInfo('frontend', 'hook', 'useNotifications hook: state updated with new data');
      } catch (err: any) {
        setError(err.message || 'Error fetching notifications');
        logError('frontend', 'hook', `useNotifications hook error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page, limit, type]);

  return { data, total, loading, error };
};
