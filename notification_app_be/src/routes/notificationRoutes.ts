import { Router } from 'express';
import { getNotifications, getPriorityNotifications } from '../controllers/notificationController';
import { logInfo } from 'logging-middleware/log';

const router = Router();

// Middleware to log all route requests
router.use((req, res, next) => {
  logInfo('backend', 'route', `Incoming request to ${req.originalUrl}`);
  next();
});

router.get('/', getNotifications);
router.get('/priority', getPriorityNotifications);

export default router;
