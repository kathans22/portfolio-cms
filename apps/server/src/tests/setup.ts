import mongoose from 'mongoose';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { clearResolveCache } from '../modules/resolve/resolveCache';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  // These deletes go through the raw driver, so they bypass the Mongoose middleware that
  // busts the resolve cache. Without this, a page cached by one test would be served to
  // the next one against an empty database — a confusing, order-dependent failure.
  clearResolveCache();
});

afterAll(async () => {
  await mongoose.disconnect();
});
