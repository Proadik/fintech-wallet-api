import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { App } from 'supertest/types.js';
import { createDbApp } from './create-db-app.js';
import type { Database } from '../src/database/database.module.js';
import { transferSchema, userSchema, walletSchema } from '../src/database/schema/index.js';
import { TransactionRunner } from '../src/common/transactions/transaction-runner.js';
import { UsersService } from '../src/users/users.service.js';
import { WalletsService } from '../src/wallets/wallets.service.js';

describe('TransactionRunner on PostgreSQL', () => {
  let app: INestApplication<App>;
  let db: Database;
  let runner: TransactionRunner;
  let userId: string;
  let fromWalletId: string;
  let toWalletId: string;

  const transfersOfWallet = () =>
    db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, fromWalletId));

  beforeAll(async () => {
    ({ app, db } = await createDbApp());
    runner = app.get(TransactionRunner);

    userId = (await app.get(UsersService).create({
      email: `tx-${randomUUID()}@example.com`,
      firstName: 'Tx',
      lastName: 'Test',
    })).id;

    const wallets = app.get(WalletsService);
    fromWalletId = (await wallets.create({ userId, currency: 'USD' })).id;
    toWalletId = (await wallets.create({ userId, currency: 'EUR' })).id;
  });

  afterEach(async () => {
    await db.delete(transferSchema).where(inArray(transferSchema.fromWalletId, [fromWalletId]));
  });

  afterAll(async () => {
    await db.delete(walletSchema).where(eq(walletSchema.userId, userId));
    await db.delete(userSchema).where(eq(userSchema.id, userId));
    await app.close();
  });

  const newTransfer = () => ({ fromWalletId, toWalletId, amount: '10.50', currency: 'USD' });

  it('commits what the repositories wrote when the work resolves', async () => {
    const transfer = await runner.run(({ transfers }) => transfers.create(newTransfer()));

    expect(transfer.amount).toBe('10.50');
    expect(await transfersOfWallet()).toHaveLength(1);
  });

  it('rolls back everything when the work throws', async () => {
    await expect(runner.run(async ({ transfers }) => {
      await transfers.create(newTransfer());
      await transfers.create(newTransfer());

      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(await transfersOfWallet()).toHaveLength(0);
  });

  it('keeps uncommitted writes invisible outside the transaction, and reads inside see them', async () => {
    await runner.run(async ({ transfers, wallets }) => {
      await transfers.create(newTransfer());

      // Outside: the pool connection does not see the uncommitted row
      expect(await transfersOfWallet()).toHaveLength(0);
      // Inside: the transactional repositories work on the same connection
      expect((await wallets.findById(fromWalletId))?.id).toBe(fromWalletId);
    });

    expect(await transfersOfWallet()).toHaveLength(1);
  });
});
