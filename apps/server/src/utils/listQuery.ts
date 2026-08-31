import { Request } from 'express';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export interface ListParams {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  includeDeleted: boolean;
}

/**
 * Parses the list query params shared by every endpoint in the Resource Management
 * module. Kept in one place so the rules below cannot hold on one endpoint and not
 * another:
 *
 *  - `sortBy` is matched against a hard-coded allowlist per endpoint and falls back to
 *    the default when unrecognised. A client string must never reach a sort key: it is
 *    a database-level instruction, and an unlisted field silently produces a different
 *    ordering rather than an error.
 *  - `limit` is capped, so a client cannot ask for the whole collection in one request.
 *  - `includeDeleted` defaults to false. Soft-deleted records are never returned unless
 *    the caller explicitly asks for the "Deleted" view.
 */
export function parseListParams(req: Request, allowedSortFields: readonly string[], defaultSortBy: string): ListParams {
  const rawPage = parseInt(String(req.query.page ?? '1'), 10);
  const rawLimit = parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10);

  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));

  const requestedSortBy = String(req.query.sortBy ?? '');
  const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : defaultSortBy;
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
  const status =
    req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [sortBy]: sortDir === 'asc' ? 1 : -1 },
    sortBy,
    sortDir,
    search,
    status,
    includeDeleted: req.query.includeDeleted === 'true',
  };
}

/**
 * The list envelope this module uses: { items, total, page, limit, totalPages }.
 *
 * Deliberately different from the repo's older `{ data, pagination }` shape, which is
 * additive-optional for backwards compatibility with public callers. This module has no
 * public callers and paginates unconditionally, so it uses the flatter envelope the
 * module spec defines rather than pretending pagination is opt-in.
 */
export function listEnvelope<T>(items: T[], total: number, params: ListParams) {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}

/** Escapes user input before it reaches a $regex, so a stray `(` can't break the query. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parses a date range filter, ignoring anything unparseable rather than 400-ing. */
export function dateRange(from: unknown, to: unknown): Record<string, Date> | undefined {
  const range: Record<string, Date> = {};
  const parsedFrom = from ? new Date(String(from)) : null;
  const parsedTo = to ? new Date(String(to)) : null;

  if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) range.$gte = parsedFrom;
  if (parsedTo && !Number.isNaN(parsedTo.getTime())) range.$lte = parsedTo;

  return Object.keys(range).length > 0 ? range : undefined;
}
