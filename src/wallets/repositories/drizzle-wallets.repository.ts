import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module.js';
import { rethrowUniqueViolation } from '../../database/unique-violation.js';
import { walletSchema } from '../../database/schema/index.js';
import { NewWallet, Wallet } from '../interfaces/wallet.interface.js';
import { WalletsRepository } from './wallets.repository.js';

type WalletRow = typeof walletSchema.$inferSelect

@Injectable()
export class DrizzleWalletsRepository extends WalletsRepository {
  constructor (@InjectDrizzle() private readonly db: Database) {
    super()
  }

  // id, balance_minor and created_at come from the column defaults
  async create ({ userId, currency }: NewWallet) {
    const [row] = await rethrowUniqueViolation(
      this.db.insert(walletSchema).values({ userId, currency }).returning(),
    )

    return this.toWallet(row)
  }

  async findById (id: string) {
    const [row] = await this.db.select().from(walletSchema).where(eq(walletSchema.id, id))

    return row && this.toWallet(row)
  }

  async findByUserId (userId: string) {
    const rows = await this.db
      .select()
      .from(walletSchema)
      .where(eq(walletSchema.userId, userId))
      .orderBy(walletSchema.createdAt)

    return rows.map(row => this.toWallet(row))
  }

  private toWallet ({ balanceMinor, createdAt, ...row }: WalletRow): Wallet {
    return {
      ...row,
      balance: this.toDecimal(balanceMinor),
      createdAt: createdAt.toISOString(),
    }
  }

  // 12345n -> '123.45'. USD, EUR and KZT all have two decimal places
  private toDecimal (minor: bigint) {
    return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`
  }
}
