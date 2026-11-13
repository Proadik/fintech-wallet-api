import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { transferSchema } from './transfer.schema.js';
import { walletSchema } from './wallet.schema.js';

export const ledgerEntrySchema = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').notNull().references(() => transferSchema.id),
  walletId: uuid('wallet_id').notNull().references(() => walletSchema.id),
  direction: varchar('direction', { length: 6 }).notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  // One debit and one credit per transfer at most: no third entry, no two entries of one kind
  unique('ledger_entries_transfer_id_direction_unique').on(table.transferId, table.direction),
  // The sign of the amount follows the direction, so the two entries cannot have the same sign
  check(
    'ledger_entries_direction_matches_amount',
    sql`(${table.direction} = 'debit' AND ${table.amount} < 0) OR (${table.direction} = 'credit' AND ${table.amount} > 0)`,
  ),
]);
