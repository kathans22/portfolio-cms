import type { Schema } from 'mongoose';
import { logger } from '../../utils/logger';

/**
 * In-process cache of resolved public pages, keyed by path.
 *
 * A portfolio on a single free-tier Render instance does not need Redis: the working set
 * is a handful of pages, and a Map costs nothing to boot — which matters, because cold
 * start is the dominant latency here and every extra dependency lengthens it.
 *
 * The tradeoff is stated plainly: this cache is per-process. On a multi-instance
 * deployment each instance would hold its own copy, so a publish would only invalidate
 * the instance that served the write. See the README for what to change then.
 */

export const RESOLVE_CACHE_TTL_MS = 60_000;

/**
 * The key space is already bounded by the number of published pages (only PAGE outcomes
 * are cached), so this is a backstop against a future change that starts caching misses,
 * not a tuning knob.
 */
const MAX_ENTRIES = 200;

export interface ResolveCacheEntry<T = unknown> {
  payload: T;
  etag: string;
  /** Model names whose contents this entry was built from, e.g. Page, Project, Skill. */
  dependsOn: Set<string>;
  expiresAt: number;
}

const cache = new Map<string, ResolveCacheEntry>();

const stats = { hits: 0, misses: 0, invalidations: 0 };

export function getCachedResolve<T>(path: string): ResolveCacheEntry<T> | undefined {
  const entry = cache.get(path) as ResolveCacheEntry<T> | undefined;
  if (!entry) {
    stats.misses++;
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    // Expiry is a safety net for anything invalidation misses, not the primary
    // mechanism — a publish busts the entry immediately.
    cache.delete(path);
    stats.misses++;
    return undefined;
  }
  stats.hits++;
  return entry;
}

export function setCachedResolve<T>(path: string, payload: T, etag: string, dependsOn: Set<string>): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(path)) {
    // Map iterates in insertion order, so the first key is the oldest write.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(path, { payload, etag, dependsOn, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
}

/**
 * Drops every entry whose content came from this collection.
 *
 * Writing a Project has to bust the cached `/work` page that lists it, not just the
 * project's own detail URL — otherwise an edit stays invisible for up to a TTL and the
 * admin reasonably concludes the save failed.
 */
export function invalidateCollection(modelName: string): void {
  let dropped = 0;
  for (const [path, entry] of cache) {
    if (entry.dependsOn.has(modelName)) {
      cache.delete(path);
      dropped++;
    }
  }
  if (dropped > 0) {
    stats.invalidations += dropped;
    logger.debug({ modelName, dropped }, 'Resolve cache invalidated by collection write');
  }
}

/** Every cached page depends on Page, so this is the whole cache — see collectionsUsedBy. */
export function invalidateAllPages(): void {
  invalidateCollection('Page');
}

export function clearResolveCache(): void {
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.invalidations = 0;
}

export function resolveCacheStats() {
  return { ...stats, size: cache.size };
}

/**
 * Registers write hooks that bust the cache for a collection.
 *
 * Attached to the schema rather than called from each admin route: a route added later
 * inherits invalidation automatically, whereas a forgotten call site would surface as
 * "the site didn't update" — the hardest kind of staleness to diagnose.
 */
export function invalidatesResolveCache(schema: Schema, modelName: string): void {
  const bust = () => invalidateCollection(modelName);

  schema.post('save', bust);
  schema.post('insertMany', bust);
  schema.post(
    ['findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'updateOne', 'updateMany', 'replaceOne'],
    bust
  );
  // deleteOne/deleteMany are ambiguous between document and query middleware, so both
  // forms are registered explicitly rather than relying on the version's default.
  schema.post(['deleteOne', 'deleteMany'], { document: false, query: true }, bust);
  schema.post('deleteOne', { document: true, query: false }, bust);
}
