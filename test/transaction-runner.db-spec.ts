import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { App } from 'supertest/types.js';
import { createDbApp } from './create-db-app.js';
import type { Database } from '../src/database/database.module.js';
import { idempotencyRecordsSchema } from '../src/database/schema/index.js';
import { TransactionRunner } from '../src/common/transactions/transaction-runner.js';

// Idempotency records stand in for "something a repository wrote": they need no other rows
describe('TransactionRunner on PostgreSQL', () => {
  const keys: string[] = [];

  let app: INestApplication<App>;
  let db: Database;
  let runner: TransactionRunner;

  const newRecord = () => {
    const key = randomUUID();
    keys.push(key);

    return { key, requestHash: 'test', transferId: null };
  };

  const stored = (recordKeys: string[]) =>
    db.select().from(idempotencyRecordsSchema).where(inArray(idempotencyRecordsSchema.key, recordKeys));

  beforeAll(async () => {
    ({ app, db } = await createDbApp());
    runner = app.get(TransactionRunner);
  });

  afterAll(async () => {
    await db.delete(idempotencyRecordsSchema).where(inArray(idempotencyRecordsSchema.key, keys));
    await app.close();
  });

  it('commits what the repositories wrote when the work resolves', async () => {
    const record = newRecord();

    const created = await runner.run(({ idempotency }) => idempotency.create(record));

    expect(created?.key).toBe(record.key);
    expect(await stored([record.key])).toHaveLength(1);
  });

  it('rolls back everything when the work throws', async () => {
    const first = newRecord();
    const second = newRecord();

    await expect(runner.run(async ({ idempotency }) => {
      await idempotency.create(first);
      await idempotency.create(second);

      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(await stored([first.key, second.key])).toHaveLength(0);
  });

  it('keeps uncommitted writes invisible outside the transaction, and reads inside see them', async () => {
    const record = newRecord();

    await runner.run(async ({ idempotency }) => {
      await idempotency.create(record);

      // Outside: the pool connection does not see the uncommitted row
      expect(await stored([record.key])).toHaveLength(0);
      // Inside: the transactional repositories work on the same connection
      expect((await idempotency.find(record.key))?.key).toBe(record.key);
    });

    expect(await stored([record.key])).toHaveLength(1);
  });
});
