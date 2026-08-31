export function errorBody(code: string, message: string, details?: unknown) {
  return {
    success: false as const,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
}

// MongoDB's driver throws a plain error object with a numeric `code`, not a typed
// class — 11000 specifically means a unique-index violation (duplicate slug/name/email).
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}
