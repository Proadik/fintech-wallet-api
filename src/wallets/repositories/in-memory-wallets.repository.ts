import { Injectable } from '@nestjs/common';
import { Wallet } from '../interfaces/wallet.interface.js';
import { WalletsRepository } from './wallets.repository.js';

@Injectable()
export class InMemoryWalletsRepository extends WalletsRepository {
  private readonly wallets = new Map<string, Wallet>()

  save (wallet: Wallet) {
    this.wallets.set(wallet.id, wallet)
    return wallet
  }

  findById (id: string) {
    return this.wallets.get(id)
  }

  findByUserId (userId: string) {
    return Array.from(this.wallets.values()).filter(wallet => wallet.userId === userId)
  }
}
