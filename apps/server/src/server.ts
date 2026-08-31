import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from the monorepo root .env (three levels up from
// both src/server.ts and dist/server.js, since both sit at apps/server/<dir>).
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

import authRouter from './modules/auth/routes';
import projectsRouter from './modules/projects/routes';
import blogRouter from './modules/blog/routes';
import skillsRouter from './modules/skills/routes';
import experienceRouter from './modules/experience/routes';
import educationRouter from './modules/education/routes';
import resolveRouter from './modules/resolve/resolve.routes';
import adminPagesRouter from './modules/pages/adminRoutes';
import adminSectionsRouter from './modules/pages/sectionCountRoutes';
// ADMIN-ONLY module: no public counterpart is exported or mounted.
import adminMainTypesRouter from './modules/mainTypes/adminRoutes';
import adminSubTypesRouter from './modules/subTypes/adminRoutes';
import adminResourcesRouter from './modules/resources/adminRoutes';
import certificationsRouter from './modules/certifications/routes';
import adminCertificationsRouter from './modules/certifications/adminRoutes';
import adminSkillsRouter from './modules/skills/adminRoutes';
import testimonialsRouter from './modules/testimonials/routes';
import messagesRouter from './modules/messages/routes';
import contactRouter from './modules/messages/contactRoutes';
import mediaRouter from './modules/media/routes';
import analyticsRouter from './modules/analytics/routes';

import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { connectDB, pingDB } from './config/db';
import { initSentry, captureException } from './config/sentry';
import { logger } from './utils/logger';

initSentry();

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  captureException(err);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the first hop proxy (Render, etc.) so req.ip reflects the real client IP —
// used for rate limiting and the auth audit log, not just the load balancer's IP.
app.set('trust proxy', 1);

// Security headers. crossOriginResourcePolicy is relaxed to cross-origin because the
// client (a different origin) loads locally-stored upload images from /uploads when
// Cloudinary isn't configured — helmet's default same-origin policy would block those.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting and security middleware
app.use(rateLimiter);

// Enable CORS with support for credentials (required for HTTP-only cookies).
// Only the deployed frontend origin(s) are allowed — set CLIENT_ORIGIN in production
// (comma-separated for multiple origins); defaults to local dev ports otherwise.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body parser, cookie parser, and logging middlewares — explicit size limits to
// bound request payloads (defends against oversized-body DoS attempts).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Static files routing for uploads
// Uploads directory sits at the root folder level
const uploadsPath = path.join(__dirname, '../../../../uploads');
app.use('/uploads', express.static(uploadsPath));
logger.info({ uploadsPath }, 'Serving uploads statically');

// Register API modular routes — all under /api/v1 per the REST design
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/blog', blogRouter);
app.use('/api/v1/skills', skillsRouter);
app.use('/api/v1/experience', experienceRouter);
app.use('/api/v1/education', educationRouter);
app.use('/api/v1/certifications', certificationsRouter);
app.use('/api/v1/admin/certifications', adminCertificationsRouter);
app.use('/api/v1/admin/skills', adminSkillsRouter);
app.use('/api/v1', resolveRouter);
app.use('/api/v1/admin/pages', adminPagesRouter);
app.use('/api/v1/admin/sections', adminSectionsRouter);
app.use('/api/v1/admin/main-types', adminMainTypesRouter);
app.use('/api/v1/admin/sub-types', adminSubTypesRouter);
app.use('/api/v1/admin/resources', adminResourcesRouter);
app.use('/api/v1/testimonials', testimonialsRouter);
app.use('/api/v1/contact', contactRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/analytics', analyticsRouter);

// Health check endpoint — does a real MongoDB round-trip (not just a readyState
// check) so it doubles as a keep-alive ping for a free-tier Atlas cluster, and Render
// can point its own health check config at this path.
app.get('/api/v1/health', async (req: express.Request, res: express.Response) => {
  const connected = await pingDB();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    db: connected ? 'connected' : 'disconnected',
    timestamp: new Date(),
  });
});

// Error handling fallback
app.use(errorHandler);

// Only connect to MongoDB and start listening when this file is run directly
// (e.g. `ts-node src/server.ts` or `node dist/server.js`) — not when `app` is
// imported by tests, which manage their own DB connection (see mongodb-memory-server setup).
if (require.main === module) {
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        logger.info({ port: PORT }, 'API server is running');
      });

      // Render sends SIGTERM before killing the container on redeploys/spin-downs —
      // close the HTTP server and Mongoose connection cleanly instead of dropping
      // in-flight requests and connections abruptly.
      const shutdown = (signal: string) => {
        logger.info({ signal }, 'Shutting down gracefully');
        server.close(async () => {
          await mongoose.connection.close();
          process.exit(0);
        });
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to connect to MongoDB, exiting');
      process.exit(1);
    });
}

export { app };
