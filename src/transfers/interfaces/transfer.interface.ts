export interface Transfer {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  currency: string;
  createdAt: string;
}

export interface NewTransfer extends Omit<Transfer, 'id' | 'createdAt'> {}
