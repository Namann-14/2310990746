import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import notificationRoutes from './routes/notificationRoutes';
import { logInfo, logError } from 'logging-middleware/log';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/notifications', notificationRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logError('backend', 'middleware', `Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logInfo('backend', 'config', `Server started on port ${PORT}`);
});

export default app;
