import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env';
import routes from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { socketService } from './modules/realtime/socket.service';

const app = express();
const httpServer = http.createServer(app);

// Initialize real-time Socket.IO engine (CivicResolve)
socketService.init(httpServer);

// Performance Middleware: Gzip / Deflate compression for API responses
app.use(
  compression({
    threshold: 1024,
    level: 6,
  })
);
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'CivicResolve Backend API' });
});

// Routes
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorMiddleware);

const PORT = env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});

export { httpServer };
export default app;
