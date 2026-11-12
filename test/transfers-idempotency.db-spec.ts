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

describe('Transfers idempotency (PostgreSQL)', () => {
  const data = createTestData();
  const keys: string[] = [];

  let app: INestApplication<App>;
  let db: Database;
  let fromWalletId: string;
  let toWalletId: string;

  const createWallet = async (name: string) => {
    const user = await request(app.getHttpServer())
      .post('/users')
      .send({ email: data.email(name), firstName: 'Transfer', lastName: 'Test' })
      .expect(201);

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .send({ userId: user.body.id, currency: 'KZT' })
      .expect(201);

    return wallet.body.id as string;
  };

  const newKey = () => {
    const key = randomUUID();
    keys.push(key);
    return key;
  };

  const transfer = (key: string, amount: string) =>
    request(app.getHttpServer())
      .post('/transfers')
      .set('Idempotency-Key', key)
      .send({ fromWalletId, toWalletId, amount, currency: 'KZT' });

  const balanceOf = async (id: string) =>
    (await request(app.getHttpServer()).get(`/wallets/${id}`).expect(200)).body.balance;

  beforeAll(async () => {
    ({ app, db } = await createDbApp());

    fromWalletId = await createWallet('sender');
    toWalletId = await createWallet('receiver');

    // 1000.00 KZT to send from
    await db.update(walletSchema).set({ balanceMinor: 100000n }).where(eq(walletSchema.id, fromWalletId));
  });

  afterAll(async () => {
    const wallets = [fromWalletId, toWalletId];

    await db.delete(idempotencyRecordsSchema).where(inArray(idempotencyRecordsSchema.key, keys));
    await db.delete(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, wallets));
    await db.delete(transferSchema).where(inArray(transferSchema.fromWalletId, wallets));
    await data.cleanup(db);
    await app.close();
  });

  it('answers 409 when the key is reused with different request parameters', async () => {
    const key = newKey();

    await transfer(key, '100.00').expect(201);

    const res = await transfer(key, '250.00').expect(409);

    expect(res.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: 'Idempotency key already used with different request parameters',
      path: '/transfers',
    });
    // Only the first request moved money
    expect(await balanceOf(fromWalletId)).toBe('900.00');
    expect(await balanceOf(toWalletId)).toBe('100.00');
  });

  it('does not move money twice when the same request is repeated', async () => {
    const key = newKey();

    await transfer(key, '50.00').expect(201);
    await transfer(key, '50.00').expect(201);

    expect(await balanceOf(fromWalletId)).toBe('850.00');
    expect(await balanceOf(toWalletId)).toBe('150.00');
  });
});
