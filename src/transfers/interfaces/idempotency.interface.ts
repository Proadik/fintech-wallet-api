export interface IdempotencyRecord {
  id: string;
  key: string;
  requestHash: string;
  transferId: string | null;
  createdAt: string;
}

export type NewIdempotencyRecord = Pick<IdempotencyRecord, 'key' | 'requestHash' | 'transferId'>;
