import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NewWallet, Wallet } from '../interfaces/wallet.interface.js';
import { WalletsRepository } from './wallets.repository.js';

@Injectable()
export class InMemoryWalletsRepository extends WalletsRepository {
  private readonly wallets = new Map<string, Wallet>()

  // Stands in for the database, so it generates id, createdAt and the zero balance itself
  async create ({ userId, currency }: NewWallet) {
    const wallet: Wallet = {
      id: randomUUID(),
      userId,
      currency,
      balance: '0.00',
      createdAt: new Date().toISOString(),
    }

    this.wallets.set(wallet.id, wallet)
    return wallet
  }

  async findById (id: string) {
    return this.wallets.get(id)
  }

  async findByUserId (userId: string) {
    return Array.from(this.wallets.values()).filter(wallet => wallet.userId === userId)
  }
}
