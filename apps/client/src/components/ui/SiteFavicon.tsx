import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE, apiFetch } from '../../lib/api';

interface SiteSettings {
  hasFavicon: boolean;
  updatedAt: string | null;
}

const SIZE = 128;

/**
 * Draws the logo into a circle: centre-cropped to a square (so a non-square image still
 * fills it rather than squashing), then clipped. Browser tabs show the favicon as a
 * plain bitmap, so the shape has to be baked into the pixels.
 */
function toCircleDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // The favicon endpoint sends CORS headers; without this the canvas is tainted and
    // toDataURL() throws.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no 2d context'));

        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;

        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('favicon failed to load'));
    img.src = src;
  });
}

/**
 * Points the tab icon at the admin-managed favicon, as a circle. Renders nothing. Edits
 * the existing <link rel="icon"> from index.html in place — adding a second one leaves
 * browsers to choose between two, and they don't agree on which wins.
 */
export function SiteFavicon() {
  const { data } = useQuery<SiteSettings | null>({
    queryKey: ['siteSettings'],
    queryFn: async () => {
      const res = await apiFetch('/site-settings');
      return res.ok ? res.json() : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.hasFavicon) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;

    const original = { href: link.getAttribute('href'), type: link.getAttribute('type') };
    const src = `${API_BASE}/site-settings/favicon?v=${encodeURIComponent(data.updatedAt ?? '')}`;
    let cancelled = false;

    // The built-in icon is declared image/svg+xml; a PNG under that type is ignored.
    const apply = (href: string) => {
      if (cancelled) return;
      link.removeAttribute('type');
      link.href = href;
    };

    toCircleDataUrl(src)
      .then(apply)
      // Couldn't round it (e.g. CORS misconfigured): a square icon beats no icon.
      .catch(() => apply(src));

    return () => {
      cancelled = true;
      if (original.href) link.setAttribute('href', original.href);
      if (original.type) link.setAttribute('type', original.type);
    };
  }, [data]);

  return null;
}
