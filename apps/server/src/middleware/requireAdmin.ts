import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { errorBody } from '../utils/apiError';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'accesssupersecretportfoliojwtkey';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

function decodeBearer(req: Request): { id: string; email: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, ACCESS_SECRET) as { id: string; email: string };
  } catch {
    return null;
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Authorization token required'));
  }

  const decoded = decodeBearer(req);
  if (!decoded) {
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Invalid or expired access token'));
  }

  req.userId = decoded.id;
  req.userEmail = decoded.email;
  next();
}

// Does not reject the request if there's no/invalid token — just attaches userId/userEmail
// when a valid one is present. Lets public list/detail routes show drafts to a logged-in
// admin while still serving published-only content to anonymous visitors.
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const decoded = decodeBearer(req);
  if (decoded) {
    req.userId = decoded.id;
    req.userEmail = decoded.email;
  }
  next();
}
