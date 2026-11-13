import { randomUUID } from 'node:crypto';
import { inArray, like } from 'drizzle-orm';
import type { Database } from '../src/database/database.module.js';
import {
  idempotencyRecordsSchema,
  ledgerEntrySchema,
  transferSchema,
  userSchema,
  walletSchema,
} from '../src/database/schema/index.js';

// The tests share a database with other data, so every spec file marks the users it creates
// with its own email domain and removes only those rows afterwards
export function createTestData () {
  const domain = `${randomUUID()}.test`

  return {
    email: (name: string) => `${name}@${domain}`,

    // Removes the users of this file with their wallets and everything transferred between them.
    // One transaction: the database checks a transfer against its ledger entries at commit,
    // so deleting the entries and the transfer in separate statements would be refused
    async cleanup (db: Database) {
      const users = db.select({ id: userSchema.id }).from(userSchema).where(like(userSchema.email, `%@${domain}`))
      const wallets = db.select({ id: walletSchema.id }).from(walletSchema).where(inArray(walletSchema.userId, users))
      const transfers = db.select({ id: transferSchema.id }).from(transferSchema).where(inArray(transferSchema.fromWalletId, wallets))

      await db.transaction(async (tx) => {
        await tx.delete(idempotencyRecordsSchema).where(inArray(idempotencyRecordsSchema.transferId, transfers))
        await tx.delete(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, wallets))
        await tx.delete(transferSchema).where(inArray(transferSchema.fromWalletId, wallets))
        await tx.delete(walletSchema).where(inArray(walletSchema.userId, users))
        await tx.delete(userSchema).where(like(userSchema.email, `%@${domain}`))
      })
    },
  }
}
