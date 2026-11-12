import { NewWallet, Wallet } from '../interfaces/wallet.interface.js';

export abstract class WalletsRepository {
  abstract create(data: NewWallet): Promise<Wallet>
  abstract findById(id: string): Promise<Wallet | undefined>
  abstract findByUserId(userId: string): Promise<Wallet[]>
}
