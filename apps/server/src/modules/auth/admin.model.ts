import { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';

export interface RefreshTokenAttrs {
  tokenHash: string; // sha256 hash of the raw refresh token, never the raw value
  expiresAt: Date;
}

export interface AdminAttrs {
  email: string;
  passwordHash: string;
  name: string;
  refreshTokens: RefreshTokenAttrs[];
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenAttrs>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  withJsonId({ timestamps: true, _id: true })
);

const AdminSchema = new Schema<AdminAttrs>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
  },
  withJsonId({ timestamps: true })
);

export const Admin = model<AdminAttrs>('Admin', AdminSchema);
export type AdminDoc = HydratedDocument<AdminAttrs>;
