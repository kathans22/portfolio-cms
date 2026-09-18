import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { UPLOADS_DIR } from '../config/paths';

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.info('Cloudinary successfully initialized.');
} else {
  logger.warn('Cloudinary credentials missing in env. Falling back to local storage file path URLs.');
}

export type CloudResourceType = 'image' | 'raw' | 'auto' | 'video';

export interface UploadResult {
  url: string;
  provider: 'local' | 'cloudinary';
  storageKey: string; // local filename, or Cloudinary public_id — needed to delete later
  // The resource_type Cloudinary actually filed the asset under. Needed to delete it
  // again: destroy() defaults to 'image' and silently no-ops on a mismatched type.
  resourceType?: string;
}

export interface UploadOptions {
  folder?: string;
  // Non-image uploads (PDFs, etc.) must pass 'auto' or 'raw' — the default 'image'
  // pipeline rejects or mangles them.
  resourceType?: CloudResourceType;
}

export async function uploadToCloud(
  localFilePath: string,
  filename: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!isCloudinaryConfigured) {
    return { url: `/uploads/${filename}`, provider: 'local', storageKey: filename, resourceType: 'local' };
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      folder: options.folder ?? 'portfolio',
      resource_type: options.resourceType ?? 'image',
      use_filename: true,
      unique_filename: true,
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return {
      url: uploadResult.secure_url,
      provider: 'cloudinary',
      storageKey: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
    };
  } catch (error) {
    logger.error({ err: error }, 'Cloudinary upload failure');
    return { url: `/uploads/${filename}`, provider: 'local', storageKey: filename, resourceType: 'local' };
  }
}

export async function deleteFromCloud(
  provider: 'local' | 'cloudinary',
  storageKey: string,
  resourceType: 'image' | 'raw' | 'video' = 'image'
): Promise<void> {
  if (provider === 'cloudinary' && isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(storageKey, { resource_type: resourceType }).catch((err) => {
      logger.error({ err }, 'Cloudinary delete failure');
    });
    return;
  }

  const localPath = path.join(UPLOADS_DIR, storageKey);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
}
