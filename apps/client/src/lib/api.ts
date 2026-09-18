// VITE_API_URL must be set in production (see DEPLOYMENT_CHECKLIST.md) — without it,
// the deployed site would call every visitor's own localhost, which doesn't exist.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/** The API server's origin, e.g. `http://localhost:5000`. */
export const API_ORIGIN = API_BASE.replace(/\/api\/v\d+\/?$/, '');

/**
 * Resolves a stored asset URL for use in the browser.
 *
 * When Cloudinary isn't configured, uploads fall back to local disk and the server
 * records a *relative* URL like `/uploads/x.jpg`. The browser would resolve that
 * against the site's own origin — the client, not the API that actually serves
 * `/uploads` — and 404. Absolute URLs (Cloudinary) pass through untouched.
 */
export function assetUrl(url: string): string {
  return url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function refreshSession() {
  // Double-submit CSRF check on the server: the csrf_token cookie (readable, non-httpOnly)
  // must match this header. A cross-site request can't read the cookie to reproduce it.
  const csrfToken = readCookie('csrf_token');
  return fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };

  // FormData bodies need the browser to set the multipart boundary itself.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });

  // Handle Token Expiry & Silent Refresh
  if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await refreshSession();
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem('admin_token', data.access_token);
        headers['Authorization'] = `Bearer ${data.access_token}`;

        // Retry original request
        res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
      } else {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/admin/login';
      }
    } catch {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
  }

  return res;
}
