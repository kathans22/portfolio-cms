import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { loginSchema, updateProfileSchema } from '@portfolio/shared';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { verifyCsrf } from '../../middleware/csrf';
import { loginRateLimiter } from '../../middleware/rateLimiter';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { Admin } from './admin.model';
import { AuditLog } from './auditLog.model';

const router = Router();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'accesssupersecretportfoliojwtkey';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refreshsupersecretportfoliojwtkey';

// Refresh token lifetime: configurable, clamped to the 7-30 day range.
const REFRESH_TTL_DAYS = Math.min(30, Math.max(7, Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7));
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

function generateTokens(admin: { id: string; email: string }) {
  const accessToken = jwt.sign({ id: admin.id, email: admin.email }, ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: admin.id, email: admin.email }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
  return { accessToken, refreshToken };
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Production deploys the client (Vercel) and API (Render) on different domains, so
// the browser treats every request as cross-site — that requires SameSite=None
// (which itself requires Secure). Locally both run on localhost, where Strict is
// safer and works fine since there's no cross-site boundary to cross.
const isProduction = process.env.NODE_ENV === 'production';
const cookieSecurity = { secure: isProduction, sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict' };

function setSessionCookies(res: Response, refreshToken: string, csrfToken: string) {
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    ...cookieSecurity,
    maxAge: REFRESH_TTL_MS,
  });
  // Deliberately NOT httpOnly — the client reads this and echoes it back as a header
  // on /refresh (double-submit CSRF check). It's not a secret on its own; it only
  // matters paired with the httpOnly refresh cookie a cross-site request can't read.
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    ...cookieSecurity,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie('refresh_token', { httpOnly: true, ...cookieSecurity });
  res.clearCookie('csrf_token', { httpOnly: false, ...cookieSecurity });
}

async function logAuthEvent(event: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE', email: string, req: Request) {
  try {
    await AuditLog.create({ event, email, ip: req.ip || 'unknown', userAgent: req.headers['user-agent'] });
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log');
  }
}

// POST /api/v1/auth/login
router.post('/login', loginRateLimiter, validateRequest(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      await logAuthEvent('LOGIN_FAILURE', email, req);
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Invalid email or password'));
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      await logAuthEvent('LOGIN_FAILURE', email, req);
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Invalid email or password'));
    }

    const id = admin._id.toString();
    const { accessToken, refreshToken } = generateTokens({ id, email: admin.email });
    const csrfToken = crypto.randomBytes(32).toString('hex');

    admin.refreshTokens.push({
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    await admin.save();

    setSessionCookies(res, refreshToken, csrfToken);
    await logAuthEvent('LOGIN_SUCCESS', email, req);

    res.json({
      access_token: accessToken,
      user: { id, email: admin.email, name: admin.name },
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Internal server error'));
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', verifyCsrf, async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Refresh token missing'));
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string; email: string };

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Admin session no longer valid'));
    }

    // The presented token must still be a live, unrevoked session on this admin document.
    const presentedHash = hashToken(refreshToken);
    const hasToken = admin.refreshTokens.some((t) => t.tokenHash === presentedHash);
    if (!hasToken) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Refresh token has been revoked'));
    }

    // Rotate: drop the used token, issue a new one.
    admin.refreshTokens = admin.refreshTokens.filter((t) => t.tokenHash !== presentedHash) as typeof admin.refreshTokens;

    const id = admin._id.toString();
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({ id, email: admin.email });
    const csrfToken = crypto.randomBytes(32).toString('hex');

    admin.refreshTokens.push({
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    await admin.save();

    setSessionCookies(res, newRefreshToken, csrfToken);

    res.json({ access_token: accessToken });
  } catch (_error) {
    // Expired/invalid JWTs are routine here (natural token rotation), not worth logging as errors.
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Invalid or expired refresh token'));
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh_token;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string };
      const presentedHash = hashToken(refreshToken);
      await Admin.findByIdAndUpdate(decoded.id, { $pull: { refreshTokens: { tokenHash: presentedHash } } });
    } catch {
      // Token already invalid/expired — nothing to revoke server-side, just clear the cookies below.
    }
  }

  clearSessionCookies(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// GET /api/v1/auth/me
router.get('/me', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const admin = await Admin.findById(req.userId).select('email name createdAt');

    if (!admin) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Admin not found'));
    }

    res.json({ id: admin._id.toString(), email: admin.email, name: admin.name, createdAt: admin.createdAt });
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch admin profile');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Internal server error'));
  }
});

// PATCH /api/v1/auth/me — update profile and/or password. Requires the current
// password on every change, since this is a single-admin system with no other
// confirmation step (e.g. email verification) available.
router.patch('/me', requireAdmin, validateRequest(updateProfileSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.userId);
    if (!admin) {
      return res.status(404).json(errorBody('NOT_FOUND', 'Admin not found'));
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Current password is incorrect'));
    }

    if (email && email !== admin.email) {
      const existing = await Admin.findOne({ email });
      if (existing) {
        return res.status(409).json(errorBody('CONFLICT', 'That email is already in use'));
      }
      admin.email = email;
    }
    if (name) {
      admin.name = name;
    }
    if (newPassword) {
      admin.passwordHash = await bcrypt.hash(newPassword, 12);
      // Changing the password invalidates all existing sessions except this request's.
      admin.refreshTokens = [];
    }

    await admin.save();

    res.json({ id: admin._id.toString(), email: admin.email, name: admin.name, createdAt: admin.createdAt });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update admin profile');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to update profile'));
  }
});

export default router;
