import { describe, it, expect } from 'vitest';
import { extractDriveFileId, normalizeImageUrl, drivePreviewUrl, driveDownloadUrl } from '@portfolio/shared';

const ID = '1AbCdEfGhIjKlMnOpQrSt';

describe('drive links', () => {
  it('extracts the id from share, open and uc links', () => {
    expect(extractDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID);
    expect(extractDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID);
    expect(extractDriveFileId(`https://drive.google.com/uc?export=download&id=${ID}`)).toBe(ID);
  });
  it('rejects non-drive links and folders', () => {
    expect(extractDriveFileId('https://example.com/a.pdf')).toBeNull();
    expect(extractDriveFileId('https://drive.google.com/drive/folders/abc')).toBeNull();
    expect(extractDriveFileId('not a url')).toBeNull();
  });
  it('builds per-type addresses', () => {
    expect(normalizeImageUrl(`https://drive.google.com/file/d/${ID}/view`)).toBe(`https://lh3.googleusercontent.com/d/${ID}=w1600`);
    expect(normalizeImageUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
    expect(drivePreviewUrl(ID)).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(driveDownloadUrl(ID)).toContain(`id=${ID}`);
  });
});
