import { Test, TestingModule } from '@nestjs/testing';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { TransactionRunner } from '../common/transactions/transaction-runner.js';

describe('TransfersController', () => {
  let controller: TransfersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        TransfersService,
        { provide: TransfersRepository, useValue: { create: vi.fn() } },
        { provide: TransactionRunner, useValue: { run: vi.fn() } },
      ],
    }).compile();

    controller = module.get<TransfersController>(TransfersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
