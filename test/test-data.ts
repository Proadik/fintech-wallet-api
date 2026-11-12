import { randomUUID } from 'node:crypto';
import { inArray, like } from 'drizzle-orm';
import type { Database } from '../src/database/database.module.js';
import { userSchema, walletSchema } from '../src/database/schema/index.js';

// The tests share a database with other data, so every spec file marks the users it creates
// with its own email domain and removes only those rows afterwards
export function createTestData () {
  const domain = `${randomUUID()}.test`

  return {
    email: (name: string) => `${name}@${domain}`,

    async cleanup (db: Database) {
      const users = db.select({ id: userSchema.id }).from(userSchema).where(like(userSchema.email, `%@${domain}`))

      await db.delete(walletSchema).where(inArray(walletSchema.userId, users))
      await db.delete(userSchema).where(like(userSchema.email, `%@${domain}`))
    },
  }
}
