import rateLimit from 'express-rate-limit';
import { errorBody } from '../utils/apiError';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  message: errorBody('RATE_LIMITED', 'Too many requests from this IP. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit specifically for the public contact endpoint, which is a common spam target.
export const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: errorBody('RATE_LIMITED', 'Too many contact submissions from this IP. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit specifically for login, to slow down credential-stuffing/brute-force attempts.
// Only failed attempts count against the limit — a successful login doesn't consume it.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: errorBody('RATE_LIMITED', 'Too many login attempts from this IP. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
