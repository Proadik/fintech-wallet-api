import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { userSchema } from './user.schema.js';

export const walletSchema = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => userSchema.id),
  currency: varchar('currency', { length: 3 }).notNull(),
  balanceMinor: bigint('balance_minor', { mode: 'bigint' }).notNull().default(sql`0`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('wallets_user_id_currency_unique').on(table.userId, table.currency),
  check('wallets_balance_minor_non_negative', sql`${table.balanceMinor} >= 0`),
  check('wallets_currency_allowed', sql`${table.currency} IN ('USD', 'EUR', 'KZT')`),
])
