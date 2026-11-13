import { TransfersRepository } from './transfers.repository.js';
import { NewTransfer, Transfer } from '../interfaces/transfer.interface.js';
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { DatabaseExecutor } from '../../database/database.module.js';
import { rethrowUniqueViolation } from '../../database/unique-violation.js';
import { transferSchema } from '../../database/schema/index.js';
import { toDecimal, toMinor } from '../../common/money.js';
import { desc, eq, or } from 'drizzle-orm';

type TransferRow = typeof transferSchema.$inferSelect

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
    );

    return this.toTransfer(row);
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(transferSchema)
      .where(eq(transferSchema.id, id));

    return row && this.toTransfer(row);
  }

  async findByWalletId(walletId: string) {
    const rows = await this.db
      .select()
      .from(transferSchema)
      .where(or(eq(transferSchema.fromWalletId, walletId), eq(transferSchema.toWalletId, walletId)))
      .orderBy(desc(transferSchema.createdAt));

    return rows.map((row) => this.toTransfer(row));
  }

  private toTransfer(row: TransferRow): Transfer {
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
