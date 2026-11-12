import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { TransactionRunner } from '../common/transactions/transaction-runner.js';
import { createHash } from 'node:crypto';
import { toMinor } from '../common/money.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly transactions: TransactionRunner,
  ) {}
  create (dto: CreateTransferDto, idempotencyKey: string) {
    return this.transactions.run(async ({ transfers, wallets, idempotency, ledgerEntries }) => {
      const canonical = [dto.fromWalletId, dto.toWalletId, toMinor(dto.amount), dto.currency].join('|');
      const canonicalHash = createHash('sha256').update(canonical).digest('hex');

      const key = await idempotency.create({
        transferId: null,
        key: idempotencyKey,
        requestHash: canonicalHash,
      });

      if (!key) {
        const previous = await idempotency.find(idempotencyKey)

        if (previous?.requestHash !== canonicalHash) {
          throw new ConflictException('Idempotency key already used with different request parameters')
        }

        return {
          transferId: previous.transferId,
        };
      }

      const locked = await wallets.lockByIds([dto.fromWalletId, dto.toWalletId])
      const sender = locked.find(wallet => wallet.id === dto.fromWalletId)
      const receiver = locked.find(wallet => wallet.id === dto.toWalletId)

      if (!sender || !receiver) {
        throw new NotFoundException('Wallet not found. Check the wallet ids.', {})
      }

      if (sender.currency !== receiver.currency || sender.currency !== dto.currency || receiver.currency !== dto.currency) throw new BadRequestException('Currency mismatch');

      if (toMinor(sender.balance) < toMinor(dto.amount)) throw new UnprocessableEntityException('Insufficient funds');

      if (!await wallets.decreaseBalance(dto.fromWalletId, dto.amount)) {
        throw new UnprocessableEntityException('Insufficient funds')
      }

      await wallets.increaseBalance(dto.toWalletId, dto.amount)
      const transfer = await transfers.create(dto)
      await ledgerEntries.create({ transferId: transfer.id, walletId: dto.fromWalletId, amount: `-${dto.amount}` })
      await ledgerEntries.create({ transferId: transfer.id, walletId: dto.toWalletId, amount: `${dto.amount}` })
      await idempotency.update(key.id, { transferId: transfer.id })
    })
  }
}
