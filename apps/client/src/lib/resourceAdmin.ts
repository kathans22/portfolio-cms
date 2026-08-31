import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from './api';

/** ADMIN-ONLY module. Nothing here is imported by any public-facing component. */

export interface ListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TypeOption {
  id: string;
  name: string;
}

export interface MainTypeRow {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  subTypeCount: number;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubTypeRow extends Omit<MainTypeRow, 'subTypeCount'> {
  mainTypeId: string;
  mainTypeName?: string;
  resourceCount: number;
}

export interface ResourceRow {
  id: string;
  link: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  mainTypeId: string;
  subTypeId: string;
  mainTypeName?: string;
  subTypeName?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reads and writes list state through the URL, so a filtered view survives a refresh and
 * can be pasted to yourself. `useSearchParams` is the single source of truth — mirroring
 * it into component state would give two places for the same value to disagree.
 */
export function useListFilters(defaults: Record<string, string> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? defaults[key] ?? '',
    [searchParams, defaults]
  );

  const set = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      // Any filter change invalidates the current page number: staying on page 4 of a
      // narrower result set shows an empty table that looks like a bug.
      if (!('page' in updates)) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clear = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  const hasFilters = useMemo(
    () => ['search', 'status', 'mainTypeId', 'subTypeId', 'includeDeleted', 'createdFrom', 'createdTo']
      .some((key) => !!searchParams.get(key)),
    [searchParams]
  );

  return { get, set, clear, hasFilters, searchParams };
}

/** Debounces a value so a search box doesn't fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Builds a query string, dropping empty values so the URL stays readable. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

/** Throws the server's message rather than a generic one, so toasts stay useful. */
export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options);
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message || 'Request failed');
  }
  return body as T;
}
