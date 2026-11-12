import { NewTransfer, Transfer } from '../interfaces/transfer.interface.js';

export abstract class TransfersRepository {
  abstract create(data: NewTransfer): Promise<Transfer>
}
