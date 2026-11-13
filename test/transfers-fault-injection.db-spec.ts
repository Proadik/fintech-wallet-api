import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { TransactionalRepositories, TransactionRunner } from '../src/common/transactions/transaction-runner.js';
import type { Database } from '../src/database/database.module.js';
import {
  idempotencyRecordsSchema,
  ledgerEntrySchema,
  transferSchema,
  walletSchema,
} from '../src/database/schema/index.js';
import { TransfersRepository } from '../src/transfers/repositories/transfers.repository.js';
import { TransfersService } from '../src/transfers/transfers.service.js';
import { WalletsService } from '../src/wallets/wallets.service.js';
import { createDbApp } from './create-db-app.js';
import { createTestData } from './test-data.js';

type RepositoryName = keyof TransactionalRepositories;

// The n-th call of one repository method inside the transaction
interface Step {
  repository: RepositoryName;
  method: string;
  call: number;
}

class InjectedFault extends Error {}

// Runs the work in a real PostgreSQL transaction, but makes one chosen repository call fail
// right after its statement has been executed, as a crash or a lost connection would
class FaultyTransactionRunner extends TransactionRunner {
  executed: string[] = [];

  constructor (private readonly real: TransactionRunner, private readonly failAfter: Step) {
    super();
  }

  run<T> (work: (repos: TransactionalRepositories) => Promise<T>) {
    const calls = new Map<string, number>();

    const wrap = <R extends object>(repository: RepositoryName, target: R) =>
      new Proxy(target, {
        get: (object, property, receiver) => {
          const value: unknown = Reflect.get(object, property, receiver);

          if (typeof value !== 'function' || typeof property !== 'string') {
            return value;
          }

          return async (...args: unknown[]) => {
            const name = `${repository}.${property}`;
            const call = (calls.get(name) ?? 0) + 1;

            calls.set(name, call);

            const result: unknown = await Reflect.apply(value, object, args);

            this.executed.push(name);

            const { failAfter } = this;

            if (failAfter.repository === repository && failAfter.method === property && failAfter.call === call) {
              throw new InjectedFault(`fault after ${name} #${call}`);
            }

            return result;
          };
        },
      });

    return this.real.run((repos) => work({
      wallets: wrap('wallets', repos.wallets),
      transfers: wrap('transfers', repos.transfers),
      idempotency: wrap('idempotency', repos.idempotency),
      ledgerEntries: wrap('ledgerEntries', repos.ledgerEntries),
    }));
  }
}

// Every statement of a transfer, in the order the service issues them
const STEPS: [string, Step, number][] = [
  ['INSERT idempotency key', { repository: 'idempotency', method: 'create', call: 1 }, 1],
  ['SELECT wallets FOR UPDATE', { repository: 'wallets', method: 'lockByIds', call: 1 }, 2],
  ['UPDATE sender balance', { repository: 'wallets', method: 'decreaseBalance', call: 1 }, 3],
  ['UPDATE receiver balance', { repository: 'wallets', method: 'increaseBalance', call: 1 }, 4],
  ['INSERT transfer', { repository: 'transfers', method: 'create', call: 1 }, 5],
  ['INSERT ledger debit', { repository: 'ledgerEntries', method: 'create', call: 1 }, 6],
  ['INSERT ledger credit', { repository: 'ledgerEntries', method: 'create', call: 2 }, 7],
  ['UPDATE idempotency key with the transfer', { repository: 'idempotency', method: 'update', call: 1 }, 8],
];

