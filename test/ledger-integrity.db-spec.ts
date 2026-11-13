import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Database, Transaction } from '../src/database/database.module.js';
import { ledgerEntrySchema, transferSchema } from '../src/database/schema/index.js';
import { createDbApp } from './create-db-app.js';
import { createTestData } from './test-data.js';

const CONSTRAINT = 'ledger_entries_match_transfer';

// What the database itself guarantees about a transfer and its ledger entries, whatever the
// application does: these tests write to the tables directly, past the service
describe('Ledger integrity (PostgreSQL)', () => {
  const data = createTestData();

  let app: INestApplication<App>;
  let db: Database;
  let from: string;
  let to: string;
  let other: string;

  const createWallet = async (name: string) => {
    const user = await request(app.getHttpServer())
      .post('/users')
      .send({ email: data.email(name), firstName: 'Ledger', lastName: 'Test' })
      .expect(201);

    const wallet = await request(app.getHttpServer())
      .post('/wallets')
      .send({ userId: user.body.id, currency: 'KZT' })
      .expect(201);

    return wallet.body.id as string;
  };

  // A transfer of 100.00 written straight into the table
  const insertTransfer = async (tx: Transaction) => {
    const [row] = await tx
      .insert(transferSchema)
      .values({ fromWalletId: from, toWalletId: to, amount: 10000n, currency: 'KZT' })
      .returning();

    return row.id;
  };

  const entry = (transferId: string, direction: 'debit' | 'credit', walletId: string, amount: bigint) =>
    ({ transferId, direction, walletId, amount });

  // The name of the constraint that refused the transaction, or 'committed'
  const outcomeOf = (work: (tx: Transaction) => Promise<unknown>) =>
    db.transaction(work).then(
      () => 'committed',
      (error: { cause?: { constraint?: string; message?: string }; constraint?: string; message?: string }) =>
        error.cause?.constraint ?? error.constraint ?? `failed: ${error.cause?.message ?? error.message}`,
    );

  const transfersCount = async () =>
    (await db.select().from(transferSchema).where(eq(transferSchema.fromWalletId, from))).length;

  beforeAll(async () => {
    ({ app, db } = await createDbApp());

    from = await createWallet('from');
    to = await createWallet('to');
    other = await createWallet('other');
  });

  afterAll(async () => {
    await data.cleanup(db);
    await app.close();
  });

  it('accepts a transfer with a matching debit and credit', async () => {
    expect(await outcomeOf(async (tx) => {
      const id = await insertTransfer(tx);

      await tx.insert(ledgerEntrySchema).values([
        entry(id, 'debit', from, -10000n),
        entry(id, 'credit', to, 10000n),
      ]);
    })).toBe('committed');
  });

  it.each<[string, (id: string) => ReturnType<typeof entry>[]]>([
    ['has no ledger entries', () => []],
    ['has only the debit', (id) => [entry(id, 'debit', from, -10000n)]],
    ['has only the credit', (id) => [entry(id, 'credit', to, 10000n)]],
    ['has a credit larger than the debit', (id) => [entry(id, 'debit', from, -10000n), entry(id, 'credit', to, 20000n)]],
    ['has entries of another amount than the transfer', (id) => [entry(id, 'debit', from, -5000n), entry(id, 'credit', to, 5000n)]],
    ['debits a wallet that is not the sender', (id) => [entry(id, 'debit', other, -10000n), entry(id, 'credit', to, 10000n)]],
    ['credits a wallet that is not the receiver', (id) => [entry(id, 'debit', from, -10000n), entry(id, 'credit', other, 10000n)]],
    ['has the sender and the receiver swapped', (id) => [entry(id, 'debit', to, -10000n), entry(id, 'credit', from, 10000n)]],
  ])('refuses to commit a transfer that %s', async (_, entriesOf) => {
    const before = await transfersCount();

    expect(await outcomeOf(async (tx) => {
      const entries = entriesOf(await insertTransfer(tx));

      if (entries.length) {
        await tx.insert(ledgerEntrySchema).values(entries);
      }
    })).toBe(CONSTRAINT);

    // Nothing of the refused transaction stayed
    expect(await transfersCount()).toBe(before);
  });

  describe('an existing transfer', () => {
    let transferId: string;

    beforeAll(async () => {
      await db.transaction(async (tx) => {
        transferId = await insertTransfer(tx);

        await tx.insert(ledgerEntrySchema).values([
          entry(transferId, 'debit', from, -10000n),
          entry(transferId, 'credit', to, 10000n),
        ]);
      });
    });

    const entriesOfTransfer = () =>
      db.select().from(ledgerEntrySchema).where(eq(ledgerEntrySchema.transferId, transferId));

    it('cannot lose a ledger entry', async () => {
      expect(await outcomeOf((tx) =>
        tx.delete(ledgerEntrySchema).where(eq(ledgerEntrySchema.transferId, transferId)),
      )).toBe(CONSTRAINT);

      expect(await entriesOfTransfer()).toHaveLength(2);
    });

    it('cannot have a ledger entry changed', async () => {
      expect(await outcomeOf((tx) =>
        tx.update(ledgerEntrySchema).set({ walletId: other }).where(eq(ledgerEntrySchema.transferId, transferId)),
      )).toBe(CONSTRAINT);
    });

    it('cannot have its amount changed without its entries', async () => {
      expect(await outcomeOf((tx) =>
        tx.update(transferSchema).set({ amount: 99999n }).where(eq(transferSchema.id, transferId)),
      )).toBe(CONSTRAINT);
    });
  });
});
