import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/**
 * The home page portrait. A singleton, keyed by `slot`, rather than an entry in the
 * general media library — deleting a library item must never be able to blank the
 * hero, and replacing the hero must be able to delete the file it replaced.
 */
export interface ProfilePhotoAttrs {
  slot: 'hero';
  url: string;
  /** `external` = a pasted link (e.g. Google Drive). We store nothing, so delete nothing. */
  provider: 'local' | 'cloudinary' | 'external';
  /** Local filename or Cloudinary public_id — what the old asset is deleted by. Empty for links. */
  storageKey: string;
  /** For links: exactly what the admin pasted, shown back to them. */
  sourceUrl?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  updatedAt: Date;
}

const ProfilePhotoSchema = new Schema<ProfilePhotoAttrs>(
  {
    slot: { type: String, enum: ['hero'], required: true, unique: true },
    url: { type: String, required: true },
    provider: { type: String, enum: ['local', 'cloudinary', 'external'], required: true },
    storageKey: { type: String, default: '' },
    sourceUrl: String,
    originalName: String,
    mimeType: String,
    size: Number,
  },
  withJsonId({ timestamps: { createdAt: false, updatedAt: true } })
);

export const ProfilePhoto = model<ProfilePhotoAttrs>('ProfilePhoto', ProfilePhotoSchema);
export type ProfilePhotoDoc = HydratedDocument<ProfilePhotoAttrs>;
