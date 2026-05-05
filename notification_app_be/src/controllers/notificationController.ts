import { Request, Response } from 'express';
import * as notificationService from '../services/notificationService';
import { logInfo, logError, logDebug } from 'logging-middleware/log';

export const getNotifications = async (req: Request, res: Response) => {
  logInfo('backend', 'controller', 'Entering getNotifications controller');
  logDebug('backend', 'controller', `Query params: ${JSON.stringify(req.query)}`);
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const notificationType = req.query.notification_type as string | undefined;

    const data = await notificationService.fetchNotifications(page, limit, notificationType);
    logInfo('backend', 'controller', 'Exiting getNotifications controller successfully');
    res.json(data);
  } catch (error: any) {
    logError('backend', 'controller', `Error in getNotifications: ${error.message}`);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data?.message || 'Failed to fetch notifications from evaluation service' });
    } else {
      res.status(500).json({ error: 'Internal Server Error while communicating with evaluation service' });
    }
  }
};

export const getPriorityNotifications = async (req: Request, res: Response) => {
  logInfo('backend', 'controller', 'Entering getPriorityNotifications controller');
  try {
    const data = await notificationService.fetchPriorityNotifications();
    logInfo('backend', 'controller', 'Exiting getPriorityNotifications controller successfully');
    res.json(data);
  } catch (error: any) {
    logError('backend', 'controller', `Error in getPriorityNotifications: ${error.message}`);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data?.message || 'Failed to fetch priority notifications' });
    } else {
      res.status(500).json({ error: 'Internal Server Error while communicating with evaluation service' });
    }
  }
};
