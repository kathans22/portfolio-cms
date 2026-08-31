import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// Pagination is opt-in: admin list tables pass ?page=&limit=, but public consumers
// (and existing client code) that omit both params keep getting the plain array they
// always got, so this can't be a breaking change.
export function getPaginationParams(req: Request): PaginationParams | null {
  const { page, limit } = req.query;
  if (page === undefined && limit === undefined) return null;

  const pageNum = Math.max(1, parseInt(String(page ?? '1'), 10) || 1);
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams) {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}
