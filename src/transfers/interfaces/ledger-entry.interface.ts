export interface LedgerEntryRecord {
  id: string;
  walletId: string;
  // Signed: '-150.00' takes money out of the wallet, '150.00' puts it in
  amount: string;
  transferId: string;
  createdAt: string;
}

export type NewLedgerEntryRecord = Pick<LedgerEntryRecord, 'walletId' | 'amount' | 'transferId'>;
