import { Request, Response, NextFunction } from 'express';
import { errorBody } from '../utils/apiError';
import { logger } from '../utils/logger';
import { captureException } from '../config/sentry';

interface HttpError extends Error {
  status?: number;
  code?: string;
}

// Express recognizes error-handling middleware by arity (exactly 4 params) — `next`
// must stay in the signature even though it's unused, or Express won't route errors here.
export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled request error');
  captureException(err);
  res.status(err.status || 500).json(errorBody(err.code || 'INTERNAL_ERROR', err.message || 'Internal server error'));
}
