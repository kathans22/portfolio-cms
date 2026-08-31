import { SchemaOptions } from 'mongoose';

// Every model uses this so API responses expose a string `id` field (matching what
// the client already expects from the pre-Mongo cuid-based contract) instead of
// Mongo's raw `_id`/`__v`.
export function withJsonId(options: SchemaOptions = {}): SchemaOptions {
  return {
    ...options,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = (ret._id as { toString(): string }).toString();
        delete ret._id;
      },
    },
  };
}
