import * as path from 'path';

/**
 * The single directory that locally-stored uploads are written to AND served from.
 *
 * This used to be spelled out with a `../` chain in three places (server.ts's static
 * mount, the media upload route, and now resume) — and they didn't all agree, so the
 * local-storage fallback wrote files the static mount never served. One constant now.
 *
 * Resolves the same whether running from `src/` (ts-node) or `dist/` (compiled): both
 * `src/config` and `dist/config` sit at `apps/server/<build>/config`.
 */
export const UPLOADS_DIR = path.resolve(__dirname, '../../../../../uploads');