describe('Transfers fault injection (PostgreSQL)', () => {
  const data = createTestData();

  let app: INestApplication<App>;
  let db: Database;
  let fromWalletId: string;
  let toWalletId: string;

  const createWallet = async (name: string) => {
    const user = await request(app.getHttpServer())
      .post('/users')
      .send({ email: data.email(name), firstName: 'Fault', lastName: 'Test' })
      .expect(201);

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .send({ userId: user.body.id, currency: 'KZT' })
      .expect(201);

    return wallet.body.id as string;
  };

  // Everything a transfer writes, read straight from the tables
  const stateOf = async (key: string) => {
    const wallets = [fromWalletId, toWalletId];
    const balances = await db.select().from(walletSchema).where(inArray(walletSchema.id, wallets));

    return {
      sender: balances.find((wallet) => wallet.id === fromWalletId)?.balanceMinor,
      receiver: balances.find((wallet) => wallet.id === toWalletId)?.balanceMinor,
      transfers: (await db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, fromWalletId))).length,
      ledgerEntries: (await db.select().from(ledgerEntrySchema).where(inArray(ledgerEntrySchema.walletId, wallets))).length,
      keys: (await db.select().from(idempotencyRecordsSchema).where(eq(idempotencyRecordsSchema.key, key))).length,
    };
  };

  // The real service on the real database, with a transaction runner that fails at `step`
  const serviceFailingAfter = (step: Step) => {
    const runner = new FaultyTransactionRunner(app.get(TransactionRunner), step);

    const service = new TransfersService(
      runner,
      app.get(TransfersRepository, { strict: false }),
      app.get(WalletsService, { strict: false }),
    );

    return { service, runner };
  };

  beforeAll(async () => {
    ({ app, db } = await createDbApp());

    fromWalletId = await createWallet('sender');
    toWalletId = await createWallet('receiver');

    // 1000.00 KZT to send from
    await db.update(walletSchema).set({ balanceMinor: 100000n }).where(eq(walletSchema.id, fromWalletId));
  });

  afterAll(async () => {
    await data.cleanup(db);
    await app.close();
  });

  it.each(STEPS)('rolls everything back when the transaction fails after: %s', async (_, step, executedStatements) => {
    const key = randomUUID();
    const dto = { fromWalletId, toWalletId, amount: '100.00', currency: 'KZT' };
    const before = await stateOf(key);
    const { service, runner } = serviceFailingAfter(step);

    await expect(service.create(dto, key)).rejects.toThrow(InjectedFault);

    // The statements up to and including the failed step really ran inside the transaction
    expect(runner.executed).toHaveLength(executedStatements);

    // ...and none of them survived: balances, transfer, ledger and key are as they were
    expect(await stateOf(key)).toEqual(before);
    expect(before.keys).toBe(0);

    // The key was rolled back too, so the client can retry the very same request
    const transfer = await app.get(TransfersService).create(dto, key);

    expect(transfer).toMatchObject({ fromWalletId, toWalletId, amount: '100.00' });
    expect(await stateOf(key)).toEqual({
      sender: before.sender! - 10000n,
      receiver: before.receiver! + 10000n,
      transfers: before.transfers + 1,
      ledgerEntries: before.ledgerEntries + 2,
      keys: 1,
    });
  });

  // The scenario spelled out: BEGIN, key, both balances, transfer, ledger debit, ERROR, ROLLBACK
  it('leaves no debit without a credit when it fails between the two ledger entries', async () => {
    const key = randomUUID();
    const before = await stateOf(key);
    const { service, runner } = serviceFailingAfter({ repository: 'ledgerEntries', method: 'create', call: 1 });

    await expect(
      service.create({ fromWalletId, toWalletId, amount: '100.00', currency: 'KZT' }, key),
    ).rejects.toThrow('fault after ledgerEntries.create #1');

    expect(runner.executed).toEqual([
      'idempotency.create',
      'wallets.lockByIds',
      'wallets.decreaseBalance',
      'wallets.increaseBalance',
      'transfers.create',
      'ledgerEntries.create',
    ]);

    const after = await stateOf(key);

    expect(after.sender).toBe(before.sender);
    expect(after.receiver).toBe(before.receiver);
    expect(after.transfers).toBe(before.transfers);
    expect(after.ledgerEntries).toBe(before.ledgerEntries);
    expect(after.keys).toBe(0);
  });
});
