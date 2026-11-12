import { bigint, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { transferSchema } from './transfer.schema.js';
import { walletSchema } from './wallet.schema.js';

export const ledgerEntrySchema = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').notNull().references(() => transferSchema.id),
  walletId: uuid('wallet_id').notNull().references(() => walletSchema.id),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
