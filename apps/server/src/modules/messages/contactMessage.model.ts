import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

export interface ContactMessageAttrs {
  name: string;
  email: string;
  subject?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContactMessageSchema = new Schema<ContactMessageAttrs>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: String,
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  withJsonId({ timestamps: true })
);

export const ContactMessage = model<ContactMessageAttrs>('ContactMessage', ContactMessageSchema);
export type ContactMessageDoc = HydratedDocument<ContactMessageAttrs>;
