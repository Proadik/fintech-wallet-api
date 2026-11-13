import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransactionRunner } from '../common/transactions/transaction-runner.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { WalletsService } from '../wallets/wallets.service.js';
import { createHash } from 'node:crypto';
import { toMinor } from '../common/money.js';

@Injectable()
export class TransfersService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly transfers: TransfersRepository,
    private readonly walletsService: WalletsService,
  ) {}

  create(dto: CreateTransferDto, idempotencyKey: string) {
    if (dto.fromWalletId.toLowerCase() === dto.toWalletId.toLowerCase()) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    return this.transactions.run(
      async ({ transfers, wallets, idempotency, ledgerEntries }) => {
        const canonical = [
          dto.fromWalletId,
          dto.toWalletId,
          toMinor(dto.amount),
          dto.currency,
        ].join('|');
        const canonicalHash = createHash('sha256')
          .update(canonical)
          .digest('hex');

        const key = await idempotency.create({
          transferId: null,
          key: idempotencyKey,
          requestHash: canonicalHash,
        });

        if (!key) {
          const previous = await idempotency.find(idempotencyKey);

          if (previous?.requestHash !== canonicalHash) {
            throw new ConflictException(
              'Idempotency key already used with different request parameters',
            );
          }

          if (!previous.transferId) throw new NotFoundException();
          return await transfers.findById(previous.transferId);
        }

        const locked = await wallets.lockByIds([
          dto.fromWalletId,
          dto.toWalletId,
        ]);
        const sender = locked.find((wallet) => wallet.id === dto.fromWalletId);
        const receiver = locked.find((wallet) => wallet.id === dto.toWalletId);

        if (!sender || !receiver) {
          throw new NotFoundException(
            'Wallet not found. Check the wallet ids.',
            {},
          );
        }

        if (
          sender.currency !== receiver.currency ||
          sender.currency !== dto.currency ||
          receiver.currency !== dto.currency
        )
          throw new BadRequestException('Currency mismatch');

        if (toMinor(sender.balance) < toMinor(dto.amount))
          throw new ConflictException('Insufficient funds');

        if (!(await wallets.decreaseBalance(dto.fromWalletId, dto.amount))) {
          throw new ConflictException('Insufficient funds');
        }

        await wallets.increaseBalance(dto.toWalletId, dto.amount);
        const transfer = await transfers.create(dto);
        await ledgerEntries.create({
          transferId: transfer.id,
          walletId: dto.fromWalletId,
          direction: 'debit',
          amount: dto.amount,
        });
        await ledgerEntries.create({
          transferId: transfer.id,
          walletId: dto.toWalletId,
          direction: 'credit',
          amount: dto.amount,
        });
        await idempotency.update(key.id, { transferId: transfer.id });
        return transfer;
      },
    );
  }

  async find(id: string) {
    const transfer = await this.transfers.findById(id);

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  async getWalletTransfers(walletId: string) {
    await this.walletsService.getOne(walletId);
    return this.transfers.findByWalletId(walletId);
  }
}
