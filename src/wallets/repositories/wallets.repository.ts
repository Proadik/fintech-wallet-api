import { NewWallet, Wallet } from '../interfaces/wallet.interface.js';

export abstract class WalletsRepository {
  abstract create(data: NewWallet): Promise<Wallet>;
  abstract findById(id: string): Promise<Wallet | undefined>;
  abstract findByUserId(userId: string): Promise<Wallet[]>;
  abstract lockByIds(ids: string[]): Promise<Wallet[]>;
  abstract increaseBalance(id: string, amount: string): Promise<Wallet | undefined>;
  abstract decreaseBalance(id: string, amount: string): Promise<Wallet | undefined>;
}
