import { Injectable } from '@nestjs/common';
import { Wallet } from '../interfaces/wallet.interface.js';
import { WalletsRepository } from './wallets.repository.js';

@Injectable()
export class InMemoryWalletsRepository extends WalletsRepository {
  private readonly wallets = new Map<string, Wallet>()

  async save (wallet: Wallet) {
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
