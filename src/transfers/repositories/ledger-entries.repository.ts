import { InjectDrizzle } from '@nestjs/drizzle';
import type { DatabaseExecutor } from '../../database/database.module.js';
import { NewLedgerEntryRecord } from '../interfaces/ledger-entry.interface.js';
import { ledgerEntrySchema } from '../../database/schema/index.js';
import { toMinor } from '../../common/money.js';

export class LedgerEntriesRepository {
  constructor(@InjectDrizzle() private readonly db: DatabaseExecutor) {}

  async create(data: NewLedgerEntryRecord) {
    const debit = data.amount.startsWith('-')
    const minor = toMinor(debit ? data.amount.slice(1) : data.amount)

    const [row] = await this.db
      .insert(ledgerEntrySchema)
      .values({
        transferId: data.transferId,
        amount: debit ? -minor : minor,
        walletId: data.walletId,
      })
      .returning()

    return row
  }
}
