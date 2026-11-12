import { bigint, check, pgTable, timestamp, uuid, varchar, } from 'drizzle-orm/pg-core';
import { walletSchema } from './wallet.schema.js';
import { sql } from 'drizzle-orm';

export const transferSchema = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromWalletId: uuid('from_wallet_id')
      .notNull()
      .references(() => walletSchema.id),
    toWalletId: uuid('to_wallet_id')
      .notNull()
      .references(() => walletSchema.id),
    amount: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status').notNull().default('completed'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('transfers_amount_minor_more_than_zero', sql`${table.amount} > 0`),
    check('transfers_distinct_wallets', sql`${table.fromWalletId} <> ${table.toWalletId}`,),
  ],
);
