import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import { logger } from '../utils/logger';

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

export interface UploadResult {
  url: string;
  provider: 'local' | 'cloudinary';
  storageKey: string; // local filename, or Cloudinary public_id — needed to delete later
}

export async function uploadToCloud(localFilePath: string, filename: string): Promise<UploadResult> {
  if (!isCloudinaryConfigured) {
    return { url: `/uploads/${filename}`, provider: 'local', storageKey: filename };
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      folder: 'portfolio',
      use_filename: true,
      unique_filename: true,
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return { url: uploadResult.secure_url, provider: 'cloudinary', storageKey: uploadResult.public_id };
  } catch (error) {
    logger.error({ err: error }, 'Cloudinary upload failure');
    return { url: `/uploads/${filename}`, provider: 'local', storageKey: filename };
  }
}

export async function deleteFromCloud(provider: 'local' | 'cloudinary', storageKey: string): Promise<void> {
  if (provider === 'cloudinary' && isCloudinaryConfigured) {
    await cloudinary.uploader.destroy(storageKey).catch((err) => {
      logger.error({ err }, 'Cloudinary delete failure');
    });
    return;
  }

  const localPath = `${__dirname}/../../../../uploads/${storageKey}`;
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
}
