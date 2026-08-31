import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

export interface AuditLogAttrs {
  event: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE';
  email: string;
  ip: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogAttrs>(
  {
    event: { type: String, enum: ['LOGIN_SUCCESS', 'LOGIN_FAILURE'], required: true },
    email: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: String,
  },
  withJsonId({ timestamps: { createdAt: true, updatedAt: false } })
);

export const AuditLog = model<AuditLogAttrs>('AuditLog', AuditLogSchema);
export type AuditLogDoc = HydratedDocument<AuditLogAttrs>;
