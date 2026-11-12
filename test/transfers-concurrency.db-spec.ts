import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Database } from '../src/database/database.module.js';
import {
  idempotencyRecordsSchema,
  ledgerEntrySchema,
  transferSchema,
  walletSchema,
} from '../src/database/schema/index.js';
import { createDbApp } from './create-db-app.js';
import { createTestData } from './test-data.js';

describe('Transfers concurrency (PostgreSQL)', () => {
  const data = createTestData();
  const keys: string[] = [];
  const walletIds: string[] = [];

  let app: INestApplication<App>;
  let db: Database;

  // A wallet of a new user, with the given balance in minor units
  const createWallet = async (balanceMinor: bigint) => {
    const user = await request(app.getHttpServer())
      .post('/users')
      .send({ email: data.email(randomUUID()), firstName: 'Transfer', lastName: 'Test' })
      .expect(201);

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .send({ userId: user.body.id, currency: 'KZT' })
      .expect(201);

    const id: string = wallet.body.id;

    walletIds.push(id);
    await db.update(walletSchema).set({ balanceMinor }).where(eq(walletSchema.id, id));

    return id;
  };

  // Every call is a separate transfer with a key of its own
  const transfer = (fromWalletId: string, toWalletId: string, amount: string) => {
    const key = randomUUID();
    keys.push(key);

    return request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send({ fromWalletId, toWalletId, amount, currency: 'KZT' });
  };

  const balanceOf = async (id: string) => {
    const [row] = await db.select().from(walletSchema).where(eq(walletSchema.id, id));
    return row.balanceMinor;
  };

  const statusesOf = (responses: { status: number }[]) =>
    responses.reduce<Record<number, number>>((counts, { status }) => {
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});

  const ledgerOf = (ids: string[]) =>
    db.select().from(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, ids));

  beforeAll(async () => {
    ({ app, db } = await createDbApp());
  });

  afterAll(async () => {
    if (keys.length) {
      await db.delete(idempotencyRecordsSchema).where(inArray(idempotencyRecordsSchema.key, keys));
    }

    if (walletIds.length) {
      await db.delete(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, walletIds));
      await db.delete(transferSchema).where(inArray(transferSchema.fromWalletId, walletIds));
    }

    await data.cleanup(db);
    await app.close();
  });

  it('applies 100 concurrent transfers from one wallet exactly once each', async () => {
    const from = await createWallet(100000n); // 1000.00
    const to = await createWallet(0n);

    const responses = await Promise.all(
      Array.from({ length: 100 }, () => transfer(from, to, '10.00')),
    );

    expect(statusesOf(responses)).toEqual({ 201: 100 });
    expect(await balanceOf(from)).toBe(0n);
    expect(await balanceOf(to)).toBe(100000n);

    const transfers = await db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, from));
    const ledger = await ledgerOf([from, to]);

    expect(transfers).toHaveLength(100);
    expect(ledger).toHaveLength(200);
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0n)).toBe(0n);
  });

  it('never overdraws: 100 concurrent transfers with money for only 50', async () => {
    const from = await createWallet(50000n); // 500.00
    const to = await createWallet(0n);

    const responses = await Promise.all(
      Array.from({ length: 100 }, () => transfer(from, to, '10.00')),
    );

    expect(statusesOf(responses)).toEqual({ 201: 50, 422: 50 });
    expect(await balanceOf(from)).toBe(0n);
    expect(await balanceOf(to)).toBe(50000n);

    // The rejected transfers left nothing behind
    const transfers = await db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, from));

    expect(transfers).toHaveLength(50);
    expect(await ledgerOf([from, to])).toHaveLength(100);
  });

  it('handles opposite transfers between two wallets without deadlocks', async () => {
    const a = await createWallet(100000n); // 1000.00
    const b = await createWallet(100000n);

    // 50 transfers A → B of 7.00 against 50 transfers B → A of 3.00, interleaved
    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        i % 2 === 0 ? transfer(a, b, '7.00') : transfer(b, a, '3.00'),
      ),
    );

    expect(statusesOf(responses)).toEqual({ 201: 100 });
    expect(await balanceOf(a)).toBe(100000n - 35000n + 15000n);
    expect(await balanceOf(b)).toBe(100000n + 35000n - 15000n);

    const ledger = await ledgerOf([a, b]);

    expect(ledger).toHaveLength(200);
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0n)).toBe(0n);
  });
});
