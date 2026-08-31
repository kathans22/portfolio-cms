import pino from 'pino';

// Render captures stdout directly, so production logs stay as plain JSON lines
// (cheap to emit, easy to grep/parse) — pino-pretty is only for local readability.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});
