import { TransfersRepository } from './transfers.repository.js';
import { NewTransfer, Transfer } from '../interfaces/transfer.interface.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { DatabaseExecutor } from '../../database/database.module.js';
import { rethrowUniqueViolation } from '../../database/unique-violation.js';
import { transferSchema } from '../../database/schema/index.js';
import { toDecimal, toMinor } from '../../common/money.js';

@Injectable()
export class DrizzleTransfersRepository extends TransfersRepository {
  constructor(@InjectDrizzle() private readonly db: DatabaseExecutor) {
    super();
  }

  async create(data: NewTransfer): Promise<Transfer> {
    const [row] = await rethrowUniqueViolation(
      this.db
        .insert(transferSchema)
        .values({ ...data, amount: toMinor(data.amount) })
        .returning(),
    )

    return {
      id: row.id,
      fromWalletId: row.fromWalletId,
      toWalletId: row.toWalletId,
      amount: toDecimal(row.amount),
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
