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
import { TransfersService } from '../src/transfers/transfers.service.js';
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

    const first = await transfer(key, '50.00').expect(201);
    const repeat = await transfer(key, '50.00').expect(201);

    expect(first.body).toMatchObject({ fromWalletId, toWalletId, amount: '50.00', currency: 'KZT' });
    expect(first.body.id).toEqual(expect.any(String));
    // The repeat gets the very same transfer back
    expect(repeat.body).toEqual(first.body);

    expect(await balanceOf(fromWalletId)).toBe('850.00');
    expect(await balanceOf(toWalletId)).toBe('150.00');
  });

  // Sends 50 duplicates of one 25.00 transfer at once through `send`, which returns the id each
  // of them got, and checks that together they made exactly one transfer
  const expectOneTransfer = async (send: (key: string) => Promise<string>) => {
    const key = newKey();
    const wallets = [fromWalletId, toWalletId];

    const transfersOfWallet = () =>
      db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, fromWalletId));
    const ledgerOfWallets = () =>
      db.select().from(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, wallets));

    const transfersBefore = (await transfersOfWallet()).length;
    const ledgerBefore = (await ledgerOfWallets()).length;
    const senderBefore = await balanceOf(fromWalletId);
    const receiverBefore = await balanceOf(toWalletId);

    // Promise.all rejects if any duplicate fails, so reaching the next line means all 50 succeeded
    const ids = new Set(await Promise.all(Array.from({ length: 50 }, () => send(key))));

    // Every successful answer carries the same transfer id
    expect(ids.size).toBe(1);

    const [transferId] = ids;

    expect(transferId).toEqual(expect.any(String));

    // Exactly one transfer exists
    expect(await transfersOfWallet()).toHaveLength(transfersBefore + 1);

    // Exactly two ledger entries were written, both for that transfer
    const entries = await db.select().from(ledgerEntrySchema).where(eq(ledgerEntrySchema.transferId, transferId));

    expect(await ledgerOfWallets()).toHaveLength(ledgerBefore + 2);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.amount)).toEqual(expect.arrayContaining([-2500n, 2500n]));

    // The money moved once
    expect(Number(await balanceOf(fromWalletId))).toBe(Number(senderBefore) - 25);
    expect(Number(await balanceOf(toWalletId))).toBe(Number(receiverBefore) + 25);
  };

  it('runs one transfer for 50 simultaneous HTTP requests with the same key', async () => {
    await expectOneTransfer(async (key) => (await transfer(key, '25.00').expect(201)).body.id);
  });

  // Over HTTP on a fast local database the duplicates can reach the service one after another,
  // which is an ordinary retry. Calling the service directly starts all 50 transactions before
  // any of them commits, so 49 of them really do find the key taken by a transaction in flight
  it('runs one transfer for 50 concurrent service calls with the same key', async () => {
    const service = app.get(TransfersService);
    const dto = { fromWalletId, toWalletId, amount: '25.00', currency: 'KZT' };

    await expectOneTransfer(async (key) => {
      const result = await service.create(dto, key);

      if (!result) {
        throw new Error('The transfer was not returned');
      }

      return result.id;
    });
  });

  it('lists the transfers of a wallet for the sender and for the receiver, newest first', async () => {
    const created = await transfer(newKey(), '1.00').expect(201);

    const listOf = async (walletId: string) =>
      (await request(app.getHttpServer()).get(`/wallets/${walletId}/transfers`).expect(200)).body;

    const sent = await listOf(fromWalletId);
    const received = await listOf(toWalletId);
    const total = await db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, fromWalletId));

    expect(sent).toHaveLength(total.length);
    expect(sent[0]).toEqual(created.body);
    expect(received).toEqual(sent);

    // The same transfer can be read by its id
    const one = await request(app.getHttpServer()).get(`/transfers/${created.body.id}`).expect(200);

    expect(one.body).toEqual(created.body);
  });

  it('lets the database refuse a third ledger entry or an entry with the wrong sign', async () => {
    const created = await transfer(newKey(), '2.00').expect(201);
    const transferId: string = created.body.id;

    const entries = await db.select().from(ledgerEntrySchema).where(eq(ledgerEntrySchema.transferId, transferId));

    expect(entries.map((entry) => [entry.direction, entry.amount])).toEqual(
      expect.arrayContaining([['debit', -200n], ['credit', 200n]]),
    );

    const insert = (direction: string, amount: bigint) =>
      db.insert(ledgerEntrySchema).values({ transferId, walletId: fromWalletId, direction, amount });

    // The constraint name is in the driver's error, which Drizzle keeps as the cause
    const constraintOf = async (query: Promise<unknown>) =>
      query.then(() => 'accepted', (error: { cause?: { constraint?: string } }) => error.cause?.constraint);

    const unique = 'ledger_entries_transfer_id_direction_unique';
    const sign = 'ledger_entries_direction_matches_amount';

    expect(await constraintOf(insert('debit', -200n))).toBe(unique);
    expect(await constraintOf(insert('credit', 200n))).toBe(unique);
    expect(await constraintOf(insert('debit', 200n))).toBe(sign);
    expect(await constraintOf(insert('credit', -200n))).toBe(sign);
    expect(await constraintOf(insert('other', 200n))).toBe(sign);

    expect(await db.select().from(ledgerEntrySchema).where(eq(ledgerEntrySchema.transferId, transferId))).toHaveLength(2);
  });
});
