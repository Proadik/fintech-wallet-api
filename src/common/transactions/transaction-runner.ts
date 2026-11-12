import { TransfersRepository } from '../../transfers/repositories/transfers.repository.js';
import { WalletsRepository } from '../../wallets/repositories/wallets.repository.js';
import { IdempotencyRecordsRepository } from '../../transfers/repositories/idempotency-records.repository.js';
import { LedgerEntriesRepository } from '../../transfers/repositories/ledger-entries.repository.js';

// Repositories whose every query runs inside one database transaction
export interface TransactionalRepositories {
  wallets: WalletsRepository;
  transfers: TransfersRepository;
  idempotency: IdempotencyRecordsRepository;
  ledgerEntries: LedgerEntriesRepository;
}

// The transaction boundary of a business operation. Everything done through `repos`
// is committed together when `work` resolves and rolled back together when it throws
export abstract class TransactionRunner {
  abstract run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>
}
