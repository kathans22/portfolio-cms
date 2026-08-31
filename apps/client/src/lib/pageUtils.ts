/** Mirrors MAX_PAGE_DEPTH on the server; depth 2 means /a/b/c is the deepest URL. */
export const MAX_PAGE_DEPTH_CLIENT = 2;

/**
 * Turns a title into a candidate slug matching the server's rules: lowercase,
 * [a-z0-9-], no leading/trailing hyphen, 60 chars max. The server validates again —
 * this only saves the admin from typing it.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents so "Café" becomes "cafe", not "caf"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, ''); // slicing can leave a trailing hyphen
}
