import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { transferSchema } from './transfer.schema.js';

export const idempotencyRecordsSchema = pgTable('idempotency_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: uuid('key').notNull().unique(),
  requestHash: text('request_hash').notNull(),
  transferId: uuid('transfer_id').references(() => transferSchema.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
