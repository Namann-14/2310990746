import axios from 'axios';
import { logInfo, logError, logDebug } from '@/lib/log';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getNotifications = async (page: number, limit: number, type?: string) => {
  logInfo('frontend', 'api', `Fetching notifications (page: ${page}, limit: ${limit}, type: ${type})`);
  logDebug('frontend', 'api', `getNotifications called with params: ${JSON.stringify({ page, limit, notification_type: type })}`);
  try {
    const params: any = { page, limit };
    if (type && type !== 'All') {
      params.notification_type = type;
    }
    const response = await api.get('/notifications', { params });
    logInfo('frontend', 'api', 'Successfully fetched notifications');
    return response.data;
  } catch (error: any) {
    logError('frontend', 'api', `Failed to fetch notifications: ${error.message}`);
    throw error;
  }
};

export const getPriorityNotifications = async () => {
  logInfo('frontend', 'api', 'Fetching priority notifications');
  try {
    const response = await api.get('/notifications/priority');
    logInfo('frontend', 'api', 'Successfully fetched priority notifications');
    return response.data;
  } catch (error: any) {
    logError('frontend', 'api', `Failed to fetch priority notifications: ${error.message}`);
    throw error;
  }
};
