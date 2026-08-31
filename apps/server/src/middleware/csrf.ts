import { Request, Response, NextFunction } from 'express';
import { errorBody } from '../utils/apiError';

// Double-submit cookie CSRF check. The refresh endpoint authenticates purely via an
// httpOnly cookie (no Bearer token), which makes it a CSRF target on its own — a
// cross-site form/fetch can't read the csrf_token cookie (browser same-origin policy)
// so it can't reproduce the matching header, even though the httpOnly refresh cookie
// itself would ride along automatically.
export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json(errorBody('CSRF_VALIDATION_FAILED', 'CSRF token missing or invalid'));
  }

  next();
}
