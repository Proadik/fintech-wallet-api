import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { Database } from './database.module.js';
import { TransactionalRepositories, TransactionRunner } from '../common/transactions/transaction-runner.js';
import { DrizzleTransfersRepository } from '../transfers/repositories/drizzle-transfers.repository.js';
import { DrizzleWalletsRepository } from '../wallets/repositories/drizzle-wallets.repository.js';
import { IdempotencyRecordsRepository } from '../transfers/repositories/idempotency-records.repository.js';
import { LedgerEntriesRepository } from '../transfers/repositories/ledger-entries.repository.js';

@Injectable()
export class DrizzleTransactionRunner extends TransactionRunner {
  constructor (@InjectDrizzle() private readonly db: Database) {
    super()
  }

  // The repositories are built on `tx`, so their queries share its connection and its BEGIN/COMMIT.
  // The injected ones query the pool and would not be part of the transaction
  run<T> (work: (repos: TransactionalRepositories) => Promise<T>) {
    return this.db.transaction(tx => work({
      wallets: new DrizzleWalletsRepository(tx),
      transfers: new DrizzleTransfersRepository(tx),
      idempotency: new IdempotencyRecordsRepository(tx),
      ledgerEntries: new LedgerEntriesRepository(tx)
    }))
  }
}
