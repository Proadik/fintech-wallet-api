// 'debit' takes money out of the wallet, 'credit' puts it in
export type LedgerEntryDirection = 'debit' | 'credit';

export interface LedgerEntryRecord {
  id: string;
  walletId: string;
  direction: LedgerEntryDirection;
  // Always positive here; the stored amount is negative for a debit
  amount: string;
  transferId: string;
  createdAt: string;
}

export type NewLedgerEntryRecord = Pick<LedgerEntryRecord, 'walletId' | 'direction' | 'amount' | 'transferId'>;
