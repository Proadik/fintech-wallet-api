export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  createdAt: string;
}

// What the application supplies; the storage generates id and createdAt
// and opens the wallet with a zero balance
export type NewWallet = Pick<Wallet, 'userId' | 'currency'>
