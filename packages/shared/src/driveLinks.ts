/**
 * Google Drive link helpers, shared by the server (validation / normalisation on write)
 * and the client (normalisation as an admin pastes a link).
 *
 * A Drive share link opens Google's viewer *page*; an <img> or <iframe> cannot use it
 * directly. Each file type needs a different address derived from the same file id:
 *   - image  -> lh3.googleusercontent.com/d/<id>=w1600   (renders in <img>)
 *   - pdf    -> drive.google.com/file/d/<id>/preview      (embeds in <iframe>)
 *   - pdf    -> drive.google.com/uc?export=download&id=   (download)
 * The file must be shared as "Anyone with the link can view".
 */

const ID_RE = /^[A-Za-z0-9_-]{10,}$/;

/** The Drive file id in a share/open/uc/preview link, or null if this is not a Drive file link. */
export function extractDriveFileId(input: string | undefined | null): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

  const id = url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{10,})/)?.[1] ?? url.searchParams.get('id');
  return id && ID_RE.test(id) ? id : null;
}

export const driveImageUrl = (id: string, width = 1600) =>
  `https://lh3.googleusercontent.com/d/${id}=w${width}`;

export const drivePreviewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;

export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;

/** Drive share link -> direct image address. Anything else comes back unchanged. */
export function normalizeImageUrl(input: string): string {
  const id = extractDriveFileId(input);
  return id ? driveImageUrl(id) : input;
}
