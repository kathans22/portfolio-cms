import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

export interface PageViewAttrs {
  path: string;
  referrer?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PageViewSchema = new Schema<PageViewAttrs>(
  {
    path: { type: String, required: true },
    referrer: String,
  },
  withJsonId({ timestamps: true })
);

export const PageView = model<PageViewAttrs>('PageView', PageViewSchema);
export type PageViewDoc = HydratedDocument<PageViewAttrs>;
