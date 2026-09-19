import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

/**
 * Site-wide chrome that isn't page content — currently the browser-tab favicon.
 * A singleton keyed by `key`, like the profile photo, so there is exactly one row.
 */
export interface SiteSettingsAttrs {
  key: 'site';
  /** Exactly what the admin pasted (e.g. a Drive share link), shown back to them. */
  faviconSourceUrl?: string;
  /** The direct image address the server actually fetches. */
  faviconUrl?: string;
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<SiteSettingsAttrs>(
  {
    key: { type: String, enum: ['site'], required: true, unique: true },
    faviconSourceUrl: String,
    faviconUrl: String,
  },
  withJsonId({ timestamps: { createdAt: false, updatedAt: true } })
);

export const SiteSettings = model<SiteSettingsAttrs>('SiteSettings', SiteSettingsSchema);
export type SiteSettingsDoc = HydratedDocument<SiteSettingsAttrs>;
