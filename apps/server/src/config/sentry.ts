import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

// Sentry is entirely optional — a personal-portfolio deploy shouldn't require signing
// up for anything beyond MongoDB Atlas/Render/Vercel to run. Wiring only activates
// when SENTRY_DSN is set (e.g. once you've created a free Sentry project).
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('SENTRY_DSN not set — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry error tracking initialized');
}

export function captureException(err: unknown) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
}
