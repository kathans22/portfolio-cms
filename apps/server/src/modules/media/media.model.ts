import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

export interface MediaAttrs {
  url: string;
  originalName: string;
  provider: 'local' | 'cloudinary';
  storageKey: string; // local filename, or Cloudinary public_id — needed to delete later
  mimeType?: string;
  size?: number;
  createdAt: Date;
}

const MediaSchema = new Schema<MediaAttrs>(
  {
    url: { type: String, required: true },
    originalName: { type: String, required: true },
    provider: { type: String, enum: ['local', 'cloudinary'], required: true },
    storageKey: { type: String, required: true },
    mimeType: String,
    size: Number,
  },
  withJsonId({ timestamps: { createdAt: true, updatedAt: false } })
);

export const Media = model<MediaAttrs>('Media', MediaSchema);
export type MediaDoc = HydratedDocument<MediaAttrs>;
