import { Module } from '@nestjs/common';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { DrizzleTransfersRepository } from './repositories/drizzle-transfers.repository.js';
import { TransactionRunner } from '../common/transactions/transaction-runner.js';
import { DrizzleTransactionRunner } from '../database/drizzle-transaction-runner.js';

@Module({
  controllers: [TransfersController],
  providers: [
    TransfersService,
    { provide: TransfersRepository, useClass: DrizzleTransfersRepository },
    { provide: TransactionRunner, useClass: DrizzleTransactionRunner },
  ],
})
export class TransfersModule {}
