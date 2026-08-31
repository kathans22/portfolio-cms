// Generates public/sitemap.xml (and appends the Sitemap: line to public/robots.txt)
// before the Vite build. Runs at build time, not runtime, since this is a static SPA.
//
// Static routes are always included. Project/blog slugs are added opportunistically by
// fetching the live API — if that fails (API unreachable during build, no VITE_SITE_URL
// configured yet, etc.) the build still succeeds with just the static routes rather than
// failing the deploy over a non-essential SEO file.
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const SITE_URL = process.env.VITE_SITE_URL;
const API_URL = process.env.VITE_API_URL || 'http://localhost:5000/api/v1';

if (!SITE_URL) {
  console.warn('[sitemap] VITE_SITE_URL is not set — skipping sitemap.xml generation. Set it in production.');
  process.exit(0);
}

const STATIC_ROUTES = ['/', '/projects', '/about', '/blog', '/contact', '/certifications'];

async function fetchSlugs(endpoint) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}${endpoint}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const items = await res.json();
    return Array.isArray(items) ? items.map((item) => item.slug) : [];
  } catch (err) {
    console.warn(`[sitemap] Could not fetch ${endpoint} for sitemap — continuing with static routes only. (${err.message})`);
    return [];
  }
}

async function main() {
  const [projectSlugs, blogSlugs] = await Promise.all([
    fetchSlugs('/projects'),
    fetchSlugs('/blog'),
  ]);

  const urls = [
    ...STATIC_ROUTES,
    ...projectSlugs.map((slug) => `/projects/${slug}`),
    ...blogSlugs.map((slug) => `/blog/${slug}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE_URL}${url}</loc></url>`).join('\n')}
</urlset>
`;

  writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
  console.log(`[sitemap] Wrote sitemap.xml with ${urls.length} URLs (${projectSlugs.length} projects, ${blogSlugs.length} posts).`);

  const robotsPath = path.join(publicDir, 'robots.txt');
  const robotsBase = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf-8').replace(/\nSitemap:.*\n?$/, '\n') : 'User-agent: *\nAllow: /\nDisallow: /admin/\n';
  writeFileSync(robotsPath, `${robotsBase.trimEnd()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log('[sitemap] Updated robots.txt with Sitemap directive.');
}

main();
