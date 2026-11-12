import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../database/database.module.js';
import { rethrowUniqueViolation } from '../../database/unique-violation.js';
import { walletSchema } from '../../database/schema/index.js';
import { toDecimal, toMinor } from '../../common/money.js';
import { NewWallet, Wallet } from '../interfaces/wallet.interface.js';
import { WalletsRepository } from './wallets.repository.js';

type WalletRow = typeof walletSchema.$inferSelect

@Injectable()
export class DrizzleWalletsRepository extends WalletsRepository {
  constructor(@InjectDrizzle() private readonly db: DatabaseExecutor) {
    super();
  }

  async create({ userId, currency }: NewWallet) {
    const [row] = await rethrowUniqueViolation(
      this.db.insert(walletSchema).values({ userId, currency }).returning(),
    );

    return this.toWallet(row);
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(walletSchema)
      .where(eq(walletSchema.id, id));
    return row && this.toWallet(row);
  }

  async findByUserId(userId: string) {
    const rows = await this.db
      .select()
      .from(walletSchema)
      .where(eq(walletSchema.userId, userId))
      .orderBy(walletSchema.createdAt);

    return rows.map((row) => this.toWallet(row));
  }

  async lockByIds(ids: string[]) {
    const rows = await this.db
      .select()
      .from(walletSchema)
      .where(inArray(walletSchema.id, ids))
      .orderBy(walletSchema.id)
      .for('update');

    return rows.map((row) => this.toWallet(row));
  }

  async increaseBalance(id: string, amount: string) {
    const [row] = await this.db
      .update(walletSchema)
      .set({
        balanceMinor: sql`${walletSchema.balanceMinor} + ${toMinor(amount)}`,
      })
      .where(eq(walletSchema.id, id))
      .returning();

    return row && this.toWallet(row);
  }

  async decreaseBalance(id: string, amount: string) {
    const minor = toMinor(amount);

    const [row] = await this.db
      .update(walletSchema)
      .set({ balanceMinor: sql`${walletSchema.balanceMinor} - ${minor}` })
      .where(
        and(eq(walletSchema.id, id), gte(walletSchema.balanceMinor, minor)),
      )
      .returning();

    return row && this.toWallet(row);
  }

  private toWallet({ balanceMinor, createdAt, ...row }: WalletRow): Wallet {
    return {
      ...row,
      balance: toDecimal(balanceMinor),
      createdAt: createdAt.toISOString(),
    };
  }
}
