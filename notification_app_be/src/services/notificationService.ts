import axios from 'axios';
import { logInfo, logError, logDebug } from 'logging-middleware/log';

export interface Notification {
  id: string;
  type: 'Placement' | 'Result' | 'Event' | string;
  timestamp: string; // ISO format
  content: string;
}

const EVALUATION_API_URL = 'http://20.207.122.201/evaluation-service/notifications';

// Priority weights
const getWeight = (type: string) => {
  if (type === 'Placement') return 3;
  if (type === 'Result') return 2;
  if (type === 'Event') return 1;
  return 0;
};

// Custom comparator for priority sort
// Returns > 0 if b should come before a
const comparePriority = (a: Notification, b: Notification) => {
  const weightA = getWeight(a.type);
  const weightB = getWeight(b.type);
  
  if (weightA !== weightB) {
    return weightB - weightA;
  }
  
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
};

export const fetchNotifications = async (page: number, limit: number, type?: string) => {
  logInfo('backend', 'service', 'Entering fetchNotifications service method');
  logDebug('backend', 'service', `fetchNotifications arguments: page=${page}, limit=${limit}, type=${type}`);
  try {
    const accessToken = process.env.ACCESS_TOKEN;
    const response = await axios.get(EVALUATION_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const rawData = response.data?.notifications || [];
    let data: Notification[] = rawData.map((item: any) => ({
      id: item.ID,
      type: item.Type,
      content: item.Message,
      timestamp: item.Timestamp,
    }));
    
    if (type && type !== 'All') {
      data = data.filter((n) => n.type === type);
    }
    
    // Sort by timestamp DESC by default
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    
    logInfo('backend', 'service', `Successfully fetched and paginated notifications (total: ${data.length})`);
    return {
      total: data.length,
      page,
      limit,
      data: paginatedData,
    };
  } catch (error: any) {
    logError('backend', 'service', `fetchNotifications failed: ${error.message}`);
    throw error;
  }
};

export const fetchPriorityNotifications = async () => {
  logInfo('backend', 'service', 'Entering fetchPriorityNotifications service method');
  try {
    const accessToken = process.env.ACCESS_TOKEN;
    const response = await axios.get(EVALUATION_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const rawData = response.data?.notifications || [];
    const data: Notification[] = rawData.map((item: any) => ({
      id: item.ID,
      type: item.Type,
      content: item.Message,
      timestamp: item.Timestamp,
    }));
    
    // Uses an efficient approach to find top K instead of O(N log N) full sort.
    // For K=10, we can maintain a sorted array of size 10. (O(N * K) = O(N))
    const topK: Notification[] = [];
    const K = 10;

    for (const item of data) {
      // Find the position to insert
      let i = 0;
      while (i < topK.length && comparePriority(item, topK[i]) > 0) {
        i++;
      }
      
      // If the item belongs in the top K
      if (i < K) {
        topK.splice(i, 0, item);
        if (topK.length > K) {
          topK.pop(); // Remove the lowest priority item if we exceed K
        }
      }
    }

    logInfo('backend', 'service', 'Successfully fetched and sorted priority notifications');
    return { data: topK };
  } catch (error: any) {
    logError('backend', 'service', `fetchPriorityNotifications failed: ${error.message}`);
    throw error;
  }
};
