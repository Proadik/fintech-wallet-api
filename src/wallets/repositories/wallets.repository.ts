import { Wallet } from '../interfaces/wallet.interface.js';

export abstract class WalletsRepository {
  abstract save(wallet: Wallet): Wallet
  abstract findById(id: string): Wallet | undefined
  abstract findByUserId(userId: string): Wallet[]
}
