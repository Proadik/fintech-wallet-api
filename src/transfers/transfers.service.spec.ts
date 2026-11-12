import { Test, TestingModule } from '@nestjs/testing';
import { TransfersService } from './transfers.service.js';
import { TransfersRepository } from './repositories/transfers.repository.js';
import { TransactionRunner } from '../common/transactions/transaction-runner.js';

describe('TransfersService', () => {
  let service: TransfersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: TransfersRepository, useValue: { create: vi.fn() } },
        { provide: TransactionRunner, useValue: { run: vi.fn() } },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
